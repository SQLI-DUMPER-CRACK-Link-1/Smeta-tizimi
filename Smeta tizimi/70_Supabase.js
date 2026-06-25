/********************************************************************
 * 70_Supabase.gs — GAS → SUPABASE MIRROR (bir tomonlama)
 * ==================================================================
 * GAS hisoblaydi (Sheets formulalari) → natijani Supabase (Postgres)
 * ga ko'chiradi. Frontend Supabase'dan tez/realtime o'qiydi.
 *
 * GAS da SDK yo'q → UrlFetchApp orqali PostgREST (REST) chaqiriladi.
 * Yozish service_role kalit bilan (maxfiy, faqat serverda).
 *
 * Sozlash (bir marta):
 *   1) Supabase loyiha → SQL Editor → supabase_schema.sql ni RUN
 *   2) Settings → API → Project URL va service_role key ni nusxa ol
 *   3) Apps Script editor → Run:
 *        supabaseSozlash('https://xxxx.supabase.co', 'service_role_key')
 *        supabaseTest()        // ulanishni tekshir
 *        supabaseToliqSinx()   // hammasini birinchi marta yuklaydi
 *
 * Asosiy funksiyalar:
 *   supabaseObyektPush(ob)   → bitta obyekt (dashboard + holat + oylar)
 *   supabaseDashboardPush()  → barcha obyektlar dashboard qatori
 *   supabaseNarxlarPush()    → NARXLAR varaqi
 *   supabaseTarixYoz(ob,..)  → FAKT/Ф2 o'zgarish jurnali
 *   supabaseToliqSinx()      → hammasini to'liq qayta yuklash
 *
 * MUHIM: Supabase sozlanmagan bo'lsa barcha push funksiyalar JIM
 * (no-op) ishlaydi → tizimga hech qanday ta'sir yo'q.
 ********************************************************************/

/* ============ SOZLAMA ============ */
function supabaseSozlash(url, serviceKey){
  if(!url || String(url).indexOf('https://')!==0) throw 'URL https:// bilan boshlanishi kerak';
  if(!serviceKey) throw 'service_role key kiriting (Settings → API)';
  var p=PropertiesService.getScriptProperties();
  p.setProperty('SUPABASE_URL', String(url).trim().replace(/\/+$/,''));
  p.setProperty('SUPABASE_KEY', String(serviceKey).trim());
  return 'Supabase sozlandi: '+url;
}
function _sbCfg(){
  var p=PropertiesService.getScriptProperties();
  var url=p.getProperty('SUPABASE_URL'), key=p.getProperty('SUPABASE_KEY');
  return (url&&key)?{url:url, key:key}:null;
}
function _sbBor(){ return !!_sbCfg(); }


/* ============ PAST-DARAJA REST ============ */
// upsert: onConflict berilsa merge-duplicates, aks holda oddiy insert
function _sbYoz(table, rows, onConflict){
  var c=_sbCfg(); if(!c || !rows || !rows.length) return;
  var base=c.url+'/rest/v1/'+table+(onConflict?('?on_conflict='+encodeURIComponent(onConflict)):'');
  var headers={
    'apikey':c.key, 'Authorization':'Bearer '+c.key,
    'Content-Type':'application/json',
    'Prefer': onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
  };
  for(var i=0;i<rows.length;i+=1000){                 // 1000 qatorlik bo'laklar
    var chunk=rows.slice(i,i+1000);
    var resp=UrlFetchApp.fetch(base,{method:'post',headers:headers,
      payload:JSON.stringify(chunk), muteHttpExceptions:true});
    var code=resp.getResponseCode();
    if(code>=300) throw 'Supabase '+table+' xato ('+code+'): '+resp.getContentText().slice(0,300);
  }
}
function _sbOchir(table, filter){                      // filter: "obyekt=eq.NAME"
  var c=_sbCfg(); if(!c) return;
  UrlFetchApp.fetch(c.url+'/rest/v1/'+table+'?'+filter, {method:'delete',
    headers:{'apikey':c.key,'Authorization':'Bearer '+c.key,'Prefer':'return=minimal'},
    muteHttpExceptions:true});
}
function _sbISO(){ return new Date().toISOString(); }


