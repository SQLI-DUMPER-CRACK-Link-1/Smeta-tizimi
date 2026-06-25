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
  var plus=_plusTop(obyekt);
  if(!plus) throw 'LRV_PLUS топилмади: '+obyekt;
  var a=sozAsosiy(), col=CFG.C;
  var CATS=['ЧЕЛ','МАШ','МАТ','ОБ','М/К'];
  function nc(){ return {res:0,fakt:0,f2:0,ost:0}; }
  function ncs(){ var o={}; CATS.forEach(function(k){o[k]=nc();}); return o; }
  var total=ncs(), rzList=[], oyTrend={};
  var sheets=plus.getSheets();
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s];
    if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh);
    if(last<start) continue;
    var n=last-start+1;
    // Oy jamilarini ЖАМИ qatoridan olamiz — bitta getValues (katak-katak emas)
    var oylar=_f2Oylar(sh), jamiRow=start-1;
    if(oylar.length){
      var firstOyCol=oylar[0].col, lastOyCol=oylar[oylar.length-1].col;
      var oyRow=sh.getRange(jamiRow, firstOyCol, 1, lastOyCol-firstOyCol+1).getValues()[0];
      for(var oi=0;oi<oylar.length;oi++){
        var on=oylar[oi].nom;
        var ov=_toNum(oyRow[oylar[oi].col-firstOyCol]);
        oyTrend[on]=(oyTrend[on]||0)+ov;
      }
    }
    var v=sh.getRange(start,1,n,col.ST_OST).getValues();
    var curRzNom='', curRzCats=null;
    for(var i=0;i<n;i++){
      var mk=String(v[i][col.MARKER-1]||'').trim().toLowerCase().replace(/\+$/,'');
      if(mk==='rz'){
        if(curRzNom&&curRzCats) rzList.push({nom:curRzNom,cats:curRzCats});
        var rzNom='';
        for(var c=0;c<8;c++){var cv=String(v[i][c]||'').trim();if(cv&&/[А-ЯЁA-Za-zА-яёa-z]/.test(cv)){rzNom=cv;break;}}
        curRzNom=rzNom; curRzCats=ncs();
      } else if(mk==='rs'||(mk === 'mat' || mk === 'ob') ){
        var res=_toNum(v[i][col.ST_RES-1]), fakt=_toNum(v[i][col.ST_FAKT-1]);
        var f2=_toNum(v[i][col.ST_F2-1]), ost=_toNum(v[i][col.ST_OST-1]);
        var cat='МАТ';
        if(_toNum(v[i][col.CHEL-1])>0) cat='ЧЕЛ';
        else if(_toNum(v[i][col.MASH-1])>0) cat='МАШ';
        else if(_toNum(v[i][col.OB-1])>0) cat='ОБ';
        else if(_toNum(v[i][col.MK-1])>0) cat='М/К';
        total[cat].res+=res; total[cat].fakt+=fakt; total[cat].f2+=f2; total[cat].ost+=ost;
        if(curRzCats){curRzCats[cat].res+=res;curRzCats[cat].fakt+=fakt;curRzCats[cat].f2+=f2;curRzCats[cat].ost+=ost;}
      }
    }
    if(curRzNom&&curRzCats) rzList.push({nom:curRzNom,cats:curRzCats});
  }
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
  var a=sozAsosiy(), srv;
  try{ srv=_serverSS(a); }catch(e){ return {objects:[],jami:{},oylar:[]}; }
  var dash=srv.getSheetByName(CFG.DASH);
  if(!dash||dash.getLastRow()<2) return {objects:[],jami:{},oylar:[]};
  var v=dash.getRange(2,1,dash.getLastRow()-1,SRV.HDR.length).getValues();
  var objects=[], j={smeta:0,chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,fakt:0,f2:0,qoldiq:0};
  for(var i=0;i<v.length;i++){
    var nom=String(v[i][0]||'').trim();
    if(!nom||nom.toUpperCase()==='ЖАМИ') continue;
    var o={
      nom:nom,
      smeta:_toNum(v[i][1]), chel:_toNum(v[i][2]), mash:_toNum(v[i][3]),
      mat:_toNum(v[i][4]),   ob:_toNum(v[i][5]),   mk:_toNum(v[i][6]),
      kab:_toNum(v[i][7]),   fakt:_toNum(v[i][8]), f2:_toNum(v[i][9]),
      qoldiq:_toNum(v[i][10]), sana:String(v[i][12]||'')
    };
    o.progress=o.smeta>0?Math.round(o.fakt/o.smeta*100):0;
    o.f2pct=o.fakt>0?Math.round(o.f2/o.fakt*100):0;
    objects.push(o);
    j.smeta+=o.smeta; j.chel+=o.chel; j.mash+=o.mash; j.mat+=o.mat;
    j.ob+=o.ob; j.mk+=o.mk; j.kab+=o.kab; j.fakt+=o.fakt; j.f2+=o.f2; j.qoldiq+=o.qoldiq;
  }
  j.progress=j.smeta>0?Math.round(j.fakt/j.smeta*100):0;
  j.f2pct=j.fakt>0?Math.round(j.f2/j.fakt*100):0;

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
  return {skan:skan, fmtMap:fmtMap, kesh:kesh, webAppUrl:url, systemPaused:paused};
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
             'СВОД_НОМ_УСТ','СВОД_БИР_УСТ','СВОД_НАРХ_УСТ','СВОД_БЛОК_УСТ','СВОД_QTY_УСТ','СВОД_СУММА_УСТ']];
  for(var i=0;i<pairs.length;i++){
    var sc=pairs[i].svodCols||{};
    rows.push([
      pairs[i].obyekt,
      pairs[i].lokId     || '',
      pairs[i].lokName   || '',
      pairs[i].svodId    || '',
      pairs[i].svodName  || '',
      _normFormat((pairs[i].format  || 'TN').toUpperCase()),
      (pairs[i].lokSheets  || []).join(','),
      (pairs[i].svodSheets || []).join(','),
      Number(sc.nom)||'', Number(sc.bir)||'', Number(sc.narx)||'', Number(sc.blok)||'',
      Number(sc.qty)||'', Number(sc.summa)||''
    ]);
  }
  sh.getRange(1,1,rows.length,14).setValues(rows);
  sh.getRange(1,1,1,14).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
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
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt===obyekt){ t=obs[i]; break; }
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

