/********************************************************************
 * 10_Engine.gs — ASOSIY DVIGATEL (LOCK-AWARE)
 * ==================================================================
 * Yangilanish:
 *   _normBirlik     — birlik strict normalizatsiya (м3/M3/m³ → М3)
 *   lockMi          — объект qulflanmi? Lock bo'lsa Ishla rad etiladi
 *   _qoshFaqatIshla — lock holatda + qatorlarni yangilash (asl tegmaydi)
 *   FORMAT_LOG      — har obyekt ishloviga "ФОРМАТ=TN/ABC4" yoziladi
 ********************************************************************/

/* ============ ENTRY: BUTUN PAPKA ============ */
function lrvPlusYasaPapka(){
  var t0=Date.now();
  var obs = papkaSkan();
  if(!obs.length) throw 'ROOT papkada hech qanday obyekt topilmadi.';
  var hisobot=[], jami=0, xato=0, qulf=0;
  for(var i=0;i<obs.length;i++){
    try {
      if(lockMi(obs[i].obyekt)){
        var rl = _qoshFaqatIshla(obs[i]);
        hisobot.push('🔒 '+obs[i].obyekt+' (қулф): '+rl.qosh+' "+" қатор қайта ишланди');
        qulf++; jami += rl.qosh;
        continue;
      }
      var r = _ishlaObyekt(obs[i]);
      hisobot.push('✓ '+obs[i].obyekt+' ['+obs[i].format+']: '+r.qator+' қатор, '+r.varaq+' варақ, '
                 +r.topilmadi+' нарх йўқ, '+r.ochirilgan+' бўш ўчди');
      jami += r.qator;
    } catch(e){
      xato++;
      hisobot.push('✗ '+obs[i].obyekt+': '+(e.message||e));
    }
  }
  var sek=Math.round((Date.now()-t0)/1000);
  SpreadsheetApp.getUi().alert(
    'ПАПКА ИШЛАНДИ ('+sek+' сек)\n\n'+hisobot.join('\n')+
    '\n\nЖами: '+jami+' қатор, '+qulf+' қулфланган, '+xato+' хато.'
  );
}

/* ============ ENTRY: BITTA OBYEKT ============ */
function lrvPlusYasaObyekt(obyektNom){
  var target=skanBitta(obyektNom);   // faqat shu obyekt papkasi (tez)
  if(!target) throw 'Объект топилмади: '+obyektNom;

  if(lockMi(obyektNom)){
    var rl=_qoshFaqatIshla(target);
    SpreadsheetApp.getUi().alert(
      '🔒 ҚУЛФЛАНГАН: '+obyektNom+'\n\n'+
      'Асл смета тегмади. Қўшимча ишлар янгиланди: '+rl.qosh+' қатор.'
    );
    return;
  }
  var r=_ishlaObyekt(target);
  SpreadsheetApp.getUi().alert(
    'ТАЙЁР: '+obyektNom+'  ['+target.format+']\n\n'+
    'Қаторлар: '+r.qator+'\nВарақлар: '+r.varaq+
    '\nНарх базаси: '+r.narxBaza+' resурс (ном+бирлик)'+
    '\nТопилмаган нарх: '+r.topilmadi+'  ('+CFG.NARX_LOG+')'+
    '\nЎчирилган бўш қатор: '+r.ochirilgan
  );
}


/* ============ BIR OBYEKTNI TO'LIQ ISHLASH (ATOMIK) ============
 * Butun obyekt bitta ijroda ishlanadi — LRV sahifa BO'LINMAYDI, format saqlanadi (copyTo).
 * _BAK_ tranzaksiya: ijro o'rtada o'lsa FAKT/F2 _BAK_ da saqlanadi, keyingi run tiklaydi.
 * Juda katta obyekt 6 daqiqaga sig'masligi mumkin → bottleneck'larni optimallashtirish kerak
 * (chunking EMAS — u natijani bo'lardi). Navbat: har obyekt alohida trigger (yangi 6 daqiqa). */
function _ishlaObyekt(ob){
  if(typeof _progSet==='function') _progSet(ob.obyekt,'START','Ish boshlandi');
  var _t0=Date.now(), _tLog=function(s){ Logger.log('⏱ '+ob.obyekt+' '+s+': '+((Date.now()-_t0)/1000).toFixed(1)+'s'); };

  // ═══════ BOSQICHLI ARXITEKTURA ═══════
  // Katta obyektlar 6 daqiqaga sig'masligi mumkin. Shuning uchun ish
  // VARAQ-DARAJADA bo'linadi: har varaq alohida trigger (yangi 6 daqiqa).
  // ScriptProperties da QAYSI VARAQDA TURGANINI saqlaymiz.
  var sp = PropertiesService.getScriptProperties();
  var stateKey = '_ISHLA_' + ob.obyekt;
  var state = {};
  try { state = JSON.parse(sp.getProperty(stateKey) || '{}'); } catch(e) {}

  var a   = sozAsosiy();
  var kat = sozKategoriya();
  var faktMap = sozFaktNarx();
  if(!ob.lokFiles || !ob.lokFiles.length) throw 'локалка топилмади ('+ob.obyekt+')';
  if(!ob.svodFile) throw 'свод топилмади ('+ob.obyekt+')';

  var fmt = _normFormat(ob.format || 'TN');
  var svodCfg = _svodCfg(ob);
  if(typeof _progSet==='function') _progSet(ob.obyekt,'OPEN','Fayllar ochilmoqda: format='+fmt);

  var lokSSArray = [];
  for(var lf=0; lf<ob.lokFiles.length; lf++){
    lokSSArray.push(_openAsSheet(ob.lokFiles[lf], ob.folderId));
  }
  _tLog('lokFiles ochildi (' + lokSSArray.length + ' ta)');
  var svodSS = _openAsSheet(ob.svodFile, ob.folderId); _tLog('svodSS ochildi');
  var savedOraliq = _oraliqlarOl(ob.obyekt);
  var pdb  = _priceDB(svodSS, kat, svodCfg, fmt, ob.svodSheets||[], savedOraliq); _tLog('priceDB tayyor ('+pdb.n+')');
  pdb.stavka = _stavkaOl(ob.obyekt);
  var nkMap = _narxlarKatMap();
  var plus = _plusFile(ob.obyekt, ob.folderId); _tLog('plusFile tayyor');
  if(typeof _progSet==='function') _progSet(ob.obyekt,'PRICE_DB','Narx bazasi tayyor: '+pdb.n+' pozitsiya');

  var fmtLog = [[ob.obyekt, '—', '—', 'ФОРМАТ', 'обюект формати: '+fmt+', свод устунлари: '+
    JSON.stringify(svodCfg)+', нарх базаси: '+pdb.n, '—', '—', '—']];

  var sheets = [];
  for(var i=0; i<lokSSArray.length; i++){
    var sArr = lokSSArray[i].getSheets();
    for(var j=0; j<sArr.length; j++) sheets.push(sArr[j]);
  }
  // Ishlanadigan varaqlar ro'yxatini quramiz
  var varaqlar = [];
  for(var s=0;s<sheets.length;s++){
    var src=sheets[s], snm=src.getName();
    if(_skip(snm)) continue;
    if(ob.lokSheets && ob.lokSheets.length > 0){
      if(ob.lokSheets.indexOf(snm)<0) continue;
    } else {
      if(!/(ЛРВ|LRV)/i.test(snm)) continue;
    }
    if(src.getLastRow()<2) continue;
    varaqlar.push({idx:s, nom:snm});
  }

  // DAVOM: oldin qaysi varaqlarga yetgan bo'lsa — o'tkazib yuboramiz
  var bajarilgan = state.bajarilgan || 0;
  var totalQ=state.totalQ||0, topilmadi=state.topilmadi||0, ochirilgan=state.ochirilgan||0;
  
  if (bajarilgan === 0) {
    var logSh = plus.getSheetByName(CFG.NARX_LOG);
    if (logSh) plus.deleteSheet(logSh);
    if (fmtLog && fmtLog.length) _narxLog(plus, fmtLog);
  }
  
  // DEADLINE: setup vaqtini hisobdan chiqaramiz — har varaq uchun to'liq vaqt qolsin
  var _setupDone = Date.now();
  var DEADLINE_MS = 4.5 * 60 * 1000;  // 4.5 daqiqa — xavfsiz chekka (umumiy)

  if (_setupDone - _t0 > 60 * 1000 && varaqlar.length > 0 && bajarilgan === 0) {
    state.bajarilgan = 0;
    sp.setProperty(stateKey, JSON.stringify(state));
    _tLog('Konvertatsiya sababli varaqlar keyingi triggerga qoldirildi');
    if(typeof _progSet==='function') _progSet(ob.obyekt,'PARTIAL','Konvertatsiya qilindi, varaqlar endi boshlanadi...');
    return {qator:totalQ, varaq:0, topilmadi:topilmadi, ochirilgan:ochirilgan,
            narxBaza:pdb.n, plusId:plus.getId(), partial:true};
  }

  // Bitta varaq uchun MAX vaqt: qolgan vaqtning HAMMASI (setup allaqachon o'tgan)
  _tLog('SETUP tugadi, varaqlar: '+varaqlar.length+', bajarilgan: '+bajarilgan+', setup: '+((Date.now()-_t0)/1000).toFixed(1)+'s');

  for(var vi=bajarilgan; vi<varaqlar.length; vi++){
    // VAQT TEKSHIRISH: umumiy 4.5 daqiqadan oshsa VA kamida 1 varaq tayyor bo'lsa — keyingi trigger
    if(Date.now()-_t0 > DEADLINE_MS && vi > bajarilgan){
      state.bajarilgan = vi;
      state.totalQ = totalQ;
      state.topilmadi = topilmadi;
      state.ochirilgan = ochirilgan;
      sp.setProperty(stateKey, JSON.stringify(state));
      _tLog('DEADLINE — varaq '+vi+'/'+varaqlar.length+' da to\'xtatildi, davom etish uchun keyingi trigger');
      if(typeof _progSet==='function') _progSet(ob.obyekt,'PARTIAL','Varaq '+(vi)+'/'+varaqlar.length+' tayyor, davom etadi...');
      return {qator:totalQ, varaq:vi, topilmadi:topilmadi, ochirilgan:ochirilgan,
              narxBaza:pdb.n, plusId:plus.getId(), partial:true};
    }
    // Agar bitta varaq boshlanishidan oldin 5 daqiqa o'tgan bo'lsa VA hech varaq qilinmagan —
    // bu "juda katta" holat, fayllar ochish o'zi 5 min yegan. Xato bilan qaytaramiz (3 urinish)
    if(vi===bajarilgan && vi>0 && Date.now()-_t0 > 5*60*1000){
      _tLog('OGOHISH: setup 5+ min oldi, varaqga ulgurmadi');
    }

    var src=sheets[varaqlar[vi].idx], snm=varaqlar[vi].nom;
    var varaqN = vi + 1;
    if(typeof _progSet==='function') _progSet(ob.obyekt,'SHEET','Varaq '+varaqN+'/'+varaqlar.length+': '+snm);
    var outName = (varaqN===1) ? CFG.LRV_SHEET : (CFG.LRV_SHEET+'_'+varaqN);
    var res = _ishlaVaraq(src, plus, outName, ob.obyekt, snm, pdb, kat, a, fmt, faktMap, nkMap);
    _tLog('varaq '+varaqN+' ('+snm+') tayyor: '+res.n+' qator');
    totalQ += res.n; topilmadi += res.topilmadi; ochirilgan += res.ochirilgan;
    if (res.log && res.log.length > 0) {
      _narxLog(plus, res.log);
    }
  }

  // BARCHA VARAQLAR TAYYOR
  sp.deleteProperty(stateKey);  // holat tozalanadi

  _ochirBoshVaraq(plus);

  for(var i=0; i<lokSSArray.length; i++){ _cleanupTmp(lokSSArray[i]); }
  _cleanupTmp(svodSS); _tLog('tmp tozalandi');

  SpreadsheetApp.flush(); _tLog('flush tayyor — YAKUNLANDI');
  if(typeof _holatInvalidate==='function'){ try{ _holatInvalidate(ob.obyekt); }catch(e){} }
  if(typeof _progSet==='function') _progSet(ob.obyekt,'DONE','Tayyor');
  return {qator:totalQ, varaq:varaqlar.length, topilmadi:topilmadi, ochirilgan:ochirilgan,
          narxBaza:pdb.n, plusId:plus.getId()};
}


/* ════════════ KO'P-LRV: BITTA QISM (FAYL) NI ALOHIDA ISHLASH ════════════
 * Faqat ob.lokFiles[partIndex] faylini ochadi — boshqa qismlarga TEGMAYDI.
 * Har qism o'z trigger-ijrosida (yangi 6 daqiqa) → katta obyekt ham tugaydi.
 * Tab nomlari GLOBAL tartibda (LRV, LRV_2, LRV_3...) — _PARTCNT_<ob> da har
 * qism varaq soni saqlanadi → keyingi qism to'g'ri raqamdan davom etadi.
 * DASHBOARD/server/mirror EMAS — u _birlashtir da (oxirgi qismdan keyin).
 * Resume: katta qism 4.5 daqiqada to'xtaydi → _ISHLA_<ob>_P<idx> → davom. */
