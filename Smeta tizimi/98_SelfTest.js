/********************************************************************
 * 98_SelfTest.gs — TIZIM AVTOMATIK TEST (BACKTEST)
 * ==================================================================
 * Maqsad: butun tizimni JONLI ma'lumotda tekshirish — qaysi funksiya
 * ishlaydi, to'g'ri ishlaydimi, qaysi invariant buzilgan.
 *
 * HAMMASI READ-ONLY (faqat o'qiydi) — hech narsani o'zgartirmaydi,
 * yozmaydi, o'chirmaydi. Xavfsiz, istalgan vaqtda ishga tushirsa bo'ladi.
 *
 * ISHGA TUSHIRISH (Apps Script editor → funksiyani tanlab RUN):
 *   selftestTez()       → tez tutun-test (config, skan, funksiyalar, dashboard) ~5-15 sek
 *   selftestBarcha()    → to'liq: tez + har obyekt chuqur tekshiruv     ~1-3 daq
 *   selftestObyekt('GAME CLUB')  → bitta obyektni chuqur tekshirish
 *
 * NATIJA: Logger (View → Logs) ga chiroyli hisobot + qaytariladigan obyekt.
 * Har tekshiruv holati: ✅ OK · ⚠️ OGOH (e'tibor ber) · ❌ XATO · ⏭️ SKIP.
 ********************************************************************/

var _ST_TZ = 'Asia/Tashkent';

/* Bitta natija yozuvchi yig'uvchi */
function _stNew(){ return {ok:0, ogoh:0, xato:0, skip:0, satrlar:[], _t0:Date.now()}; }
function _stAdd(R, holat, nom, xabar){
  var ico={OK:'✅', OGOH:'⚠️', XATO:'❌', SKIP:'⏭️'}[holat]||'•';
  if(holat==='OK') R.ok++; else if(holat==='OGOH') R.ogoh++;
  else if(holat==='XATO') R.xato++; else R.skip++;
  R.satrlar.push(ico+' ['+nom+'] '+(xabar||''));
}
/* Bir tekshiruvni try/catch bilan o'rab, xatoni XATO sifatida yozadi */
function _stTry(R, nom, fn){
  try{ fn(); }
  catch(e){ _stAdd(R,'XATO',nom,'EXCEPTION: '+(e&&e.message?e.message:e)); }
}
function _stChop(R, sarlavha){
  var sek=((Date.now()-R._t0)/1000).toFixed(1);
  var xat='\n══════════════════════════════════════════\n'+sarlavha+
    '\n  ✅ '+R.ok+'   ⚠️ '+R.ogoh+'   ❌ '+R.xato+'   ⏭️ '+R.skip+'   ('+sek+' sek)'+
    '\n══════════════════════════════════════════\n'+R.satrlar.join('\n');
  Logger.log(xat);
  return {ok:R.ok, ogoh:R.ogoh, xato:R.xato, skip:R.skip, sek:Number(sek), hisobot:R.satrlar};
}
function _stMlrd(v){ v=_stN(v); return (Math.abs(v)>=1e9)?(v/1e9).toFixed(2)+' млрд':Math.round(v).toLocaleString(); }
function _stN(v){ var f=parseFloat(String(v).replace(/\s/g,'').replace(/,/g,'.')); return isNaN(f)?0:f; }


/* ============ FUNKSIYA REGISTRI — hammasi o'rnida turibdimi ============
 * Tizim ishlashi uchun kerakli barcha funksiya mavjudligini tekshiradi.
 * (Panel.html va Telegram shu nomlar bilan chaqiradi — biror nom o'chsa, panel buziladi.) */