/* ============ BITTA OBYEKT (dashboard + holat + oylar) ============ */
function supabaseObyektPush(obyekt){
  if(!_sbBor() || !obyekt) return;
  // 1) Dashboard qatori — apiBossObyekt (kategoriya jamilari) + shartnoma bog'lanishi
  var b=apiBossObyekt(obyekt), t=b.total||{}, cats=b.cats||{};
  function cr(k){ return (cats[k]&&cats[k].res)||0; }
  var bogMap=_sbBogMap();                               // obyekt → shartnoma_no
  _sbYoz('obyektlar',[{
    nom:obyekt, locked:!!b.locked,
    smeta:t.res||0, fakt:t.fakt||0, f2:t.f2||0, qoldiq:t.ost||0,
    progress:t.progress||0, f2pct:t.f2pct||0,
    chel:cr('ЧЕЛ'), mash:cr('МАШ'), mat:cr('МАТ'), ob:cr('ОБ'), mk:cr('М/К'),
    // КАБ apiBossObyekt cats'da yo'q → bu yerda yozMAYMIZ (dashboard push kab ni to'g'ri beradi,
    // upsert update'da bu ustun tegilmaydi → dashboard qiymati saqlanadi)
    shartnoma_no: _sbShNo(bogMap, obyekt),
    sana:Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd HH:mm'),
    updated_at:_sbISO()
  }],'nom');

  // 2) Oylik Ф2
  var oyRows=(b.oylar||[]).map(function(o){return {obyekt:obyekt,oy:o.oy,qiymat:o.val||0};});
  if(oyRows.length) _sbYoz('oylik_f2', oyRows, 'obyekt,oy');

  // 3) Holat qatorlari (bl/mat/rs) — apiHolatOl daraxtidan tekislaymiz
  var h=apiHolatOl(obyekt), hrows=[];
  (function walk(nodes, razdel){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'){ walk(n.children, n.nom); return; }
      if(n.type==='bl'||(n.type === 'mat' || n.type === 'ob') ){
        hrows.push({obyekt:obyekt,varaq:n.varaq,qator:n.row,tur:n.type,
          nom:n.nom,birlik:n.birlik||'',smeta_hajm:n.smetaHajm||0,
          fakt:n.fakt||0,f2ol:n.f2ol||0,qoldiq:n.qoldiq||0,
          smeta_pul:n.smeta||0,st_fakt:n.stFakt||0,st_f2:n.stF2||0,
          kategoriya:'', razdel:razdel||'', updated_at:_sbISO()});
        walk(n.children, razdel);
      } else if(n.type==='rs'){
        // rs node'da narx YO'Q → birlik narxi = resurs summasi / hajm (ST_RES / E)
        var birNarx=(n.smetaHajm>0)?(_toNum(n.smeta)/n.smetaHajm):0;
        hrows.push({obyekt:obyekt,varaq:n.varaq,qator:n.row,tur:'rs',
          nom:n.nom,birlik:n.birlik||'',smeta_hajm:n.smetaHajm||0,
          fakt:n.fakt||0,qoldiq:n.qoldiq||0,narx:birNarx,
          smeta_pul:n.smeta||0,st_fakt:n.stFakt||0,st_f2:n.stF2||0,
          kategoriya:n.kat||'', razdel:razdel||'', updated_at:_sbISO()});
      }
    });
  })(h.tree, '');
  // Eski qatorlarni o'chirib qayta yozamiz (o'chirilgan qatorlar ham tozalanadi)
  _sbOchir('holat','obyekt=eq.'+encodeURIComponent(obyekt));
  if(hrows.length) _sbYoz('holat', hrows);
}

/* obyekt → shartnoma_no bog'lanish xaritasi (SOZLAMALAR_ШАРТНОМА_БОГ) */
function _sbBogMap(){
  try{ return (typeof apiShartnomaBogOl==='function') ? (apiShartnomaBogOl()||{}) : {}; }
  catch(e){ return {}; }
}
/* Obyekt → shartnoma_no. Split obyekt (papka-lokalka) bo'lsa, papka bog'lanishini ham
 * tekshiradi (foydalanuvchi odatda papkani dogovorga bog'laydi). */
function _sbShNo(bogMap, obyekt){
  if(bogMap[obyekt]) return bogMap[obyekt];
  if(typeof _cfgKalit==='function'){ var k=_cfgKalit(obyekt); if(bogMap[k]) return bogMap[k]; }
  return '';
}