function apiHolatOl(obyekt, forceRefresh){
  // Kesh birinchi — agar forceRefresh=true bo'lmasa
  if(!forceRefresh){
    var cached = _keshOl('holat_'+obyekt);
    if(cached) return cached;
  }

  // 1) GURUHLANGAN (PARENT) OBYEKT EKANINI TEKSHIRAMIZ:
  var subObjects = _subObyektlar(obyekt);   // yagona, normallashtirilgan parent→child aniqlash

  if (subObjects.length > 0) {
    var mergedTree = [];
    var mergedOylarSet = {};
    var allLocked = true;
    var mergedFormat = 'TN';
    var mergedDarajalar = [];

    for (var k = 0; k < subObjects.length; k++) {
      var subOb = subObjects[k];
      try {
        var subState = apiHolatOl(subOb, forceRefresh);
        if (subState) {
          mergedFormat = subState.format || 'TN';
          if (!subState.locked) allLocked = false;
          
          if (subState.oylar) {
            subState.oylar.forEach(function(oy) {
              mergedOylarSet[oy] = true;
            });
          }
          
          var subName = subOb.split(' - ').slice(1).join(' - ').trim();
          
          if (subState.tree) {
            subState.tree.forEach(function(node) {
              var clonedNode = JSON.parse(JSON.stringify(node));
              if (clonedNode.type === 'rz') {
                clonedNode.nom = subName + ' : ' + clonedNode.nom;
              }
              
              function applyVaraqPrefix(n) {
                if (n.varaq) n.varaq = subOb + '||' + n.varaq;
                if (n.children) {
                  n.children.forEach(applyVaraqPrefix);
                }
              }
              applyVaraqPrefix(clonedNode);
              mergedTree.push(clonedNode);
            });
          }

          if (subState.darajalar) {
            subState.darajalar.forEach(function(d) {
              var clonedD = JSON.parse(JSON.stringify(d));
              clonedD.rzNom = subName + ' : ' + clonedD.rzNom;
              mergedDarajalar.push(clonedD);
            });
          }
        }
      } catch(e) {
        Logger.log('Error merging ' + subOb + ': ' + e);
      }
    }

    var result = {
      obyekt:       obyekt,
      locked:       allLocked,
      faktLocked:   false,
      format:       mergedFormat,
      oylar:        Object.keys(mergedOylarSet),
      tree:         mergedTree,
      darajalar:    mergedDarajalar
    };
    try{ _keshYoz('holat_'+obyekt, result); }catch(e){}
    return result;
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

  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;

    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;

    if (forceRefresh) {
      try { _oyYigindiFormulalarYangila(sh); formulaYangilandi=true; } catch(ex){}
    }

    var oylar=_f2Oylar(sh);
    for(var o=0;o<oylar.length;o++) oylarSet[oylar[o].nom]=true;

    var lastCol=Math.max(col.F2MUM, sh.getLastColumn());
    var g=sh.getRange(start,1,n,lastCol).getValues();

    var curRz=null, curBl=null;

    for(var i=0;i<n;i++){
      var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase();
      var baseMk=mk.replace(/\+$/,'');
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
        curRz={type:'rz', nom:rzNom, varaq:nm, row:r, children:[]};
        tree.push(curRz); curBl=null;
      }
      else if(baseMk==='bl'||(baseMk === 'mat' || baseMk === 'ob') ){
        var oyVal={};
        for(var o=0;o<oylar.length;o++) oyVal[oylar[o].nom]=_toNum(g[i][oylar[o].col-1]);
        var blNode={
          type:baseMk, nom:nom, varaq:nm, row:r,
          kod: String(g[i][col.KOD-1]||'').trim(),
          birlik: String(g[i][col.BIRLIK-1]||''),
          smetaHajm: _toNum(g[i][col.E-1]),
          fakt:      _toNum(g[i][col.FAKT-1]),
          qoldiq:    _toNum(g[i][col.QOLDIQ-1]),
          f2ol:      _toNum(g[i][col.F2OL-1]),
          f2mum:     _toNum(g[i][col.F2MUM-1]),
          smeta:     _toNum(g[i][col.SMETA-1]),
          stFakt:    _toNum(g[i][col.ST_FAKT-1]),
          stF2:      _toNum(g[i][col.ST_F2-1]),
          oylar:     oyVal,
          isQosh:    /\+$/.test(mk),
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
          fakt:      _toNum(g[i][col.FAKT-1]),
          qoldiq:    _toNum(g[i][col.QOLDIQ-1]),
          smeta:     _toNum(g[i][col.ST_RES-1]),
          stFakt:    _toNum(g[i][col.ST_FAKT-1]),
          stF2:      _toNum(g[i][col.ST_F2-1]),
          stOst:     _toNum(g[i][col.ST_OST-1]),
          isQosh:    /\+$/.test(mk)
        };
        if(curBl) curBl.children.push(rsNode);
      }
    }
  }
  if (formulaYangilandi) {
     try { SpreadsheetApp.flush(); } catch(ex){}
  }

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
      if(narx>0){ smetaByOb[obNom]=narx; if(narx>maxFromObs) maxFromObs=narx; }
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
        var mk=String(v[r][col.MARKER-1]||'').trim().toLowerCase().replace(/\+$/,'');
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
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt===obyekt){target=obs[i];break;}
  if(!target||!target.svodFile) throw 'Свод топилмади: '+obyekt;
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
        if((!kod||narx<=0)&&nomUp){
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
        var blok=String(v[i][sc.BLOK-1]||'').trim(), blokUp=blok.toUpperCase();
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
  sh.getRange(r,col.MARKER).setValue('bl+');
  sh.getRange(r,col.FAKT).setValue(0);
  sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r);
  sh.getRange(r,col.F2OL).setFormula('=SUM($'+_cl(col.F2_BIRINCHI)+r+':$ZZ'+r+')');
  sh.getRange(r,col.F2MUM).setFormula('=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r);
  sh.getRange(r,col.SMETA).setValue(0);
  sh.getRange(r,col.H_BL).setValue(nom);
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  SpreadsheetApp.flush();
  _holatInvalidate(obyekt);
  return {ok:true, blRow:r, nRows:1, xabar:nom+' (янги иш тури) қўшилди — энди ресурс қўшинг'};
}

