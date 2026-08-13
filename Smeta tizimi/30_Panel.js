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

  // [WEB API v2] — tashqi sayt (Next.js) uchun yagona darcha → 79_WebAPI.js
  if(action==='api2'){
    var _a=[]; try{ _a=JSON.parse(e.parameter.args||'[]'); }catch(_x){}
    return webApiIshlov({token:e.parameter.token, fn:e.parameter.fn, args:_a});
  }

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
  // ⚡ 2026-07-10: YANADA ZO'R (ULTRA PREMIUM) YECHIM
  // Boss Panel энди apiShartnomaDashboard дан фойдаланади, чунки у ерда
  // накрутка (Якуний суммалар) ва Қўшимча ишлар (Subpodryad) тайёр ҳисобланган!
  var d = (typeof apiShartnomaDashboard === 'function') ? apiShartnomaDashboard() : {shartnomalar:[]};
  // ⚡⚡ 2026-07-10: БУХГАЛТЕРИЯ (тўлов/дебитор/аванс) — аввал Boss панелда БУТУНЛАЙ
  //   кўринмасди (алоҳида, ишлатилмаган API эди). Энди шартнома даражасида қўшилади.
  var bux = (typeof apiBuxDashboard === 'function') ? apiBuxDashboard() : {qatorlar:[]};
  var buxMap = {}; (bux.qatorlar||[]).forEach(function(b){ buxMap[b.no] = b; });

  var objects = [];
  var j = {smeta:0,smetaToza:0,chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,sub:0,fakt:0,f2:0,qoldiq:0,
           tolangan:0,debitor:0,avans:0,leaf:0,
           jamiIshchilar:0, jamiTexnikalar:0, faolZayavkalar:0, halQilinmaganNuqsonlar:0};

  // ERP (Kadr/Texnika) modullaridan haqiqiy statistika (faqat faol narsalar)
  try {
    if(typeof _ishchilarSheet === 'function') {
      var ishSh = _ishchilarSheet();
      j.jamiIshchilar = Math.max(0, ishSh.getLastRow() - 1);
    }
    if(typeof _texnikaSheet === 'function') {
      var texSh = _texnikaSheet();
      j.jamiTexnikalar = Math.max(0, texSh.getLastRow() - 1);
    }
    if(typeof _zayavkaSheet === 'function') {
      var zaySh = _zayavkaSheet();
      // Faol zayavkalar (YANGI yoki TASDIQLANGAN)
      var zRows = zaySh.getLastRow() > 1 ? zaySh.getRange(2, 8, zaySh.getLastRow()-1, 1).getValues() : [];
      j.faolZayavkalar = zRows.filter(function(r) { return r[0] !== 'YOPILGAN' && r[0] !== 'OTKAZ'; }).length;
    }
    if(typeof _nuqsonSheet === 'function') {
      var nuqSh = _nuqsonSheet();
      var nRows = nuqSh.getLastRow() > 1 ? nuqSh.getRange(2, 8, nuqSh.getLastRow()-1, 1).getValues() : [];
      j.halQilinmaganNuqsonlar = nRows.filter(function(r) { return r[0] !== 'YOPILGAN' && r[0] !== 'BEKOR'; }).length;
    }
  } catch(e) {
    console.error("ERP stats error in BossData:", e);
  }

  (d.shartnomalar || []).forEach(function(sh) {
    if(sh.no === '—' && (!sh.obyektlar || !sh.obyektlar.length) && (!sh.qoshlar || !sh.qoshlar.length)) return;

    var gName = sh.no === '—' ? 'Taqsimlanmagan' : 'Shartnoma № ' + sh.no;

    // sh.jamiSmeta = Смета (прямые) + Қўшимча ишлар (прямые).
    // ЛЕКИН бизга ЯКУНИЙ (Накрутка билан) сумма керак!
    var shSmetaToza = sh.smeta + (sh.qoshSmeta || 0);   // ⚡ TOZA (накрутkasiz, прямые) — шаффофлик учун
    var shSmeta = (sh.nakrutka && sh.nakrutka.vsego ? sh.nakrutka.vsego : sh.smeta) + (sh.qoshSmeta || 0);

    // ФАКТ ва Ф-2 лар ҳам накрутка эквиваленти билан
    var shFakt = (sh.jamiFaktNakr != null ? sh.jamiFaktNakr : sh.jamiFakt) || 0;
    var shF2 = (sh.jamiF2Nakr != null ? sh.jamiF2Nakr : sh.jamiF2) || 0;

    var nkRatio = sh.nkRatio || 1;
    var buxRow = buxMap[sh.no] || null;   // {dog_summa, bajarilgan, tolangan, debitor, avans, ...}

    var shNode = {
      nom: gName,
      obyekt: sh.obyekt,
      isGroup: true,
      subItems: [],
      smeta: shSmeta,
      smetaToza: shSmetaToza,
      fakt: shFakt,
      f2: shF2,
      chel: sh.cats.chel || 0,
      mash: sh.cats.mash || 0,
      mat: (sh.cats.mat || 0) + (sh.cats.bez || 0),
      ob: sh.cats.ob || 0,
      mk: sh.cats.mk || 0,
      kab: sh.cats.kab || 0,
      sub: sh.qoshSmeta || 0,
      qoldiq: Math.max(0, shSmeta - shFakt),
      progress: shSmeta > 0 ? Math.min(100, Math.round(shFakt / shSmeta * 100)) : 0,
      f2pct: shFakt > 0 ? Math.min(100, Math.round(shF2 / shFakt * 100)) : 0,
      tolangan: buxRow ? (buxRow.tolangan||0) : 0,
      debitor: buxRow ? (buxRow.debitor||0) : 0,
      avans: buxRow ? (buxRow.avans||0) : 0,
      dogSumma: buxRow ? (buxRow.dog_summa||0) : 0,
      leaf: sh.leaf || 0,
      sana: ''
    };
    
    // Объектларни (obyektlar) қўшамиз
    (sh.obyektlar || []).forEach(function(o) {
       var oSmeta = o.smeta * nkRatio;
       var oFakt = o.fakt * nkRatio;
       var oF2 = o.f2 * nkRatio;
       shNode.subItems.push({
         nom: o.obyekt,
         smeta: oSmeta,
         fakt: oFakt,
         f2: oF2,
         chel: o.chel, mash: o.mash, mat: o.mat, ob: o.ob, mk: o.mk, kab: o.kab,
         qoldiq: Math.max(0, oSmeta - oFakt),
         progress: oSmeta > 0 ? Math.min(100, Math.round(oFakt / oSmeta * 100)) : 0,
         f2pct: oFakt > 0 ? Math.min(100, Math.round(oF2 / oFakt * 100)) : 0,
         leaf: o.leaf || 0
       });
    });
    
    // Субподрядները (qoshlar) қўшамиз
    (sh.qoshlar || []).forEach(function(q) {
       shNode.subItems.push({
         nom: '👷 Субподряд: ' + (q.nomi || q.nom || ''),
         smeta: q.smeta || 0,
         fakt: q.fakt || 0,
         f2: q.f2ol || 0,
         chel: 0, mash: 0, mat: 0, ob: 0, mk: 0, kab: 0, sub: q.smeta || 0,
         qoldiq: Math.max(0, (q.smeta || 0) - (q.fakt || 0)),
         progress: q.smeta > 0 ? Math.min(100, Math.round(q.fakt / q.smeta * 100)) : 0,
         f2pct: q.fakt > 0 ? Math.min(100, Math.round((q.f2ol || 0) / q.fakt * 100)) : 0
       });
    });
    
    objects.push(shNode);

    j.smeta += shSmeta;
    j.smetaToza += shSmetaToza;
    j.fakt += shFakt;
    j.f2 += shF2;
    j.qoldiq += shNode.qoldiq;
    j.leaf += shNode.leaf;
    j.chel += shNode.chel;
    j.mash += shNode.mash;
    j.mat += shNode.mat;
    j.ob += shNode.ob;
    j.mk += shNode.mk;
    j.kab += shNode.kab;
    j.sub += shNode.sub;
    j.tolangan += shNode.tolangan;
    j.debitor += shNode.debitor;
    j.avans += shNode.avans;
  });

  j.progress = j.smeta > 0 ? Math.min(100, Math.round(j.fakt / j.smeta * 100)) : 0;
  j.f2pct = j.fakt > 0 ? Math.min(100, Math.round(j.f2 / j.fakt * 100)) : 0;

  return {
    objects: objects,
    jami: j,
    oylar: [],
    sana: Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd HH:mm') + ' 🚀'
  };
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
  var errs = [];
  var skan=[];   try{ skan=apiPapkaSkan(); }catch(e){ errs.push('apiPapkaSkan: '+(e.message||e)); Logger.log('apiPanelInit/apiPapkaSkan: '+e); }
  var fmtMap={}; try{ fmtMap=apiBoglashOl(); }catch(e){ errs.push('apiBoglashOl: '+(e.message||e)); Logger.log('apiPanelInit/apiBoglashOl: '+e); }
  var kesh={};   try{ kesh=apiKeshHolat(); }catch(e){ errs.push('apiKeshHolat: '+(e.message||e)); Logger.log('apiPanelInit/apiKeshHolat: '+e); }
  var url='';    try{ url=_webAppUrl(); }catch(e){ errs.push('_webAppUrl: '+(e.message||e)); Logger.log('apiPanelInit/_webAppUrl: '+e); }
  var paused=false; try{ paused=tizimMuzlatilganMi(); }catch(e){ errs.push('tizimMuzlatilganMi: '+(e.message||e)); Logger.log('apiPanelInit/tizimMuzlatilganMi: '+e); }
  var aiKalit={bor:false}; try{ if(typeof apiAiKalitHolat==='function') aiKalit=apiAiKalitHolat(); }catch(e){ errs.push('apiAiKalitHolat: '+(e.message||e)); Logger.log('apiPanelInit/apiAiKalitHolat: '+e); }
  return {skan:skan, fmtMap:fmtMap, kesh:kesh, webAppUrl:url, systemPaused:paused, aiKalit:aiKalit, xatolar:errs};
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
      svodCols:  o.svodCols||null,   // svod ustun xaritasini yo'qotmaymiz
      narxTayyor:!!o.narxTayyor
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

/* ⚡⚡⚡ 2026-07-18 SOXTA (АХЛАТ) RAZDEL ANIQLAGICH — lokal sinov stendi natijasi:
 * real LRV fayllarda rz markerли qatorlarning ~26% i haqiqiy razdel EMAS, balki
 * hujjat sarlavhasi / imzo / ustun-raqamlash qatori. Ular Д1-Д3 olmaydi va doim
 * «Тақсимланмаган» da qolib, ierarxiyani va РАЗДЕЛЛАР reestrini buzadi.
 * Bu funksiya YAGONA haqiqat manbai — apiHolatOl, apiRazdelShYasat va
 * apiDarajalarLrvGaYoz uchchalasi ham shundan foydalanadi. */
function _soxtaRzNomMi(nom){
  var s=String(nom==null?'':nom).trim();
  if(!s) return true;
  if(/^\d+([.,]\d+)?$/.test(s)) return true;                    // ustun-raqamlash qatori («3»)
  if(/^[_\-\s.]+$/.test(s)) return true;                        // faqat chiziqcha/probel
  var u=s.toUpperCase().replace(/Ё/g,'Е');
  // Imzo qatorlari: "Составил: _____ АХМЕДОВ" (ko'p pastki chiziq)
  if((s.match(/_/g)||[]).length>=5) return true;
  return /^(НАИМЕНОВАНИ[ЕЯ]|ЛОКАЛЬН(АЯ|ЫЙ)|ОБЪЕКТНАЯ|СВОДН(АЯ|ЫЙ)|ОТКОРРЕКТИРОВАН|СОСТАВИЛ|ПРОВЕРИЛ|УТВЕРЖДА|СОГЛАСОВА|ОСНОВАНИЕ|ЗАКАЗЧИК|ПОДРЯДЧИК|ДИРЕКТОР|ГЛ\.?\s*БУХ|ИТОГО|ВСЕГО|ЖАМИ|ПОДЫТОГ|НДС|ЕДИНИЧНЫЕ|ОБОСНОВАНИ|ШИФР|СМЕТНАЯ\s+СТОИМОСТЬ|В\s+ТЕКУЩИХ|ПРИЛОЖЕНИ|ФОРМА\s*№|АКТ\s|СПРАВКА)/.test(u);
}

/* ⚡⚡⚡ 2026-07-27 KATTA (KO'P SMETALI) OBYEKTLAR UCHUN — F2 IMPORT TEZLIGI.
 * MUAMMO (foydalanuvchi): «Суний кўл ЖАМИ учун Ф2 импорт босдим — 5 дақиқадан бери
 * ЛРВ ҳолати ўқилмоқда деб турибди». Sabab: Suniy ko'l = 14 fayl / 21 644 qator,
 * Amfiteatr = 26 fayl / 10 258 qator. `apiHolatOl(parent, true)` HAMMASINI o'qiydi
 * va (force bilan) har varaqda formulani qayta hisoblaydi → 6 daqiqadan oshadi.
 * HAQIQAT: akt ODATDA BITTA lokalkaga tegishli — 14 tasining hammasi kerak emas.
 * YECHIM: avval LOKALKA tanlanadi, keyin FAQAT o'sha lokalka yuklanadi (soniyalarda).
 * Varaq nomlari «sub||varaq» prefiksini oladi — saqlash yo'li jamlangan rejim bilan
 * AYNAN BIR XIL bo'ladi (apiHolatSaqla/apiBlQosh prefiksni o'zi yechadi). */
/* ⚡⚡⚡ 2026-07-28 YANGI QATOR TASNIFI (foydalanuvchi muammosi #3: «янги қўшилган
 * қаторларда иерархия катаклари бўш қоляпти → Сводка ва Босс ҳисоботларидан
 * ТУШИБ ҚОЛЯПТИ»). apiBlQosh/apiRsQosh yuqoridagi qatordan MEROS oladi, LEKIN agar
 * o'sha manba qatorning o'zida Д1-Д3 BO'SH bo'lsa (ya'ni «📥 LRV га қўй» hech
 * bosilmagan — diagnostika 1469 ta shunday razdel topgan), yangi qator ham bo'sh
 * qoladi. Bu funksiya: qatordan YUQORIGA skanerlab eng yaqin RAZDELni topadi va
 * uning tasnifini РАЗДЕЛЛАР reestridan oladi. */
/* ══════════════════════════════════════════════════════════════════════════
 * ⚡⚡⚡ 2026-07-28 ЗАМЕНА ТАРИХИ (foydalanuvchi muammosi #2)
 * «Замена қилинганда нима ЎРНИГА келгани номаълум бўлиб қоляпти. Масалан
 *  "Гравий" ўрнига "Қазиш ишлари" замена қилинса, сметада фақат "Қазиш ишлари"
 *  қолиб, НЕГА қўшилгани тушунарсиз.»
 * TALAB: constanta ustunlarga (ШИФР/НОМ/ОБЪЁМ/НАРХ/СУММА) TEGMASDAN.
 * YECHIM (2 qatlam, ikkalasi ham hisob-kitobga TA'SIR QILMAYDI):
 *   1) NOM katagiga IZOH (note) — sichqoncha olib borilsa ko'rinadi;
 *   2) `_ЗАМЕНА_ТАРИХ` varag'i — to'liq audit (sana, kim, obyekt, varaq, qator,
 *      eski nom/kod/hajm → yangi nom/kod/hajm, summa).
 * ══════════════════════════════════════════════════════════════════════════ */
var _ZAM_SH = '_ЗАМЕНА_ТАРИХ';
function _zamenaTarixYoz(rec){
  try{
    var ss=SpreadsheetApp.getActive();
    var sh=ss.getSheetByName(_ZAM_SH);
    if(!sh){
      sh=ss.insertSheet(_ZAM_SH);
      sh.getRange(1,1,1,11).setValues([['ВАҚТ','ОБЪЕКТ','ВАРАҚ','ҚАТОР','ТУР',
        'ЭСКИ (нима ўрнига)','ЭСКИ КОД','ЯНГИ (нима келди)','ЯНГИ КОД','ҲАЖМ','КИМ']])
        .setFontWeight('bold').setBackground('#7c2d12').setFontColor('#ffffff');
      sh.setFrozenRows(1);
      sh.setColumnWidth(2,180); sh.setColumnWidth(6,300); sh.setColumnWidth(8,300);
      try{ sh.hideSheet(); }catch(e){}
    }
    var email=''; try{ email=Session.getActiveUser().getEmail(); }catch(e){}
    sh.appendRow([new Date(), rec.obyekt||'', rec.varaq||'', rec.row||'', rec.tur||'',
      rec.eskiNom||'', rec.eskiKod||'', rec.yangiNom||'', rec.yangiKod||'',
      rec.hajm||'', email]);
  }catch(e){ Logger.log('Zamena tarix: '+e); }
}
/* Almashtirilayotgan (eski) qator ma'lumotini o'qiydi */
function _zamenaEskiOl(sh, row){
  try{
    if(!row || row<1 || row>sh.getLastRow()) return null;
    var col=CFG.C;
    var v=sh.getRange(row,1,1,col.MARKER).getValues()[0];
    return {nom:String(v[col.NOM-1]||'').trim(), kod:String(v[col.KOD-1]||'').trim(),
            bir:String(v[col.BIRLIK-1]||'').trim(), hajm:_toNum(v[col.E-1])};
  }catch(e){ return null; }
}