/* ============ BARCHA DASHBOARD ============ */
function supabaseDashboardPush(){
  if(!_sbBor()) return;
  var d=apiBossData(), bogMap=_sbBogMap();
  var rows=(d.objects||[]).map(function(o){
    return {nom:o.nom, smeta:o.smeta, chel:o.chel, mash:o.mash, mat:o.mat,
            ob:o.ob, mk:o.mk, kab:o.kab, fakt:o.fakt, f2:o.f2, qoldiq:o.qoldiq,
            progress:o.progress, f2pct:o.f2pct, shartnoma_no:_sbShNo(bogMap, o.nom),
            sana:o.sana, updated_at:_sbISO()};
  });
  if(rows.length) _sbYoz('obyektlar', rows, 'nom');
}


/* ============ NARXLAR ============ */
function supabaseNarxlarPush(){
  if(!_sbBor()) return;
  var r=_narxlarHisob();
  var rows=(r.rows||[]).map(function(x){
    return {nom:x.nom, birlik:x.birlik, kat:x.kat,
            belgilangan:x.belgilangan||0, smeta_max:x.max||0, tizim:x.natija||0,
            updated_at:_sbISO()};
  });
  if(rows.length) _sbYoz('narxlar', rows, 'nom,birlik');
}


/* ============ TARIX (FAKT/Ф2 o'zgarish jurnali) ============ */
// edits = [{varaq,row,fakt,oylar:{oyNom:qiymat}}]  (apiHolatSaqla formati)
function supabaseTarixYoz(obyekt, edits, kim){
  if(!_sbBor() || !edits || !edits.length) return;
  var rows=[];
  edits.forEach(function(e){
    if(e.fakt!==undefined && e.fakt!==null)
      rows.push({obyekt:obyekt,varaq:e.varaq,qator:e.row,tur:'fakt',
                 qiymat:_toNum(e.fakt),kim:kim||''});
    if(e.oylar) for(var oy in e.oylar)
      rows.push({obyekt:obyekt,varaq:e.varaq,qator:e.row,tur:oy,
                 qiymat:_toNum(e.oylar[oy]),kim:kim||''});
  });
  if(rows.length) _sbYoz('tarix', rows);
}


/* ============ TO'LIQ SINXRON (birinchi yuklash / qo'lda) ============ */
function supabaseToliqSinx(){
  if (typeof tizimMuzlatilganMi === 'function' && tizimMuzlatilganMi()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Supabase to\'liq sinxronizatsiya bajarilmadi.');
    return {ok:false, sabab:'Tizim to\'xtatilgan (PAUSED)'};
  }
  if(!_sbBor()) throw 'Avval: supabaseSozlash(url, key)';
  var t0=Date.now(), log=[];
  try{ supabaseDashboardPush(); log.push('✓ dashboard'); }
  catch(e){ log.push('✗ dashboard: '+(e.message||e)); }

  var obs=papkaSkan();
  for(var i=0;i<obs.length;i++){
    try{
      if(_plusBormi(obs[i].obyekt, obs[i].folderId)){
        supabaseObyektPush(obs[i].obyekt);
        log.push('✓ '+obs[i].obyekt);
      }
    }catch(e){ log.push('✗ '+obs[i].obyekt+': '+(e.message||e)); }
  }
  for(var k=0;k<obs.length;k++){
    try{
      if(_plusBormi(obs[k].obyekt, obs[k].folderId)){
        supabaseMaterialKerakPush(obs[k].obyekt);
        supabaseTopilmaganPush(obs[k].obyekt);
        supabaseAnomaliyaPush(obs[k].obyekt);
      }
    }catch(e){ log.push('✗ mat/miss '+obs[k].obyekt+': '+(e.message||e)); }
  }
  try{ supabaseNarxlarPush();   log.push('✓ narxlar'); }
  catch(e){ log.push('✗ narxlar: '+(e.message||e)); }
  try{ supabaseTolovPush();     log.push('✓ tolovlar'); }
  catch(e){ log.push('✗ tolovlar: '+(e.message||e)); }
  try{ supabaseShartnomaPush(); log.push('✓ shartnoma+bux'); }
  catch(e){ log.push('✗ shartnoma: '+(e.message||e)); }
  try{ supabasePrixodPush();    log.push('✓ prixod'); }
  catch(e){ log.push('✗ prixod: '+(e.message||e)); }
  try{ supabaseAktIshPush();    log.push('✓ akt_ish'); }
  catch(e){ log.push('✗ akt_ish: '+(e.message||e)); }

  _sbDirtyTozala();                                   // to'liq sinx → dirty bayroqlar tozalandi
  var sek=Math.round((Date.now()-t0)/1000);
  var xabar=log.join('\n')+'\n\nJami: '+sek+' sek';
  try{ SpreadsheetApp.getUi().alert('SUPABASE SINXRON\n\n'+xabar); }catch(e){}
  return {ok:true, sek:sek, log:log};
}


