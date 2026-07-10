/********************************************************************
 * 30_Panel.gs — BOSHQARUV PANELI (server API)
 * ==================================================================
 * FORMAT BUG TUZATISH:
 *   apiBoglashSaqla → endi FORMAT ni ham saqlaydi (6-ustun)
 *   apiBoglashOl    → saqlangan formatni qaytaradi (panel uchun)
 *
 * LOCK API:
 *   apiLockOl(obyekt)         → {locked, sana, izoh}
 *   apiLockBos(obyekt, izoh)  → qulflaydi
 *   apiLockOch(obyekt, izoh)  → ochadi
 *
 * BIRLASHGAN HOLAT API (F2 tab olib tashlandi):
 *   apiHolatOl(obyekt)               → tree: rz→bl/mat→rs + oylar
 *   apiHolatSaqla(obyekt, edits)     → fakt yoki F2 oy yozadi
 *   apiOyQosh(obyekt, oyNom)         → yangi oy ustuni qo'shadi
 ********************************************************************/

/* Sheets ichida modal oyna (menyu orqali) */
function panelOch(){
  var html = HtmlService.createHtmlOutputFromFile('Panel')
    .setWidth(1400).setHeight(900).setTitle('🏗️ СМЕТА — Бошқарув панели');
  SpreadsheetApp.getUi().showModalDialog(html, '🏗️ СМЕТА — Бошқарув панели');
}

/* WEB APP — bitta URL, uch sahifa:
 *   (default) → Login.html (kirish: Admin / Rahbar tanlov)
 *   ?p=admin  → Panel.html (to'liq boshqaruv)
 *   ?p=boss   → Boss.html  (rahbar dashboard, read-only)
 * Deploy: Apps Script → Deploy → New deployment → Web app. */
function doGet(e){
  // 1. Antigravity va tashqi tizimlar uchun JSON ma'lumot uzatish (API)
  var action=(e&&e.parameter&&e.parameter.action)||'';
  if(action==='api_boss'){
    return apiAntigravityExport(e.parameter.obyekt);
  }
  if(action==='api_testsvod'){
    var out = "SkanCache test:\n";
    try {
      var sp = PropertiesService.getScriptProperties();
      var skan = JSON.parse(sp.getProperty('skan') || '[]');
      out += "Skan cache length: " + skan.length + "\n";
      var suniyList = [];
      for(var i=0; i<skan.length; i++) {
        var ob = skan[i];
        if(ob.obyekt && ob.obyekt.indexOf("Suniy") > -1) {
          suniyList.push({
            obyekt: ob.obyekt,
            lokSheets: ob.lokSheets,
            svodSheets: ob.svodSheets
          });
        }
      }
      out += JSON.stringify(suniyList, null, 2);
    } catch(e) {
      out += e.stack;
    }
    return ContentService.createTextOutput(out);
  }

  // 2. Odamlar uchun oddiy Web sahifalar
  var page=(e&&e.parameter&&e.parameter.p)||'';
  var file, title;
  if(page==='admin'){ file='Panel'; title='🏗️ СМЕТА — Бошқарув панели'; }
  else if(page==='boss'){ file='Boss'; title='🏗️ QURILISH SMETA — Дашборд'; }
  else { file='Login'; title='🏗️ QURILISH SMETA'; }
  return HtmlService.createHtmlOutputFromFile(file)
    .setTitle(title)
    .addMetaTag('viewport','width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* Web App bazaviy URL.
 * MUHIM: Sheets ichidagi (container-bound) scriptda getUrl() noto'g'ri URL
 * qaytaradi → Drive xatosi. Shuning uchun Script Property dan o'qiymiz.
 * Bir marta sozlash: webAppUrlSet('https://.../exec') */
function _webAppUrl(){
  var saved=PropertiesService.getScriptProperties().getProperty('WEBAPP_URL');
  if(saved) return saved;
  try{ return ScriptApp.getService().getUrl()||''; }catch(e){ return ''; }
}
function webAppUrlSet(url){
  if(!url) throw 'URL kiriting: webAppUrlSet("https://script.google.com/macros/s/.../exec")';
  url=String(url).trim().replace(/\?.*$/,''); // ?p=... ni olib tashlaymiz
  PropertiesService.getScriptProperties().setProperty('WEBAPP_URL', url);
  return 'Web App URL saqlandi:\n'+url;
}

/* ============ BOSS — BITTA OB'EKT DETAIL ============
 * Kategoriya bo'yicha: ЧЕЛ/МАШ/МАТ/ОБ/М/К
 * Har biri uchun: smeta, fakt, f2, ostatka (pul)
 * RZ ro'yxati + oylik F2 trend */
function apiBossObyekt(obyekt){
  var cached=_keshOl('boss_'+obyekt);
  if(cached) return cached;
  // ⚡⚡⚡ 2026-07-10 TUZATILDI: ko'p smetali (split/jamlangan) obyektlarda Boss
  //   drill-down UMUMAN ishlamasdi — _plusTop(obyekt) faqat ANIQ (exact) nom bilan
  //   izlardi, holbuki Boss.html guruhlangan (ota) nom bilan chaqiradi va haqiqiy
  //   LRV fayllar sub-obyekt nomlari ostida ("Обыект - Локал1" kabi). Endi boshqa
  //   API'lar (apiOyQosh, apiTashxis, apiRazdelShYasat) bilan BIR XIL qoida:
  //   _subObyektlar(obyekt) bo'yicha HAMMA faylni yig'ib, JAMLAB qaytaradi.
  var subObjects=_subObyektlar(obyekt);
  var targets = subObjects.length ? subObjects : [obyekt];
  var a=sozAsosiy(), col=CFG.C;
  // ⚡ КАБ endi ALOHIDA (apiBossData bilan bir xil) — avval КАБ ↦ МАТ ga
  //   qo'shib yuborilardi, dashboard va drill-down orasida mos kelmasdi.
  var CATS=['ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ'];
  function nc(){ return {res:0,fakt:0,f2:0,ost:0}; }
  function ncs(){ var o={}; CATS.forEach(function(k){o[k]=nc();}); return o; }
  var total=ncs(), rzList=[], oyTrend={}, filesFound=0;
  for(var ti=0; ti<targets.length; ti++){
    var plus=_plusTop(targets[ti]);
    if(!plus) continue;
    filesFound++;
    var sheets=plus.getSheets();
    for(var s=0;s<sheets.length;s++){
      var sh=sheets[s];
      if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
      var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh);
      if(last<start) continue;
      var n=last-start+1;
      // Oy jamilarini ЖАМИ qatoridan olamiz — bitta getValues (katak-katak emas)
      var oylar=_f2Oylar(sh), jamiRow=start-1;
      if(oylar.length && jamiRow > 0){
        var firstOyCol=oylar[0].col, lastOyCol=oylar[oylar.length-1].col;
        var oyRow=sh.getRange(jamiRow, firstOyCol, 1, lastOyCol-firstOyCol+1).getValues()[0];
        for(var oi=0;oi<oylar.length;oi++){
          var on=oylar[oi].nom;
          var ov=_toNum(oyRow[oylar[oi].col-firstOyCol]);
          oyTrend[on]=(oyTrend[on]||0)+ov;
        }
      }

      // Yagona o'qish qatlami
      var rows = lrvOqi(sh, {faqatLeaf: false});
      var curRzNom='', curRzCats=null;
      for(var i=0; i<rows.length; i++){
        var r = rows[i];
        if (r.tur === 'rz') {
          if(curRzNom&&curRzCats) rzList.push({nom:curRzNom,cats:curRzCats});
          curRzNom = r.nom || ('Раздел ' + (rzList.length+1));
          curRzCats = ncs();
        } else if (r.tur === 'rs' || r.tur === 'mat' || r.tur === 'ob') {
          var cat = r.kat;
          if (cat === '?') cat = 'МАТ'; // БЕЗ СКЛАД (kategoriyasiz) MAT ichida ko'rinadi
          if (!total[cat]) cat = 'МАТ'; // xavfsizlik

          total[cat].res += r.smeta;
          total[cat].fakt += r.stFakt;
          total[cat].f2 += r.stF2;
          total[cat].ost += r.stOst;

          if (curRzCats) {
            curRzCats[cat].res += r.smeta;
            curRzCats[cat].fakt += r.stFakt;
            curRzCats[cat].f2 += r.stF2;
            curRzCats[cat].ost += r.stOst;
          }
        }
      }
      if(curRzNom&&curRzCats) rzList.push({nom:curRzNom,cats:curRzCats});
    }
  }
  if(!filesFound) throw 'LRV_PLUS топилмади: '+obyekt;
  var totRes=0,totFakt=0,totF2=0,totOst=0;
  CATS.forEach(function(k){totRes+=total[k].res;totFakt+=total[k].fakt;totF2+=total[k].f2;totOst+=total[k].ost;});
  rzList.forEach(function(rz){
    var r=0,f=0,f2=0,o2=0;
    CATS.forEach(function(k){r+=rz.cats[k].res;f+=rz.cats[k].fakt;f2+=rz.cats[k].f2;o2+=rz.cats[k].ost;});
    rz.res=r;rz.fakt=f;rz.f2=f2;rz.ost=o2;
    rz.progress=r>0?Math.round(f/r*100):0;
  });
  var oyArr=[];
  for(var oy in oyTrend) oyArr.push({oy:oy,val:oyTrend[oy]});
  var result={
    cats:total, catKeys:CATS, rzList:rzList,
    total:{res:totRes,fakt:totFakt,f2:totF2,ost:totOst,
           progress:totRes>0?Math.round(totFakt/totRes*100):0,
           f2pct:totFakt>0?Math.round(totF2/totFakt*100):0},
    oylar:oyArr, locked:lockMi(obyekt)
  };
  try{ _keshYoz('boss_'+obyekt, result); }catch(e){}
  return result;
}

/* ============ BOSS DASHBOARD DATA ============ */
function apiBossData(){
  var objects=[], j={smeta:0,chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,fakt:0,f2:0,qoldiq:0};
  var bogFull=(typeof apiShartnomaBogFullOl==='function')?apiShartnomaBogFullOl():{};
  var _kalitFn=(typeof _cfgKalit==='function')?_cfgKalit:function(x){return x;};
  
  function processRows(rows) {
    var shGrp = {}; // key: Shartnoma No -> { nom: "Shartnoma №...", isGroup: true, subItemsObj: {}, smeta: 0, fakt: 0, ... }
    for(var i=0; i<rows.length; i++){
      var o = rows[i];
      if(!o.nom || o.nom.toUpperCase()==='ЖАМИ') continue;
      
      var rNom = o.nom;
      var kalit = _kalitFn(rNom);
      var bg = bogFull[rNom];
      if(!bg) bg = bogFull[kalit];
      if(!bg) bg = {no:'', soni:1};
      
      var no = bg.no || '—';
      if (no === '—') no = 'Taqsimlanmagan'; // Taqsimlanmaganlarini alohida guruhga olamiz
      
      
      var soni = bg.soni || 1;
      var gName = kalit + (soni > 1 ? ' (x'+soni+')' : '');
      
      var sbSmeta = _toNum(o.smeta)*soni;
      var sbFakt = _toNum(o.fakt)*soni;
      var sbF2 = _toNum(o.f2)*soni;
      var sbChel = _toNum(o.chel)*soni;
      var sbMash = _toNum(o.mash)*soni;
      var sbMat = _toNum(o.mat)*soni;
      var sbOb = _toNum(o.ob)*soni;
      var sbMk = _toNum(o.mk)*soni;
      var sbKab = _toNum(o.kab)*soni;
      var sbQoldiq = _toNum(o.qoldiq)*soni;
      
      if(!shGrp[no]) {
         shGrp[no] = {
           nom: "Shartnoma № " + no,
           isGroup: true,
           subItemsObj: {},
           smeta: 0, chel: 0, mash: 0, mat: 0, ob: 0, mk: 0, kab: 0, fakt: 0, f2: 0, qoldiq: 0,
           sana: String(o.sana||'')
         };
      }
      
      var sh = shGrp[no];
      sh.smeta += sbSmeta;
      sh.chel += sbChel;
      sh.mash += sbMash;
      sh.mat += sbMat;
      sh.ob += sbOb;
      sh.mk += sbMk;
      sh.kab += sbKab;
      sh.fakt += sbFakt;
      sh.f2 += sbF2;
      sh.qoldiq += sbQoldiq;
      
      if(sh.subItemsObj[gName]) {
        sh.subItemsObj[gName].smeta += sbSmeta;
        sh.subItemsObj[gName].fakt += sbFakt;
        sh.subItemsObj[gName].f2 += sbF2;
        sh.subItemsObj[gName].chel += sbChel;
        sh.subItemsObj[gName].mash += sbMash;
        sh.subItemsObj[gName].mat += sbMat;
        sh.subItemsObj[gName].ob += sbOb;
        sh.subItemsObj[gName].mk += sbMk;
        sh.subItemsObj[gName].kab += sbKab;
        sh.subItemsObj[gName].qoldiq += sbQoldiq;
      } else {
        sh.subItemsObj[gName] = {
          nom: gName,
          smeta: sbSmeta, chel: sbChel, mash: sbMash, mat: sbMat,
          ob: sbOb, mk: sbMk, kab: sbKab, fakt: sbFakt, f2: sbF2,
          qoldiq: sbQoldiq, sana: String(o.sana||'')
        };
      }
    }
    
    for(var no in shGrp) {
      var sh = shGrp[no];
      sh.progress = sh.smeta>0 ? Math.round(sh.fakt/sh.smeta*100) : 0;
      sh.f2pct = sh.fakt>0 ? Math.round(sh.f2/sh.fakt*100) : 0;
      
      sh.subItems = [];
      for(var k in sh.subItemsObj) {
         var sub = sh.subItemsObj[k];
         sub.progress = sub.smeta>0 ? Math.round(sub.fakt/sub.smeta*100) : 0;
         sub.f2pct = sub.fakt>0 ? Math.round(sub.f2/sub.fakt*100) : 0;
         sh.subItems.push(sub);
      }
      delete sh.subItemsObj;
      
      objects.push(sh);
      
      j.smeta+=sh.smeta; j.chel+=sh.chel; j.mash+=sh.mash; j.mat+=sh.mat;
      j.ob+=sh.ob; j.mk+=sh.mk; j.kab+=sh.kab; 
      j.fakt+=sh.fakt; j.f2+=sh.f2; j.qoldiq+=sh.qoldiq;
    }
    j.progress = j.smeta>0 ? Math.round(j.fakt/j.smeta*100) : 0;
    j.f2pct = j.fakt>0 ? Math.round(j.f2/j.fakt*100) : 0;
  }
  
  // 1. Tizim tezligi uchun avval Supabase SQL orqali o'qish (0.2 soniya)
  if(typeof _sbCfg==='function' && _sbCfg()) {
    try {
      var c = _sbCfg();
      var url = c.url + '/rest/v1/obyektlar?select=nom,smeta,chel,mash,mat,ob,mk,kab,fakt,f2,qoldiq,progress,f2pct,sana';
      var res = UrlFetchApp.fetch(url, { headers: { 'apikey': c.key, 'Authorization': 'Bearer ' + c.key }, muteHttpExceptions: true });
      if(res.getResponseCode() === 200) {
        var data = JSON.parse(res.getContentText());
        processRows(data);
        return {
          objects: objects, jami: j, oylar: [],
          sana: Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd HH:mm') + ' 🚀'
        };
      }
    } catch(e) {
      Logger.log("Supabase BossData xatosi: " + e);
    }
  }

  // 2. Supabase ulanmagan yoki xato bo'lsa, eskirgan Google Sheets dan o'qish (3-5 soniya)
  var a=sozAsosiy(), srv;
  try{ srv=_serverSS(a); }catch(e){ return {objects:[],jami:{},oylar:[]}; }
  var dash=srv.getSheetByName(CFG.DASH);
  if(!dash||dash.getLastRow()<2) return {objects:[],jami:{},oylar:[]};
  var v=dash.getRange(2,1,dash.getLastRow()-1,SRV.HDR.length).getValues();
  var sheetData = [];
  for(var i=0;i<v.length;i++){
    sheetData.push({
      nom: String(v[i][0]||'').trim(),
      smeta: _toNum(v[i][1]), chel: _toNum(v[i][2]), mash: _toNum(v[i][3]),
      mat: _toNum(v[i][4]), ob: _toNum(v[i][5]), mk: _toNum(v[i][6]),
      kab: _toNum(v[i][7]), fakt: _toNum(v[i][8]), f2: _toNum(v[i][9]),
      qoldiq: _toNum(v[i][10]), sana: String(v[i][12]||'')
    });
  }
  processRows(sheetData);

  return {objects:objects, jami:j, oylar:[],
          sana:Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd HH:mm')};
}

/* ============ SOZLAMA ============ */
function apiSozlamaOl(){
  _sozTaInit();
  var a = sozAsosiy();
  return { rootId:a.rootId, serverId:a.serverId, dataQator:a.dataQator, narxMantiq:a.narxMantiq };
}
function apiSozlamaSaqla(o){
  _sozTaInit();
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ);
  var map = { 'ROOT_FOLDER_ID':o.rootId, 'SERVER_ID':o.serverId,
              'DATA_QATOR':o.dataQator, 'NARX_MANTIQ':o.narxMantiq };
  var v = sh.getDataRange().getValues();
  for(var i=0;i<v.length;i++){
    var k=String(v[i][0]||'').trim().toUpperCase();
    if(map.hasOwnProperty(k)) sh.getRange(i+1,2).setValue(map[k]);
  }
  return 'Сақланди';
}

/* ============ KATEGORIYA ============ */
function apiKategoriyaOl(){
  _sozTaInit();
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_KAT);
  var v = sh.getDataRange().getValues(), o={over:[]};
  for(var i=1;i<v.length;i++){
    var t=String(v[i][0]).trim().toUpperCase(), q=String(v[i][1]);
    if(t==='BLOK_CHEL') o.blokChel=q; else if(t==='BLOK_MASH') o.blokMash=q;
    else if(t==='BLOK_MAT') o.blokMat=q; else if(t==='BLOK_OB') o.blokOb=q;
    else if(t==='KW_KAB') o.kwKab=q;
    else if(t==='KW_MK') o.kwMk=q; else if(t==='KW_OB') o.kwOb=q;
    else if(t==='KW_BEZSKLAD') o.kwBezsklad=q;
    else if(t==='KW_STOP') o.kwStop=q;
    else if(t==='OVERRIDE') o.over.push({pat:q, narx:v[i][2], cat:String(v[i][3])});
  }
  return o;
}
function apiKategoriyaSaqla(o){
  _sozTaInit();
  var ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(CFG.SOZ_KAT);
  ss.deleteSheet(sh); sh=ss.insertSheet(CFG.SOZ_KAT);
  var rows=[['ТУР','ҚИЙМАТ / КАЛИТ СЎЗ','НАРХ','КАТ'],
    ['BLOK_CHEL',o.blokChel||'ЗАТРАТЫ ТРУДА','',''],
    ['BLOK_MASH',o.blokMash||'СТРОИТЕЛЬНЫЕ МАШИНЫ','',''],
    ['BLOK_MAT', o.blokMat ||'СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ','',''],
    ['BLOK_OB',  o.blokOb  ||'ОБОРУДОВАНИЕ','',''],
    ['KW_KAB',o.kwKab||'','',''],
    ['KW_MK',o.kwMk||'','',''],         ['KW_OB',o.kwOb||'','',''],
    ['KW_BEZSKLAD',o.kwBezsklad||'','',''],
    ['KW_STOP',o.kwStop||'','','']];
  // OVERRIDE — agar panel bermasa, default mashinist/rabochiy override saqlanadi
  var over=(o.over&&o.over.length)?o.over:[
    {pat:'ЗАТРАТЫ ТРУДА РАБОЧИХ',    narx:24517.7, cat:'ЧЕЛ'},
    {pat:'ЗАТРАТЫ ТРУДА МАШИНИСТОВ', narx:0,       cat:'МАШ'}
  ];
  for(var i=0;i<over.length;i++)
    rows.push(['OVERRIDE',over[i].pat||'',over[i].narx||0,over[i].cat||'МАТ']);
  sh.getRange(1,1,rows.length,4).setValues(rows);
  sh.getRange(1,1,1,4).setFontWeight('bold').setBackground('#2e75b5').setFontColor('#ffffff');
  sh.setColumnWidth(1,130); sh.setColumnWidth(2,620); sh.setColumnWidth(3,90); sh.setColumnWidth(4,70);
  sh.setFrozenRows(1);
  return 'Сақланди';
}


/* ============ PAPKA SKAN — kesh birinchi ============ */
function apiPapkaSkan(){
  // Keshdan tez o'qiymiz — lekin candidates mavjudligini tekshiramiz.
  // Eski _KESH varaqda candidates yo'q edi → qayta generatsiya qilinadi.
  var cached = _keshOlStale('skan');
  if(cached && cached.length && 'candidates' in (cached[0]||{})) return cached;
  // Kesh yo'q yoki eski format → Drive dan fresh skan
  return apiKeshSkanYangilash();
}

/* ============ PANEL INIT — bitta chaqiruvda barcha boshlang'ich ma'lumot ============
 * Avval panel ochilishida 3+ ketma-ket google.script.run (apiPapkaSkan +
 * apiBoglashOl + apiKeshHolat + _webAppUrl) chaqirilardi — har biri ~0.5-2 sek RPC.
 * apiPanelInit ularni BITTA chaqiruvga jamlaydi → yuklash sezilarli tezlashadi. */
function apiPanelInit(){
  var skan=[];   try{ skan=apiPapkaSkan(); }catch(e){}
  var fmtMap={}; try{ fmtMap=apiBoglashOl(); }catch(e){}
  var kesh={};   try{ kesh=apiKeshHolat(); }catch(e){}
  var url='';    try{ url=_webAppUrl(); }catch(e){}
  var paused=false; try{ paused=tizimMuzlatilganMi(); }catch(e){}
  var aiKalit={bor:false}; try{ if(typeof apiAiKalitHolat==='function') aiKalit=apiAiKalitHolat(); }catch(e){}
  return {skan:skan, fmtMap:fmtMap, kesh:kesh, webAppUrl:url, systemPaused:paused, aiKalit:aiKalit};
}

