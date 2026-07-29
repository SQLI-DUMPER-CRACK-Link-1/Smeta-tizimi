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
function navbatBoshla(faqatBitta, mode){
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
    if(mode === 'tezkor'){
      royxat.push(nom+'@@TEZKOR');
    } else if(nParts>1 && !lockMi(nom)){
      for(var p=0;p<nParts;p++) royxat.push(nom+'@@P'+p);
      royxat.push(nom+'@@COMBINE');
    } else {
      royxat.push(nom);
    }
  });
  if(!royxat.length) return {ok:false, xabar:'Ob\'ekt topilmadi'};
  
  if(faqatBitta && sp.getProperty(_NB_RUN) === '1') {
    var mavjud = JSON.parse(sp.getProperty(_NB_KEY) || '[]');
    // ⚡ fix: agar bu obyekt shu partiyada ALLAQACHON muvaffaqiyatli ishlangan bo'lsa
    // (_NB_LOG da ok:true bilan bor, lekin _NB_KEY dan chiqarib yuborilgan), qayta
    // qo'shilmaydi. Aks holda ikki marta ishlanardi — 2-marta GAS ichki sheet-keshi
    // eskirgani uchun "A sheet with ID ... does not exist" kabi tasodifiy xato berardi
    // (ma'lumotga zarar yo'q, shunchaki keraksiz qayta urinish edi).
    var oldLog=[]; try{ oldLog=JSON.parse(sp.getProperty(_NB_LOG)||'[]'); }catch(e){}
    var tayyor={};
    oldLog.forEach(function(l){ if(l && l.ok && !l.qisman && l.ob) tayyor[l.ob]=true; });
    var added = 0, otkazildi = 0;
    royxat.forEach(function(r) {
       var obNomi=String(r).split('@@')[0];
       if(tayyor[obNomi]){ otkazildi++; return; }
       if(mavjud.indexOf(r) === -1) { mavjud.push(r); added++; }
    });
    sp.setProperty(_NB_KEY, JSON.stringify(mavjud));
    // ⚡ Trigger o'lganmi tekshiramiz (oldingi ijro timeout'da o'lgan bo'lishi mumkin) —
    // bo'lmasa darhol qayta yaratamiz, foydalanuvchi 10-daqiqa watchdog'ni kutib o'tirmasin.
    var trBor=false, trs0=ScriptApp.getProjectTriggers();
    for(var ti=0;ti<trs0.length;ti++) if(trs0[ti].getHandlerFunction()===_NB_FN){ trBor=true; break; }
    if(!trBor && mavjud.length){
      var ts0=parseInt(sp.getProperty(_NB_TS)||'0',10);
      if(Date.now()-ts0 > 6.5*60*1000){   // oxirgi qadam 6.5+ daqiqa oldin — ijro aniq o'lgan
        ScriptApp.newTrigger(_NB_FN).timeBased().after(2000).create();
      }
    }
    return {ok:true, jami:mavjud.length, xabar: faqatBitta + ' навбатга қўшилди (Жами: ' + mavjud.length + ')' +
      (otkazildi ? (' — '+otkazildi+' та шу партияда аллақачон тайёр, ўтказиб юборилди') : '')};
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

  // ⚡ PEEK (shift EMAS): item navbat BOSHIDA QOLADI — ijro 6-daqiqa limitda o'lsa ham
  // yo'qolmaydi. Avval shift qilinardi → timeout'da obyekt JIMGINA tushib qolardi
  // (natija ham yozilmasdi), watchdog navbatni bo'sh ko'rib "tugadi" derdi — foydalanuvchi
  // "hech narsa qilmayapti" deb ko'rardi (Amfiteatr АРХ.ЧАСТЬ aynan shunday yo'qolgan).
  // Endi: timeout → item joyida → watchdog qayta uradi → 3 urinishdan keyin skip-log.
  var item=String(navbat[0]);

  // Urinishlar limiti — bitta obyekt 3 marta yiqilsa (timeout ham) skip (navbat qotmasin)
  var tryMap={};
  try{ tryMap=JSON.parse(sp.getProperty(_NB_TRY)||'{}'); }catch(e){}
  tryMap[item]=(tryMap[item]||0)+1;
  sp.setProperty(_NB_TRY, JSON.stringify(tryMap));

  // BOSQICHLI + KO'P-LRV: item turi — oddiy 'ob', per-qism 'ob@@P<n>', birlashtir 'ob@@COMBINE'
  var ob=String(item).split('@@')[0].split('||')[0];
  var _mPart=String(item).match(/@@P(\d+)/);
  var isTezkor = /@@TEZKOR$/.test(item);
  var mode = isTezkor ? 'tezkor' : (/@@COMBINE$/.test(item) ? 'combine' : (_mPart ? 'qism' : 'full'));
  var partIndex = _mPart ? parseInt(_mPart[1],10) : -1;

  var t0=Date.now(), natija=null, qoldir=false;  // qoldir=true → item navbat boshida qoladi (davom etadi)
  
  if (String(item).indexOf('F2@@') === 0) {
    if(tryMap[item]>3){
      natija={ob:item, ok:false, sek:0, xato:'F2 3 марта уриниш муваффақиятсиз'};
    } else {
      var pts = item.split('@@');
      var f2Ob = pts[1], f2Oy = pts[2], f2Fid = pts[3];
      try {
        var f2File = DriveApp.getFileById(f2Fid);
        var f2Data = JSON.parse(f2File.getBlob().getDataAsString());
        natija = apiF2Qolla(f2Ob, f2Oy, f2Data.edits, f2Data.dopps);
        natija.ob = f2Ob + ' (F2 '+f2Oy+')';
        natija.sek = Math.round((Date.now()-t0)/1000);
        f2File.setTrashed(true);
      } catch(ex) {
        natija = {ob: f2Ob + ' (F2)', ok:false, sek: Math.round((Date.now()-t0)/1000), xato: ex.message||ex};
      }
    }
    // Davom etamiz
  } else if(tryMap[item]>3){
    natija={ob:ob, ok:false, sek:0,
            xato:'3 марта уриниш муваффақиятсиз (таймаут бўлиши мумкин) — ўтказиб юборилди. '+
                 'Обект жуда катта бўлса: «⚡ Doimiy GS» қилиб, кейин қайта [Ишла] уриниб кўринг.'};
  } else {
    try{
      if(mode==='tezkor'){
        var rTez = apiObyektTezkorIshla(ob, true);
        var missTez=(rTez&&rTez.topilmadi)||0;
        natija={ob:ob, ok:true, qator:(rTez&&rTez.qator)||0,
                xabar:'⚡ Тезкор янгиланди (Сводка)'+(missTez?(' — ⚠ '+missTez+' та нарх топилмади (_NARX_LOG)'):''),
                sek:Math.round((Date.now()-t0)/1000)};
      } else if(mode==='combine'){
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
            qoldir=true;   // item navbat boshida qoladi — keyingi trigger davom ettiradi
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
          // VARAQ BO'LINISHI: hali tugatilmagan — item navbat boshida qoladi
          qoldir=true;
          natija={ob:ob, ok:true, qisman:true, qator:(r.qator||0),
                  xabar:'Varaq '+(r.varaq||'?')+' tayyor, davom etadi...',
                  sek:Math.round((Date.now()-t0)/1000)};
        } else {
          var missFull=(r&&r.topilmadi)||0;
          natija={ob:ob, ok:true, qator:(r&&r.qator)||0, locked:(r&&r.locked)||false,
                  xabar: missFull ? ('⚠ '+missFull+' та нарх топилмади (_NARX_LOG)') : undefined,
                  sek:Math.round((Date.now()-t0)/1000)};
        }
      }
      // Progress bo'ldi (success/partial) → urinish hisoblagichini nollaymiz
      // (partial resume 3-urinish limitiга urilib o'lmasligi uchun)
      tryMap[item]=0; sp.setProperty(_NB_TRY, JSON.stringify(tryMap));
    }catch(e){
      var emsg=String(e&&e.message?e.message:e);
      // ⚡ fix: "sheet with ID ... does not exist" — GAS ichki sahifa keshi eskirgani
      // (odatda shu obyekt duplikat navbatda ikki marta ishlanganda chiqadi — yuqoridagi
      // "allaqachon tayyor" filtri buni oldini oladi, lekin eski/qo'lda holatlar uchun
      // ham tushunarli izoh bilan chiqsin). Ma'lumotga zarar YO'Q — xavfsiz qayta urinish.
      if(/sheet with id.*does not exist/i.test(emsg)){
        emsg='Обект шу партияда бошқа жараён томонидан аллақачон ишланган бўлиши мумкин ' +
             '(сахифа маълумоти эскирган) — маълумотга зарар йўқ, хавфсиз. Керак бўлса ' +
             'қайта [Ишла] босинг. (техник: '+emsg+')';
      }
      natija={ob:ob, ok:false, xato:emsg,
              sek:Math.round((Date.now()-t0)/1000)};
    }
  }
  _navbatLogQosh(natija);

  // Item taqdiri: partial (qoldir) → boshida qoladi; aks holda (ok/xato/skip) chiqariladi.
  // Qayta o'qiymiz — jarayon davomida foydalanuvchi yangi obyekt qo'shgan bo'lishi mumkin.
  navbat=JSON.parse(sp.getProperty(_NB_KEY)||'[]');
  if(!qoldir && navbat.length && String(navbat[0])===item){
    navbat.shift();
    sp.setProperty(_NB_KEY, JSON.stringify(navbat));
  }
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
/* Panel API: barchasini TEZKOR fon-navbatda */
function apiBarchaTezkorIshla(){
  return navbatBoshla(null, 'tezkor');
}
/* Panel API: bitta ob'ektni TEZKOR fon-navbatda */
function apiObyektTezkorFonIshla(obyekt){
  return navbatBoshla(obyekt, 'tezkor');
}