/* ============ ULANISH TESTI ============ */
function supabaseTest(){
  var c=_sbCfg(); if(!c) throw 'Avval: supabaseSozlash(url, key)';
  var resp=UrlFetchApp.fetch(c.url+'/rest/v1/obyektlar?select=nom&limit=1',
    {headers:{'apikey':c.key,'Authorization':'Bearer '+c.key}, muteHttpExceptions:true});
  var code=resp.getResponseCode();
  Logger.log('Supabase status: '+code+'  body: '+resp.getContentText());
  if(code>=300) throw 'Ulanish xato ('+code+'): '+resp.getContentText().slice(0,300);
  return 'OK ('+code+') — ulanish ishlayapti';
}


/* ============ MATERIAL_KERAK (Smeta mustaqil — har obyekt material ehtiyoji) ============ */
// ⚠️ Viborka bilan ulanmaydi (nomlar har xil). material_key faqat Smeta ichida.
function supabaseMaterialKerakPush(obyekt){
  if(!_sbBor() || !obyekt) return;
  var h=apiHolatOl(obyekt), agg={};
  (function walk(nodes){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'||n.type==='bl'||(n.type === 'mat' || n.type === 'ob') ){ if(n.children) walk(n.children); }
      if(n.type==='rs'||(n.type === 'mat' || n.type === 'ob') ){
        // FAQAT MATERIAL — ish haqi (ЧЕЛ/МАШ) material emas, chiqaramiz
        var kat=(n.kat||'').toUpperCase();
        if(kat==='ЧЕЛ' || kat==='МАШ') return;
        var hajm=_toNum(n.smetaHajm); if(!hajm) return;
        // rs narxi node'da yo'q → birlik narxi = ST_RES summa / hajm
        var birNarx=(hajm>0)?(_toNum(n.smeta)/hajm):0;
        var key=_normNomKey(n.nom||'')+'||'+_normBirlik(n.birlik||'');
        if(!agg[key]) agg[key]={obyekt:obyekt, material_key:key, nom:n.nom||'',
          birlik:n.birlik||'', kat:(n.kat||'МАТ'), kerak_hajm:0, narx:birNarx, updated_at:_sbISO()};
        agg[key].kerak_hajm += hajm;
        if(!agg[key].narx && birNarx) agg[key].narx=birNarx;
      }
    });
  })(h.tree);
  var rows=[]; for(var k in agg) rows.push(agg[k]);
  _sbOchir('material_kerak','obyekt=eq.'+encodeURIComponent(obyekt));
  if(rows.length) _sbYoz('material_kerak', rows, 'obyekt,material_key');
}


/* ============ TOPILMAGANLAR (narx topilmagan — _NARX_LOG) ============ */
function supabaseTopilmaganPush(obyekt){
  if(!_sbBor() || !obyekt) return;
  var plus=_plusTop(obyekt); if(!plus) return;
  _sbOchir('topilmaganlar','obyekt=eq.'+encodeURIComponent(obyekt));
  var sh=plus.getSheetByName(CFG.NARX_LOG); if(!sh || sh.getLastRow()<2) return;
  // _NARX_LOG: ОБЪЕКТ|ВАРАҚ|ҚАТОР|ТУР|НОМ|БИРЛИК|КОД|ИЗОҲ
  var v=sh.getRange(2,1,sh.getLastRow()-1,8).getValues(), rows=[];
  for(var i=0;i<v.length;i++){
    if(!String(v[i][4]||'').trim()) continue;
    rows.push({obyekt:obyekt, varaq:String(v[i][1]||''), qator:_toNum(v[i][2])||null,
      tur:String(v[i][3]||''), nom:String(v[i][4]||''), birlik:String(v[i][5]||''),
      kod:String(v[i][6]||''), updated_at:_sbISO()});
  }
  if(rows.length) _sbYoz('topilmaganlar', rows);
}