/* API: Tizim holatini olish (paused yoki running) */
function apiTizimHolatOl() {
  return {paused: tizimMuzlatilganMi()};
}

/* API: Tizim holatini o'zgartirish (muzlatish yoki faollashtirish) */
function apiTizimHolatOzgartir(paused) {
  var p = PropertiesService.getScriptProperties();
  p.setProperty('SYSTEM_PAUSED', paused ? 'true' : 'false');
  
  // 1) Supabase'ga yozish (agar ulangan bo'lsa)
  if (typeof _sbBor === 'function' && _sbBor()) {
    try {
      _sbYoz('system_config', [{key: 'SYSTEM_PAUSED', value: paused ? 'true' : 'false'}], 'key');
    } catch(e) {
      Logger.log('Supabase system_config update error: ' + e);
    }
  }
  
  // 2) SOZLAMALAR varaqiga ham yozib qo'yish (visual ko'rinishi uchun)
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ);
    if (sh) {
      var v = sh.getDataRange().getValues();
      var rowIdx = -1;
      for (var i = 0; i < v.length; i++) {
        if (String(v[i][0]).trim().toUpperCase() === 'SYSTEM_PAUSED') {
          rowIdx = i + 1;
          break;
        }
      }
      if (rowIdx > 0) {
        sh.getRange(rowIdx, 2).setValue(paused ? 'TRUE' : 'FALSE');
      } else {
        sh.appendRow(['SYSTEM_PAUSED', paused ? 'TRUE' : 'FALSE', 'Butun tizim ishini to\'xtatib turish (TRUE/FALSE)']);
      }
    }
  } catch(e) {
    Logger.log('SOZLAMALAR sheet update error: ' + e);
  }
  
  return {ok: true, paused: paused, xabar: paused ? 'Tizim to\'xtatib turildi (PAUSED)' : 'Tizim faollashtirildi (ACTIVE)'};
}

/* ============ BOSS INIT — dashboard + URL bitta chaqiruvda ============ */
function apiBossInit(){
  var data={objects:[],jami:{},oylar:[]};
  try{ data=apiBossData(); }catch(e){}
  var url=''; try{ url=_webAppUrl(); }catch(e){}
  return {data:data, webAppUrl:url};
}
function _plusBormi(obyekt, folderId){
  try { return DriveApp.getFolderById(folderId).getFilesByName(obyekt+CFG.PLUS_SUF).hasNext(); }
  catch(e){ return false; }
}


/* ============ PUZZLE BOG'LASH — FORMAT BUG TUZATISH ============
 * SOZLAMALAR_BOGLASH ustunlari:
 *   A=ОБЪЕКТ  B=ЛОК_ID  C=ЛОК_НОМ  D=СВОД_ID  E=СВОД_НОМ  F=ФОРМАТ
 * Format 6-ustunda saqlanadi. _boglashOl() uni o'qiydi.
 * apiBoglashOl() formatni panelga qaytaradi — panel tanlashni shu yerdan oladi.
 ======================================================================*/
function apiBoglashSaqla(pairs){
  if(!Array.isArray(pairs)){
    if(pairs && typeof pairs==='object' && pairs.obyekt) pairs=[pairs];
    else throw new TypeError('pairs array bo\'lishi kerak');
  }
  // pairs = [{obyekt, lokId, lokName, svodId, svodName, format}]
  var ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(CFG.SOZ_BOG);
  if(sh) ss.deleteSheet(sh);
  sh=ss.insertSheet(CFG.SOZ_BOG);
  var rows=[['ОБЪЕКТ','ЛОК_ID','ЛОК_НОМ','СВОД_ID','СВОД_НОМ','ФОРМАТ','ЛОК_SHEETS','СВОД_SHEETS',
             'СВОД_НОМ_УСТ','СВОД_БИР_УСТ','СВОД_НАРХ_УСТ','СВОД_БЛОК_УСТ','СВОД_QTY_УСТ','СВОД_СУММА_УСТ',
             'НАРХ_ТАЙЁР']];
  for(var i=0;i<pairs.length;i++){
    var sc=pairs[i].svodCols||{};
    rows.push([
      pairs[i].obyekt,
      pairs[i].lokId     || '',
      pairs[i].lokName   || '',
      pairs[i].svodId    || '',
      pairs[i].svodName  || '',
      _normFormat((pairs[i].format  || 'TN').toUpperCase()),
      (pairs[i].lokSheets  || []).join('|'),
      (pairs[i].svodSheets || []).join('|'),
      Number(sc.nom)||'', Number(sc.bir)||'', Number(sc.narx)||'', Number(sc.blok)||'',
      Number(sc.qty)||'', Number(sc.summa)||'',
      pairs[i].narxTayyor ? 1 : ''
    ]);
  }
  sh.getRange(1,1,rows.length,15).setValues(rows);
  sh.getRange(1,1,1,15).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
  sh.setColumnWidth(6,80); sh.setColumnWidth(7,200); sh.setColumnWidth(8,200);
  sh.hideSheet();
  // Skan keshini bekor qilamiz — keyingi apiPapkaSkan yangi lokId/svodId ni ishlatadi.
  // Olmasa panel eski (noto'g'ri) fayl yo'lini ko'rsataveradi.
  try{ cacheDel('skan'); }catch(e){}
  // Qayta o'qib tekshirish — format to'g'ri saqlanganini qaytarish
  var check=_boglashOl();
  var fmtLog=pairs.map(function(p){
    var saved=check[p.obyekt];
    return p.obyekt+':'+(saved?saved.format:'?');
  });
  // Yangi skan ma'lumotini qaytaramiz — panel uni darhol OBS ga yuklaydi
  var freshSkan=[]; try{ freshSkan=apiKeshSkanYangilash(); }catch(e){}
  return {
    xabar: 'Боғлаш сақланди: '+pairs.length+' объект. Форматлар: '+fmtLog.join(', '),
    skan: freshSkan
  };
}
/* ============ EXCEL → DOIMIY GOOGLE SHEETS ============
 * IDEAL YECHIM: katta Excel fayl har Ишла/Varaqlar da qayta konvertatsiya
 * qilinardi → 6 daqiqa timeout. Bu funksiya lok+svod Excel ni BIR MARTA
 * doimiy native Google Sheets ga aylantiradi va bog'lashni yangi fayllarga
 * ulaydi. Shundan keyin konvertatsiya umuman bo'lmaydi → Varaqlar ham,
 * Ишла ham darhol ishlaydi. */
function apiNativeGaAylantir(obyekt){
  var obs=apiPapkaSkan(), t=null;
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt.trim()===obyekt.trim()){ t=obs[i]; break; }
  if(!t) throw 'Объект топилмади: '+obyekt;

  var log=[], newLok=t.lokId, newSvod=t.svodId;

  if(t.lokId){
    var lf=DriveApp.getFileById(t.lokId);
    if(lf.getMimeType()!==MimeType.GOOGLE_SHEETS){
      newLok=_excelToNative(t.lokId, t.folderId, _gsNom(lf.getName()));
      log.push('локалка');
    }
  }
  if(t.svodId){
    var sf=DriveApp.getFileById(t.svodId);
    if(sf.getMimeType()!==MimeType.GOOGLE_SHEETS){
      newSvod=_excelToNative(t.svodId, t.folderId, _gsNom(sf.getName()));
      log.push('свод');
    }
  }

  // Bog'lashni yangilaymiz — barcha obyektlar saqlanadi, shu bittasi almashtiriladi.
  // Yangi native fayllar bog'lanadi → keyin konvertatsiya bo'lmaydi.
  var pairs=obs.map(function(o){
    var bu=(o.obyekt===obyekt);
    return {
      obyekt:    o.obyekt,
      lokId:     bu?newLok:(o.lokId||''),
      lokName:   o.lokName||'',
      svodId:    bu?newSvod:(o.svodId||''),
      svodName:  o.svodName||'',
      format:    o.format||'TN',
      lokSheets: o.lokSheets||[],
      svodSheets:o.svodSheets||[],
      svodCols:  o.svodCols||null   // svod ustun xaritasini yo'qotmaymiz
    };
  });
  apiBoglashSaqla(pairs); // skan keshini ham yangilaydi

  return {ok:true, obyekt:obyekt, lokId:newLok, svodId:newSvod,
          xabar: log.length
            ? (obyekt+': '+log.join(' + ')+' → Google Sheets га айлантирилди. Энди тез ишлайди.')
            : (obyekt+': аллақачон Google Sheets форматида.')};
}
function _gsNom(name){ return String(name).replace(/\.(xlsx|xls|xlsm)$/i,'')+' (GS)'; }

function apiBoglashOl(){
  var map=_boglashOl();
  // {obyekt: format} ko'rinishida qaytarish
  var out={};
  for(var k in map) out[k]=_normFormat(map[k].format||'TN');
  return out;
}


/* ============ ISHGA TUSHIRISH ============ */
function apiObyektIshla(obyekt, fromQueue){
  // HIMOYA: navbat ishlayotganda qo'lda ishga tushirishni bloklash (ma'lumot to'qnashuvi oldini olish)
  if(!fromQueue){
    var _nbRun=PropertiesService.getScriptProperties().getProperty('NAVBAT_RUNNING');
    if(_nbRun==='1'){
      var _nbQ=JSON.parse(PropertiesService.getScriptProperties().getProperty('NAVBAT')||'[]');
      if(_nbQ.length>0) return {obyekt:obyekt, ok:false, xabar:'⏳ Навбат ишламоқда ('+_nbQ.length+' қолди). Тугагунча кутинг.'};
    }
    // Agar qo'lda ishga tushirilayotgan bo'lsa, eski chunking state'ni tozalaymiz
    PropertiesService.getScriptProperties().deleteProperty('_ISHLA_' + obyekt);
  }
  _progSet(obyekt,'QUEUE','Navbatga qo\'yildi');
  var t=skanBitta(obyekt);   // faqat shu obyekt papkasi (butun ROOT skani emas — tez)
  if(!t){ _progSet(obyekt,'ERROR','Объект топилмади'); throw 'Объект топилмади: '+obyekt; }

  // KO'P-LRV: bir nechta lok fayl (Tom1/Tom2...) bo'lsa — ATOMIK emas, per-qism
  // navbatga (har qism yangi 6 daqiqa) + oxirida @@COMBINE birlashtiradi.
  if(!fromQueue && t.lokFiles && t.lokFiles.length>1 && !lockMi(obyekt)){
    return navbatBoshla(obyekt);
  }

  // Lock tekshirish — agar qulflangan bo'lsa faqat + qatorlar
  if(lockMi(obyekt)){
    _progSet(obyekt,'LOCKED','Qulf holati: faqat + qatorlar');
    var rl=_qoshFaqatIshla(t);
    _progSet(obyekt,'DONE','Qulf rejimi tugadi');
    _holatInvalidate(obyekt);
    return {obyekt:obyekt, locked:true, qosh:rl.qosh,
            xabar:'🔒 Қулфланган — фақат "+" қўшимча ишлар янгиланди ('+rl.qosh+' қатор)'};
  }
  try{
    var r=_ishlaObyekt(t);
    if(r && r.partial){
      // Varaq bo'linishi — hali tugatilmagan, navbat qayta chaqiradi
      return {obyekt:obyekt, locked:false, qator:r.qator, varaq:r.varaq,
              narxBaza:r.narxBaza, topilmadi:r.topilmadi, plusId:r.plusId, partial:true};
    }
    _progSet(obyekt,'DONE','Muvaffaqiyatli tugadi');
    try{ apiRazdelShYasat(obyekt); }catch(e2){}
    _holatInvalidate(obyekt);
    return {obyekt:obyekt, locked:false, qator:r.qator, varaq:r.varaq,
            narxBaza:r.narxBaza, topilmadi:r.topilmadi, plusId:r.plusId};
  }catch(e){
    _progSet(obyekt,'ERROR',String(e&&e.message?e.message:e));
    throw e;
  }
}
function apiObyektTezkorIshla(obyekt, fromQueue){
  if(!fromQueue){
    var _nbRun=PropertiesService.getScriptProperties().getProperty('NAVBAT_RUNNING');
    if(_nbRun==='1'){
      var _nbQ=JSON.parse(PropertiesService.getScriptProperties().getProperty('NAVBAT')||'[]');
      if(_nbQ.length>0) return {obyekt:obyekt, ok:false, xabar:'⏳ Навбат ишламоқда ('+_nbQ.length+' қолди). Тугагунча кутинг.'};
    }
  }
  _progSet(obyekt,'QUEUE','Tezkor yangilash navbatda');
  var t=skanBitta(obyekt);
  if(!t){ _progSet(obyekt,'ERROR','Объект топилмади'); throw 'Объект топилмади: '+obyekt; }
  if(lockMi(obyekt)) return apiObyektIshla(obyekt, fromQueue); // Qulflangan bo'lsa standart (faqat +) ishlaydi

  try{
    var r = _tezkorObyekt(t);
    return r;
  }catch(e){
    _progSet(obyekt,'ERROR',String(e&&e.message?e.message:e));
    throw e;
  }
}
function apiBarchaIshla(){
  var obs=papkaSkan(), res=[];
  for(var i=0;i<obs.length;i++){
    try{
      var r=apiObyektIshla(obs[i].obyekt);
      res.push({obyekt:obs[i].obyekt, ok:true, qator:r.qator||0,
                topilmadi:r.topilmadi||0, locked:r.locked||false});
    } catch(e){ res.push({obyekt:obs[i].obyekt, ok:false, xato:String(e.message||e)}); }
  }
  return res;
}
function apiMarkerQayta(obyekt){ markirovkaQaytaObyekt(obyekt); return 'Маркировка қайта аниқланди'; }
function apiServerYig(){ var r=serverYigPapka(); return r&&r.xabar?r.xabar:'Сервер йиғилди'; }


/* ============ LOCK API ============ */
function apiLockOl(obyekt){
  var m=lockMap();
  var d=m[obyekt]||{holat:'unlocked', sana:'', izoh:''};
  return {locked:(d.holat==='locked'), sana:d.sana, izoh:d.izoh};
}
function apiLockBos(obyekt, izoh){
  lockYoz(obyekt, 'locked', izoh||'');
  // Skan keshini yangilaymiz — aks holda panel eski holat (unlocked) ni ko'rsatadi
  try{ apiKeshSkanYangilash(); }catch(e){}
  // holat_/boss_ keshlari ham lock holatini saqlaydi — ularni ham tozalaymiz,
  // aks holda panel/Boss eski lock badge ni ko'rsatib qotib qoladi.
  try{ _holatInvalidate(obyekt); }catch(e){}
  return {ok:true, locked:true, xabar:obyekt+' қулflandi'};
}
function apiLockOch(obyekt, izoh){
  lockYoz(obyekt, 'unlocked', izoh||'');
  // Skan keshini yangilaymiz — aks holda panel eski holat (locked) ni ko'rsatadi
  try{ apiKeshSkanYangilash(); }catch(e){}
  // holat_/boss_ keshlarini ham tozalaymiz (eski locked:true qotib qolmasin).
  try{ _holatInvalidate(obyekt); }catch(e){}
  return {ok:true, locked:false, xabar:obyekt+' қулф очилdi'};
}

/* ============ HAR OBYEKT ЧЕЛ-Ч STAVKA (ЗАТРАТЫ ТРУДА РАБОЧИХ) ============ */
function apiStavkaOl(obyekt){ return _stavkaOl(obyekt); }
function apiStavkaSaqla(obyekt, chel){
  var r=_stavkaYoz(obyekt, chel);
  _holatInvalidate(obyekt);   // narx o'zgaradi → keyingi [Ишла] da qo'llanadi
  return {ok:true, chel:r.chel,
          xabar:obyekt+': ЧЕЛ-Ч (ишчи)='+(r.chel||'—')+' сақланди. Энди [Ишла] қилинг.'};
}

/* Daraxt tugunlarining varaq maydonini "sub||varaq" ga prefikslaydi (rekursiv).
 * apiHolatSaqla shu formatni allaqachon parse qiladi — yozish to'g'ri faylga boradi. */
function _varaqPrefiks(node, sub){
  if (node.varaq && String(node.varaq).indexOf('||') < 0) node.varaq = sub + '||' + node.varaq;
  (node.children || []).forEach(function(c){ _varaqPrefiks(c, sub); });
}

