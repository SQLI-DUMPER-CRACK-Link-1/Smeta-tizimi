/******************************************************************
 * AktSmetaBridge.js — AKT GENERATOR ni SMETAGA bog'lovchi AI ko'prik
 * ==================================================================
 * Akt generator endi SMETA-XABARDOR: markaziy Supabase hub'dan
 * smetadagi BAJARILGAN ishlarni (holat: fakt>0) o'qiydi va REYESTR
 * bilan solishtirib, AKT YETISHMAYOTGAN yashirin ishlarni topadi.
 *
 *   aktSmetaIshlar(obyekt)   -> smetadagi bajarilgan ishlar (grounding uchun)
 *   aktAiKamchilik(obyekt)   -> akt yetishmayotgan yashirin ishlar + AI xulosa
 *   aktAiObyektlar()         -> hub'dagi obyektlar ro'yxati (UI uchun)
 *
 * ⚠️ Eslatma: eng aniq "auto-akt yozish" Smeta loyihasida (67_AI_Akt.js:
 *   apiAiAktDraft/apiAiAktYoz) — chunki u smeta daraxti + materiallarga
 *   to'liq kira oladi. Bu ko'prik Akt tomonida XABARDORLIK va grounding beradi.
 *
 * Model/AI: GeminiAssistant.js (_aktAiGen, GEMINI_MODEL). Supabase: SUPABASE_URL/KEY.
 ******************************************************************/

/* ── Supabase (hub) o'qish ── */
function _aktSbCfg(){
  var p=PropertiesService.getScriptProperties();
  var url=p.getProperty('SUPABASE_URL'), key=p.getProperty('SUPABASE_KEY');
  return (url&&key)?{url:url,key:key}:null;
}
function _aktSbGet(table, qs){
  var c=_aktSbCfg(); if(!c) return null;
  var resp=UrlFetchApp.fetch(c.url+'/rest/v1/'+table+'?'+qs,{
    headers:{'apikey':c.key,'Authorization':'Bearer '+c.key}, muteHttpExceptions:true});
  if(resp.getResponseCode()>=300) return [];
  try{ return JSON.parse(resp.getContentText()); }catch(e){ return []; }
}

/* ── Hub'dagi obyektlar ── */
function aktAiObyektlar(){
  var rows=_aktSbGet('obyektlar','select=nom&order=nom');
  return (rows||[]).map(function(r){ return String(r.nom||''); }).filter(String);
}

/* ── Smetadagi bajarilgan ishlar (grounding) ── */
function aktSmetaIshlar(obyekt){
  if(!obyekt) return {rows:[]};
  if(!_aktSbCfg()) return {rows:[], xato:'Supabase sozlanmagan (aktSupabaseSozlash)'};
  // holat: bajarilgan ish bloklari (bl) — fakt>0
  var rows=_aktSbGet('holat',
    'obyekt=eq.'+encodeURIComponent(obyekt)+'&tur=in.(bl,mat,ob)&fakt=gt.0'+
    '&select=nom,birlik,fakt,smeta_hajm,narx,razdel,kategoriya&order=razdel&limit=300')||[];
  return {obyekt:obyekt, rows:rows};
}

/* ── Yashirin ish kalit so'zlari (Smeta bilan bir xil mantiq) ── */
var _AKT_YASHIRIN_KW=['ЗЕМЛЯ','ФУНДАМЕНТ','АРМАТУР','ГИДРОИЗОЛ','ЗАСЫПК','СВАЙ','БЕТОН',
  'КЛАДК','ЗАКЛАДН','ПОДГОТОВ','УТЕПЛЕН','МОНОЛИТ','ИЗОЛЯЦ','ГРУНТОВ','ПРОКЛАДК',
  'ТРУБОПРОВОД','КАБЕЛ','КАНАЛИЗАЦ','ВОДОПРОВОД','ТЕПЛОИЗОЛ','ШТУКАТУР','СКРЫТ'];