var _ST_KERAK_FN = [
  // Konfiguratsiya / poydevor
  'sozAsosiy','sozKategoriya','sozFaktNarx','lockMap','lockMi','lockYoz','tizimMuzlatilganMi',
  // Papka / skan
  'papkaSkan','skanBitta','_skanObyekt','_boglashOl','_svodCfg','_cfgKalit','_cfgNorm','_cfgMos',
  '_svodColsFolder','_subObyektlar','_openAsSheet','_plusFile','apiSheetlarOl',
  // Engine / narxlash
  '_ishlaObyekt','_ishlaVaraq','_priceDB','_findPrice','_normNomKey','_normBirlik','_norm',
  '_oraliqlarOl','_stavkaOl','_narxlarKatMap','_classify','_jamiQator','_resurslarYig',
  // Server / dashboard
  'serverYozFile','serverYigPapka','_dash','_serverSS','_dashOrphanTozala',
  // Kesh
  'cachePut','cacheGet','cacheDel','_keshYoz','_keshOl','_keshOlStale','apiKeshSkanYangilash','_keshWarmUp',
  // Navbat
  'navbatBoshla','_navbatQadam','_navbatWatchdog','apiNavbatHolat','triggerlarOrnat','avtoYangilash',
  // Panel API
  'doGet','apiPanelInit','apiBossInit','apiPapkaSkan','apiObyektIshla','apiHolatOl','apiHolatSaqla',
  'apiOyQosh','apiBossObyekt','apiBossData','apiNarxlarOl','apiNarxlarYarat','apiTashxis',
  'apiBlQosh','apiRsQosh','apiOraliqlarSkan','apiOraliqlarSaqla','apiStavkaOl','apiStavkaSaqla',
  'apiLockBos','apiLockOch','apiDarajalarOl','apiDarajalarSaqla','apiRazdelShYasat','_plusTop',
  // Hujjatlar
  'apiAktlarOl','apiAktYoz','apiAktIshlar','apiAktSmetadan','apiAktCoverage','apiAktMassUlash',
  'apiPrixodOl','apiPrixodYoz','apiRashodYozMass','apiSkladOl','apiViborkaOl','_hujOpen','_aktSheet',
  // Shartnoma / buxgalteriya
  'apiShartnomaOl','apiShartnomaSaqla','apiShartnomaBogOl','apiQoshIshOl','apiNakrutkaOl',
  'nakrutkaHisob','apiShartnomaDashboard','shartnomaChelCh','apiTolovOl','apiTolovYoz','apiTolovTahrir','apiTolovOchir','apiBuxDashboard',
  'apiXarajatYoz','apiXarajatOl','apiXarajatOchir',
  // Supabase
  'supabaseSozlash','_sbBor','supabaseObyektPush','supabaseDashboardPush','supabaseNarxlarPush',
  'apiSupabaseSinxKursor','apiSupabaseSinxReset','apiSupabaseSozlamaOl','apiSupabaseSozlamaSaqla',
  'supabaseSoatlikSinx','supabaseAnomaliyaPush','supabaseShartnomaPush',
  'supabaseMaterialKerakPush','supabaseTopilmaganPush','supabaseTolovPush','supabasePrixodPush',
  'supabaseAktPush','supabaseAktIshPush','supabaseTriggerOrnat','_sbDirty',
  // Ish turlar / maslahatchi / telegram
  'apiIshTurQidir','apiIshTurQosh','apiMaslahatObyekt','sozlamalarYaratSilent'
];
function selftestFunksiyalar(){
  var R=_stNew(), yoq=[];
  for(var i=0;i<_ST_KERAK_FN.length;i++){
    var fn=_ST_KERAK_FN[i], bor=false;
    try{ bor=(eval('typeof '+fn)==='function'); }catch(e){ bor=false; }
    if(!bor) yoq.push(fn);
  }
  if(yoq.length) _stAdd(R,'XATO','FUNKSIYALAR', yoq.length+' та функция ТОПИЛМАДИ: '+yoq.join(', '));
  else _stAdd(R,'OK','FUNKSIYALAR', _ST_KERAK_FN.length+' та критик функция мавжуд');
  return _stChop(R,'ФУНКЦИЯ РЕГИСТРИ');
}