function _ishlaQism(ob, partIndex){
  var sp=PropertiesService.getScriptProperties();
  if(!ob.lokFiles || !ob.lokFiles[partIndex]) throw 'qism fayli topilmadi: '+partIndex;
  if(!ob.svodFile) throw 'свод топилмади ('+ob.obyekt+')';
  var _t0=Date.now();
  if(typeof _progSet==='function') _progSet(ob.obyekt,'QISM','Қисм '+(partIndex+1)+'/'+ob.lokFiles.length+' ишланмоқда');

  var stateKey='_ISHLA_'+ob.obyekt+'_P'+partIndex;
  var state={}; try{ state=JSON.parse(sp.getProperty(stateKey)||'{}'); }catch(e){}

  // Tab raqamlash bazasi: oldingi qismlar varaq soni yig'indisi
  var cntKey='_PARTCNT_'+ob.obyekt, counts={};
  try{ counts=JSON.parse(sp.getProperty(cntKey)||'{}'); }catch(e){}
  var tabBase=0; for(var p=0;p<partIndex;p++) tabBase += (Number(counts[p])||0);

  var a=sozAsosiy(), kat=sozKategoriya(), faktMap=sozFaktNarx();
  var fmt=_normFormat(ob.format||'TN'), svodCfg=_svodCfg(ob);
  var lokSS=_openAsSheet(ob.lokFiles[partIndex], ob.folderId);
  var svodSS=_openAsSheet(ob.svodFile, ob.folderId);
  var savedOraliq=_oraliqlarOl(ob.obyekt);
  var pdb=_priceDB(svodSS, kat, svodCfg, fmt, ob.svodSheets||[], savedOraliq);
  pdb.stavka=_stavkaOl(ob.obyekt);
  var nkMap=_narxlarKatMap();
  var plus=_plusFile(ob.obyekt, ob.folderId);

  // Ishlanadigan varaqlar (faqat shu qism fayli)
  var sheets=lokSS.getSheets(), varaqlar=[];
  for(var s=0;s<sheets.length;s++){
    var snm=sheets[s].getName();
    if(_skip(snm)) continue;
    if(ob.lokSheets && ob.lokSheets.length>0){ if(ob.lokSheets.indexOf(snm)<0) continue; }
    else if(!/(ЛРВ|LRV)/i.test(snm)) continue;
    if(sheets[s].getLastRow()<2) continue;
    varaqlar.push({idx:s, nom:snm});
  }

  // NARX_LOG: faqat birinchi qism boshida tozalanadi
  if(partIndex===0 && (state.bajarilgan||0)===0){
    var logSh=plus.getSheetByName(CFG.NARX_LOG); if(logSh){ try{plus.deleteSheet(logSh);}catch(e){} }
  }

  var bajarilgan=state.bajarilgan||0, totalQ=state.totalQ||0, topilmadi=state.topilmadi||0, ochirilgan=state.ochirilgan||0;
  var DEADLINE_MS=4.5*60*1000;

  for(var vi=bajarilgan; vi<varaqlar.length; vi++){
    if(Date.now()-_t0>DEADLINE_MS && vi>bajarilgan){
      state.bajarilgan=vi; state.totalQ=totalQ; state.topilmadi=topilmadi; state.ochirilgan=ochirilgan;
      sp.setProperty(stateKey, JSON.stringify(state));
      _cleanupTmp(lokSS); _cleanupTmp(svodSS);
      if(typeof _progSet==='function') _progSet(ob.obyekt,'PARTIAL','Қисм '+(partIndex+1)+' варақ '+vi+'/'+varaqlar.length+' — давом этади');
      return {partial:true, qism:partIndex, qator:totalQ};
    }
    var globalIdx=tabBase+vi;
    var outName=(globalIdx===0) ? CFG.LRV_SHEET : (CFG.LRV_SHEET+'_'+(globalIdx+1));
    var src=sheets[varaqlar[vi].idx], snm=varaqlar[vi].nom;
    if(typeof _progSet==='function') _progSet(ob.obyekt,'SHEET','Қисм '+(partIndex+1)+' · варақ '+(vi+1)+'/'+varaqlar.length+': '+snm);
    var res=_ishlaVaraq(src, plus, outName, ob.obyekt, snm, pdb, kat, a, fmt, faktMap, nkMap);
    totalQ+=res.n; topilmadi+=res.topilmadi; ochirilgan+=res.ochirilgan;
    if(res.log && res.log.length) _narxLog(plus, res.log);
  }

  // Qism tugadi — varaq sonini saqlaymiz (keyingi qism bazasi uchun)
  counts[partIndex]=varaqlar.length;
  sp.setProperty(cntKey, JSON.stringify(counts));
  sp.deleteProperty(stateKey);
  _cleanupTmp(lokSS); _cleanupTmp(svodSS);
  SpreadsheetApp.flush();
  if(typeof _progSet==='function') _progSet(ob.obyekt,'QISM_DONE','Қисм '+(partIndex+1)+' тайёр');
  return {partial:false, qism:partIndex, qator:totalQ};
}


/* ════════════ KO'P-LRV: QISMLARNI BITTA HUJJATGA BIRLASHTIRISH ════════════
 * Barcha qism tugagach (navbatда oxirgi @@COMBINE): ortiqcha eski LRV tablarni
 * tozalaydi (2x oldini oladi), resurs/ish turi yig'adi, server+dashboard+mirror
 * yangilaydi → bitta to'g'ri, ideal hujjat. */
function _birlashtir(ob){
  if(typeof _progSet==='function') _progSet(ob.obyekt,'COMBINE','Қисмлар бирлаштирилмоқда');
  var sp=PropertiesService.getScriptProperties();
  var a=sozAsosiy();
  var plus=_plusFile(ob.obyekt, ob.folderId);

  var counts={}; try{ counts=JSON.parse(sp.getProperty('_PARTCNT_'+ob.obyekt)||'{}'); }catch(e){}
  var total=0; for(var k in counts) total+=(Number(counts[k])||0);
  var expected=(ob.lokFiles && ob.lokFiles.length)||0;
  var haveAll = expected>0 && Object.keys(counts).length>=expected;

  // Ortiqcha (eski tuzilmadan qolган) LRV* tablarni o'chiramiz — faqat barcha qism
  // tugaган bo'lsa (haveAll), aks holda valid tabni adashtirib o'chirmaslik uchun.
  if(haveAll && total>0){
    var yaroqli={}; yaroqli[CFG.LRV_SHEET]=true;
    for(var i=2;i<=total;i++) yaroqli[CFG.LRV_SHEET+'_'+i]=true;
    var shs=plus.getSheets();
    for(var s=0;s<shs.length;s++){
      var nm=shs[s].getName();
      if(nm.indexOf(CFG.LRV_SHEET)===0 && nm.indexOf('_BAK_')!==0 && !yaroqli[nm]){
        try{ plus.deleteSheet(shs[s]); }catch(e){}
      }
    }
  }

  try{ _ochirBoshVaraq(plus); }catch(e){}
  try{ _resurslarYig(plus); }catch(e){}
  try{ _ishTurlarYig(plus, ob.obyekt, _normFormat(ob.format||'TN')); }catch(e){}
  try{ serverYozFile(ob.obyekt, plus, a); }catch(e){}
  SpreadsheetApp.flush();

  sp.deleteProperty('_PARTCNT_'+ob.obyekt);
  if(typeof _holatInvalidate==='function'){ try{ _holatInvalidate(ob.obyekt); }catch(e){} }
  if(typeof supabaseObyektPush==='function'){ try{ supabaseObyektPush(ob.obyekt); }catch(e){} }
  if(typeof _progSet==='function') _progSet(ob.obyekt,'DONE','Бирлаштирилди ('+total+' варақ)');
  return {ok:true, birlashtirildi:true, varaq:total};
}


/* ============ LOCK HOLATIDA: faqat + qatorlar ============ */
// Mavjud LRV_PLUS fayldagi "+" markerli qatorlar narx/formulasini qaytadan yozadi.
// Asl smeta qatorlari (rz/bl/rs/mat) UMUMAN tegmaydi.
function _qoshFaqatIshla(ob){
  var a=sozAsosiy(), kat=sozKategoriya(), faktMap=sozFaktNarx();
  var nkMap=_narxlarKatMap();
  var fmt=_normFormat(ob.format||'TN'), svodCfg=_svodCfg(ob);

  // mavjud LRV_PLUS fayl topiladi (yangi yaratilmaydi!)
  var folder=DriveApp.getFolderById(ob.folderId);
  var fit=folder.getFilesByName(ob.obyekt+CFG.PLUS_SUF);
  if(!fit.hasNext()) throw 'LRV_PLUS файл йўқ. Аввал қулфни очиб, оддий «Ишла» қилинг.';
  var plus=SpreadsheetApp.openById(fit.next().getId());

  // narx bazasi (svoddan)
  var svodSS=_openAsSheet(ob.svodFile, ob.folderId);
  var savedOraliq=_oraliqlarOl(ob.obyekt);
  var pdb=_priceDB(svodSS, kat, svodCfg, fmt, ob.svodSheets||[], savedOraliq);
  pdb.stavka = _stavkaOl(ob.obyekt);   // har obyekt fiksirlangan ЧЕЛ-Ч/МАШ-Ч narxi

  // har LRV varaq da: + qatorlarni topib, narx/formula yangilash
  var sheets=plus.getSheets(), totalQ=0;
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    totalQ += _faqatPlusYangila(sh, pdb, kat, a, ob.obyekt, nm, faktMap, nkMap);
  }
  _cleanupTmp(svodSS);
  SpreadsheetApp.flush();
  if(typeof _holatInvalidate==='function'){ try{ _holatInvalidate(ob.obyekt); }catch(e){} }
  return {qosh:totalQ};
}
function _faqatPlusYangila(sh, pdb, kat, a, obyekt, konstr, faktMap, nkMap){
  var col=CFG.C, CL=_cl;
  var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh);
  if(last<start) return 0;
  var n=last-start+1;
  var v=sh.getRange(start,1,n,col.MARKER).getValues();
  // 1) Narx topish va massivga yig'ish (API chaqiruvlarsiz)
  var blRow=0, yang=0, updates=[];
  for(var i=0;i<n;i++){
    var r=start+i;
    var mkRaw=String(v[i][col.MARKER-1]||'').trim().toLowerCase();
    var isQosh=/\+$/.test(mkRaw), base=mkRaw.replace(/\+$/,'');
    if(base==='bl'&&!isQosh) blRow=r;
    else if(base==='bl'&&isQosh){ blRow=r; yang++; }
    if(!isQosh) continue;
    if(base==='rs'||(base === 'mat' || base === 'ob') ){
      var nom=String(v[i][col.NOM-1]||''),bir=String(v[i][col.BIRLIK-1]||''),kod=_kodOl(v[i][col.KOD-1]);
      var p=_findPrice(nom,bir,kod,pdb,kat,faktMap,a,nkMap);
      updates.push({i:i,r:r,base:base,blRow:blRow,p:p,nom:nom});
      yang++;
    }
  }
  if(!updates.length) return yang;
  // 2) BATCH: kerakli ustunlarni o'qib, o'zgartirib, yozish
  var colsToUpdate=[col.NARX,col.F,col.SMETA,col.CHEL,col.MASH,col.MAT,col.OB,col.BEZSKLAD,col.MK,col.KAB];
  var ranges={};
  colsToUpdate.forEach(function(c){ ranges[c]={f:sh.getRange(start,c,n,1).getFormulas(),v:sh.getRange(start,c,n,1).getValues()}; });
  function setCell(c,idx,val){ ranges[c].v[idx][0]=val; ranges[c].f[idx][0]=''; }
  function setForm(c,idx,fm){ ranges[c].f[idx][0]=fm; }
  for(var u=0;u<updates.length;u++){
    var up=updates[u], idx=up.i, r=up.r, base=up.base, p=up.p;
    var useE=((base === 'mat' || base === 'ob') )||(base==='rs'&&!up.blRow);
    var volCol=useE?col.E:col.F;
    setCell(col.NARX,idx,p.narx);
    if(base==='rs'&&up.blRow) setForm(col.F,idx,'='+CL(col.E)+'$'+up.blRow+'*'+CL(col.E)+r);
    else setForm(col.F,idx,'='+CL(col.E)+r);
    setForm(col.SMETA,idx,'=$'+CL(volCol)+r+'*$'+CL(col.NARX)+r);
    [col.CHEL,col.MASH,col.MAT,col.OB,col.BEZSKLAD,col.MK,col.KAB].forEach(function(c){ setCell(c,idx,''); });
    var cat=(p.cat||'МАТ').toUpperCase(),mainC=(cat==='КАБ'||cat==='КАБЕЛ')?'МАТ':cat;
    var ref='=$'+CL(col.SMETA)+r;
    if(mainC==='ЧЕЛ') setForm(col.CHEL,idx,ref);
    else if(mainC==='МАШ') setForm(col.MASH,idx,ref);
    else if(mainC==='ОБ'||mainC==='ОБОР'||mainC==='ОБОРУД') setForm(col.OB,idx,ref);
    else if(mainC==='МК'||mainC==='М/К') setForm(col.MK,idx,ref);
    else setForm(col.MAT,idx,ref);
    var nu=_norm(up.nom);
    if(_hasKw(nu,kat.kw.KAB||[])) setForm(col.KAB,idx,ref);
    if(_hasKw(nu,kat.kw.BEZSKLAD||[])) setForm(col.BEZSKLAD,idx,ref);
  }
  // 3) Yozish: har ustun BIR marta
  colsToUpdate.forEach(function(c){
    var out=[]; for(var i=0;i<n;i++) out.push([ranges[c].f[i][0]||ranges[c].v[i][0]]);
    sh.getRange(start,c,n,1).setValues(out);
  });
  return yang;
}