function apiHolatOl(obyekt, forceRefresh){
  // Kesh birinchi — agar forceRefresh=true bo'lmasa
  if(!forceRefresh){
    var cached = _keshOl('holat_'+obyekt);
    if(cached) return cached;
  }

  // 1) GURUHLANGAN (PARENT) OBYEKT EKANINI TEKSHIRAMIZ:
  var subs = _subObyektlar(obyekt);
  if (subs.length > 0) {
    var tree = [], oylarSet = {}, xatolar = [];
    var jamiP = {stSm:0, stFk:0, stF2:0, chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0};
    for (var si = 0; si < subs.length; si++) {
      var sub = subs[si];
      try {
        var r = apiHolatOl(sub);                    // rekursiya — har sub keshdan (tez)
        (r.oylar || []).forEach(function(o){ oylarSet[o] = 1; });
        if (r.jami){ jamiP.stSm+=r.jami.stSm||0; jamiP.stFk+=r.jami.stFk||0; jamiP.stF2+=r.jami.stF2||0;
          jamiP.chel+=r.jami.chel||0; jamiP.mash+=r.jami.mash||0; jamiP.mat+=r.jami.mat||0;
          jamiP.ob+=r.jami.ob||0; jamiP.mk+=r.jami.mk||0; jamiP.kab+=r.jami.kab||0; jamiP.bez+=r.jami.bez||0; }
        (r.tree || []).forEach(function(rz){
          var clonedRz = JSON.parse(JSON.stringify(rz));
          clonedRz.lokalka = sub;                          // UI badge uchun
          _varaqPrefiks(clonedRz, sub);                    // varaq → "sub||varaq"
          tree.push(clonedRz);
        });
      } catch(e) { xatolar.push(sub + ': ' + (e.message || e)); }
    }
    return { tree: tree, oylar: Object.keys(oylarSet), jamlangan: true,
             jami: jamiP, subs: subs, xatolar: xatolar };
  }

  // --- ODDY (SINGLE OR FLAT) OBYEKT UCHUN ASL KOD ---
  var plus=_plusTop(obyekt);
  if(!plus) throw obyekt+CFG.PLUS_SUF+' топилмади. Аввал ишга тушир.';

  var a=sozAsosiy(), col=CFG.C;
  var locked=lockMi(obyekt);
  // Format — keshlangan skandan (ortiqcha Drive skansiz). Kesh yo'q bo'lsa skan.
  var fmt='TN', fmtFound=false;
  var sk=_keshOlStale('skan')||[];
  for(var i=0;i<sk.length;i++) if(sk[i].obyekt===obyekt){ fmt=_normFormat(sk[i].format||'TN'); fmtFound=true; break; }
  if(!fmtFound){
    var obs=papkaSkan();
    for(var j=0;j<obs.length;j++) if(obs[j].obyekt===obyekt){ fmt=_normFormat(obs[j].format||'TN'); break; }
  }

  var oylarSet={}, tree=[], sheets=plus.getSheets(), formulaYangilandi=false;
  // ⚡ 2026-07-09: HAQIQIY ЖАМИ — sheet'ning o'z ЖАМИ qatoridan (formulalar hisoblagan).
  //   Panel KPI shuni ko'rsatadi → panel == LRV_PLUS KAFOLATLANADI (daraxtni JS'da qayta
  //   yig'ish takror-hisob berardi: 7.72 mlrd o'rniga 10.99 mlrd).
  var jamiAgg={stSm:0,stFk:0,stF2:0,chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0};

  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;

    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;

    // ЖАМИ qatori (start-1) — ST_RES/ST_FAKT/ST_F2 ni to'g'ridan-to'g'ri o'qiymiz
    try{
      if(start-1>=1){
        var _jr=sh.getRange(start-1,1,1,col.ST_OST).getValues()[0];
        var _mkJ=String(_jr[col.MARKER-1]||'').trim().toUpperCase();
        if(_mkJ==='ЖАМИ'||_mkJ==='JAMI'){
          jamiAgg.stSm+=_toNum(_jr[col.ST_RES-1]);
          jamiAgg.stFk+=_toNum(_jr[col.ST_FAKT-1]);
          jamiAgg.stF2+=_toNum(_jr[col.ST_F2-1]);
          jamiAgg.chel+=_toNum(_jr[col.CHEL-1]); jamiAgg.mash+=_toNum(_jr[col.MASH-1]);
          jamiAgg.mat +=_toNum(_jr[col.MAT-1]);  jamiAgg.ob  +=_toNum(_jr[col.OB-1]);
          jamiAgg.mk  +=_toNum(_jr[col.MK-1]);   jamiAgg.kab +=_toNum(_jr[col.KAB-1]);
          jamiAgg.bez +=_toNum(_jr[col.BEZSKLAD-1]);
        }
      }
    }catch(_eJ){}

    if (forceRefresh) {
      try { _oyYigindiFormulalarYangila(sh); formulaYangilandi=true; } catch(ex){}
    }

    var oylar=_f2Oylar(sh);
    for(var o=0;o<oylar.length;o++) oylarSet[oylar[o].nom]=true;

    var lastCol=Math.max(col.F2MUM, sh.getLastColumn());
    var g=sh.getRange(start,1,n,lastCol).getValues();
    // НАРХ ustuni formula (=G, smeta narxi default) yoki qo'lda kiritilgan aniq
    // (fakticheskiy) qiymatmi — buni farqlash uchun formulalar ham o'qiladi.
    var gf=(lastCol>=col.F2_BIRINCHI+1)?sh.getRange(start,1,n,lastCol).getFormulas():null;

    var curRz=null, curBl=null;

    for(var i=0;i<n;i++){
      var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase();
      var baseMk=mk.replace(/[+~]$/,'');
      var nom=String(g[i][col.NOM-1]||'').trim();
      if(baseMk==='rz' && !nom){
        for(var rc=0;rc<col.MARKER-1;rc++){
          var rv=String(g[i][rc]||'').trim();
          if(rv && /[А-ЯЁA-Za-z0-9]/.test(rv)){ nom=rv; break; }
        }
      }
      if(!nom && baseMk!=='rs' && baseMk!=='rz') continue;
      var r=start+i;

      if(baseMk==='rz'){
        var rzNom='';
        for(var rc=0;rc<8;rc++){
          var rv=String(g[i][rc]||'').trim();
          if(rv && /[А-ЯЁA-Za-zА-яёa-z]/.test(rv)){ rzNom=rv; break; }
        }
        if(!rzNom) rzNom=nom;
        // ⚡ fix: ketma-ket rz qatorlar (masalan "GAME CLUB" → "АР И КЖ" →
        // "ЗЕМЛЯНЫЕ РАБОТЫ" — dekorativ sarlavhalar, haqiqiy ish faqat oxirgisida
        // boshlanadi) oldin HAR BIRI alohida, BO'SH (bola ololmaydigan) razdel
        // sifatida daraxtga qo'shilardi — bosilganda "ичи очилмайди" bo'lib
        // ko'rinardi. Endi: agar oldingi rz hali BOLA olmagan bo'lsa — u
        // almashtiriladi (daraxtdan olib tashlanadi), faqat OXIRGI (haqiqiy
        // kontent oladigan) rz qoladi.
        if(curRz && curRz.children.length===0 && tree.length && tree[tree.length-1]===curRz){
          tree.pop();
        }
        curRz={type:'rz', nom:rzNom, varaq:nm, row:r, children:[]};
        tree.push(curRz); curBl=null;
      }
      else if(baseMk==='bl'||(baseMk === 'mat' || baseMk === 'ob') ){
        // Накрутка rasshifrovka tugmasi uchun kategoriya — faqat mustaqil mat/ob
        // (bl — jamlangan blok, накрутка bittalik narxga emas, yig'indiga tegishli).
        var stKat=null;
        if(baseMk!=='bl'){
          stKat=(baseMk==='ob')?'ОБ':'МАТ';
          if(_toNum(g[i][col.CHEL-1])>0) stKat='ЧЕЛ';
          else if(_toNum(g[i][col.MASH-1])>0) stKat='МАШ';
          else if(_toNum(g[i][col.MK-1])>0) stKat='М/К';
          else if(_toNum(g[i][col.KAB-1])>0) stKat='КАБ';
        }
        var oyVal={};
        for(var o=0;o<oylar.length;o++){
          var oCol=oylar[o].col;
          var narxCell=g[i][oCol];             // (oCol+1)-1 — НАРХ ustuni qiymati
          var narxIsFormula=!!(gf && gf[i][oCol]);
          oyVal[oylar[o].nom]={
            obyom:_toNum(g[i][oCol-1]),
            narx:_toNum(narxCell),
            narxIsFormula:narxIsFormula     // true=hali smeta narxi (G) bo'yicha default
          };
        }
        var blNode={
          type:baseMk, nom:nom, varaq:nm, row:r, kat:stKat,
          kod: String(g[i][col.KOD-1]||'').trim(),
          birlik: String(g[i][col.BIRLIK-1]||''),
          smetaHajm: _toNum(g[i][col.E-1]),
          fakt:      _toNum(g[i][col.FAKT-1]),
          qoldiq:    _toNum(g[i][col.QOLDIQ-1]),
          narx:      stKat ? _toNum(g[i][col.NARX-1]) : 0,  // накрутка rasshifrovka (faqat mustaqil mat/ob)
          f2ol:      _toNum(g[i][col.F2OL-1]),
          f2mum:     _toNum(g[i][col.F2MUM-1]),
          smeta:     _toNum(g[i][col.SMETA-1]),
          stFakt:    _toNum(g[i][col.ST_FAKT-1]),
          stF2:      _toNum(g[i][col.ST_F2-1]),
          oylar:     oyVal,
          isQosh:    /[+~]$/.test(mk),
          isZamena:  /~$/.test(mk),   // ~ = zamena (almashtirilgan), + = qo'shimcha ish
          children:  []
        };
        if(curRz) curRz.children.push(blNode);
        else { tree.push(blNode); }
        if(baseMk==='bl') curBl=blNode;
        else curBl=null;
      }
      else if(baseMk==='rs'){
        var rkat='МАТ';
        if(_toNum(g[i][col.CHEL-1])>0) rkat='ЧЕЛ';
        else if(_toNum(g[i][col.MASH-1])>0) rkat='МАШ';
        else if(_toNum(g[i][col.OB-1])>0) rkat='ОБ';
        else if(_toNum(g[i][col.MK-1])>0) rkat='М/К';
        else if(_toNum(g[i][col.KAB-1])>0) rkat='КАБ';
        var rsNode={
          type:'rs', nom:nom, varaq:nm, row:r, kat:rkat,
          kod: String(g[i][col.KOD-1]||'').trim(),
          birlik:   String(g[i][col.BIRLIK-1]||''),
          smetaHajm: _toNum(g[i][col.E-1]),
          f:         _toNum(g[i][col.F-1]),      // JAMI hajm (smeta bo'yicha, masalan 100 m)
          f2ol:      _toNum(g[i][col.F2OL-1]),   // F2 OLINGAN hajm (masalan 85 m) — "100→85" tasviri
          fakt:      _toNum(g[i][col.FAKT-1]),
          qoldiq:    _toNum(g[i][col.QOLDIQ-1]),
          narx:      _toNum(g[i][col.NARX-1]),   // накрутка rasshifrovka uchun (Ҳолат tab)
          smeta:     _toNum(g[i][col.ST_RES-1]),
          stFakt:    _toNum(g[i][col.ST_FAKT-1]),
          stF2:      _toNum(g[i][col.ST_F2-1]),
          stOst:     _toNum(g[i][col.ST_OST-1]),
          isQosh:    /[+~]$/.test(mk),
          isZamena:  /~$/.test(mk)   // ~ = zamena (almashtirilgan), + = qo'shimcha ish
        };
        if(curBl) curBl.children.push(rsNode);
      }
    }
  }
  if (formulaYangilandi) {
     try { SpreadsheetApp.flush(); } catch(ex){}
  }

  // ⚡ fix: varaq oxirida bo'sh qolgan rz (masalan so'nggi bo'lim hech qanday
  // bl/mat/rs olmagan bo'lsa) ham "bosilsa ochilmaydi" bo'lib ko'rinardi — endi
  // butunlay chiqarib tashlanadi (bo'sh razdel ko'rsatib foydasi yo'q).
  tree = tree.filter(function(n){ return !(n.type==='rz' && (!n.children || n.children.length===0)); });

  (function rollup(nodes){
    nodes.forEach(function(nd){
      if(nd.children && nd.children.length){
        rollup(nd.children);
        if(nd.type==='bl'){
          var sf=0, s2=0, sm=0, so=0;
          nd.children.forEach(function(c){ sf+=c.stFakt||0; s2+=c.stF2||0; sm+=c.smeta||0; so+=c.stOst||0; });
          nd.stFakt=sf; nd.stF2=s2; nd.stOst=so;
          if(!nd.smeta) nd.smeta=sm;
        }
        if(nd.type==='rz'){
          var rf=0, r2=0, rm=0, ro=0;
          nd.children.forEach(function(c){ rf+=c.stFakt||0; r2+=c.stF2||0; rm+=c.smeta||0; ro+=c.stOst||0; });
          nd.stFakt=rf; nd.stF2=r2; nd.smeta=rm; nd.stOst=ro;
        }
      }
    });
  })(tree);

  var result = {
    obyekt:       obyekt,
    locked:       locked,
    faktLocked:   false,
    format:       fmt,
    oylar:        Object.keys(oylarSet),
    tree:         tree,
    jami:         jamiAgg,           // ⚡ sheet ЖАМИ (haqiqat manbai — panel==sheet)
    darajalar:    apiDarajalarOl(obyekt)
  };
  try{ _keshYoz('holat_'+obyekt, result); }catch(e){}
  return result;
}


/* ============================================================
 * NARXLAR API — yangi arxitektura
 *
 * NARXLAR varag' tuzilishi:
 *   A=NOM  B=BIRLIK  C=KAT  D=BELGILANGAN  E=SMETA_MAX
 *   F+=sana ustunlari (header=sana, value=narx)
 *   OXIRGI=TIZIM (formula: =MAX(D,F:...))
 *
 * Xavfsizlik: bir material ikki ob'ektda farqli narxda bo'lsa → ogohlantirish
 * ============================================================ */
/* NARXLAR varaqidan o'qiydi — shu fayl, tez (~0.3 sek).
 * Kesh ishlatilmaydi: NARXLAR varaqi o'zi tez manba. */
function apiNarxlarOl(filter){
  var result = _narxlarHisob();
  if(!filter || filter==='ALL') return result;
  return {
    rows:    result.rows.filter(function(r){ return r.kat===filter; }),
    objects: result.objects,
    sanalar: result.sanalar
  };
}

/* TEZKOR hisob — faqat NARXLAR varaqini o'qiydi (shu fayl, ~0.3 sek).
 * Tashqi fayllar ochilmaydi. Ob'ekt narxlari to'g'ridan varaqdagi ustunlardan o'qiladi.
 * apiNarxlarYarat ishlaganda ob'ekt ustunlari NARXLAR ga yoziladi. */
function _narxlarHisob(){
  var ss=SpreadsheetApp.getActive();
  var narxSh=ss.getSheetByName(CFG.NARXLAR);
  if(!narxSh||narxSh.getLastRow()<2) return {rows:[],objects:[],sanalar:[]};

  // Ob'ektlar ro'yxati: skan keshidan
  var obsCache=_keshOlStale('skan')||[];
  var obList=obsCache.map(function(o){return o.obyekt;});

  // Header parse
  var mp=_narxlarHdrParse(narxSh, obList);
  // obCols: {obNom: col}, smetaMaxCol, tizimCol, sanaCols:[{nom,col}]

  var lastC=narxSh.getLastColumn();
  var nv=narxSh.getRange(2,1,narxSh.getLastRow()-1,lastC).getValues();

  var rows=[];
  for(var i=0;i<nv.length;i++){
    var nom=String(nv[i][0]||'').trim();
    var bir=String(nv[i][1]||'').trim();
    if(!nom||!bir) continue;
    var kat=String(nv[i][2]||'МАТ').trim()||'МАТ';
    var belgilangan=_toNum(nv[i][3]);

    // Har ob'ekt narxini varaqdagi ustundan o'qiymiz
    var smetaByOb={};
    var maxFromObs=0;
    for(var obNom in mp.obCols){
      var narx=_toNum(nv[i][mp.obCols[obNom]-1]);
      if(narx!==0){ smetaByOb[obNom]=narx; if(Math.abs(narx)>Math.abs(maxFromObs)) maxFromObs=narx; }
    }

    // СМЕТА_МАКС
    var smetaMax=mp.smetaMaxCol>0?_toNum(nv[i][mp.smetaMaxCol-1]):maxFromObs;
    if(!smetaMax) smetaMax=maxFromObs;

    // Sana narxlar
    var sanaLar={}, maxSana=0, maxSanaManba='';
    mp.sanaCols.forEach(function(sc){
      var sv=_toNum(nv[i][sc.col-1]);
      if(sv>0){ sanaLar[sc.nom]=sv; if(sv>maxSana){maxSana=sv;maxSanaManba=sc.nom;} }
    });

    var natija=Math.max(belgilangan||0,smetaMax||0,maxSana||0);

    // Manba — ТИЗИМ qayerdan keldi
    var manba='',manbaVal=0;
    if(belgilangan>manbaVal){manbaVal=belgilangan;manba='Belgilangan';}
    for(var obN in smetaByOb){
      if(smetaByOb[obN]>manbaVal){manbaVal=smetaByOb[obN];manba=obN;}
    }
    if(maxSana>manbaVal){manba=maxSanaManba||'Sana narx';}

    var narxLar=[];
    for(var ob2 in smetaByOb){if(smetaByOb[ob2]>0)narxLar.push(smetaByOb[ob2]);}
    var minN=narxLar.length?Math.min.apply(null,narxLar):0;
    var maxN=narxLar.length?Math.max.apply(null,narxLar):0;
    var xavf=(narxLar.length>1&&minN>0&&maxN/minN>1.05);

    rows.push({
      nom:nom,birlik:bir,kat:kat,
      belgilangan:belgilangan,max:smetaMax,
      smeta:smetaByOb,sanaLar:sanaLar,maxSana:maxSana,
      natija:natija,manba:manba,xavf:xavf
    });
  }
  rows.sort(function(a,b){return (a.kat+a.nom)>(b.kat+b.nom)?1:-1;});
  return {rows:rows,objects:obList,sanalar:mp.sanaCols.map(function(s){return s.nom;})};
}

/* ============================================================
 * NARXLAR varaqini yaratish — barcha LRV_PLUS lardan to'ldiradi.
 * Mavjud qatorlarga TEGMAYDI — faqat yangilarni qo'shadi.
 * Mavjud BELGILANGAN va sana narxlar saqlanadi.
 * ============================================================ */
/* ============================================================
 * NARXLAR varaqini yaratish/yangilash.
 *
 * Varaq tuzilishi:
 *   A=НОМ | B=БИРЛИК | C=КАТ | D=БЕЛГИЛАНГАН
 *   E..M  = har ob'ekt uchun ustun (papkaSkan tartibida)
 *   N     = СМЕТА_МАКС (=MAX ob'ekt ustunlari)
 *   N+1.. = sana narxlar (avvaldan bor bo'lsa saqlanadi)
 *   LAST  = ТИЗИМ
 *
 * Xavfsizlik: mavjud БЕЛГИЛАНГАН va sana narxlarga TEGMAYDI.
 * Ob'ekt ustunlari: mavjud bo'lmasa СМЕТА_МАКС dan oldin qo'shiladi.
 * ============================================================ */