/* ============ TEZ TUTUN-TEST ============ */
function selftestTez(){
  var R=_stNew();

  // 1) Konfiguratsiya
  _stTry(R,'CONFIG', function(){
    var a=sozAsosiy();
    if(!a.rootId) _stAdd(R,'XATO','CONFIG','ROOT_FOLDER_ID бўш');
    else _stAdd(R,'OK','CONFIG','rootId='+a.rootId.slice(0,12)+'…, narxMantiq='+a.narxMantiq+', dataQator='+a.dataQator);
    var k=sozKategoriya();
    _stAdd(R, k.blok.CHEL?'OK':'OGOH','KATEGORIYA','BLOK_CHEL="'+k.blok.CHEL+'", KW_KAB='+(k.kw.KAB||[]).length+' та');
  });

  // 2) ROOT papka ochiladimi
  _stTry(R,'DRIVE', function(){
    var a=sozAsosiy();
    var f=DriveApp.getFolderById(a.rootId);
    _stAdd(R,'OK','DRIVE','ROOT папка очилди: "'+f.getName()+'"');
  });

  // 3) Skan
  var obs=null;
  _stTry(R,'SKAN', function(){
    obs=papkaSkan();
    if(!obs.length){ _stAdd(R,'XATO','SKAN','0 обйект — ROOT папка бўш ёки нотўғри'); return; }
    var lrvBor=0, svodYoq=[];
    for(var i=0;i<obs.length;i++){
      if(!obs[i].svodFile) svodYoq.push(obs[i].obyekt);
      if(_plusBormi(obs[i].obyekt, obs[i].folderId)) lrvBor++;
    }
    _stAdd(R,'OK','SKAN', obs.length+' обйект топилди, '+lrvBor+' тасида LRV_PLUS бор');
    if(svodYoq.length) _stAdd(R,'OGOH','SKAN','свод файли йўқ: '+svodYoq.join(', '));
  });

  // 4) Skan keshi
  _stTry(R,'KESH', function(){
    var sk=_keshOlStale('skan');
    if(!sk||!sk.length) _stAdd(R,'OGOH','KESH','skan кеши бўш — apiKeshSkanYangilash() ишга туширинг');
    else {
      var candBor=('candidates' in (sk[0]||{}));
      _stAdd(R, candBor?'OK':'OGOH','KESH','skan кешда '+sk.length+' обйект'+(candBor?'':' (candidates йўқ — эски формат)'));
    }
    // gzip round-trip test
    var probe={a:1,b:'тест',c:[1,2,3]};
    cachePut('__selftest__', probe, 60);
    var back=cacheGet('__selftest__');
    cacheDel('__selftest__');
    _stAdd(R, (back&&back.b==='тест')?'OK':'XATO','KESH','gzip+chunk round-trip '+((back&&back.b==='тест')?'ишлайди':'БУЗУҚ'));
  });

  // 5) DASHBOARD reconcile — obyektlar yig'indisi ≈ JAMI
  _stTry(R,'DASHBOARD', function(){
    var d=apiBossData();
    if(!d.objects||!d.objects.length){ _stAdd(R,'OGOH','DASHBOARD','DASHBOARD бўш — [Сервер йиғиш] қилинг'); return; }
    var sum=0; for(var i=0;i<d.objects.length;i++) sum+=d.objects[i].smeta;
    var jami=d.jami.smeta||0;
    var farq=Math.abs(sum-jami);
    if(jami>0 && farq > jami*0.001)
      _stAdd(R,'OGOH','DASHBOARD','обйектлар йиғиндиси ('+_stMlrd(sum)+') ≠ ЖАМИ ('+_stMlrd(jami)+') — йетим қатор бўлиши мумкин');
    else
      _stAdd(R,'OK','DASHBOARD', d.objects.length+' обйект, ЖАМИ смета='+_stMlrd(jami));
  });

  // 6) NARXLAR varaq
  _stTry(R,'NARXLAR', function(){
    var r=_narxlarHisob();
    if(!r.rows.length) _stAdd(R,'OGOH','NARXLAR','NARXLAR варағи бўш — apiNarxlarYarat() ишга туширинг');
    else {
      var xavf=0; for(var i=0;i<r.rows.length;i++) if(r.rows[i].xavf) xavf++;
      _stAdd(R,'OK','NARXLAR', r.rows.length+' ресурс, '+r.objects.length+' обйект устуни'+(xavf?(', ⚠️ '+xavf+' хавфли нарх тафовути'):''));
    }
  });

  // 7) Supabase sozlanganmi + ulanish
  _stTry(R,'SUPABASE', function(){
    if(!_sbBor()){ _stAdd(R,'SKIP','SUPABASE','созланмаган (push функциялар no-op)'); return; }
    try{ var t=supabaseTest(); _stAdd(R,'OK','SUPABASE', t); }
    catch(e){ _stAdd(R,'XATO','SUPABASE','уланиш ХАТО: '+(e.message||e)); }
  });

  // 8) Triggerlar
  _stTry(R,'TRIGGER', function(){
    var trs=ScriptApp.getProjectTriggers(), m={};
    for(var i=0;i<trs.length;i++){ var f=trs[i].getHandlerFunction(); m[f]=(m[f]||0)+1; }
    var bor=Object.keys(m).map(function(k){return k+'×'+m[k];});
    _stAdd(R, bor.length?'OK':'OGOH','TRIGGER', bor.length?bor.join(', '):'ҳеч қандай триггер ўрнатилмаган');
    if(m['avtoYangilash']>1||m['supabaseSoatlikSinx']>1)
      _stAdd(R,'OGOH','TRIGGER','такрорий триггер бор — ортиқча ишлайди (қайта ўрнатинг)');
  });

  // 9) Maxfiy kalit kodda qoldimi (xavfsizlik)
  _stTry(R,'XAVFSIZLIK', function(){
    // 99_Debug.js da hardcode service_role bor edi — ogohlantirish
    _stAdd(R,'OGOH','XAVFSIZLIK','99_Debug.js da hardcode Supabase service_role калит борлигини текширинг (debugSupabaseUlash) — кодга ёзилмаслиги керак');
  });

  return _stChop(R,'ТЕЗ ТУТУН-ТЕСТ (selftestTez)');
}