/* ============ BIR VARAQNI ISHLASH (full) ============ */
function _ishlaVaraq(src, plusSS, outName, obyekt, konstr, pdb, kat, a, fmt, faktMap, nkMap){
  var _vt0=Date.now(), _vt=function(s){ Logger.log('  ⏱ varaq '+outName+' '+s+': '+((Date.now()-_vt0)/1000).toFixed(1)+'s'); };
  fmt = _normFormat(fmt || 'TN');

  // ⚠️ TRANZAKSIYA HIMOYASI: eski varaq O'CHIRILMAYDI — '_BAK_' nomiga ko'chiriladi.
  // Agar ijro o'rtada o'lsa (6 min timeout), FAKT/F2 ma'lumot _BAK_ da TO'LIQ saqlanadi;
  // keyingi run _BAK_ dan o'qib tiklaydi. Muvaffaqiyatli tugagachgina _BAK_ o'chiriladi.
  var bakName='_BAK_'+outName;
  var bak=plusSS.getSheetByName(bakName);
  var cur=plusSS.getSheetByName(outName);
  var manba = bak || cur;   // bak bor = oldingi run yarim qolgan → to'liq eski ma'lumot bak da
  var qoshSaved  = _qoshSaqla(manba); _vt('qoshSaqla');
  var faktSaved  = _faktSaqla(manba); _vt('faktSaqla');
  var qavatSaved = _qavatSaqla(manba);
  function bakTugadi(){ try{ var b=plusSS.getSheetByName(bakName); if(b) plusSS.deleteSheet(b); }catch(e){} }

  if(bak){ if(cur) plusSS.deleteSheet(cur); }
  else if(cur){ cur.setName(bakName); try{ cur.hideSheet(); }catch(e){} }
  var dst = src.copyTo(plusSS).setName(outName); _vt('copyTo');

  var ochirilgan = _boshQatorlarOchir(dst); _vt('boshQatorlarOchir ('+ochirilgan+')');

  var last=dst.getLastRow();
  var startOld = a.dataQator>0 ? a.dataQator : _autoData(dst);
  if(last-startOld+1<1){ bakTugadi(); return {n:0, topilmadi:0, ochirilgan:ochirilgan, log:[]}; }

  // 2 ta qator qo'shamiz: 1-si SARLAVHA (har doim ko'rinadi), 2-si ЖАМИ
  dst.insertRowsBefore(startOld, 2);
  var jamiRow = startOld + 1;        // ЖАМИ
  var start   = startOld + 2;        // ma'lumot boshlanishi
  last        = dst.getLastRow();
  var n       = last-start+1;
  if(n<1){ bakTugadi(); return {n:0, topilmadi:0, ochirilgan:ochirilgan, log:[]}; }

  var data = dst.getRange(start,1,n,9).getValues();
  var mm   = _mergedMap(dst, start, n);
  var col=CFG.C, CL=_cl;
  var mefRows = (fmt==='ABC4') ? {} : mm.mmEf;

  var info=[], rzRow=0, rzNom='', blRow=0, blNom='', rzIdx=-1, log=[], topilmadi=0;
  for(var i=0;i<n;i++){
    var r=start+i, A=data[i][0], B=data[i][1], C=data[i][2], D=data[i][3];
    var existRaw=String(data[i][8]||'').trim().toLowerCase();
    var exist=existRaw.replace(/\+$/,'');
    var nextA=(i+1<n)?data[i+1][0]:'';
    var nextC=(i+1<n)?data[i+1][2]:'';
    var tur=(['rz','bl','rs','mat','ob'].indexOf(exist)>=0)?exist:_classify(r,mm,A,C,nextA,nextC,fmt);

    var nom = _nomOl(tur, A, B, C);
    var bir = String(D||'').trim();

    var it={row:r,tur:tur,nom:nom,birlik:bir,narx:0,cat:'',blRow:0,rzRow:0,rzIdx:rzIdx,
            rzNom:rzNom,blNom:blNom,c1:0,c2:0, mef:!!mefRows[r]};

    if(tur==='rz'){ rzIdx++; it.rzIdx=rzIdx; rzRow=r; rzNom=nom; it.rzRow=r; it.rzNom=nom; blRow=0; blNom=''; }
    else if(tur==='bl'){ blRow=r; blNom=nom; it.blNom=blNom; it.rzNom=rzNom; it.rzRow=rzRow; }
    else if(tur==='rs'){
      it.blRow=blRow; it.blNom=blNom; it.rzNom=rzNom; it.rzRow=rzRow;
      var kod=_kodOl(B);
      var pNarx = _toNum(data[i][col.NARX-1]);
      var pSum  = _toNum(data[i][col.SMETA-1]);
      if(pNarx > 0 && pSum > 0){
        it.narx=pNarx;
        it.cat=_refine(_norm(nom),'МАТ',kat);
        var birCat=_catBirlik(_normBirlik(bir),'',kat);
        if(birCat==='ЧЕЛ'||birCat==='МАШ') it.cat=birCat;
        var key=_normNomKey(nom)+'||'+_normBirlik(bir);
        var reg=(nkMap && nkMap[key]) ? nkMap[key] : null;
        if(reg && reg.kat){
          if(reg.bel>0) it.cat=reg.kat;
          else if(it.cat==='МАТ' && reg.kat!=='МАТ') it.cat=reg.kat;
        }
      } else {
        var p=_findPrice(nom,bir,kod,pdb,kat,faktMap,a,nkMap); it.narx=p.narx; it.cat=p.cat;
        if(p.debug.method==='MISS'){ log.push([obyekt,outName,r,'rs',nom,bir,kod,p.debug.detail]); topilmadi++; }
        else if(p.debug.warn){ log.push([obyekt,outName,r,'⚠ ДОНА×QTY',nom,bir,kod,'дона×qty≠сумма — устун хато бўлиши мумкин']); }
      }
    } else if((tur === 'mat' || tur === 'ob') ){
      it.rzNom=rzNom; it.rzRow=rzRow;
      var kodm=_kodOl(B);
      var pNarx = _toNum(data[i][col.NARX-1]);
      var pSum  = _toNum(data[i][col.SMETA-1]);
      if(pNarx > 0 && pSum > 0){
        it.narx=pNarx;
        it.cat=_refine(_norm(nom),'МАТ',kat);
        var birCat=_catBirlik(_normBirlik(bir),'',kat);
        if(birCat==='ЧЕЛ'||birCat==='МАШ') it.cat=birCat;
        var key=_normNomKey(nom)+'||'+_normBirlik(bir);
        var reg=(nkMap && nkMap[key]) ? nkMap[key] : null;
        if(reg && reg.kat){
          if(reg.bel>0) it.cat=reg.kat;
          else if(it.cat==='МАТ' && reg.kat!=='МАТ') it.cat=reg.kat;
        }
      } else {
        var pm=_findPrice(nom,bir,kodm,pdb,kat,faktMap,a,nkMap); it.narx=pm.narx; it.cat=pm.cat;
        if(pm.debug.method==='MISS'){ log.push([obyekt,outName,r,'mat',nom,bir,kodm,pm.debug.detail]); topilmadi++; }
        else if(pm.debug.warn){ log.push([obyekt,outName,r,'⚠ ДОНА×QTY',nom,bir,kodm,'дона×qty≠сумма — устун хато бўлиши мумкин']); }
      }
      
      // Standalone mat/ob qatori uchun qat'iy tekshiruv:
      // Agar RES_GS dan 'ОБ' (Оборудование) deb topilgan bo'lsa, markerni aniq ob ga o'zgartiramiz
      if (it.cat === 'ОБ') {
        tur = 'ob';
        it.tur = 'ob';
      }
    }
    info.push(it);
  }

  for(var i=0;i<n;i++){
    if(info[i].tur==='bl'){
      var j=i+1; while(j<n && (info[j].tur==='rs'||(info[j].tur === 'mat' || info[j].tur === 'ob') )) j++;
      if(j>i+1){ info[i].c1=info[i+1].row; info[i].c2=info[j-1].row; }
    } else if(info[i].tur==='rz'){
      var k=i+1; while(k<n && info[k].tur!=='rz') k++;
      if(k>i+1){ info[i].c1=info[i+1].row; info[i].c2=info[k-1].row; }
    }
  }

  var Eout=[], Fout=[], blkGT=[], blkUY=[], blkZAC=[];
  for(var i=0;i<n;i++){
    var it=info[i], r=it.row;
    Eout.push([_toNum(data[i][4])]);

    var rsNormal = (it.tur==='rs' && it.blRow && !it.mef);
    var useE = ((it.tur === 'mat' || it.tur === 'ob') ) || (it.tur==='rs' && (it.mef || !it.blRow));
    var volCol = useE ? col.E : col.F;

    if(rsNormal)               Fout.push(['='+CL(col.E)+'$'+it.blRow+'*'+CL(col.E)+r]);
    else if((it.tur === 'mat' || it.tur === 'ob') )    Fout.push(['='+CL(col.E)+r]);
    else if(it.tur==='rs')     Fout.push(['']);
    else                       Fout.push([_toNum(data[i][5])]);

    var G=(it.tur==='rs'||(it.tur === 'mat' || it.tur === 'ob') )?it.narx:'';
    var H='';
    if(it.tur==='rs'||(it.tur === 'mat' || it.tur === 'ob') ) H='=$'+CL(volCol)+r+'*$'+CL(col.NARX)+r;
    else if(it.tur==='bl') H=(it.c1?'=SUM($'+CL(col.SMETA)+it.c1+':$'+CL(col.SMETA)+it.c2+')':0);
    else if(it.tur==='rz') H=(it.c1?_sumif2col(it,col.SMETA):0);
    var I=it.tur;

    var J='',K='',L='',M='',N='',O='',P='';
    if(it.tur==='rs'||(it.tur === 'mat' || it.tur === 'ob') ){
      // FAQAT 4 kategoriya: ЧЕЛ(J) МАШ(K) ОБ(M) МАТ(L). Qolgan ustunlar (N=БЕЗ СКЛАД,
      // O=М/К, P=КАБ) TEGILMAYDI — user qo'lda to'ldiradi (avto-bo'lish chalkashtirardi).
      var cat=(it.cat||'МАТ').toUpperCase();
      var ref='=$'+CL(col.SMETA)+r;
      if(cat==='ЧЕЛ') J=ref;
      else if(cat==='МАШ') K=ref;
      else if(cat==='ОБ'||cat==='ОБОР'||cat==='ОБОРУД') M=ref;
      else L=ref;   // МАТ (М/К, КАБ va qolganlar ham МАТ — user keyin ajratadi)
    }

    var Q='',R='',S='',T='';
    if(it.tur==='bl'){
      Q=0; R='=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r;
      S=_f2sum(r,0);   // F2OL (hajm) = Σ ОБЪЁМ ustunlari
      T='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
    } else if((it.tur === 'mat' || it.tur === 'ob') ){
      Q=0; R='=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r;
      S=_f2sum(r,0);   // F2OL (hajm) = Σ ОБЪЁМ ustunlari
      T='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
    } else if(it.tur==='rs'){
      if(rsNormal) Q='='+CL(col.FAKT)+'$'+it.blRow+'*'+CL(col.E)+r;
      else         Q=0;
      R='=$'+CL(volCol)+r+'-$'+CL(col.FAKT)+r;
      S=_f2sum(r,0);   // F2OL (hajm) = Σ ОБЪЁМ ustunlari
      T='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
    }

    blkGT.push([G,H,I,J,K,L,M,N,O,P,Q,R,S,T]);

    var qv = (qavatSaved && it.rzIdx>=0 && qavatSaved[it.rzIdx]) ? qavatSaved[it.rzIdx] : ['','',''];
    var xVid = (it.tur==='bl') ? it.nom : (it.blNom || '');
    var yRaz = (it.tur==='rz') ? it.nom : (it.rzNom || '');
    blkUY.push([qv[0], qv[1], qv[2], xVid, yRaz]);

    if(it.tur==='rs'||(it.tur === 'mat' || it.tur === 'ob') ){
      blkZAC.push([
        '=$'+CL(col.SMETA)+r,                          // ST_RES  = smeta summa
        '=$'+CL(col.FAKT)+r+'*$'+CL(col.NARX)+r,        // ST_FAKT = FAKT × smeta narx
        _f2sum(r,2),                                   // ST_F2   = Σ СУММА (fakticheskiy F2 narxida!)
        '=$'+CL(col.F2MUM)+r+'*$'+CL(col.NARX)+r        // ST_OST  = qoldiq × smeta narx
      ]);
    } else if(it.tur==='rz' && it.c1){
      // RZ darajada qolgan ish qiymati = rs+mat leaf'lardan ST_OST yig'indisi
      blkZAC.push(['','',(it.c1?_sumifLeaf(it,col.ST_F2):''),(it.c1?_sumifLeaf(it,col.ST_OST):'')]);
    } else {
      blkZAC.push(['','','','']);
    }
  }

  _vt('info loop tayyor ('+n+' qator)');
  dst.getRange(start,col.E,n,1).setValues(Eout);
  dst.getRange(start,col.F,n,1).setValues(Fout);
  dst.getRange(start,col.NARX,n,14).setValues(blkGT);
  dst.getRange(start,col.QAVAT1,n,5).setValues(blkUY);
  dst.getRange(start,col.ST_RES,n,4).setValues(blkZAC);
  _vt('setValues 5x');

  _sarlavhaYoz(dst, jamiRow);
  _jamiQator(dst, jamiRow, start, last);
  dst.getRange(startOld, col.NARX, last - startOld + 1, 2)
     .setBorder(true, true, true, true, true, true, '#b7b7b7', SpreadsheetApp.BorderStyle.SOLID);
  dst.getRange(start,col.NARX,n,col.ST_OST-col.NARX+1).setNumberFormat('#,##0');
  dst.hideColumns(CFG.HIDE_FROM, CFG.HIDE_TO-CFG.HIDE_FROM+1);
  _ranglaQatorlar(dst, info, start, n);
  _vt('format+rang');

  if(faktSaved && faktSaved.oylarNomlar && faktSaved.oylarNomlar.length){
    _oyKollarTikla(dst, faktSaved.oylarNomlar, jamiRow, start, n);
  }
  _vt('oyKollarTikla');
  if(faktSaved) _faktQayta(dst, start, n, faktSaved);
  _vt('faktQayta');

  if(qoshSaved){
    var qAdded = _qoshQayta(dst, qoshSaved, pdb, kat, a, obyekt, konstr, faktMap, nkMap);
    if(qAdded>0){
      _jamiQator(dst, jamiRow, start, dst.getLastRow());
      if(faktSaved && faktSaved.oylarNomlar && faktSaved.oylarNomlar.length){
        _oyFormulaToldur(dst, start, dst.getLastRow());
      }
    }
  }
  _vt('qoshQayta');

  bakTugadi();
  _vt('VARAQ TAYYOR');
  return {n:n, topilmadi:topilmadi, ochirilgan:ochirilgan, log:log};
}


/* ============ F2 OYLIK 3-USTUNLI TIZIM (ОБЪЁМ | НАРХ | СУММА) ============
 * Har F2 oyi LRV da 3 ketma-ket ustun (F2_BIRINCHI=AE dan):
 *   offset 0 = ОБЪЁМ (hajm)   1 = НАРХ (fakticheskiy)   2 = СУММА (=obyom×narx)
 * Sarlavha: ОБЪЁМ=oy nomi, НАРХ=oy+' ₊нарх', СУММА=oy+' ₊сумма'.
 * Yig'indilar SUMPRODUCT(MOD) bilan — oy qo'shilganda formula O'ZGARMAYDI (barqaror):
 *   F2OL (hajm) = Σ ОБЪЁМ ustunlari (offset 0); ST_F2 (pul) = Σ СУММА ustunlari (offset 2). */
var _F2_SUF_NARX  = ' ₊нарх';
var _F2_SUF_SUMMA = ' ₊сумма';
function _f2sum(r, offset){
  var first=CFG.C.F2_BIRINCHI, rng='$'+_cl(first)+r+':$ZZ'+r;
  return '=IFERROR(SUM(FILTER('+rng+', MOD(COLUMN('+rng+')-'+first+',3)='+offset+')),0)';
}


/* ============ OY USTUNLARINI TIKLASH ============
 * Lokalka dan qayta ko'chirilganda oy (F2) ustunlari yo'qoladi.
 * Bu funksiya sarlavha + formulalarni qaytadan yozadi (har oy 3 ustun).
 * Qiymatlar keyin _faktQayta tomonidan to'ldiriladi.
 ================================================== */
