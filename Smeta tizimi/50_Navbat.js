/********************************************************************
 * 50_Navbat.gs — AVTOMATIK FON ISHLASH (NAVBAT + TRIGGERLAR)
 * ==================================================================
 * MUAMMO: "Барчасини ишлаш" hamma ob'ektni ketma-ket ishlaydi →
 *         6 daqiqa timeout → qotadi → qayta ishlamaydi.
 *
 * YECHIM: Navbat (queue). Har ob'ekt ALOHIDA trigger-execution da
 *         ishlanadi. Har biri yangi 6 daqiqa oladi → timeout yo'q.
 *
 * Foydalanish (BITTA TUGMA):
 *   navbatBoshla()  → barcha ob'ektni navbatga qo'yadi, fon ishni boshlaydi
 *   apiNavbatHolat() → progress (panel poll qiladi)
 *
 * Avtomatik triggerlar (bir marta o'rnatish):
 *   triggerlarOrnat() → har kuni avtomatik dashboard/kesh yangilash
 ********************************************************************/

var _NB_KEY  = 'NAVBAT';        // qolgan ob'ektlar JSON ('Obyekt' yoki 'Obyekt||N' — N=davom varaq)
var _NB_LOG  = 'NAVBAT_LOG';    // natijalar JSON
var _NB_RUN  = 'NAVBAT_RUNNING';// ishlayaptimi
var _NB_TRY  = 'NAVBAT_TRY';    // urinishlar {item:son} — 3 dan oshsa skip
var _NB_TS   = 'NAVBAT_TS';     // oxirgi qadam vaqti (watchdog uchun)
var _NB_FN   = '_navbatQadam';  // trigger funksiyasi nomi
var _NB_WD   = '_navbatWatchdog';
var _NB_DEADLINE_MS = 4.3*60*1000;  // 4.3 daqiqa — 6 min limitdan xavfsiz chekka

/* ============ BITTA TUGMA: BARCHASINI AVTO ISHLA ============ */
function navbatBoshla(faqatBitta){
  var sp=PropertiesService.getScriptProperties();
  var obs=papkaSkan();
  var omap={}; obs.forEach(function(o){ omap[o.obyekt]=o; });
  var baseList = faqatBitta ? [faqatBitta] : obs.map(function(o){return o.obyekt;});
  // KO'P-LRV: bir nechta lok fayli bo'lgan (va qulflanmagan) obyektni
  // per-qism (@@P0, @@P1...) + oxirida @@COMBINE ga yoyamiz → har qism alohida
  // trigger-ijroda (yangi 6 daqiqa), so'ng bitta hujjatga birlashtiriladi.
  var royxat=[];
  baseList.forEach(function(nom){
    var o=omap[nom];
    var nParts=(o && o.lokFiles && o.lokFiles.length) || 1;
    if(nParts>1 && !lockMi(nom)){
      for(var p=0;p<nParts;p++) royxat.push(nom+'@@P'+p);
      royxat.push(nom+'@@COMBINE');
    } else {
      royxat.push(nom);
    }
  });
  if(!royxat.length) return {ok:false, xabar:'Ob\'ekt topilmadi'};
  
  if(faqatBitta && sp.getProperty(_NB_RUN) === '1') {
    var mavjud = JSON.parse(sp.getProperty(_NB_KEY) || '[]');
    var added = 0;
    royxat.forEach(function(r) { 
       if(mavjud.indexOf(r) === -1) { mavjud.push(r); added++; }
    });
    sp.setProperty(_NB_KEY, JSON.stringify(mavjud));
    return {ok:true, jami:mavjud.length, xabar: faqatBitta + ' навбатга қўшилди (Жами: ' + mavjud.length + ')'};
  } else {
    sp.setProperty(_NB_KEY, JSON.stringify(royxat));
    sp.setProperty(_NB_LOG, JSON.stringify([]));
    sp.setProperty(_NB_TRY, '{}');
    sp.setProperty(_NB_TS, String(Date.now()));
    sp.setProperty(_NB_RUN, '1');
    
    // Barcha eski _ISHLA_ state kalitlarini tozalash (yangi navbat noldan boshlanishi uchun)
    var keys = sp.getKeys();
    for(var i=0;i<keys.length;i++){
      if(keys[i].indexOf('_ISHLA_')===0 || keys[i].indexOf('_PARTCNT_')===0) sp.deleteProperty(keys[i]);
    }
    
    _navbatTriggerOchir();          // eski triggerlarni tozalash
    ScriptApp.newTrigger(_NB_FN).timeBased().after(2000).create();
    // WATCHDOG: trigger o'lib qolsa (timeout/crash) navbatni qayta tiriltiradi
    _wdOchir();
    ScriptApp.newTrigger(_NB_WD).timeBased().everyMinutes(10).create();
    return {ok:true, jami:royxat.length, xabar:royxat.length+' та навбатга қўйилди. Фон ишламоқда...'};
  }
}