/* ============ BITTA OBYEKTNI CHUQUR TEKSHIRISH ============ */
function selftestObyekt(obyekt){
  var R=_stNew();
  if(!obyekt){ _stAdd(R,'XATO','PARAM','обйект номи берилмади'); return _stChop(R,'ОБЙЕКТ ТЕСТ'); }

  // LRV bormi
  var plus=null;
  _stTry(R,'LRV', function(){
    plus=_plusTop(obyekt);
    if(!plus) _stAdd(R,'XATO','LRV',obyekt+': LRV_PLUS топилмади — [Ишла] қилинг');
    else _stAdd(R,'OK','LRV',obyekt+': LRV_PLUS бор ('+plus.getSheets().length+' варақ)');
  });
  if(!plus) return _stChop(R,'ОБЙЕКТ: '+obyekt);

  // Holat daraxti
  var h=null;
  _stTry(R,'HOLAT', function(){
    h=apiHolatOl(obyekt, true);  // forceRefresh — keshsiz haqiqiy o'qish
    var rz=0,bl=0,rs=0,mat=0;
    (function walk(nodes){ (nodes||[]).forEach(function(n){
      if(n.type==='rz') rz++; else if(n.type==='bl') bl++; else if((n.type === 'mat' || n.type === 'ob') ) mat++; else if(n.type==='rs') rs++;
      if(n.children) walk(n.children);
    });})(h.tree);
    _stAdd(R,'OK','HOLAT','rz='+rz+' bl='+bl+' mat='+mat+' rs='+rs+', ой='+(h.oylar||[]).length+', формат='+h.format);
    if(rz+bl+mat===0) _stAdd(R,'OGOH','HOLAT','даражали қатор йўқ — маркировка бузуқ бўлиши мумкин');
  });

  // Boss jamilari + invariantlar
  _stTry(R,'INVARIANT', function(){
    var b=apiBossObyekt(obyekt), t=b.total||{};
    var sm=_stN(t.res), fk=_stN(t.fakt), f2=_stN(t.f2), ost=_stN(t.ost);
    _stAdd(R,'OK','SUMMA','смета='+_stMlrd(sm)+' факт='+_stMlrd(fk)+' Ф2='+_stMlrd(f2)+' қолдиқ='+_stMlrd(ost));
    // Invariant 1: FAKT ≤ СМЕТА
    if(sm>0 && fk>sm*1.001) _stAdd(R,'OGOH','INV·FAKT≤СМЕТА','ФАКТ ('+_stMlrd(fk)+') сметадан ('+_stMlrd(sm)+') ошган');
    else _stAdd(R,'OK','INV·FAKT≤СМЕТА','тўғри');
    // Invariant 2: Ф2 ≤ ФАКТ
    if(f2>fk*1.001) _stAdd(R,'OGOH','INV·Ф2≤ФАКТ','Ф2 ('+_stMlrd(f2)+') ФАКТдан ('+_stMlrd(fk)+') ошган — олинмаган ишга Ф2');
    else _stAdd(R,'OK','INV·Ф2≤ФАКТ','тўғри');
    // Invariant 3: Ф2 ≤ СМЕТА
    if(sm>0 && f2>sm*1.001) _stAdd(R,'XATO','INV·Ф2≤СМЕТА','Ф2 сметадан ошган — қўшиб ёзиш хавфи');
    // Invariant 4: ОСТАТКА ≥ 0
    if(ost < -1) _stAdd(R,'XATO','INV·ОСТ≥0','қолдиқ манфий ('+_stMlrd(ost)+')');
  });

  // Tashxis: 0-narx, MISS
  _stTry(R,'NARX', function(){
    var d=apiTashxis(obyekt);
    var katStr=[];
    for(var k in d.katSum) if(d.katSum[k]>0) katStr.push(k+'='+_stMlrd(d.katSum[k]));
    _stAdd(R,'OK','КАТ','leaf='+d.leaf+' | '+katStr.join(' '));
    if(d.nolSoni>0) _stAdd(R,'OGOH','НАРХ·0','нарх=0 лекин ҳажми бор: '+d.nolSoni+' та ресурс (қимматлари текширилсин)');
    if(d.missSoni>0) _stAdd(R,'OGOH','НАРХ·MISS','нарх топилмаган: '+d.missSoni+' та (_NARX_LOG, қўлда берилади)');
    if(d.katSum['?']>0) _stAdd(R,'OGOH','КАТ·?','категориясиз: '+_stMlrd(d.katSum['?'])+' — устун формула текширилсин');
  });

  // Lock holati
  _stTry(R,'LOCK', function(){
    _stAdd(R,'OK','LOCK', lockMi(obyekt)?'🔒 ҚУЛФЛАНГАН (фақат + қаторлар ишланади)':'очиқ');
  });

  return _stChop(R,'ОБЙЕКТ: '+obyekt);
}