function _oyKollarTikla(dst, oyNomlar, hdrRow, start, n){
  if(!oyNomlar||!oyNomlar.length) return;
  var col=CFG.C, CL=_cl;

  // Mavjud oy ustunlarini aniqlab, keyingisini hisoblaymiz (har oy = 3 ustun)
  var existing={}, yangiCol=col.F2_BIRINCHI;
  var existOy=_f2Oylar(dst);
  for(var e=0;e<existOy.length;e++){
    existing[existOy[e].nom]=existOy[e].col;
    if(existOy[e].col+2>=yangiCol) yangiCol=existOy[e].col+3;  // 3 ustun band
  }

  for(var oi=0;oi<oyNomlar.length;oi++){
    var oyNom=oyNomlar[oi];
    if(existing[oyNom]) continue; // allaqachon bor

    var cO=yangiCol, cN=yangiCol+1, cS=yangiCol+2;  // ОБЪЁМ, НАРХ, СУММА
    // Sarlavhalar (ОБЪЁМ=oy nomi, НАРХ/СУММА suffix bilan) - bitta diapazonda tezkor yozamiz
    var headerRange = dst.getRange(hdrRow, cO, 1, 3);
    headerRange.setValues([[oyNom, oyNom+_F2_SUF_NARX, oyNom+_F2_SUF_SUMMA]]);
    headerRange.setFontWeight('bold');
    headerRange.setBackgrounds([['#1f4e79', '#2d4a63', '#1f4e79']]);
    headerRange.setFontColors([['#ffffff', '#cbd5e1', '#ffffff']]);
    headerRange.setWrap(true);

    // Formulalar: ОБЪЁМ (hajm), НАРХ (=G default), СУММА (=obyom×narx)
    var marker=dst.getRange(start,col.MARKER,n,1).getValues();
    var blRow=0, vO=[], vN=[], vS=[];
    for(var i=0;i<n;i++){
      var r=start+i, mk=String(marker[i][0]||'').trim().toLowerCase().replace(/\+$/,'');
      if(mk==='bl'){
        blRow=r;
        vO.push([0]); vN.push(['']); vS.push(['']);          // bl: obyom kiritiladi, narx/summa bo'sh
      } else if(mk==='rs' && blRow){
        vO.push(['='+CL(cO)+'$'+blRow+'*'+CL(col.E)+r]);     // obyom = bl_obyom × norma
        vN.push(['=$'+CL(col.NARX)+r]);                      // narx = G (default smeta narx)
        vS.push(['=$'+CL(cO)+r+'*$'+CL(cN)+r]);              // summa = obyom × narx
      } else if((mk === 'mat' || mk === 'ob') ){
        blRow=0;
        vO.push([0]); vN.push(['=$'+CL(col.NARX)+r]); vS.push(['=$'+CL(cO)+r+'*$'+CL(cN)+r]);
      } else {
        vO.push(['']); vN.push(['']); vS.push(['']);
      }
    }
    dst.getRange(start,cO,n,1).setValues(vO).setNumberFormat('#,##0.####');
    dst.getRange(start,cN,n,1).setValues(vN).setNumberFormat('#,##0');
    dst.getRange(start,cS,n,1).setValues(vS).setNumberFormat('#,##0');
    existing[oyNom]=cO;
    yangiCol+=3;
  }
}


/* ============ OY FORMULA TOLDIRISH ============
 * _qoshQayta dan keyin rs+ qatorlarga oy ustuni formulalari yozilmagan bo'ladi.
 * Bu funksiya mavjud oy ustunlari bo'yicha bo'sh/0 rs qatorlarga formula qo'shadi.
 ================================================== */
function _oyFormulaToldur(dst, start, last){
  var col=CFG.C, CL=_cl;
  var oyMap=_oyKolMap(dst);
  if(!Object.keys(oyMap).length) return;
  var n=last-start+1; if(n<1) return;
  var marker=dst.getRange(start,col.MARKER,n,1).getValues();

  var lastColActual = dst.getLastColumn();
  if(lastColActual < col.F2_BIRINCHI) return;
  var numCols = lastColActual - col.F2_BIRINCHI + 1;
  var allVals = dst.getRange(start, col.F2_BIRINCHI, n, numCols).getValues();
  var allForms = dst.getRange(start, col.F2_BIRINCHI, n, numCols).getFormulas();
  var changed = false;

  for(var oyNom in oyMap){
    var cO = oyMap[oyNom];
    var cN = cO + 1;
    var cS = cO + 2;

    var offO = cO - col.F2_BIRINCHI;
    var offN = cN - col.F2_BIRINCHI;
    var offS = cS - col.F2_BIRINCHI;

    var blRow=0;
    for(var i=0;i<n;i++){
      var r=start+i, mk=String(marker[i][0]||'').trim().toLowerCase().replace(/\+$/,'');
      if(mk==='bl'){
        blRow=r;
      } else if(mk==='rs' && blRow){
        var curF = allForms[i][offO];
        var curV = allVals[i][offO];
        var cur = curF || curV;
        if(!cur || cur===0){
          allForms[i][offO] = '=' + CL(cO) + '$' + blRow + '*' + CL(col.E) + r;
          allVals[i][offO] = '';
          allForms[i][offN] = '=$' + CL(col.NARX) + r;
          allVals[i][offN] = '';
          allForms[i][offS] = '=$' + CL(cO) + r + '*$' + CL(cN) + r;
          allVals[i][offS] = '';
          changed = true;
        }
      } else {
        if((mk === 'mat' || mk === 'ob') ) blRow=0;
      }
    }
  }

  if (changed) {
    var allOut = [];
    for (var r = 0; r < n; r++) {
      var row = [];
      for (var c = 0; c < numCols; c++) {
        row.push(allForms[r][c] !== "" ? allForms[r][c] : allVals[r][c]);
      }
      allOut.push(row);
    }
    dst.getRange(start, col.F2_BIRINCHI, n, numCols).setValues(allOut);
  }
}


/* ============ BO'SH QATORLAR O'CHIRISH ============ */
function _boshQatorlarOchir(sh){
  var last=sh.getLastRow(); if(last<1) return 0;
  var v=sh.getRange(1,1,last,6).getValues();
  var empty=[];
  for(var i=0;i<v.length;i++){
    var bor=false;
    for(var c=0;c<6;c++){ if(String(v[i][c]==null?'':v[i][c]).trim()!==''){ bor=true; break; } }
    if(!bor) empty.push(i+1);
  }
  if(!empty.length) return 0;

  // Guruhlangan oraliqlar (ranges) ni Sheets API uchun tayyorlaymiz
  var ranges=[], s=empty[0], p=empty[0];
  for(var i=1;i<empty.length;i++){
    if(empty[i]===p+1){ p=empty[i]; }
    else { ranges.push([s,p]); s=empty[i]; p=empty[i]; }
  }
  ranges.push([s,p]);

  try {
    var ssId = sh.getParent().getId();
    var sheetId = sh.getSheetId();
    var requests = [];
    
    // API uchun indexlar 0-based va teskari tartibda (yuqoridagilar siljimasligi uchun)
    for (var i = ranges.length - 1; i >= 0; i--) {
      requests.push({
        deleteDimension: {
          range: {
            sheetId: sheetId,
            dimension: "ROWS",
            startIndex: ranges[i][0] - 1,
            endIndex: ranges[i][1]
          }
        }
      });
    }
    
    if (requests.length > 0) {
      Sheets.Spreadsheets.batchUpdate({requests: requests}, ssId);
    }
  } catch(e) {
    // Zaxira usul: API ishlamasa klassik sekin usulda o'chirish
    for(var i=ranges.length-1;i>=0;i--) sh.deleteRows(ranges[i][0], ranges[i][1]-ranges[i][0]+1);
  }
  return empty.length;
}


/* ============ NOM / KOD o'qish ============ */
function _nomOl(tur, A, B, C){
  var sc=String(C||'').trim();
  if(tur==='rz'){
    if(sc) return sc;
    var sa=String(A||'').trim();
    if(sa && /[А-ЯЁA-Z]/i.test(sa)) return sa;
    var sb=String(B||'').trim();
    if(sb && /[А-ЯЁA-Z]/i.test(sb)) return sb;
    return sa || '';
  }
  return sc;
}
function _kodOl(B){
  return (B!==null && B!==undefined && B!=='') ? String(B).trim().toUpperCase() : '';
}


/* ============ QAVAT SAQLASH ============ */
function _qavatSaqla(sh){
  if(!sh) return null;
  var col=CFG.C, last=sh.getLastRow();
  var start=_autoData(sh); if(last<start) return null;
  var n=last-start+1;
  var mk=sh.getRange(start,col.MARKER,n,1).getValues();
  var qv=sh.getRange(start,col.QAVAT1,n,3).getValues();
  var arr=[], idx=-1, bor=false;
  for(var i=0;i<n;i++){
    var m=String(mk[i][0]||'').replace(/\+$/,'').trim().toLowerCase();
    if(m==='rz'){
      idx++;
      var q=[qv[i][0]||'', qv[i][1]||'', qv[i][2]||''];
      arr[idx]=q;
      if(q[0]||q[1]||q[2]) bor=true;
    }
  }
  return bor ? arr : null;
}


/* ============ FAKT/F2 SAQLASH (qayta ishlaganda) ============ */
function _oyKolMap(sh){
  var col=CFG.C, lastC=sh.getLastColumn(), map={};
  if(lastC<col.F2_BIRINCHI) return map;
  var scan=Math.min(sh.getLastRow(),40);
  var v=sh.getRange(1,col.F2_BIRINCHI,scan,lastC-col.F2_BIRINCHI+1).getValues();
  for(var i=0;i<v.length;i++){
    var first=String(v[i][0]||'').trim();
    if(first && isNaN(first)){
      for(var j=0;j<v[i].length;j++){
        var t=String(v[i][j]||'').trim();
        if(!t) continue;
        // НАРХ/СУММА ustunlarini o'tkazib yuboramiz — map faqat oy ОБЪЁМ ustunini saqlaydi
        if(t.indexOf(_F2_SUF_NARX)>=0 || t.indexOf(_F2_SUF_SUMMA)>=0) continue;
        map[t]=col.F2_BIRINCHI+j;
      }
      break;
    }
  }
  return map;
}
/* oyNom → {o:ОБЪЁМ ustun, n:НАРХ ustun}. 3-ustunli LRV → n=o+1; eski 1-ustunli → n=0.
 * НАРХ ustuni keyingi ustun sarlavhasi ' ₊нарх' suffixли bo'lsa aniqlanadi. */
function _oyMap3(sh){
  var col=CFG.C, lastC=sh.getLastColumn(), map={};
  if(lastC<col.F2_BIRINCHI) return map;
  var scan=Math.min(sh.getLastRow(),40);
  var v=sh.getRange(1,col.F2_BIRINCHI,scan,lastC-col.F2_BIRINCHI+1).getValues();
  for(var i=0;i<v.length;i++){
    var f=String(v[i][0]||'').trim();
    if(f && isNaN(f)){
      for(var j=0;j<v[i].length;j++){
        var t=String(v[i][j]||'').trim();
        if(!t) continue;
        if(t.indexOf(_F2_SUF_NARX)>=0||t.indexOf(_F2_SUF_SUMMA)>=0) continue;
        var cO=col.F2_BIRINCHI+j, nxt=String(v[i][j+1]||'').trim();
        map[t]={o:cO, n:(nxt.indexOf(_F2_SUF_NARX)>=0)?(cO+1):0};
      }
      break;
    }
  }
  return map;
}
function _faktSaqla(sh){
  if(!sh) return null;
  var last=sh.getLastRow(), col=CFG.C;
  var start=_autoData(sh); if(last<start) return null;
  var lastC=Math.max(sh.getLastColumn(), col.F2MUM);
  if(lastC<col.FAKT) return null;
  var oyMap=_oyMap3(sh);
  var n=last-start+1;
  // FAQAT kerakli ustunlarni o'qish (butun varaq emas — 10x tezroq)
  var idCols=col.BIRLIK-col.NOM+1;
  var gId=sh.getRange(start,col.NOM,n,idCols).getValues();        // NOM+BIRLIK
  var gMk=sh.getRange(start,col.MARKER,n,1).getValues();           // MARKER
  var gFakt=sh.getRange(start,col.FAKT,n,1).getValues();           // FAKT qiymatlari
  // Oy ustunlari: qo'lda kiritilganlarni (formula EMAS) saqlash uchun
  // Hamma oylar ustunini 1 ta so'rovda yuklaymiz (Batch)
  var oyData={};
  var lastColActual = sh.getLastColumn();
  if (lastColActual >= col.F2_BIRINCHI) {
    var numCols = lastColActual - col.F2_BIRINCHI + 1;
    var allVals = sh.getRange(start, col.F2_BIRINCHI, n, numCols).getValues();
    var allForms = sh.getRange(start, col.F2_BIRINCHI, n, numCols).getFormulas();
    for(var oyNom in oyMap){
      var mp=oyMap[oyNom], width=mp.n?(mp.n-mp.o+1):1;
      var offset=mp.o-col.F2_BIRINCHI;
      var subV=[], subF=[];
      for(var r=0;r<n;r++){
        var rowV=[], rowF=[];
        for(var c=0;c<width;c++){
          rowV.push(allVals[r][offset+c]);
          rowF.push(allForms[r][offset+c]);
        }
        subV.push(rowV);
        subF.push(rowF);
      }
      oyData[oyNom]={v:subV, f:subF};
    }
  }
  var data={}, occ={};
  for(var i=0;i<n;i++){
    var mk=String(gMk[i][0]||'').trim().toLowerCase().replace(/\+$/,'');
    if(mk!=='bl'&&(mk !== 'mat' && mk !== 'ob') &&mk!=='rs') continue;
    var nom=String(gId[i][0]||'').trim();
    var bir=String(gId[i][col.BIRLIK-col.NOM]||'').trim();
    if(!nom) continue;
    var baseKey=mk+'||'+nom+'||'+bir;
    var idx=occ[baseKey]=(occ[baseKey]||0)+1;
    var key=baseKey+'||'+idx;
    var fakt=(mk!=='rs') ? _toNum(gFakt[i][0]) : 0;
    var oylar={};
    for(var oyNom in oyMap){
      var od=oyData[oyNom], mp=oyMap[oyNom];
      var obF=String(od.f[i][0]||'');
      var ob=(obF.charAt(0)==='=') ? 0 : _toNum(od.v[i][0]);
      var nx=0;
      if(mp.n){
        var nOff=mp.n-mp.o;
        var nxF=String(od.f[i][nOff]||'');
        nx=(nxF.charAt(0)==='=') ? 0 : _toNum(od.v[i][nOff]);
      }
      if(ob||nx) oylar[oyNom]={obyom:ob, narx:nx};
    }
    if(fakt||Object.keys(oylar).length) data[key]={fakt:fakt, oylar:oylar};
  }
  if(!Object.keys(data).length) return null;
  return {data:data, oylarNomlar:Object.keys(oyMap)};
}
function _faktQayta(dst, start, n, saved){
  if(!saved||!saved.data) return;
  var col=CFG.C;
  var oyMap=_oyMap3(dst);
  var g=dst.getRange(start,col.NOM,n,col.BIRLIK-col.NOM+1).getValues();
  var markerG=dst.getRange(start,col.MARKER,n,1).getValues();
  // 1) MATCH: qaysi qatorda qanday update bor
  var updates={}, occ={};
  for(var i=0;i<n;i++){
    var mk=String(markerG[i][0]||'').trim().toLowerCase().replace(/\+$/,'');
    if(mk!=='bl'&&(mk !== 'mat' && mk !== 'ob') &&mk!=='rs') continue;
    var nom=String(g[i][0]||'').trim(), bir=String(g[i][1]||'').trim();
    if(!nom) continue;
    var baseKey=mk+'||'+nom+'||'+bir;
    var idx=occ[baseKey]=(occ[baseKey]||0)+1;
    var s=saved.data[baseKey+'||'+idx]; if(!s) continue;
    updates[i]=s;
  }
  if(!Object.keys(updates).length) return;
  // 2) BATCH FAKT: butun ustunni o'qib, o'zgartirib, yozish (1 getFormulas+getValues+setValues)
  var faktF=dst.getRange(start,col.FAKT,n,1).getFormulas();
  var faktV=dst.getRange(start,col.FAKT,n,1).getValues();
  var fChg=false;
  for(var i in updates){ var ii=parseInt(i); if(updates[ii].fakt){ faktV[ii][0]=updates[ii].fakt; if(faktF[ii][0]) faktF[ii][0]=''; fChg=true; } }
  if(fChg){ var fOut=[]; for(var i=0;i<n;i++) fOut.push([faktF[i][0]||faktV[i][0]]); dst.getRange(start,col.FAKT,n,1).setValues(fOut); }
  // 3) BATCH OY ustunlar: barcha oylar ustunlarini 1 ta so'rovda o'qib-yozish
  var lastColActual = dst.getLastColumn();
  if (lastColActual >= col.F2_BIRINCHI) {
    var numCols = lastColActual - col.F2_BIRINCHI + 1;
    var allVals = dst.getRange(start, col.F2_BIRINCHI, n, numCols).getValues();
    var allForms = dst.getRange(start, col.F2_BIRINCHI, n, numCols).getFormulas();
    var changed = false;

    for(var oyNom in oyMap){
      var mp=oyMap[oyNom];
      var offO=mp.o-col.F2_BIRINCHI;
      var offN=mp.n?(mp.n-col.F2_BIRINCHI):-1;
      
      for(var i in updates){
        var ii=parseInt(i), s=updates[ii]; if(!s.oylar||!s.oylar[oyNom]) continue;
        var ov=s.oylar[oyNom];
        var ob=(ov&&typeof ov==='object')?ov.obyom:ov;
        var nx=(ov&&typeof ov==='object')?ov.narx:0;
        
        if(ob){
          allVals[ii][offO]=ob;
          allForms[ii][offO]='';
          changed=true;
        }
        if(nx&&mp.n&&offN>=0){
          allVals[ii][offN]=nx;
          allForms[ii][offN]='';
          changed=true;
        }
      }
    }

    if(changed){
      var allOut=[];
      for(var r=0;r<n;r++){
        var row=[];
        for(var c=0;c<numCols;c++){
          row.push(allForms[r][c] !== "" ? allForms[r][c] : allVals[r][c]);
        }
        allOut.push(row);
      }
      dst.getRange(start, col.F2_BIRINCHI, n, numCols).setValues(allOut);
    }
  }
}