/* RS QO'SHISH — mavjud BL ga yangi rs+ resurs qo'shadi
 * params = {obyekt, varaq, blRow, nom, birlik, norm} */
function apiRsQosh(params){
  var obyekt=params.obyekt, varaqNom=params.varaq;
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
      var mk=String(v[i][0]||'').trim().toLowerCase().replace(/\+$/,'');
      if(mk==='bl'||mk==='rz') break;
      if(mk==='rs'||(mk === 'mat' || mk === 'ob') ) lastChild=blRow+1+i;
    }
  }
  // Yangi rs+ qator qo'shamiz
  sh.insertRowsAfter(lastChild,1);
  var r=lastChild+1;
  // Narxni svodkadan topamiz
  var obs=papkaSkan(), target=null;
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt===obyekt){ target=obs[i]; break; }
  var narx=0, cat='МАТ';
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
  sh.getRange(r,col.NOM).setValue(nom);
  sh.getRange(r,col.BIRLIK).setValue(birlik);
  sh.getRange(r,col.E).setValue(norm);
  sh.getRange(r,col.F).setFormula('='+CL(col.E)+'$'+blRow+'*'+CL(col.E)+r);
  sh.getRange(r,col.MARKER).setValue('rs+');
  sh.getRange(r,col.NARX).setValue(narx);
  sh.getRange(r,col.SMETA).setFormula('=$'+CL(col.F)+r+'*$'+CL(col.NARX)+r);
  // Kategoriya
  var mainC=(cat==='КАБ'||cat==='КАБЕЛ')?'МАТ':cat;
  var ref='=$'+CL(col.SMETA)+r;
  var catCol=col.MAT;
  if(mainC==='ЧЕЛ') catCol=col.CHEL;
  else if(mainC==='МАШ') catCol=col.MASH;
  else if(mainC==='ОБ'||mainC==='ОБОР') catCol=col.OB;
  else if(mainC==='МК'||mainC==='М/К') catCol=col.MK;
  sh.getRange(r,catCol).setFormula(ref);
  // FAKT/QOLDIQ/F2
  sh.getRange(r,col.FAKT).setFormula('='+CL(col.FAKT)+'$'+blRow+'*'+CL(col.E)+r);
  sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.F)+r+'-$'+CL(col.FAKT)+r);
  sh.getRange(r,col.F2OL).setFormula('=SUM($'+_cl(col.F2_BIRINCHI)+r+':$ZZ'+r+')');
  sh.getRange(r,col.F2MUM).setFormula('=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r);
  sh.getRange(r,col.ST_RES).setFormula('=$'+CL(col.SMETA)+r);
  sh.getRange(r,col.ST_FAKT).setFormula('=$'+CL(col.FAKT)+r+'*$'+CL(col.NARX)+r);
  sh.getRange(r,col.ST_F2).setFormula('=$'+CL(col.F2OL)+r+'*$'+CL(col.NARX)+r);
  sh.getRange(r,col.ST_OST).setFormula('=$'+CL(col.F2MUM)+r+'*$'+CL(col.NARX)+r);
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  // Oy formulalari (agar mavjud bo'lsa)
  var oylar=_f2Oylar(sh);
  for(var oi=0;oi<oylar.length;oi++){
    sh.getRange(r,oylar[oi].col).setFormula('='+CL(oylar[oi].col)+'$'+blRow+'*'+CL(col.E)+r);
  }
  // BL smeta formulasini yangilaymiz
  var c1=blRow+1, c2=r;
  sh.getRange(blRow,col.SMETA).setFormula('=SUM($'+CL(col.SMETA)+c1+':$'+CL(col.SMETA)+c2+')');
  SpreadsheetApp.flush();
  _holatInvalidate(obyekt);
  return {ok:true, xabar:nom+' ('+birlik+', narx='+narx+') qo\'shildi'};
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
    if(narx<=0) continue;
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
  for(var i=0;i<edits.length;i++){
    var v = edits[i].varaq;
    var subOb = obyekt;
    var realV = v;
    if (v.indexOf('||') >= 0) {
      var parts = v.split('||');
      subOb = parts[0];
      realV = parts[1];
    }
    byV[subOb] = byV[subOb] || {};
    byV[subOb][realV] = byV[subOb][realV] || [];
    
    var clonedEdit = JSON.parse(JSON.stringify(edits[i]));
    clonedEdit.varaq = realV;
    byV[subOb][realV].push(clonedEdit);
  }

  var jami=0;
  var subObjectsSaved = {};

  for (var subOb in byV) {
    var plus = _plusTop(subOb);
    if (!plus) continue;
    subObjectsSaved[subOb] = plus;

    for (var v in byV[subOb]) {
      var sh = plus.getSheetByName(v);
      if (!sh) continue;
      var oylar = _f2Oylar(sh), oyCol = {};
      for (var o = 0; o < oylar.length; o++) oyCol[oylar[o].nom] = oylar[o].col;
      
      byV[subOb][v].forEach(function(e) {
        if (e.fakt !== undefined && e.fakt !== null) {
          sh.getRange(e.row, col.FAKT).setValue(_toNum(e.fakt)); jami++;
        }
        if (e.oylar) {
          for (var on in e.oylar) {
            var c = oyCol[on];
            if (c) { sh.getRange(e.row, c).setValue(_toNum(e.oylar[on])); jami++; }
          }
        }
      });
    }
  }

  for (var subOb in subObjectsSaved) {
    try { serverYozFile(subOb, subObjectsSaved[subOb], sozAsosiy()); } catch(e){}
    _holatInvalidate(subOb);
    if (typeof supabaseObyektPush === 'function') { try { supabaseObyektPush(subOb); } catch(e) {} }
  }

  SpreadsheetApp.flush();
  _holatInvalidate(obyekt);

  if (typeof supabaseTarixYoz === 'function') {
    try { supabaseTarixYoz(obyekt, edits, Session.getActiveUser().getEmail()); } catch(e) {}
  }

  return {ok:true, jami:jami, xabar:'Сақланди: '+jami+' қиймат'};
}