/* ============ AVTOMATIK TRIGGERLAR ============
 * Bir marta ishga tushiring: triggerlarOrnat()
 * — Har kuni 06:00 da DASHBOARD + skan kesh avtomatik yangilanadi. 
 * — Har kuni 03:00 da Arxiv zaxirasi olinadi. */
function triggerlarOrnat(){
  // Eski avtomatik triggerlarni o'chiramiz (navbatga tegmaymiz)
  var trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++){
    var fn=trs[i].getHandlerFunction();
    if(fn==='avtoYangilash' || fn==='apiKunlikArxivYarat') { try{ScriptApp.deleteTrigger(trs[i]);}catch(e){} }
  }
  // Har kuni ertalab 6 da Dashboard
  ScriptApp.newTrigger('avtoYangilash').timeBased().everyDays(1).atHour(6).create();
  // Har kuni kechasi 3 da Arxiv
  ScriptApp.newTrigger('apiKunlikArxivYarat').timeBased().everyDays(1).atHour(3).create();
  return 'Avtomatik trigger o\'rnatildi: 06:00 dashboard, 03:00 arxiv';
}

/* Trigger chaqiradi — dashboard + skan/holat/boss keshini yangilaydi (LRV qayta ishlamaydi) */
function avtoYangilash(){
  if (typeof tizimMuzlatilganMi === 'function' && tizimMuzlatilganMi()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Avtomatik yangilash bajarilmadi.');
    return;
  }
  try{ serverYigPapka(); }catch(e){ Logger.log('avtoYangilash server: '+e); }
  try{ _keshWarmUp(); }catch(e){ Logger.log('avtoYangilash warmup: '+e); }
  // ⚡ 2026-07-10: Грaфик работ — oxirgi saqlangan sozlamalar bo'yicha fon jarayonini
  //   boshlaydi (toza FAKT bilan), shunda foydalanuvchi kirganda TAYYOR turadi.
  if(typeof _grafikAvtoYangilash==='function'){ try{ _grafikAvtoYangilash(); }catch(e){ Logger.log('grafik avto: '+e); } }
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

/* ============ KUNLIK ARXIV ZAXIRASI ============ */
function apiKunlikArxivYarat(){
  var sp = PropertiesService.getScriptProperties();
  var cursorStr = sp.getProperty('ARXIV_CURSOR');
  var cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
  
  var obs = papkaSkan();
  var sanaSuffix = Utilities.formatDate(new Date(), 'Asia/Tashkent', '(yyyy-MM-dd HH-mm)');
  var jamiNusxa = 0;
  var startTime = new Date().getTime();
  
  // 1. Papkalar ro'yxatini yig'amiz (dublikatlarsiz)
  var uniqueFolders = [];
  var seen = {};
  for(var i=0; i<obs.length; i++){
    var fid = obs[i].folderId;
    if(!seen[fid]) {
      seen[fid] = true;
      uniqueFolders.push(fid);
    }
  }
  
  var qilinganFayllar = {}; 
  
  // 2. Kursor joyidan boshlab arxivlaymiz
  for(var i=cursor; i<uniqueFolders.length; i++){
    
    // 3. Timeout himoyasi (4.5 daqiqa)
    if(new Date().getTime() - startTime > 4.5 * 60 * 1000){
      sp.setProperty('ARXIV_CURSOR', String(i));
      return "⏳ Limit sababli " + jamiNusxa + " ta fayl arxivlandi.\nYana " + (uniqueFolders.length - i) + " ta papka qoldi.\nIltimos, MENU dan yana bir marta 'Архив яратиш' ni bosing!";
    }
    
    var folderId = uniqueFolders[i];
    try {
      var folder = DriveApp.getFolderById(folderId);
      var fileIter = folder.searchFiles("title contains '" + CFG.PLUS_SUF + "' and trashed = false");
      var arxivFolder = null;
      
      while(fileIter.hasNext()){
        var file = fileIter.next();
        var fid = file.getId();
        if(qilinganFayllar[fid]) continue;
        qilinganFayllar[fid] = true;
        
        if(!arxivFolder){
          var arxivFolders = folder.getFoldersByName('Arxiv');
          if(arxivFolders.hasNext()) arxivFolder = arxivFolders.next();
          else arxivFolder = folder.createFolder('Arxiv');
        }
        
        var originalName = file.getName();
        var newName = originalName + ' ' + sanaSuffix;
        file.makeCopy(newName, arxivFolder);
        jamiNusxa++;
      }
      
      if(arxivFolder){
        _arxivEskilarniTozala(arxivFolder, 3);
      }
      
    } catch(e) {
      Logger.log("Arxiv xato papkada ("+folderId+"): "+e);
    }
  }
  
  // Barcha ish yakunlandi, kursorni tozalaymiz
  sp.deleteProperty('ARXIV_CURSOR');
  var xulosa = cursor > 0 ? "✅ Arxivlash TO'LIQ yakunlandi!" : "✅ Arxiv yaratildi!";
  return xulosa + "\nJami " + uniqueFolders.length + " ta papkada " + jamiNusxa + " ta fayl nusxalandi.";
}

function _arxivEskilarniTozala(folder, kun){
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - kun);
  
  var iter = folder.getFiles();
  while(iter.hasNext()){
    var f = iter.next();
    if(f.getDateCreated() < cutoff){
      try { f.setTrashed(true); } catch(e){}
    }
  }
}