/* ============ QO'SHIMCHA ISHLAR (rs+/bl+/mat+) ============ */
function _qoshSaqla(sh){
  if(!sh) return null;
  var col=CFG.C, last=sh.getLastRow();
  var start=_autoData(sh); if(last<start) return null;
  var oyMap=_oyMap3(sh);
  var n=last-start+1;
  // FAQAT kerakli ustunlar (butun varaq emas — 10x tezroq)
  var gMain=sh.getRange(start,1,n,col.MARKER).getValues();  // A..I (identifikatsiya+marker+fakt)
  var oyData={};
  var lastColActual = sh.getLastColumn();
  if (lastColActual >= col.F2_BIRINCHI) {
    var numCols = lastColActual - col.F2_BIRINCHI + 1;
    var allVals = sh.getRange(start, col.F2_BIRINCHI, n, numCols).getValues();
    var allForms = sh.getRange(start, col.F2_BIRINCHI, n, numCols).getFormulas();
    for(var oy in oyMap){
      var mp=oyMap[oy], width=mp.n?(mp.n-mp.o+1):1;
      var offset=mp.o-col.F2_BIRINCHI;
      var subV=[], subF=[];
      for(var r=0;r<n;r++){
        var rowV=[], rowF=[];
        for(var c=0;c<width;c++){
          rowV.push(allVals[r][offset+c]);
          rowF.push(allForms[r][offset+c]);
        }
        subV.push(rowV);
        subF.push(rowF);
      }
      oyData[oy]={v:subV, f:subF};
    }
  }
  var groups=[], cur=null, lastAsl=null;
  for(var i=0;i<n;i++){
    var mk=String(gMain[i][col.MARKER-1]||'').trim().toLowerCase();
    var isQosh=/\+$/.test(mk);
    if(isQosh){
      var rd={A:gMain[i][col.NO-1], B:gMain[i][col.KOD-1], C:gMain[i][col.NOM-1],
              D:gMain[i][col.BIRLIK-1], E:gMain[i][col.E-1], marker:mk,
              fakt:_toNum(gMain[i][col.FAKT-1]), oylar:{}};
      for(var oy in oyMap){
        var od=oyData[oy], mp=oyMap[oy];
        var obF=String(od.f[i][0]||''); var ob=(obF.charAt(0)==='=')?0:_toNum(od.v[i][0]);
        var nx=0; if(mp.n){ var nOff=mp.n-mp.o; var nxF=String(od.f[i][nOff]||''); nx=(nxF.charAt(0)==='=')?0:_toNum(od.v[i][nOff]); }
        if(ob||nx) rd.oylar[oy]={obyom:ob, narx:nx};
      }
      if(!cur){
        cur={anchorNom:(lastAsl?lastAsl.nom:''), anchorBir:(lastAsl?lastAsl.bir:''), rows:[]};
        groups.push(cur);
      }
      cur.rows.push(rd);
    } else {
      cur=null;
      var nom=String(gMain[i][col.NOM-1]||'').trim();
      if(nom) lastAsl={nom:nom, bir:String(gMain[i][col.BIRLIK-1]||'').trim()};
    }
  }
  return groups.length ? {groups:groups} : null;
}
function _anchorTop(dst, anchorNom, anchorBir){
  if(!anchorNom) return 0;
  var col=CFG.C, last=dst.getLastRow(), start=_autoData(dst);
  if(last<start) return 0;
  var g=dst.getRange(start,col.NOM,last-start+1,col.BIRLIK-col.NOM+1).getValues();
  var nomU=_norm(anchorNom), birU=_norm(anchorBir||'');
  for(var i=0;i<g.length;i++)
    if(_norm(g[i][0])===nomU && (!birU||_norm(g[i][1])===birU)) return start+i;
  for(var i=0;i<g.length;i++)
    if(_norm(g[i][0])===nomU) return start+i;
  return 0;
}
function _qoshQayta(dst, saved, pdb, kat, a, obyekt, konstr, faktMap, nkMap){
  if(!saved||!saved.groups) return 0;
  var col=CFG.C, CL=_cl, total=0;
  for(var gi=0;gi<saved.groups.length;gi++){
    var grp=saved.groups[gi];
    var anchorR=_anchorTop(dst, grp.anchorNom, grp.anchorBir);
    var insertAfter=(anchorR>0)?anchorR:dst.getLastRow();
    var nQ=grp.rows.length;
    dst.insertRowsAfter(insertAfter, nQ);
    var base=insertAfter+1;
    var blRow=0, blNom='';
    for(var i=0;i<nQ;i++) if(/^bl/.test(grp.rows[i].marker)){ blRow=base+i; blNom=String(grp.rows[i].C||''); break; }
    // BATCH: barcha qatorlar uchun massiv qurib, BIR marta yozish
    var mainData=[];
    for(var i=0;i<nQ;i++){
      var rd=grp.rows[i], r=base+i;
      var mk=String(rd.marker), baseMk=mk.replace(/\+$/,'');
      var row=[]; for(var c=0;c<col.ST_OST;c++) row.push('');
      row[col.NO-1]=rd.A; row[col.KOD-1]=rd.B; row[col.NOM-1]=rd.C;
      row[col.BIRLIK-1]=rd.D; row[col.E-1]=rd.E; row[col.MARKER-1]=mk;
      if(baseMk==='rz'){
        row[col.H_RAZDEL-1]=rd.C;
      } else if(baseMk==='bl'){
        row[col.FAKT-1]=rd.fakt||0;
        row[col.QOLDIQ-1]='=$'+CL(col.E)+r+'-$'+CL(col.FAKT)+r;
        row[col.F2OL-1]=_f2sum(r,0);
        row[col.F2MUM-1]='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
        row[col.H_BL-1]=rd.C;
      } else {
        var p=_findPrice(String(rd.C||''),String(rd.D||''),_kodOl(rd.B),pdb,kat,faktMap,a,nkMap);
        var useE=((baseMk === 'mat' || baseMk === 'ob') )||(baseMk==='rs'&&!blRow);
        var volCol=useE?col.E:col.F;
        if(baseMk==='rs'&&blRow) row[col.F-1]='='+CL(col.E)+'$'+blRow+'*'+CL(col.E)+r;
        else row[col.F-1]='=$'+CL(col.E)+r;
        row[col.NARX-1]=p.narx;
        row[col.SMETA-1]='=$'+CL(volCol)+r+'*$'+CL(col.NARX)+r;
        var cat=(p.cat||'МАТ').toUpperCase(),mainC=(cat==='КАБ'||cat==='КАБЕЛ')?'МАТ':cat;
        var ref='=$'+CL(col.SMETA)+r;
        if(mainC==='ЧЕЛ') row[col.CHEL-1]=ref;
        else if(mainC==='МАШ') row[col.MASH-1]=ref;
        else if(mainC==='ОБ'||mainC==='ОБОР'||mainC==='ОБОРУД') row[col.OB-1]=ref;
        else if(mainC==='МК'||mainC==='М/К') row[col.MK-1]=ref;
        else row[col.MAT-1]=ref;
        var nu=_norm(rd.C||'');
        if(_hasKw(nu,kat.kw.KAB||[])) row[col.KAB-1]=ref;
        if(_hasKw(nu,kat.kw.BEZSKLAD||[])) row[col.BEZSKLAD-1]=ref;
        if(baseMk==='rs'&&blRow) row[col.FAKT-1]='='+CL(col.FAKT)+'$'+blRow+'*'+CL(col.E)+r;
        else row[col.FAKT-1]=rd.fakt||0;
        row[col.QOLDIQ-1]='=$'+CL(volCol)+r+'-$'+CL(col.FAKT)+r;
        row[col.F2OL-1]=_f2sum(r,0);
        row[col.F2MUM-1]='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
        row[col.ST_RES-1]='=$'+CL(col.SMETA)+r;
        row[col.ST_FAKT-1]='=$'+CL(col.FAKT)+r+'*$'+CL(col.NARX)+r;
        row[col.ST_F2-1]=_f2sum(r,2);
        row[col.ST_OST-1]='=$'+CL(col.F2MUM)+r+'*$'+CL(col.NARX)+r;
        row[col.H_BL-1]=blRow?blNom:rd.C;
      }
      mainData.push(row);
    }
    dst.getRange(base,1,nQ,col.ST_OST).setValues(mainData);
    // BL yig'indi formulalari
    if(blRow){
      var c1=blRow+1,c2=base+nQ-1;
      if(c2>=c1){
        var blF=[];
        blF[col.SMETA-1]='=SUM($'+CL(col.SMETA)+c1+':$'+CL(col.SMETA)+c2+')';
        blF[col.ST_RES-1]='=SUM($'+CL(col.ST_RES)+c1+':$'+CL(col.ST_RES)+c2+')';
        blF[col.ST_FAKT-1]='=SUM($'+CL(col.ST_FAKT)+c1+':$'+CL(col.ST_FAKT)+c2+')';
        blF[col.ST_F2-1]='=SUM($'+CL(col.ST_F2)+c1+':$'+CL(col.ST_F2)+c2+')';
        blF[col.ST_OST-1]='=SUM($'+CL(col.ST_OST)+c1+':$'+CL(col.ST_OST)+c2+')';
        for(var fi=0;fi<blF.length;fi++) if(blF[fi]) dst.getRange(blRow,fi+1).setFormula(blF[fi]);
      }
    }
    dst.getRange(base,1,nQ,col.ST_OST).setBackground(CFG.RANG_QOSH);
    // Saqlangan oy qiymatlari (batch: har oy ustuni uchun bitta yozish)
    var oyMap=_oyMap3(dst), hasOy=false;
    for(var i=0;i<nQ;i++) if(grp.rows[i].oylar&&Object.keys(grp.rows[i].oylar).length){ hasOy=true; break; }
    if(hasOy){
      for(var oyNom in oyMap){
        var mp=oyMap[oyNom], oOut=[], nOut=[], oChg=false, nChg=false;
        for(var i=0;i<nQ;i++){
          var ov=grp.rows[i].oylar&&grp.rows[i].oylar[oyNom];
          if(ov){
            var ob=(typeof ov==='object')?ov.obyom:ov, nx=(typeof ov==='object')?ov.narx:0;
            oOut.push([ob||'']); if(ob) oChg=true;
            nOut.push([nx||'']); if(nx) nChg=true;
          } else { oOut.push(['']); nOut.push(['']); }
        }
        if(oChg) dst.getRange(base,mp.o,nQ,1).setValues(oOut);
        if(nChg&&mp.n) dst.getRange(base,mp.n,nQ,1).setValues(nOut);
      }
    }
    total+=nQ;
  }
  return total;
}