function apiNarxlarYarat(){
  var obs=papkaSkan(), a=sozAsosiy(), col=CFG.C;
  var obList=obs.map(function(o){return o.obyekt;});
  var resources={};

  // 1. Barcha LRV_PLUS lardan resurslarni yig'amiz
  for(var i=0;i<obs.length;i++){
    var ob=obs[i], plus;
    try{ plus=_plusTop(ob.obyekt); }catch(e){ continue; }
    if(!plus) continue;
    var sheets=plus.getSheets();
    for(var s=0;s<sheets.length;s++){
      var lsh=sheets[s];
      if(lsh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
      var last=lsh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(lsh);
      if(last<start) continue;
      var n=last-start+1;
      var v=lsh.getRange(start,1,n,col.OB).getValues();
      for(var r=0;r<n;r++){
        var mk=String(v[r][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
        if(mk!=='rs'&&(mk !== 'mat' && mk !== 'ob') ) continue;
        var nom=String(v[r][col.NOM-1]||'').trim();
        var bir=String(v[r][col.BIRLIK-1]||'').trim();
        var narx=_toNum(v[r][col.NARX-1]);
        if(!nom||!bir) continue;
        var bn=_normBirlik(bir);
        var nU=nom.toUpperCase();
        var kat='МАТ';
        if(nU.indexOf('ТРУДА МАШИНИСТОВ')>=0) kat='МАШ';
        else if(bn.indexOf('ЧЕЛ')>=0) kat='ЧЕЛ';
        else if(bn.indexOf('МАШ')>=0) kat='МАШ';
        else if(_toNum(v[r][col.CHEL-1])) kat='ЧЕЛ';
        else if(_toNum(v[r][col.MASH-1])) kat='МАШ';
        else if(_toNum(v[r][col.OB-1])) kat='ОБ';
        var key=_norm(nom)+'||'+_normBirlik(bir);
        if(!resources[key]) resources[key]={nom:nom,birlik:bir,kat:kat,smeta:{},max:0};
        if(!resources[key].smeta[ob.obyekt]||narx>resources[key].smeta[ob.obyekt])
          resources[key].smeta[ob.obyekt]=narx;
        if(narx>resources[key].max) resources[key].max=narx;
      }
    }
  }

  // 2. NARXLAR varaqini ochish
  var sh=_narxlarSh();

  // 3. Header parse — ob'ekt, СМЕТА_МАКС, sana, ТИЗИМ ustunlarini topamiz
  var mp = _narxlarHdrParse(sh, obList);
  // mp = {obCols:{obNom:colIdx}, smetaMaxCol, tizimCol, sanaCols:[{nom,col}]}

  // 4. Yangi ob'ekt ustunlari qo'shamiz (papkaSkan da bor lekin headerda yo'q bo'lsa)
  obList.forEach(function(obNom){
    if(mp.obCols[obNom]) return; // allaqachon bor
    // СМЕТА_МАКС dan oldin insert (yoki shu yerga)
    var insAfter = mp.smetaMaxCol>0 ? mp.smetaMaxCol-1
                 : (Object.keys(mp.obCols).length>0
                    ? Math.max.apply(null, Object.keys(mp.obCols).map(function(k){return mp.obCols[k];}))
                    : 4);
    sh.insertColumnAfter(insAfter);
    var newCol = insAfter+1;
    // Barcha col indekslarni siljitamiz
    for(var k in mp.obCols){ if(mp.obCols[k]>insAfter) mp.obCols[k]++; }
    mp.sanaCols.forEach(function(s){ if(s.col>insAfter) s.col++; });
    if(mp.smetaMaxCol>insAfter) mp.smetaMaxCol++;
    if(mp.tizimCol>insAfter) mp.tizimCol++;
    mp.obCols[obNom]=newCol;
    sh.getRange(1,newCol).setValue(obNom)
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#fff');
    sh.setColumnWidth(newCol,130);
  });

  // 5. СМЕТА_МАКС ustunini yaratamiz (yo'q bo'lsa)
  if(!mp.smetaMaxCol){
    var insB = mp.tizimCol>0 ? mp.tizimCol : sh.getLastColumn()+1;
    if(mp.tizimCol>0) sh.insertColumnBefore(insB);
    mp.smetaMaxCol = insB;
    if(mp.tizimCol>0) mp.tizimCol++;
    sh.getRange(1,mp.smetaMaxCol).setValue('СМЕТА_МАКС')
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#fff');
    sh.setColumnWidth(mp.smetaMaxCol,120);
  }

  // 6. ТИЗИМ ustunini yaratamiz (yo'q bo'lsa)
  if(!mp.tizimCol){
    mp.tizimCol=sh.getLastColumn()+1;
    sh.getRange(1,mp.tizimCol).setValue('ТИЗИМ')
      .setFontWeight('bold').setBackground('#134a1a').setFontColor('#fff');
    sh.setColumnWidth(mp.tizimCol,120);
  }

  // 7. Mavjud qatorlar xaritasi (KAT ham — user tuzatmasini saqlaymiz)
  var existing={}, existKat={};
  if(sh.getLastRow()>=2){
    var ev=sh.getRange(2,1,sh.getLastRow()-1,3).getValues();
    for(var i=0;i<ev.length;i++){
      var k=_norm(String(ev[i][0]||'').trim())+'||'+_normBirlik(String(ev[i][1]||'').trim());
      existing[k]=i+2;
      existKat[k]=String(ev[i][2]||'').trim();
    }
  }

  // 8. Resurslarni yozamiz
  var keys=Object.keys(resources);
  keys.sort(function(a,b){
    var ra=resources[a],rb=resources[b]; return (ra.kat+ra.nom)>(rb.kat+rb.nom)?1:-1;
  });
  var newRecs=[], updated=0;
  keys.forEach(function(key){
    var r=resources[key];
    if(existing[key]){
      var row=existing[key];
      // Har ob'ekt narxini yozamiz (bo'sh ham bo'lsa 0 yoki '')
      obList.forEach(function(obNom){
        var c=mp.obCols[obNom]; if(!c) return;
        sh.getRange(row,c).setValue(r.smeta[obNom]||0);
      });
      sh.getRange(row,mp.smetaMaxCol).setValue(r.max);
      updated++;
    } else {
      newRecs.push(r);
    }
  });

  // 9. Yangi qatorlar batch yozish
  if(newRecs.length){
    var startRow=sh.getLastRow()+1;
    // A-D
    var baseData=newRecs.map(function(r){return [r.nom,r.birlik,r.kat,0];});
    sh.getRange(startRow,1,newRecs.length,4).setValues(baseData);
    // Har ob'ekt ustuni — bitta setValues chaqiruvi
    obList.forEach(function(obNom){
      var c=mp.obCols[obNom]; if(!c) return;
      var colData=newRecs.map(function(r){return [r.smeta[obNom]||0];});
      sh.getRange(startRow,c,newRecs.length,1).setValues(colData);
    });
    // СМЕТА_МАКС
    var smetaData=newRecs.map(function(r){return [r.max];});
    sh.getRange(startRow,mp.smetaMaxCol,newRecs.length,1).setValues(smetaData);
    // Ranglar batch
    var bgB={};
    newRecs.forEach(function(r,i){
      var bg=r.kat==='ЧЕЛ'?'#e8eaf6':r.kat==='МАШ'?'#ede7f6':r.kat==='ОБ'?'#fff8e1':'#f1f8e9';
      bgB[bg]=bgB[bg]||[];bgB[bg].push(startRow+i);
    });
    for(var bg in bgB){
      sh.getRangeList(bgB[bg].map(function(r){return 'A'+r+':D'+r;})).setBackground(bg);
    }
  }

  // 10. ТИЗИМ formulalarini bir martada batch
  _narxTizimBatch(sh);

  // 11. Format
  sh.getRange(2,4,Math.max(sh.getLastRow()-1,1),Math.max(sh.getLastColumn()-3,2)).setNumberFormat('#,##0');
  sh.showSheet();
  SpreadsheetApp.flush();


  return {ok:true, xabar:keys.length+' resurs ('+newRecs.length+' yangi, '+updated+' yangilangan)'};
}


/* NARXLAR header parse: ob'ekt ustunlari, СМЕТА_МАКС, sana, ТИЗИМ topadi.
 * obList — papkaSkan dan ob'ekt nomlari (ob'ektmi sana ekanligini aniqlash uchun). */
function _narxlarHdrParse(sh, obList){
  var obSet={};
  (obList||[]).forEach(function(n){obSet[n]=true;});
  var mp={obCols:{}, smetaMaxCol:0, tizimCol:0, sanaCols:[]};
  var lastC=sh.getLastColumn();
  if(lastC<5) return mp;
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0];
  for(var c=4;c<hdr.length;c++){  // E(5)dan boshlab, 0-indexed
    var h=String(hdr[c]||'').trim(); if(!h) continue;
    var hU=h.toUpperCase();
    if(hU.indexOf('ТИЗИМ')>=0)          mp.tizimCol=c+1;
    else if(hU.indexOf('СМЕТА_МАК')>=0) mp.smetaMaxCol=c+1;
    else if(obSet[h])                   mp.obCols[h]=c+1;
    else                                mp.sanaCols.push({nom:h,col:c+1});
  }
  return mp;
}

/* NARXLAR varaqni yaratish yoki topish */
function _narxlarSh(){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.NARXLAR);
  if(!sh){
    sh=ss.insertSheet(CFG.NARXLAR);
    // Sarlavhalar: A-E qismi
    sh.getRange(1,1,1,5).setValues([['НОМ','БИРЛИК','КАТ','БЕЛГИЛАНГАН','СМЕТА_МАКС']])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    sh.setColumnWidth(1,380); sh.setColumnWidth(2,80); sh.setColumnWidth(3,60);
    sh.setColumnWidth(4,120); sh.setColumnWidth(5,120);
    sh.setFrozenRows(1); sh.setFrozenColumns(3);
  }
  return sh;
}

/* TIZIM formulasi — bitta qatorda (apiNarxBelgilanganSaqla uchun) */
function _narxTizimFormula(sh, row){
  var lastC=sh.getLastColumn();
  if(lastC<6) return;
  sh.getRange(row,lastC).setFormula(_tizimF(row,lastC));
}

/* TIZIM formulasini barcha qatorlarga BITTA chaqiruvda yozadi (tez) */
function _narxTizimBatch(sh){
  var lastC=sh.getLastColumn();
  var last=sh.getLastRow();
  if(lastC<6 || last<2) return;
  var n=last-1;
  var out=[];
  for(var row=2;row<=last;row++) out.push([_tizimF(row,lastC)]);
  sh.getRange(2,lastC,n,1).setFormulas(out);
}

/* Formula matni: =MAX(D27,E27,F27,...) */
function _tizimF(row, lastC){
  var f='=MAX(D'+row+',E'+row;
  for(var c=6;c<=lastC-1;c++) f+=','+_cl(c)+row;
  return f+')';
}

/* ============ ORALIQ API ============
 * Svodkadagi seksiya chegaralarini avto-aniqlash, ko'rsatish, saqlash. */

/* Svodka faylni skanlab seksiya sarlavhalarini topadi */
function apiOraliqlarSkan(obyekt){
  var obs=papkaSkan(), target=null;
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt.trim()===obyekt.trim()){target=obs[i];break;}
  if(!target) throw 'Obyekt topilmadi: ' + obyekt + ' (obs=' + obs.length + ')';
  if(target.narxTayyor) throw 'Бу объект аллақачон нархланган (свод йўқ) — оралиқ керак эмас';
  if(!target.svodFile) throw 'Svod fayl null: ' + obyekt + ' (obs=' + obs.length + ')';
  var fmt=_normFormat(target.format||'TN');
  var sc=_svodCfg(target);
  var kat=sozKategoriya();
  var svodSS=_openAsSheet(target.svodFile, target.folderId);
  var sheets=svodSS.getSheets(), oraliqlar=[];
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s]; if(_skip(sh.getName())) continue;
    if(target.svodSheets&&target.svodSheets.length&&target.svodSheets.indexOf(sh.getName())<0) continue;
    var last=sh.getLastRow(); if(last<1) continue;
    var maxc=Math.max(6,sc.NARX,sc.NOM,sc.BLOK,sc.KOD||0,sc.BIRLIK||0);
    var v=sh.getRange(1,1,last,maxc).getValues();
    var vNom=sh.getName();
    if(fmt==='ABC4'){
      for(var i=0;i<v.length;i++){
        var nom=String(v[i][sc.NOM-1]||'').trim(), nomUp=nom.toUpperCase();
        var narx=_toNum(v[i][sc.NARX-1]);
        var kod=(sc.KOD&&v[i][sc.KOD-1]!=null)?String(v[i][sc.KOD-1]).trim():'';
        if((!kod||narx===0)&&nomUp){
          var dk='';
          if(kat.blok.OB   && nomUp.indexOf(kat.blok.OB)>=0)   dk='ОБ';
          else if(kat.blok.CHEL && nomUp.indexOf(kat.blok.CHEL)>=0) dk='ЧЕЛ';
          else if(kat.blok.MASH && nomUp.indexOf(kat.blok.MASH)>=0) dk='МАШ';
          else if(kat.blok.MAT  && nomUp.indexOf(kat.blok.MAT)>=0)  dk='МАТ';
          else if(nomUp.indexOf('ОБОРУДОВАН')>=0) dk='ОБ';
          else if(nomUp.indexOf('МАШИН')>=0) dk='МАШ';
          else if(nomUp.indexOf('ТРУД')>=0||nomUp.indexOf('РАБОЧ')>=0) dk='ЧЕЛ';
          else if(nomUp.indexOf('МАТЕРИАЛ')>=0) dk='МАТ';
          if(dk) oraliqlar.push({varaq:vNom,qator:i+1,kat:dk,sarlavha:nom});
        }
      }
    } else {
      for(var i=0;i<v.length;i++){
        // SEKSIYA NOMZODI = NARXSIZ matnli qator (eski ishlagan universal mantiq).
        // ⚠️ Avvalgi `if(kod||bir) continue` sharti JUDA TOR edi: TN svodkalarda seksiya
        // sarlavha qatorida № yoki merged qiymat bo'lsa seksiya TOPILMASDI → oraliq
        // bo'sh → narxlash qamrovi yo'q → ko'pchilik narx 0 bo'lardi.
        var narx=_toNum(v[i][sc.NARX-1]);
        if(narx!==0) continue;                    // narxli qator = resurs, seksiya emas
        var blok=String(v[i][sc.BLOK-1]||'').trim();
        // MERGED seksiya sarlavhasi (masalan "ЗАТРАТЫ ТРУДА" A1:F1 birlashtirilgan) —
        // qiymat faqat chap-yuqori (A) katakda bo'ladi, BLOK ustuni bo'sh ko'rinadi.
        // Shunда qatordagi BIRINCHI harfli katakdan olamiz (universal).
        if(!blok){
          for(var c0=0;c0<maxc;c0++){
            var cv0=String(v[i][c0]||'').trim();
            if(cv0 && /[А-ЯЁA-Z]/i.test(cv0)){ blok=cv0; break; }
          }
        }
        var blokUp=blok.toUpperCase();
        if(!blokUp) continue;
        var dk='';
        if(blokUp.indexOf('МАШИНИСТ')>=0) dk='МАШ';
        else if(kat.blok.CHEL && blokUp.indexOf(kat.blok.CHEL)>=0) dk='ЧЕЛ';
        else if(kat.blok.MASH && blokUp.indexOf(kat.blok.MASH)>=0) dk='МАШ';
        else if(kat.blok.MAT  && blokUp.indexOf(kat.blok.MAT)>=0)  dk='МАТ';
        else if(kat.blok.OB   && blokUp.indexOf(kat.blok.OB)>=0)   dk='ОБ';
        else if(blokUp.indexOf('ОБОРУДОВАН')>=0) dk='ОБ';
        else if(blokUp.indexOf('МАШИН')>=0) dk='МАШ';
        else if(blokUp.indexOf('ТРУД')>=0||blokUp.indexOf('РАБОЧ')>=0) dk='ЧЕЛ';
        else if(blokUp.indexOf('МАТЕРИАЛ')>=0) dk='МАТ';
        if(dk) oraliqlar.push({varaq:vNom,qator:i+1,kat:dk,sarlavha:blok});
      }
    }
  }
  _cleanupTmp(svodSS);
  return {obyekt:obyekt, format:fmt, oraliqlar:oraliqlar};
}

/* Saqlangan oraliqlarni o'qiydi */
function apiOraliqlarOl(obyekt){ return _oraliqlarOl(obyekt); }

/* Oraliqlarni saqlaydi (user tasdiqlagan) */
function apiOraliqlarSaqla(obyekt, oraliqlar){
  var ss=SpreadsheetApp.getActive(), sh=ss.getSheetByName(_ORALIQ_SH);
  if(!sh){
    sh=ss.insertSheet(_ORALIQ_SH);
    sh.getRange(1,1,1,5).setValues([['ОБЪЕКТ','ВАРАҚ','ҚАТОР','КАТЕГОРИЯ','САРЛАВҲА']])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#fff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1,150);sh.setColumnWidth(2,120);sh.setColumnWidth(3,70);
    sh.setColumnWidth(4,100);sh.setColumnWidth(5,400);
  }
  var base = _cfgKalit(obyekt);                 // PAPKA nomi (svodka kaliti) ostida saqlaymiz
  // Bu papkaga (svodkaga) tegishli eski oraliqlarni tozalab, qolganlarini saqlaymiz
  var keep=[];
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,5).getValues();
    for(var i=0;i<v.length;i++){
      var dbOb = String(v[i][0]||'').trim();
      if(!_cfgMos(dbOb, obyekt)) keep.push(v[i]);
    }
  }
  var newR=(oraliqlar||[]).map(function(o){
    return [base,o.varaq||'',o.qator||0,o.kat||'МАТ',o.sarlavha||''];
  });
  _sheetDataYoz(sh,keep.concat(newR),5);
  sh.hideSheet();
  return {ok:true, xabar:newR.length+' оралиқ сақланди'};
}

/* YANGI BO'SH ISH TURI (bl+) — kutubxonada yo'q ish uchun.
 * Keyin RS lar apiRsQosh bilan qo'shiladi.
 * params = {obyekt, varaq, afterRow, nom, birlik, hajm} */
function apiBlQosh(params){
  var obyekt=params.obyekt, varaqNom=params.varaq;
  
  // ⚡ Jamlangan rejim marshruti: varaq "sub||varaq" bo'lsa — yozuv sub-obyektga boradi
  if (String(varaqNom).indexOf('||') >= 0) {
    var _p = String(varaqNom).split('||');
    obyekt = _p[0]; varaqNom = _p[1];
  }

  var afterRow=Number(params.afterRow);
  var nom=String(params.nom||'').trim(), birlik=String(params.birlik||'').trim();
  var hajm=_toNum(params.hajm);
  if(!obyekt||!varaqNom||!afterRow||!nom) throw 'Параметрлар тўлиқ эмас';
  if(hajm<=0) throw 'Ҳажм 0 дан катта бўлсин';
  var plus=_plusTop(obyekt); if(!plus) throw 'LRV_PLUS топилмади';
  var sh=plus.getSheetByName(varaqNom); if(!sh) throw 'Варақ топилмади';
  if(afterRow<1||afterRow>sh.getLastRow()) throw 'afterRow нотўғри';
  var col=CFG.C, CL=_cl;
  sh.insertRowsAfter(afterRow,1);
  var r=afterRow+1;
  sh.getRange(r,col.KOD).setValue('');
  sh.getRange(r,col.NOM).setValue(nom);
  sh.getRange(r,col.BIRLIK).setValue(birlik);
  sh.getRange(r,col.E).setValue(hajm);
  sh.getRange(r,col.F).setValue(hajm);
  // ⚡ 2026-07-06: zamena bo'lsa 'bl~', oddiy qo'shimcha 'bl+' — hisobotlarda ajratish uchun
  sh.getRange(r,col.MARKER).setValue(params.zamena ? 'bl~' : 'bl+');
  sh.getRange(r,col.FAKT).setValue(0);
  sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r);
  // ⚡ 2026-07-06: avval naive =SUM($AE:$ZZ) edi (obyom+narx+summa aralash + #N/A xavfi) —
  // endi _f2sum aniq ОБЪЁМ ustunlarini sanaydi (grid'ga bog'liq emas)
  sh.getRange(r,col.F2OL).setFormula(_f2sum(r,0,_f2OyCols(sh)));
  sh.getRange(r,col.F2MUM).setFormula('=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r);
  sh.getRange(r,col.SMETA).setValue(0);
  sh.getRange(r,col.H_BL).setValue(nom);
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  sh.getRange(r,col.KOD).setFontWeight('bold').setFontColor('#0070c0');
  sh.getRange(r,col.NOM).setFontWeight('bold').setFontColor('#0070c0').setWrap(true);
  sh.getRange(r,col.BIRLIK).setFontWeight('bold').setFontColor('#0070c0');
  
  // ⚡ 2026-07-05 TEZLIK: f2_mode'da lrvYoz yakunga qoldiriladi (apiF2Qolla BIR marta qiladi)
  if(!params.f2_mode){ lrvYoz(obyekt, sh); SpreadsheetApp.flush(); }

  return {ok:true, blRow:r, nRows:1, xabar:nom+' (янги иш тури) қўшилди — энди ресурс қўшинг'};
}

/* RS QO'SHISH — mavjud BL ga yangi rs+ resurs qo'shadi
 * params = {obyekt, varaq, blRow, nom, birlik, norm} */
function apiRsQosh(params){
  var obyekt=params.obyekt, varaqNom=params.varaq;
  
  // ⚡ Jamlangan rejim marshruti: varaq "sub||varaq" bo'lsa — yozuv sub-obyektga boradi
  if (String(varaqNom).indexOf('||') >= 0) {
    var _p = String(varaqNom).split('||');
    obyekt = _p[0]; varaqNom = _p[1];
  }

  var blRow=Number(params.blRow), nom=String(params.nom||'').trim();
  var birlik=String(params.birlik||'').trim(), norm=_toNum(params.norm);
  if(!obyekt||!varaqNom||!blRow||!nom||!birlik||norm<0)
    throw 'Параметрлар тўлиқ эмас';
  var plus=_plusTop(obyekt);
  if(!plus) throw 'LRV_PLUS топилмади';
  var sh=plus.getSheetByName(varaqNom);
  if(!sh) throw 'Варақ топилмади: '+varaqNom;
  // BL дан кейинги охирги rs/mat болани топамиз
  var col=CFG.C, CL=_cl;
  var last=sh.getLastRow();
  var lastChild=blRow;
  if(blRow<last){
    var v=sh.getRange(blRow+1,col.MARKER,last-blRow,1).getValues();
    for(var i=0;i<v.length;i++){
      var mk=String(v[i][0]||'').trim().toLowerCase().replace(/[+~]$/,'');
      if(mk==='bl'||mk==='rz') break;
      if(mk==='rs'||(mk === 'mat' || mk === 'ob') ) lastChild=blRow+1+i;
    }
  }
  // Yangi rs+ qator qo'shamiz
  sh.insertRowsAfter(lastChild,1);
  var r=lastChild+1;
  var isF2 = !!params.f2_mode;
  var narx = isF2 ? _toNum(params.narx) : 0;
  var cat = 'МАТ';
  if (isF2) {
      // ⚡ 2026-07-05: BIRLIK YETAKCHI (qoida #9) — чел-час/маш-час bo'lsa foydalanuvchi
      // tanlovi ham bosib o'tolmaydi (avval params.cat birlikdan OLDIN tekshirilardi).
      // params.kat — UI dropdown tanlovi (МАТ/ОБ/М-К/КАБ); params.cat — eski node.type
      // ('mat'/'ob') zaxira sifatida saqlanadi.
      var pcOld = (params.cat || '').toString().toUpperCase();
      var tanlov = params.kat || (pcOld==='OB' ? 'ОБ' : (pcOld==='MAT' ? 'МАТ' : ''));
      cat = _f2KatAvto(birlik, tanlov);
  }

  if (!isF2) {
    // Narxni svodkadan topamiz (Faqat qo'lda qo'shishda, F2 da emas)
    var obs=papkaSkan(), target=null;
    for(var i=0;i<obs.length;i++) if(obs[i].obyekt.trim()===obyekt.trim()){ target=obs[i]; break; }
    if(target&&target.svodFile){
      try{
        var fmt=_normFormat(target.format||'TN');
        var svodCfg=_svodCfg(target);
        var kat=sozKategoriya(), faktMap=sozFaktNarx(), a=sozAsosiy();
        var nkMap=_narxlarKatMap();
        var svodSS=_openAsSheet(target.svodFile,target.folderId);
        var savedOraliq=_oraliqlarOl(obyekt);
        var pdb=_priceDB(svodSS,kat,svodCfg,fmt,target.svodSheets||[],savedOraliq);
        _cleanupTmp(svodSS);
        var p=_findPrice(nom,birlik,'',pdb,kat,faktMap,a,nkMap);
        narx=p.narx; cat=p.cat||'МАТ';
      }catch(e){}
    }
  }
  sh.getRange(r,col.NOM).setValue(nom);
  sh.getRange(r,col.BIRLIK).setValue(birlik);
  var paramCat = (params.cat || '').toString().toUpperCase();
  // ⚡⚡⚡ 2026-07-05 (foydalanuvchi ANIQ qoidasi): "E to'liq obyom"mi yoki "E=norma,
  // F=obyom"mi — buni TIP emas, F2 dagi F KATAGI hal qiladi. F bo'sh → E BUTUN OBYOM
  // (KO'PAYTIRILMAYDI, F='=E'), F to'la → E=norma, F=bl.obyom×E (ko'paytiriladi) —
  // xuddi qolgan struktura kabi. Bu mat/ob/rs — HAR UCHALASIGA amal qiladi (material
  // rs ham bo'lishi mumkin). Klient `eObyom` yuboradi (F2 node.norma>0 bo'lmasa true);
  // yubormasa — eski tip-asosli aniqlash (zaxira).
  var isMatOrOb = (params.eObyom!==undefined) ? !!params.eObyom : (paramCat === 'MAT' || paramCat === 'OB');
  // Dvigatel (_ishlaVaraq) bilan BIR XIL uslub (E/F merge YO'Q):
  // mat/ob → E=obyom, F='=E'; rs → E=norma, F=bl.obyom×norma.
  if (isMatOrOb) {
      sh.getRange(r,col.E).setValue(norm);
      sh.getRange(r,col.F).setFormula('='+CL(col.E)+r);
  } else {
      sh.getRange(r,col.E).setValue(norm);
      sh.getRange(r,col.F).setFormula('='+CL(col.E)+'$'+blRow+'*'+CL(col.E)+r);
  }

  // ⚡ 2026-07-06: zamena bo'lsa 'rs~', oddiy qo'shimcha 'rs+'
  sh.getRange(r,col.MARKER).setValue(params.zamena ? 'rs~' : 'rs+');
  sh.getRange(r,col.NARX).setValue(narx);
  if (isMatOrOb) {
      sh.getRange(r,col.SMETA).setFormula('=$'+CL(col.E)+r+'*$'+CL(col.NARX)+r);
  } else {
      sh.getRange(r,col.SMETA).setFormula('=$'+CL(col.F)+r+'*$'+CL(col.NARX)+r);
  }
  // ⚡ YAKUNIY KATEGORIYA QOIDASI (dvigatel _ishlaVaraq bilan BIR XIL): ЧЕЛ/МАШ FAQAT
  //   birlik (чел-час/маш-час) orqali. Birligi чел/маш bo'lmagan resurs ЧЕЛ/МАШ ga
  //   tusha olmaydi (material/uskuna xato МАШ ustuniga o'tib ketmasin).
  var _bU = String(birlik||'').toUpperCase();
  if(_bU.indexOf('ЧЕЛ')>=0 || _bU.indexOf('CHEL')>=0) cat='ЧЕЛ';
  else if(_bU.indexOf('МАШ')>=0 || _bU.indexOf('MASH')>=0) cat='МАШ';
  else if(cat==='ЧЕЛ' || cat==='МАШ') cat='МАТ';
  // Kategoriya
  var mainC=(cat==='КАБ'||cat==='КАБЕЛ')?'МАТ':cat;
  var ref='=$'+CL(col.SMETA)+r;
  var catCol=col.MAT;
  if(mainC==='ЧЕЛ') catCol=col.CHEL;
  else if(mainC==='МАШ') catCol=col.MASH;
  else if(mainC==='ОБ'||mainC==='ОБОР') catCol=col.OB;
  else if(mainC==='МК'||mainC==='М/К') catCol=col.MK;
  sh.getRange(r,catCol).setFormula(ref);
  // FAKT/QOLDIQ/F2 — dvigatel uslubi: mat/ob FAKT=0 (qo'lda kiritiladi), rs bl'ga bog'liq
  if (isMatOrOb) {
      sh.getRange(r,col.FAKT).setValue(0);
      sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r);
  } else {
      sh.getRange(r,col.FAKT).setFormula('='+CL(col.FAKT)+'$'+blRow+'*'+CL(col.E)+r);
      sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.F)+r+'-$'+CL(col.FAKT)+r);
  }

  // ⚡ 2026-07-04 fix: avval oddiy SUM($first:$ZZ) ishlatilardi — bu har oyning
  // 3 ustunini (ОБЪЁМ|НАРХ|СУММА) BIR-BIRIGA ARALASHTIRIB qo'shardi (hajm+narx+summa
  // birga), F2 butunlay noto'g'ri chiqardi. Endi asosiy strukturadagi bilan bir xil
  // _f2sum (faqat ОБЪЁМ/СУММА ustunlarini, MOD orqali, har oy bo'yicha to'g'ri yig'adi).
  sh.getRange(r,col.F2OL).setFormula(_f2sum(r,0,_f2OyCols(sh)));
  sh.getRange(r,col.F2MUM).setFormula('=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r);
  sh.getRange(r,col.ST_RES).setFormula('=$'+CL(col.SMETA)+r);
  sh.getRange(r,col.ST_FAKT).setFormula('=$'+CL(col.FAKT)+r+'*$'+CL(col.NARX)+r);
  sh.getRange(r,col.ST_F2).setFormula(_f2sum(r,2,_f2OyCols(sh)));
  sh.getRange(r,col.ST_OST).setFormula('=$'+CL(col.F2MUM)+r+'*$'+CL(col.NARX)+r);
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  sh.getRange(r,col.KOD).setFontWeight('normal').setFontColor('#000000');
  sh.getRange(r,col.NOM).setFontWeight('normal').setFontColor('#000000').setWrap(true);
  sh.getRange(r,col.BIRLIK).setFontWeight('normal').setFontColor('#000000');
  // Oy formulalari (agar mavjud bo'lsa)
  // ⚡⚡ 2026-07-05 YURIDIK: f2_mode'da oy kataklariga FORMULA YOZILMAYDI —
  // F2 hujjatdan kelgan ОБЪЁМ/НАРХ/СУММА STATIK ko'chiriladi (apiF2Qolla →
  // apiHolatSaqla). Formula (bl×norma) aktdagi aniq qiymatni buzib, yaxlitlash
  // farqini keltirardi. Faqat QO'LDA qo'shishda (f2_mode emas) formula qoladi.
  if(!isF2){
    var oylar=_f2Oylar(sh);
    for(var oi=0;oi<oylar.length;oi++){
      sh.getRange(r,oylar[oi].col).setFormula('='+CL(oylar[oi].col)+'$'+blRow+'*'+CL(col.E)+r);
    }
  }
  // BL smeta formulasini yangilaymiz
  var c1=blRow+1, c2=r;
  sh.getRange(blRow,col.SMETA).setFormula('=SUM($'+CL(col.SMETA)+c1+':$'+CL(col.SMETA)+c2+')');
  
  // ⚡ 2026-07-05 TEZLIK: f2_mode'da lrvYoz CHAQIRILMAYDI — u har safar butun varaq
  // formulalarini ta'mirlab + DASHBOARD faylini ochib yozadi (3-6 sek). F2 importda
  // har dop/resurs uchun shu ishlasa 40 qator = bir necha DAQIQA kutish bo'lardi
  // ("soddagina ishda sekinlik" ildizi). apiF2Qolla YAKUNDA hammasini BIR MARTA qiladi.
  if(!params.f2_mode){ lrvYoz(obyekt, sh); SpreadsheetApp.flush(); }

  // ⚡ 2026-07-05: `rsRow` yo'q edi — apiF2Qolla (F2 import) yangi rs+ ning oy
  // hajmini yozish uchun aynan shu maydonga tayanadi (rr.rsRow); yo'q bo'lgani
  // uchun `apiHolatSaqla` ga row:undefined yuborilib, u yerda crash bo'lardi.
  return {ok:true, rsRow:r, xabar:nom+' ('+birlik+', narx='+narx+') qo\'shildi'};
}