/* ============ SHARTNOMA + BUXGALTERIYA (dogovor rollup + moliyaviy nazorat) ============ */
function supabaseShartnomaPush(){
  if(!_sbBor() || typeof apiShartnomaDashboard!=='function') return;
  var d=apiShartnomaDashboard(), rows=[], anom=[];
  var ty=(typeof _tolovYigindi==='function')?_tolovYigindi():{};   // to'lovlar yig'indisi
  (d.shartnomalar||[]).forEach(function(g){
    if(g.no==='—') return;                             // biriktirilmaganlar reestrda emas
    var m=g.meta||{}, nk=g.nakrutka||{};
    var dog=_toNum(m.jami)||_toNum(g.jamiSmeta);       // shartnoma summasi (НДС bilan)
    var f2=_toNum(g.jamiF2);                            // bajarilgan (КС-2 asosi)
    var tl=(ty[g.no]&&ty[g.no].tolangan)||0;           // to'langan pul
    var qoldiq=dog-f2, pct=dog>0?Math.round(f2/dog*100):0, debitor=f2-tl;
    rows.push({no:String(g.no), nomi:m.nomi||'', taraf:m.taraf||'',
      smeta:_toNum(g.jamiSmeta), fakt:_toNum(g.jamiFakt), f2:f2,
      nakrutka_vsego:_toNum(nk.vsego||nk.ВСЕГО||nk.itogo||0),
      nds:_toNum(m.nds), dog_summa:dog, qoldiq:qoldiq, bajarilgan_pct:pct,
      tolangan:tl, debitor:debitor,
      holat:m.holat||'', updated_at:_sbISO()});
    var sn='ШАРТНОМА '+g.no;
    // BUXGALTERIYA NAZORATI 1 — КС-2 shartnoma summasidan oshmasligi (overbilling)
    if(dog>0 && f2 > dog*1.001)
      anom.push({id:sn+'||KS2>DOGOVOR', obyekt:sn, qoida:'KS2>DOGOVOR',
        tavsif:'Бажарилган Ф2/КС-2 ('+_sbMlrd(f2)+') шартнома суммаси ('+_sbMlrd(dog)+') дан ошган',
        qiymat:Math.round(f2-dog), daraja:'kritik', hal:false, sana:_sbISO()});
    // BUXGALTERIYA NAZORATI 2 — to'lov shartnoma summasidan oshmasligi (ortiqcha to'lov)
    if(dog>0 && tl > dog*1.001)
      anom.push({id:sn+'||TOLOV>DOGOVOR', obyekt:sn, qoida:'TOLOV>DOGOVOR',
        tavsif:'Тўланган ('+_sbMlrd(tl)+') шартнома суммаси ('+_sbMlrd(dog)+') дан ошган',
        qiymat:Math.round(tl-dog), daraja:'kritik', hal:false, sana:_sbISO()});
    // BUXGALTERIYA NAZORATI 3 — to'lov bajarilgan ishdan oshsa (avans nazorati, ogohlantirish)
    if(f2>0 && tl > f2*1.05)
      anom.push({id:sn+'||TOLOV>BAJARILGAN', obyekt:sn, qoida:'TOLOV>BAJARILGAN',
        tavsif:'Тўланган ('+_sbMlrd(tl)+') бажарилган Ф2 ('+_sbMlrd(f2)+') дан ошган — аванс',
        qiymat:Math.round(tl-f2), daraja:'ogohlantirish', hal:false, sana:_sbISO()});
  });
  if(rows.length) _sbYoz('shartnoma', rows, 'no');
  // Shartnoma darajasidagi buxgalteriya anomaliyalari (har push qayta yoziladi).
  // Har qoidani alohida + kodlangan o'chiramiz (> belgisi URL uchun xavfsiz bo'lsin).
  ['KS2>DOGOVOR','TOLOV>DOGOVOR','TOLOV>BAJARILGAN'].forEach(function(q){
    _sbOchir('anomaliya','qoida=eq.'+encodeURIComponent(q));
  });
  if(anom.length) _sbYoz('anomaliya', anom, 'id');
}