/* ============ JAMI / SARLAVHA / RANG ============ */
function _jamiQator(dst, jamiRow, start, last){
  var col=CFG.C, CL=_cl, MC=CL(col.MARKER);
  function sumF(c){ return '=SUM('+CL(c)+start+':'+CL(c)+last+')'; }
  // ⚠️ ST_* ustunlar uchun FAQAT LEAF (rs+mat). rz qatorlar ST_F2/ST_OST da leaf
  //    yig'indisini saqlaydi (drill-down ko'rinishi) → oddiy SUM(barcha) ularni
  //    IKKI MARTA hisoblardi (leaf + rz=leaf yig'indisi = 2×). SUMIF bilan faqat leaf.
  function leafF(c){
    var sr=CL(c)+start+':'+CL(c)+last, mr=MC+start+':'+MC+last;
    return '=SUMIF('+mr+',"rs",'+sr+')+SUMIF('+mr+',"mat",'+sr+')';
  }
  dst.getRange(jamiRow, col.MARKER).setValue('ЖАМИ');
  dst.getRange(jamiRow, col.SMETA).setFormula(
    '='+CL(col.CHEL)+jamiRow+'+'+CL(col.MASH)+jamiRow+'+'+CL(col.MAT)+jamiRow+'+'
       +CL(col.OB)+jamiRow+'+'+CL(col.MK)+jamiRow);
  var katCols=[col.CHEL,col.MASH,col.MAT,col.OB,col.BEZSKLAD,col.MK,col.KAB];
  for(var i=0;i<katCols.length;i++) dst.getRange(jamiRow, katCols[i]).setFormula(sumF(katCols[i]));
  dst.getRange(jamiRow, col.ST_RES ).setFormula(leafF(col.ST_RES));
  dst.getRange(jamiRow, col.ST_FAKT).setFormula(leafF(col.ST_FAKT));
  dst.getRange(jamiRow, col.ST_F2  ).setFormula(leafF(col.ST_F2));
  dst.getRange(jamiRow, col.ST_OST ).setFormula(leafF(col.ST_OST));
  dst.getRange(jamiRow, col.SMETA, 1, col.ST_OST-col.SMETA+1).setNumberFormat('#,##0');
  dst.getRange(jamiRow, 1, 1, col.ST_OST).setFontWeight('bold').setBackground('#ffe599');
}
function _sarlavhaYoz(dst, start){
  if(start<2) return;
  var col=CFG.C, hr=start-1;
  var h2={};
  h2[col.NO]='№'; h2[col.KOD]='КОД'; h2[col.NOM]='НАИМЕНОВАНИЕ'; h2[col.BIRLIK]='ЕД. ИЗМ.';
  h2[col.E]='ҲАЖМ (ед)'; h2[col.F]='ҲАЖМ (жами)';
  h2[col.NARX]='НАРХ (1 ед)'; h2[col.SMETA]='СУММА'; h2[col.MARKER]='ТИП';
  h2[col.CHEL]='ЧЕЛ'; h2[col.MASH]='МАШ'; h2[col.MAT]='МАТ'; h2[col.OB]='ОБ';
  h2[col.BEZSKLAD]='БЕЗ СКЛАД'; h2[col.MK]='М/К'; h2[col.KAB]='ПРОВОД';
  h2[col.FAKT]='Факт объем'; h2[col.QOLDIQ]='Остатка объем';
  h2[col.F2OL]='Забран на Ф2'; h2[col.F2MUM]='Остатка Ф2';
  h2[col.QAVAT1]='ҚАВАТ 1'; h2[col.QAVAT2]='ҚАВАТ 2'; h2[col.QAVAT3]='ҚАВАТ 3';
  h2[col.H_BL]='ВИД РАБОТ'; h2[col.H_RAZDEL]='РАЗДЕЛ';
  h2[col.ST_RES]='Стоимость ресурс'; h2[col.ST_FAKT]='Стоимость Факт рес';
  h2[col.ST_F2]='Стоимость Ф2 ресур'; h2[col.ST_OST]='Стоимость остатка';
  h2[col.F2_BIRINCHI]='№1 ф2';
  var maxCol=col.F2_BIRINCHI, row=[];
  for(var c=0;c<maxCol;c++) row.push('');
  for(var c in h2) row[parseInt(c)-1]=h2[c];
  dst.getRange(hr,1,1,maxCol).setValues([row]);
  dst.getRange(hr,1,1,maxCol).setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
}
function _ranglaQatorlar(dst, info, start, n){
  var R=CFG.RANG, lastCol=CFG.C.ST_OST;
  var grp={rz:[],bl:[],mat:[],rs:[]};
  for(var i=0;i<n;i++){ var t=info[i].tur; if(grp[t]) grp[t].push(info[i].row); }
  var L=_cl, lastL=L(lastCol);

  // Optimizatsiya: Avval butun ma'lumotlar oralig'ini material rangi bilan bo'yaymiz (1 ta tezkor chaqiriq)
  if(R.mat) {
    dst.getRange(start, 1, n, lastCol).setBackground(R.mat);
  }

  // So'ngra razdel, blok va resurs qatorlarining rangini ustidan alohida yozamiz
  _bgBatch(dst, grp.rz, lastL, R.rz, null);
  _bgBatch(dst, grp.bl, lastL, R.bl, CFG.RANG_BL_FONT);
  _bgBatch(dst, grp.rs, lastL, null, null); // resurs qatorlarini oq holga qaytaramiz (transparent)
}
function _bgBatch(dst, rows, lastL, bg, font){
  if(!rows.length) return;
  rows.sort(function(a,b){return a-b;});
  var ranges=[], s=rows[0], p=rows[0];
  for(var i=1;i<rows.length;i++){
    if(rows[i]===p+1){ p=rows[i]; }
    else { ranges.push('A'+s+':'+lastL+p); s=rows[i]; p=rows[i]; }
  }
  ranges.push('A'+s+':'+lastL+p);
  var rl=dst.getRangeList(ranges);
  rl.setBackground(bg);
  if(font) rl.setFontColor(font);
}


/* ============ MARKIROVKA QAYTA ============ */
function markirovkaQaytaObyekt(obyektNom){
  if(!_tasdiq('ДИҚҚАТ: '+obyektNom+' маркировка қайта ёзилади. Давом?')) return;
  var obs=papkaSkan(), target=null;
  for(var i=0;i<obs.length;i++) if(obs[i].obyekt===obyektNom){ target=obs[i]; break; }
  if(!target) throw 'Объект топилмади: '+obyektNom;
  var fmt=_normFormat(target.format||'TN');
  var plus=_plusFile(obyektNom, target.folderId);
  var a=sozAsosiy(), sheets=plus.getSheets(), cnt=0;
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    var last=sh.getLastRow(), start=a.dataQator>0?a.dataQator:_autoData(sh), n=last-start+1;
    if(n<1) continue;
    var data=sh.getRange(start,1,n,6).getValues(), mm=_mergedMap(sh,start,n), out=[];
    for(var i=0;i<n;i++){
      var nA=(i+1<n)?data[i+1][0]:'', nC=(i+1<n)?data[i+1][2]:'';
      out.push([_classify(start+i,mm,data[i][0],data[i][2],nA,nC,fmt)]);
    }
    sh.getRange(start,CFG.C.MARKER,n,1).setValues(out); cnt+=n;
  }
  SpreadsheetApp.getUi().alert('Маркировка қайта аниқланди: '+cnt+' қатор.');
}


/* ============ AUTO DATA_QATOR ============ */
function _autoData(sh){
  // LRV_PLUS: ЖАМИ markeri topilsa, undan KEYINGI qator = data boshi
  var last=Math.min(sh.getLastRow(), 60);
  var markerCol=CFG.C.MARKER;
  var vm=sh.getRange(1,markerCol,last,1).getValues();
  for(var i=0;i<vm.length;i++){
    var mk=String(vm[i][0]||'').trim();
    if(mk==='ЖАМИ'||mk==='JAMI') return i+2;  // ЖАМИ qatoridan keyingi = data
  }
  // Fallback: matn bo'yicha eski mantiq
  var v=sh.getRange(1,1,last,6).getValues();
  var mm=_mergedMap(sh,1,last);
  for(var i=0;i<v.length;i++){
    var r=i+1, A=v[i][0], C=String(v[i][2]||'').trim();
    var Cmatn = C.length>4 && /[А-ЯЁA-Z]/i.test(C);
    var Amatn = String(A||'').trim().length>4 && /[А-ЯЁA-Z]/i.test(String(A));
    if(mm.full[r] && (Cmatn||Amatn)) return r;
    if(_isFr(A)) return r;
    if((A===''||A===null||A===undefined) && Cmatn) return r;
    if(_isWhole(A) && Cmatn) return r;
  }
  return 14;
}


/* ============ MARKIROVKA ============ */
function _mergedMap(sh, start, n){
  var merges=sh.getRange(start,1,n,6).getMergedRanges(), full={}, ef={}, mmEf={};
  for(var i=0;i<merges.length;i++){
    var m=merges[i], r=m.getRow(), c1=m.getColumn(), c2=c1+m.getNumColumns()-1;
    if(c1===1 && c2>=6) full[r]=true;
    else if(c1>=2 && c2>=6) ef[r]=true;
    
    // ef (5-6) ni ham shu siklning o'zida olib ketamiz
    if(c1===5 && c2===6) mmEf[r]=true;
  }
  return {full:full, ef:ef, mmEf:mmEf};
}
function _classify(r, mm, A, C, nextA, nextC, fmt){
  if(fmt === 'ABC4'){
    if(_isFr(A)) return 'rs';
    var Cm = String(C||'').trim().length>4;
    if(_isWhole(A) && Cm) return _isZtr(nextC) ? 'bl' : 'mat';
    if((A===''||A===null||A===undefined) && Cm) return 'rz';
    if(String(C||'').trim() || String(A||'').trim()) return 'rz';
    return '';
  }
  if(mm.full[r]) return 'rz';
  if(mm.ef[r])   return _isFr(nextA)?'bl':'mat';
  if(_isFr(A))   return 'rs';
  if(String(C||'').trim() || (String(A||'').trim() && !_isWhole(A))) return 'rz';
  if(_isWhole(A) && String(C||'').trim()) return 'bl';
  return '';
}
function _isFr(v){ var s=String(v==null?'':v).trim(); return /^\d+\s*[\.,]\s*\d/.test(s); }
function _isWhole(v){
  if(typeof v==='number') return v>0 && v===Math.floor(v);
  var s=String(v==null?'':v).trim();
  return /^\d+$/.test(s);
}
function _isZtr(c){
  var nu=_norm(c);
  return nu.indexOf('ЗАТРАТЫ ТРУДА РАБОЧИХ')>=0 || nu.indexOf('ЗАТРАТЫ ТРУДА МАШИНИСТОВ')>=0;
}


/* ============ ORALIQ TIZIMI ============
 * Svodkadagi seksiya chegaralari (qator raqamlari + kategoriya).
 * Bir marta skanlanadi, user tasdiqlaydi, SOZLAMALAR_ОРАЛИҚ ga saqlanadi.
 * Keyingi Ишла da _priceDB shu oraliqlarni ishlatadi. */
var _ORALIQ_SH='SOZLAMALAR_ОРАЛИҚ';

function _oraliqlarOl(obyekt){
  var sh=SpreadsheetApp.getActive().getSheetByName(_ORALIQ_SH);
  if(!sh||sh.getLastRow()<2) return [];
  var v=sh.getRange(2,1,sh.getLastRow()-1,5).getValues(), r=[];
  for(var i=0;i<v.length;i++){
    var dbOb = String(v[i][0]||'').trim();
    if(!_cfgMos(dbOb, obyekt)) continue;        // papka (svodka) bo'yicha normallashtirilgan moslik
    r.push({varaq:String(v[i][1]||'').trim(), qator:Number(v[i][2])||0,
            kat:String(v[i][3]||'').trim(), sarlavha:String(v[i][4]||'').trim()});
  }
  return r;
}

/* Qator raqami bo'yicha kategoriya aniqlash:
 * oraliqlar = [{varaq,qator,kat}] — tartiblangan.
 * row qaysi oraliqqa tushsa shu kat qaytadi. */
function _oraliqKat(oraliqlar, varaqNom, row){
  var kat='';
  for(var i=0;i<oraliqlar.length;i++){
    var o=oraliqlar[i];
    if(o.varaq!==varaqNom) continue;
    if(o.qator<=row) kat=o.kat; else break;
  }
  return kat;
}