/* KAT o'zgartirish (C ustun) — panel dan */
function apiNarxKatSaqla(nom, birlik, yangiKat){
  var sh=_narxlarSh();
  var key=_norm(nom)+'||'+_normBirlik(birlik);
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(var i=0;i<v.length;i++){
      var k=_norm(String(v[i][0]||'').trim())+'||'+_normBirlik(String(v[i][1]||'').trim());
      if(k===key){
        sh.getRange(i+2,3).setValue(yangiKat);
        return {ok:true};
      }
    }
  }
  return {ok:false, xabar:'Resurs topilmadi'};
}

/* Belgilangan narxni saqlash (D ustun) */
function apiNarxBelgilanganSaqla(nom, birlik, belgilangan){
  var sh=_narxlarSh();
  var key=_norm(nom)+'||'+_normBirlik(birlik);
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(var i=0;i<v.length;i++){
      var k=_norm(String(v[i][0]||'').trim())+'||'+_normBirlik(String(v[i][1]||'').trim());
      if(k===key){
        sh.getRange(i+2,4).setValue(_toNum(belgilangan));
        _narxTizimFormula(sh,i+2);
        SpreadsheetApp.flush();
        return {ok:true};
      }
    }
  }
  return {ok:false, xabar:'Resurs topilmadi'};
}

/* Yangi sana narxi qo'shish
 * edits=[{nom,birlik,sana,narx,smetaMax,kat,xavfTasdiqlandi}] */
function apiNarxSanaQosh(edits){
  if(!edits||!edits.length) return {ok:true,jami:0};
  var sh=_narxlarSh();
  var sana=edits[0].sana; // bir xil sana
  if(!sana) return {ok:false,xabar:'Sana ko\'rsatilmagan'};

  // Sarlavhada sana ustunini topamiz yoki qo'shamiz
  var lastC=sh.getLastColumn();
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0];
  var sanaCol=-1;
  // TIZIM (oxirgi) dan oldingi ustunlarni ko'ramiz
  for(var c=5;c<lastC;c++){
    if(String(hdr[c]||'').trim()===sana){ sanaCol=c+1; break; }
  }
  if(sanaCol<0){
    // Yangi sana ustuni qo'shiladi: TIZIM dan bir oldin
    // Avval TIZIM ustuni bor-yo'qligini tekshiramiz
    var hasTizim = lastC>=6 && String(hdr[lastC-1]||'').toUpperCase().indexOf('ТИЗИМ')>=0;
    if(hasTizim){
      // TIZIM dan oldin yangi ustun qo'shamiz
      sh.insertColumnBefore(lastC);
      sanaCol=lastC;
      lastC++;
    } else {
      sanaCol=lastC+1;
    }
    sh.getRange(1,sanaCol).setValue(sana)
      .setFontWeight('bold').setBackground('#0f3460').setFontColor('#fff');
    sh.setColumnWidth(sanaCol, 110);
    // Agar TIZIM ustuni yo'q bo'lsa — qo'shamiz
    if(!hasTizim){
      sh.getRange(1,sanaCol+1).setValue('ТИЗИМ')
        .setFontWeight('bold').setBackground('#134a1a').setFontColor('#fff');
      sh.setColumnWidth(sanaCol+1, 110);
      lastC=sanaCol+1;
    }
  }

  // Mavjud resurslar xaritasi
  var existing={};
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(var i=0;i<v.length;i++){
      var k=_norm(String(v[i][0]||'').trim())+'||'+_normBirlik(String(v[i][1]||'').trim());
      existing[k]=i+2; // row number
    }
  }

  var jami=0;
  for(var e=0;e<edits.length;e++){
    var ed=edits[e];
    var key=_norm(ed.nom)+'||'+_normBirlik(ed.birlik);
    var narx=_toNum(ed.narx);
    if(narx===0) continue;
    var row;
    if(existing[key]){
      row=existing[key];
    } else {
      // Yangi qator
      row=sh.getLastRow()+1;
      sh.getRange(row,1,1,5).setValues([[ed.nom,ed.birlik,ed.kat||'МАТ',0,_toNum(ed.smetaMax)||0]]);
      existing[key]=row;
    }
    // SMETA_MAX yangilash
    var curSmeta=_toNum(sh.getRange(row,5).getValue());
    if(_toNum(ed.smetaMax)>curSmeta) sh.getRange(row,5).setValue(_toNum(ed.smetaMax));
    // Sana narxi
    sh.getRange(row,sanaCol).setValue(narx).setNumberFormat('#,##0');
    // Rang
    if(narx>_toNum(ed.smetaMax||0)){
      sh.getRange(row,sanaCol).setBackground('#fffde7').setFontColor('#c17f00');
    } else {
      sh.getRange(row,sanaCol).setBackground('#f1f8e9').setFontColor('#2e7d32');
    }
    jami++;
  }
  // TIZIM formulalarini barcha qatorga bir martada
  _narxTizimBatch(sh);
  sh.getRange(2,1,Math.max(sh.getLastRow()-1,1),sh.getLastColumn())
    .setNumberFormat('#,##0');
  SpreadsheetApp.flush();
  return {ok:true,jami:jami};
}

/* Fakt narxlarni saqlash — eski API (mos turish uchun) */
function apiNarxlarSaqla(edits){
  if(!edits||!edits.length) return {ok:true, jami:0};
  var today=Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd');
  var mapped=edits.map(function(e){
    return {nom:e.nom,birlik:e.birlik,sana:today,narx:e.faktNarx,
            smetaMax:e.smetaMax,kat:'МАТ',xavfTasdiqlandi:true};
  });
  return apiNarxSanaQosh(mapped);
}

/* SOZLAMALAR_НАРХ ga ham yozamiz — narxlash dvigatelida ishlashi uchun */
function _narxlarToSozlama(){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.NARXLAR);
  if(!sh||sh.getLastRow()<2) return;
  var lastC=sh.getLastColumn();
  var v=sh.getRange(2,1,sh.getLastRow()-1,lastC).getValues();
  var sozSh=SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_NARX);
  if(!sozSh){
    sozSh=SpreadsheetApp.getActive().insertSheet(CFG.SOZ_NARX);
    sozSh.getRange(1,1,1,4).setValues([['НОМ','БИРЛИК','СМЕТА','ФАКТ']]);
    sozSh.hideSheet();
  }
  var rows=[];
  for(var i=0;i<v.length;i++){
    var tizim=_toNum(v[i][lastC-1]); // TIZIM col (oxirgi)
    if(tizim>0) rows.push([v[i][0],v[i][1],v[i][4]||0,tizim]);
  }
  _sheetDataYoz(sozSh,rows,4);
  return rows.length;
}


/* Saqlash — fakt yoki oy qiymati */
// edits = [{varaq, row, fakt, oylar:{oyNom:hajm}}]
// mode = 'fakt' yoki oyNom (masalan 'Май 2026')
function apiHolatSaqla(obyekt, edits){
  var col=CFG.C, byV={};

  // 1) edits ni sub-obyekt → varaq bo'yicha guruhlash
  for(var i=0;i<edits.length;i++){
    var v = edits[i].varaq;
    var subOb = obyekt, realV = v;
    if (v.indexOf('||') >= 0) {
      var parts = v.split('||');
      subOb = parts[0]; realV = parts[1];
    }
    byV[subOb] = byV[subOb] || {};
    byV[subOb][realV] = byV[subOb][realV] || [];
    var clonedEdit = JSON.parse(JSON.stringify(edits[i]));
    clonedEdit.varaq = realV;
    byV[subOb][realV].push(clonedEdit);
  }

  var jami=0;
  var subObjectsSaved = {};

  // 2) Har varaq uchun barcha yozuvlarni BATCH bilan (bitta getRange.setValues)
  for (var subOb in byV) {
    var plus = _plusTop(subOb);
    if (!plus) continue;
    subObjectsSaved[subOb] = plus;

    for (var v in byV[subOb]) {
      var sh = plus.getSheetByName(v);
      if (!sh) continue;
      var oylar = _f2Oylar(sh), oyCol = {}, oyColN = {};
      // ⚡ 2026-07-09: oy nomini KANONIK kalit (_oyKey) bo'yicha solishtiramiz — regist,
      //   probel VA "05.2026"↔"5.2026" (Sheets nol yeyishi) farqlarini yengadi.
      for (var o = 0; o < oylar.length; o++){ oyCol[oylar[o].nom] = oylar[o].col; oyColN[_oyKey(oylar[o].nom)] = oylar[o].col; }
      var oyYozildi = false;

      // Batch writes: row → col → value
      var writes = {}; // key: "row,col" → value

      byV[subOb][v].forEach(function(e) {
        if (e.fakt !== undefined && e.fakt !== null) {
          writes[e.row + ',' + col.FAKT] = _toNum(e.fakt);
          jami++;
        }
        if (e.oylar) {
          for (var on in e.oylar) {
            var c = oyCol[on] || oyColN[_oyKey(on)];   // kanonik kalit (regist + "05.2026"↔"5.2026")
            if (!c) continue;
            var ov = e.oylar[on];
            if (ov && typeof ov === 'object') {
              if (ov.obyom !== undefined && ov.obyom !== null) {
                writes[e.row + ',' + c] = _toNum(ov.obyom); jami++; oyYozildi = true;
              }
              if (ov.narx !== undefined && ov.narx !== null && ov.narx !== '') {
                writes[e.row + ',' + (c+1)] = _toNum(ov.narx); jami++; oyYozildi = true;
              }
              // ⚡ 2026-07-05: F2 hujjatdagi TAYYOR СУММА — STATIK yoziladi (formula
              // =ОБЪЁМ×НАРХ o'rniga). Yuridik aniqlik: aktdagi so'mning tiyinigacha
              // aynan qiymat saqlanadi, yaxlitlash farqi yig'ilib katta xatoga aylanmaydi.
              if (ov.summa !== undefined && ov.summa !== null && Number(ov.summa) > 0) {
                writes[e.row + ',' + (c+2)] = _toNum(ov.summa); jami++; oyYozildi = true;
              }
            } else {
              writes[e.row + ',' + c] = _toNum(ov); jami++; oyYozildi = true;
            }
          }
        }
      });

            // Batch yozish: RangeValues/Formulas yordamida tezkor 1 ta API chaqiruv.
      var keys = Object.keys(writes);
      if(keys.length > 0) {
        var minR = 999999, maxR = 0, minC = 999, maxC = 0;
        for(var k=0; k<keys.length; k++){
           var rc = keys[k].split(',');
           var r = parseInt(rc[0]), c = parseInt(rc[1]);
           if(r < minR) minR = r;
           if(r > maxR) maxR = r;
           if(c < minC) minC = c;
           if(c > maxC) maxC = c;
        }
        var rng = sh.getRange(minR, minC, maxR - minR + 1, maxC - minC + 1);
        var vals = rng.getValues();
        var fmls = rng.getFormulas();
        
        for(var i=0; i<vals.length; i++){
          for(var j=0; j<vals[i].length; j++){
            if(fmls[i][j]) vals[i][j] = fmls[i][j];
          }
        }
        
        for(var k=0; k<keys.length; k++){
           var rc = keys[k].split(',');
           var r = parseInt(rc[0]), c = parseInt(rc[1]);
           vals[r - minR][c - minC] = writes[keys[k]];
        }
        
        rng.setValues(vals);
      }

      if (oyYozildi) {
        try {
          var _a = sozAsosiy(), _ls = sh.getLastRow();
          var _st = _a.dataQator > 0 ? _a.dataQator : _autoData(sh);
          if (_ls >= _st) _oyFormulaToldur(sh, _st, _ls);
          _oyYigindiFormulalarYangila(sh);
        } catch(ex) {}
      }
    }
  }

  // 3) BITTA flush — barcha yozuvlar ketgandan keyin
  SpreadsheetApp.flush();

  // 4) Dashboard yangilash va kesh tozalash (saqlashdan keyin)
  for (var subOb in subObjectsSaved) {
    try { serverYozFile(subOb, subObjectsSaved[subOb], sozAsosiy()); } catch(e){}
    _holatInvalidate(subOb);
    if (typeof supabaseObyektPush === 'function') { try { supabaseObyektPush(subOb); } catch(e) {} }
  }
  _holatInvalidate(obyekt);

  if (typeof supabaseTarixYoz === 'function') {
    try { supabaseTarixYoz(obyekt, edits, Session.getActiveUser().getEmail()); } catch(e) {}
  }

  return {ok:true, jami:jami, xabar:'Сақланди: '+jami+' қиймат'};
}

/* Yangi oy ustuni qo'shish.
 * ⚡ 2026-07-04 qayta yozildi: (a) oyNom TRIM qilinadi (F2 saqlashda ustun nomi
 * mos kelmay "hech nima yozilmadi" bo'lishining oldi olinadi); (b) n<1 guard;
 * (c) sub-obyekt yo'lida NECHTA varaqда yaratilganini haqiqiy sanaydi; (d) xato
 * YASHIRILMAYDI — plus topilmasa yoki hech varaqда yozilmasa aniq xabar. */
function apiOyQosh(obyekt, oyNom){
  oyNom = String(oyNom||'').trim();
  if(!oyNom) throw 'Ой номи бўш бўлмасин';
  var subObjects = _subObyektlar(obyekt);   // yagona, normallashtirilgan parent→child aniqlash

  if (subObjects.length > 0) {
    var totalAdded = 0, xatolar = [];
    subObjects.forEach(function(subOb) {
      try {
        var r = apiOyQosh(subOb, oyNom);
        if (r && r.ok) totalAdded += (r.varaqlar||0);
      } catch(e) {
        xatolar.push(subOb+': '+(e.message||e));
        Logger.log('apiOyQosh error for ' + subOb + ': ' + e);
      }
    });
    _holatInvalidate(obyekt);
    return {ok:true, varaqlar:totalAdded,
      xabar:'Ой барча бўлимларга қўшилди: '+oyNom+' ('+totalAdded+' варақ)'+(xatolar.length?(' ⚠ '+xatolar.join('; ')):'')};
  }

  var plus=_plusTop(obyekt);
  if(!plus) throw 'LRV_PLUS топилмади ('+obyekt+') — аввал [Ишла] қилинг';
  var a=sozAsosiy(), col=CFG.C, sheets=plus.getSheets(), qoshildi=0, bordi=0, lrvBor=0;
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    lrvBor++;
    var oylar=_f2Oylar(sh), bor=false;
    var _onU=_oyKey(oyNom);   // kanonik — "05.2026"=="5.2026"=="May 2026"... (dublikat ustun yaratilmasin)
    for(var o=0;o<oylar.length;o++){ if(_oyKey(oylar[o].nom)===_onU){ bor=true; break; } }
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(bor) {
      bordi++;
      // ⚡ 2026-07-05: oy allaqachon bor bo'lsa ham formulalar TA'MIRLANADI —
      // eski oylarda bl qatorlarga НАРХ/СУММА yozilmagan bo'lishi mumkin (F2=0 sababi)
      if(n>=1){ try { _oyFormulaToldur(sh, start, last); } catch(ex){} }
      try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
      continue;
    }
    var hr=_hdrRow(sh);
    if(n<1) continue;   // ma'lumot qatori yo'q varaq — o'tkazamiz
    _oyKollarTikla(sh, [oyNom], hr, start, n);   // har oy 3 ustun (ОБЪЁМ|НАРХ|СУММА)
    try { _oyFormulaToldur(sh, start, last); } catch(ex){}   // boshqa (eski) oylarni ham to'ldiradi
    try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
    qoshildi++;
    
    lrvYoz(obyekt, sh);
  }
  SpreadsheetApp.flush();
  
  if(lrvBor===0) throw 'ЛРВ варақ топилмади ('+obyekt+')';
  return {ok:true, varaqlar:(qoshildi+bordi),
    xabar:'Ой тайёр: '+oyNom+' ('+qoshildi+' та янги, '+bordi+' та аллақачон бор эди)'};
}


/* ============ TASHXIS (DIAGNOSTIKA) ============
 * Bitta obyektni narx/miqdor bo'yicha parchalaydi → 2.5x shishish QAYERDAN
 * kelayotganini ko'rsatadi. Shuningdek 0-narx va topilmagan resurslarni beradi.
 *   - katSum: kategoriya bo'yicha smeta
 *   - top: eng qimmat 40 resurs (absurd narx darhol ko'rinadi)
 *   - fakt: FAKT-override (narx=MAX(svod,fakt)) bilan shishgan summa
 *   - nol: narx=0 lekin hajmi bor (qimmat material 0 muammosi)
 *   - miss: _NARX_LOG dan narx topilmaganlar */
function apiTashxis(obyekt){
  var plus=_plusTop(obyekt); if(!plus) throw 'LRV_PLUS топилмади: '+obyekt;
  var a=sozAsosiy(), col=CFG.C, faktMap=sozFaktNarx();
  var sheets=plus.getSheets();
  var katSum={'ЧЕЛ':0,'МАШ':0,'МАТ':0,'ОБ':0,'М/К':0,'КАБ':0,'?':0};
  var qoshKatSum={'ЧЕЛ':0,'МАШ':0,'МАТ':0,'ОБ':0,'М/К':0,'КАБ':0,'?':0};
  var zamenaKatSum={'ЧЕЛ':0,'МАШ':0,'МАТ':0,'ОБ':0,'М/К':0,'КАБ':0,'?':0};
  var jamiSmeta=0, qoshSmeta=0, zamenaSmeta=0, leaf=0, faktSmeta=0, faktSoni=0;
  var nol=[], top=[];

  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;
    var g=sh.getRange(start,1,n,col.ST_OST).getValues();
    for(var i=0;i<n;i++){
      var mkRaw=String(g[i][col.MARKER-1]||'').trim().toLowerCase();
      // ⚡ fix: qo'shimcha ('+') qatorlar ASL smetadan ALOHIDA hisoblanadi —
      // avval '+' shu yerda tashlanib, qo'shimcha summasi asl smetaga aralashib
      // ketardi (59mlrd o'rniga 64mlrd ko'rinardi). Endi ikkalasi ham qaytariladi:
      // jamiSmeta=faqat asl, qoshSmeta=faqat qo'shimcha.
      var isQosh=/[+~]$/.test(mkRaw), isZamena=/~$/.test(mkRaw), mk=mkRaw.replace(/[+~]$/,'');
      if(mk!=='rs'&&(mk !== 'mat' && mk !== 'ob') ) continue;
      leaf++;
      var nom=String(g[i][col.NOM-1]||'').trim();
      var bir=String(g[i][col.BIRLIK-1]||'').trim();
      var e=_toNum(g[i][col.E-1]), f=_toNum(g[i][col.F-1]);
      var narx=_toNum(g[i][col.NARX-1]);
      var sm=_toNum(g[i][col.ST_RES-1]);   // Z = smeta summa
      // kategoriya — qaysi ustun > 0
      var kat='?';
      if(_toNum(g[i][col.CHEL-1])>0) kat='ЧЕЛ';
      else if(_toNum(g[i][col.MASH-1])>0) kat='МАШ';
      else if(_toNum(g[i][col.OB-1])>0) kat='ОБ';
      else if(_toNum(g[i][col.MK-1])>0) kat='М/К';
      else if(_toNum(g[i][col.MAT-1])>0) kat=(_toNum(g[i][col.KAB-1])>0?'КАБ':'МАТ');
      else if(_toNum(g[i][col.KAB-1])>0) kat='КАБ';
      if(isZamena){
        zamenaSmeta+=sm;
        if(zamenaKatSum[kat]!==undefined) zamenaKatSum[kat]+=sm; else zamenaKatSum['?']+=sm;
      } else if(isQosh){
        qoshSmeta+=sm;
        if(qoshKatSum[kat]!==undefined) qoshKatSum[kat]+=sm; else qoshKatSum['?']+=sm;
      } else {
        jamiSmeta+=sm;
        if(katSum[kat]!==undefined) katSum[kat]+=sm; else katSum['?']+=sm;
      }
      // FAKT-override taxmini: narx ≈ faktMap qiymati (svodkadan oshgan)
      var key=_norm(nom)+'||'+_normBirlik(bir);
      var fv=faktMap[key]||0;
      if(fv!==0 && narx!==0 && Math.abs(narx-fv)<0.01){ faktSmeta+=sm; faktSoni++; }
      // 0-narx lekin hajmi bor
      if(narx===0 && (e!==0||f!==0)) nol.push({nom:nom,birlik:bir,e:e,f:f,kat:kat,varaq:nm,qator:start+i,qosh:isQosh});
      top.push({nom:nom,birlik:bir,e:e,f:f,narx:narx,smeta:sm,kat:kat,varaq:nm,qator:start+i,qosh:isQosh});
    }
  }
  top.sort(function(x,y){return y.smeta-x.smeta;});
  top=top.slice(0,40);

  // Topilmaganlar — _NARX_LOG dan
  var miss=[], logSh=plus.getSheetByName(CFG.NARX_LOG);
  if(logSh && logSh.getLastRow()>1){
    var lv=logSh.getRange(2,1,logSh.getLastRow()-1,8).getValues();
    for(var L=0;L<lv.length;L++){
      var t=String(lv[L][3]||'');
      if(t==='ФОРМАТ') continue;       // diagnostika qatori
      miss.push({varaq:String(lv[L][1]||''),qator:lv[L][2],tur:t,
                 nom:String(lv[L][4]||''),birlik:String(lv[L][5]||''),izoh:String(lv[L][7]||'')});
    }
  }

  return {
    obyekt:obyekt, jamiSmeta:jamiSmeta, leaf:leaf, katSum:katSum,
    qoshSmeta:qoshSmeta, qoshKatSum:qoshKatSum,
    zamenaSmeta:zamenaSmeta, zamenaKatSum:zamenaKatSum,
    faktSmeta:faktSmeta, faktSoni:faktSoni, faktBor:Object.keys(faktMap).length,
    nol:nol, nolSoni:nol.length, top:top,
    miss:miss, missSoni:miss.length,
    narxMantiq:a.narxMantiq
  };
}