/* ============ TO'LOVLAR (pul harakati ledger — buxgalteriya) ============ */
function supabaseTolovPush(){
  if(!_sbBor() || typeof apiTolovOl!=='function') return;
  var t=apiTolovOl();
  var rows=t.map(function(r){
    return {id:'r'+(r.row||0), sana:r.sana||'', shartnoma_no:r.shNo||'', obyekt:r.obyekt||'',
      summa:_toNum(r.summa), tur:r.tur||'Тўлов', izoh:r.izoh||'', updated_at:_sbISO()};
  });
  _sbOchir('tolovlar','id=neq.__yoq__');               // to'liq qayta yozish
  if(rows.length) _sbYoz('tolovlar', rows, 'id');
}


/* ============ PRIXOD (kelgan material ledger — tashqi Prixod Sheet) ============ */
function supabasePrixodPush(){
  if(!_sbBor() || typeof apiPrixodOl!=='function') return;
  var d=apiSkladOl(''); // Barcha materiallar uchun Sklad Ostatka olish ham mumkin, lekin Prixod jadvalini alohida push qilamiz
  var p=apiPrixodOl(0);                                 // limit yo'q → hammasi
  var rows=(p.rows||[]).map(function(r){
    return {id:'r'+(r.row||0), nom:r.nom||'', razdel:r.razdel||'', birlik:r.birlik||'',
      hajm:_toNum(r.hajm), narx:_toNum(r.narx), summa:_toNum(r.hajm)*_toNum(r.narx),
      ostatka:_toNum(r.ostatka), sana:r.sana||'', postavshik:r.postavshik||'', obyekt:r.obyekt||'', updated_at:_sbISO()};
  });
  _sbOchir('prixod','id=neq.__yoq__');                 // to'liq qayta yozish (ledger holati)
  if(rows.length) _sbYoz('prixod', rows, 'id');

  // Rashod push
  var ss=_hujOpen('prixod');
  var shR=ss.getSheetByName('Rashod');
  if(shR && shR.getLastRow()>=2){
    var vR = shR.getRange(2,1,shR.getLastRow()-1,Math.max(shR.getLastColumn(),8)).getValues();
    var rRows = vR.map(function(r, i){
      return {
        id:'r'+(i+2), nom:String(r[1]||''), birlik:String(r[2]||''),
        hajm:_toNum(r[3]), sana:String(r[4]||''), obyekt:String(r[5]||''),
        ish:String(r[6]||''), izoh:String(r[7]||''), updated_at:_sbISO()
      };
    }).filter(function(x){ return x.nom; });
    _sbOchir('rashod','id=neq.__yoq__');
    if(rRows.length) _sbYoz('rashod', rRows, 'id');
  }
}