/* Yangi oy ustuni qo'shish */
function apiOyQosh(obyekt, oyNom){
  var subObjects = _subObyektlar(obyekt);   // yagona, normallashtirilgan parent→child aniqlash

  if (subObjects.length > 0) {
    var totalAdded = 0;
    subObjects.forEach(function(subOb) {
      try {
        var r = apiOyQosh(subOb, oyNom);
        if (r && r.ok) totalAdded++;
      } catch(e) {
        Logger.log('apiOyQosh error for ' + subOb + ': ' + e);
      }
    });
    _holatInvalidate(obyekt);
    return {ok:true, xabar:'Ой barcha bo\'limlarga qo\'shildi: '+oyNom};
  }

  var plus=_plusTop(obyekt);
  if(!plus) throw 'LRV_PLUS топилмаdi';
  var a=sozAsosiy(), col=CFG.C, CL=_cl, sheets=plus.getSheets(), qoshildi=0;
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    var oylar=_f2Oylar(sh), bor=false;
    for(var o=0;o<oylar.length;o++){ if(oylar[o].nom===oyNom){ bor=true; break; } }
    if(bor) {
      try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
      continue;
    }
    var hr=_hdrRow(sh);
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    _oyKollarTikla(sh, [oyNom], hr, start, n);   // har oy 3 ustun (ОБЪЁМ|НАРХ|СУММА)
    try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
    qoshildi++;
  }
  SpreadsheetApp.flush();
  _holatInvalidate(obyekt);
  return {ok:true, xabar:'Ой қўшилди: '+oyNom+' ('+qoshildi+' варақ)'};
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
  var jamiSmeta=0, leaf=0, faktSmeta=0, faktSoni=0;
  var nol=[], top=[];

  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;
    var g=sh.getRange(start,1,n,col.ST_OST).getValues();
    for(var i=0;i<n;i++){
      var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/\+$/,'');
      if(mk!=='rs'&&(mk !== 'mat' && mk !== 'ob') ) continue;
      leaf++;
      var nom=String(g[i][col.NOM-1]||'').trim();
      var bir=String(g[i][col.BIRLIK-1]||'').trim();
      var e=_toNum(g[i][col.E-1]), f=_toNum(g[i][col.F-1]);
      var narx=_toNum(g[i][col.NARX-1]);
      var sm=_toNum(g[i][col.ST_RES-1]);   // Z = smeta summa
      jamiSmeta+=sm;
      // kategoriya — qaysi ustun > 0
      var kat='?';
      if(_toNum(g[i][col.CHEL-1])>0) kat='ЧЕЛ';
      else if(_toNum(g[i][col.MASH-1])>0) kat='МАШ';
      else if(_toNum(g[i][col.OB-1])>0) kat='ОБ';
      else if(_toNum(g[i][col.MK-1])>0) kat='М/К';
      else if(_toNum(g[i][col.MAT-1])>0) kat=(_toNum(g[i][col.KAB-1])>0?'КАБ':'МАТ');
      else if(_toNum(g[i][col.KAB-1])>0) kat='КАБ';
      if(katSum[kat]!==undefined) katSum[kat]+=sm; else katSum['?']+=sm;
      // FAKT-override taxmini: narx ≈ faktMap qiymati (svodkadan oshgan)
      var key=_norm(nom)+'||'+_normBirlik(bir);
      var fv=faktMap[key]||0;
      if(fv>0 && narx>0 && Math.abs(narx-fv)<0.01){ faktSmeta+=sm; faktSoni++; }
      // 0-narx lekin hajmi bor
      if(narx<=0 && (e>0||f>0)) nol.push({nom:nom,birlik:bir,e:e,f:f,kat:kat,varaq:nm,qator:start+i});
      top.push({nom:nom,birlik:bir,e:e,f:f,narx:narx,smeta:sm,kat:kat,varaq:nm,qator:start+i});
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
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt===obyekt){ t=obs[i]; break; }
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
  var plus=_plusTop(obyekt);
  if(!plus) return {ok:false, xabar:'LRV_PLUS топилмади'};

  // 1. LRV_PLUS dan RZ nomlarini yig'amiz
  var a=sozAsosiy(), col=CFG.C;
  var rzSet={}, rzOrder=[];
  var sheets=plus.getSheets();
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s];
    if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;
    var g=sh.getRange(start,1,n,col.MARKER).getValues();
    var curRz='', curHas=false;
    for(var i=0;i<n;i++){
      var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/\+$/,'');
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

  var plus=_plusTop(obyekt);
  if(!plus) return {ok:false, xabar:'LRV_PLUS topilmadi'};

  var col=CFG.C, a=sozAsosiy(), totalW=0;
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
      var mk=String(v[i][col.MARKER-1]||'').trim().toLowerCase().replace(/\+$/,'');
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

  SpreadsheetApp.flush();
  return {ok:true, xabar:totalW+' qator yangilandi ('+Object.keys(rzMap).length+' RZ)'};
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
  
  var cKod=-1, cNom=-1, cBir=-1, cHajm=-1, cNarx=-1;
  
  if(colConfig) {
     cKod = parseInt(colConfig.kod);
     cNom = parseInt(colConfig.nom);
     cBir = parseInt(colConfig.bir);
     cHajm = parseInt(colConfig.hajm);
     cNarx = parseInt(colConfig.narx);
  } else {
     // Smart Heuristics
     for(var i=0; i<Math.min(30, data.length); i++){
       for(var j=0; j<data[i].length; j++){
         var t = String(data[i][j]).toLowerCase().replace(/\s+/g, '');
         if(t.indexOf('обоснование')>=0 || t.indexOf('шифр')>=0 || t.indexOf('код')>=0) cKod=j;
         if(t.indexOf('наименование')>=0 || t.indexOf('nomi')>=0) cNom=j;
         if(t.indexOf('ед.изм')>=0 || t.indexOf('изм')>=0 || t.indexOf('birlik')>=0) cBir=j;
         if((t.indexOf('выполнено')>=0 || t.indexOf('объем')>=0 || t.indexOf('кол-во')>=0) && cHajm===-1) cHajm=j;
         if(t.indexOf('стоимость')>=0 || t.indexOf('цена')>=0 || t.indexOf('narx')>=0) cNarx=j;
       }
       if(cKod>=0 && cNom>=0 && cHajm>=0 && cNarx>=0) break;
     }
     if(cKod===-1) cKod=1;
     if(cNom===-1) cNom=2;
     if(cBir===-1) cBir=3;
     if(cHajm===-1) cHajm=4;
     if(cNarx===-1) cNarx=5;
     
     // Return columns to UI for verification
     return {ok: true, mode: 'config', cols: {kod: cKod, nom: cNom, bir: cBir, hajm: cHajm, narx: cNarx}, maxCol: data[0].length};
  }
  
  var result = [];
  var currentRz = {type: 'rz', nom: 'Асосий бўлим', children: []};
  result.push(currentRz);
  var currentBl = null;
  
  for(var i=0; i<data.length; i++) {
     var kod = cKod>=0 ? String(data[i][cKod]||'').trim() : '';
     var nom = cNom>=0 ? String(data[i][cNom]||'').trim() : '';
     var bir = cBir>=0 ? String(data[i][cBir]||'').trim() : '';
     var hajm = cHajm>=0 ? parseFloat(String(data[i][cHajm]).replace(',', '.')) || 0 : 0;
     var narx = cNarx>=0 ? parseFloat(String(data[i][cNarx]).replace(/\s+/g,'').replace(',', '.')) || 0 : 0;
     
     var isRz = false;
     if(!kod && nom && (nom.toLowerCase().indexOf('раздел')===0 || nom.toLowerCase().indexOf('бўлим')===0)) isRz = true;
     if(!isRz && !kod && !bir && hajm === 0 && nom && nom.length > 2) isRz = true;
     
     if(isRz) {
        currentRz = {type: 'rz', nom: nom, children: []};
        result.push(currentRz);
        currentBl = null;
        continue;
     }
     
     if(kod && nom && hajm > 0) {
        // Xuddi 10_Engine.js dagi kabi keyingi qatorni tekshiramiz
        var nextNom = '';
        for(var j=i+1; j<data.length; j++) {
           var nKod = cKod>=0 ? String(data[j][cKod]||'').trim() : '';
           var nNom = cNom>=0 ? String(data[j][cNom]||'').trim() : '';
           var nHajm = cHajm>=0 ? parseFloat(String(data[j][cHajm]).replace(',', '.')) || 0 : 0;
           if((nKod||nNom) && nHajm > 0) { nextNom = nNom; break; }
        }
        
        var isZtr = (nextNom.toUpperCase().indexOf('ЗАТРАТЫ ТРУДА') >= 0);
        var isRs = /^\d+$/.test(kod) || nom.toUpperCase().indexOf('ЗАТРАТЫ ТРУДА') >= 0 || /^\d+[\.,]\d+$/.test(kod);
        
        var nType = 'mat';
        if (isRs) nType = 'rs';
        else if (isZtr) nType = 'bl';
        else if (/^[ЕЦРТМE]\s*\d/.test(kod.toUpperCase())) nType = 'bl';
        else {
           if (nom.toUpperCase().indexOf('ОБОРУДОВАН') >= 0 || currentRz.nom.toUpperCase().indexOf('ОБОРУДОВАН') >= 0) nType = 'ob';
           else nType = 'mat';
        }
        
        var node = {
           uid: 'f2_' + i,
           type: nType,
           kod: kod,
           nom: nom,
           bir: bir,
           hajm: hajm,
           narx: narx,
           children: []
        };
        
        if (nType === 'bl') {
           currentBl = node;
           currentRz.children.push(currentBl);
        } else if (nType === 'rs') {
           if (currentBl) currentBl.children.push(node);
           else currentRz.children.push(node);
        } else {
           // mat yoki ob
           currentRz.children.push(node);
           currentBl = null; // MAT/OB ish turi emas
        }
     }
  }
  return {ok: true, tree: result};
}