function _rzTasnifTop(sh, row){
  try{
    var col=CFG.C, xar=_rzDarajaXarita();
    if(!xar) return null;
    var yuq=Math.max(1, row-400), n=row-yuq+1;
    if(n<1) return null;
    var g=sh.getRange(yuq,1,n,col.MARKER).getValues();
    for(var i=g.length-1;i>=0;i--){
      var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
      if(mk!=='rz') continue;
      var nom='';
      for(var c=0;c<8;c++){ var v=String(g[i][c]||'').trim();
        if(v && /[А-ЯЁA-Za-zА-яёa-z]/.test(v)){ nom=v; break; } }
      if(!nom) return null;
      function N(s){
        s=String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
        var L={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У'};
        var o=''; for(var k=0;k<s.length;k++) o+=(L[s[k]]||s[k]); return o;
      }
      return {d:(xar['*||'+N(nom)]||null), rzNom:nom};
    }
  }catch(e){}
  return null;
}

/* ⚡⚡⚡ 2026-07-27 IERARXIYA ZAXIRA MANBAI (foydalanuvchi: «иерархияда тўлдирдим,
 * лекин смета тарафда очмаяпти — ҳаммаси бир қаватда»). SABAB: Д1-Д3 РАЗДЕЛЛАР
 * реестрида бор, лекин ЛРВ'нинг QAVAT1-3 устунларига ЁЗИЛМАГАН («📥 LRV га қўй»
 * босилмаган ёки эски кеш). Дарахт эса ФАҚАТ ЛРВ устунларини ўқирди → гуруҳ
 * даражалари яратилмасди.
 * ЕЧИМ: реестрдан (obyekt+rzNom → d1,d2,d3) харита тузиб, ЛРВ устуни БЎШ бўлса
 * ЎША ЗАХИРАДАН оламиз. Энди «LRV га қўй» босиш ШАРТ ЭМАС — реестрни тўлдириш
 * кифоя, иерархия дарҳол ишлайди. */
function _rzDarajaXarita(){
  var xar = {};
  try{
    var sh = SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
    if(!sh || sh.getLastRow()<2) return xar;
    function N(s){
      s=String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
      var L2C={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У'};
      var o=''; for(var i=0;i<s.length;i++) o+=(L2C[s[i]]||s[i]);
      return o;
    }
    var eski = String(sh.getRange(1,2).getValue()||'').toUpperCase().indexOf('СМЕТА')<0;
    var v = sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
    for(var i=0;i<v.length;i++){
      var ob=String(v[i][0]||'').trim(); if(!ob) continue;
      var off = eski ? 0 : 1;
      var rz=String(v[i][off+1]||'').trim();
      var d1=String(v[i][off+2]||'').trim();
      if(!rz || !d1) continue;
      // Kalit: obyekt+rz VA faqat rz (ko'p smetali obyektda sub nomi farq qiladi)
      var d={d1:d1, d2:String(v[i][off+3]||'').trim(), d3:String(v[i][off+4]||'').trim()};
      xar[N(ob)+'||'+N(rz)] = d;
      if(!xar['*||'+N(rz)]) xar['*||'+N(rz)] = d;
    }
  }catch(e){}
  return xar;
}

function apiF2LokalkaRoyxat(obyekt){
  var subs = _subObyektlar(obyekt) || [];
  return {ok:true, parent:obyekt, kop:(subs.length>1), lokalkalar:subs};
}

function apiHolatOlLokalka(parent, sub, forceRefresh){
  var r = apiHolatOl(sub, forceRefresh);
  var tree = (r && r.tree) || [];
  tree.forEach(function(rz){
    rz.lokalka = sub;
    _varaqPrefiks(rz, sub);
  });
  return {tree:tree, oylar:(r&&r.oylar)||[], jami:(r&&r.jami)||null,
          jamlangan:true, subs:[sub], lokalka:sub, bittaLokalka:true};
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
        // ⚡⚡⚡ 2026-07-13 KRITIK TUZATISH: forceRefresh REKURSIYAGA UZATILMASDI!
        // F2 Импорт modal "apiHolatOl(obyekt, true)" (majburiy yangi) so'rasa ham,
        // sub-obyektlar baribir ESKI KESHDAN o'qilardi. Natija: yangi yaratilgan oy
        // ustuni (masalan "Март 2026") oylar ro'yxatida KO'RINMASDI — foydalanuvchi
        // uni tanlay olmasdi, o'chira olmasdi, yozuvlarini ko'ra olmasdi.
        var r = apiHolatOl(sub, forceRefresh);      // rekursiya — forceRefresh MEROS
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

  // ⚡ 2026-07-27: РАЗДЕЛЛАР reestri — Д1-Д3 uchun ZAXIRA manba (LRV bo'sh bo'lsa)
  var _rzXar = null;
  try{ _rzXar = _rzDarajaXarita(); }catch(eX){ _rzXar = null; }
  function _rzXarN(s){
    s=String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
    var L2C={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У'};
    var o=''; for(var i2=0;i2<s.length;i2++) o+=(L2C[s[i2]]||s[i2]);
    return o;
  }

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
        // ⚡⚡⚡ 2026-07-18 SOXTA RAZDEL FILTRI (lokal sinov stendi bilan isbotlangan:
        // 27 Amfiteatr LRV faylida 414 rz dan 108 tasi (26%) — «НАИМЕНОВАНИЕ СТРОЙКИ»,
        // «ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ №», «ОТКОРРЕКТИРОВАННО...», «Составил: ___»,
        // hatto USTUN-RAQAMLASH qatori «3» — АХЛАТ sarlavha/imzo qatorlari). Ular
        // РАЗДЕЛЛАР reestrini ifloslantirib, Д1-Д3 olmagani uchun DOIM «Тақсимланмаган»
        // da qolib, ierarxiyani buzardi. _classify 2026-07-12 da tuzatilgan, LEKIN
        // MAVJUD LRV_PLUS fayllarida eski markerlar muzlab qolgan (exist marker
        // _classify'dan ustun) — shuning uchun O'QISH paytida ham himoya qilamiz:
        // axlat nomli rz YARATILMAYDI, curRz=null bo'ladi va keyingi ish qatori
        // SINTETIK razdel (obyekt nomi + Д1-Д3) ostida to'g'ri joylanadi.
        if(_soxtaRzNomMi(rzNom)){ curRz=null; curBl=null; continue; }
        // ⚡⚡⚡ 2026-07-13 QAYTA TUZATILDI (foydalanuvchi QAT'IY qarori — ичма-ич RZ
        // misoli: "РАЗДЕЛ: ДВЕРИ,ОКНА,ВИТРАЖИ" ичида "ДВЕРИ"): avval ketma-ket rz
        // qatorlarda OLDINGI (bola olmagan) rz daraxtdan OLIB TASHLANARDI — bu
        // "dekorativ sarlavha" farazi bilan yozilgan edi, lekin haqiqatda TASHQI
        // (ota) razdel ham MUHIM tasnif darajasi bo'lishi mumkin (ichida yana
        // ichki RZ va undan keyin haqiqiy ishlar bo'lishi mumkin — chuqurlik
        // cheksiz). Foydalanuvchi qarori: HECH QAYSI RZ pop qilinmasin — har biri
        // o'z alohida daraxt tugini sifatida qoladi (bo'sh bo'lsa ham), odam
        // РАЗДЕЛЛАР reestrida Д-1..Д-5 orqali o'zi tasniflaydi.
        // ⚡⚡⚡ 2026-07-13 YANGI (foydalanuvchi talabi — РАЗДЕЛЛАР reestri YAGONA
        // manba bo'lishi kerak, "umuman xatosiz"): avval daraxt guruhlash (Panel.html
        // _buildTree) alohida `pathMap` orqali FAQAT NOM bo'yicha Д1-Д3'ni qidirardi —
        // ko'p smetali obyektda bir xil nomli RZ turli fayllarda TURLI Д-klassifikatsiyaga
        // ega bo'lishi mumkin, nom-only qidiruv ULARNI ARALASHTIRARDI. Lekin
        // `apiDarajalarLrvGaYoz` allaqachon HAR BIR qatorga TO'G'RI (aynan shu smeta+rz
        // uchun) Д1-Д3 ni QAVAT1-3 ustunlariga yozib qo'ygan — shuni TO'G'RIDAN-TO'G'RI
        // shu tugunga o'qib olamiz. Endi Panel.html hech qanday alohida nom-bo'yicha
        // qidiruv qilmaydi — faqat shu YOZILGAN qiymatni ishlatadi (100% mos, kolliziyasiz).
        curRz={type:'rz', nom:rzNom, varaq:nm, row:r, children:[],
          d1:String(g[i][col.QAVAT1-1]||'').trim(),
          d2:String(g[i][col.QAVAT2-1]||'').trim(),
          d3:String(g[i][col.QAVAT3-1]||'').trim()};
        // ⚡⚡⚡ 2026-07-27: LRV ustuni BO'SH bo'lsa — РАЗДЕЛЛАР reestridan olamiz
        // (yuqoridagi `_rzDarajaXarita` izohiga qarang). «LRV га қўй» shart emas.
        if(!curRz.d1 && _rzXar){
          var _dz = _rzXar[_rzXarN(obyekt)+'||'+_rzXarN(rzNom)] || _rzXar['*||'+_rzXarN(rzNom)];
          if(_dz){ curRz.d1=_dz.d1; curRz.d2=_dz.d2; curRz.d3=_dz.d3; curRz.dManba='реестр'; }
        }
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
        // ⚡⚡⚡ 2026-07-16 RAZDELSIZ SMETA TUZATISHI (foydalanuvchi: "СИСТЕМЫ
        // ОПОВЕЩЕНИЯ lokalkasiga Д1-Д3 berdim, baribir Тақсимланмаганда qolayapti"):
        // rz markeri YO'Q smetada bl/mat qatorlar avval daraxt ILDIZIGA to'g'ridan-
        // to'g'ri tushardi — bunday tugunlarda d1/d2/d3 bo'lmagani uchun _buildTree
        // ularni klassifikatsiyalay olmay «Тақсимланмаган»ga tashlardi. Endi ular
        // SINTETIK rz ostiga olinadi; uning Д1-Д3 si shu qatorning QAVAT1-3 idan
        // o'qiladi (apiDarajalarLrvGaYoz razdelsiz smetaning smDflt qiymatlarini
        // BARCHA qatorlarga yozadi — demak birinchi qatorda ham bor).
        if(!curRz){
          curRz={type:'rz', nom:obyekt, varaq:nm, row:r, children:[], sintetik:true,
            d1:String(g[i][col.QAVAT1-1]||'').trim(),
            d2:String(g[i][col.QAVAT2-1]||'').trim(),
            d3:String(g[i][col.QAVAT3-1]||'').trim()};
          tree.push(curRz);
        }
        curRz.children.push(blNode);
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
  /* ⚡⚡⚡ 2026-08-13 ПЕРЕРАСЧЁТ (MANFIY HAJM) TUZATILDI
   * Foydalanuvchi: «pererashchet obyomlar bor... avval olgan obyomimni MINUS
   * qilganman, lekin F2 da o'sha minusni smetadagi joyiga zamena yoki
   * qo'shimcha qilib bog'lasam UMUMAN YOZMAYAPTI».
   * SABAB: bu yerda `hajm<=0` bo'lsa xato tashlanardi — ya'ni tuzatish
   * (korrektirovka) qatorini smetaga yozishning YO'LI YO'Q edi.
   * Tizim F2 fayldan manfiy перерасчет qatorlarini O'QIY olardi, lekin
   * YOZA olmasdi — mantiq nomuvofiqligi.
   * ENDI: manfiy hajm RUXSAT ETILADI (korrektirovka), faqat AYNAN 0 va
   * son bo'lmagan qiymat rad etiladi (ular ma'nosiz qator yaratadi). */
  if(!isFinite(hajm)) throw 'Ҳажм сон эмас';
  if(hajm===0) throw 'Ҳажм 0 бўлмаслиги керак (манфий — перерасчёт учун — мумкин)';
  var plus=_plusTop(obyekt); if(!plus) throw 'LRV_PLUS топилмади';
  var sh=plus.getSheetByName(varaqNom); if(!sh) throw 'Варақ топилмади';
  if(afterRow<1||afterRow>sh.getLastRow()) throw 'afterRow нотўғри';
  var col=CFG.C, CL=_cl;
  sh.insertRowsAfter(afterRow,1);
  var r=afterRow+1;
  var kod = String(params.kod || '').trim();
  sh.getRange(r,col.KOD).setValue(kod);
  sh.getRange(r,col.NOM).setValue(nom);
  sh.getRange(r,col.BIRLIK).setValue(birlik);
  sh.getRange(r,col.E).setValue(hajm);
  sh.getRange(r,col.F).setValue(hajm);
  // ⚡ 2026-07-06: zamena bo'lsa '~', oddiy qo'shimcha '+' — hisobotlarda ajratish uchun.
  // ⚡ 2026-07-16: tur — 'bl' (default) | 'mat' | 'ob'. Avval "+ Доп" HAMMA narsani
  // bl+ (ИШ) qilib qo'shardi (foydalanuvchi: "resurs qo'shsam ham +ish deb qo'shadi").
  // Endi material/uskuna o'z markeri (mat+/ob+) bilan qo'shiladi — daraxtda ham,
  // ЖАМИ hisobida ham (leafF SUMIF mat+/ob+ ni sanaydi) to'g'ri tur bo'ladi.
  var tur=(params.tur==='mat'||params.tur==='ob')?params.tur:'bl';
  sh.getRange(r,col.MARKER).setValue(tur + (params.zamena ? '~' : '+'));
  sh.getRange(r,col.FAKT).setValue(0);
  sh.getRange(r,col.QOLDIQ).setFormula('=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r);
  // ⚡ 2026-07-06: avval naive =SUM($AE:$ZZ) edi (obyom+narx+summa aralash + #N/A xavfi) —
  // endi _f2sum aniq ОБЪЁМ ustunlarini sanaydi (grid'ga bog'liq emas)
  sh.getRange(r,col.F2OL).setFormula(_f2sum(r,0,_f2OyCols(sh)));
  sh.getRange(r,col.F2MUM).setFormula('=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r);
  sh.getRange(r,col.SMETA).setValue(0);
  // Ierarxiya ustunlarini nusxalash
  var hc = sh.getRange(afterRow, col.QAVAT1, 1, 5).getValues()[0];
  // ⚡ 2026-07-28: manba qatorda Д1 BO'SH bo'lsa — РАЗДЕЛЛАР reestridan to'ldiramiz
  // (aks holda yangi qator hisobotlardan tushib qolardi — muammo #3).
  if(!String(hc[0]||'').trim()){
    var _tz = _rzTasnifTop(sh, afterRow);
    if(_tz && _tz.d){ hc[0]=_tz.d.d1; hc[1]=_tz.d.d2; hc[2]=_tz.d.d3; }
    if(_tz && !String(hc[4]||'').trim()) hc[4]=_tz.rzNom;
  }
  sh.getRange(r, col.QAVAT1, 1, 3).setValues([[hc[0], hc[1], hc[2]]]);
  sh.getRange(r, col.H_RAZDEL).setValue(hc[4]);
  if(tur==='bl') sh.getRange(r,col.H_BL).setValue(nom);   // H_BL faqat ish qatoriga
  else sh.getRange(r,col.H_BL).setValue(hc[3]);

  /* ⚡⚡⚡ 2026-07-28 ЗАМЕНА/ҚЎШИМЧА ИЗОҲИ (muammo #2) — constanta ustunlarga TEGMAYDI,
   * faqat NOM katagiga IZOH (note) qo'yiladi + `_ЗАМЕНА_ТАРИХ` ga audit yoziladi. */
  try{
    var _eski = params.zamena ? _zamenaEskiOl(sh, _toNum(params.droppedOnRow)||afterRow) : null;
    var _sana = Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','dd.MM.yyyy');
    var _izoh;
    if(params.zamena && _eski && _eski.nom){
      _izoh = '🔄 ЗАМЕНА\n«'+_eski.nom+'»'+(_eski.kod?(' ('+_eski.kod+')'):'')+' ЎРНИГА\n'
            + '→ «'+nom+'»'+(kod?(' ('+kod+')'):'')+'\nҲажм: '+hajm+' '+birlik+'\nСана: '+_sana;
      _zamenaTarixYoz({obyekt:obyekt, varaq:varaqNom, row:r, tur:'ЗАМЕНА '+tur,
        eskiNom:_eski.nom, eskiKod:_eski.kod, yangiNom:nom, yangiKod:kod, hajm:hajm});
    } else {
      _izoh = '➕ ҚЎШИМЧА (сметада йўқ эди)\n«'+nom+'»'+(kod?(' ('+kod+')'):'')
            + '\nҲажм: '+hajm+' '+birlik+'\nСана: '+_sana;
      _zamenaTarixYoz({obyekt:obyekt, varaq:varaqNom, row:r, tur:'ҚЎШИМЧА '+tur,
        eskiNom:'', eskiKod:'', yangiNom:nom, yangiKod:kod, hajm:hajm});
    }
    sh.getRange(r,col.NOM).setNote(_izoh);
  }catch(eZm){}
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  sh.getRange(r,col.KOD).setFontWeight('bold').setFontColor('#0070c0');
  sh.getRange(r,col.NOM).setFontWeight('bold').setFontColor('#0070c0').setWrap(true);
  sh.getRange(r,col.BIRLIK).setFontWeight('bold').setFontColor('#0070c0');
  // ⚡ 2026-07-12: F2 uid'ni KOD katagiga NOTE qilib yozamiz — takroriy F2 saqlash
  // (masalan foydalanuvchi "0 chiqdi" deb qayta urinsa) ХУДДИ ШУ qatorni QAYTADAN
  // qo'shib yubormaslik uchun (_f2DopUidQatorTop shu notedan qidiradi).
  if(params.f2Uid) sh.getRange(r,col.KOD).setNote(String(params.f2Uid));

  // ⚡ 2026-07-05 TEZLIK: f2_mode'da lrvYoz yakunga qoldiriladi (apiF2Qolla BIR marta qiladi)
  if(!params.f2_mode){ lrvYoz(obyekt, sh); SpreadsheetApp.flush(); }

  return {ok:true, blRow:r, nRows:1, xabar:nom+' (янги иш тури) қўшилди — энди ресурс қўшинг'};
}

/* ⚡ 2026-07-12 YANGI: RAZDEL QO'SHISH — smetada UMUMAN YO'Q bo'lim (masalan aktda
 * bor, smetada yo'q ishlar guruhi) uchun varaq OXIRIGA yangi 'rz+' qator ochadi.
 * F2 Импортдаги «➕ Доп раздел» va kelajakdagi qo'lda-razdel oqimlari uchun.
 * params = {obyekt, varaq (sub||varaq bo'lishi mumkin), nom, afterRow(ixtiyoriy, 0=oxiriga)} */
function apiRzQosh(params){
  var obyekt=params.obyekt, varaqNom=params.varaq;
  if (String(varaqNom).indexOf('||') >= 0) {
    var _p = String(varaqNom).split('||');
    obyekt = _p[0]; varaqNom = _p[1];
  }
  var nom=String(params.nom||'').trim();
  if(!obyekt||!varaqNom||!nom) throw 'Параметрлар тўлиқ эмас (раздел номи керак)';
  var plus=_plusTop(obyekt); if(!plus) throw 'LRV_PLUS топилмади';
  var sh=plus.getSheetByName(varaqNom); if(!sh) throw 'Варақ топилмади: '+varaqNom;
  var col=CFG.C;
  var afterRow=Number(params.afterRow)||0;
  if(afterRow<1 || afterRow>sh.getLastRow()) afterRow=sh.getLastRow();   // default: varaq OXIRI
  sh.insertRowsAfter(afterRow,1);
  var r=afterRow+1;
  sh.getRange(r,col.NOM).setValue(nom);
  sh.getRange(r,col.MARKER).setValue('rz+');
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG.rz||'#FFFF00');
  sh.getRange(r,col.NOM).setFontWeight('bold').setWrap(true);
  if(params.f2Uid) sh.getRange(r,col.KOD).setNote(String(params.f2Uid));
  if(!params.f2_mode){ lrvYoz(obyekt, sh); SpreadsheetApp.flush(); }
  return {ok:true, rzRow:r, xabar:'Янги раздел қўшилди: '+nom};
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
  /* ⚡⚡⚡ 2026-08-13: avval `norm<0` bo'lsa «Параметрлар тўлиқ эмас» xatosi
   * tashlanardi — перерасчёт (manfiy tuzatish) resursini smetaga yozish
   * IMKONSIZ edi. Endi manfiy norma ruxsat etiladi (apiBlQosh bilan bir xil
   * mantiq). Son bo'lmagan qiymat esa rad etiladi. */
  if(!obyekt||!varaqNom||!blRow||!nom||!birlik)
    throw 'Параметрлар тўлиқ эмас';
  if(!isFinite(norm)) throw 'Норма сон эмас';
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
  var kod = String(params.kod || '').trim();
  sh.getRange(r,col.KOD).setValue(kod);
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
  // Ierarxiya ustunlarini ota ish turidan nusxalash
  var hc = sh.getRange(blRow, col.QAVAT1, 1, 5).getValues()[0];
  // ⚡ 2026-07-28 (muammo #3): ota qatorda Д1 bo'sh bo'lsa — reestrdan to'ldiramiz,
  // aks holda yangi resurs Сводка/Босс hisobotlaridan tushib qolardi.
  if(!String(hc[0]||'').trim()){
    var _tz2 = _rzTasnifTop(sh, blRow);
    if(_tz2 && _tz2.d){ hc[0]=_tz2.d.d1; hc[1]=_tz2.d.d2; hc[2]=_tz2.d.d3; }
    if(_tz2 && !String(hc[4]||'').trim()) hc[4]=_tz2.rzNom;
  }
  sh.getRange(r, col.QAVAT1, 1, 5).setValues([[hc[0], hc[1], hc[2], hc[3], hc[4]]]);
  sh.getRange(r,1,1,col.ST_OST).setBackground(CFG.RANG_QOSH);
  sh.getRange(r,col.KOD).setFontWeight('normal').setFontColor('#000000');
  sh.getRange(r,col.NOM).setFontWeight('normal').setFontColor('#000000').setWrap(true);
  sh.getRange(r,col.BIRLIK).setFontWeight('normal').setFontColor('#000000');
  // ⚡ 2026-07-12: F2 uid'ni KOD katagiga NOTE qilib yozamiz — takroriy F2 saqlashda
  // xuddi shu resursni QAYTA qo'shib yubormaslik uchun (apiBlQosh bilan bir xil mexanizm).
  if(params.f2Uid) sh.getRange(r,col.KOD).setNote(String(params.f2Uid));
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
      var notes = {};  // key: "row,col" → note

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
                if (ov.uid) { notes[e.row + ',' + c] = ov.uid; }
                else if (ov.obyom === 0 || ov.obyom === '') { notes[e.row + ',' + c] = ''; } // uzish
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
        
        // Agar notelar yozish kerak bo'lsa
        var noteKeys = Object.keys(notes);
        if (noteKeys.length > 0) {
           var existingNotes = rng.getNotes();
           for (var k=0; k<noteKeys.length; k++) {
               var rc = noteKeys[k].split(',');
               var r = parseInt(rc[0]), c = parseInt(rc[1]);
               existingNotes[r - minR][c - minC] = notes[noteKeys[k]];
           }
           rng.setNotes(existingNotes);
        }
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
      // ⚡ 2026-08-11: F2 jarayoni qotib qolmasligi uchun (15+ faylda formula yangilash 6 daqiqadan
      // oshib ketardi), agar ustun allaqachon mavjud bo'lsa ortiqcha "repair" qilinmaydi.
      // if(n>=1){ try { _oyFormulaToldur(sh, start, last); } catch(ex){} }
      // try { _oyYigindiFormulalarYangila(sh); } catch(ex){}
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
  // ⚡ 2026-07-13: yakka obyekt yo'lida ham HOLAT KESHI tozalanadi — avval faqat
  // jamlangan (parent) yo'lda tozalanardi, sub-obyektning o'z keshi eskiligicha
  // qolib, yangi oy ro'yxatlarda ko'rinmasdi.
  _holatInvalidate(obyekt);
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
  // ⚡⚡⚡ 2026-07-13 YANGI TUZILISH (foydalanuvchi CONST qarori): reestr endi
  //   ОБЪЕКТ | СМЕТА | RZ НОМ | Д-1..Д-5  (8 ustun).
  //   - СМЕТА = qaysi lokalka/smeta faylidan kelgani (ko'p smetali obyektda farqlash
  //     uchun SHART — avval bir xil nomli rz lar qaysi fayldan ekani noma'lum edi).
  //   - RZ topilmagan smeta ham BITTA bo'sh-RZ qator bilan chiqadi (foydalanuvchi:
  //     «rz bo'lmasa ham fayl ko'rinsin, o'zim ajrataman») — hech narsa qolib ketmaydi.
  var subObjects=_subObyektlar(obyekt);
  var targets = subObjects.length ? subObjects : [obyekt];

  // 1. Har smeta (sub-obyekt) fayli uchun RZ ro'yxatini ALOHIDA yig'amiz
  var a=sozAsosiy(), col=CFG.C;
  var perSmeta=[];   // [{smeta, rzList:[...]}]
  var foundAny=false, yoqFayl=[];
  for(var t=0;t<targets.length;t++){
    var plus=_plusTop(targets[t]);
    if(!plus){ yoqFayl.push(targets[t]); continue; }
    foundAny=true;
    var rzSet={}, rzOrder=[];
    var sheets=plus.getSheets();
    for(var s=0;s<sheets.length;s++){
      var sh=sheets[s];
      if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
      var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
      if(n<1) continue;
      var g=sh.getRange(start,1,n,col.MARKER).getValues();
      // ⚡⚡⚡ 2026-07-13 KRITIK TUZATISH (foydalanuvchi aniq ko'rsatdi — "ДВЕРИ,ОКНА,
      // ВИТРАЖИ" ichida ichki "ДВЕРИ" misoli): avval RZ faqat "keyingi RZ'gacha
      // kamida bitta bl/mat/ob bolasi bo'lsa" reestrga qo'shilardi (`curHas` sharti).
      // ICHMA-ICH RZ holatida (tashqi RZ darhol ichki RZ bilan davom etadi, o'z
      // TO'G'RIDAN-TO'G'RI bolasi yo'q) — TASHQI RZ shu sabab HECH QACHON reestrga
      // tushmasdi, faqat "pastdagi" (ichki) RZ qolardi. Foydalanuvchi qarori: bunday
      // ierarxiyani avtomatik aniqlashga urinmaymiz (chuqurlik cheksiz bo'lishi
      // mumkin) — har bir RZ markerini, bola bor-yo'qligidan qat'iy nazar, DARHOL
      // o'z alohida qatori sifatida yozamiz; Д-1..Д-5 orqali odam o'zi tasniflaydi.
      for(var i=0;i<n;i++){
        var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
        if(mk!=='rz') continue;
        var rzNom='';
        for(var c=0;c<8;c++){
          var cv=String(g[i][c]||'').trim();
          if(cv && /[А-ЯЁA-Za-zА-яёa-z]/.test(cv)){ rzNom=cv; break; }
        }
        // ⚡⚡⚡ 2026-07-18: AXLAT rz reestrga TUSHMAYDI (_soxtaRzNomMi — sarlavha/imzo/
        // ustun-raqamlash qatorlari). Lokal sinovda 414 rz dan 108 tasi shunday edi —
        // ular reestrni ifloslantirib, foydalanuvchi Д1-Д3 to'ldirishda chalkashardi.
        if(rzNom && !_soxtaRzNomMi(rzNom) && !rzSet[rzNom]){ rzSet[rzNom]=true; rzOrder.push(rzNom); }
      }
    }
    perSmeta.push({smeta:targets[t], rzList:rzOrder});
  }
  if(!foundAny) return {ok:false, xabar:'LRV_PLUS топилмади'};

  // 2. РАЗДЕЛЛАР varaqini tayyor qilamiz (8 ustun; eski 7-ustunli bo'lsa MIGRATSIYA)
  var dsh=_razdelShTayyorla();

  // 3. Allaqachon bor (obyekt+smeta+rz) kombinatsiyalarini aniqlaymiz.
  //    Eski (migratsiyadan qolgan, СМЕТА bo'sh) qatorlar: obyekt+rz mos kelsa,
  //    BARCHA smetalar uchun "bor" hisoblanadi (dublikat ochilmasin).
  var exist={}, existLegacy={};
  if(dsh.getLastRow()>=2){
    var ev=dsh.getRange(2,1,dsh.getLastRow()-1,3).getValues();
    for(var i=0;i<ev.length;i++){
      var eob=String(ev[i][0]||'').trim(), esm=String(ev[i][1]||'').trim(), ern=String(ev[i][2]||'').trim();
      if(eob!==obyekt) continue;
      if(esm) exist[esm+'||'+ern]=true;
      else if(ern) existLegacy[ern]=true;
      else if(!ern && esm) exist[esm+'||']=true;
    }
  }

  // 4. FAQAT yangi qatorlarni qo'shamiz (mavjudlarga TEGMAYMIZ)
  var newRows=[], jamiRz=0;
  perSmeta.forEach(function(ps){
    jamiRz += ps.rzList.length;
    if(!ps.rzList.length){
      // RZ yo'q smeta — bo'sh-RZ qator (foydalanuvchi D larni o'zi to'ldiradi,
      // apiDarajalarLrvGaYoz uni shu smetaning BARCHA qatorlariga qo'llaydi)
      if(!exist[ps.smeta+'||']) newRows.push([obyekt, ps.smeta, '', '', '', '', '', '']);
      return;
    }
    ps.rzList.forEach(function(rzNom){
      if(exist[ps.smeta+'||'+rzNom] || existLegacy[rzNom]) return;
      newRows.push([obyekt, ps.smeta, rzNom, '', '', '', '', '']);
    });
  });
  if(newRows.length){
    var appendFrom=dsh.getLastRow()+1;
    dsh.getRange(appendFrom,1,newRows.length,8).setValues(newRows)
      .setBackground('#eef4ff');
    dsh.getRange(appendFrom,1,newRows.length,3).setBackground('#dde8f8');
  }

  dsh.showSheet();
  return {ok:true, xabar:jamiRz+' RZ ('+newRows.length+' yangi qo\'shildi)'+
    (yoqFayl.length?(' ⚠ LRV yo\'q: '+yoqFayl.join(', ')):'')};
}

/* РАЗДЕЛЛАР varag'ini 8-ustunli formatda olish/yaratish; eski 7-ustunli (СМЕТА siz)
 * format aniqlansa — B o'rniga yangi СМЕТА ustuni QO'SHILADI (mavjud D qiymatlar
 * saqlanadi, СМЕТА bo'sh qoladi — apiDarajalarLrvGaYoz ularni legacy deb o'qiydi). */
function _razdelShTayyorla(){
  var ss=SpreadsheetApp.getActive();
  var dsh=ss.getSheetByName(CFG.RAZDEL_SH);
  var HDR=['ОБЪЕКТ','СМЕТА (файл)','RZ НОМ','Д-1','Д-2','Д-3','Д-4 (авто)','Д-5 (авто)'];
  if(!dsh){
    dsh=ss.insertSheet(CFG.RAZDEL_SH);
    dsh.getRange(1,1,1,8).setValues([HDR])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    dsh.setColumnWidth(1,130); dsh.setColumnWidth(2,240); dsh.setColumnWidth(3,380);
    dsh.setColumnWidth(4,120); dsh.setColumnWidth(5,120); dsh.setColumnWidth(6,120);
    dsh.setColumnWidth(7,160); dsh.setColumnWidth(8,160);
    dsh.setFrozenRows(1);
    return dsh;
  }
  var b1=String(dsh.getRange(1,2).getValue()||'').trim().toUpperCase();
  if(b1.indexOf('СМЕТА')<0){
    // eski format — СМЕТА ustunini B ga kiritamiz (ma'lumot yo'qolmaydi)
    dsh.insertColumnAfter(1);
    dsh.getRange(1,1,1,8).setValues([HDR])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    dsh.setColumnWidth(2,240);
  }
  return dsh;
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

  // ⚡ 2026-07-13 YANGI TUZILISH: ОБЪЕКТ | СМЕТА | RZ | Д1-5.
  //   smetaMap = {smeta → {rz:{rzNom→D[]}, dflt:D[]|null}} — dflt = RZ bo'sh qator
  //   (rz'siz smeta uchun: uning D lari shu smetaning BARCHA qatorlariga qo'llanadi).
  //   legacyRz = migratsiyadan qolgan СМЕТА'siz qatorlar (istalgan smetaga mos).
  // ⚡⚡⚡ 2026-07-16 TUZATILDI (foydalanuvchi: "РАЗДЕЛЛАРга Д1-Д3 yozdim, daraxt
  // ochmayapti"): nomlar avval QAT'IY tenglik (===) bilan solishtirilardi —
  // "Амфитеатр" (kirill) vs "Amfiteatr" (lotin), qo'sh probel, katta-kichik harf
  // farqi bo'lsa JIMGINA hech narsa yozilmasdi. Endi barcha kalitlar _rzKeyNorm
  // (upper + probel yig'ish + lotin-kirill o'xshash harflar) bilan normalizatsiya
  // qilinadi — ko'rinishi bir xil nomlar endi hech qachon "boshqa" hisoblanmaydi.
  function _rzKeyNorm(s){
    s=String(s==null?'':s).toUpperCase().replace(/\s+/g,' ').trim();
    var L2C={'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У'};
    var out=''; for(var i=0;i<s.length;i++){ out+=(L2C[s[i]]||s[i]); }
    return out;
  }
  var obKey=_rzKeyNorm(obyekt);
  var smetaMap={}, legacyRz={}, borMi=false;
  var dv=sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
  for(var i=0;i<dv.length;i++){
    if(_rzKeyNorm(dv[i][0])!==obKey) continue;
    var sm=String(dv[i][1]||'').trim();
    var rn=String(dv[i][2]||'').trim();
    var D=[dv[i][3]||'',dv[i][4]||'',dv[i][5]||'',dv[i][6]||'',dv[i][7]||''];
    var hasD = D.some(function(x){ return String(x).trim()!==''; });
    if(sm){
      var smK=_rzKeyNorm(sm);
      if(!smetaMap[smK]) smetaMap[smK]={rz:{}, dflt:null};
      if(rn) smetaMap[smK].rz[_rzKeyNorm(rn)]=D;
      else if(hasD) smetaMap[smK].dflt=D;
      if(rn||hasD) borMi=true;
    } else if(rn){
      legacyRz[_rzKeyNorm(rn)]=D; borMi=true;
    }
  }
  if(!borMi) return {ok:false, xabar:'Bu obyekt uchun РАЗДЕЛЛАР ma\'lumoti yo\'q'};

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
    // Shu smeta uchun rz-xarita va default (rz'siz butun-smeta) D lari
    var smEntry = smetaMap[_rzKeyNorm(targets[t])] || {rz:{}, dflt:null};
    var smDflt = smEntry.dflt || ['','','','',''];

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
      var curD=smDflt;   // rz uchramaguncha (yoki rz'siz smeta) — smeta-default D lar

      for(var i=0;i<n;i++){
        var mk=String(v[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
        if(mk==='rz'){
          var rzNom='';
          for(var c=0;c<8;c++){
            var cv=String(v[i][c]||'').trim();
            if(cv && /[А-ЯЁA-Za-zА-яёa-z]/.test(cv)){ rzNom=cv; break; }
          }
          // Qidiruv tartibi: shu smeta rz'si → legacy (smeta'siz) rz → smeta-default
          curD=smEntry.rz[_rzKeyNorm(rzNom)]||legacyRz[_rzKeyNorm(rzNom)]||smDflt;
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
  // ⚡ 2026-07-16: holat keshi ham tozalanadi — aks holda Panel daraxti eski
  // (Д1-Д3'siz) ko'rinishda qolib "ierarxiya ochmayapti" bo'lardi.
  try{ if(typeof _holatInvalidate==='function') _holatInvalidate(obyekt); }catch(eInv){}
  var rzSoni=Object.keys(legacyRz).length;
  for(var smK in smetaMap){ rzSoni+=Object.keys(smetaMap[smK].rz).length + (smetaMap[smK].dflt?1:0); }
  return {ok:true, xabar:totalW+' qator yangilandi ('+rzSoni+' RZ, '+filesFound+' файл)'};
}

/* ⚡⚡ 2026-07-10: БАРЧА ОБЪЕКТЛАР УЧУН БИР МАРТА (фойдаланувчи талаби — ҳар
 * объектга алоҳида кириб такрорлаш ЖУДА ЧАРЧАТАРДИ). apiPapkaSkan/_grafikParent
 * bilan bir xil PARENT-darajasidagi ro'yxatni oladi, har biriga navbat bilan
 * apiRazdelShYasat(obNom) ni chaqiradi (yengil — faqat MARKER ustuni o'qiydi). */
function apiRazdelShYasatBarcha(){
  var parents = _grafikParentObyektlar();
  var natijalar = [], jamiYangi = 0;
  parents.forEach(function(ob){
    try{
      var r = apiRazdelShYasat(ob);
      if(r && r.ok){
        var m = /(\d+) yangi/.exec(r.xabar||'');
        var yangiSoni = m ? parseInt(m[1],10) : 0;
        jamiYangi += yangiSoni;
        natijalar.push({obyekt:ob, ok:true, xabar:r.xabar});
      } else natijalar.push({obyekt:ob, ok:false, xabar:(r&&r.xabar)||'Хато'});
    }catch(e){ natijalar.push({obyekt:ob, ok:false, xabar:String(e.message||e)}); }
  });
  return {ok:true, jami:parents.length, jamiYangi:jamiYangi, natijalar:natijalar};
}

/* ⚡ 2026-07-12: TO'LIQ QAYTA QURISH — foydalanuvchi so'rovi: eski (classify
 * tuzatilishidan OLDIN yig'ilgan, "3"/"ОСНОВАНИЕ:" kabi soxta) РАЗДЕЛЛАР
 * yozuvlari reestrda ABADIY qolib ketardi (apiRazdelShYasat faqat QO'SHADI,
 * hech qachon o'chirmaydi). Bu funksiya BUTUN reestrni (Д1-Д5 qiymatlari HAM)
 * tozalab, joriy LRV_PLUS holatidan (classify tuzatilgandan keyin «Ишла» qayta
 * yurgizilgan bo'lsa — TOZA) ro'yxatni yangidan yig'adi.
 * ⚠️ MUHIM: bu faqat LRV_PLUS'lar "Ишла" bilan QAYTA ishlangan bo'lsagina toza
 * natija beradi — eski marker saqlanib qolgan obyektlarda eski nomlar qaytadi. */
function apiRazdellarTolaQaytaQur(){
  var ss=SpreadsheetApp.getActive();
  var dsh=ss.getSheetByName(CFG.RAZDEL_SH);
  // ⚡ 2026-07-13: varaq BUTUNLAY o'chirib qayta yaratiladi — eski 7-ustunli
  // format/sarlavha qoldiqlari ham ketadi, yangi 8-ustunli (ОБЪЕКТ|СМЕТА|RZ|Д1-5)
  // toza holda quriladi.
  if(dsh){ try{ ss.deleteSheet(dsh); }catch(e){} }
  var r=apiRazdelShYasatBarcha();
  r.xabar='Реестр тозаланди ва қайта қурилди: '+r.jami+' объект, '+r.jamiYangi+' RZ';
  return r;
}

/* ⚡⚡ 2026-07-10: БАРЧА ОБЪЕКТЛАРГА D1-D5 ни LRV'ga yozish — faqat РАЗДЕЛЛАР
 * varag'ida shu obyekt uchun kamida bitta qator (D1-D5) mavjud bo'lganlariga. */
function apiDarajalarLrvGaYozBarcha(){
  var sh = SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
  var obySet = {};
  if(sh && sh.getLastRow()>=2){
    var v = sh.getRange(2,1,sh.getLastRow()-1,1).getValues();
    v.forEach(function(row){ var ob=String(row[0]||'').trim(); if(ob) obySet[ob]=true; });
  }
  var obyektlar = Object.keys(obySet);
  var natijalar = [], jamiQator = 0;
  obyektlar.forEach(function(ob){
    try{
      var r = apiDarajalarLrvGaYoz(ob);
      if(r && r.ok){
        var m = /(\d+) qator/.exec(r.xabar||'');
        jamiQator += m ? parseInt(m[1],10) : 0;
        natijalar.push({obyekt:ob, ok:true, xabar:r.xabar});
      } else natijalar.push({obyekt:ob, ok:false, xabar:(r&&r.xabar)||'Хато'});
    }catch(e){ natijalar.push({obyekt:ob, ok:false, xabar:String(e.message||e)}); }
  });
  return {ok:true, jami:obyektlar.length, jamiQator:jamiQator, natijalar:natijalar};
}


/* РАЗДЕЛЛАР dan darajalar: [{rzNom, d1, d2, d3, d4, d5}] */
function apiDarajalarOl(obyekt){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
  if(!sh||sh.getLastRow()<2) return [];
  // ⚡ 2026-07-13: yangi 8-ustunli tuzilish (ОБЪЕКТ|СМЕТА|RZ|Д1-5). Eski 7-ustunli
  // varaq hali migratsiya qilinmagan bo'lsa (B sarlavhasida СМЕТА yo'q) — eski o'qish.
  var eski = String(sh.getRange(1,2).getValue()||'').toUpperCase().indexOf('СМЕТА')<0;
  var v=sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
  var result=[];
  for(var i=0;i<v.length;i++){
    if(String(v[i][0]||'').trim()!==obyekt) continue;
    var off = eski ? 0 : 1;   // eski: B=rz; yangi: B=smeta, C=rz
    var rzNom=String(v[i][off+1]||'').trim();
    var smeta=eski ? '' : String(v[i][1]||'').trim();
    if(!rzNom && !smeta) continue;
    result.push({
      smeta:smeta,
      rzNom:rzNom,
      d1:String(v[i][off+2]||'').trim(),
      d2:String(v[i][off+3]||'').trim(),
      d3:String(v[i][off+4]||'').trim(),
      d4:String(v[i][off+5]||'').trim(),
      d5:String(v[i][off+6]||'').trim()
    });
  }
  return result;
}

/* ⚡ 2026-07-13 YANGI: BUTUN РАЗДЕЛЛАР reestrini (obyekt filtrisiz) qaytaradi —
 * Boss panelning PARK darajasidagi Д1-Д5 ierarxiya daraxti (91_BossTahlil.js)
 * shundan foydalanadi. Panel'dagi pathMap bilan BIR XIL qoida: rzNom kalit
 * (bir xil nomli razdel bir xil tasnifni ulashadi). */
function apiDarajalarBarchaOl(){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
  if(!sh||sh.getLastRow()<2) return [];
  var eski = String(sh.getRange(1,2).getValue()||'').toUpperCase().indexOf('СМЕТА')<0;
  var v=sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
  var result=[];
  for(var i=0;i<v.length;i++){
    var obyekt=String(v[i][0]||'').trim();
    if(!obyekt) continue;
    var off = eski ? 0 : 1;
    var rzNom=String(v[i][off+1]||'').trim();
    var d1=String(v[i][off+2]||'').trim();
    if(!rzNom || !d1) continue;   // Д1 bo'lmasa ierarxiyaga kirmaydi (tasniflanmagan)
    result.push({obyekt:obyekt, rzNom:rzNom, d1:d1,
      d2:String(v[i][off+3]||'').trim(), d3:String(v[i][off+4]||'').trim()});
  }
  return result;
}

/* Panel redaktoridan D1-D5 ni saqlash
 * rows = [{obyekt, rzNom, d1..d5}] */
function apiDarajalarSaqla(rows){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.RAZDEL_SH);
  if(!sh) return apiRazdelShYasat((rows&&rows[0])?rows[0].obyekt:'');

  // ⚡ 2026-07-13: yangi 8-ustunli tuzilish (ОБЪЕКТ|СМЕТА|RZ|Д1-5) — avval
  // migratsiyani kafolatlaymiz, keyin yozamiz.
  sh=_razdelShTayyorla();
  // Boshqa obyektlar saqlanadi, bu obyekt almashtiriladi
  var updObs={};
  (rows||[]).forEach(function(r){ if(r.obyekt) updObs[r.obyekt]=true; });

  var keep=[];
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
    for(var i=0;i<v.length;i++){
      var ob=String(v[i][0]||'').trim();
      if(ob && !updObs[ob]) keep.push(v[i]);
    }
  }

  var newRows=(rows||[]).map(function(r){
    return [r.obyekt||'', r.smeta||'', r.rzNom||'', r.d1||'', r.d2||'', r.d3||'', r.d4||'', r.d5||''];
  });

  var allData=keep.concat(newRows);
  _sheetDataYoz(sh, allData, 8);
  if(newRows.length){
    var startR=keep.length+2;
    sh.getRange(startR,1,newRows.length,8).setBackground('#eef4ff');
    sh.getRange(startR,1,newRows.length,3).setBackground('#dde8f8');
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
  var a = typeof sozAsosiy === 'function' ? sozAsosiy() : {rootId: ''};
  var parentName = typeof _cfgKalit === 'function' ? _cfgKalit(obyekt) : String(obyekt).split(' - ')[0].trim();
  
  var sk = typeof _keshOlStale === 'function' ? (_keshOlStale('skan') || []) : [];
  var folderId = '';
  for (var i = 0; i < sk.length; i++) {
    var skNom = sk[i].obyekt.trim();
    if (skNom === parentName || skNom === obyekt.trim() || obyekt.indexOf(skNom) === 0) {
      folderId = sk[i].folderId;
      break;
    }
  }

  /* ⚡⚡⚡ 2026-07-27 KO'P SMETALI OBYEKTDA F2 PAPKASI TOPILMASLIGI TUZATILDI
   * (foydalanuvchi: «компьютердан Ф2 ни танласам на Ф2 деб фолдер очаяпти, на
   * юклаяпти — шу кўп сметали объектларда»). SABAB: skanerda FAQAT sub-obyektlar
   * bor («Suniy ko'l - 11210_OB_ALL_…»), OTA nomi («Suniy ko'l») YO'Q — yuqoridagi
   * uchala shart ham ota uchun ishlamaydi (indexOf ham −1 qaytaradi, chunki ota nomi
   * sub nomidan QISQA). Natijada faqat ROOT ning BEVOSITA bolalari qidirilib,
   * papka ichkarida bo'lsa topilmasdi.
   * YECHIM: ota tanlangan bo'lsa — uning ISTALGAN sub-obyekti papkasini olamiz. */
  if (!folderId) {
    for (var s2 = 0; s2 < sk.length; s2++) {
      var sNom = String(sk[s2].obyekt||'').trim();
      if (!sNom || !sk[s2].folderId) continue;
      var sKalit = (typeof _cfgKalit==='function') ? _cfgKalit(sNom) : sNom.split(' - ')[0].trim();
      if (String(sKalit).trim() === String(parentName).trim()) { folderId = sk[s2].folderId; break; }
    }
  }

  if (!folderId && a.rootId) {
    try {
      var root = DriveApp.getFolderById(a.rootId);
      var fIt = root.getFoldersByName(parentName);
      if (fIt.hasNext()) folderId = fIt.next().getId();
    } catch(e) {}
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

/* ══════════════════════════════════════════════════════════════════════════
 * ⚡⚡⚡ 2026-07-27 XLSX → FAQAT QIYMAT (formulasiz) O'QISH
 * MUAMMO (foydalanuvchi): «Ф2 актда бошқа экселлардан олинган манбали формулалар
 * бўлади: =1000/3,36*'[1]г. Ташкент, сум'!$G$3505 — конвертациядан кейин #REF
 * бўлиб қоляпти» + «ҳамма ҳужжатларда Sheets формати USA да туриб, кўп жойда
 * REF хато беряпти».
 * SABAB: Google XLSX'ni Sheets'ga aylantirganda TASHQI HAVOLANI qayta hisoblay
 * olmaydi → #REF!. Excel esa faylda oxirgi HISOBLANGAN QIYMATNI (`<v>`) saqlaydi —
 * lekin konvertatsiya uni TASHLAB YUBORADI.
 * YECHIM: xlsx (zip) ni O'ZIMIZ ochib, har katakning `<v>` (кэшланган қиймат)ини
 * o'qiymiz va TOZA (formulasiz) Google Sheet yasaymiz. Natijada #REF butunlay
 * yo'qoladi, raqamlar aynan Excel'dagidek bo'ladi.
 * ══════════════════════════════════════════════════════════════════════════ */
function _f2XlsxQiymatOqi(blob){
  var zipBlobs;
  try{ zipBlobs = Utilities.unzip(blob.setContentType('application/zip')); }
  catch(e){ return null; }                       // xlsx emas (eski .xls yoki csv)
  var byName = {};
  zipBlobs.forEach(function(b){ byName[b.getName()] = b; });
  if(!byName['xl/workbook.xml']) return null;

  function txt(n){ return byName[n] ? byName[n].getDataAsString('UTF-8') : ''; }
  function dec(s){
    return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
      .replace(/&apos;/g,"'")
      .replace(/&#(\d+);/g, function(m,d){ return String.fromCharCode(parseInt(d,10)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function(m,d){ return String.fromCharCode(parseInt(d,16)); })
      .replace(/&amp;/g,'&');
  }
  // 1) umumiy matnlar (sharedStrings)
  var ss=[], sst=txt('xl/sharedStrings.xml');
  if(sst){
    var siRe=/<si>([\s\S]*?)<\/si>/g, siM;
    while((siM=siRe.exec(sst))){
      var t='', tRe=/<t[^>]*>([\s\S]*?)<\/t>/g, tM;
      while((tM=tRe.exec(siM[1]))) t+=tM[1];
      ss.push(dec(t));
    }
  }
  // 2) varaq nomi → fayl yo'li (rels orqali)
  var wb=txt('xl/workbook.xml'), rels=txt('xl/_rels/workbook.xml.rels');
  var relMap={}, rRe=/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g, rM;
  while((rM=rRe.exec(rels))) relMap[rM[1]]=String(rM[2]).replace(/^\/?xl\//,'');
  var sheets=[], shRe=/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g, shM;
  while((shM=shRe.exec(wb))){
    var tgt=relMap[shM[2]]; if(!tgt) continue;
    sheets.push({name:dec(shM[1]), path:'xl/'+tgt});
  }
  if(!sheets.length) return null;

  function colIdx(ref){ var c=0; for(var i=0;i<ref.length;i++){ var ch=ref.charAt(i);
    if(ch>='A'&&ch<='Z') c=c*26+(ch.charCodeAt(0)-64); else break; } return c-1; }

  // 3) har varaqni o'qish — FAQAT <v> (kэшланган қиймат), formula E'TIBORSIZ
  var natija=[];
  sheets.forEach(function(s){
    var xml=txt(s.path); if(!xml){ natija.push({name:s.name, rows:[]}); return; }
    var rows=[], maxC=0;
    var rowRe=/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, rowM;
    while((rowM=rowRe.exec(xml))){
      var ri=parseInt(rowM[1],10)-1, arr=[];
      var cRe=/<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cM;
      while((cM=cRe.exec(rowM[2]))){
        var attrs=cM[1], body=cM[2]||'';
        var refM=attrs.match(/r="([A-Z]+)\d+"/); if(!refM) continue;
        var ci=colIdx(refM[1]);
        var tM2=attrs.match(/t="(\w+)"/), ty=tM2?tM2[1]:'';
        var v='';
        var vM=body.match(/<v>([\s\S]*?)<\/v>/);
        if(vM) v=dec(vM[1]);
        else { var isM=body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/); if(isM) v=dec(isM[1]); }
        if(ty==='s'){ var ix=parseInt(v,10); v=(ss[ix]!==undefined?ss[ix]:''); }
        else if(ty==='e'){ v=''; }                       // #REF!/#N/A → BO'SH
        else if(ty!=='str' && ty!=='inlineStr' && v!==''){
          var n=Number(v); if(!isNaN(n)) v=n;
        }
        arr[ci]=v;
        if(ci+1>maxC) maxC=ci+1;
      }
      rows[ri]=arr;
    }
    for(var i=0;i<rows.length;i++){
      if(!rows[i]) rows[i]=[];
      for(var j=0;j<maxC;j++) if(rows[i][j]===undefined) rows[i][j]='';
    }
    natija.push({name:s.name, rows:rows, maxC:maxC});
  });
  return natija;
}

/* Toza (formulasiz) Google Sheet yasash + LOKAL sozlamalar */
function _f2TozaSheetYarat(sheetsData, nom, folder){
  var ss = SpreadsheetApp.create(nom);
  // ⚡ LOKAL: USA emas — O'zbekiston vaqti + rus formati (o'nlik vergul, sana kk.oo.yyyy)
  try{ ss.setSpreadsheetLocale('ru_RU'); }catch(e){}
  try{ ss.setSpreadsheetTimeZone('Asia/Tashkent'); }catch(e){}
  var birinchi = ss.getSheets()[0], yaratildi=0;
  sheetsData.forEach(function(sd, ix){
    var rows=sd.rows||[];
    var sh = (ix===0) ? birinchi : ss.insertSheet();
    try{ sh.setName(String(sd.name||('Лист'+(ix+1))).substring(0,95)); }catch(e){}
    if(rows.length && sd.maxC>0){
      var out=rows.map(function(r){ var a=r.slice(); while(a.length<sd.maxC) a.push(''); return a; });
      sh.getRange(1,1,out.length,sd.maxC).setValues(out);
    }
    yaratildi++;
  });
  if(folder){
    try{
      var f=DriveApp.getFileById(ss.getId());
      if(typeof f.moveTo === 'function') { f.moveTo(folder); }
      else {
        folder.addFile(f);
        try{ DriveApp.getRootFolder().removeFile(f); }catch(e2){}
      }
    }catch(e){}
  }
  return ss;
}

/* ⚡ 2026-07-27: MAVJUD hujjatlarni ommaviy ravishda USA → ru_RU / Tashkent ga o'tkazish.
 * Foydalanuvchi: «ҳар бирини қилиб чиқиш ёқмаяпти». Panel → Мониторинг dan chaqiriladi. */
function apiHujjatLokalTuzat(obyekt){
  var a=sozAsosiy(), natija=[], jami=0, xato=0;
  var oblar = obyekt ? [obyekt] : ((typeof _grafikParentObyektlar==='function') ? _grafikParentObyektlar() : []);
  var T0=Date.now();
  oblar.forEach(function(ob){
    if(Date.now()-T0 > 4*60*1000) return;
    var subs=(typeof _subObyektlar==='function')?_subObyektlar(ob):[];
    var targets=subs.length?subs:[ob];
    targets.forEach(function(t){
      try{
        var plus=_plusTop(t); if(!plus) return;
        var lok=''; try{ lok=plus.getSpreadsheetLocale(); }catch(e){}
        if(String(lok)!=='ru_RU'){
          plus.setSpreadsheetLocale('ru_RU');
          try{ plus.setSpreadsheetTimeZone('Asia/Tashkent'); }catch(e){}
          jami++; natija.push('✅ '+t+' ('+lok+' → ru_RU)');
        }
      }catch(e){ xato++; natija.push('❌ '+t+': '+(e.message||e)); }
    });
  });
  return {ok:true, tuzatildi:jami, xato:xato, natija:natija,
          xabar:'Локал созлама тузатилди: '+jami+' та файл'+(xato?(' · '+xato+' хато'):'')};
}

function apiF2FaylYukla(obyekt, base64, mimeType, filename, oyNom) {
  var a = typeof sozAsosiy === 'function' ? sozAsosiy() : {rootId: ''};
  var parentName = typeof _cfgKalit === 'function' ? _cfgKalit(obyekt) : String(obyekt).split(' - ')[0].trim();
  
  var sk = typeof _keshOlStale === 'function' ? (_keshOlStale('skan') || []) : [];
  var folderId = '';
  for (var i = 0; i < sk.length; i++) {
    var skNom = sk[i].obyekt.trim();
    if (skNom === parentName || skNom === obyekt.trim() || obyekt.indexOf(skNom) === 0) {
      folderId = sk[i].folderId;
      break;
    }
  }

  /* ⚡⚡⚡ 2026-07-27 KO'P SMETALI OBYEKTDA F2 PAPKASI TOPILMASLIGI TUZATILDI
   * (foydalanuvchi: «компьютердан Ф2 ни танласам на Ф2 деб фолдер очаяпти, на
   * юклаяпти — шу кўп сметали объектларда»). SABAB: skanerda FAQAT sub-obyektlar
   * bor («Suniy ko'l - 11210_OB_ALL_…»), OTA nomi («Suniy ko'l») YO'Q — yuqoridagi
   * uchala shart ham ota uchun ishlamaydi (indexOf ham −1 qaytaradi, chunki ota nomi
   * sub nomidan QISQA). Natijada faqat ROOT ning BEVOSITA bolalari qidirilib,
   * papka ichkarida bo'lsa topilmasdi.
   * YECHIM: ota tanlangan bo'lsa — uning ISTALGAN sub-obyekti papkasini olamiz. */
  if (!folderId) {
    for (var s2 = 0; s2 < sk.length; s2++) {
      var sNom = String(sk[s2].obyekt||'').trim();
      if (!sNom || !sk[s2].folderId) continue;
      var sKalit = (typeof _cfgKalit==='function') ? _cfgKalit(sNom) : sNom.split(' - ')[0].trim();
      if (String(sKalit).trim() === String(parentName).trim()) { folderId = sk[s2].folderId; break; }
    }
  }

  if (!folderId && a.rootId) {
    try {
      var root = DriveApp.getFolderById(a.rootId);
      var fIt = root.getFoldersByName(parentName);
      if (fIt.hasNext()) folderId = fIt.next().getId();
    } catch(e) {}
  }

  if (!folderId) return {ok: false, xabar: 'Объект папкаси топилмади (' + parentName + ')'};
  
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
    
    // Dublikatlarni o'chirish — FAQAT shu oy uchun (boshqa oylar SAQLANADI!)
    // ⚠️ Bug tuzatish 2026-07-28: indexOf(expectedName)===0 NOTO'G'RI edi —
    // "Obyekt F2 Yanvar" yuklashda "Obyekt F2 Fevral" ham o'chirib ketardi!
    // YECHIM: faqat AYNAN shu oyga mos fayl nomi bilan TO'LIQ moslikda o'chirish.
    var dFiles = f2Folder.getFiles();
    while(dFiles.hasNext()) {
       var dF2 = dFiles.next();
       var dN2 = dF2.getName();
       if(dN2 === finalFilename || dN2 === expectedName) {
          try { dF2.setTrashed(true); } catch(eD2){}
       }
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, finalFilename);

    // ⚡⚡⚡ 2026-07-28: XLSX → FAQAT QIYMAT (formulasiz, #REF yo'q, ru_RU lokal)
    // Sabab: Drive API konvertatsiyasi tashqi formula havolalarini (#REF) saqlab qo'yadi.
    // Excel cache'dagi tayyor raqamni tashlab, formulani Sheets'ga ko'chiradi → #REF.
    // Yechim: XLSX XML'dan faqat <v> (kesh qiymat) ni o'qiymiz, toza GS yasaymiz.
    var isXlsxFmt = /\.(xlsx|xlsm)$/i.test(filename) ||
                    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    mimeType === 'application/vnd.ms-excel.sheet.macroEnabled.12';
    if(isXlsxFmt){
      try{
        var sheetsData = _f2XlsxQiymatOqi(blob);
        if(sheetsData && sheetsData.length){
          var newSs = _f2TozaSheetYarat(sheetsData, expectedName, f2Folder);
          return {ok:true, fileId:newSs.getId(), name:expectedName,
                  info:'XLSX → тоза GS (formulasiz, ru_RU), варақлар: '+sheetsData.length};
        }
      }catch(xErr){ Logger.log('XlsxQiymat xato: '+xErr); }
      // Parser ishlamasa (corrupted xlsx) → Drive API fallback quyida
    }

    // .xls yoki csv uchun Drive API konvertatsiyasi (oxirgi fallback)
    var rawFile = f2Folder.createFile(blob);
    try {
       var resource2 = {
         title: expectedName,
         mimeType: MimeType.GOOGLE_SHEETS,
         parents: [{id: f2Folder.getId()}]
       };
       var converted2 = Drive.Files.copy(resource2, rawFile.getId());
       try{ rawFile.setTrashed(true); }catch(eT2){}
       try{
         var convSs2 = SpreadsheetApp.openById(converted2.id);
         convSs2.setSpreadsheetLocale('ru_RU');
         convSs2.setSpreadsheetTimeZone('Asia/Tashkent');
       }catch(lE2){}
       return {ok:true, fileId:converted2.id, name:converted2.title,
               warn:'Drive API орқали ўгирилди (eski формат, формулалар сақланиши мумкин)'};
    } catch(eConv) {
       Logger.log('Drive API conversion failed: '+eConv);
       return {ok:true, fileId:rawFile.getId(), name:rawFile.getName(),
               warn:'GS форматга ўгирилмади — фақат Excel сифатида сақланди'};
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

/* F2/АКТ fayl ustunlarini SARLAVHADAN avtomatik aniqlash (universal TN/ABC/ФОРМА).
 * Sarlavha qatori = НАИМЕНОВАНИЕ + ЕД.ИЗМ/ЕДИНИЦА bor qator. Undan kod/nom/bir,
 * ostidagi 1-2 qator subsarlavhalaridan НА ЕДИНИЦУ(норма)/ПО ПРОЕКТ(объём)/
 * на.ед(нарх)/общая(сумма) ustunlari topiladi. Hech narsa topilmasa eski
 * LRV_PLUS default (B/C/D/E/F/G/H) qaytadi — mavjud ABC oqim o'zgarmaydi. */
function _f2UstunAniqla(data){
  var d = {kod:1, nom:2, bir:3, norma:4, obyom:5, narx:6, sum:7, hdrRow:-1};
  for(var r=0; r<Math.min(60, data.length); r++){
    var row = data[r]||[];
    var iNom=-1, iBir=-1;
    for(var c=0;c<row.length;c++){
      var u=String(row[c]||'').toUpperCase();
      if(!u) continue;
      if(iNom<0 && u.indexOf('НАИМЕНОВАНИЕ')>=0) iNom=c;
      if(iBir<0 && (u.indexOf('ЕД.ИЗМ')>=0||u.indexOf('ЕД. ИЗМ')>=0||u.indexOf('ЕДИНИЦА ИЗМЕР')>=0||u.indexOf('БИРЛИК')>=0)) iBir=c;
    }
    if(iNom<0 || iBir<0) continue;
    d.hdrRow=r; d.nom=iNom; d.bir=iBir;
    d.kod=-1;
    for(var c2=0;c2<row.length;c2++){
      var u2=String(row[c2]||'').toUpperCase();
      if(u2 && c2!==iNom && (u2.indexOf('ОБОСНОВ')>=0||u2.indexOf('ШИФР')>=0)){ d.kod=c2; break; }
    }
    if(d.kod<0 && iNom>=1) d.kod=iNom-1;   // ikkala shablonda ham ШИФР = НОМдан bitta chapda
    var no=-1, ob=-1, nx=-1, sm=-1;
    for(var rr=r; rr<Math.min(r+3, data.length); rr++){
      var rw=data[rr]||[];
      for(var c3=0;c3<rw.length;c3++){
        var u3=String(rw[c3]||'').toUpperCase().replace(/\s+/g,' ');
        if(!u3) continue;
        if(no<0 && u3.indexOf('НА ЕДИНИЦУ')>=0) no=c3;
        if(ob<0 && u3.indexOf('ПО ПРОЕКТ')>=0) ob=c3;
        if(nx<0 && u3.indexOf('НА.ЕД')>=0) nx=c3;
        if(sm<0 && u3.indexOf('ОБЩАЯ')>=0) sm=c3;
      }
    }
    if(no>=0){ d.norma=no; d.obyom=(ob>=0?ob:no+1); }
    else if(ob>=0){ d.obyom=ob; d.norma=Math.max(0,ob-1); }
    if(nx>=0){ d.narx=nx; d.sum=(sm>=0?sm:nx+1); }
    else if(sm>=0){ d.sum=sm; d.narx=Math.max(0,sm-1); }
    break;
  }
  return d;
}

function apiF2FaylOqi(fileId, varaqName, colConfig) {
  var ss;
  try {
    /* ⚡ 2026-08-13: apiF2Varaqlar dagi kabi — mime QORA ro'yxati o'rniga
     * teskari tekshiruv. octet-stream kabi kutilmagan mime'lar openById'ni
     * V8 darajasida qulatardi (try/catch ushlamaydi, saytga HTML ketardi).
     * Endi: faqat haqiqiy GOOGLE_SHEETS ochiladi, boshqasi avto-konvert. */
    var meta = Drive.Files.get(fileId, {fields:'id,name,mimeType,parents'});
    if (meta.mimeType !== 'application/vnd.google-apps.spreadsheet') {
      var parent = (meta.parents && meta.parents[0]) || '';
      var yangiNom = String(meta.name||'F2').replace(/\.(xlsx|xlsm|xls|csv)$/i,'') + ' (GS)';
      /* ⚡ 2026-08-13: avval FAQAT QIYMAT yo'li (formula ko'chirilmaydi →
       * #REF! bo'lishi mumkin emas), u ishlamasa oddiy konvert. */
      try {
        if (typeof apiXlsxQiymatBilanOch === 'function') {
          var qr = apiXlsxQiymatBilanOch(fileId, parent);
          if (qr && qr.ok && qr.fileId) fileId = qr.fileId;
        }
      } catch(eq){}

      try {
        if (String(fileId) === String(meta.id)) fileId = _excelToNative(fileId, parent, yangiNom);
      } catch(ce) {
        return {ok:false, xabar:'«'+meta.name+'» файлини Google Sheets га конверт қилиб бўлмади (тури: '+meta.mimeType+'). '+
          'Файл шикастланган, парол билан ҳимояланган ёки аслида Excel эмас бўлиши мумкин. '+
          '«Компьютердан юклаш» орқали қайта юкланг. Техник хато: '+String((ce&&ce.message)||ce)};
      }
    }
    ss = SpreadsheetApp.openById(fileId);
  } catch (e) {
    return {ok: false, xabar: 'Excel/Google Sheets файлни ўқиб бўлмади. (' + String(e) + ')'};
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
     // ⚡ 2026-07-12 UNIVERSAL: ustunlar endi SARLAVHADAN avtomatik aniqlanadi.
     // "Ой" papkasidagi barcha real aktlarni o'rganish natijasi — 3 xil shablon:
     //   1) ABC/LRV_PLUS eksport:  B/C/D/E/F/G/H + I=marker (eski default bilan mos)
     //   2) TN "ф2" detal:         B/C/D/E/F/G/H (default bilan mos)
     //   3) TN "ФОРМА":            A=№ B=ШИФР C=НОМ D=ЕДИНИЦА E=(ота ҳажм)
     //                             F=НОРМА G=ОБЪЁМ H=НАРХ I=СУММА  ← BITTA SURILGAN!
     // 3-shablon avval default (E/F/G/H) bilan noto'g'ri o'qilardi. Endi sarlavha
     // topilsa undan, topilmasa eski default qoladi. Foydalanuvchi baribir
     // dropdown'da tuzatishi mumkin (bu faqat AVTOTAKLIF).
     var det = _f2UstunAniqla(data);
     cKod=det.kod; cNom=det.nom; cBir=det.bir;
     cNorma=det.norma; cObyom=det.obyom; cNarx=det.narx; cSum=det.sum;
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
        maxCol:(data[0]||[]).length, preview:preview, hdrQator:(det.hdrRow>=0?det.hdrRow+1:0)};
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
     // ⚡ 2026-07-12: sarlavha ostidagi USTUN-RAQAMLASH qatori (№|2|3|4|5|6|7|8) —
     //   TN aktlarning barchasida bor, avval "rs" bo'lib daraxtga kirib qolardi.
     if(/^\d+$/.test(nom) && /^\d+$/.test(bir)) continue;

     // ── TIP: marker bor bo'lsa undan, aks holda F-bo'shligi qoidasidan ──
     var mk9 = (hasMarker && data[i].length>=9) ? String(data[i][8]||'').trim().toLowerCase().replace(/[+~]$/,'') : '';

     // ⚡ 2026-07-13 UNIVERSAL RAZDEL: D (bir), E (norma), F (obyom) мутлақо бўш бўлса, бу РАЗДЕЛ (Итого/Жами бўлмаса).
     var isRz = (mk9==='rz');
     if(!mk9) {
        var isEmptyDEF = (!bir && normaC.empty && obyomC.empty);
        if (isEmptyDEF) {
           // A, B, C устунлардаги матнни қараймиз
           var aTxt = String(data[i][0]||'').trim();
           var bTxt = cKod>=0 ? String(data[i][cKod]||'').trim() : '';
           var cTxt = cNom>=0 ? String(data[i][cNom]||'').trim() : '';
           var fullTxt = (aTxt + ' ' + bTxt + ' ' + cTxt).trim().toUpperCase();
           
           if (fullTxt.length > 2 && /[А-ЯЁA-Za-zа-яё]/.test(fullTxt) && !/^(ИТОГО|ВСЕГО|ЖАМИ|ПОДЫТОГ|СУММА)/.test(fullTxt)) {
               isRz = true;
           }
        }
     }
     if(isRz){
        var rzNom = nom;
        if(!rzNom){ for(var rc=0; rc<8; rc++){ var rv=String(data[i][rc]||'').trim(); if(rv && /[А-ЯЁA-Za-z]/.test(rv)){ rzNom=rv; break; } } }
        currentRz = {type:'rz', uid:'f2rz_'+(_rzSeq++), nom:rzNom||('Раздел '+_rzSeq), children:[]};
        result.push(currentRz); currentBl=null; continue;
     }

     // Ma'noli qator emas (nom yo'q yoki obyom yo'q) — o'tkazamiz.
     // ⚡ 2026-07-12: MANFIY hajm ENDI TASHLANMAYDI — «перерасчет»/сторно aktlarda
     //   butun bo'lim minus qatorlardan iborat (Амфитеатр avgust: 846 qator!),
     //   avval volume<=0 sharti ularni BUTUNLAY yo'qotardi. Faqat 0/bo'sh o'tkaziladi.
     if(!nom || !volume) continue;

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

     // ⚡⚡⚡ 2026-07-27 SIMMETRIYA TIKLANDI (foydalanuvchi: «смета тарафда bl ва унинг
     // mat лари АЛОҲИДА, ф2 тарафда эса bl ИЧИГА киритилган — бу хато»). U HAQ:
     //   • LRV (apiHolatOl): mat/ob — bl ning YONIDOSHI (razdel bolasi), rs — bl ichida
     //   • AKT (bu yer): 2026-07-17 da mat/ob ni bl ICHIGA solgan edim → IKKI DARAXT
     //     SHAKLI FARQ QILDI va moslashtirish chalkashdi («авто боғлашда ҳамма жойни
     //     расво қилиб қўяпти» — ildizi shu edi).
     // ENDI AKT ham LRV bilan BIR XIL shaklda quriladi: mat/ob → razdel bolasi.
     // ⚠️ LEKIN `currentBl` NOLGA TUSHIRILMAYDI (2026-07-17 tuzatishining TO'G'RI
     // qismi saqlanadi) — aks holda mat dan KEYINGI rs qatorlari otasiz qolib,
     // daraxtdan butunlay yo'qolardi.
     if(nType==='bl'){ currentBl=node; currentRz.children.push(node); }
     else if(nType==='rs'){ if(currentBl) currentBl.children.push(node); else currentRz.children.push(node); }
     else { currentRz.children.push(node); }   // mat/ob — LRV kabi YONDOSH
  }

  // Bo'sh razdellarni tozalash (bola olmagan)
  result = result.filter(function(n){ return !(n.type==='rz' && (!n.children||!n.children.length)); });
  return {ok: true, tree: result};
}

// ⚡ 2026-07-12: F2 Mappings (Bog'lanishlarni) LRV_PLUS dan o'qish (Cell Notes orqali)
// ⚡⚡ 2026-07-13 QAYTA YOZILDI (foydalanuvchi «kiritilgan qiymatlarni o'qiy olmayapti»):
//   avval FAQAT uid-NOTE'li VA hajm>0 kataklar sanardi — eski (note mexanizmi
//   qo'shilishidan OLDIN yozilgan) F2 oylar «bo'sh» ko'rinardi, foydalanuvchi nima
//   yozilganini KO'RA OLMASDI ham, O'CHIRA olmasdi ham. Endi: oy ustunida QIYMATI
//   bor HAR QANDAY qator qaytariladi (note bo'lsa uid bilan, bo'lmasa uid='' —
//   baribir ko'rinadi va o'chiriladi). Qo'shimcha: soni + jami summa (nazorat uchun,
//   masalan akt jami bilan solishtirish) qaytariladi. МУҲИМ: faqat LEAF (rs/mat/ob)
//   summasi jamiga olinadi — bl (ish tur)niki bolalari yig'indisining o'zi, ikki
//   marta sanamaslik uchun (marker ustunidan aniqlanadi).
function apiF2OySkan(obyekt, oyNom, subFilter) {
  var mappings = [];
  var soni = 0, jamiSumma = 0;
  try {
    var subObjects = (typeof _subObyektlar==='function') ? _subObyektlar(obyekt) : [];
    var targets = subObjects.length ? subObjects : [obyekt];
    // ⚡ 2026-07-16: ixtiyoriy subFilter — KO'P SMETALI obyektda solishtiruv (СОЛИШТИРУВ)
    // faqat SHU saqlashda tegilgan lokalka(lar)ni sanasin; aks holda o'sha oyga boshqa
    // lokalkadan avval kiritilgan akt summasi ham qo'shilib, farq noto'g'ri chiqardi.
    if(subFilter && subFilter.length){
      var _sf={}; subFilter.forEach(function(s){ _sf[String(s).trim()]=1; });
      var t2=targets.filter(function(t){ return _sf[String(t).trim()]; });
      if(t2.length) targets=t2;
    }
    var colC = CFG.C;

    for (var ti=0; ti<targets.length; ti++) {
      var plus = _plusTop(targets[ti]);
      if (!plus) continue;

      var sheets = plus.getSheets();
      for(var s=0; s<sheets.length; s++) {
         var sh = sheets[s];
         if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;

         var oylar = _f2Oylar(sh);
         var oCol = null;
         for(var o=0; o<oylar.length; o++){
            if(_oyKey(oylar[o].nom) === _oyKey(oyNom)) { oCol = oylar[o].col; break; }
         }
         if(!oCol) continue; // Bu varaqda bu oy yo'q

         var lr = sh.getLastRow();
         if(lr < 2) continue;

         // Oy hajmi yoziladigan ustundan o'qiymiz (va yonidagi narx/summa dan) + marker
         var rng = sh.getRange(1, oCol, lr, 3);
         var vals = rng.getValues();
         var notes = rng.getNotes();
         var mks = sh.getRange(1, colC.MARKER, lr, 1).getValues();

         for(var r=0; r<lr; r++) {
            var val = _toNum(vals[r][0]);
            var nNarx = _toNum(vals[r][1]);
            var nSumma = _toNum(vals[r][2]);
            var note = String(notes[r][0] || '').trim();
            if (val === 0 && nSumma === 0 && !note) continue;   // butunlay bo'sh
            var mk = String(mks[r][0]||'').trim().toLowerCase().replace(/[+~]$/,'');
            var vFullName = (targets[ti] === obyekt) ? sh.getName() : (targets[ti] + '||' + sh.getName());
            mappings.push({
               uid: note,
               hajm: val,
               narx: nNarx,
               summa: nSumma,
               varaq: vFullName,
               row: r + 1,
               mk: mk
            });
            soni++;
            // Jami — faqat leaf (rs/mat/ob): bl bolalari allaqachon o'z qatorlarida sanaladi
            if(mk==='rs' || mk==='mat' || mk==='ob'){
               jamiSumma += (nSumma !== 0 ? nSumma : val * nNarx);
            }
         }
      }
    }
    return {ok: true, mappings: mappings, soni: soni, jamiSumma: Math.round(jamiSumma)};
  } catch(e) {
    return {ok: false, xabar: e.message || e};
  }
}

function apiF2BoglanishBekorQil(obyekt, oyNom, mappedArray) {
   try {
      if(!oyNom || !mappedArray || !mappedArray.length) return {ok: true};
      for(var i=0; i<mappedArray.length; i++) {
         var m = mappedArray[i];
         if(!m.varaq || !m.row) continue;
         
         var subOb = obyekt, vNom = m.varaq;
         if(m.varaq.indexOf('||') > 0) {
            var parts = m.varaq.split('||');
            subOb = parts[0]; vNom = parts[1];
         }
         var plus = _plusTop(subOb);
         if(!plus) continue;
         var sh = plus.getSheetByName(vNom);
         if(!sh) continue;
         
         var oylar = _f2Oylar(sh);
         var oCol = null;
         for(var o=0; o<oylar.length; o++){
            if(_oyKey(oylar[o].nom) === _oyKey(oyNom)) { oCol = oylar[o].col; break; }
         }
         if(oCol && m.row <= sh.getLastRow()) {
            var cell = sh.getRange(m.row, oCol);
            var note = cell.getNote();
            if(note && note.indexOf(m.uid) >= 0) {
               cell.clearNote();
               cell.setValue('');
               // F2 narx va summa ustunlarini tozalash
               sh.getRange(m.row, oCol+1).setValue('');
               sh.getRange(m.row, oCol+2).setValue('');
            }
         }
      }
      return {ok: true};
   } catch(e) {
      return {ok: false, xabar: e.message||e};
   }
}

/* ⚡ 2026-07-13 YANGI: BUTUN OYNI O'CHIRISH — foydalanuvchi talabi ("hamma boshqaruvga
 * ega bo'lishim kerak"). apiF2BoglanishBekorQil faqat CLIENT bergan aniq (uid-notee'li)
 * qatorlarni tozalaydi — eski (uid-note qo'shilishidan OLDIN yozilgan) qatorlar
 * qolib ketishi mumkin edi. Bu funksiya OBYEKTNING (barcha sub-obyekt/varaq) HAR BIR
 * qatoridagi shu oy ustunini (ОБЪЁМ/НАРХ/СУММА) — mavjudmi-yo'qmi qaramasdan — TO'LIQ
 * tozalaydi, so'ng накрутка/dashboard qayta hisoblanadi. Qaytarilmas — client tasdiqlatadi. */
function apiF2OyOchirish(obyekt, oyNom){
   oyNom = String(oyNom||'').trim();
   if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};
   var subObjects = _subObyektlar(obyekt);
   var targets = subObjects.length ? subObjects : [obyekt];
   var tozalandi = 0;
   targets.forEach(function(subOb){
      var plus = _plusTop(subOb);
      if(!plus) return;
      var sheets = plus.getSheets();
      for(var s=0;s<sheets.length;s++){
         var sh = sheets[s];
         if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) continue;
         var oylar=_f2Oylar(sh), oCol=null;
         for(var o=0;o<oylar.length;o++){ if(_oyKey(oylar[o].nom)===_oyKey(oyNom)){ oCol=oylar[o].col; break; } }
         if(!oCol) continue;
         var last=sh.getLastRow(); if(last<1) continue;
         var rng = sh.getRange(1, oCol, last, 3);
         var vals = rng.getValues(), notes = rng.getNotes();
         var changed=false;
         for(var r=0;r<last;r++){
            var had = (String(vals[r][0]||'')!=='' && vals[r][0]!==0) || (String(vals[r][1]||'')!=='') || (String(vals[r][2]||'')!=='') || (String(notes[r][0]||'')!=='');
            if(!had) continue;
            vals[r][0]=''; vals[r][1]=''; vals[r][2]='';
            tozalandi++; changed=true;
         }
         if(changed){
            rng.setValues(vals);
            sh.getRange(1, oCol, last, 1).clearNote();
         }
         try{ _oyYigindiFormulalarYangila(sh); }catch(e){}
      }
      try{ if(typeof _nakrutkaSheetYoz==='function') _nakrutkaSheetYoz(plus, subOb); }catch(e){}
      try{ serverYozFile(subOb, plus, sozAsosiy()); }catch(e){}
      try{ if(typeof _sbDirty==='function') _sbDirty(subOb); }catch(e){}
   });
   _holatInvalidate(obyekt);
   return {ok:true, tozalandi:tozalandi, xabar:oyNom+' ойи учун '+tozalandi+' та қиймат бутунлай ўчирилди'};
}

function apiF2Qolla(obyekt, oyNom, edits, dopps, aktJami, _job) {
  var a = sozAsosiy();
  oyNom = String(oyNom||'').trim();
  if(!oyNom) return {ok:false, xabar:'Ой номи бўш — сақланмади'};
  edits = edits || []; dopps = dopps || [];
  aktJami = Number(aktJami)||0;   // client yuborgan AKT JAMI — yakuniy solishtiruv uchun

  // ⚡⚡⚡ 2026-07-17 DURABLE/RESUMABLE (foydalanuvchi: "kompyuterni o'chirsam ham
  // yozib tura olsin, xohlagan vaqtim monitoringda ko'rsatsin"). _job — fon dvigateli
  // (_f2FonQadam) beradigan resume-holati: {dopStart, mappedYoz, dopsYoz}. Vaqt
  // byudjeti (~4.5 daq) tugasa — qolgan dopps'ni keyingi trigger davom ettiradi
  // (dopps sikli uid-note dedup bilan idempotent — qayta ishlash xavfsiz). _job
  // yo'q bo'lsa — eski sinxron xatti-harakat AYNAN saqlanadi (regressiyasiz).
  var _JOBM = !!_job;
  // ⚡⚡⚡ 2026-07-27 TO'LIQ FAZALI RESUME (foydalanuvchi: «07:00 да бошланди, 07:28 да
  // ҳам лог ўзгармади; мос қаторлар ёзилди, лекин замена/қўшимчалар ёзилмади»).
  // ILDIZ SABAB: faqat DOPPS bosqichi chunk'langan edi. Haqiqiy log:
  //   07:00:48 → 07:04:35  `apiOyQosh` (oy ustuni + formulalar) — 4 DAQIQA!
  //   qolgan ~2 daqiqada 450 qator yozishga ulgurmay, GAS 6-daqiqa limitida O'LDI.
  //   Trigger esa boshida o'chirilgani uchun qayta ishga tushmadi → jarayon MUZLADI.
  // ENDI 4 FAZA, har biri alohida davom ettiriladi:
  //   0) oyTayyor  — oy ustuni yaratish (bir marta)
  //   1) editStart — mos qatorlar BO'LAKLAB yoziladi
  //   2) dopStart  — qo'shimcha/zamena
  //   3) yakun     — formulalar + solishtiruv + jurnal
  var _T0 = Date.now(), _BUDGET = 3.5*60*1000;
  var _dopStart  = (_job && _job.dopStart)  || 0;
  var _editStart = (_job && _job.editStart) || 0;
  var _oyTayyor  = !!(_job && _job.oyTayyor);
  function _vaqtTugadi(){ return _JOBM && (Date.now()-_T0) > _BUDGET; }
  function _resume(o){
    o.resume=true; o.mappedYoz=mappedYoz; o.dopsYoz=dopsYoz; o.oyTayyor=true;
    if(o.editStart===undefined) o.editStart=edits.length;
    if(o.dopStart===undefined)  o.dopStart=_dopStart;
    return o;
  }

  _f2LogTozala();
  _setF2Prog('🚀 Бошланди: '+obyekt+' / '+oyNom+' — '+edits.length+' мослаштирилган, '+dopps.length+' қўшимча');

  // ⚡ 1-QADAM: ОЙ УСТУНИ ЯРАТИШ (мослик учун trim қилинган ном билан). Агар яратилмаса
  // (LRV yo'q, ЛРВ варақ yo'q) — АНИҚ хато қайтарамиз (аввал жимгина ўтиб, кейин
  // apiHolatSaqla ustunni topolmay HAMMANI ташлаб "hech nima yozilmadi" бўларди).
  var col = CFG.C;
  // ⚡ 2026-07-27: resume'da mappedYoz/dopsYoz avvalgi bo'lakdan davom etadi
  var mappedYoz = (_job && _job.mappedYoz) || 0, dopsYoz = (_job && _job.dopsYoz) || 0;

  if(!_oyTayyor){
    _setF2Prog('1/4: Ой устуни текширилмоқда/яратилмоқда — '+oyNom);
    try {
       // ⚡ Faqat F2 da qatnashgan varaqlar (sub-obyektlar) uchungina oy ustuni yaratamiz
       /* ⚡⚡⚡ 2026-08-13 «15 ta faylga kirib timeout» TUZATILDI (foydalanuvchi:
        * «2 ta smetadan foydalanilishi kerak bo'lsa ham tizim 15 ta faylga
        * kirib chiqib time limitga uraveradi — faqat ishlaydigan fayllarda
        * ishlashi kerak»).
        * SABAB: agar qatorda `sub||` prefiksi bo'lmasa, sub=OTA nom bo'lardi,
        * apiOyQosh(ota) esa _subObyektlar() bilan BARCHA sub-obyektni aylanadi
        * → 15 fayl → 6 daqiqa limiti. YECHIM: prefiksi yo'q varaqni
        * varaq-nomi → sub xaritasi orqali AYNAN o'z smetasiga bog'laymiz
        * (xarita faqat varaq NOMLARINI o'qiydi — katak o'qilmaydi, arzon). */
       var targetSubObs = {};
       var nomXarita = null;   // {varaqNomi: sub} — faqat kerak bo'lsa quriladi
       (edits||[]).concat(dopps||[]).forEach(function(e){
         if(!e.varaq) return;
         var sub = null;
         if(e.varaq.indexOf('||') >= 0){
           sub = e.varaq.split('||')[0];
         } else {
           if(nomXarita === null){
             nomXarita = {};
             try{
               var subLar = _subObyektlar(obyekt) || [];
               for(var si=0; si<subLar.length; si++){
                 try{
                   var p = _plusTop(subLar[si]);
                   if(!p) continue;
                   var shl = p.getSheets();
                   for(var sj=0; sj<shl.length; sj++){
                     var nm = shl[sj].getName();
                     if(nomXarita[nm] === undefined) nomXarita[nm] = subLar[si];
                   }
                 }catch(e1){}
               }
             }catch(e2){}
           }
           sub = nomXarita[e.varaq] || null;
         }
         // Aniqlanmasa OTA nomга tushmaymiz (u 15 faylni aylanadi) — o'tkazib
         // yuboramiz; pastda targets bo'sh bo'lsa zaxira yo'l ishlaydi.
         if(sub) targetSubObs[sub] = true;
       });
       var targets = Object.keys(targetSubObs);
       if(targets.length > 0){
         targets.forEach(function(sub){ apiOyQosh(sub, oyNom); });
       } else {
         apiOyQosh(obyekt, oyNom);
       }
    } catch(e) {
       _setF2Prog('❌ Ой устуни яратилмади: '+(e.message||e));
       return {ok:false, xabar:'❌ Ой устуни яратилмади: '+(e.message||e)+'. LRV_PLUS борлигини ва [Ишла] қилинганини текширинг.'};
    }
    // ⚡ Oy ustuni (formulalar bilan) 4 daqiqagacha olishi mumkin — shu yerda
    // vaqtni tekshirib, keyingi bosqichni YANGI ishga qoldiramiz (o'lim o'rniga).
    if(_vaqtTugadi()){
      _setF2Prog('⏸ Ой устуни тайёр — қаторлар ёзиш навбатда давом этади...');
      return _resume({editStart:0, dopStart:0});
    }
  }

  // 2-QADAM: МОСЛАШТИРИЛГАН (mapped) қаторларга ой ҳажм/нарх ёзиш.
  //   narx>0 bo'lsagina НАРХ yoziladi (0/yo'q → smeta narxi formula bo'yicha qoladi).
  // ⚡⚡⚡ 2026-07-27 BO'LAKLAB YOZISH: avval HAMMASI bitta `apiHolatSaqla` chaqiruvida
  // yozilardi — 450+ qatorda bu 6 daqiqa limitidan oshib, jarayon MUZLAB qolardi.
  // Endi 120 qatorlik bo'laklar; har bo'lakdan keyin vaqt tekshiriladi.
  var _CHUNK = 120;
  if(_editStart < edits.length){
     while(_editStart < edits.length){
        var _slice = edits.slice(_editStart, _editStart+_CHUNK);
        var holatEdits = [];
        for(var i=0; i<_slice.length; i++) {
           var e = _slice[i];
           if(!e || !e.varaq || !e.row) continue;
           // ⚡ _oyObj: narx faqat >0 bo'lsa (aks holda 0 yozilib smeta-narx formulani buzardi);
           // e.summa — F2 hujjatdagi TAYYOR summa (bo'lsa) STATIK yoziladi (yaxlitlash farqisiz)
           // e.uid — F2 hujjatdagi uid ni izohga (note) yozish uchun yuboramiz.
           holatEdits.push({varaq: e.varaq, row: e.row, oylar: _oyObj(oyNom, e.hajm, e.narx, e.summa, e.uid)});
        }
        if(holatEdits.length){
           apiHolatSaqla(obyekt, holatEdits);
           mappedYoz += holatEdits.length;
        }
        _editStart += _slice.length;
        _setF2Prog('2/4: Мослаштирилган ёзилмоқда — '+mappedYoz+'/'+edits.length+' қатор');
        if(_editStart < edits.length && _vaqtTugadi()){
           return _resume({editStart:_editStart, dopStart:0});
        }
     }
     _setF2Prog('✓ Мослаштирилган ёзилди: '+mappedYoz+' қатор');
     if(dopps.length && _vaqtTugadi()){
        return _resume({editStart:edits.length, dopStart:0});
     }
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
     // ⚡⚡⚡ 2026-07-12 KRITIK TUZATISH (jamlangan obyekt — Amfiteatr va h.k.):
     // varaq "sub||varaq" ko'rinishida keladi. apiBlQosh/apiRsQosh prefiksni O'ZI
     // yechib qatorni TO'G'RI sub-obyekt fayliga qo'shardi, LEKIN quyidagi oy-yozish
     // OTA-obyekt faylidan "sub||varaq" nomli varaqni qidirib TOPOLMAY, `if(!c) return`
     // bilan JIMGINA chiqib ketardi. Natija: qator qo'shilgan, formulalar bor, lekin
     // OY ҲАЖМ/НАРХ/СУММА yozilmagan — «hammasida 0 turibdi» shikoyati AYNAN SHU.
     var _plusFonCache = {};   // subOb → LRV_PLUS fayl
     function _plusFonOl(subOb){
        if(_plusFonCache[subOb]===undefined){ try{ _plusFonCache[subOb]=_plusTop(subOb); }catch(e){ _plusFonCache[subOb]=null; } }
        return _plusFonCache[subOb];
     }
     function _varaqYech(varaqFull){
        var subOb=obyekt, realV=String(varaqFull||'');
        if(realV.indexOf('||')>=0){ var p=realV.split('||'); subOb=p[0]; realV=p[1]; }
        return {subOb:subOb, realV:realV};
     }
     // ⚡⚡⚡ 2026-07-12 KRITIK: TAKRORIY QO'SHISH HIMOYASI. apiBlQosh/apiRsQosh/apiRzQosh
     // hech qachon "bu ayni shu F2 qatori allaqachon qo'shilganmi" tekshirmasdi — agar
     // foydalanuvchi (masalan avvalgi "oy ustuniga 0 yozilgan" bug tufayli) BIR XIL F2
     // faylni QAYTA-QAYTA saqlagan bo'lsa, HAR SAFAR yangi bl+/rs+ qator qo'shilib,
     // ularning SMETA (haqiqiy hajm×narx) qiymati НАКРУТКА/ПРЯМЫЕ ЗАТРАТЫ jamisiga
     // takror-takror qo'shilib ketardi — foydalanuvchi ko'rgan "2.2mlrd→3.3mlrd" kabi
     // katta noaniqliklarning eng ehtimolli sababi AYNAN SHU edi. Endi HAR bir dop
     // item qo'shilishidan OLDIN — o'sha varaqda ХУДДИ ШУ F2 uid bilan (KOD katagi
     // notesida) ALLAQACHON qo'shilgan qator bormi tekshiriladi; bo'lsa, YANGISI
     // QO'SHILMAYDI — faqat mavjud qatorning oy qiymati yangilanadi (idempotent).
     // ⚡ ATAYLAB KESHLANMAYDI — har chaqiruvda QAYTA o'qiladi, chunki oradagi insertlar
     // qator raqamlarini siljitadi; eski kesh saqlansa noto'g'ri qatorga yozib qo'yishi
     // mumkin edi. Bir F2 saqlashda dopps soni odatda oz (o'nlab) — xavfsizlik narxi arzon.
     function _f2DopUidQatorTop(varaqFull, uid){
        if(!uid) return 0;
        var w=_varaqYech(varaqFull);
        try{
           var pf=_plusFonOl(w.subOb), sh=pf?pf.getSheetByName(w.realV):null;
           if(!sh) return 0;
           var last=sh.getLastRow(); if(last<1) return 0;
           var col=CFG.C;
           var mk=sh.getRange(1,col.MARKER,last,1).getValues();
           var notes=sh.getRange(1,col.KOD,last,1).getNotes();
           for(var i=0;i<last;i++){
              var m=String(mk[i][0]||'').trim().toLowerCase();
              if(!/[+~]$/.test(m)) continue;
              if(String(notes[i][0]||'').trim()===uid) return i+1;
           }
        }catch(e){}
        return 0;
     }
     var _oyColCache = {};   // varaqFull → oyNom ustuni (c); c/c+1/c+2 = ОБЪЁМ/НАРХ/СУММА
     function _oyColOl(varaqFull){
        if(_oyColCache[varaqFull] !== undefined) return _oyColCache[varaqFull];
        var c = 0, w=_varaqYech(varaqFull);
        try { var pf=_plusFonOl(w.subOb); var sh=pf?pf.getSheetByName(w.realV):null;
              if(sh){ var oy=_f2Oylar(sh); var _onU=_oyKey(oyNom);
              for(var o=0;o<oy.length;o++){ if(_oyKey(oy[o].nom)===_onU){ c=oy[o].col; break; } } } } catch(e){}
        _oyColCache[varaqFull] = c; return c;
     }
     function _oyYozDarhol(varaqFull, row, obyomV, narxV, summaV, uid){
        if(!row) return;
        var c = _oyColOl(varaqFull);
        if(!c){ dopXato.push('Ой устуни топилмади: '+varaqFull+' (қатор '+row+') — қиймат ёзилмади!'); return; }
        try {
           var w=_varaqYech(varaqFull);
           var pf=_plusFonOl(w.subOb); if(!pf) return;
           var sh = pf.getSheetByName(w.realV); if(!sh) return;
           var rCell = sh.getRange(row, c);
           rCell.setValue(_toNum(obyomV));
           if(uid) { rCell.setNote(uid); } else if (obyomV === 0 || obyomV === '') { rCell.clearNote(); }
           /* ⚡⚡⚡ 2026-08-13 ПЕРЕРАСЧЁТ: avval shart `>0` edi — MANFIY narx/summa
            * (korrektirovka) oy ustuniga UMUMAN YOZILMASDI. Natijada hajm minus
            * bo'lib yozilsa ham SUMMA eski (musbat) qolib, F2 jami noto'g'ri
            * chiqardi. Endi shart «nol emas» — manfiy ham yoziladi.
            * Aynan 0 esa yozilmaydi (mavjud qiymatni bekorga o'chirmasin). */
           if(Number(narxV)) sh.getRange(row, c+1).setValue(_toNum(narxV));
           if(Number(summaV)) sh.getRange(row, c+2).setValue(_toNum(summaV));
           dopsYoz++;
        } catch(e){ dopXato.push('Ой ёзиш('+row+'): '+(e.message||e)); }
     }

     for(var i=_dopStart; i<dopps.length; i++) {
        // ⚡⚡⚡ 2026-07-17 VAQT-BYUDJET CHECKPOINT: fon rejimida (~4.5 daq oshsa) —
        // qolgan dopps'ni KEYINGI trigger davom ettiradi. Qismlarga bo'lingani +
        // uid-note dedup tufayli 6 daqiqalik GAS limiti endi ma'lumot yo'qotmaydi.
        if(_JOBM && i>_dopStart && _vaqtTugadi()){
           _setF2Prog('⏸ Вақт лимити — навбатда давом этади ('+i+'/'+dopps.length+' қўшимча)...');
           return _resume({editStart:edits.length, dopStart:i, done:i, total:dopps.length});
        }
        var d = dopps[i];
        try {
           if(d.action === 'add_rz') {
              // ⚡ 2026-07-12 YANGI: smetada YO'Q butun bo'lim — varaq OXIRIGA yangi
              // 'rz+' razdel ochiladi, ichiga aktdagi barcha ishlari (bl+ va rs+ lari
              // bilan) KETMA-KET joylanadi. Oy qiymatlari darhol yoziladi.
              // ⚡ TAKRORIY-QO'SHISH HIMOYASI: agar shu rz (uid) allaqachon qo'shilgan
              // bo'lsa — yangisini OCHMAYMIZ, mavjud qatordan davom etamiz.
              var borRzRow = _f2DopUidQatorTop(d.varaq, d.uid);
              var cursor;
              if(borRzRow){ cursor = borRzRow; dopsYoz++; }
              else {
                 _setF2Prog('➕ РАЗДЕЛ: '+String(d.nom||'').substring(0,30)+' ('+((d.children||[]).length)+' та иш)');
                 var rzR = apiRzQosh({obyekt: obyekt, varaq: d.varaq, nom: d.nom, afterRow: 0, f2_mode: true, f2Uid: d.uid});
                 cursor = rzR.rzRow;
                 dopsYoz++;
              }
              if(d.children && d.children.length > 0) {
                 for(var j=0; j<d.children.length; j++) {
                    var cBl = d.children[j];
                    var borBlRow = _f2DopUidQatorTop(d.varaq, cBl.uid);
                    if(cBl.type === 'bl'){
                       var nBlRow;
                       if(borBlRow){ nBlRow = borBlRow; }
                       else {
                          var rB = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: cursor, kod: cBl.kod, nom: cBl.nom, birlik: cBl.bir, hajm: cBl.hajm, narx: cBl.narx||0, zamena: false, f2_mode: true, f2Uid: cBl.uid});
                          nBlRow = rB.blRow;
                       }
                       cursor = nBlRow;
                       _oyYozDarhol(d.varaq, nBlRow, cBl.hajm, cBl.narx, cBl.summa, cBl.uid);
                       if(cBl.children && cBl.children.length){
                          for(var k=0; k<cBl.children.length; k++){
                             var cRs2 = cBl.children[k];
                             if(cRs2.type!=='rs' && cRs2.type!=='mat' && cRs2.type!=='ob') continue;
                             var borRsRow2 = _f2DopUidQatorTop(d.varaq, cRs2.uid);
                             var rsRow2;
                             if(borRsRow2){ rsRow2 = borRsRow2; }
                             else {
                                // ⚡ 2026-08-13: `>0` → `Number(...)` — manfiy (перерасчёт) norma ham norma deb qabul qilinadi
                                var cN2 = (Number(cRs2.norma) ? cRs2.norma : cRs2.hajm);
                                var rr3 = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: nBlRow, kod: cRs2.kod, nom: cRs2.nom, birlik: cRs2.bir, norm: cN2, cat: cRs2.type, kat: cRs2.kat, narx: cRs2.narx||0, eObyom: !Number(cRs2.norma), zamena: false, f2_mode: true, f2Uid: cRs2.uid});
                                rsRow2 = rr3.rsRow;
                             }
                             _oyYozDarhol(d.varaq, rsRow2, cRs2.hajm, cRs2.narx, cRs2.summa, cRs2.uid);
                             if(rsRow2>cursor) cursor = rsRow2;
                          }
                       }
                    } else if(cBl.type==='mat' || cBl.type==='ob' || cBl.type==='rs'){
                       // razdel ostidagi mustaqil material/uskuna — bl sifatida emas,
                       // alohida qator (apiBlQosh bl+ ochadi — mat uchun ham yetarli
                       // struktura, kategoriya kat orqali) — soddalik uchun bl+ qilib
                       // emas, rs siz yakka qator sifatida apiBlQosh bilan qo'shamiz
                       var rMRow;
                       if(borBlRow){ rMRow = borBlRow; }
                       else {
                          var rM = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: cursor, kod: cBl.kod, nom: cBl.nom, birlik: cBl.bir, hajm: cBl.hajm, narx: cBl.narx||0, zamena: false, f2_mode: true, f2Uid: cBl.uid});
                          rMRow = rM.blRow;
                       }
                       cursor = rMRow;
                       _oyYozDarhol(d.varaq, rMRow, cBl.hajm, cBl.narx, cBl.summa, cBl.uid);
                    }
                 }
              }
           } else if(d.action === 'add_rs') {
              // Mavjud BL ga rs+ qo'shish. E: rs → НОРМА (d.norma), aks holda ОБЪЁМ.
              // ⚡ TAKRORIY-QO'SHISH HIMOYASI (izohga qarang, funksiya boshida).
              var borRow = _f2DopUidQatorTop(d.varaq, d.uid);
              if(borRow){
                 _oyYozDarhol(d.varaq, borRow, d.hajm, d.narx, d.summa, d.uid);
              } else {
                 _setF2Prog('➕ Ресурс: '+String(d.nom||'').substring(0,28)+' (обём '+d.hajm+', сумма '+(d.summa||0)+')');
                 // eObyom: F2 dagi F bo'sh bo'lgan (d.norma=0) → E to'liq obyom (ko'paytirilmaydi)
                 // ⚡ 2026-08-13: `>0` → `Number(...)` — manfiy (перерасчёт) norma yo'qolmasin
                 var rNorm = (Number(d.norma) ? d.norma : d.hajm);
                 var rr = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: d.targetRow, kod: d.kod, nom: d.nom, birlik: d.bir, norm: rNorm, cat: d.type, kat: d.kat, narx: d.narx, eObyom: !Number(d.norma), zamena: !!d.zamena, f2_mode: true, f2Uid: d.uid});
                 _oyYozDarhol(d.varaq, rr.rsRow, d.hajm, d.narx, d.summa, d.uid);
              }
           } else {
              // add_bl / zamena_add — TANLANGAN razdel/ish ichiga yangi ish
              // ⚡ TAKRORIY-QO'SHISH HIMOYASI (izohga qarang, funksiya boshida): aynan
              // shu F2 uid bilan bu varaqda oldin qo'shilgan qator bo'lsa — YANGI QATOR
              // OCHILMAYDI, faqat mavjudining oy qiymati yangilanadi. Aks holda har
              // qayta-saqlashda (masalan avvalgi "0 chiqdi" bugidan keyin urinib
              // ko'rilganda) qator KO'PAYIB, СМЕТА/НАКРУТКА жамиси shishib ketardi.
              var borBl = _f2DopUidQatorTop(d.varaq, d.uid);
              var newBlRow;
              if(borBl){
                 newBlRow = borBl;
              } else {
                 var afterRow = (d.action ? (d.targetRow||0) : 0);
                 _setF2Prog('➕ '+(d.tur==='mat'?'Материал':(d.tur==='ob'?'Ускуна':'Иш'))+': '+String(d.nom||'').substring(0,24)+' (сумма '+(d.summa||0)+')');
                 var r = apiBlQosh({obyekt: obyekt, varaq: d.varaq, afterRow: afterRow, kod: d.kod, nom: d.nom, birlik: d.bir, hajm: d.hajm, narx: d.narx||0, tur: d.tur, zamena: (d.action==='zamena_add'||!!d.zamena), f2_mode: true, f2Uid: d.uid});
                 newBlRow = r.blRow;
              }
              // ⚡⚡⚡ 2026-07-05: avval bu yerda bl.E/F ATAYLAB 0 GA QAYTA YOZILARDI
              // ("smetada yo'q ish" degan eski qaror) — NATIJADA rs bolalarning
              // F=bl.E×norma formulasi 0×norma=0 bo'lib, BUTUN zamena hajmlari 0
              // chiqardi (foydalanuvchi 2-rasmda ko'rsatdi). Endi bl.E=F2 dagi
              // bajarilgan obyom (apiBlQosh o'zi yozadi) — zamena real ish, uning
              // smetasi "qo'shimcha" sifatida jamiga qo'shiladi (foydalanuvchi
              // 1490mln=joriy jami variantini tanlagan).
              _oyYozDarhol(d.varaq, newBlRow, d.hajm, d.narx, d.summa, d.uid);
              // Resurs (child) larni ham qo'shamiz — ish tarkibi (DARHOL yoziladi)
              if(d.children && d.children.length > 0) {
                 for(var j=0; j<d.children.length; j++) {
                    var cRs = d.children[j];
                    if(cRs.type === 'rs' || cRs.type === 'mat' || cRs.type === 'ob') {
                       var borRs = _f2DopUidQatorTop(d.varaq, cRs.uid);
                       if(borRs){
                          _oyYozDarhol(d.varaq, borRs, cRs.hajm, cRs.narx, cRs.summa, cRs.uid);
                       } else {
                          // ⚡ 2026-08-13: `>0` → `Number(...)` — manfiy (перерасчёт) norma yo'qolmasin
                          var cNorm = (Number(cRs.norma) ? cRs.norma : cRs.hajm);
                          var rr2 = apiRsQosh({obyekt: obyekt, varaq: d.varaq, blRow: newBlRow, kod: cRs.kod, nom: cRs.nom, birlik: cRs.bir, norm: cNorm, cat: cRs.type, kat: cRs.kat, narx: cRs.narx||0, eObyom: !Number(cRs.norma), zamena: (d.action==='zamena_add'||!!d.zamena), f2_mode: true, f2Uid: cRs.uid});
                          _oyYozDarhol(d.varaq, rr2.rsRow, cRs.hajm, cRs.narx, cRs.summa, cRs.uid);
                       }
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

  // ⚡⚡⚡ 2026-07-16 YAKUNIY SOLISHTIRUV (foydalanuvchi printsipi: «АКТ СУММАСИ —
  // ҲАҚИҚАТ. 1 млрд киритсам АЙНАН 1 млрд тушиши керак»). Yozib bo'lingach server
  // O'ZI oy ustunini qayta skanerlab (apiF2OySkan — faqat LEAF summalar, bl ikki
  // marta sanalmaydi) haqiqatda YOZILGAN jami summani hisoblaydi va akt jami bilan
  // solishtiradi. Farq — bog'lanmagan/yozilmagan qatorlar puli; foydalanuvchi endi
  // «hammasi joyida» yoki «X so'm yetmayapti» ni ANIQ ko'radi, taxmin qilmaydi.
  var yozildiJami = 0, farq = 0;
  try {
    _setF2Prog('4/4: Солиштирув — ёзилган сумма қайта ҳисобланмоқда...');
    // Faqat SHU saqlashda tegilgan lokalkalarni sanaymiz (ko'p smetali obyektda
    // boshqa lokalkaning shu oydagi eski yozuvlari farqni buzmasin)
    var _subSet={};
    edits.concat(dopps).forEach(function(e){
      var v=String((e&&e.varaq)||''); if(v.indexOf('||')>=0) _subSet[v.split('||')[0]]=1;
    });
    var skan = apiF2OySkan(obyekt, oyNom, Object.keys(_subSet));
    yozildiJami = (skan && skan.jamiSumma) || 0;
    if(aktJami){
      farq = aktJami - yozildiJami;
      if(Math.abs(farq) < 1){
        xabar += ' ✅ СОЛИШТИРУВ: акт '+Math.round(aktJami).toLocaleString()+' = ёзилди '+Math.round(yozildiJami).toLocaleString()+' (аниқ мос).';
      } else {
        xabar += ' ⚠️ СОЛИШТИРУВ: акт '+Math.round(aktJami).toLocaleString()+' / ёзилди '+Math.round(yozildiJami).toLocaleString()
               + ' / ФАРҚ '+Math.round(farq).toLocaleString()+' сўм — бу боғланмай қолган қаторлар пули (импорт ойнасидаги «Қолгани» рўйхатини кўринг).';
      }
    } else {
      xabar += ' ℹ️ Ёзилган жами (қайта скан): '+Math.round(yozildiJami).toLocaleString()+' сўм.';
    }
  } catch(exSk){ /* solishtiruv yiqilsa asosiy natijaga xalal bermaydi */ }

  /* ⚡⚡⚡ 2026-07-27 BILIM BAZASINI BOYITISH (foydalanuvchi taklifi: «Ф2 ларда аввал
   * ишлатилмаган иш турлари ва ресурслари бўлиши мумкин — уларни ҳам иш турлари
   * рўйхатига ёзадиган қилсак, маълумотлар бойлигимиз ошиб боради»).
   * Har F2 importda YANGI (qo'shimcha/zamena) ish turlari o'z resurslari bilan
   * ИШ ТУРЛАРИ КУТУБХОНАСИга (_ITK_SH) yoziladi. Kalit — nom+birlik (`_itkKey`),
   * shuning uchun takror yozilmaydi; keyingi obyektlarda «Иш тури қўшиш» dan
   * TAYYOR holda tanlanadi. Har import bazani boyitib boradi. */
  try {
    if(typeof _itkSaqlaBatch==='function' && typeof _itkFlush==='function' && dopps && dopps.length){
      var _itkYangi = {};
      dopps.forEach(function(d){
        if(!d || (d.action!=='add_bl' && d.action!=='zamena_add')) return;
        if(d.tur && d.tur!=='bl') return;                 // material/uskuna — ish turi emas
        var nom=String(d.nom||'').trim(), bir=String(d.bir||'').trim();
        if(!nom || !bir) return;
        var blHajm=_toNum(d.hajm)||0;
        var rsArr=[];
        (d.children||[]).forEach(function(c){
          if(!c || (c.type!=='rs' && c.type!=='mat' && c.type!=='ob')) return;
          var cn=String(c.nom||'').trim(), cb=String(c.bir||'').trim();
          if(!cn || !cb) return;
          // norm = resurs hajmi / ish hajmi (bl birligiga to'g'ri keladigan sarf)
          var nrm = _toNum(c.norma);
          if(!(nrm>0) && blHajm>0) nrm = _toNum(c.hajm)/blHajm;
          rsArr.push({kod:String(c.kod||'').trim(), nom:cn, birlik:cb, norm:(nrm>0?nrm:0)});
        });
        if(!rsArr.length) return;                          // resurssiz ish — kutubxonaga foydasiz
        _itkFlush(_itkYangi, {kod:String(d.kod||'').trim(), nom:nom, birlik:bir, e:blHajm},
                  rsArr, 'Ф2 импорт: '+obyekt, 'F2');
      });
      var _itkSoni = Object.keys(_itkYangi).length;
      if(_itkSoni){
        _itkSaqlaBatch(_itkYangi);
        xabar += ' 📚 Иш турлари кутубхонасига '+_itkSoni+' та янги иш ёзилди.';
        _setF2Prog('📚 Кутубхона бойитилди: '+_itkSoni+' та янги иш тури');
      }
    }
  } catch(eItk){ Logger.log('ITK boyitish: '+eItk); }

  // ⚡ 2026-07-16 Ф2 ЖУРНАЛ (audit-iz): HAR saqlash _F2_JURNAL varag'iga yoziladi —
  // kim, qachon, qaysi obyekt/oy, nechta qator, akt/yozildi/farq. Keyin "bu oyga
  // nima bo'lgan edi?" degan savolga hujjatli javob doim bor (CFG.F2_JURNAL avval
  // e'lon qilingan-u hech qachon ishlatilmagan edi).
  try {
    var ssJ=SpreadsheetApp.getActive();
    var jsh=ssJ.getSheetByName(CFG.F2_JURNAL);
    if(!jsh){
      jsh=ssJ.insertSheet(CFG.F2_JURNAL);
      jsh.getRange(1,1,1,9).setValues([['ВАҚТ','ОБЪЕКТ','ОЙ','МОСЛАШГАН','ДОП','АКТ ЖАМИ','ЁЗИЛДИ','ФАРҚ','КИМ']])
        .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
      jsh.setFrozenRows(1);
      jsh.setColumnWidth(1,140); jsh.setColumnWidth(2,220); jsh.setColumnWidth(9,180);
    }
    var email=''; try{ email=Session.getActiveUser().getEmail(); }catch(eU){}
    jsh.appendRow([new Date(), obyekt, oyNom, mappedYoz, dopsYoz,
      (aktJami||''), yozildiJami, (aktJami?farq:''), email]);
  } catch(eJr){}

  return {ok: true, xabar: xabar, mapped: mappedYoz, dops: dopsYoz, jami: jami,
          aktJami: aktJami, yozildiJami: yozildiJami, farq: farq};
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
  // ⚡ 2026-07-12 TUZATILDI: "📄 Ҳужжат Яратиш" тугмаси босилган сайин (танловни
  // ўзгартириб қайта-қайта preview олганда) АВВАЛГИ шу ой учун яратилган ҳужжат
  // йиғилиб қолмаслиги учун — янгисини яратишдан олдин ХУДДИ ШУ номдаги эскисини
  // (агар бор бўлса) корзинага ташлаймиз. Натижада папкада ҳар ой учун БИТТА
  // актуал preview қолади (Game Club/Йевропа Ошхонаси'да файллар кўпайиши шу
  // ердан эди).
  if(folderId){
    try{
      var _oldIt = DriveApp.getFolderById(folderId).getFilesByName(nm);
      while(_oldIt.hasNext()){ try{ _oldIt.next().setTrashed(true); }catch(e0){} }
    }catch(e){}
  }
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

  // ⚡⚡⚡ 2026-07-15 TO'LIQ QAYTA YOZILDI (foydalanuvchi: "yasalgan Ф2 hujjati formati
  // na TN qurilishga na ABC formatiga o'xshamaydi"): endi hujjat HAQIQIY TN akt
  // tuzilishida chiqadi — titul blok, 2 qatorli sarlavha (КОЛИЧЕСТВО: на единицу /
  // по проектным данным; СТОИМОСТЬ: на.ед.изм / общая), РАЗДЕЛ A ustunda (merge),
  // ISH (bl) qatori o'z ШИФР/ЕД.ИЗМ/ОБЪЁМи bilan (client blMeta yuboradi), resurs
  // qatorlarida НОРМА (=tanlangan hajm / ish hajmi), ИТОГО ПО РАЗДЕЛУ, ВСЕГО ПО АКТУ
  // va imzo bloki. I ustunda KO'RINMAS (oq shrift) marker saqlanadi: rz/bl/rs/mat/ob —
  // shu tufayli F2 Импорт bu faylni heuristikasiz 100% aniq qayta o'qiydi; dekorativ
  // qatorlarga 'x' markeri qo'yiladi (import ularni rz deb adashtirmasligi uchun —
  // apiF2FaylOqi'da mk9 to'la bo'lsa bo'sh-D/E/F-razdel heuristikasi ishlamaydi).
  var MAXC=9;
  var rows=[], rzRows=[], blRows=[], itogoRows=[], titleRows=[];
  function _push(arr, mk){ var a=arr.slice(); while(a.length<8) a.push(''); a.push(mk||''); rows.push(a); return rows.length-1; }

  _push([],'');
  titleRows.push(_push(['АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (Ф-2)'],'x'));
  titleRows.push(_push(['Объект: '+obyekt],'x'));
  var sana = Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','dd.MM.yyyy');
  titleRows.push(_push(['За: '+oyNom+'   (тузилди: '+sana+')'],'x'));
  _push([],'');
  var hdr1 = _push(['№','ШИФР','НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ','ЕД. ИЗМ.','КОЛИЧЕСТВО','','СТОИМОСТЬ, СУМ',''],'x');
  var hdr2 = _push(['','','','','на единицу','по проектным данным','на.ед.изм','общая'],'x');
  var numRow = _push([1,2,3,4,5,6,7,8],'x');

  var no=0, jamiSumma=0;
  rzOrder.forEach(function(rz){
    rzRows.push(_push([rz],'rz'));
    var rzSumma=0;
    rzMap[rz].order.forEach(function(bl){
      var arr=rzMap[rz].map[bl], blRowIdx=-1, blSumma=0, blVol=0;
      if(bl){
        no++;
        var m=arr[0]||{};
        blVol=_toNum(m.blF2mum);
        // bl объём = ish qoldig'i (F2MUM). <=0 bo'lsa bo'sh qoladi (import bunday
        // bl'ni o'tkazib yuboradi — juda kam edge, ma'lumot to'qib yozmaymiz).
        blRowIdx=_push([no, m.blKod||'', bl, m.blBir||'', (blVol>0?blVol:''), '', '', 0],'bl');
        blRows.push(blRowIdx);
      }
      arr.forEach(function(it){
        var hajm=_toNum(it.hajm), narx=_toNum(it.narx), summa=hajm*narx;
        jamiSumma+=summa; blSumma+=summa; rzSumma+=summa;
        if(bl){
          var norma=(blVol>0 && hajm>0)?(hajm/blVol):'';
          _push(['', it.kod||'', it.nom||'', it.bir||'', norma, hajm, narx, summa], it.type||'rs');
        } else {
          // mustaqil mat/ob/rs — TN qoidasi: E=ОБЪЁМ, F bo'sh
          no++;
          _push([no, it.kod||'', it.nom||'', it.bir||'', hajm, '', narx, summa], it.type||'mat');
        }
      });
      if(blRowIdx>=0) rows[blRowIdx][7]=blSumma;
    });
    itogoRows.push(_push(['','','ИТОГО ПО РАЗДЕЛУ:','','','','',rzSumma],'x'));
  });
  var vsegoRow = _push(['','','ВСЕГО ПО АКТУ:','','','','',jamiSumma],'x');
  _push([],'');
  _push(['','Сдал (Подрядчик): ____________________','','','','Принял (Заказчик): ____________________','',''],'x');

  sh.getRange(1,1,rows.length,MAXC).setValues(rows);

  // ── FORMATLASH (haqiqiy akt ko'rinishi) ──
  function _R(i){ return i+1; }   // 0-based massiv idx → sheet qator raqami
  titleRows.forEach(function(ri){ sh.getRange(_R(ri),1,1,8).merge().setHorizontalAlignment('center'); });
  sh.getRange(_R(titleRows[0]),1).setFontWeight('bold').setFontSize(14);
  // 2 qatorli sarlavha: E:F va G:H gorizontal, A..D vertikal merge
  sh.getRange(_R(hdr1),5,1,2).merge();
  sh.getRange(_R(hdr1),7,1,2).merge();
  for(var mc=1; mc<=4; mc++) sh.getRange(_R(hdr1),mc,2,1).merge();
  sh.getRange(_R(hdr1),1,2,8).setFontWeight('bold').setBackground('#d9e1f2')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sh.getRange(_R(numRow),1,1,8).setFontStyle('italic').setFontSize(9)
    .setBackground('#f2f2f2').setHorizontalAlignment('center');
  rzRows.forEach(function(ri){ sh.getRange(_R(ri),1,1,8).merge().setFontWeight('bold').setBackground('#fff2cc'); });
  blRows.forEach(function(ri){ sh.getRange(_R(ri),1,1,8).setFontWeight('bold'); });
  itogoRows.forEach(function(ri){ sh.getRange(_R(ri),1,1,8).setFontWeight('bold').setBackground('#e2efda'); });
  sh.getRange(_R(vsegoRow),1,1,8).setFontWeight('bold').setFontSize(12).setBackground('#c6e0b4');
  sh.getRange(_R(hdr1),1,vsegoRow-hdr1+1,8).setBorder(true,true,true,true,true,true);
  if(vsegoRow>numRow) sh.getRange(_R(numRow)+1,5,vsegoRow-numRow,4).setNumberFormat('#,##0.###');
  // I ustun — texnik marker (import uchun), odam ko'zidan yashirin
  sh.getRange(1,9,rows.length,1).setFontColor('#ffffff');
  sh.setColumnWidth(1,36); sh.setColumnWidth(2,110); sh.setColumnWidth(3,420); sh.setColumnWidth(4,72);
  sh.setColumnWidth(5,92); sh.setColumnWidth(6,110); sh.setColumnWidth(7,110); sh.setColumnWidth(8,130);
  sh.setColumnWidth(9,26);
  sh.setFrozenRows(_R(numRow));

  return {ok:true, url: ss.getUrl(), fileId: ss.getId(), name: nm, jami: jamiSumma, soni: no};
}

function _oyObj(oyNom, hajm, narx, summa, uid){
  var o = {}, v = {obyom: Number(hajm)||0};
  if(Number(narx)>0) v.narx = Number(narx);
  // ⚡ 2026-07-16 TUZATILDI: avval `summa>0` sharti MANFIY summani tashlab yuborardi —
  // «перерасчет»/сторно aktlarda (Амфитеатр avgust: butun bo'lim minus!) akt summasi
  // manfiy bo'ladi; static yozilmagach СУММА formulasi obyom×SMETA-narx bilan qayta
  // hisoblab, akt jamidan chetlashardi. AKT SUMMASI — HAQIQAT: 0 dan farqli bo'lsa
  // (musbat ham, manfiy ham) AYNAN o'zi statik yoziladi.
  if(Number(summa)) v.summa = Number(summa);
  if(uid) v.uid = uid;
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
/* ⚡⚡⚡ 2026-07-17 DURABLE JOB-STORE — F2 fon-yozuvi holati ScriptProperties'da
 * saqlanadi (kesh emas): 6 soatdan uzoq yashaydi, brauzer/kompyuter o'chsa ham
 * server (Google) tomonda davom etadi, foydalanuvchi XOHLAGAN vaqti holatni ko'radi.
 * Holat: {status:'navbat'|'ishlayapti'|'tugadi'|'xato', obyekt, oyNom, done, total,
 *         boshlandi, yangilandi, xabar, resume:{dopStart,mappedYoz,dopsYoz}} */
var _F2_JOB_KEY = 'F2_FON_JOB';
function _f2JobSet(j){
  try { j.yangilandi = Date.now();
    PropertiesService.getScriptProperties().setProperty(_F2_JOB_KEY, JSON.stringify(j)); } catch(e){}
}
function _f2JobGet(){
  try { var s=PropertiesService.getScriptProperties().getProperty(_F2_JOB_KEY);
    return s?JSON.parse(s):null; } catch(e){ return null; }
}
/* Panel monitoring reconnect — modal qayta ochilganda/panel yuklanganda chaqiriladi.
 * Fon jarayon bor bo'lsa (yoki yaqinda tugagan bo'lsa) holatni qaytaradi. */
function apiF2JobHolat(){
  var j=_f2JobGet();
  /* ⚡⚡⚡ 2026-07-27 O'Z-O'ZINI TIKLASH (self-healing) QO'RIQCHISI.
   * Foydalanuvchi holati: 07:00 da boshlandi, 07:28 da ham log o'zgarmagan —
   * GAS 6-daqiqa limitida jarayon O'LGAN, trigger esa boshida o'chirilgani uchun
   * hech kim uni qayta ishga tushirmagan → ish ABADIY muzlab qolgan.
   * ENDI: agar ish «ishlayapti» ko'rinsa-yu 7 daqiqadan beri YANGILANMAGAN bo'lsa —
   * u o'lgan hisoblanadi va SAQLANGAN nuqtadan (resume) AVTOMAT davom ettiriladi.
   * Panel har 3 soniyada shu funksiyani chaqirgani uchun tiklanish o'z-o'zidan bo'ladi. */
  try{
    if(j && (j.status==='ishlayapti'||j.status==='navbat')){
      var jim = Date.now() - (j.yangilandi||0);
      if(jim > 7*60*1000){
        var trs=ScriptApp.getProjectTriggers(), bor=false;
        for(var i=0;i<trs.length;i++) if(trs[i].getHandlerFunction()==='_f2FonQadam') bor=true;
        if(!bor && cacheGet('f2fon_payload')){
          j.qaytaUrinish=(j.qaytaUrinish||0)+1;
          if(j.qaytaUrinish<=5){
            j.xabar='⚡ Жараён тўхтаб қолган эди — сақланган нуқтадан автомат давом эттирилди ('+j.qaytaUrinish+')';
            _f2JobSet(j);
            _setF2Prog(j.xabar);
            _f2FonTriggerQoy(1500);
          } else {
            j.status='xato'; j.xabar='5 марта уриниб ҳам тугамади — F2 ни қайта юборинг';
            _f2JobSet(j);
          }
        }
      }
    }
  }catch(eW){}
  return { job:j, hozir: apiF2QollaProgress(), log:(apiF2QollaLog().log||[]) };
}

function apiF2QollaNavbatga(obyekt, oyNom, edits, dopps, aktJami) {
  edits=edits||[]; dopps=dopps||[];
  cachePut('f2fon_payload', {obyekt:obyekt, oyNom:oyNom, edits:edits, dopps:dopps, aktJami:Number(aktJami)||0}, 21600);
  _f2JobSet({status:'navbat', obyekt:obyekt, oyNom:oyNom, done:0, total:(edits.length + dopps.length),
             boshlandi:Date.now(), xabar:'Навбатга қўшилди', resume:{dopStart:0,mappedYoz:0,dopsYoz:0}});
  _f2LogTozala();
  _setF2Prog('⏳ Навбатда: '+obyekt+' / '+oyNom+' ('+edits.length+' мослаштирилган, '+dopps.length+' қўшимча)');
  _f2FonTriggerQoy();
  return {ok: true, fon: true, xabar: '✅ Навбатга қўшилди — фонда (серверда) ёзилади. Компьютерни ўчирсангиз ҳам давом этади; истаган вақт мониторингда кўрасиз.'};
}

function _f2FonTriggerQoy(kechikish){
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === '_f2FonQadam') { try { ScriptApp.deleteTrigger(trs[i]); } catch(e){} }
  }
  ScriptApp.newTrigger('_f2FonQadam').timeBased().after(kechikish||2000).create();
}

function _f2FonQadam() {
  // O'z (bir martalik) triggerini tozalash — pastda kerak bo'lsa qayta qo'yiladi
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === '_f2FonQadam') { try { ScriptApp.deleteTrigger(trs[i]); } catch(e){} }
  }
  var p = cacheGet('f2fon_payload');
  var job = _f2JobGet();
  if (!p) {
    _setF2Prog('❌ Фон: маълумот топилмади (кеш эскирган) — F2 ни қайта юборинг');
    if(job){ job.status='xato'; job.xabar='Маълумот кешда топилмади'; _f2JobSet(job); }
    return;
  }
  var resume = (job && job.resume) || {dopStart:0,mappedYoz:0,dopsYoz:0};
  if(job){ job.status='ishlayapti'; _f2JobSet(job); }
  try {
    var r = apiF2Qolla(p.obyekt, p.oyNom, p.edits, p.dopps, p.aktJami, resume);
    if (r && r.resume) {
      // ⏸ Vaqt byudjeti tugadi — keyingi trigger davom ettiradi (ma'lumot yo'qolmaydi)
      if(job){
        job.resume={dopStart:r.dopStart||0, editStart:r.editStart||0, oyTayyor:!!r.oyTayyor,
                    mappedYoz:r.mappedYoz||0, dopsYoz:r.dopsYoz||0};
        // Progress: mos qatorlar + qo'shimchalar birgalikda
        var _jami=(p.edits||[]).length+(p.dopps||[]).length;
        job.done=(r.mappedYoz||0)+(r.dopsYoz||0); job.total=_jami||job.total;
        job.status='ishlayapti';
        job.xabar='Давом этмоқда: '+job.done+'/'+job.total;
        _f2JobSet(job);
      }
      _f2FonTriggerQoy(3000);
      return;
    }
    // ✅ To'liq tugadi
    cacheDel('f2fon_payload');
    if(job){ job.status='tugadi'; job.done=job.total; job.resume=null;
             job.xabar=(r && r.xabar) || 'Тугади'; _f2JobSet(job); }
    _setF2Prog((r && r.ok ? '✅ ТУГАДИ: ' : '⚠ ') + (r && r.xabar || ''));
  } catch(e) {
    // Xato — job saqlanadi, foydalanuvchi ko'radi va qayta urinishi mumkin
    if(job){ job.status='xato'; job.xabar='Хато: '+(e.message||e); _f2JobSet(job); }
    _setF2Prog('❌ Хато: ' + (e.message || e));
  }
}

// ⚡ 2026-08-12: Eski kiritilgan F2 (Excel) faylini arxivdan qidirib topish (Tahrirlash uchun)
function apiF2EskiFaylOqi(obyekt, oyNom) {
  var a = typeof sozAsosiy === 'function' ? sozAsosiy() : {rootId: ''};
  var parentName = typeof _cfgKalit === 'function' ? _cfgKalit(obyekt) : String(obyekt).split(' - ')[0].trim();
  
  var sk = typeof _keshOlStale === 'function' ? (_keshOlStale('skan') || []) : [];
  var folderId = '';
  for (var i = 0; i < sk.length; i++) {
    var skNom = String(sk[i].obyekt||'').trim();
    if (skNom === parentName || skNom === String(obyekt).trim() || String(obyekt).indexOf(skNom) === 0) {
      folderId = sk[i].folderId; break;
    }
  }
  if (!folderId) {
    for (var s2 = 0; s2 < sk.length; s2++) {
      var sNom = String(sk[s2].obyekt||'').trim();
      if (!sNom || !sk[s2].folderId) continue;
      var sKalit = (typeof _cfgKalit==='function') ? _cfgKalit(sNom) : sNom.split(' - ')[0].trim();
      if (String(sKalit).trim() === String(parentName).trim()) { folderId = sk[s2].folderId; break; }
    }
  }
  if (!folderId && a.rootId) {
    try {
      var root = DriveApp.getFolderById(a.rootId);
      var fIt = root.getFoldersByName(parentName);
      if (fIt.hasNext()) folderId = fIt.next().getId();
    } catch(e) {}
  }
  
  if (!folderId) return {ok: false, xabar: 'Объект папкаси топилмади (' + parentName + ')'};
  
  try {
    var folder = DriveApp.getFolderById(folderId);
    var f2Folder = null;
    var subF2 = folder.getFolders();
    while(subF2.hasNext()) {
      var sub = subF2.next();
      var n = sub.getName().toUpperCase();
      if(n === 'F2' || n === 'Ф2') { f2Folder = sub; break; }
    }
    if(!f2Folder) return {ok: false, xabar: 'Ушбу объект учун F2 папкаси мавжуд эмас (архив топилмади)'};

    /* ⚡⚡⚡ 2026-08-13 TUZATILDI: avval fayl nomi AYNAN
     *   obyekt + ' F2 ' + oyNom
     * bilan solishtirilardi. Haqiqiy arxivda nomlar XILMA-XIL:
     *   «Amfiteatr F2 Dekabr-2025.xlsx» · «Amfiteatr F2 08.2026»
     *   «Amfiteatr F2 Март 2026»        · «Amfiteatr - 109983_… F2 Март»
     * Panel esa oy nomini lotincha («Mart 2026») ko'rsatadi — fayl kirilcha
     * («Март 2026») bo'lsa MOS KELMASDI va tahrirlash hech qachon ochilmasdi.
     * ENDI: oy KANONIK kalitga (MM.YYYY) keltirilib solishtiriladi; nomlar
     * lotin/kiril, ajratgich (bo'shliq/tire/pastki chiziq) farqidan qat'i
     * nazar topiladi. Yil ko'rsatilmagan fayl (masalan «F2 Март») ham
     * nomzod sifatida qaytariladi — foydalanuvchi tanlaydi. */
    var kutilganKalit = _f2OyKalit(oyNom);
    var nomzodlar = [];
    var aniqMos = null;
    var dFiles = f2Folder.getFiles();
    while(dFiles.hasNext()) {
      var dF = dFiles.next();
      var dN = String(dF.getName()||'');
      var yozuv = {id: dF.getId(), nom: dN};
      // Fayl nomidan «F2» dan keyingi qismni olamiz (oy shu yerda bo'ladi)
      var m = dN.match(/(?:F2|Ф2)\s*(.*)$/i);
      var oyQismi = m ? m[1] : dN;
      var faylKalit = _f2OyKalit(oyQismi);
      if (kutilganKalit && faylKalit && faylKalit === kutilganKalit) {
        aniqMos = yozuv; break;
      }
      // Yilsiz oy ("Март") yoki umuman aniqlanmagan — nomzod ro'yxatiga
      var oyRaqam = _f2OyRaqam(oyQismi);
      var kutilganOy = kutilganKalit ? kutilganKalit.split('.')[0] : '';
      if (oyRaqam && kutilganOy && oyRaqam === kutilganOy) nomzodlar.push(yozuv);
      else if (!faylKalit) nomzodlar.push(yozuv);
    }

    if (aniqMos) return {ok: true, fileId: aniqMos.id, faylNomi: aniqMos.nom};

    if (nomzodlar.length) {
      return {ok: false, nomzodlar: nomzodlar,
        xabar: '«'+oyNom+'» учун АНИҚ мос файл топилмади, лекин '+nomzodlar.length+
               ' та эҳтимолий файл бор. Керакли файлни қўлда танланг.'};
    }

    return {ok: false, xabar: 'Ушбу ' + oyNom + ' ойига тегишли F2 файли Drive архивида топилмади. Файлни қўлда танлашингиз мумкин.'};
  } catch(ex) {
    return {ok: false, xabar: 'Архивни қидиришда хато: ' + String(ex)};
  }
}

/* ============ OY NOMI NORMALIZATSIYASI (2026-08-13) ============
 * Tizimda oy nomi kamida 4 xil ko'rinishda uchraydi:
 *   «03.2026» · «3.2026» · «Mart 2026» · «Март 2026» · «Dekabr-2025»
 * Solishtirish uchun hammasini KANONIK «MM.YYYY» ga keltiramiz.        */

var _F2_OYLAR = [
  ['01','ЯНВАР','JANVAR','YANVAR','JAN','ЯНВ'],
  ['02','ФЕВРАЛ','FEVRAL','FEB','ФЕВ'],
  ['03','МАРТ','MART','MAR'],
  ['04','АПРЕЛ','APREL','APR','АПР'],
  ['05','МАЙ','MAY','МАЯ'],
  ['06','ИЮН','IYUN','JUN'],
  ['07','ИЮЛ','IYUL','JUL'],
  ['08','АВГУСТ','AVGUST','AUG','АВГ'],
  ['09','СЕНТЯБР','SENTABR','SENTYABR','SEP','СЕН'],
  ['10','ОКТЯБР','OKTABR','OKTYABR','OCT','ОКТ'],
  ['11','НОЯБР','NOYABR','NOV','НОЯ'],
  ['12','ДЕКАБР','DEKABR','DEC','ДЕК']
];

/** Matndan oy raqamini ('01'..'12') topadi, topilmasa ''. */
function _f2OyRaqam(s){
  var t = String(s||'').toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/g,'');
  if(!t) return '';
  // Nom bo'yicha: UZUN variantlar birinchi tekshiriladi (qisqasi uzunning
  // ichida bo'lib qolib, xato oyni bermasin).
  var variantlar = [];
  for(var i=0;i<_F2_OYLAR.length;i++){
    for(var j=1;j<_F2_OYLAR[i].length;j++){
      if(_F2_OYLAR[i][j]) variantlar.push({oy:_F2_OYLAR[i][0], v:_F2_OYLAR[i][j]});
    }
  }
  variantlar.sort(function(a,b){ return b.v.length - a.v.length; });
  for(var k=0;k<variantlar.length;k++){
    if(t.indexOf(variantlar[k].v) >= 0) return variantlar[k].oy;
  }
  // Raqamli shakl: 03.2026 / 3-2026 / 032026
  var m = String(s||'').match(/(^|[^0-9])(\d{1,2})[.\-\/_ ]?(\d{4})([^0-9]|$)/);
  if(m){
    var n = parseInt(m[2],10);
    if(n>=1 && n<=12) return (n<10?'0':'')+n;
  }
  return '';
}

/** Matndan yilni ('2026') topadi, topilmasa ''. */
function _f2OyYil(s){
  var m = String(s||'').match(/(19|20)\d{2}/);
  return m ? m[0] : '';
}

/** Kanonik oy kaliti «MM.YYYY». Oy yoki yil topilmasa '' qaytaradi. */
function _f2OyKalit(s){
  var oy = _f2OyRaqam(s), yil = _f2OyYil(s);
  return (oy && yil) ? (oy + '.' + yil) : '';
}


/* ============ SMETAGA YANGI QATOR QO'SHISH (F2 Import UI) ============
 * ⚡⚡⚡ 2026-08-13: Frontend (F2Import «＋ Qator qo'shish» modali) allaqachon
 * `apiSmetaQatorQosh` ni chaqirardi, lekin bu funksiya GAS'da UMUMAN YO'Q edi —
 * ya'ni tugma bosilganda «Функция мавжуд эмас» xatosi qaytardi va hech narsa
 * qo'shilmasdi (o'lik tugma).
 *
 * Bu yerda YANGI qator-kiritish mantig'i YOZILMAYDI — u nozik va allaqachon
 * sinovdan o'tgan. Faqat pozitsion argumentlarni tekshirib, mavjud va ishonchli
 * apiRzQosh / apiBlQosh / apiRsQosh ga yo'naltiramiz (adapter qatlami).
 *
 * @param {string} obyekt   Obyekt (yoki sub-obyekt) nomi
 * @param {string} varaq    Varaq nomi ("sub||varaq" ham bo'lishi mumkin)
 * @param {string} tur      'rz' | 'bl' | 'rs' (yoki 'mat'/'ob')
 * @param {number} afterRow Shu qatordan KEYIN qo'shiladi (rs uchun — blok qatori)
 * @return {{ok:boolean, row?:number, xabar?:string}}
 */
function apiSmetaQatorQosh(obyekt, varaq, tur, afterRow, kod, nom, birlik, hajm, narx){
  try{
    obyekt = String(obyekt||'').trim();
    varaq  = String(varaq||'').trim();
    tur    = String(tur||'').trim().toLowerCase();
    nom    = String(nom||'').trim();
    var qator = parseInt(afterRow, 10) || 0;

    if(!obyekt) return {ok:false, xabar:'Объект танланмаган'};
    if(!varaq)  return {ok:false, xabar:'Варақ танланмаган'};
    if(!nom)    return {ok:false, xabar:'Номи киритилмаган'};

    if(tur === 'rz'){
      var rzRow = apiRzQosh({obyekt:obyekt, varaq:varaq, nom:nom, afterRow:qator});
      return {ok:true, row:rzRow, tur:'rz',
              xabar:'Раздел қўшилди'+(rzRow?(' ('+rzRow+'-қатор)'):'')};
    }

    if(tur === 'bl'){
      if(!qator) return {ok:false, xabar:'«Қайси қатордан кейин» кўрсатилмаган'};
      var blRow = apiBlQosh({
        obyekt:obyekt, varaq:varaq, afterRow:qator, nom:nom,
        kod:String(kod||''), birlik:String(birlik||''), hajm:_toNum(hajm), tur:'bl'
      });
      return {ok:true, row:blRow, tur:'bl',
              xabar:'Иш тури қўшилди'+(blRow?(' ('+blRow+'-қатор)'):'')};
    }

    // rs / mat / ob — resurs. apiRsQosh RESURS ni BLOK ostiga qo'yadi,
    // shuning uchun afterRow shu resursning ONA BLOK qatori bo'lishi kerak.
    if(tur === 'rs' || tur === 'mat' || tur === 'ob'){
      if(!qator) return {ok:false, xabar:'Ресурс қўшиш учун ОНА БЛОК қатори кўрсатилиши шарт'};
      if(!String(birlik||'').trim()) return {ok:false, xabar:'Ресурс учун БИРЛИК шарт'};
      var rsRow = apiRsQosh({
        obyekt:obyekt, varaq:varaq, blRow:qator, nom:nom,
        kod:String(kod||''), birlik:String(birlik||''),
        norm:_toNum(hajm), narx:_toNum(narx), kat:(tur==='rs'?'':tur)
      });
      return {ok:true, row:rsRow, tur:tur,
              xabar:'Ресурс қўшилди'+(rsRow?(' ('+rsRow+'-қатор)'):'')};
    }

    return {ok:false, xabar:'Нотўғри қатор тури: '+tur+' (rz/bl/rs кутилган)'};
  }catch(e){
    return {ok:false, xabar:'Қатор қўшилмади: '+String((e&&e.message)||e)};
  }
}

/* ============ QAYSI SMETA(LAR) BILAN ISHLASH KERAK? ============
 * ⚡⚡⚡ 2026-08-13 (foydalanuvchi: «man 1 yil oldin o'tkazgan F2 qaysi
 * smetalardan kelganini bilmayman... shunchaki shu biriktirilgandan
 * aniqlansin qaysi smetalarda ishlash kerak ekanligini»).
 *
 * MUAMMO: ko'p smetali obyektda (Amfiteatrda 15 ta) F2 qaysi smetaga
 * tegishli ekani OLDINDAN bilinmaydi. Hammasini o'qish esa GAS 6 daqiqa
 * limitiga uradi.
 *
 * YECHIM: YENGIL PROBE. To'liq daraxt QURILMAYDI (narxlash, bolalar, oy
 * ustunlari — hech biri). Har smetadan FAQAT 3 ustun (MARKER, KOD, NOM)
 * bitta getRange bilan o'qiladi va akt bilan ball beriladi:
 *     razdel nomi mos    = +5 ball
 *     ish/resurs kodi mos = +1 ball
 * Natijada smetalar ball bo'yicha saralanadi — foydalanuvchi eng yuqori
 * ballliklarni tanlab, FAQAT ularni yuklaydi.
 *
 * @param {string} obyekt   ota obyekt nomi
 * @param {Array}  aktTree  F2 fayldan o'qilgan daraxt (apiF2FaylOqi natijasi)
 * @return {{ok:boolean, takliflar:Array, xabar?:string}}
 */
/* ============ FAQAT TANLANGAN SMETALARNI O'QISH ============
 * ⚡ 2026-08-13: apiHolatOl(ota) BARCHA sub-smetani o'qib timeout beradi,
 * apiHolatOlLokalka esa FAQAT BITTASINI o'qiydi. Foydalanuvchiga esa
 * ko'pincha 2-3 ta kerak. Bu funksiya aynan ko'rsatilganlarini o'qib,
 * apiHolatOl bilan BIR XIL shaklda (varaq → "sub||varaq") birlashtiradi.
 *
 * @param {string} parent  ota obyekt
 * @param {Array}  subs    o'qiladigan lokalka (sub-obyekt) nomlari
 */
function apiHolatOlLokalkalar(parent, subs, forceRefresh){
  subs = (subs || []).filter(function(s){ return !!String(s||'').trim(); });
  if (!subs.length) return apiHolatOl(parent, forceRefresh);

  var tree = [], oylarSet = {}, xatolar = [];
  var jamiP = {stSm:0, stFk:0, stF2:0, chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0};

  for (var si = 0; si < subs.length; si++) {
    var sub = subs[si];
    try {
      var r = apiHolatOl(sub, forceRefresh);
      (r.oylar || []).forEach(function(o){ oylarSet[o] = 1; });
      if (r.jami){
        jamiP.stSm+=r.jami.stSm||0; jamiP.stFk+=r.jami.stFk||0; jamiP.stF2+=r.jami.stF2||0;
        jamiP.chel+=r.jami.chel||0; jamiP.mash+=r.jami.mash||0; jamiP.mat+=r.jami.mat||0;
        jamiP.ob+=r.jami.ob||0; jamiP.mk+=r.jami.mk||0; jamiP.kab+=r.jami.kab||0; jamiP.bez+=r.jami.bez||0;
      }
      (r.tree || []).forEach(function(rz){
        var clonedRz = JSON.parse(JSON.stringify(rz));
        clonedRz.lokalka = sub;
        _varaqPrefiks(clonedRz, sub);
        tree.push(clonedRz);
      });
    } catch(e){ xatolar.push(sub + ': ' + (e.message || e)); }
  }

  return { tree: tree, oylar: Object.keys(oylarSet), jamlangan: true,
           jami: jamiP, subs: subs, lokalkalar: _subObyektlar(parent),
           tanlangan: subs, xatolar: xatolar };
}

/* ============ QAYSI SMETA(LAR) BILAN ISHLASH KERAK? ============
 * ⚡⚡⚡ 2026-08-13 (foydalanuvchi: «man 1 yil oldin o'tkazgan F2 qaysi
 * smetalardan kelganini bilmayman... shu biriktirilgandan aniqlansin
 * qaysi smetalarda ishlash kerak ekanligini»).
 *
 * MUAMMO: ko'p smetali obyektda (Amfiteatrda 15 ta) F2 qaysi smetaga
 * tegishli ekani OLDINDAN bilinmaydi. Hammasini o'qish 6 daqiqa limitiga
 * (va Cloudflare ~100s limitiga) uradi — jonli sinovda tasdiqlandi: 15 ta
 * smetani bitta chaqiruvda tekshirish 127s da 524 xatosi berdi.
 *
 * YECHIM: BITTALAB probe. Har chaqiruv FAQAT BITTA smetani tekshiradi
 * (indeks bilan), client 0..soni-1 bo'yicha aylanib progress ko'rsatadi.
 * To'liq daraxt QURILMAYDI — har varaqdan 3 ustun (MARKER/KOD/NOM) bitta
 * getRange bilan o'qiladi va ball beriladi:
 *     razdel nomi mos     = +5 ball
 *     ish/resurs kodi mos = +1 ball
 *
 * @param {string} obyekt    ota obyekt nomi
 * @param {Object} kalitlar  {rz:[normallashgan razdel nomlari], kod:[normallashgan kodlar]}
 *                           — CLIENT tomonda hisoblanadi (yuk 258KB dan ~5KB ga tushadi)
 * @param {number} indeks    tekshiriladigan smeta tartib raqami (0 dan)
 */
function apiF2LokalkaTaklif(obyekt, kalitlar, indeks){
  try{
    var subs = _subObyektlar(obyekt);
    if (!subs.length) return {ok:true, kop:false, jami:0,
      xabar:'Бу объектда битта смета — танлаш керак эмас'};

    var i = parseInt(indeks, 10) || 0;
    if (i < 0 || i >= subs.length)
      return {ok:false, jami:subs.length, xabar:'Индекс чегарадан ташқари: '+i};

    var rzSet = {}, kodSet = {};
    ((kalitlar && kalitlar.rz)  || []).forEach(function(k){ if(k) rzSet[k]  = 1; });
    ((kalitlar && kalitlar.kod) || []).forEach(function(k){ if(k) kodSet[k] = 1; });
    if (!Object.keys(rzSet).length && !Object.keys(kodSet).length)
      return {ok:false, jami:subs.length, xabar:'Солиштириш учун калитлар бўш'};

    function nrmNom(s){ return String(s==null?'':s).toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/g,''); }
    function nrmKod(s){ return String(s==null?'':s).toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/g,'').replace(/^0+/,''); }

    var sub = subs[i];
    var col = CFG.C;
    var ball = 0, rzMos = 0, kodMos = 0, xato = '';
    /* ⚡ Metrika: SMETA qatorlarini sanash ADOLATSIZ — katta smeta avtomatik
     * yuqori ball olardi (jonli sinov: 206 vs 46, lekin bu faqat hajm farqi).
     * Endi AKTning nechta UNIKAL kaliti qoplanganini sanaymiz → «qoplama %».
     * Shunda kichik lekin aynan mos smeta ham to'g'ri birinchi chiqadi. */
    var rzHit = {}, kodHit = {};
    var rzJami = Object.keys(rzSet).length, kodJami = Object.keys(kodSet).length;
    try {
      var plus = _plusTop(sub);
      if (!plus) throw 'LRV_PLUS йўқ (ҳисобланмаган)';
      var shs = plus.getSheets();
      var maxC = Math.max(col.MARKER, col.NOM, col.KOD);
      for (var shi = 0; shi < shs.length; shi++) {
        var sh = shs[shi];
        var last = sh.getLastRow();
        if (last < 2) continue;
        var v = sh.getRange(1, 1, last, maxC).getValues();   // BITTA o'qish
        for (var r = 0; r < v.length; r++) {
          var mk = String(v[r][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
          if (!mk) continue;
          if (mk === 'rz') {
            var rn = nrmNom(v[r][col.NOM-1]);
            if (rn && rzSet[rn] && !rzHit[rn]) { rzHit[rn] = 1; rzMos++; ball += 5; }
          } else if (mk === 'bl' || mk === 'rs' || mk === 'mat' || mk === 'ob') {
            var kd = nrmKod(v[r][col.KOD-1]);
            if (kd && kodSet[kd] && !kodHit[kd]) { kodHit[kd] = 1; kodMos++; ball += 1; }
          }
        }
      }
    } catch(e){ xato = String((e && e.message) || e); }

    // Qoplama foizi — «aktning nechta foiz kaliti shu smetada bor»
    var qoplama = (rzJami + kodJami) > 0
      ? Math.round((rzMos + kodMos) / (rzJami + kodJami) * 100) : 0;

    return {ok:true, kop:true, jami:subs.length, indeks:i,
            natija:{lokalka:sub, ball:ball, rzMos:rzMos, kodMos:kodMos,
                    rzJami:rzJami, kodJami:kodJami, qoplama:qoplama, xato:xato}};
  }catch(e){
    return {ok:false, xabar:'Смета таклифи хатоси: '+String((e&&e.message)||e)};
  }
}