/* ============ ANOMALIYA SKANERI (nazorat invariantlari — B5.1) ============ */
// Har obyekt uchun smeta↔fakt↔Ф2↔ostatka invariantlarini tekshiradi.
// Buzilgan qoidalar `anomaliya` jadvaliga (obyekt bo'yicha qayta yoziladi → hal bo'lgan yo'qoladi).
function supabaseAnomaliyaPush(obyekt){
  if(!_sbBor() || !obyekt) return;
  var an=[];
  function qosh(qoida, tavsif, qiymat, daraja){
    an.push({id:obyekt+'||'+qoida, obyekt:obyekt, qoida:qoida, tavsif:tavsif,
      qiymat:Math.round(_toNum(qiymat)), daraja:daraja, hal:false, sana:_sbISO()});
  }
  // 1) OBYEKT DARAJASI — apiBossObyekt jamilari (smeta/fakt/f2/ostatka)
  try{
    var b=apiBossObyekt(obyekt), t=b.total||{};
    var sm=_toNum(t.res), fk=_toNum(t.fakt), f2=_toNum(t.f2), ost=_toNum(t.ost);
    if(sm>0 && f2 > sm*1.001)
      qosh('F2>SMETA', 'Ф2 ('+_sbMlrd(f2)+') смета ('+_sbMlrd(sm)+') дан ошган', f2-sm, 'kritik');
    if(sm>0 && fk > sm*1.001)
      qosh('FAKT>SMETA', 'ФАКТ ('+_sbMlrd(fk)+') смета ('+_sbMlrd(sm)+') дан ошган', fk-sm, 'xato');
    if(f2 > fk*1.001)
      qosh('F2>FAKT', 'Ф2 ('+_sbMlrd(f2)+') ФАКТ ('+_sbMlrd(fk)+') дан ошган — олинмаган ишга Ф2', f2-fk, 'xato');
    if(ost < -1)
      qosh('OSTATKA<0', 'Қолдиқ манфий ('+_sbMlrd(ost)+') — смета ошиб кетган', ost, 'xato');
  }catch(e){}

  // 2) QATOR DARAJASI — holat daraxti (hajm invariantlari, jamlangan)
  try{
    var h=apiHolatOl(obyekt), faktOsh=0, f2Osh=0;
    (function walk(nodes){
      (nodes||[]).forEach(function(n){
        if(n.children) walk(n.children);
        if(n.type==='rs'||(n.type === 'mat' || n.type === 'ob') ||n.type==='bl'){
          var s=_toNum(n.smetaHajm), fa=_toNum(n.fakt), fo=_toNum(n.f2ol);
          if(s>0 && fa>s*1.01) faktOsh++;
          if(fa>0 && fo>fa*1.01) f2Osh++;
        }
      });
    })(h.tree);
    if(faktOsh>0) qosh('QATOR_FAKT>SMETA', faktOsh+' та қаторда ФАКТ ҳажм сметадан ошган', faktOsh, 'ogohlantirish');
    if(f2Osh>0)   qosh('QATOR_F2>FAKT', f2Osh+' та қаторда Ф2 ҳажм ФАКТдан ошган', f2Osh, 'ogohlantirish');
  }catch(e){}

  // 3) NARX TOPILMAGAN (MISS) soni
  try{
    var plus=_plusTop(obyekt), logSh=plus&&plus.getSheetByName(CFG.NARX_LOG);
    if(logSh && logSh.getLastRow()>1)
      qosh('NARX_TOPILMAGAN', (logSh.getLastRow()-1)+' та ресурс нархи топилмаган (қўлда берилиши керак)',
        logSh.getLastRow()-1, 'ogohlantirish');
  }catch(e){}

  // 4) YASHIRIN AKT YO'QLIGI (YASHIRIN_AKT_YOQ)
  try {
    var cov = apiAktCoverage(obyekt);
    if(cov && cov.stats && cov.stats.yashirinAktsiz > 0){
      qosh('YASHIRIN_AKT_YOQ', cov.stats.yashirinAktsiz+' та яширин ишда акт йўқ (ФАКТ>0)',
        cov.stats.yashirinAktsiz, 'ogohlantirish');
    }
  } catch(e) {}

  // Obyekt bo'yicha qayta yozish — hal bo'lgan anomaliyalar yo'qoladi
  _sbOchir('anomaliya','obyekt=eq.'+encodeURIComponent(obyekt));
  if(an.length) _sbYoz('anomaliya', an, 'id');
  return an.length;
}
function _sbMlrd(v){ v=_toNum(v); return (Math.abs(v)>=1e9)?(v/1e9).toFixed(2)+' млрд':Math.round(v).toLocaleString(); }


/* ============ AKT_ISH BOG'LANISH JADVALI (N:M MIRROR) ============ */
// REYESTR dagi SMETA_REF ustunini (obyekt||KOD yoki obyekt||nomKey) split qilib,
// akt_ish jadvaliga yozamiz. Akt jadvali o'zi Akt generator/Supabase.js dan push qilinadi.
function supabaseAktIshPush(){
  if(!_sbBor()) return;
  try {
    var ss=_hujOpen('akt'), sh=_aktSheet(ss);
    if(sh.getLastRow()<2) return;
    var lastC=sh.getLastColumn();
    var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
    var ci={ id:hdr.indexOf('ACT_ID'), obj:hdr.indexOf('OBJECT_NAME'), ref:hdr.indexOf('SMETA_REF') };
    if(ci.id<0 || ci.obj<0 || ci.ref<0) return;
    
    var v=sh.getRange(2,1,sh.getLastRow()-1,lastC).getValues();
    var rows=[];
    for(var i=0;i<v.length;i++){
      var actId = String(v[i][ci.id]||'').trim();
      var obj = String(v[i][ci.obj]||'').trim();
      var refsStr = String(v[i][ci.ref]||'').trim();
      if(!actId || !refsStr) continue;
      
      var refs = refsStr.split(';');
      for(var k=0;k<refs.length;k++){
        var r = refs[k].trim();
        if(r) {
          rows.push({
            id: actId + '||' + r,
            act_id: actId,
            obyekt: obj,
            work_key: r,
            updated_at: _sbISO()
          });
        }
      }
    }
    // To'liq qayta yozish:
    _sbOchir('akt_ish', 'id=neq.__yoq__');
    if(rows.length) _sbYoz('akt_ish', rows, 'id');
  } catch(e) { Logger.log('akt_ish push xatosi: '+e); }
}