/* Trigger har safar chaqiradi: NAVBATdan 1 obyekt oladi va TO'LIQ ishlaydi.
 * Har obyekt alohida trigger-ijroda (yangi 6 daqiqa). Agar bitta obyekt 6 daqiqaga
 * sig'masa → ijro o'ladi → watchdog qayta uradi → 3 urinishdan keyin skip (qotmaydi). */
function _navbatQadam(){
  if (typeof tizimMuzlatilganMi === 'function' && tizimMuzlatilganMi()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Navbat bajarilmadi.');
    var sp=PropertiesService.getScriptProperties();
    sp.setProperty(_NB_RUN, '0');
    _navbatTriggerOchir();
    _wdOchir();
    return;
  }
  var sp=PropertiesService.getScriptProperties();
  _navbatTriggerOchir();          // shu triggerni o'chiramiz (qayta yaratiladi)
  sp.setProperty(_NB_TS, String(Date.now()));
  var navbat=JSON.parse(sp.getProperty(_NB_KEY)||'[]');
  if(!navbat.length){ _navbatTugadi(); return; }

  var item=String(navbat.shift());
  sp.setProperty(_NB_KEY, JSON.stringify(navbat));  // darhol saqlash (xato bo'lsa ham o'tadi)

  // Urinishlar limiti — bitta obyekt 3 marta yiqilsa skip (navbat qotmasin)
  var tryMap={};
  try{ tryMap=JSON.parse(sp.getProperty(_NB_TRY)||'{}'); }catch(e){}
  tryMap[item]=(tryMap[item]||0)+1;
  sp.setProperty(_NB_TRY, JSON.stringify(tryMap));

  // BOSQICHLI + KO'P-LRV: item turi — oddiy 'ob', per-qism 'ob@@P<n>', birlashtir 'ob@@COMBINE'
  var ob=String(item).split('@@')[0].split('||')[0];
  var _mPart=String(item).match(/@@P(\d+)/);
  var mode = /@@COMBINE$/.test(item) ? 'combine' : (_mPart ? 'qism' : 'full');
  var partIndex = _mPart ? parseInt(_mPart[1],10) : -1;

  var t0=Date.now(), natija=null;
  if(tryMap[item]>3){
    natija={ob:ob, ok:false, xato:'3 marta urinish muvaffaqiyatsiz — o\'tkazib yuborildi', sek:0};
  } else {
    try{
      if(mode==='combine'){
        var tc=skanBitta(ob); if(!tc) throw 'Объект топилмади: '+ob;
        var rc=_birlashtir(tc);
        natija={ob:ob, ok:true, qator:0, xabar:'✅ Бирлаштирилди ('+(rc.varaq||0)+' варақ)',
                sek:Math.round((Date.now()-t0)/1000)};
      } else if(mode==='qism'){
        var tq=skanBitta(ob); if(!tq) throw 'Объект топилмади: '+ob;
        if(lockMi(ob)){
          natija={ob:ob, ok:true, qator:0, xabar:'🔒 қулф — қисм '+(partIndex+1)+' ўтказилди', sek:0};
        } else {
          var rq=_ishlaQism(tq, partIndex);
          if(rq && rq.partial){
            navbat.unshift(item);
            sp.setProperty(_NB_KEY, JSON.stringify(navbat));
            natija={ob:ob, ok:true, qisman:true, qator:(rq.qator||0),
                    xabar:'Қисм '+(partIndex+1)+' давом этади...', sek:Math.round((Date.now()-t0)/1000)};
          } else {
            natija={ob:ob, ok:true, qator:(rq&&rq.qator)||0,
                    xabar:'Қисм '+(partIndex+1)+' тайёр', sek:Math.round((Date.now()-t0)/1000)};
          }
        }
      } else {
        var r=apiObyektIshla(ob, true);
        if(r && r.partial){
          // VARAQ BO'LINISHI: hali tugatilmagan — shu obyektni navbat BOSHIGA qaytaramiz
          navbat.unshift(item);
          sp.setProperty(_NB_KEY, JSON.stringify(navbat));
          natija={ob:ob, ok:true, qisman:true, qator:(r.qator||0),
                  xabar:'Varaq '+(r.varaq||'?')+' tayyor, davom etadi...',
                  sek:Math.round((Date.now()-t0)/1000)};
        } else {
          natija={ob:ob, ok:true, qator:(r&&r.qator)||0, locked:(r&&r.locked)||false,
                  sek:Math.round((Date.now()-t0)/1000)};
        }
      }
      // Progress bo'ldi (success/partial) → urinish hisoblagichini nollaymiz
      // (partial resume 3-urinish limitiга urilib o'lmasligi uchun)
      tryMap[item]=0; sp.setProperty(_NB_TRY, JSON.stringify(tryMap));
    }catch(e){
      natija={ob:ob, ok:false, xato:String(e&&e.message?e.message:e),
              sek:Math.round((Date.now()-t0)/1000)};
    }
  }
  _navbatLogQosh(natija);

  // Navbatda hali bor (yoki partial qaytdi) → keyingi trigger
  navbat=JSON.parse(sp.getProperty(_NB_KEY)||'[]');
  if(navbat.length){
    ScriptApp.newTrigger(_NB_FN).timeBased().after(2000).create();
  } else {
    _navbatTugadi();
  }
}

