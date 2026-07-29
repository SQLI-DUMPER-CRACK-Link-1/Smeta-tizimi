/********************************************************************
 * 85_Buxgalteriya.gs — TO'LOVLAR REGISTRI + MOLIYAVIY NAZORAT
 * ==================================================================
 * Buxgalteriya uchun PUL HARAKATI qatlami. Shartnoma (dogovor) bo'yicha
 * kelgan pul (avans/to'lov) yoziladi → debitor/kreditor avtomat hisoblanadi.
 *
 *   bajarilgan (Ф2/КС-2)  − to'langan  =  ДЕБИТОР (bizga qarz)
 *   to'langan  − bajarilgan (agar +)   =  АВАНС (oldindan to'lov)
 *
 * Varaq: ТЎЛОВЛАР (qo'lda ham yoziladi, panel/telegram orqali ham):
 *   САНА | ШАРТНОМА_NO | ОБЪЕКТ | СУММА | ТУР | ИЗОҲ
 *   ТУР: Аванс / Тўлов / Қайтарим
 ********************************************************************/

var _TOLOV = 'ТЎЛОВЛАР';

function _tolovSheet(){
  return _shSheet(_TOLOV,
    ['САНА','ШАРТНОМА_NO','ОБЪЕКТ','СУММА','ТУР','ИЗОҲ'],
    [110,120,220,150,110,300]);
}

/* ============ O'QISH ============ */
function apiTolovOl(){
  var sh=_tolovSheet();
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,6).getValues()
    .map(function(r,i){ return {
      sana:_buxSana(r[0]), shNo:String(r[1]||'').trim(), obyekt:String(r[2]||'').trim(),
      summa:_toNum(r[3]), tur:String(r[4]||'Тўлов').trim(), izoh:String(r[5]||''), row:i+2
    };})
    .filter(function(x){ return x.shNo || x.summa; });
}

/* ============ YOZISH ============ */
// d = {sana, shNo, obyekt, summa, tur, izoh} yоki [ {sana...}, {sana...} ]
function apiTolovYoz(d){
  if(Array.isArray(d)) {
    if(d.length === 0) return {ok:true, xabar:'Тўловлар қўшилмади (рўйхат бўш)'};
    var sh=_tolovSheet();
    var rows = d.map(function(item) {
      if(!item.shNo) throw 'ШАРТНОМА_NO керак (қаторда)';
      if(!_toNum(item.summa)) throw 'СУММА керак (қаторда)';
      return [
        item.sana||Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy'),
        String(item.shNo).trim(),
        String(item.obyekt||''),
        _toNum(item.summa),
        String(item.tur||'Тўлов'),
        String(item.izoh||'')
      ];
    });
    sh.getRange(sh.getLastRow()+1, 1, rows.length, 6).setValues(rows);
    SpreadsheetApp.flush();
    try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
    try{ if(typeof supabaseShartnomaPush==='function') supabaseShartnomaPush(); }catch(e){}
    return {ok:true, xabar: rows.length + ' та тўлов қўшилди'};
  } else {
    if(!d || !d.shNo) throw 'ШАРТНОМА_NO керак';
    if(!_toNum(d.summa)) throw 'СУММА керак';
    var sh=_tolovSheet();
    sh.appendRow([ d.sana||Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy'),
      String(d.shNo).trim(), String(d.obyekt||''), _toNum(d.summa),
      String(d.tur||'Тўлов'), String(d.izoh||'') ]);
    SpreadsheetApp.flush();
    try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
    try{ if(typeof supabaseShartnomaPush==='function') supabaseShartnomaPush(); }catch(e){}
    return {ok:true, xabar:'Тўлов қўшилди: '+d.shNo+' — '+_toNum(d.summa).toLocaleString()};
  }
}
function apiTolovOchir(row){
  var sh=_tolovSheet(); row=parseInt(row,10);
  if(row>=2 && row<=sh.getLastRow()) sh.deleteRow(row);
  try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
  return {ok:true, xabar:'Тўлов ўчирилди'};
}