/* ============ DIRTY-TRACKING (o'zgargan obyektlar — Script Property) ============ */
// _holatInvalidate har o'zgarishda obyektni "dirty" qiladi → soatlik sinx faqat shularni push qiladi.
function _sbDirty(obyekt){
  if(!obyekt) return;
  try{
    var p=PropertiesService.getScriptProperties();
    var set={}; (JSON.parse(p.getProperty('SB_DIRTY')||'[]')).forEach(function(x){set[x]=1;});
    set[obyekt]=1;
    p.setProperty('SB_DIRTY', JSON.stringify(Object.keys(set)));
  }catch(e){}
}
function _sbDirtyOl(){
  try{ return JSON.parse(PropertiesService.getScriptProperties().getProperty('SB_DIRTY')||'[]'); }
  catch(e){ return []; }
}
function _sbDirtyTozala(){
  try{ PropertiesService.getScriptProperties().deleteProperty('SB_DIRTY'); }catch(e){}
}


/* ============ SOATLIK SINX (yengil — har soat trigger) ============ */
// Yengil qatlam: dashboard+narxlar+shartnoma (LRV ochmaydi) + faqat DIRTY obyektlar holat/material.
// Hech narsa o'zgarmasa deyarli bepul. Event o'tkazib yuborilsa — shu yerda tutiladi.
function supabaseSoatlikSinx(){
  if (typeof tizimMuzlatilganMi === 'function' && tizimMuzlatilganMi()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Supabase soatlik sinxronizatsiya bajarilmadi.');
    return {ok:false, sabab:'Tizim to\'xtatilgan (PAUSED)'};
  }
  if(!_sbBor()) return {ok:false, sabab:'sozlanmagan'};
  var t0=Date.now(), log=[];
  try{ supabaseDashboardPush(); log.push('✓ dashboard'); }catch(e){ log.push('✗ dashboard: '+(e.message||e)); }
  try{ supabaseNarxlarPush();   log.push('✓ narxlar'); }catch(e){ log.push('✗ narxlar: '+(e.message||e)); }
  try{ supabaseTolovPush();     log.push('✓ tolovlar'); }catch(e){ log.push('✗ tolovlar: '+(e.message||e)); }
  try{ supabaseShartnomaPush(); log.push('✓ shartnoma+bux'); }catch(e){ log.push('✗ shartnoma: '+(e.message||e)); }
  try{ supabasePrixodPush();    log.push('✓ prixod'); }catch(e){ log.push('✗ prixod: '+(e.message||e)); }
  try{ supabaseAktIshPush();    log.push('✓ akt_ish'); }catch(e){ log.push('✗ akt_ish: '+(e.message||e)); }

  var dirty=_sbDirtyOl();
  dirty.forEach(function(ob){
    try{
      supabaseObyektPush(ob);
      supabaseMaterialKerakPush(ob);
      supabaseTopilmaganPush(ob);
      supabaseAnomaliyaPush(ob);
      log.push('✓ '+ob);
    }catch(e){ log.push('✗ '+ob+': '+(e.message||e)); }
  });
  _sbDirtyTozala();                                    // muvaffaqiyatli push → tozalandi
  var sek=Math.round((Date.now()-t0)/1000);
  Logger.log('SB soatlik ('+sek+'s): '+log.join(' | '));
  return {ok:true, sek:sek, dirty:dirty.length, log:log};
}


/* ============ TRIGGER O'RNATISH (soatlik + kunlik to'liq) ============ */
function supabaseTriggerOrnat(){
  supabaseTriggerOchir();
  ScriptApp.newTrigger('supabaseSoatlikSinx').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('supabaseToliqSinx').timeBased().everyDays(1)
    .inTimezone('Asia/Tashkent').atHour(3).create();
  var msg='✅ Supabase triggerlar: soatlik (supabaseSoatlikSinx) + kunlik 03:00 (supabaseToliqSinx)';
  try{ SpreadsheetApp.getUi().alert(msg); }catch(e){}
  return msg;
}
function supabaseTriggerOchir(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    var f=t.getHandlerFunction();
    if(f==='supabaseSoatlikSinx'||f==='supabaseToliqSinx') ScriptApp.deleteTrigger(t);
  });
}
