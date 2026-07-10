/******************************************************************
 * 74_AI_Kunlik_Vazifa.js — 🧠 "RAQAMLI PRORAB": kunlik vazifa rejasi
 * ==================================================================
 * Har tongda AI UCHALA tizimni birlashtirib, PTO muhandisi uchun
 * USTUVORLANGAN "bugun nima qilish kerak" ro'yxatini tuzadi:
 *   • Smeta: aktsiz yashirin ishlar (akt yozish kerak)
 *   • Smeta: KRITIK/XATO anomaliya (tuzatish kerak)
 *   • Viborka (hub): eng katta material DEFITSITi (buyurtma kerak)
 * Hammasi GROUNDED (koddan/Supabase'dan), AI faqat tartiblaydi/izohlaydi.
 *
 * Gateway orqali (aiCall) — API limitga chidamli.
 *
 * Kirish:
 *   aiKunlikVazifa()      -> {text, items}
 *   tgAiVazifa()          -> adminlarga Telegram
 *   aiVazifaTriggerOrnat()-> har kuni 07:30 avtomatik
 ******************************************************************/

function aiKunlikVazifa(){
  try{
    if(typeof _aiKey==='function' && !_aiKey()) return {text:'Gemini kaliti kerak (setkey:KALIT).'};
    var L=[], aktlar=[], anom=[], deficit=[];

    // 1) Obyektlar bo'yicha — akt kerak + anomaliya (grounded)
    var objs=[];
    try{ objs=(apiBossData().objects||[]).map(function(o){return o.nom;}); }catch(e){}
    objs.forEach(function(ob){
      try{ if(typeof apiAktCoverage==='function'){ var c=apiAktCoverage(ob).stats||{};
        if(c.yashirinAktsiz>0) aktlar.push(ob+': '+c.yashirinAktsiz+' ta yashirin ishga akt yo\'q'); } }catch(e){}
      try{ if(typeof _aiAnomOl==='function'){ var an=_aiAnomOl(ob)||[];
        an.filter(function(a){return a.daraja==='kritik'||a.daraja==='xato';})
          .forEach(function(a){ anom.push(ob+' — '+a.qoida+': '+a.tavsif); }); } }catch(e){}
    });

    // 2) Material defitsit (Viborka hub'dan) — qiymat bo'yicha top
    try{
      if(typeof _aiSbGet==='function'){
        var rows=_aiSbGet('viborka_nazorat','qoldiq=gt.0&select=nom,birlik,qoldiq,narx,holat&limit=80')||[];
        rows.forEach(function(r){ r._q=(Number(r.qoldiq)||0)*(Number(r.narx)||0); });
        rows.sort(function(a,b){return b._q-a._q;});
        rows.slice(0,12).forEach(function(r){
          deficit.push(r.nom+' — yetishmaydi '+(Math.round((Number(r.qoldiq)||0)*100)/100)+' '+(r.birlik||'')+
            (r.narx?(' (~'+_aiPul(r._q)+')'):''));
        });
      }
    }catch(e){}

    if(aktlar.length){ L.push('AKT KERAK ('+aktlar.length+' obyekt):'); aktlar.slice(0,15).forEach(function(x){L.push('- '+x);}); }
    if(anom.length){ L.push('\nANOMALIYA (kritik/xato '+anom.length+'):'); anom.slice(0,15).forEach(function(x){L.push('- '+x);}); }
    if(deficit.length){ L.push('\nMATERIAL DEFITSIT (top):'); deficit.forEach(function(x){L.push('- '+x);}); }

    if(!L.length) return {text:'✅ Bugun shoshilinch vazifa yo\'q — barcha tizim joyida.', items:0};

    var sys='Sen — qurilish PTO muhandisining shaxsiy yordamchisisan ("raqamli prorab").\n'+
      'Senga bugungi GROUNDED holat beriladi (akt kerak, anomaliya, material defitsit).\n'+
      'VAZIFA: shulardan PTO uchun BUGUNGI ustuvor VAZIFALAR ro\'yxatini tuz:\n'+
      '1. Eng muhim/xavfli birinchi (pul yo\'qotish, yuridik xavf, ishni to\'xtatuvchi).\n'+
      '2. Har vazifa: nima qilish + qaysi obyekt/material + nega muhim (qisqa).\n'+
      '3. Raqamli ro\'yxat (1,2,3...), o\'zbekcha, 10 tadan oshmasin.\n'+
      'Faqat berilgan ma\'lumotdan foydalan, yangisini O\'YLAB CHIQARMA. Markdown: **qalin**.';
    var ans=aiCall({ system:sys, user:L.join('\n'), temp:0.3, maxTok:1100, cacheKey:'vazifa|'+Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMddHH') });
    return {text:ans, items:(aktlar.length+anom.length+deficit.length)};
  }catch(e){ return {text:'❌ '+(e.message||e), error:String(e.message||e)}; }
}

/* Telegram — adminlarga */
function tgAiVazifa(){
  var admins=(typeof _tgAdmins==='function')?_tgAdmins():[];
  if(!admins.length){ Logger.log('tgAiVazifa: admin yo\'q'); return; }
  var r=aiKunlikVazifa();
  var sana=Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy');
  var t='🧠 <b>BUGUNGI VAZIFALAR</b> — '+sana+'\n\n'+_vazMd(r.text||'');
  admins.forEach(function(id){ try{ _tgSend(id,t); }catch(e){} });
  return 'yuborildi: '+admins.length;
}
function _vazMd(s){
  s=String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*/gm,'').replace(/^- /gm,'• ');
}

/* Trigger — har kuni 07:30 */
function aiVazifaTriggerOrnat(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='tgAiVazifa') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('tgAiVazifa').timeBased().everyDays(1).inTimezone('Asia/Tashkent').atHour(7).nearMinute(30).create();
  var m='✅ Kunlik vazifa trigger o\'rnatildi (07:30, tgAiVazifa)';
  try{ SpreadsheetApp.getUi().alert(m); }catch(e){}
  return m;
}

function aiVazifaTest(){ Logger.log(JSON.stringify(aiKunlikVazifa(),null,2)); }