/* WATCHDOG — har 10 daqiqada: navbat ishlayapti-yu trigger yo'q bo'lsa
 * (oldingi ijro 6-min limitda O'LGAN) → qayta trigger yaratadi. Shu bilan
 * "GAME CLUB 0/8 qotib qoldi" muammosi avtomatik tuziladi. */
function _navbatWatchdog(){
  var sp=PropertiesService.getScriptProperties();
  if(sp.getProperty(_NB_RUN)!=='1'){ _wdOchir(); return; }
  var navbat=JSON.parse(sp.getProperty(_NB_KEY)||'[]');
  if(!navbat.length){ _navbatTugadi(); return; }
  // _navbatQadam trigger bormi?
  var bor=false, trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++) if(trs[i].getHandlerFunction()===_NB_FN){ bor=true; break; }
  if(bor) return;   // ishlayapti — tegmaymiz
  var ts=parseInt(sp.getProperty(_NB_TS)||'0',10);
  if(Date.now()-ts < 7*60*1000) return;  // hali yangi (qadam ichida bo'lishi mumkin)
  Logger.log('Watchdog: navbat o\'lgan, qayta tirgizildi. Qolgan: '+navbat.length);
  _navbatLogQosh({ob:String(navbat[0]).split('||')[0], ok:true, qisman:true,
    xabar:'🔁 Watchdog: тригger ўлган эди — қайта тирилтирилди', sek:0});
  ScriptApp.newTrigger(_NB_FN).timeBased().after(2000).create();
}
function _wdOchir(){
  var trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++){
    if(trs[i].getHandlerFunction()===_NB_WD){ try{ ScriptApp.deleteTrigger(trs[i]); }catch(e){} }
  }
}

function _navbatTugadi(){
  var sp=PropertiesService.getScriptProperties();
  sp.setProperty(_NB_RUN, '0');
  _navbatTriggerOchir();
  _wdOchir();   // watchdog ham to'xtaydi
  // Qolgan _TMP_ konvert fayllar va dublikat LRV_PLUS larni tozalash
  try{ tmpTozala(); }catch(e){ Logger.log('tmpTozala: '+e); }
  // Tugagach DASHBOARD avtomatik yangilanadi
  try{ serverYigPapka(); }catch(e){}
  // Skan + holat + boss keshini oldindan isitamiz (birinchi ochilish ham tez)
  try{ _keshWarmUp(); }catch(e){}
  // Supabase mirror — dashboard + narxlar (sozlanmagan bo'lsa no-op)
  if(typeof supabaseDashboardPush==='function'){ try{ supabaseDashboardPush(); }catch(e){ Logger.log('SB dash: '+e); } }
  if(typeof supabaseNarxlarPush==='function'){ try{ supabaseNarxlarPush(); }catch(e){} }
}