/* Faqat topilmaganlar (panel "Топилмаганлар" bo'limi uchun) */
function apiTopilmaganlar(obyekt){
  var t=apiTashxis(obyekt);
  return {obyekt:obyekt, miss:t.miss, missSoni:t.missSoni, nol:t.nol, nolSoni:t.nolSoni};
}

/* ============ SVOD USTUN BELGILASH ============
 * Svodkaning yuqori qatorlarini ko'rsatadi → user qaysi ustun НОМ, qaysi НАРХ
 * ekanini ko'rib belgilaydi (apiBoglashSaqla → svodCols). Har svodka uchun. */
function apiSvodOldindan(obyekt){
  var obs=papkaSkan(), t=null;
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt.trim()===obyekt.trim()){ t=obs[i]; break; }
  if(!t||!t.svodFile) throw 'Свод топилмади: '+obyekt;
  var fmt=_normFormat(t.format||'TN');
  var base=(fmt==='ABC4')?CFG.SVOD_ABC:CFG.SVOD_TN;
  var cur=_svodCfg(t);
  var svodSS=_openAsSheet(t.svodFile, t.folderId);
  var sheets=svodSS.getSheets(), target=null;
  for(var s=0;s<sheets.length;s++){
    if(_skip(sheets[s].getName())) continue;
    if(t.svodSheets&&t.svodSheets.length&&t.svodSheets.indexOf(sheets[s].getName())<0) continue;
    if(sheets[s].getLastRow()>=1){ target=sheets[s]; break; }
  }
  if(!target){ _cleanupTmp(svodSS); throw 'Свод варақ топилмади'; }
  var lastC=Math.min(target.getLastColumn(), 16);
  var lastR=Math.min(target.getLastRow(), 22);
  var data=target.getRange(1,1,lastR,lastC).getValues().map(function(row){
    return row.map(function(x){ return (x===null||x===undefined)?'':x; });
  });
  _cleanupTmp(svodSS);
  return {
    obyekt:obyekt, format:fmt, varaq:target.getName(), ustunSoni:lastC,
    data:data,
    joriy:{nom:cur.NOM, bir:cur.BIRLIK, narx:cur.NARX, blok:cur.BLOK, qty:cur.QTY||0, summa:cur.SUMMA||0},
    qolda:t.svodCols||{nom:0,bir:0,narx:0,blok:0,qty:0,summa:0},
    base:{nom:base.NOM, bir:base.BIRLIK, narx:base.NARX, blok:base.BLOK, qty:base.QTY||0, summa:base.SUMMA||0}
  };
}

/* Svodka ustun xaritasini saqlash (bitta obyekt uchun) — qolganlarini saqlab */
function apiSvodUstunSaqla(obyekt, svodCols){
  var obs=apiPapkaSkan();
  // svod ustunlari SVODKAga tegishli → shu papkadagi BARCHA lokalka (sibling) uchun bir xil yoziladi
  var pairs=obs.map(function(o){
    var bu=(_cfgKalit(o.obyekt)===_cfgKalit(obyekt));
    return {
      obyekt:o.obyekt, lokId:o.lokId||'', lokName:o.lokName||'',
      svodId:o.svodId||'', svodName:o.svodName||'', format:o.format||'TN',
      lokSheets:o.lokSheets||[], svodSheets:o.svodSheets||[],
      svodCols: bu ? svodCols : (o.svodCols||null)
    };
  });
  var r=apiBoglashSaqla(pairs);
  return {ok:true, xabar:_cfgKalit(obyekt)+' (барча локалка): свод устунлари сақланди', skan:r.skan};
}


/* ============ Yordamchilar ============ */
// Ob'ekt o'zgargach (saqlash/Ишла/qo'shish) holat, boss va AI maslahat keshini bekor qilamiz.
function _holatInvalidate(obyekt){
  try{ cacheDel('holat_'+obyekt); cacheDel('boss_'+obyekt); cacheDel('maslahat_'+obyekt); cacheDel('maslahat__dash'); }catch(e){}
  // Supabase: o'zgargan obyektni "dirty" belgilash → soatlik sinx faqat shularni push qiladi
  try{ if(typeof _sbDirty==='function') _sbDirty(obyekt); }catch(e){}
}
function _plusTop(obyekt){
  // 1) Keshlangan skandan plusId → bevosita openById (Drive qidiruvisiz, tez)
  var sk=_keshOlStale('skan');
  if(sk && sk.length){
    for(var i=0;i<sk.length;i++){
      if(sk[i].obyekt!==obyekt) continue;
      if(sk[i].plusId){ try{ return SpreadsheetApp.openById(sk[i].plusId); }catch(e){} }
      if(sk[i].folderId){ try{ return _plusFile(obyekt, sk[i].folderId); }catch(e){} }
      break;
    }
  }
  // 2) Kesh yo'q — Drive skan (zaxira)
  var obs=papkaSkan();
  for(var j=0;j<obs.length;j++) if(obs[j].obyekt===obyekt) return _plusFile(obyekt, obs[j].folderId);
  return null;
}
/* ⚡⚡ 2026-07-09: OY NOMI KANONIK KALITI — solishtirishda ishlatiladi.
 *   Muammo: panel "05.2026" yuboradi, lekin Google Sheets uni RAQAM (5.2026) deb qabul
 *   qilib, header katakda "5.2026" bo'lib qoladi (boshidagi nol yo'qoladi). Natijada
 *   oyCol["05.2026"] topilmasdi → F2 449 qator 0 yozilardi. Kanonik kalit "05.2026" ni
 *   ham, "5.2026" ni ham "5.2026" ga keltiradi; "May 2026"/"MAY 2026" → "MAY 2026". */
function _oyKey(s){
  s = String(s==null?'':s).trim();
  var m = s.match(/^(\d{1,2})\s*[.\/\-]\s*(\d{4})$/);   // "05.2026","5/2026","05-2026"
  if(m) return String(parseInt(m[1],10))+'.'+m[2];       // → "5.2026"
  var m2 = s.match(/^(\d{4})\s*[.\/\-]\s*(\d{1,2})$/);   // "2026.05" (teskari)
  if(m2) return String(parseInt(m2[2],10))+'.'+m2[1];
  return s.toUpperCase();
}
function _f2Oylar(sh){
  var col=CFG.C, first=col.F2_BIRINCHI, lastCol=sh.getLastColumn();
  if(lastCol<first) return [];
  var hr=_hdrRow(sh);
  var hdr=sh.getRange(hr, first, 1, lastCol-first+1).getValues()[0];
  var out=[];
  for(var i=0;i<hdr.length;i++){
    var t=String(hdr[i]||'').trim();
    if(!t) continue;
    // НАРХ/СУММА ustunlari oy EMAS (3-ustunli F2 tizimi) — faqat ОБЪЁМ (oy nomi) ustuni
    if(t.indexOf(_F2_SUF_NARX)>=0 || t.indexOf(_F2_SUF_SUMMA)>=0) continue;
    out.push({col:first+i, nom:t});
  }
  return out;
}
function _hdrRow(sh){
  var a=sozAsosiy(), start=a.dataQator>0?a.dataQator:_autoData(sh);
  return start-1;
}
/* Varaqdagi eski ma'lumotlarni tozalab, yangi yozadi.
 * deleteRows ishlatmaydi — "delete all non-frozen rows" xatosidan saqlanadi. */
function _sheetDataYoz(sh, allData, cols){
  var last = sh.getLastRow();
  // Mavjud data qatorlarini tozalaymiz
  if(last >= 2){
    sh.getRange(2, 1, last-1, cols).clearContent();
  }
  // Yangi ma'lumot yozamiz
  if(allData.length){
    sh.getRange(2, 1, allData.length, cols).setValues(allData);
  }
}

function _sozTaInit(){
  var ss=SpreadsheetApp.getActive();
  if(!ss.getSheetByName(CFG.SOZ)||!ss.getSheetByName(CFG.SOZ_KAT)) sozlamalarYaratSilent();
}

function _progSet(obyekt, stage, message){
  try{
    var p=PropertiesService.getDocumentProperties();
    p.setProperty('PROG::'+obyekt, JSON.stringify({
      obyekt:obyekt,
      stage:String(stage||''),
      message:String(message||''),
      ts:Date.now()
    }));
  }catch(e){}
}
function apiProgressOl(obyekt){
  try{
    var raw=PropertiesService.getDocumentProperties().getProperty('PROG::'+obyekt);
    if(!raw) return {stage:'', message:'', ts:0};
    return JSON.parse(raw);
  }catch(e){
    return {stage:'', message:'', ts:0};
  }
}


/* ============ DARAJAT (IERARXIYA) API ============
 * РАЗДЕЛЛАР varag' formati (7 ustun):
 *   A=ОБЪЕКТ  B=RZ НОМ  C=Д-1  D=Д-2  E=Д-3  F=Д-4  G=Д-5
 *
 * apiRazdelShYasat  — LRV_PLUS dan bo'sh bo'lmagan RZ larni yig'ib,
 *                     РАЗДЕЛЛАР ga yozadi (mavjud Д qiymatlarni saqlaydi)
 * apiDarajalarOl    — РАЗДЕЛЛАР dan [{rzNom,d1..d5}] qaytaradi
 * apiDarajalarSaqla — panel redaktoridan saqlash
 ============================================================*/

/* РАЗДЕЛЛАР ni to'ldirish: FAQAT YANGI RZ lar qo'shiladi.
 * Mavjud qatorlar (D1-D5 yozilgan yoki bo'sh) HECH QACHON o'zgartirilmaydi.
 * Bu funksiya xavfsiz — qayta-qayta chaqirsa ham ma'lumot yo'qolmaydi. */
function apiRazdelShYasat(obyekt){
  // ⚡⚡⚡ 2026-07-10 TUZATILDI: ko'p smetali (jamlangan/split) obyektlarda RZ lar
  //   UMUMAN yig'ilmasdi — bu funksiya faqat _plusTop(obyekt) (BITTA fayl) o'qirdi,
  //   split obyektning haqiqiy LRV fayllari esa sub-obyekt nomlari ostida (masalan
  //   "GAME CLUB - Локал1"). Endi boshqa API'lar (apiOyQosh, apiHolatSaqla, apiTashxis)
  //   bilan BIR XIL qoida: _subObyektlar(obyekt) bo'yicha HAMMA fayl skan qilinadi,
  //   yagona (ota obyekt nomi ostidagi) РАЗДЕЛЛАР reestrga yoziladi.
  var subObjects=_subObyektlar(obyekt);
  var targets = subObjects.length ? subObjects : [obyekt];

  // 1. Barcha (bitta yoki har bir sub-obyekt) LRV_PLUS fayldan RZ nomlarini yig'amiz
  var a=sozAsosiy(), col=CFG.C;
  var rzSet={}, rzOrder=[], foundAny=false;
  for(var t=0;t<targets.length;t++){
    var plus=_plusTop(targets[t]);
    if(!plus) continue;
    foundAny=true;
    var sheets=plus.getSheets();
    for(var s=0;s<sheets.length;s++){
      var sh=sheets[s];
      if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
      var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
      if(n<1) continue;
      var g=sh.getRange(start,1,n,col.MARKER).getValues();
      var curRz='', curHas=false;
      for(var i=0;i<n;i++){
        var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
        if(mk==='rz'){
          var rzNom='';
          for(var c=0;c<8;c++){
            var cv=String(g[i][c]||'').trim();
            if(cv && /[А-ЯЁA-Za-zА-яёa-z]/.test(cv)){ rzNom=cv; break; }
          }
          if(curRz && curHas && !rzSet[curRz]){ rzSet[curRz]=true; rzOrder.push(curRz); }
          curRz=rzNom; curHas=false;
        } else if(mk==='bl'||(mk === 'mat' || mk === 'ob') ){ curHas=true; }
      }
      if(curRz && curHas && !rzSet[curRz]){ rzSet[curRz]=true; rzOrder.push(curRz); }
    }
  }
  if(!foundAny) return {ok:false, xabar:'LRV_PLUS топилмади'};

  // 2. РАЗДЕЛЛАР varaqini tayyor qilamiz
  var ss=SpreadsheetApp.getActive();
  var dsh=ss.getSheetByName(CFG.RAZDEL_SH);
  if(!dsh){
    dsh=ss.insertSheet(CFG.RAZDEL_SH);
    dsh.getRange(1,1,1,7).setValues([['ОБЪЕКТ','RZ НОМ','Д-1','Д-2','Д-3','Д-4 (авто)','Д-5 (авто)']])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    dsh.setColumnWidth(1,130); dsh.setColumnWidth(2,380);
    dsh.setColumnWidth(3,120); dsh.setColumnWidth(4,120); dsh.setColumnWidth(5,120);
    dsh.setColumnWidth(6,160); dsh.setColumnWidth(7,160);
    dsh.setFrozenRows(1);
  }

  // 3. Shu obyektda allaqachon bor RZ nomlarini aniqlaymiz
  var existNames={};
  if(dsh.getLastRow()>=2){
    var ev=dsh.getRange(2,1,dsh.getLastRow()-1,2).getValues();
    for(var i=0;i<ev.length;i++){
      var eob=String(ev[i][0]||'').trim(), ern=String(ev[i][1]||'').trim();
      if(eob===obyekt && ern) existNames[ern]=true;
    }
  }

  // 4. FAQAT yangi RZ larni qo'shamiz (mavjud qatorlarga TEGMAYMIZ)
  var newRows=[];
  rzOrder.forEach(function(rzNom){
    if(!existNames[rzNom]) newRows.push([obyekt, rzNom, '', '', '', '', '']);
  });
  if(newRows.length){
    var appendFrom=dsh.getLastRow()+1;
    dsh.getRange(appendFrom,1,newRows.length,7).setValues(newRows)
      .setBackground('#eef4ff');
    dsh.getRange(appendFrom,1,newRows.length,2).setBackground('#dde8f8');
  }

  dsh.showSheet();
  return {ok:true, xabar:rzOrder.length+' RZ ('+newRows.length+' yangi qo\'shildi)'};
}

/* РАЗДЕЛЛАР varag'ini yasab, fon varaqni ochib (aktiv qilib) qaytaradi.
 * Panel "РАЗДЕЛЛАР варағини очиш" tugmasi shuni chaqiradi. */
function apiRazdellarShYasaVaOch(obyekt){
  var r=apiRazdelShYasat(obyekt);
  try{
    var sh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
    if(sh){ sh.showSheet(); SpreadsheetApp.getActive().setActiveSheet(sh); }
  }catch(e){}
  return (r && r.xabar) ? r.xabar : 'РАЗДЕЛЛАР тайёр';
}

/* ============================================================
 * D1-D5 → LRV_PLUS QAVAT ustunlariga yozish
 * РАЗДЕЛЛАР da saqlangan D1-D5 qiymatlarini LRV_PLUS dagi
 * tegishli RZ + uning barcha bl/rs/mat qatorlariga qo'yadi.
 *   D1 → QAVAT1 (U=21)
 *   D2 → QAVAT2 (V=22)
 *   D3 → QAVAT3 (W=23)
 *   D4 → H_BL   (X=24) — vid rabot uchun
 *   D5 → H_RAZDEL (Y=25)
 * ============================================================ */
function apiDarajalarLrvGaYoz(obyekt){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
  if(!sh||sh.getLastRow()<2) return {ok:false, xabar:'РАЗДЕЛЛАР yo\'q'};

  // Shu obyektning D1-D5 map: {rzNom → [d1,d2,d3,d4,d5]}
  var rzMap={};
  var dv=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
  for(var i=0;i<dv.length;i++){
    if(String(dv[i][0]||'').trim()!==obyekt) continue;
    var rn=String(dv[i][1]||'').trim();
    if(rn) rzMap[rn]=[dv[i][2]||'',dv[i][3]||'',dv[i][4]||'',dv[i][5]||'',dv[i][6]||''];
  }
  if(!Object.keys(rzMap).length) return {ok:false, xabar:'Bu obyekt uchun РАЗДЕЛЛАР ma\'lumoti yo\'q'};

  // ⚡⚡⚡ 2026-07-10 TUZATILDI: apiRazdelShYasat bilan BIR XIL sabab — split (ko'p
  //   smetali) obyektlarda LRV_PLUS fayllari sub-obyekt nomlari ostida bo'lgani uchun
  //   _plusTop(obyekt) (parent nomi) hech narsa topmasdi. Endi HAR bir sub-obyekt
  //   fayliga (yoki yagona bo'lsa o'ziga) yoziladi — rzMap barchasi uchun umumiy.
  var subObjects=_subObyektlar(obyekt);
  var targets = subObjects.length ? subObjects : [obyekt];
  var col=CFG.C, a=sozAsosiy(), totalW=0, filesFound=0;

  for(var t=0;t<targets.length;t++){
    var plus=_plusTop(targets[t]);
    if(!plus) continue;
    filesFound++;
    var sheets=plus.getSheets();

    for(var s=0;s<sheets.length;s++){
      var lsh=sheets[s];
      if(lsh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
      var last=lsh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(lsh);
      if(last<start) continue;
      var n=last-start+1;

      // col.QAVAT3 = W = 23 — U dan W gacha o'qish (QAVAT1,2,3 + H_BL + H_RAZDEL)
      var maxC=col.H_RAZDEL; // 25
      var v=lsh.getRange(start,1,n,maxC).getValues();

      // Batch update uchun output array
      var qOut=[];
      var curD=['','','','',''];

      for(var i=0;i<n;i++){
        var mk=String(v[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
        if(mk==='rz'){
          var rzNom='';
          for(var c=0;c<8;c++){
            var cv=String(v[i][c]||'').trim();
            if(cv && /[А-ЯЁA-Za-zА-яёa-z]/.test(cv)){ rzNom=cv; break; }
          }
          curD=rzMap[rzNom]||['','','','',''];
        }
        // D1-D3 → QAVAT1-3
        // H_BL (X) va H_RAZDEL (Y) — LRV dagi mavjud qiymatlarni SAQLAYMIZ
        // (D4/D5 auto: ishlash vaqtida to'ldiriladi, manual emas)
        qOut.push([
          curD[0],              // QAVAT1 ← D1
          curD[1],              // QAVAT2 ← D2
          curD[2],              // QAVAT3 ← D3
          v[i][col.H_BL-1],    // H_BL — asl LRV qiymati (bl nomi)
          v[i][col.H_RAZDEL-1] // H_RAZDEL — asl LRV qiymati (rz nomi)
        ]);
      }

      // Batch yozish: QAVAT1(U) dan H_RAZDEL(Y) gacha = 5 ustun
      lsh.getRange(start, col.QAVAT1, n, 5).setValues(qOut);
      totalW+=n;
    }
  }
  if(!filesFound) return {ok:false, xabar:'LRV_PLUS topilmadi'};

  SpreadsheetApp.flush();
  return {ok:true, xabar:totalW+' qator yangilandi ('+Object.keys(rzMap).length+' RZ, '+filesFound+' файл)'};
}


/* РАЗДЕЛЛАР dan darajalar: [{rzNom, d1, d2, d3, d4, d5}] */
function apiDarajalarOl(obyekt){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
  if(!sh||sh.getLastRow()<2) return [];
  var v=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
  var result=[];
  for(var i=0;i<v.length;i++){
    if(String(v[i][0]||'').trim()!==obyekt) continue;
    var rzNom=String(v[i][1]||'').trim();
    if(!rzNom) continue;
    result.push({
      rzNom:rzNom,
      d1:String(v[i][2]||'').trim(),
      d2:String(v[i][3]||'').trim(),
      d3:String(v[i][4]||'').trim(),
      d4:String(v[i][5]||'').trim(),
      d5:String(v[i][6]||'').trim()
    });
  }
  return result;
}

/* Panel redaktoridan D1-D5 ni saqlash
 * rows = [{obyekt, rzNom, d1..d5}] */
function apiDarajalarSaqla(rows){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.RAZDEL_SH);
  if(!sh) return apiRazdelShYasat((rows&&rows[0])?rows[0].obyekt:'');

  // Boshqa obyektlar saqlanadi, bu obyekt almashtiriladi
  var updObs={};
  (rows||[]).forEach(function(r){ if(r.obyekt) updObs[r.obyekt]=true; });

  var keep=[];
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,7).getValues();
    for(var i=0;i<v.length;i++){
      var ob=String(v[i][0]||'').trim();
      if(ob && !updObs[ob]) keep.push(v[i]);
    }
  }

  var newRows=(rows||[]).map(function(r){
    return [r.obyekt||'', r.rzNom||'', r.d1||'', r.d2||'', r.d3||'', r.d4||'', r.d5||''];
  });

  var allData=keep.concat(newRows);
  _sheetDataYoz(sh, allData, 7);
  if(newRows.length){
    var startR=keep.length+2;
    sh.getRange(startR,1,newRows.length,7).setBackground('#eef4ff');
    sh.getRange(startR,1,newRows.length,2).setBackground('#dde8f8');
  }

  // D1-D5 ni LRV_PLUS ga avtomatik yozish
  var lrvNat={};
  Object.keys(updObs).forEach(function(ob){
    try{ lrvNat[ob]=apiDarajalarLrvGaYoz(ob); }catch(e){ lrvNat[ob]={ok:false,xabar:String(e)}; }
  });

  var lrvXabar=Object.keys(lrvNat).map(function(ob){
    return ob+': '+(lrvNat[ob].ok?lrvNat[ob].xabar:'❌ '+lrvNat[ob].xabar);
  }).join('; ');

  return 'Сақланди: '+newRows.length+' RZ → LRV: '+lrvXabar;
}