/* ============ NARX BAZASI (strict nom+birlik) ============ */
function _priceDB(svodSS, kat, sc, fmt, svodSheets, savedOraliq){
  var sheets = svodSS.getSheets();
  var byKey = {};
  var nKey = 0;
  var hasRanges = savedOraliq && savedOraliq.length>0;

  for(var s=0;s<sheets.length;s++){
    var sh = sheets[s];
    if(_skip(sh.getName())) continue;
    if(svodSheets && svodSheets.length && svodSheets.indexOf(sh.getName())<0) continue;
    var last = sh.getLastRow();
    if(last < 1) continue;
    var maxc = Math.max(6, sc.NARX, sc.NOM, sc.BLOK, sc.KOD||0, sc.BIRLIK||0, sc.QTY||0, sc.SUMMA||0);
    var v = sh.getRange(1,1,last,maxc).getValues();
    var cur = '';
    for(var i=0;i<v.length;i++){
      var nom  = String(v[i][sc.NOM-1]||'').trim();
      var narx = _toNum(v[i][sc.NARX-1]);    // DONA narx (1 ed)
      var bir  = String(v[i][sc.BIRLIK-1]||'').trim();
      var kod  = (sc.KOD && v[i][sc.KOD-1]!==null && v[i][sc.KOD-1]!==undefined && v[i][sc.KOD-1]!=='')
                 ? String(v[i][sc.KOD-1]).trim().toUpperCase() : '';
      // TEKSHIRUV uchun: hajm (QTY) va jami (СУММА). Narx manbai EMAS — faqat
      // дона×qty≈сумма nazorati (noto'g'ri ustun tanlanганини aniqlash).
      var qty   = (sc.QTY>0)   ? _toNum(v[i][sc.QTY-1])   : 0;
      var summa = (sc.SUMMA>0) ? _toNum(v[i][sc.SUMMA-1]) : 0;
      var cat  = '';

      /* ── SAQLANGAN ORALIQLAR BILAN ────────────────────────── */
      if(hasRanges){
        var rKat=_oraliqKat(savedOraliq, sh.getName(), i+1);
        if(!rKat) continue; // oraliq tashqarisida → o'tkazib yuboramiz

        // Svodka NARX ustuni = DONA narx, aynan olinadi (qty/bo'lish YO'Q).
        // Bo'lish mantiqi narxni 10x buzib yuborardi (120→550mlrd bug).
        if(!nom||!bir||narx<=0) continue;
        var nU=_norm(nom), bU=_normBirlik(bir);
        if(nU.indexOf('ИТОГО')>=0||nU.indexOf('ЖАМИ')>=0||bU==='СУМ') continue;

        // Birlik ЧЕЛ/МАШ → doim to'g'ri; qolgan → oraliq kategoriyasi
        var bCat=_catBirlik(bir, nom, kat);
        if(bCat==='ЧЕЛ'||bCat==='МАШ') cat=bCat;
        else if(rKat==='МАТ') cat=_refine(nU,'МАТ',kat); // КАБ/М/К ajratish
        else cat=rKat;

      /* ── ABC4 AVTO-ANIQLASH (eski mantiq) ─────────────────── */
      } else if(fmt === 'ABC4'){
        var birUp = bir.toUpperCase();
        var nomUp = nom.toUpperCase();
        if((!kod || narx<=0) && nomUp){
          if(nomUp.indexOf('МАШИНИСТ')>=0)                    { cur='МАШ'; continue; }
          if(kat.blok.OB   && nomUp.indexOf(kat.blok.OB)>=0)  { cur='ОБ';  continue; }
          if(kat.blok.CHEL && nomUp.indexOf(kat.blok.CHEL)>=0){ cur='ЧЕЛ'; continue; }
          if(kat.blok.MASH && nomUp.indexOf(kat.blok.MASH)>=0){ cur='МАШ'; continue; }
          if(kat.blok.MAT  && nomUp.indexOf(kat.blok.MAT)>=0) { cur='МАТ'; continue; }
          if(nomUp.indexOf('ИТОГО')>=0||nomUp.indexOf('ЖАМИ')>=0){ cur=''; continue; }
          if(!kod && narx<=0) continue;
        }
        if(!nom || !bir || narx<=0) continue;
        var nomU2=_norm(nom), birU2=_normBirlik(bir);
        if(nomU2.indexOf('ИТОГО')>=0||nomU2.indexOf('ЖАМИ')>=0||birU2==='СУМ') continue;
        
        var bCat = _catBirlik(bir, nom, kat);
        if(bCat === 'ЧЕЛ' || bCat === 'МАШ') cat = bCat;
        else cat = _refine(_norm(nom), cur||'МАТ', kat);

      /* ── TN AVTO-ANIQLASH (seksiya = НОМ ustunidagi narxsiz sarlavha) ─────── */
      } else {
        var blokTxt = String(v[i][sc.BLOK-1]||'').toUpperCase();
        // Seksiya sarlavhasi: NARX YO'Q (narx<=0) bo'lgan matnli qator.
        // narx<=0 sharti SHART — aks holda resurs nomi ("ЗАТРАТЫ ТРУДА РАБОЧИХ...")
        // seksiya nomi ("ЗАТРАТЫ ТРУДА") bilan boshlangani uchun resurs ham seksiya
        // deb o'tkazib yuborilardi (narx yo'qolardi).
        if(narx<=0 && blokTxt){
          if(blokTxt.indexOf('МАШИНИСТ')>=0)                     { cur='МАШ'; continue; }
          if(kat.blok.CHEL && blokTxt.indexOf(kat.blok.CHEL)>=0){ cur='ЧЕЛ'; continue; }
          if(kat.blok.MASH && blokTxt.indexOf(kat.blok.MASH)>=0){ cur='МАШ'; continue; }
          if(kat.blok.MAT  && blokTxt.indexOf(kat.blok.MAT)>=0) { cur='МАТ'; continue; }
          if(kat.blok.OB   && blokTxt.indexOf(kat.blok.OB)>=0)  { cur='ОБ';  continue; }
        }
        // NARX = dona narx, aynan olinadi (qty/bo'lish YO'Q — narxni buzardi)
        if(!nom || narx<=0) continue;
        var bCat = _catBirlik(bir, nom, kat);
        if(bCat === 'ЧЕЛ' || bCat === 'МАШ') cat = bCat;
        else cat = _refine(_norm(nom), cur||'МАТ', kat);
      }

      // DONA NARX KAFOLATI: dona × kol-vo ≈ summa bo'lishi SHART.
      // Agar narx ustuniga JAMI summa tushib qolgan bo'lsa (narx≈summa, kol-vo>1) —
      // dona narxni summa/kol-vo dan TIKLAYMIZ. Bu Nx shishishni (масалан ГИБКИЙ
      // 13млн o'rniga 1.7млрд) matematik aniqlik bilan oldini oladi (fuzzy emas).
      // Mos kelmasa va summa≈narx ham emas → ogohlantirish (boshqa nomuvofiqlik).
      var warn=false;
      if(narx>0 && qty>0 && summa>0){
        var hisob=narx*qty;
        if(Math.abs(hisob-summa) > summa*0.02){
          if(Math.abs(narx-summa) <= summa*0.02 && qty>1){
            narx = summa/qty;       // dona narx tiklandi (narx aslida JAMI summa edi)
          } else {
            warn=true;              // boshqa nomuvofiqlik — narx tekshirilsin
          }
        }
      }
      // ⚡ CONSTANTA kalit: nom (faqat son+harf) + birlik (aynan). Fuzzy/byUnit YO'Q.
      var key = _normNomKey(nom)+'||'+_normBirlik(bir);
      var ex = byKey[key];
      if(!ex){ byKey[key]={narx:narx, cat:cat, warn:warn}; nKey++; }
      else if(narx > ex.narx){ ex.narx=narx; ex.cat=cat; ex.warn=warn; }
    }
  }
  return {byKey:byKey, n:nKey};
}
/* NARXLAR varaqi REGISTRI — server faylidagi TASDIQLANGAN ma'lumot.
 * O'qiydi: A=НОМ B=БИРЛИК C=КАТ D=БЕЛГИЛАНГАН(tasdiqlangan narx).
 * key → {kat, bel}. _findPrice da:
 *   bel>0  → tasdiqlangan narx (eng ishonchli, cross-obyekt MAX buzmaydi)
 *   kat    → kategoriya (tasdiqlangan bo'lsa to'liq; aks holda МАТ ni boyitadi) */
function _narxlarKatMap(){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(CFG.NARXLAR);
  if(!sh||sh.getLastRow()<2) return {};
  var v=sh.getRange(2,1,sh.getLastRow()-1,4).getValues();   // A,B,C,D
  var m={};
  for(var i=0;i<v.length;i++){
    var nom=String(v[i][0]||'').trim(), bir=String(v[i][1]||'').trim(),
        kat=String(v[i][2]||'').trim(), bel=_toNum(v[i][3]);
    if(!nom||!bir) continue;
    if(kat || bel>0) m[_normNomKey(nom)+'||'+_normBirlik(bir)]={kat:kat, bel:bel};
  }
  return m;
}

function _catBirlik(birlik, nom, kat){
  var b = String(birlik).toUpperCase();
  var nU = String(nom||'').toUpperCase();
  if(nU.indexOf('ТРУДА МАШИНИСТОВ')>=0) return 'МАШ';
  if(b.indexOf('ЧЕЛ')>=0) return 'ЧЕЛ';
  if(b.indexOf('МАШ')>=0) return 'МАШ';
  return _refine(_norm(nom), 'МАТ', kat);
}

/* ============ HAR OBYEKT ЧЕЛ-Ч STAVKA (fiksirlangan mehnat haqi) ============
 * ⚠️ FAQAT "ЗАТРАТЫ ТРУДА РАБОЧИХ" (ишчи mehnat soati). MASHINIST EMAS, boshqa
 *    ЧЕЛ resurslar EMAS (aks holda smeta oshib ketadi). Har obyekt uchun ALOHIDA:
 *    GAME CLUB=29000, Amfiteatr=24000 (dogovorga bog'liq).
 * SOZLAMALAR_СТАВКА: A=ОБЪЕКТ B=ЧЕЛ-Ч_НАРХ.
 * Kiritilsa (>0) → faqat "ЗАТРАТЫ ТРУДА РАБОЧИХ" resursga shu narx (svodkadan USTUN).
 * Kiritilmasa (0) → svodka narxi ishlatiladi. */
var _STAVKA_SH='SOZLAMALAR_СТАВКА';
function _stavkaOl(obyekt){
  // 1) SHARTNOMA stavkasi USTUVOR — dogovor oilasidagi barcha obyektlar bir xil
  //    chel-chas oladi (Amfiteatr ham, Stella ham — agar bitta dogovorda bo'lsa).
  try{
    if(typeof shartnomaChelCh==='function'){
      var shCh=shartnomaChelCh(obyekt);
      if(shCh>0) return {chel:shCh};
    }
  }catch(e){}
  // 2) Zaxira: eski per-obyekt varaq (shartnomaga biriktirilmagan obyektlar uchun)
  try{
    var sh=SpreadsheetApp.getActive().getSheetByName(_STAVKA_SH);
    if(!sh||sh.getLastRow()<2) return {chel:0};
    var v=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(var i=0;i<v.length;i++){
      var dbOb = String(v[i][0]||'').trim();
      if(_cfgMos(dbOb, obyekt)) return {chel:_toNum(v[i][1])};
    }
  }catch(e){}
  return {chel:0};
}
function _stavkaYoz(obyekt, chel){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(_STAVKA_SH);
  if(!sh){
    sh=ss.insertSheet(_STAVKA_SH);
    sh.getRange(1,1,1,2).setValues([['ОБЪЕКТ','ЧЕЛ-Ч НАРХ (ЗАТРАТЫ ТРУДА РАБОЧИХ)']])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    sh.setFrozenRows(1); sh.setColumnWidth(1,220); sh.setColumnWidth(2,280);
  }
  var kalit=_cfgKalit(obyekt);                  // PAPKA nomi ostida saqlaymiz (split obyektlar ulashadi)
  var last=sh.getLastRow(), found=0;
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<v.length;i++){
      var dbOb = String(v[i][0]).trim();
      if(_cfgMos(dbOb, obyekt)){ found=i+2; break; }
    }
  }
  var row=[kalit, _toNum(chel)||''];
  if(found) sh.getRange(found,1,1,2).setValues([row]);
  else sh.appendRow(row);
  return {chel:_toNum(chel)};
}
/* ⚡⚡⚡ CONSTANTA NARXLASH — eng qatiy, ishonchli mantiq (yuridik muhim).
 *
 * QOIDA: narx FAQAT shu obyekt svodkasidan, AYNAN moslik bilan olinadi.
 *   1) Nom: faqat SON va HARF solishtiriladi (_normNomKey) — probel/tinish/tire
 *      farqi e'tiborsiz, lekin mazmun AYNAN mos bo'lishi shart.
 *   2) Birlik: AYNAN bir xil (_normBirlik — м3/М3/m³ bir xil, lekin кг≠т, шт≠1000шт).
 *   3) Topilmasa → MISS (narx 0) → _NARX_LOG → qo'lda beriladi.
 *
 * YO'Q: fuzzy/taxminiy moslik, cross-obyekt narx, umumiy NARXLAR narxi, FAKT MAX.
 *   Bularning bari boshqa resurs/obyekt narxini aralashtirib qo'pol xatoga olib
 *   kelardi (ekranga umumiy narx). Endi HECH QACHON aralashmaydi.
 * faktMap, a, kod — endi narx uchun ISHLATILMAYDI (signature mosligi uchun qoldi). */
function _findPrice(nom, birlik, kod, pdb, kat, faktMap, a, nkMap){
  var key=_normNomKey(nom)+'||'+_normBirlik(birlik);
  var debug={method:'MISS', detail:key};
  if(!nom) return {narx:0, cat:'МАТ', debug:debug};
  var nomU=_norm(nom);

  // ЗАТРАТЫ ТРУДА МАШИНИСТОВ — машина tarkibida, ALOHIDA narxi YO'Q → 0 (kafolat).
  if(nomU.indexOf('ТРУДА МАШИНИСТ')>=0){
    return {narx:0, cat:'МАШ', debug:{method:'МАШИНИСТ_0', detail:'ЗТМ нархсиз'}};
  }

  // ── NARX: faqat svodka EXACT (nom son+harf aynan + birlik aynan) ──
  var narx=0, cat='';
  if(pdb.byKey[key]!==undefined){
    narx=pdb.byKey[key].narx; cat=pdb.byKey[key].cat; debug.method='EXACT';
    if(pdb.byKey[key].warn) debug.warn=true;   // дона×qty≠сумма — shubhali (LRV ko'rib chiq)
  } else if(nomU.indexOf('ТРУДА РАБОЧИХ')>=0){
    // Zaxira moslik (Fallback): ishchi kuchi nomidagi kichik farqlar uchun (masalan "С УЧЕТОМ СОЦСТРАХА" bor/yo'qligi)
    var normB = _normBirlik(birlik);
    for(var k in pdb.byKey){
      var parts = k.split('||');
      var kNom = parts[0];
      var kBir = parts[1]||'';
      if(kBir === normB && (kNom.indexOf('ТРУДАРАБОЧИХ')>=0 || kNom.indexOf('РАБОЧИХСТРОИТЕЛЕЙ')>=0)){
        narx=pdb.byKey[k].narx; cat=pdb.byKey[k].cat; debug.method='LABOR_FALLBACK';
        debug.detail='Matched ' + k + ' for ' + key;
        if(pdb.byKey[k].warn) debug.warn=true;
        break;
      }
    }
  }
  // topilmasa: narx=0, debug.method='MISS' → _NARX_LOG ga tushadi

  // ── KATEGORIYA (narx topilmasa ham aniqlanadi — daraxt/rollup uchun) ──
  if(!cat) cat=_refine(nomU,'МАТ',kat);
  // BIRLIK HIMOYASI: birlik ЧЕЛ-Ч → ЧЕЛ, МАШ-Ч → МАШ (birlik aniq aytsa — haqiqat)
  var birCat=_catBirlik(_normBirlik(birlik),'',kat);
  if(birCat==='ЧЕЛ'||birCat==='МАШ') cat=birCat;
  else if(cat==='МАШ' && birCat!=='МАШ') cat=_refine(nomU,'МАТ',kat);
  // NARXLAR KAT — faqat KATEGORIYA tuzatmasi (NARX EMAS; narx doim svodkadan).
  var reg=(nkMap && nkMap[key]) ? nkMap[key] : null;
  if(reg && reg.kat){
    if(reg.bel>0) cat=reg.kat;                          // tasdiqlangan kategoriya — to'liq
    else if(cat==='МАТ' && reg.kat!=='МАТ') cat=reg.kat; // tasdiqlanmagan — faqat МАТ ni boyitadi
  }

  // ⚡ HAR OBYEKT FIKSIRLANGAN ЧЕЛ-Ч stavka (svodkadan USTUN).
  //   ⚠️ FAQAT "ЗАТРАТЫ ТРУДА РАБОЧИХ" nomli resurs uchun (mehnat soati narxi).
  //   MASHINIST (ЗТМ) EMAS — u yuqorida 0 qilingan. Boshqa ЧЕЛ resurslarga ham
  //   TEGMAYDI (aks holda smeta oshib ketadi). Faqat ишчи mehnat haqi fiksirlanadi.
  //   Kiritilmasa (0) → svodka EXACT narxi qoladi. Bu cross-obyekt EMAS.
  if(pdb.stavka && pdb.stavka.chel>0 && nomU.indexOf('ТРУДА РАБОЧИХ')>=0){
    narx=pdb.stavka.chel; debug.method='СТАВКА_ЧЕЛ';
  }
  return {narx:narx, cat:cat, debug:debug};
}