function _navbatLogQosh(natija){
  var sp=PropertiesService.getScriptProperties();
  var log=JSON.parse(sp.getProperty(_NB_LOG)||'[]');
  log.push(natija);
  if(log.length > 50) log = log.slice(log.length - 50); // 9KB limitdan himoya
  try {
    sp.setProperty(_NB_LOG, JSON.stringify(log));
  } catch(e) {
    // Agar baribir limitdan oshsa, eng oxirgilarini qoldiramiz
    log = log.slice(log.length - 20);
    sp.setProperty(_NB_LOG, JSON.stringify(log));
  }
}

/* Faqat _navbatQadam triggerlarini o'chiradi (avtomatik triggerlarga tegmaydi) */
function _navbatTriggerOchir(){
  var trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++){
    if(trs[i].getHandlerFunction()===_NB_FN){
      try{ ScriptApp.deleteTrigger(trs[i]); }catch(e){}
    }
  }
}

/* ============ PANEL POLL: navbat holati ============ */
function apiNavbatHolat(){
  var sp=PropertiesService.getScriptProperties();
  var navbat=JSON.parse(sp.getProperty(_NB_KEY)||'[]');
  var log=JSON.parse(sp.getProperty(_NB_LOG)||'[]');
  var running=sp.getProperty(_NB_RUN)==='1';
  var jami=navbat.length+log.length;
  return {
    running:running,
    qolgan:navbat.length,
    bajarilgan:log.length,
    jami:jami,
    foiz: jami>0 ? Math.round(log.length/jami*100) : 0,
    hozir: navbat.length?navbat[0]:'',
    log:log,
    navbat:navbat
  };
}

/* Navbatni to'xtatish (favqulodda) */
function apiNavbatToxtat(){
  var sp=PropertiesService.getScriptProperties();
  sp.setProperty(_NB_KEY, '[]');
  sp.setProperty(_NB_RUN, '0');
  _navbatTriggerOchir();
  return {ok:true, xabar:'Navbat to\'xtatildi'};
}

/* Panel API: bitta ob'ektni fon-navbatda ishlash (UI bloklanmaydi) */
function apiObyektFonIshla(obyekt){
  return navbatBoshla(obyekt);
}
/* Panel API: barchasini fon-navbatda */
function apiBarchaFonIshla(){
  return navbatBoshla(null);
}


/* ============ AVTOMATIK TRIGGERLAR ============
 * Bir marta ishga tushiring: triggerlarOrnat()
 * — Har kuni 06:00 da DASHBOARD + skan kesh avtomatik yangilanadi. */
function triggerlarOrnat(){
  // Eski avtomatik triggerlarni o'chiramiz (navbatga tegmaymiz)
  var trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++){
    var fn=trs[i].getHandlerFunction();
    if(fn==='avtoYangilash') { try{ScriptApp.deleteTrigger(trs[i]);}catch(e){} }
  }
  // Har kuni ertalab 6 da
  ScriptApp.newTrigger('avtoYangilash').timeBased().everyDays(1).atHour(6).create();
  return 'Avtomatik trigger o\'rnatildi: har kuni 06:00 da dashboard+kesh yangilanadi';
}

/* Trigger chaqiradi — dashboard + skan/holat/boss keshini yangilaydi (LRV qayta ishlamaydi) */
function avtoYangilash(){
  if (typeof tizimMuzlatilganMi === 'function' && tizimMuzlatilganMi()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Avtomatik yangilash bajarilmadi.');
    return;
  }
  try{ serverYigPapka(); }catch(e){ Logger.log('avtoYangilash server: '+e); }
  try{ _keshWarmUp(); }catch(e){ Logger.log('avtoYangilash warmup: '+e); }
  if(typeof supabaseDashboardPush==='function'){ try{ supabaseDashboardPush(); }catch(e){ Logger.log('SB dash: '+e); } }
  if(typeof supabaseNarxlarPush==='function'){ try{ supabaseNarxlarPush(); }catch(e){} }
}

/* Barcha triggerlarni ko'rish (diagnostika) */
function triggerlarRoyxat(){
  var trs=ScriptApp.getProjectTriggers();
  var out=trs.map(function(t){ return t.getHandlerFunction()+' ('+t.getEventType()+')'; });
  Logger.log('Triggerlar: '+(out.length?out.join(', '):'yo\'q'));
  return out;
}