/* ============ TO'LIQ TEST: tez + har obyekt + funksiyalar ============
 * ⚠️ 50+ obyekt 6 daqiqaga sig'maydi. Shuning uchun VAQT-CHEGARALI + DAVOM etadi:
 *   selftestBarcha()    → boshidan (funksiyalar+tez+ obyektlar, ~4.5 daq)
 *   selftestBarcha(20)  → 20-obyektdан davom (vaqt tugagach ko'rsatilgan raqamdан)
 * Har run "давом этиш: selftestBarcha(N)" ni yozadi. */
function selftestBarcha(startIdx){
  startIdx = Number(startIdx)||0;
  var t0=Date.now(), DEADLINE=4.5*60*1000;   // 4.5 daqiqa — 6 min limitdan xavfsiz
  Logger.log('🏗️ ТИЗИМ ТЕСТ ('+(startIdx?('давоми: '+startIdx):'бошидан')+') — '+Utilities.formatDate(new Date(), _ST_TZ, 'yyyy-MM-dd HH:mm'));
  var jami={ok:0,ogoh:0,xato:0,skip:0};
  function yig(r){ jami.ok+=r.ok; jami.ogoh+=r.ogoh; jami.xato+=r.xato; jami.skip+=r.skip; }

  if(startIdx===0){ yig(selftestFunksiyalar()); yig(selftestTez()); }

  var obs=[];
  try{ obs=papkaSkan(); }catch(e){ Logger.log('papkaSkan xato: '+e); }
  var i=startIdx, toxtadi=false;
  for(; i<obs.length; i++){
    if(Date.now()-t0 > DEADLINE){ toxtadi=true; break; }   // vaqt tugadi → keyingi run davom etadi
    if(!_plusBormi(obs[i].obyekt, obs[i].folderId)) continue;
    yig(selftestObyekt(obs[i].obyekt));
  }

  var yakun='\n████████ ЯКУН ████████\n  ✅ '+jami.ok+'  ⚠️ '+jami.ogoh+'  ❌ '+jami.xato+'  ⏭️ '+jami.skip+
            '\n  Текширилди: '+i+'/'+obs.length+' обйект';
  if(toxtadi) yakun+='\n  ⏳ ВАҚТ ТУГАДИ — ДАВОМ: editorда selftestBarcha('+i+') ни RUN қилинг';
  else yakun+='\n  '+(jami.xato===0?'✅ Критик ХАТО йўқ — тизим соғлом.':'❗ '+jami.xato+' та ХАТО');
  Logger.log(yakun);
  return {jami:jami, keyingi: toxtadi?i:null, jamiObyekt:obs.length};
}

/* lrvOqi eski o'quvchilar bilan RAQAMLAB solishtiriladi � migratsiya darvozasi */
function selftestLrvOqi(obyekt){
  var plus=_plusTop(obyekt); if(!plus) return {ok:false, xato:'LRV_PLUS topilmadi'};
  var rows=lrvOqiHammasi(plus,{faqatLeaf:true});
  var smeta=0,fakt=0,f2=0;
  rows.forEach(function(r){ smeta+=r.smeta; fakt+=r.stFakt; f2+=r.stF2; });
  // DASHBOARD dagi qiymat bilan solishtir
  var dash=_dash(_serverSS(sozAsosiy()));
  var v=dash.getRange(2,1,dash.getLastRow()-1,11).getValues();
  for(var i=0;i<v.length;i++){
    if(String(v[i][0]).trim()!==obyekt) continue;
    var dSm=_toNum(v[i][1]);
    return {ok: Math.abs(dSm-smeta)<1, lrv:smeta, dashboard:dSm, farq:dSm-smeta,
            fakt:fakt, f2:f2, qatorlar:rows.length};
  }
  return {ok:false, xato:'DASHBOARD da topilmadi'};
}