function apiF2Qolla(obyekt, oyNom, edits, dopps) {
  var a = sozAsosiy();
  apiOyQosh(obyekt, oyNom);
  
  var col = CFG.C;
  var yozildi = 0;
  
  // 1. Oylarni yozish
  var holatEdits = [];
  for(var i=0; i<edits.length; i++) {
     var e = edits[i];
     var oyl = {};
     oyl[oyNom] = e.hajm;
     holatEdits.push({varaq: e.varaq, row: e.row, oylar: oyl});
  }
  if(holatEdits.length > 0) {
     var r = apiHolatSaqla(obyekt, holatEdits);
     yozildi += r.jami || 0;
  }
  
  // 2. Qoshimcha ishlar (Dopps) - targetRow bo'yicha DESC sort qilish
  if(dopps && dopps.length > 0) {
     var plus = _plusTop(obyekt);
     for(var i=0; i<dopps.length; i++) dopps[i]._idx = i;
     dopps.sort(function(a,b){
        if(b.targetRow !== a.targetRow) return b.targetRow - a.targetRow;
        return a._idx - b._idx;
     });
     
     var dopEdits = [];
     
     for(var i=0; i<dopps.length; i++) {
        var d = dopps[i];
        if(!d.action) {
           // eski formatdagi dop - eng oxiriga qoshiladi
           try {
              var r = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: 0, kod: d.kod, nom: d.nom, birlik: d.bir, hajm: d.hajm, narx: 0});
              var oyl = {}; oyl[oyNom] = d.hajm;
              dopEdits.push({varaq: d.varaq, row: r.blRow, oylar: oyl});
              yozildi++;
           } catch(ex){}
           continue;
        }
        
        try {
           if(d.action === 'add_bl') {
              var r = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: d.targetRow, kod: d.kod, nom: d.nom, birlik: d.bir, hajm: d.hajm, narx: d.narx});
              var newBlRow = r.blRow;
              var oyl = {}; oyl[oyNom] = d.hajm;
              dopEdits.push({varaq: d.varaq, row: newBlRow, oylar: oyl});
              yozildi++;
              
              if(d.children && d.children.length > 0) {
                 for(var j=0; j<d.children.length; j++) {
                    var cRs = d.children[j];
                    if(cRs.type === 'rs' || cRs.type === 'mat' || cRs.type === 'ob') {
                       var rr = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: newBlRow, kod: cRs.kod, nom: cRs.nom, birlik: cRs.bir, norm: 0, narx: cRs.narx});
                       var cOyl = {}; cOyl[oyNom] = cRs.hajm;
                       dopEdits.push({varaq: d.varaq, row: rr.rsRow, oylar: cOyl});
                    }
                 }
              }
           } 
           else if(d.action === 'add_rs') {
              var rr = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: d.targetRow, kod: d.kod, nom: d.nom, birlik: d.bir, norm: 0, narx: d.narx});
              var cOyl = {}; cOyl[oyNom] = d.hajm;
              dopEdits.push({varaq: d.varaq, row: rr.rsRow, oylar: cOyl});
              yozildi++;
           }
        } catch(ex) {
           Logger.log("Dop yozishda xato: " + ex);
        }
     }
     
     if(dopEdits.length > 0) {
        var rDop = apiHolatSaqla(obyekt, dopEdits);
        yozildi += rDop.jami || 0;
     }
  }
  
  // 3. Update Formulas (F2OL, F2MUM, ST_F2, ST_OST) dynamically
  var subObjects = _subObyektlar(obyekt);
  if (subObjects.length > 0) {
     subObjects.forEach(function(subOb) {
        var plus = _plusTop(subOb);
        if(plus) {
           var sheets = plus.getSheets();
           for(var s=0; s<sheets.length; s++) {
              var sh = sheets[s];
              if(sh.getName().indexOf(CFG.LRV_SHEET)===0) {
                 try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
              }
           }
        }
     });
  } else {
     var plus = _plusTop(obyekt);
     if(plus) {
        var sheets = plus.getSheets();
        for(var s=0; s<sheets.length; s++) {
           var sh = sheets[s];
           if(sh.getName().indexOf(CFG.LRV_SHEET)===0) {
              try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
           }
        }
     }
  }
  
  _holatInvalidate(obyekt);
  return {ok: true, xabar: "Жами " + yozildi + " та маълумот хавфсиз сақланди!"};
}