function _aktNorm(s){
  return String(s||'').toUpperCase().replace(/[^А-ЯЁA-Z0-9'ʻʼ]/g,'');
}
function _aktYashirinMi(nom){
  var u=_aktNorm(nom);
  for(var i=0;i<_AKT_YASHIRIN_KW.length;i++) if(u.indexOf(_aktNorm(_AKT_YASHIRIN_KW[i]))>=0) return true;
  return false;
}
function _aktTokens(s){
  // _aktNorm allaqachon ortiqcha belgilarni olib tashladi -> butun
  var m=_aktNorm(s).match(/[А-ЯЁA-Z0-9'ʻʼ]+/g); 
  // asl nomdan tokenlash: o'zbek tutuq belgilari saqlanadi
  var raw=String(s||'').toUpperCase().match(/[А-ЯЁA-Z0-9'ʻʼ]{3,}/g)||[];
  var o={}; raw.forEach(function(w){o[w]=1;}); return o;
}
function _aktOxshash(a,b){
  var w1=_aktTokens(a), w2=_aktTokens(b);
  var k1=Object.keys(w1); if(!k1.length) return 0;
  var kes=0; k1.forEach(function(k){ if(w2[k]) kes++; });
  var uni={}; k1.forEach(function(k){uni[k]=1;}); Object.keys(w2).forEach(function(k){uni[k]=1;});
  return kes/Object.keys(uni).length; // Jaccard 0..1
}

/* ── REYESTR'dagi shu obyekt ish nomlari ── */
function _aktReyestrIshlar(obyekt){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var shName=(typeof CONFIG!=='undefined' && CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR';
  var sh=ss.getSheetByName(shName);
  if(!sh || sh.getLastRow()<2) return [];
  var headers=(typeof headerMap_==='function')?headerMap_(sh):_aktHdr2(sh);
  var cW=headers[(typeof REY!=='undefined'&&REY.WORK_NAME)||'WORK_NAME']||headers['WORK_NAME'];
  var cO=headers[(typeof REY!=='undefined'&&REY.OBJECT_NAME)||'OBJECT_NAME']||headers['OBJECT_NAME'];
  if(!cW) return [];
  var v=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getDisplayValues();
  var on=_aktNorm(obyekt), out=[];
  v.forEach(function(r){
    var w=String(r[cW-1]||'').trim(); if(!w) return;
    if(cO){ var o=String(r[cO-1]||'').trim(); if(o && _aktNorm(o)!==on) return; }
    out.push(w);
  });
  return out;
}
function _aktHdr2(sh){ var h={}; sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].forEach(function(x,i){if(x)h[String(x).trim()]=i+1;}); return h; }

/* ══════════════════════════════════════════════════════════════
 * ASOSIY: akt yetishmayotgan yashirin ishlar + AI xulosa
 * ══════════════════════════════════════════════════════════════ */
function aktAiKamchilik(obyekt){
  try{
    if(!obyekt) return {error:'Obyekt tanlanmagan'};
    if(!_aktSbCfg()) return {text:'Supabase sozlanmagan. Avval: aktSupabaseSozlash(url, key) (Smeta bilan bir xil hub).'};
    if(!_aktAiKey()) return {text:'Gemini API kaliti kerak (setkey:KALIT).'};

    var ish=aktSmetaIshlar(obyekt).rows||[];
    if(!ish.length) return {text:'Smetada bu obyekt uchun bajarilgan ish topilmadi (yoki hub sinx bo\'lmagan).'};

    var reyestr=_aktReyestrIshlar(obyekt);
    // har smeta-ish uchun REYESTR'da o'xshashi bormi (0.45+ Jaccard)
    var kamchilik=[];
    ish.forEach(function(r){
      if(!_aktYashirinMi(r.nom)) return; // faqat yashirin (AOSR talab)
      var bor=reyestr.some(function(w){ return _aktOxshash(r.nom, w)>=0.45; });
      if(!bor) kamchilik.push(r);
    });

    if(!kamchilik.length)
      return {text:'✅ **'+obyekt+'**: smetadagi bajarilgan yashirin ishlarning hammasiga REYESTR\'da mos akt bor (taxminiy moslik bo\'yicha).', soni:0};

    var L=['OBYEKT: '+obyekt, 'Akt YETISHMAYOTGAN yashirin ishlar (smetada fakt>0, REYESTR\'da topilmadi):'];
    kamchilik.slice(0,30).forEach(function(r){
      L.push('- '+(String(r.nom).length>70?String(r.nom).slice(0,70)+'…':r.nom)+' ('+(r.birlik||'')+', razdel: '+(r.razdel||'-')+')');
    });
    var sys=
      'Sen — qurilish hujjat nazoratchisisan. Senga smetada bajarilgan, lekin REYESTR\'da AKT topilmagan '+
      'yashirin ishlar ro\'yxati beriladi (taxminiy nom mosligi bo\'yicha).\n'+
      'QOIDALAR:\n1. O\'zbek tilida, qisqa (200 so\'z).\n'+
      '2. Nechta ish aktsiz va nega bu xavfli (yashirin ish AOSRsiz qabul qilinmaydi).\n'+
      '3. Tavsiya: shu ishlarga akt yaratish kerakligini ayt (Smeta\'dagi avto-qoralama yoki shu yerda chatda).\n'+
      '4. Markdown: **qalin**, - ro\'yxat. Son o\'ylab chiqarma.';
    var ans=_aktAiGen(sys, L.join('\n'), {temp:0.25, maxTok:900});
    return {text:ans, soni:kamchilik.length, ishlar:kamchilik.slice(0,30)};
  }catch(e){ return {error:String(e.message||e)}; }
}

function aktBridgeTest(){
  var obs=aktAiObyektlar();
  Logger.log('Obyektlar: '+JSON.stringify(obs));
  if(obs.length) Logger.log(JSON.stringify(aktAiKamchilik(obs[0]),null,2));
}