/* ============ TAHRIRLASH ============ */
// d = {row, sana, shNo, obyekt, summa, tur, izoh}
function apiTolovTahrir(d){
  if(!d || !d.row) throw 'QATOR RAQAMI керак';
  if(!d.shNo) throw 'ШАРТНОМА_NO керак';
  if(!_toNum(d.summa)) throw 'СУММА керак';
  var sh = _tolovSheet();
  var row = parseInt(d.row, 10);
  if(row < 2 || row > sh.getLastRow()) throw 'Qator topilmadi: '+row;
  sh.getRange(row, 1, 1, 6).setValues([[
    d.sana || Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy'),
    String(d.shNo).trim(),
    String(d.obyekt||''),
    _toNum(d.summa),
    String(d.tur||'Тўлов'),
    String(d.izoh||'')
  ]]);
  SpreadsheetApp.flush();
  try{ if(typeof supabaseTolovPush==='function') supabaseTolovPush(); }catch(e){}
  return {ok:true, xabar:'Тўлов янгиланди: '+d.shNo+' — '+_toNum(d.summa).toLocaleString()};
}


/* ============ TO'LOV YIG'INDISI (shartnoma bo'yicha) ============ */
// → { shNo: {tolangan, avans, qaytarim} }
function _tolovYigindi(){
  var t=apiTolovOl(), map={};
  for(var i=0;i<t.length;i++){
    var no=t[i].shNo||'—';
    if(!map[no]) map[no]={tolangan:0, avans:0, qaytarim:0};
    var tur=t[i].tur.toLowerCase();
    if(tur.indexOf('қайт')>=0 || tur.indexOf('кайт')>=0 || tur.indexOf('qayt')>=0)
      map[no].qaytarim += t[i].summa;
    else if(tur.indexOf('аванс')>=0 || tur.indexOf('avans')>=0){
      map[no].avans += t[i].summa; map[no].tolangan += t[i].summa;
    } else map[no].tolangan += t[i].summa;
  }
  // qaytarimni jami to'langandan ayiramiz
  for(var k in map) map[k].tolangan -= map[k].qaytarim;
  return map;
}

/* ============ BUXGALTERIYA DASHBOARD (debitor/kreditor) ============ */
function apiBuxDashboard(){
  var d=(typeof apiShartnomaDashboard==='function')?apiShartnomaDashboard():{shartnomalar:[]};
  var ty=_tolovYigindi();
  var out=[], jami={dog:0, bajarilgan:0, tolangan:0, debitor:0, avans:0};
  (d.shartnomalar||[]).forEach(function(g){
    if(g.no==='—') return;
    // ⚡⚡⚡ 2026-07-10 TUZATILDI: dog (m.jami) — foydalanuvchi qo'lda kiritgan
    //   ЯКУНИЙ shartnoma summasi (НДС/накрутка BILAN). baj (Ф2) esa LRV'dan
    //   ТОЗА (накрутkasiz) kelardi — baj/dog nisbati apples-to-oranges bo'lib,
    //   bajarilgan% doim sun'iy KAM chiqardi (foydalanuvchi tasdiqlagan bug).
    //   Endi: agar haqiqiy dogovor summasi (m.jami) bo'lsa — накрутkali F2
    //   ekvivalentidan (jamiF2Nakr) foydalanamiz (bir xil qamrov). Fallback
    //   (dogovor kiritilmagan, jamiSmeta — toza) holatda ikkalasi ham toza qoladi.
    var m=g.meta||{}, dogRaw=_toNum(m.jami);
    var dog = dogRaw || _toNum(g.jamiSmeta);
    var baj = dogRaw ? _toNum(g.jamiF2Nakr!=null?g.jamiF2Nakr:g.jamiF2) : _toNum(g.jamiF2);
    var tl=(ty[g.no]&&ty[g.no].tolangan)||0;
    var debitor=baj-tl;                                 // bizga qarz (+) / oldindan (−)
    out.push({no:g.no, nomi:m.nomi||'', taraf:m.taraf||'',
      dog_summa:dog, bajarilgan:baj, tolangan:tl,
      debitor:debitor>0?debitor:0, avans:debitor<0?-debitor:0,
      bajarilgan_pct:dog>0?Math.round(baj/dog*100):0,
      tolangan_pct:dog>0?Math.round(tl/dog*100):0, holat:m.holat||''});
    jami.dog+=dog; jami.bajarilgan+=baj; jami.tolangan+=tl;
    jami.debitor+=(debitor>0?debitor:0); jami.avans+=(debitor<0?-debitor:0);
  });
  return {qatorlar:out, jami:jami};
}

/* ⚡ 2026-07-13 YANGI: DEBИТОР AGING — Boss panel uchun "qanchadan beri to'lanmagan"
 * ko'rinishi. Ҳар шартнома учун ОХИРГИ тўлов санасидан бугунгача неча кун
 * ўтганини ҳисоблайди (тўлов бўлмаса — "тўлов йўқ"). Фақат ДЕБИТОР қолдиғи
 * (>0) бор шартномалар қайтарилади, энг узоқ кутганлар биринчи. */