/* API: Keshni isitish (warm-up) */
function apiKeshWarmUp() {
  if (typeof _keshWarmUp === 'function') {
    _keshWarmUp();
    return {ok: true, xabar: 'Kesh muvaffaqiyatli isitildi (warm-up tugadi)'};
  }
  return {ok: false, xabar: 'Kesh isitish funksiyasi topilmadi'};
}

/* API: Triggerlar ro'yxatini olish */
function apiTriggerlarRoyxat() {
  if (typeof triggerlarRoyxat === 'function') {
    return {ok: true, triggerlar: triggerlarRoyxat()};
  }
  var trs = ScriptApp.getProjectTriggers();
  var out = trs.map(function(t){ return t.getHandlerFunction() + ' (' + t.getEventType() + ')'; });
  return {ok: true, triggerlar: out};
}

/* =========================================================================
 * F2 DUAL-PANE IMPORTER APIS
 * ========================================================================= */

function apiF2FayllarOl(obyekt) {
  var sk = typeof _keshOlStale === 'function' ? (_keshOlStale('skan') || []) : [];
  var folderId = '';
  for (var i = 0; i < sk.length; i++) {
    if (sk[i].obyekt === obyekt || obyekt.indexOf(sk[i].obyekt) === 0) { folderId = sk[i].folderId; break; }
  }
  if (!folderId) {
    try {
      var files = DriveApp.searchFiles("(title contains 'F2' or title contains 'Ф2' or title contains 'f2' or title contains 'F-2') and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel') and trashed=false");
      var res = [];
      var limit = 30;
      while(files.hasNext() && res.length < limit) {
         var f = files.next();
         res.push({id: f.getId(), name: f.getName()});
      }
      return {ok: true, fayllar: res, xabar: 'Объект папкаси кэшда топилмади, умумий қидирилди'};
    } catch(e) {
      return {ok: false, fayllar: [], xabar: 'Папкаси топилмади'};
    }
  }
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var res = [];
    var allowed = [MimeType.GOOGLE_SHEETS, MimeType.MICROSOFT_EXCEL, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    
    // Recursive folder scanning (max 3 levels deep)
    function scanFol(fol, depth) {
      if (depth > 3) return;
      var files = fol.getFiles();
      while (files.hasNext()) {
        var f = files.next();
        var mime = f.getMimeType();
        var name = f.getName();
        var nameLower = name.toLowerCase();
        var isSpreadsheet = allowed.indexOf(mime) >= 0 || 
                           nameLower.endsWith('.xlsx') || 
                           nameLower.endsWith('.xls') || 
                           nameLower.endsWith('.xlsm') || 
                           nameLower.endsWith('.csv') ||
                           mime === MimeType.GOOGLE_SHEETS;
                           
        if (isSpreadsheet && name.indexOf('_LRV_PLUS') === -1 && name.indexOf('_TMP_') === -1 && name.indexOf('_NAT_') === -1) {
          var exists = res.some(function(item) { return item.id === f.getId(); });
          if (!exists) {
            res.push({id: f.getId(), name: name, url: f.getUrl()});
          }
        }
      }
      
      var subFolders = fol.getFolders();
      while (subFolders.hasNext()) {
        scanFol(subFolders.next(), depth + 1);
      }
    }
    
    // Find completions folders recursively (max 3 levels deep)
    var f2Folders = [];
    function findF2Folders(fol, depth) {
      if (depth > 3) return;
      var subFolders = fol.getFolders();
      while (subFolders.hasNext()) {
        var sub = subFolders.next();
        var n = sub.getName().toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
        var matches = n.indexOf('F2') >= 0 || 
                      n.indexOf('Ф2') >= 0 || 
                      n.indexOf('AKT') >= 0 || 
                      n.indexOf('АКТ') >= 0 || 
                      n.indexOf('FAKT') >= 0 || 
                      n.indexOf('ФАКТ') >= 0 || 
                      n.indexOf('VYPOLN') >= 0 || 
                      n.indexOf('ВЫПОЛН') >= 0;
        if (matches) {
          f2Folders.push(sub);
        } else {
          findF2Folders(sub, depth + 1);
        }
      }
    }
    findF2Folders(folder, 1);
    
    if (f2Folders.length > 0) {
       f2Folders.forEach(function(sub) {
          scanFol(sub, 1);
       });
    } else {
       scanFol(folder, 1); // default main folder recursively (up to 3 levels)
    }
    
    return {ok: true, fayllar: res};
  } catch(e) {
    return {ok: false, xabar: String(e)};
  }
}

function apiF2FaylYukla(obyekt, base64, mimeType, filename, oyNom) {
  var sk = typeof _keshOlStale === 'function' ? (_keshOlStale('skan') || []) : [];
  var folderId = '';
  for (var i = 0; i < sk.length; i++) {
    if (sk[i].obyekt === obyekt || obyekt.indexOf(sk[i].obyekt) === 0) { folderId = sk[i].folderId; break; }
  }
  if (!folderId) return {ok: false, xabar: 'Объект папкаси топилмади'};
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    
    // F2 papkasini topish yoki yaratish
    var f2Folder = null;
    var subF2 = folder.getFolders();
    while(subF2.hasNext()) {
      var sub = subF2.next();
      var n = sub.getName().toUpperCase();
      if(n === 'F2' || n === 'Ф2') { f2Folder = sub; break; }
    }
    if(!f2Folder) f2Folder = folder.createFolder('F2');
    
    // Yangi nomni yasash
    var ext = filename.indexOf('.') > 0 ? filename.substr(filename.lastIndexOf('.')) : '';
    var expectedName = obyekt + ' F2 ' + (oyNom||'');
    var finalFilename = expectedName + ext;
    
    // Dublikatlarni o'chirish
    var dFiles = f2Folder.getFiles();
    while(dFiles.hasNext()) {
       var d = dFiles.next();
       var dName = d.getName();
       if(dName === finalFilename || dName === expectedName || dName.indexOf(expectedName) === 0) {
          try { d.setTrashed(true); } catch(e){} 
       }
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, finalFilename);
    var file = f2Folder.createFile(blob);
    
    try {
       // Auto-convert to Google Sheets
       var resource = {
         title: expectedName,
         mimeType: MimeType.GOOGLE_SHEETS,
         parents: [{id: f2Folder.getId()}]
       };
       var converted = Drive.Files.copy(resource, file.getId());
       file.setTrashed(true); // Remove original Excel
       return {ok: true, fileId: converted.id, name: converted.title};
    } catch(e) {
       Logger.log("Drive API conversion failed: " + e);
       return {ok: true, fileId: file.getId(), name: file.getName(), warn: 'GS форматга ўгирилмади'};
    }
  } catch(err) {
    return {ok: false, xabar: String(err)};
  }
}

function apiF2VaraklarOl(fileId) {
   try {
     var ss = SpreadsheetApp.openById(fileId);
     var sheets = ss.getSheets();
     var res = [];
     for(var i=0; i<sheets.length; i++) res.push(sheets[i].getName());
     return {ok: true, varaqlar: res};
   } catch(e) {
     return {ok: false, xabar: 'Файлни очиб бўлмади (GS форматидами?): ' + String(e)};
   }
}

function apiF2FaylOqi(fileId, varaqName, colConfig) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(fileId);
  } catch (e) {
    return {ok: false, xabar: 'Excel файлни ўқиб бўлмади. Илтимос, файлни Google Sheets форматида сақланг. (' + String(e) + ')'};
  }
  
  var sh = varaqName ? ss.getSheetByName(varaqName) : ss.getSheets()[0];
  if(!sh) return {ok: false, xabar: "Варақ топилмади"};
  var data = sh.getDataRange().getValues();
  if(data.length === 0) return {ok: true, tree: []};
  
  // ⚡⚡⚡ 2026-07-05 QAYTA YOZILDI (foydalanuvchi ANIQ spec berdi — F2 varaq LRV_PLUS
  //   bilan BIR XIL struktura):
  //     B=ШИФР  C=НОМ  D=БИРЛИК  E=НОРМА/ОБЪЁМ  F=ОБЪЁМ  G=НАРХ  H=СУММА
  //   • rs (resurs)  → E=НОРМА (расход), F=ОБЪЁМ (то'la)
  //   • mat/ob/bl    → E=ОБЪЁМ,  F=БЎШ
  //   Demak HAQIQIY OBYOM = F(to'la bo'lsa) YOKI E(F bo'sh bo'lsa). ⚠️ Avvalgi kod E'ni
  //   HAR DOIM hajm deb o'qigani uchun rs qatorlarda NORMA'ni obyom deb yozib, F2 summa
  //   0/xato chiqardi. Endi F-or-E qoidasi.
  var cKod, cNom, cBir, cNorma, cObyom, cNarx, cSum;

  // Marker (I ustun) bor bo'lsa — bonus (tip 100% aniq); bo'lmasa F-bo'shligi qoidasi
  var lrvMk = 0;
  for(var li=0; li<Math.min(400, data.length); li++){
     if(data[li].length < 9) continue;
     var m9 = String(data[li][8]||'').trim().toLowerCase().replace(/[+~]$/,'');
     if(m9==='rz'||m9==='bl'||m9==='rs'||m9==='mat'||m9==='ob') lrvMk++;
  }
  var hasMarker = lrvMk >= 3;

  if(colConfig) {
     cKod=parseInt(colConfig.kod); cNom=parseInt(colConfig.nom); cBir=parseInt(colConfig.bir);
     cNorma=parseInt(colConfig.norma); cObyom=parseInt(colConfig.obyom);
     cNarx=parseInt(colConfig.narx); cSum=parseInt(colConfig.sum);
     [ 'cKod','cNom','cBir','cNorma','cObyom','cNarx','cSum' ].forEach(function(){});
     if(isNaN(cKod)) cKod=-1; if(isNaN(cNom)) cNom=-1; if(isNaN(cBir)) cBir=-1;
     if(isNaN(cNorma)) cNorma=-1; if(isNaN(cObyom)) cObyom=-1;
     if(isNaN(cNarx)) cNarx=-1; if(isNaN(cSum)) cSum=-1;
  } else {
     // Default — foydalanuvchi spec (B/C/D/E/F/G/H). + XOM KO'RINISH (preview) qaytaramiz:
     // foydalanuvchi (va Claude) aynan qaysi ustunda nima turishini VIZUAL tekshiradi.
     cKod=1; cNom=2; cBir=3; cNorma=4; cObyom=5; cNarx=6; cSum=7;
     var preview = [];
     for(var pi=0; pi<data.length && preview.length<28; pi++){
        var rowArr = data[pi] || [];
        var cells = [];
        for(var cc=0; cc<Math.min(10, rowArr.length); cc++) cells.push(String(rowArr[cc]==null?'':rowArr[cc]));
        if(cells.join('').trim()==='') continue;
        preview.push({r: pi+1, cells: cells, mk: (rowArr.length>=9?String(rowArr[8]||''):'')});
     }
     return {ok:true, mode:'config', hasMarker:hasMarker,
        cols:{kod:cKod, nom:cNom, bir:cBir, norma:cNorma, obyom:cObyom, narx:cNarx, sum:cSum},
        maxCol:(data[0]||[]).length, preview:preview};
  }

  // Xom qiymatni son + bo'shlik holatida qaytaradi
  function _cellNum(rowArr, idx){
     if(idx<0 || !rowArr) return {v:0, empty:true};
     var raw = String(rowArr[idx]==null?'':rowArr[idx]).trim();
     if(raw==='') return {v:0, empty:true};
     var n = parseFloat(raw.replace(/\s/g,'').replace(',', '.'));
     return {v: isNaN(n)?0:n, empty:false};
  }
  
  // ⚡⚡⚡ CRITICAL FIX: rz (razdel) tugunlariga UID umuman berilmagan edi (faqat
  // bl/rs/mat/ob larga). Panel.html drawF2Node: cId='f2cc_'+node.uid — barcha rz
  // uchun node.uid===undefined bo'lgani sabab HAMMASI bir xil id="f2cc_undefined"
  // olgan edi! Shu sabab F2 Импортда istalgan razdelni bossa — DOIM birinchi
  // (DOMdagi eng yuqori) razdel ochilib/yopilib qolardi (getElementById faqat
  // birinchi mos idni topadi). Endi har bir rz ham noyob uid oladi.
  var result = [];
  var _rzSeq = 0;
  var currentRz = {type: 'rz', uid: 'f2rz_'+(_rzSeq++), nom: 'Асосий бўлим', children: []};
  result.push(currentRz);
  var currentBl = null;

  for(var i=0; i<data.length; i++) {
     var kod = cKod>=0 ? String(data[i][cKod]||'').trim() : '';
     var nom = cNom>=0 ? String(data[i][cNom]||'').trim() : '';
     var bir = cBir>=0 ? String(data[i][cBir]||'').trim() : '';
     var normaC = _cellNum(data[i], cNorma);   // E ustuni
     var obyomC = _cellNum(data[i], cObyom);   // F ustuni
     var narx   = _cellNum(data[i], cNarx).v;  // G ustuni
     var summa  = _cellNum(data[i], cSum).v;   // H ustuni — TAYYOR summa (statik ko'chiriladi)

     // ⚡ HAQIQIY OBYOM: F(to'la) yoki E(F bo'sh). NORMA faqat rs (F to'la) qatorda mavjud.
     var fEmpty = obyomC.empty;
     var volume = fEmpty ? normaC.v : obyomC.v;
     var norma  = fEmpty ? 0 : normaC.v;

     var nomU = nom.toUpperCase();
     // Yig'indi / podval qatorlari — daraxtga qo'shilmaydi
     if(/^(ИТОГО|ВСЕГО|ЖАМИ|ПОДЫТОГ|СУММА\sПО|ВСЕГО\sПО|ОБЩАЯ)/.test(nomU)) continue;

     // ── TIP: marker bor bo'lsa undan, aks holda F-bo'shligi qoidasidan ──
     var mk9 = (hasMarker && data[i].length>=9) ? String(data[i][8]||'').trim().toLowerCase().replace(/[+~]$/,'') : '';

     // RAZDEL: marker rz YOKI (nom bor, birlik yo'q, obyom/norma yo'q — sof sarlavha)
     var isRz = (mk9==='rz');
     if(!mk9 && nom && nom.length>2){
        var nomL = nom.toLowerCase();
        if(nomL.indexOf('раздел')===0 || nomL.indexOf('бўлим')===0 || nomL.indexOf('булим')===0 || nomL.indexOf('глава')===0) isRz = true;
        else if(!bir && normaC.empty && obyomC.empty && !( /\d/.test(kod) )) isRz = true;
     }
     if(isRz){
        var rzNom = nom;
        if(!rzNom){ for(var rc=0; rc<8; rc++){ var rv=String(data[i][rc]||'').trim(); if(rv && /[А-ЯЁA-Za-z]/.test(rv)){ rzNom=rv; break; } } }
        currentRz = {type:'rz', uid:'f2rz_'+(_rzSeq++), nom:rzNom||('Раздел '+_rzSeq), children:[]};
        result.push(currentRz); currentBl=null; continue;
     }

     // Ma'noli qator emas (nom yo'q yoki obyom yo'q) — o'tkazamiz
     if(!nom || volume<=0) continue;

     // ── TIP ANIQLASH ──
     var nType;
     if(mk9==='bl'||mk9==='rs'||mk9==='mat'||mk9==='ob'){
        nType = mk9;
     } else if(!fEmpty){
        nType = 'rs';   // F(ОБЪЁМ) to'la → resurs (E da norma)
     } else {
        // F bo'sh → bl (ish turi) yoki mat/ob (material/uskuna). ЗАТРАТЫ ТРУДА yoki
        // keyingi ma'noli qatorda F to'la (rs bola) bo'lsa → bu bl; aks holda mat/ob.
        var nextIsRs = false;
        for(var j=i+1; j<data.length; j++){
           var jNom = cNom>=0 ? String(data[j][cNom]||'').trim() : '';
           var jOb  = cObyom>=0 ? String(data[j][cObyom]==null?'':data[j][cObyom]).trim() : '';
           var jNr  = cNorma>=0 ? String(data[j][cNorma]==null?'':data[j][cNorma]).trim() : '';
           if(!jNom && !jOb && !jNr) continue;
           nextIsRs = (jOb!=='');   // keyingi qatorda F to'la → rs bola
           break;
        }
        if(nextIsRs || nomU.indexOf('ЗАТРАТЫ ТРУДА')>=0) nType='bl';
        else if(nomU.indexOf('ОБОРУДОВАН')>=0 || currentRz.nom.toUpperCase().indexOf('ОБОРУДОВАН')>=0) nType='ob';
        else nType='mat';
     }

     var node = {uid:'f2_'+i, type:nType, kod:kod, nom:nom, bir:bir,
        hajm:volume, norma:norma, narx:narx, summa:summa, children:[]};

     if(nType==='bl'){ currentBl=node; currentRz.children.push(node); }
     else if(nType==='rs'){ if(currentBl) currentBl.children.push(node); else currentRz.children.push(node); }
     else { currentRz.children.push(node); currentBl=null; }
  }

  // Bo'sh razdellarni tozalash (bola olmagan)
  result = result.filter(function(n){ return !(n.type==='rz' && (!n.children||!n.children.length)); });
  return {ok: true, tree: result};
}