/* BIRLIK BAZASI + MIQYOS — cross-unit narxni to'g'ri masshtablash uchun.
 * Qaytaradi {base, factor}: factor = shu birlikda nechta BAZA birlik bor.
 *   ШТ→{ШТ,1}  1000ШТ→{ШТ,1000}  100ШТ→{ШТ,100}
 *   Т/ТОННА→{КГ,1000}  Ц→{КГ,100}  КГ→{КГ,1}  Г→{КГ,0.001}
 *   М/М2/М3 va boshqalar → o'z bazasi, factor 1 (konvertatsiya qilinmaydi)
 * Maqsad: svodka narxi 1000ШТ uchun bo'lsa, ШТ uchun narx = narx/1000. */
function _birlikBaza(b){
  var u=_normBirlik(b); if(!u) return {base:'', factor:1};
  var factor=1, base=u;
  var m=u.match(/^(\d+(?:[.,]\d+)?)(.+)$/);     // boshida son: 1000ШТ, 100М
  if(m){ factor=parseFloat(m[1].replace(',','.'))||1; base=m[2]; }
  else if(/^ТЫС/.test(u)){ factor=1000; base=u.replace(/^ТЫС[ЯЧ]*/,''); } // ТЫС.ШТ
  // massa oilasi → BAZA КГ
  if(base==='Т'||base==='ТОННА'||base==='ТН'){ factor*=1000; base='КГ'; }
  else if(base==='Ц'){ factor*=100; base='КГ'; }
  else if(base==='Г'||base==='ГР'||base==='ГРАММ'){ factor*=0.001; base='КГ'; }
  if(!base) base=u;
  return {base:base, factor:factor||1};
}
function _jacTok(ta,tb){
  var i=0, u=0, seen={};
  for(var k in ta){ seen[k]=1; u++; if(tb[k]) i++; }
  for(var k2 in tb){ if(!seen[k2]) u++; }
  return u ? (i/u) : 0;
}
function _tok(s){
  var arr=String(s||'').split(/\s+/), m={};
  for(var i=0;i<arr.length;i++){
    var t=arr[i].replace(/[^0-9A-ZА-ЯЁ]/g,'');
    if(t && t.length>1) m[t]=1;
  }
  return m;
}
/* char-bigram (probelsiz) — "nuqta/probel farqi"ga chidamli */
function _bigrams(s){
  s=String(s||'').replace(/\s+/g,'');
  var m={};
  for(var i=0;i<s.length-1;i++){ var bg=s.substr(i,2); m[bg]=(m[bg]||0)+1; }
  return m;
}
function _cntMap(m){ var c=0; for(var k in m) c+=m[k]; return c; }
function _dice(aMap,aN,bMap,bN){
  if(!aN||!bN) return 0;
  var inter=0;
  for(var k in aMap){ if(bMap[k]) inter+=Math.min(aMap[k],bMap[k]); }
  return (2*inter)/(aN+bN);
}
function _refine(nomU, baseCat, kat){
  if(baseCat!=='МАТ') return baseCat;
  if(_hasKw(nomU,kat.kw.KAB)) return 'КАБ';
  if(_hasKw(nomU,kat.kw.MK))  return 'М/К';
  if(_hasKw(nomU,kat.kw.OB))  return 'ОБ';
  return 'МАТ';
}
function _hasKw(s,arr){ for(var i=0;i<arr.length;i++) if(arr[i] && s.indexOf(arr[i])>=0) return true; return false; }


/* ============ NORMALIZATSIYA ============ */
// V→В va N→Н qo'shildi — brend nomlar (BAHCIVAN→ВАНСIВАН) to'g'ri normalizatsiya uchun
var _LAT2CYR={A:'А',B:'В',C:'С',E:'Е',H:'Н',K:'К',M:'М',N:'Н',O:'О',P:'Р',T:'Т',V:'В',X:'Х',Y:'У'};
function _norm(s){
  s=String(s).toUpperCase(); var out='';
  for(var i=0;i<s.length;i++){ var ch=s.charAt(i); out+=(_LAT2CYR[ch]||ch); }
  out=out.replace(/Ё/g,'Е');
  // tokenni qo'shuvchi belgilar (tire/nuqta/slash/pastki chiziq) → olib tashlanadi:
  //   "М-350" == "М350" == "М.350."
  out=out.replace(/[.\-–—_/\\]+/g,'');
  // qolgan ajratuvchilar → probel
  out=out.replace(/[,;:()"'«»№\[\]{}]+/g,' ');
  return out.replace(/\s+/g,' ').trim();
}
// BIRLIK uchun maxsus normalizatsiya (м3/М3/m³ → М3)
function _normBirlik(s){
  var raw=String(s==null?'':s).toUpperCase()
    .replace(/³/g,'3').replace(/²/g,'2').replace(/¹/g,'1')
    .replace(/Ё/g,'Е')
    .replace(/[\s.,\-/]+/g,'');
  if(CFG.BIR_ALIAS[raw]) return CFG.BIR_ALIAS[raw];
  var out='';
  for(var i=0;i<raw.length;i++){ var ch=raw.charAt(i); out+=(_LAT2CYR[ch]||ch); }
  if(CFG.BIR_ALIAS[out]) return CFG.BIR_ALIAS[out];
  return out;
}

/* ⚡ CONSTANTA NOM KALITI — EXACT moslik uchun.
 * Nomdan FAQAT son va harf qoldiriladi: probel, tinish belgi, tire, qavs — HAMMASI
 * olib tashlanadi. Lotin→Kirill, Ё→Е. Shunda "Бетон М-350, тяжёлый" va
 * "БЕТОН М350 ТЯЖЕЛЫЙ" bir xil kalitga tushadi → faqat mazmun (son+harf) solishtiriladi.
 * Bu LRV nomi va svodka nomini imlo/format farqisiz, lekin AYNAN mazmunan solishtiradi. */
function _normNomKey(s){
  s=String(s==null?'':s).toUpperCase();
  var out='';
  for(var i=0;i<s.length;i++){ var ch=s.charAt(i); out+=(_LAT2CYR[ch]||ch); }
  out=out.replace(/Ё/g,'Е');
  return out.replace(/[^0-9А-Я]/g,'');   // faqat son + kirill harf
}


/* ============ SUMIF (rz uchun) ============ */
function _sumif2col(it, sumCol){
  if(!it.c1||!it.c2) return 0;
  var L=_cl, MC=L(CFG.C.MARKER), sr=L(sumCol)+it.c1+':'+L(sumCol)+it.c2;
  var mr=MC+it.c1+':'+MC+it.c2;
  return '=SUMIF('+mr+',"bl",'+sr+')+SUMIF('+mr+',"mat",'+sr+')';
}
// rs + mat (leaf) qatorlar yig'indisi — rz darajada qolgan/F2 qiymatlar uchun
function _sumifLeaf(it, sumCol){
  if(!it.c1||!it.c2) return 0;
  var L=_cl, MC=L(CFG.C.MARKER), sr=L(sumCol)+it.c1+':'+L(sumCol)+it.c2;
  var mr=MC+it.c1+':'+MC+it.c2;
  return '=SUMIF('+mr+',"rs",'+sr+')+SUMIF('+mr+',"mat",'+sr+')';
}


/* ============ RESURSLAR ============ */
function _resurslarYig(plusSS){
  var sh=plusSS.getSheetByName(CFG.RESURS); if(sh) plusSS.deleteSheet(sh);
  sh=plusSS.insertSheet(CFG.RESURS);
  var sheets=plusSS.getSheets(), seen={}, order=[], lrvNames=[];
  var col=CFG.C;
  for(var s=0;s<sheets.length;s++){
    var nm=sheets[s].getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    lrvNames.push(nm);
    var shi=sheets[s], last=shi.getLastRow();
    if(last<2) continue;
    var rng=shi.getRange(1,1,last,col.MARKER).getValues();
    for(var i=0;i<rng.length;i++){
      var g=String(rng[i][col.MARKER-1]||'').trim().toLowerCase();
      if(g!=='rs'&&(g !== 'mat' && g !== 'ob') ) continue;
      var nomFull=rng[i][col.NOM-1];
      var bir=rng[i][col.BIRLIK-1];
      var narx=rng[i][col.NARX-1];
      if(!nomFull) continue;
      var key=_norm(nomFull)+'||'+_normBirlik(bir);
      if(!seen[key]){ seen[key]={nom:nomFull,bir:bir,narx:narx}; order.push(key); }
    }
  }
  var hdr=['НОМ','БИРЛИК','НАРХ','ЖАМИ ҲАЖМ','ЖАМИ СУММА'];
  sh.getRange(1,1,1,hdr.length).setValues([hdr])
    .setFontWeight('bold').setBackground('#2e75b5').setFontColor('#ffffff');
  var L=_cl, nomCol=L(col.NOM), birCol=L(col.BIRLIK), fCol=L(col.F), smCol=L(col.SMETA);
  var rows=[];
  for(var i=0;i<order.length;i++){
    var rsc=seen[order[i]], crit='"'+String(rsc.nom).replace(/"/g,'""')+'"';
    var critB='"'+String(rsc.bir||'').replace(/"/g,'""')+'"';
    var hParts=[], sParts=[];
    for(var L2=0;L2<lrvNames.length;L2++){
      var lv=lrvNames[L2];
      hParts.push(_sif2(lv,fCol,nomCol,crit,birCol,critB)+'+'+_sifMat(lv,fCol,nomCol,crit,birCol,critB));
      sParts.push(_sif2(lv,smCol,nomCol,crit,birCol,critB)+'+'+_sifMat(lv,smCol,nomCol,crit,birCol,critB));
    }
    rows.push([rsc.nom, rsc.bir, rsc.narx, '='+hParts.join('+'), '='+sParts.join('+')]);
  }
  if(rows.length) sh.getRange(2,1,rows.length,5).setValues(rows);
  var tot=rows.length+2;
  sh.getRange(tot,1).setValue('ЖАМИ').setFontWeight('bold');
  sh.getRange(tot,4).setFormula('=SUM(D2:D'+(rows.length+1)+')');
  sh.getRange(tot,5).setFormula('=SUM(E2:E'+(rows.length+1)+')');
  sh.getRange(tot,1,1,5).setBackground('#ffe599');
  if(rows.length) sh.getRange(2,3,rows.length+1,3).setNumberFormat('#,##0');
  sh.setFrozenRows(1); sh.autoResizeColumns(1,5);
}
function _sif2(lv,sumCol,nomCol,crit,birCol,critB){
  lv=String(lv||'').replace(/'/g,"''");
  var mc=_cl(CFG.C.MARKER);
  return "SUMIFS('"+lv+"'!"+sumCol+":"+sumCol+",'"+lv+"'!"+nomCol+":"+nomCol+","+crit
        +",'"+lv+"'!"+birCol+":"+birCol+","+critB
        +",'"+lv+"'!"+mc+":"+mc+',"rs")';
}
function _sifMat(lv,sumCol,nomCol,crit,birCol,critB){
  lv=String(lv||'').replace(/'/g,"''");
  var mc=_cl(CFG.C.MARKER);
  return "SUMIFS('"+lv+"'!"+sumCol+":"+sumCol+",'"+lv+"'!"+nomCol+":"+nomCol+","+crit
        +",'"+lv+"'!"+birCol+":"+birCol+","+critB
        +",'"+lv+"'!"+mc+":"+mc+',"mat")';
}


/* ============ NARX LOG ============ */
function _narxLog(plusSS, rows){
  if (!rows || !rows.length) return;
  var sh=plusSS.getSheetByName(CFG.NARX_LOG);
  if(!sh){
    sh=plusSS.insertSheet(CFG.NARX_LOG);
    sh.getRange(1,1,1,8).setValues([['ОБЪЕКТ','ВАРАҚ','ҚАТОР','ТУР','НОМ','БИРЛИК','КОД','ИЗОҲ']])
      .setFontWeight('bold').setBackground('#cc0000').setFontColor('#ffffff');
    sh.setFrozenRows(1); sh.autoResizeColumns(1,8);
  }
  sh.getRange(sh.getLastRow()+1,1,rows.length,8).setValues(rows);
}


/* ============ Yordamchilar ============ */
function _skip(nm){
  var u=String(nm).toUpperCase();
  for(var i=0;i<CFG.SKIP_SHEETS.length;i++) if(u.indexOf(CFG.SKIP_SHEETS[i])>=0) return true;
  return false;
}
function _ochirBoshVaraq(plusSS){
  var sheets=plusSS.getSheets();
  if(sheets.length<=1) return;
  for(var s=0;s<sheets.length;s++){
    var nm=sheets[s].getName();
    if(nm==='Sheet1'||nm==='Лист1'||nm==='Лист 1'){ try{plusSS.deleteSheet(sheets[s]);}catch(e){} return; }
  }
}
function _cl(n){ var s=''; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26; } return s; }
function _toNum(v){
  if(v===''||v===null||v===undefined) return 0;
  if(typeof v==='number') return v;
  var s=String(v).replace(/\s/g,'').replace(/,/g,'.').replace(/[^0-9.\-]/g,'');
  var f=parseFloat(s); return isNaN(f)?0:f;
}

function _oyYigindiFormulalarYangila(sh) {
  var a = sozAsosiy();
  var col = CFG.C;
  var last = sh.getLastRow();
  var start = a.dataQator > 0 ? a.dataQator : _autoData(sh);
  var n = last - start + 1;
  if (n < 1) return;
  
  var marker = sh.getRange(start, col.MARKER, n, 1).getValues();
  var CL = _cl;
  
  var vF2OL = [];
  var vF2MUM = [];
  var vST_F2 = [];
  var vST_OST = [];
  
  for (var i = 0; i < n; i++) {
    var r = start + i;
    var mk = String(marker[i][0] || '').trim().toLowerCase().replace(/\+$/,'');
    if (mk === 'bl' || mk === 'rs' || mk === 'mat' || mk === 'ob') {
      vF2OL.push([_f2sum(r, 0)]);
      vF2MUM.push(['=$' + CL(col.FAKT) + r + '-$' + CL(col.F2OL) + r]);
      vST_F2.push([_f2sum(r, 2)]);
      vST_OST.push(['=$' + CL(col.F2MUM) + r + '*$' + CL(col.NARX) + r]);
    } else {
      vF2OL.push(['']);
      vF2MUM.push(['']);
      vST_F2.push(['']);
      vST_OST.push(['']);
    }
  }
  
  sh.getRange(start, col.F2OL, n, 1).setValues(vF2OL);
  sh.getRange(start, col.F2MUM, n, 1).setValues(vF2MUM);
  sh.getRange(start, col.ST_F2, n, 1).setValues(vST_F2);
  sh.getRange(start, col.ST_OST, n, 1).setValues(vST_OST);
}