function apiDebitorAging(){
  try{
    var t=apiTolovOl();
    var lastPay={};
    t.forEach(function(p){
      if(!p.shNo) return;
      var d=_buxSanaParse(p.sana);
      if(!d) return;
      if(!lastPay[p.shNo] || d>lastPay[p.shNo]) lastPay[p.shNo]=d;
    });
    var bux=apiBuxDashboard();
    var now=new Date();
    var out=(bux.qatorlar||[]).filter(function(r){ return r.debitor>0; }).map(function(r){
      var lp=lastPay[r.no];
      var kunOtdi = lp ? Math.round((now-lp)/86400000) : null;
      return {no:r.no, nomi:r.nomi, debitor:r.debitor,
        oxirgiTolov: lp?Utilities.formatDate(lp,'Asia/Tashkent','dd.MM.yyyy'):'(тўлов йўқ)',
        kunOtdi: kunOtdi};
    });
    out.sort(function(a,b){ return (b.kunOtdi==null?99999:b.kunOtdi)-(a.kunOtdi==null?99999:a.kunOtdi); });
    return {ok:true, royxat:out};
  }catch(e){ return {ok:false, xabar:String(e.message||e)}; }
}
function _buxSanaParse(s){
  var m=String(s||'').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(!m) return null;
  return new Date(Number(m[3]), Number(m[2])-1, Number(m[1]));
}

/* ============ Yordamchi ============ */
function _buxSana(v){
  if(v instanceof Date) return Utilities.formatDate(v,'Asia/Tashkent','dd.MM.yyyy');
  return String(v==null?'':v).trim();
}

/* ============ XARAJATLAR (Fakt xarajatlar) ============ */
function _xarajatSheet(){
  // ⚡⚡⚡ 2026-07-18 KRITIK TUZATISH (foydalanuvchi: "xarajatlar kiritish UMUMAN
  // ishlamaydi"): _serverSS(a) konfiguratsiya obyektini TALAB qiladi (a.serverId/
  // a.rootId o'qiydi) — bu yerda ARGUMENTSIZ chaqirilib, birinchi qatordayoq
  // "Cannot read property 'serverId' of undefined" bilan yiqilardi. Natijada
  // apiXarajatOl/Yoz/Ochir UCHALASI ham ishga tushmay turardi.
  var ss=_serverSS(sozAsosiy());
  var sh=ss.getSheetByName('ХАРАЖАТЛАР');
  if(!sh){
    sh=ss.insertSheet('ХАРАЖАТЛАР');
    sh.appendRow(['САНА','ТОИФА','СУММА','ИЗОҲ']);
    sh.getRange("1:1").setFontWeight("bold").setBackground("#f3f4f6");
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 100);
    sh.setColumnWidth(2, 150);
    sh.setColumnWidth(3, 120);
    sh.setColumnWidth(4, 300);
  }
  return sh;
}

function apiXarajatOl(){
  var sh=_xarajatSheet();
  if(sh.getLastRow()<2) return [];
  var v=sh.getRange(2,1,sh.getLastRow()-1,4).getValues();
  return v.map(function(r,i){ return {
    row: i+2,
    sana: _buxSana(r[0]),
    toifa: String(r[1]||'Бошқа').trim(),
    summa: _toNum(r[2]),
    izoh: String(r[3]||'')
  };}).filter(function(x){ return x.summa; });
}

// d = {sana, toifa, summa, izoh, row}
function apiXarajatYoz(d){
  if(!d) throw 'Маълумот йўқ';
  if(!_toNum(d.summa)) throw 'СУММА керак';
  if(!d.toifa) throw 'ТОИФА керак';
  var sh=_xarajatSheet();
  var row = parseInt(d.row, 10) || 0;
  var rowData = [
    d.sana || Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy'),
    String(d.toifa).trim(),
    _toNum(d.summa),
    String(d.izoh||'')
  ];
  
  if (row > 1 && row <= sh.getLastRow()) {
    sh.getRange(row, 1, 1, 4).setValues([rowData]);
  } else {
    sh.appendRow(rowData);
  }
  SpreadsheetApp.flush();
  return {ok:true, xabar:'Харажат сақланди: '+_toNum(d.summa).toLocaleString()};
}

function apiXarajatOchir(row){
  var sh=_xarajatSheet();
  row=parseInt(row,10);
  if(row>1 && row<=sh.getLastRow()){
    sh.deleteRow(row);
    SpreadsheetApp.flush();
    return {ok:true, xabar:'Харажат ўчирилди'};
  }
  throw 'Хато қатор: '+row;
}