function apiF2Qolla(obyekt, oyNom, edits, dopps) {
  var a = sozAsosiy();
  oyNom = String(oyNom||'').trim();
  if(!oyNom) return {ok:false, xabar:'Ой номи бўш — сақланмади'};
  edits = edits || []; dopps = dopps || [];

  _f2LogTozala();
  _setF2Prog('🚀 Бошланди: '+obyekt+' / '+oyNom+' — '+edits.length+' мослаштирилган, '+dopps.length+' қўшимча');

  // ⚡ 1-QADAM: ОЙ УСТУНИ ЯРАТИШ (мослик учун trim қилинган ном билан). Агар яратилмаса
  // (LRV yo'q, ЛРВ варақ yo'q) — АНИҚ хато қайтарамиз (аввал жимгина ўтиб, кейин
  // apiHolatSaqla ustunni topolmay HAMMANI ташлаб "hech nima yozilmadi" бўларди).
  _setF2Prog('1/3: Ой устуни текширилмоқда/яратилмоқда — '+oyNom);
  try {
     apiOyQosh(obyekt, oyNom);
  } catch(e) {
     _setF2Prog('❌ Ой устуни яратилмади: '+(e.message||e));
     return {ok:false, xabar:'❌ Ой устуни яратилмади: '+(e.message||e)+'. LRV_PLUS борлигини ва [Ишла] қилинганини текширинг.'};
  }

  var col = CFG.C;
  var mappedYoz = 0, dopsYoz = 0;

  // 2-QADAM: МОСЛАШТИРИЛГАН (mapped) қаторларга ой ҳажм/нарх ёзиш.
  //   narx>0 bo'lsagina НАРХ yoziladi (0/yo'q → smeta narxi formula bo'yicha qoladi).
  var holatEdits = [];
  for(var i=0; i<edits.length; i++) {
     var e = edits[i];
     if(!e || !e.varaq || !e.row) continue;
     // ⚡ _oyObj: narx faqat >0 bo'lsa (aks holda 0 yozilib smeta-narx formulani buzardi);
     // e.summa — F2 hujjatdagi TAYYOR summa (bo'lsa) STATIK yoziladi (yaxlitlash farqisiz)
     holatEdits.push({varaq: e.varaq, row: e.row, oylar: _oyObj(oyNom, e.hajm, e.narx, e.summa)});
  }
  _setF2Prog('2/3: Мослаштирилган '+holatEdits.length+' қатор ёзилмоқда...');
  if(holatEdits.length > 0) {
     var r = apiHolatSaqla(obyekt, holatEdits);
     mappedYoz = r.jami || 0;
     _setF2Prog('✓ Мослаштирилган ёзилди: '+mappedYoz+' қиймат');
  }

  _setF2Prog('3/3: Қўшимча/замена ишлар ёзилмоқда ('+dopps.length+')...');
  // 3-QADAM: ҚЎШИМЧА (Dopps) — смэтада ЙЎҚ, фойдаланувчи танлаган РАЗДЕЛ ичига қўшилади.
  //   ⚡ MUHIM: targetRow bo'yicha DESC (пастдан-юқорига) — юқоридаги insert пастдагини
  //   силжитмайди. Ҳар dop insert қилингач, ой ҳажми ДАРҲОЛ (шу итерацияда) ёзилади —
  //   аввал ҳамма dopEdits охирида йиғилиб ёзиларди, лекин у пайтга қаторлар силжиб,
  //   ЭСКИ қаторга (нотўғри жой) ёзиларди → "hech nima yozilmadi/xato" сабабларидан бири.
  // ⚡⚡⚡ 2026-07-05 KRITIK TUZATISH: `doppHolatEdits` HECH QAYERDA e'lon qilinmagan edi —
  // pastdagi har bir `doppHolatEdits.push(...)` ReferenceError bilan yiqilardi (ichki
  // try/catch uni dopXato'ga yozib "yutib" yuborardi), NATIJADA: (a) zamena/qo'shimcha
  // bl+ yaratilgach uning rs+ BOLALARI hech qachon qo'shilmasdi (children sikli xatodan
  // KEYIN turgani uchun yetib bormasdi — "zamenani resurslari yo'q" shikoyati SHU EDI);
  // (b) F2 oy ustuniga hajm/narx UMUMAN yozilmasdi (F2=0 qolishi shu yerdan); (c) `dopps`
  // bo'sh bo'lsa ham 2642-qator (`doppHolatEdits.length`) shart tashqarisida chaqirilib,
  // BUTUN funksiya CRASH bo'lardi — demak F2 "Qo'llash" har safar yiqilib kelgan.
  var dopXato = [];
  if(dopps && dopps.length > 0) {
     for(var i=0; i<dopps.length; i++) dopps[i]._idx = i;
     dopps.sort(function(a,b){
        if((b.targetRow||0) !== (a.targetRow||0)) return (b.targetRow||0) - (a.targetRow||0);
        return a._idx - b._idx;
     });

     // ⚡⚡⚡ 2026-07-05 ZAMENA SURILISHI TUZATILDI: avval oy qiymatlari doppHolatEdits'ga
     // YIG'ILIB, OXIRIDA apiHolatSaqla bilan yozilardi. Lekin dopps DESC tartibda —
     // pastdagi (kichik targetRow) insert YUQORIDAGI (avval yozilgan) qatorlarni pastga
     // suradi → yig'ilgan qator RAQAMLARI eskirib, qiymat 2 qator NOTO'G'RI joyga tushardi
     // (foydalanuvchi "zamena 2 qator tepaga surildi" shikoyati). YECHIM: har dopp
     // qiymatini DARHOL (shu iteratsiyada, insert qilingach) TO'G'RIDAN-TO'G'RI yozamiz —
     // keyingi insert bu qatorni suradi, lekin YOZILGAN qiymat kontenti bilan birga siljiydi.
     var _plusFon = _plusTop(obyekt);
     var _oyColCache = {};   // varaq → oyNom ustuni (c); c/c+1/c+2 = ОБЪЁМ/НАРХ/СУММА
     function _oyColOl(varaq){
        if(_oyColCache[varaq] !== undefined) return _oyColCache[varaq];
        var c = 0;
        try { var sh=_plusFon.getSheetByName(varaq); if(sh){ var oy=_f2Oylar(sh); var _onU=_oyKey(oyNom);
              for(var o=0;o<oy.length;o++){ if(_oyKey(oy[o].nom)===_onU){ c=oy[o].col; break; } } } } catch(e){}
        _oyColCache[varaq] = c; return c;
     }
     function _oyYozDarhol(varaq, row, obyomV, narxV, summaV){
        var c = _oyColOl(varaq); if(!c || !row) return;
        try {
           var sh = _plusFon.getSheetByName(varaq); if(!sh) return;
           sh.getRange(row, c).setValue(_toNum(obyomV));
           if(Number(narxV)>0) sh.getRange(row, c+1).setValue(_toNum(narxV));
           if(Number(summaV)>0) sh.getRange(row, c+2).setValue(_toNum(summaV));
           dopsYoz++;
        } catch(e){ dopXato.push('Ой ёзиш('+row+'): '+(e.message||e)); }
     }

     for(var i=0; i<dopps.length; i++) {
        var d = dopps[i];
        try {
           if(d.action === 'add_rs') {
              // Mavjud BL ga rs+ qo'shish. E: rs → НОРМА (d.norma), aks holda ОБЪЁМ.
              _setF2Prog('➕ Ресурс: '+String(d.nom||'').substring(0,28)+' (обём '+d.hajm+', сумма '+(d.summa||0)+')');
              // eObyom: F2 dagi F bo'sh bo'lgan (d.norma=0) → E to'liq obyom (ko'paytirilmaydi)
              var rNorm = (d.norma>0 ? d.norma : d.hajm);
              var rr = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: d.targetRow, kod: d.kod, nom: d.nom, birlik: d.bir, norm: rNorm, cat: d.type, kat: d.kat, narx: d.narx, eObyom: !(d.norma>0), zamena: !!d.zamena, f2_mode: true});
              _oyYozDarhol(d.varaq, rr.rsRow, d.hajm, d.narx, d.summa);
           } else {
              // add_bl / zamena_add — TANLANGAN razdel/ish ichiga yangi ish
              var afterRow = (d.action ? (d.targetRow||0) : 0);
              _setF2Prog('➕ Иш: '+String(d.nom||'').substring(0,24)+' (сумма '+(d.summa||0)+')');
              var r = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: afterRow, kod: d.kod, nom: d.nom, birlik: d.bir, hajm: d.hajm, narx: d.narx||0, zamena: (d.action==='zamena_add'||!!d.zamena), f2_mode: true});
              var newBlRow = r.blRow;
              // ⚡⚡⚡ 2026-07-05: avval bu yerda bl.E/F ATAYLAB 0 GA QAYTA YOZILARDI
              // ("smetada yo'q ish" degan eski qaror) — NATIJADA rs bolalarning
              // F=bl.E×norma formulasi 0×norma=0 bo'lib, BUTUN zamena hajmlari 0
              // chiqardi (foydalanuvchi 2-rasmda ko'rsatdi). Endi bl.E=F2 dagi
              // bajarilgan obyom (apiBlQosh o'zi yozadi) — zamena real ish, uning
              // smetasi "qo'shimcha" sifatida jamiga qo'shiladi (foydalanuvchi
              // 1490mln=joriy jami variantini tanlagan).
              _oyYozDarhol(d.varaq, newBlRow, d.hajm, d.narx, d.summa);
              // Resurs (child) larni ham qo'shamiz — ish tarkibi (DARHOL yoziladi)
              if(d.children && d.children.length > 0) {
                 for(var j=0; j<d.children.length; j++) {
                    var cRs = d.children[j];
                    if(cRs.type === 'rs' || cRs.type === 'mat' || cRs.type === 'ob') {
                       var cNorm = (cRs.norma>0 ? cRs.norma : cRs.hajm);
                       var rr2 = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: newBlRow, kod: cRs.kod, nom: cRs.nom, birlik: cRs.bir, norm: cNorm, cat: cRs.type, kat: cRs.kat, narx: cRs.narx||0, eObyom: !(cRs.norma>0), zamena: (d.action==='zamena_add'||!!d.zamena), f2_mode: true});
                       _oyYozDarhol(d.varaq, rr2.rsRow, cRs.hajm, cRs.narx, cRs.summa);
                    }
                 }
              }
           }
        } catch(ex) {
           dopXato.push((d.nom||'?')+': '+(ex.message||ex));
           Logger.log("Dop yozishda xato: " + ex);
        }
     }
  }

  _setF2Prog('3/3: Формулалар янгиланмоқда...');
  // 3. YAKUNIY BIR MARTALIK ta'mirlash — har LRV varaq uchun formulalar to'ldiriladi
  //    (yangi bl+/rs+ qatorlarning mavjud oy ustunlaridagi НАРХ/СУММА lari ham) va
  //    obyekt DASHBOARD'i BIR marta yangilanadi. ⚡ 2026-07-05 TEZLIK: avval bu ishlar
  //    HAR qo'shilgan qator ichida (apiRsQosh/apiBlQosh → lrvYoz) takrorlanardi —
  //    N qator = N marta butun-varaq ta'mir + N marta DASHBOARD ochish = daqiqalab
  //    kutish. Endi f2_mode'da ular o'tkazib yuborilib, FAQAT SHU YERDA bajariladi.
  var _f2TamirlaFayl = function(subOb){
     var plus = _plusTop(subOb);
     if(!plus) return;
     var a2 = sozAsosiy();
     var sheets = plus.getSheets();
     for(var s=0; s<sheets.length; s++) {
        var sh = sheets[s];
        if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
        try {
           var st = a2.dataQator > 0 ? a2.dataQator : _autoData(sh);
           var ls = sh.getLastRow();
           if(ls >= st) _oyFormulaToldur(sh, st, ls);
        } catch(ex){}
        try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
     }
     // ⚡ 2026-07-05: F2 importdan keyin НАКРУТКА podvalini QAYTA hisoblaymiz —
     // zamena/qo'shimcha ishlar kategoriya jamilarini o'zgartirgani uchun (avval
     // faqat [Ишла]da yozilardi → F2'dan keyin eskirib qolardi).
     if(typeof _nakrutkaSheetYoz === 'function'){ try { _nakrutkaSheetYoz(plus, subOb); } catch(ex){ Logger.log('F2 nakrutka: '+ex); } }
     try { serverYozFile(subOb, plus, sozAsosiy()); } catch(ex){}
     if(typeof _sbDirty === 'function'){ try { _sbDirty(subOb); } catch(ex){} }
  };
  var subObjects = _subObyektlar(obyekt);
  if (subObjects.length > 0) subObjects.forEach(_f2TamirlaFayl);
  else _f2TamirlaFayl(obyekt);

  _holatInvalidate(obyekt);

  // BATAFSIL NATIJA — foydalanuvchi ANIQ ko'radi nima yozildi (avval faqat "Жами N"
  // edi; agar 0 bo'lsa sababi ko'rinmasdi). Endi mapped/dops alohida + ogohlantirish.
  var jami = mappedYoz + dopsYoz;
  var xabar;
  if(jami===0){
    xabar = '⚠ Ҳеч нарса ёзилмади. Мослаштирилган: '+edits.length+' та, қўшимча: '+dopps.length+' та юборилди, лекин 0 ёзилди. '+
            'Сабаби: ой устуни ёки қаторлар мос келмаган бўлиши мумкин — қайта [Ишла] қилиб кўринг.';
  } else {
    xabar = '✅ '+oyNom+' ойига сақланди: '+mappedYoz+' та мослаштирилган'+(dopsYoz?(' + '+dopsYoz+' та янги (қўшимча) иш'):'')+' = жами '+jami+' та.';
  }
  if(dopXato && dopXato.length) xabar += ' ⚠ '+dopXato.length+' та қўшимчада хато: '+dopXato.slice(0,3).join('; ');
  return {ok: true, xabar: xabar, mapped: mappedYoz, dops: dopsYoz, jami: jami};
}

/* F2 oy obyekti helper — narx>0 bo'lsa narx, summa>0 bo'lsa AKTDAGI ANIQ summa ham
 * (statik — yuridik aniqlik: yaxlitlash farqi formula orqali ko'payib ketmasin). */
/* ============================================================
 * F2 ТАЙЁРЛАШ (teskari F2 import) — 2026-07-09
 * Смета ФАКТ ва аввалги Ф2 (F2OL) ўртасидаги ФАРҚ (F2MUM — қолдиқ) дан янги
 * Ф2/КС-2 ҳужжатини ЎЗИ тузади. Панель (client) TREE_DATA'дан фойдаланувчи
 * танлаган/таҳрирлаган қаторларни (varaq,row,kod,nom,bir,hajm,narx,rzNom,blNom,
 * type) юборади — сервер фақат ТАҚДИМОТ ҳужжатини (Google Sheet, КС-2 услубида,
 * раздел→иш тури→ресурс иерархияси билан) яратади. LRV'га ЁЗИШ БУ ФУНКЦИЯДА
 * АМАЛГА ОШМАЙДИ — фойдаланувчи алоҳида "Тасдиқлаш" тугмасини босгандагина
 * (клиент томонда apiOyQosh+apiHolatSaqla — мавжуд, синалган йўл) LRV'га ёзилади.
 * ============================================================ */
function apiF2TayyorHujjatYarat(obyekt, oyNom, items){
  if(!items || !items.length) throw 'Ҳеч нарса танланмади';
  oyNom = String(oyNom||'').trim() || 'Ф2';

  // Ob'ekt papkasini topamiz (split obyekt bo'lsa — ota-papka nomi bilan zaxira)
  var obs=papkaSkan(), target=null, baseObj=obyekt.split(' - ')[0];
  for(var i=0;i<obs.length;i++){ if(obs[i].obyekt.trim()===obyekt.trim()){ target=obs[i]; break; } }
  if(!target) for(var i=0;i<obs.length;i++){ if(obs[i].obyekt.trim().indexOf(baseObj.trim())===0){ target=obs[i]; break; } }
  var folderId = target ? target.folderId : null;

  // Guruhlash: rzNom -> blNom("" = mustaqil mat/ob) -> [items]
  var rzOrder=[], rzMap={};
  items.forEach(function(it){
    var rz = it.rzNom || 'БЎЛИМ';
    if(!rzMap[rz]){ rzMap[rz]={order:[], map:{}}; rzOrder.push(rz); }
    var bl = it.blNom || '';
    if(!rzMap[rz].map[bl]){ rzMap[rz].map[bl]=[]; rzMap[rz].order.push(bl); }
    rzMap[rz].map[bl].push(it);
  });

  var nm = obyekt + ' - Ф2 тайёр (' + oyNom + ')';
  var ss = SpreadsheetApp.create(nm);
  if(folderId){
    try{
      var folder = DriveApp.getFolderById(folderId);
      var file = DriveApp.getFileById(ss.getId());
      folder.addFile(file);
      try{ DriveApp.getRootFolder().removeFile(file); }catch(e2){}
    }catch(e){}
  }
  var sh = ss.getSheets()[0];
  sh.setName('F2');

  var MAXC=9;   // A..I: №|ШИФР|НОМ|БИРЛИК|(бўш)|ОБЪЁМ|НАРХ|СУММА|ТИП
  var rows=[], boldRows=[];
  rows.push(['АКТ (Ф2) — '+obyekt+' — '+oyNom,'','','','','','','','']);
  rows.push(['№','ШИФР','НАИМЕНОВАНИЕ','БИРЛИК','','ОБЪЁМ','НАРХ','СУММА','ТИП']);
  boldRows.push(0,1);
  var no=0, jamiSumma=0;
  rzOrder.forEach(function(rz){
    rows.push(['', rz, '', '', '', '', '', '', 'rz']);
    boldRows.push(rows.length-1);
    rzMap[rz].order.forEach(function(bl){
      var arr=rzMap[rz].map[bl], blRowIdx=-1, blSumma=0;
      if(bl){
        rows.push(['', '', bl, '', '', '', '', '', 'bl']);
        blRowIdx=rows.length-1;
        boldRows.push(blRowIdx);
      }
      arr.forEach(function(it){
        no++;
        var hajm=_toNum(it.hajm), narx=_toNum(it.narx), summa=hajm*narx;
        jamiSumma+=summa; blSumma+=summa;
        rows.push([no, it.kod||'', it.nom||'', it.bir||'', '', hajm, narx, summa, it.type||'rs']);
      });
      if(blRowIdx>=0) rows[blRowIdx][7]=blSumma;
    });
  });
  rows.push(['','','ЖАМИ','','','','',jamiSumma,'jami']);
  boldRows.push(rows.length-1);

  var padded = rows.map(function(r){ var a=r.slice(); while(a.length<MAXC) a.push(''); return a; });
  sh.getRange(1,1,padded.length,MAXC).setValues(padded);
  sh.getRange(1,1,1,MAXC).merge().setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center').setBackground('#1f4e79').setFontColor('#ffffff');
  sh.getRange(2,1,1,MAXC).setFontWeight('bold').setBackground('#d9e1f2');
  boldRows.forEach(function(ri){ if(ri>1) sh.getRange(ri+1,1,1,MAXC).setFontWeight('bold').setBackground('#fff2cc'); });
  if(padded.length>2) sh.getRange(3,6,padded.length-2,3).setNumberFormat('#,##0.####');
  sh.setColumnWidth(3, 340); sh.setColumnWidth(2, 90);
  try{ sh.autoResizeColumns(4, 5); }catch(e){}

  return {ok:true, url: ss.getUrl(), fileId: ss.getId(), name: nm, jami: jamiSumma, soni: no};
}

function _oyObj(oyNom, hajm, narx, summa){
  var o = {}, v = {obyom: Number(hajm)||0};
  if(Number(narx)>0) v.narx = Number(narx);
  if(Number(summa)>0) v.summa = Number(summa);
  o[oyNom] = v;
  return o;
}

/* F2 importdan kategoriya (ANTIGRAVITY_UCHUN.md qoida #9 — birlik yetakchi):
 * чел-час → MAJBURIY ЧЕЛ, маш-час → MAJBURIY МАШ (foydalanuvchi tanlovi e'tiborsiz);
 * boshqa birliklar → foydalanuvchi tanlagan (МАТ/ОБ/М-К/КАБ), tanlanmagan → МАТ. */
function _f2KatAvto(birlik, tanlangan){
  var b = String(birlik||'').toUpperCase();
  if(b.indexOf('ЧЕЛ')>=0 || b.indexOf('CHEL')>=0) return 'ЧЕЛ';
  if(b.indexOf('МАШ')>=0 || b.indexOf('MASH')>=0) return 'МАШ';
  var t = String(tanlangan||'').toUpperCase();
  if(t==='ОБ'||t==='МАТ'||t==='М/К'||t==='КАБ'||t==='ЧЕЛ'||t==='МАШ') return t;
  return 'МАТ';
}

/* REESTR (IERARXIYA) API */
function apiReestrSaqla(jsonStr) {
  PropertiesService.getDocumentProperties().setProperty('REESTR_DATA', jsonStr);
  return {ok:true};
}

function apiReestrOl() {
  var j = PropertiesService.getDocumentProperties().getProperty('REESTR_DATA');
  return {ok:true, data: j || '[]'};
}


function apiF2QollaProgress() {
  try { return CacheService.getUserCache().get('f2_qolla_prog') || ''; }
  catch(e) { return ''; }
}

// ⚡ 2026-07-05: F2 jarayon LOG'i (monitoring oynasi uchun — LRV_PLUS monitoring kabi).
// Har qadam vaqt bilan qo'shiladi; apiF2QollaLog to'liq jurnalni qaytaradi.
function apiF2QollaLog() {
  try {
    var raw = CacheService.getUserCache().get('f2_qolla_log') || '[]';
    return { hozir: apiF2QollaProgress(), log: JSON.parse(raw) };
  } catch(e) { return { hozir:'', log:[] }; }
}

function _setF2Prog(msg) {
  try {
    var c = CacheService.getUserCache();
    c.put('f2_qolla_prog', msg, 120);
    // Jurnalga qo'shamiz (oxirgi 60 qator)
    var raw = c.get('f2_qolla_log') || '[]';
    var arr = []; try { arr = JSON.parse(raw); } catch(e){ arr = []; }
    var vaqt = Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent', 'HH:mm:ss');
    arr.push(vaqt + '  ' + msg);
    if(arr.length > 60) arr = arr.slice(arr.length - 60);
    c.put('f2_qolla_log', JSON.stringify(arr), 600);
  } catch(e){}
}
function _f2LogTozala() { try { CacheService.getUserCache().remove('f2_qolla_log'); } catch(e){} }
// force push


/* ⚡ 2026-07-05 F2 QO'LLASH — FONDA (asinxron). Brauzer bloklanmaydi, 6 daqiqa
 * timeout xavfi foydalanuvchiga ta'sir qilmaydi. Payload CacheService'da (gzip+chunk,
 * cachePut 100KB+ ni bo'lib saqlaydi), bir martalik trigger 2 soniyada ishga tushadi,
 * jarayon holati _setF2Prog orqali — Panel apiF2QollaProgress bilan kuzatadi.
 * (Avvalgi versiya mavjud bo'lmagan _boss/_navbatgaQosh ni chaqirib CRASH bo'lardi.) */
function apiF2QollaNavbatga(obyekt, oyNom, edits, dopps) {
  cachePut('f2fon_payload', {obyekt:obyekt, oyNom:oyNom, edits:edits||[], dopps:dopps||[]}, 21600);
  _setF2Prog('⏳ Навбатда: '+obyekt+' / '+oyNom+' ('+((edits||[]).length)+' мослаштирилган, '+((dopps||[]).length)+' қўшимча)');
  // Eski qolib ketgan triggerlarni tozalab, yangisini qo'yamiz
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === '_f2FonQadam') { try { ScriptApp.deleteTrigger(trs[i]); } catch(e){} }
  }
  ScriptApp.newTrigger('_f2FonQadam').timeBased().after(2000).create();
  return {ok: true, fon: true, xabar: '✅ Навбатга қўшилди — фонда ёзилади. Жараён панелда кўрсатилади.'};
}

function _f2FonQadam() {
  // O'z triggerini tozalash (bir martalik)
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === '_f2FonQadam') { try { ScriptApp.deleteTrigger(trs[i]); } catch(e){} }
  }
  var p = cacheGet('f2fon_payload');
  if (!p) { _setF2Prog('❌ Фон: маълумот топилмади (кеш эскирган) — F2 ни қайта юборинг'); return; }
  cacheDel('f2fon_payload');
  try {
    var r = apiF2Qolla(p.obyekt, p.oyNom, p.edits, p.dopps);
    _setF2Prog((r && r.ok ? '✅ ТУГАДИ: ' : '⚠ ') + (r && r.xabar || ''));
  } catch(e) {
    _setF2Prog('❌ Хато: ' + (e.message || e));
  }
}
