/********************************************************************
 * 80_Shartnoma.gs — ШАРТНОМА (DOGOVOR) QATLAMI + НАКРУТКА DVIGATELI
 * ==================================================================
 * Qurilish iyerarxiyasi: ШАРТНОМА (dogovor) → OBYEKTLAR + ҚЎШИМЧА ИШЛАР
 *   Masalan: "Стелла" shartnomasi = Stella obyekti (KJ ~8mlrd)
 *            + Бронза VIP ART (~6.5mlrd, subpodryad — qo'lda)
 *            + Пилястр, ФИБРОБЕТОН (qo'lda summalar)
 *
 * HAMMASI UI ORQALI BOSHQARILADI (hardcode YO'Q — yangi obyekt/shartnoma
 * panel menyusidan qo'shiladi; tizim bozorbop bo'lishi uchun).
 *
 * Varaqlar (SMETA_TEST_V1 ichida):
 *   SOZLAMALAR_ШАРТНОМА — shartnomalar reestri
 *     A=NO  B=НОМИ  C=ТАРАФ  D=СУММА_БЕЗ_НДС  E=НДС  F=ЖАМИ  G=ҲОЛАТ  H=ИЗОҲ
 *   SOZLAMALAR_ШАРТНОМА_БОГ — obyekt → shartnoma biriktirish
 *     A=ОБЪЕКТ  B=ШАРТНОМА_NO
 *   ҚЎШИМЧА_ИШЛАР — smeta tashqari (subpodryad) ishlar, qo'lda summalar
 *     A=ШАРТНОМА_NO  B=НОМИ  C=СМЕТА  D=ФАКТ  E=Ф2_ОЛИНГАН  F=Ф2_МУМКИН  G=ИЗОҲ
 *   SOZLAMALAR_НАКРУТКА — koeffitsientlar (foiz, default qurilish standarti)
 *
 * НАКРУТКА — F2 podval zanjiri (20 qator, user eski tizimidan tasdiqlangan):
 *   ПРЯМЫЕ → транспорт/склад → ИТОГО → ПРОЧИЕ 18% → ОБОРУД bloki →
 *   СТРАХОВАНИЕ 0.32% → РИСК → НДС 12% → ВСЕГО
 ********************************************************************/

var _SH_SH   = 'SOZLAMALAR_ШАРТНОМА';
var _SH_BOG  = 'SOZLAMALAR_ШАРТНОМА_БОГ';
var _SH_QOSH = 'ҚЎШИМЧА_ИШЛАР';
var _SH_NAKR = 'SOZLAMALAR_НАКРУТКА';

/* Default nakrutka koeffitsientlari (foiz). User UI da o'zgartiradi. */
var _NAKR_DEFAULT = [
  ['ЗТР_СОЦСТРАХ',        12,   'Соцстрах ЗТР ичида (маълумот учун)'],
  ['ТРАНСПОРТ_МАТЕРИАЛ',  5,    'Транспорт расходы на материалы %'],
  ['СКЛАДСКИЕ_МАТЕРИАЛ',  2,    'Складские расходы на материалы %'],
  ['СКЛАДСКИЕ_МК',        0.75, 'Складские на металлоконструкции %'],
  ['ТРАНСПОРТ_КАБЕЛЬ',    1.5,  'Транспорт на кабели и провода %'],
  ['ПРОЧИЕ_ПОДРЯДЧИК',    18,   'Прочие затраты и расходы подрядчика %'],
  ['ТРАНСПОРТ_ОБОРУД',    2,    'Транспорт расходы на оборудование %'],
  ['ЗАГОТ_СКЛАД_ОБОРУД',  1.2,  'Заготовительно-складские на оборуд. %'],
  ['СТРАХОВАНИЕ',         0.32, 'Затраты на страхование объекта %'],
  ['РИСК',                0,    'Коэффициент риска % (одатда 0, қўлда)'],
  ['НДС',                 12,   'НДС %']
];


/* ============ VARAQ YARATISH / O'QISH ============ */

function _shSheet(nom, hdr, widths){
  var ss=SpreadsheetApp.getActive();
  var sh=ss.getSheetByName(nom);
  if(!sh){
    sh=ss.insertSheet(nom);
    sh.getRange(1,1,1,hdr.length).setValues([hdr])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
    sh.setFrozenRows(1);
    if(widths) for(var i=0;i<widths.length;i++) if(widths[i]) sh.setColumnWidth(i+1,widths[i]);
  }
  return sh;
}

function _shartnomaSheet(){
  var sh=_shSheet(_SH_SH,
    ['ШАРТНОМА_NO','НОМИ','ТАРАФ (буюртмачи)','СУММА_БЕЗ_НДС','НДС','ЖАМИ_НДС_БИЛАН','ҲОЛАТ','ИЗОҲ','ЧЕЛ-Ч СТАВКА'],
    [120,250,200,140,120,150,100,250,120]);
  // Eski varaq (8 ustun) bo'lsa — 9-ustun sarlavhasini qo'shamiz
  try{
    if(String(sh.getRange(1,9).getValue()||'')===''){
      sh.getRange(1,9).setValue('ЧЕЛ-Ч СТАВКА')
        .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
    }
  }catch(e){}
  return sh;
}
function _bogSheet(){
  return _shSheet(_SH_BOG, ['ОБЪЕКТ','ШАРТНОМА_NO'], [250,150]);
}
function _qoshIshSheet(){
  return _shSheet(_SH_QOSH,
    ['ШАРТНОМА_NO','НОМИ','СМЕТА','ФАКТ','Ф2_ОЛИНГАН','Ф2_МУМКИН','ИЗОҲ'],
    [120,300,140,140,140,140,250]);
}
function _nakrSheet(){
  var sh=_shSheet(_SH_NAKR, ['КОЭФФ','ҚИЙМАТ %','ИЗОҲ'], [220,100,350]);
  if(sh.getLastRow()<2){
    sh.getRange(2,1,_NAKR_DEFAULT.length,3).setValues(_NAKR_DEFAULT);
  }
  return sh;
}


/* ============ НАКРУТКА KONFIG ============ */

/* НАКРУТКА — HAR ShARTNOMA ALOHIDA (dogovor oilasi qoidasi).
 * Varaq: A=КОЭФФ  B=ҚИЙМАТ %(умумий default)  C=ИЗОҲ  D+=har shartnoma ustuni
 * (sarlavha=ШАРТНОМА_NO). Shartnoma ustunida katak BO'SH → umumiy default ishlatiladi. */
function _nakrShCol(sh, shNo, yaratish){
  if(!shNo) return 0;
  var lastC=sh.getLastColumn();
  if(lastC>=4){
    var hdr=sh.getRange(1,4,1,lastC-3).getValues()[0];
    for(var i=0;i<hdr.length;i++) if(String(hdr[i]||'').trim()===String(shNo).trim()) return 4+i;
  }
  if(!yaratish) return 0;
  var c=Math.max(4,lastC+1);
  sh.getRange(1,c).setValue(String(shNo).trim())
    .setFontWeight('bold').setBackground('#7f3d3d').setFontColor('#ffffff').setWrap(true);
  sh.setColumnWidth(c,100);
  return c;
}

function _nakrOl(shNo){
  var sh=_nakrSheet(), m={};
  for(var i=0;i<_NAKR_DEFAULT.length;i++) m[_NAKR_DEFAULT[i][0]]=_NAKR_DEFAULT[i][1]; // hard default
  if(sh.getLastRow()>=2){
    var shCol=_nakrShCol(sh, shNo, false);
    var w=shCol?shCol:2;
    var v=sh.getRange(2,1,sh.getLastRow()-1,w).getValues();
    for(var j=0;j<v.length;j++){
      var k=String(v[j][0]||'').trim();
      if(!k) continue;
      m[k]=_toNum(v[j][1]);                                  // umumiy default (B)
      if(shCol){
        var ov=v[j][shCol-1];
        if(ov!=='' && ov!==null && ov!==undefined) m[k]=_toNum(ov);  // shartnoma override
      }
    }
  }
  return m;
}

function apiNakrutkaOl(shNo){
  var sh=_nakrSheet();
  if(sh.getLastRow()<2) return [];
  var shCol=_nakrShCol(sh, shNo, false);
  var w=Math.max(3, shCol||0);
  var v=sh.getRange(2,1,sh.getLastRow()-1,w).getValues(), out=[];
  for(var i=0;i<v.length;i++){
    var k=String(v[i][0]||'').trim(); if(!k) continue;
    var def=_toNum(v[i][1]);
    var ov=(shCol && v[i][shCol-1]!=='' && v[i][shCol-1]!==null) ? _toNum(v[i][shCol-1]) : null;
    out.push({koef:k, qiymat:(ov!==null?ov:def), def:def, override:(ov!==null), izoh:String(v[i][2]||'')});
  }
  return out;
}

function apiNakrutkaSaqla(items, shNo){
  var sh=_nakrSheet();
  if(shNo){
    // Shartnoma ustuniga yozish (default B ustun TEGILMAYDI)
    var shCol=_nakrShCol(sh, shNo, true);
    var n=sh.getLastRow()-1;
    if(n>0){
      var keys=sh.getRange(2,1,n,1).getValues();
      var col=[], map={};
      (items||[]).forEach(function(x){ map[x.koef]=x; });
      for(var i=0;i<n;i++){
        var k=String(keys[i][0]||'').trim(), it=map[k];
        // default bilan teng yoki bo'sh → katak bo'sh (umumiy ishlatiladi)
        col.push([ (it && _toNum(it.qiymat)!==_toNum(it.def)) ? _toNum(it.qiymat) : '' ]);
      }
      sh.getRange(2,shCol,n,1).setValues(col);
    }
    return {ok:true, xabar:'Накрутка сақланди — шартнома '+shNo+' учун'};
  }
  if(sh.getLastRow()>=2) sh.getRange(2,1,sh.getLastRow()-1,3).clearContent();
  var rows=(items||[]).map(function(x){ return [x.koef, _toNum(x.qiymat), x.izoh||'']; });
  if(rows.length) sh.getRange(2,1,rows.length,3).setValues(rows);
  return {ok:true, xabar:'Умумий (default) накрутка сақланди ('+rows.length+')'};
}

/* НАКРУТКА ZANJIRI — kategoriya summalaridan ВСЕГО gacha (20 qator podval).
 * cats = {chel, mash, mat, ob, mk, kab, bez} — прямые затраты kategoriyalar.
 * Qaytaradi: butun zanjir (massiv) + vsego. User eski F2 podval formulalari. */
function nakrutkaHisob(cats, nk){
  nk = nk || _nakrOl();
  var chel=cats.chel||0, mash=cats.mash||0, mat=cats.mat||0, ob=cats.ob||0,
      mk=cats.mk||0, kab=cats.kab||0, bez=cats.bez||0;

  var pryamye   = chel+mash+mat+ob;                                  // 1 ИТОГО ПРЯМЫЕ
  var trMat     = (mat-kab) * (nk['ТРАНСПОРТ_МАТЕРИАЛ']||0)/100;     // 5 (кабель материалга кирмайди)
  var sklMat    = (mat-bez-mk) * (nk['СКЛАДСКИЕ_МАТЕРИАЛ']||0)/100
                + mk * (nk['СКЛАДСКИЕ_МК']||0)/100;                   // 6
  var trKab     = kab * (nk['ТРАНСПОРТ_КАБЕЛЬ']||0)/100;             // 8
  var itogo1    = pryamye - ob + trMat + sklMat + trKab;             // 9 (оборудсиз)
  var prochie   = itogo1 * (nk['ПРОЧИЕ_ПОДРЯДЧИК']||0)/100;          // 10
  var itogo2    = itogo1 + prochie;                                  // 11
  var trOb      = ob * (nk['ТРАНСПОРТ_ОБОРУД']||0)/100;              // 13
  var zagOb     = ob * (nk['ЗАГОТ_СКЛАД_ОБОРУД']||0)/100;            // 14
  var itogo3    = itogo2 + ob + trOb + zagOb;                        // 15
  var strax     = itogo3 * (nk['СТРАХОВАНИЕ']||0)/100;               // 16
  var risk      = itogo3 * (nk['РИСК']||0)/100;                      // 17
  var itogo4    = itogo3 + strax + risk;                             // 18
  var nds       = itogo4 * (nk['НДС']||0)/100;                       // 19
  var vsego     = itogo4 + nds;                                      // 20

  return {
    pryamye:pryamye, chel:chel, mash:mash, mat:mat, ob:ob, kab:kab,
    trMat:trMat, sklMat:sklMat, trKab:trKab,
    itogo1:itogo1, prochie:prochie, itogo2:itogo2,
    trOb:trOb, zagOb:zagOb, itogo3:itogo3,
    strax:strax, risk:risk, itogo4:itogo4, nds:nds, vsego:vsego
  };
}


/* ============ ШАРТНОМА CRUD ============ */

function apiShartnomaOl(){
  var sh=_shartnomaSheet();
  if(sh.getLastRow()<2) return [];
  return sh.getRange(2,1,sh.getLastRow()-1,9).getValues()
    .map(function(r){ return {
      no:String(r[0]||'').trim(), nomi:String(r[1]||''), taraf:String(r[2]||''),
      summa:_toNum(r[3]), nds:_toNum(r[4]), jami:_toNum(r[5]),
      holat:String(r[6]||'Фаол'), izoh:String(r[7]||''), chelCh:_toNum(r[8])
    };})
    .filter(function(x){ return x.no; });
}

function apiShartnomaSaqla(d){
  if(!d || !String(d.no||'').trim()) throw 'ШАРТНОМА_NO бўш бўлмасин';
  var sh=_shartnomaSheet(), no=String(d.no).trim();
  var row=[no, d.nomi||'', d.taraf||'', _toNum(d.summa)||'', _toNum(d.nds)||'',
           _toNum(d.jami)||'', d.holat||'Фаол', d.izoh||'', _toNum(d.chelCh)||''];
  var last=sh.getLastRow(), found=0;
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<v.length;i++) if(String(v[i][0]).trim()===no){ found=i+2; break; }
  }
  if(found) sh.getRange(found,1,1,9).setValues([row]);
  else sh.appendRow(row);
  return {ok:true, xabar:'Шартнома сақланди: '+no};
}

/* OBYEKT → uning shartnomasidagi ЧЕЛ-Ч stavka.
 * ⚠️ DOGOVOR OILASI QOIDASI: bitta shartnomadagi BARCHA obyektlar (Amfiteatr,
 * Stella...) BIR XIL chel-chas stavkaga ega — stavka shartnoma darajasida.
 * Topilmasa 0 (keyin _stavkaOl per-obyekt zaxiraga tushadi). */
function shartnomaChelCh(obyekt){
  try{
    var map=apiShartnomaBogOl();
    var no=map[String(obyekt||'').trim()];
    if(!no){
      var base = String(obyekt||'').split(' - ')[0].trim();
      no = map[base];
    }
    if(!no) return 0;
    var list=apiShartnomaOl();
    for(var i=0;i<list.length;i++) if(list[i].no===no) return list[i].chelCh||0;
  }catch(e){}
  return 0;
}

function apiShartnomaOchir(no){
  var sh=_shartnomaSheet(), last=sh.getLastRow();
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=v.length-1;i>=0;i--){
      if(String(v[i][0]).trim()===String(no).trim()){ sh.deleteRow(i+2); break; }
    }
  }
  return {ok:true, xabar:'Шартнома ўчирилди: '+no};
}


/* ============ OBYEKT → ШАРТНОМА BIRIKTIRISH ============ */

function apiShartnomaBogOl(){
  var sh=_bogSheet(), m={};
  if(sh.getLastRow()>=2){
    var v=sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
    for(var i=0;i<v.length;i++){
      var ob=String(v[i][0]||'').trim();
      if(ob) m[ob]=String(v[i][1]||'').trim();
    }
  }
  return m;
}

function apiShartnomaBogSaqla(obyekt, shartnomaNo){
  var sh=_bogSheet(), last=sh.getLastRow(), found=0;
  obyekt=String(obyekt||'').trim();
  if(!obyekt) throw 'Объект бўш';
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<v.length;i++) if(String(v[i][0]).trim()===obyekt){ found=i+2; break; }
  }
  var no=String(shartnomaNo||'').trim();
  if(found){
    if(no) sh.getRange(found,2).setValue(no);
    else sh.deleteRow(found);   // bo'sh → biriktirish o'chiriladi
  } else if(no){
    sh.appendRow([obyekt, no]);
  }
  return {ok:true, xabar:obyekt+' → '+(no||'(бўшатилди)')};
}


/* ============ ҚЎШИМЧА ИШЛАР (subpodryad, qo'lda summalar) ============ */

function apiQoshIshOl(){
  var sh=_qoshIshSheet();
  if(sh.getLastRow()<2) return [];
  var v=sh.getRange(2,1,sh.getLastRow()-1,7).getValues(), out=[];
  for(var i=0;i<v.length;i++){
    var nomi=String(v[i][1]||'').trim();
    if(!nomi) continue;
    out.push({row:i+2, shNo:String(v[i][0]||'').trim(), nomi:nomi,
      smeta:_toNum(v[i][2]), fakt:_toNum(v[i][3]),
      f2ol:_toNum(v[i][4]), f2mum:_toNum(v[i][5]), izoh:String(v[i][6]||'')});
  }
  return out;
}

function apiQoshIshSaqla(d){
  if(!d || !String(d.nomi||'').trim()) throw 'Иш номи бўш бўлмасин';
  var sh=_qoshIshSheet();
  var row=[d.shNo||'', d.nomi, _toNum(d.smeta)||'', _toNum(d.fakt)||'',
           _toNum(d.f2ol)||'', _toNum(d.f2mum)||'', d.izoh||''];
  if(d.row && d.row>=2 && d.row<=sh.getLastRow()){
    sh.getRange(d.row,1,1,7).setValues([row]);
  } else {
    sh.appendRow(row);
  }
  return {ok:true, xabar:'Қўшимча иш сақланди: '+d.nomi};
}

function apiQoshIshOchir(row){
  var sh=_qoshIshSheet();
  if(row>=2 && row<=sh.getLastRow()) sh.deleteRow(row);
  return {ok:true, xabar:'Ўчирилди'};
}


/* ============ ШАРТНОМА DASHBOARD (rollup + nakrutka) ============
 * Har shartnoma: a'zo obyektlar (DASHBOARD dan, tez) + qo'shimcha ishlar.
 *   - smeta/fakt/f2/ost: прямые затраты (DASHBOARD leaf yig'indilari)
 *   - nakrutka: smeta kategoriyalaridan ВСЕГО zanjiri (НДС gacha)
 * Biriktirilmagan obyektlar "—" guruhida ko'rinadi (yo'qolmaydi). */
function apiShartnomaDashboard(){
  var a=sozAsosiy();
  var shList=apiShartnomaOl();
  var bog=apiShartnomaBogOl();
  var qoshlar=apiQoshIshOl();
  var nk=_nakrOl();

  // DASHBOARD dan obyekt qatorlari (tez — bitta varaq o'qish)
  var dash=_dash(_serverSS(a));
  var obRows=[];
  if(dash.getLastRow()>=2){
    var v=dash.getRange(2,1,dash.getLastRow()-1,11).getValues();
    for(var i=0;i<v.length;i++){
      var nom=String(v[i][0]||'').trim();
      if(!nom || nom.toUpperCase()==='ЖАМИ') continue;
      obRows.push({obyekt:nom, smeta:_toNum(v[i][1]),
        chel:_toNum(v[i][2]), mash:_toNum(v[i][3]), mat:_toNum(v[i][4]),
        ob:_toNum(v[i][5]), mk:_toNum(v[i][6]), kab:_toNum(v[i][7]),
        fakt:_toNum(v[i][8]), f2:_toNum(v[i][9]), ost:_toNum(v[i][10])});
    }
  }

  // Guruhlash
  var grp={}; // shNo → {sh, obyektlar[], qoshlar[], cats, sums}
  function g(no){
    if(!grp[no]){
      var meta=null;
      for(var s=0;s<shList.length;s++) if(shList[s].no===no){ meta=shList[s]; break; }
      grp[no]={no:no, meta:meta, obyektlar:[], qoshlar:[],
        cats:{chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0},
        smeta:0, fakt:0, f2:0, ost:0, qoshSmeta:0, qoshFakt:0, qoshF2:0, qoshF2mum:0};
    }
    return grp[no];
  }
  for(var o=0;o<obRows.length;o++){
    // split obyekt (папка-локалка) bo'lsa, papka bog'lanishini ham tekshiramiz
    var r=obRows[o], no=bog[r.obyekt] || (typeof _cfgKalit==='function'?bog[_cfgKalit(r.obyekt)]:'') || '—';
    var G=g(no);
    G.obyektlar.push(r);
    G.smeta+=r.smeta; G.fakt+=r.fakt; G.f2+=r.f2; G.ost+=r.ost;
    G.cats.chel+=r.chel; G.cats.mash+=r.mash; G.cats.mat+=r.mat;
    G.cats.ob+=r.ob; G.cats.mk+=r.mk; G.cats.kab+=r.kab;
  }
  for(var q=0;q<qoshlar.length;q++){
    var Q=qoshlar[q], G2=g(Q.shNo||'—');
    G2.qoshlar.push(Q);
    G2.qoshSmeta+=Q.smeta; G2.qoshFakt+=Q.fakt; G2.qoshF2+=Q.f2ol; G2.qoshF2mum+=Q.f2mum;
  }
  // Bo'sh shartnomalar ham ko'rinsin (yangi yaratilgan)
  for(var s2=0;s2<shList.length;s2++) g(shList[s2].no);

  var out=[];
  for(var no2 in grp){
    var G3=grp[no2];
    // HAR SHARTNOMA O'Z nakrutkasi bilan (dogovor oilasi qoidasi)
    G3.nakrutka=nakrutkaHisob(G3.cats, no2==='—' ? nk : _nakrOl(no2));
    G3.jamiSmeta=G3.smeta+G3.qoshSmeta;       // прямые + qo'shimcha
    G3.jamiFakt=G3.fakt+G3.qoshFakt;
    G3.jamiF2=G3.f2+G3.qoshF2;
    out.push(G3);
  }
  // Tartib: avval shartnomalilar, '—' oxirida
  out.sort(function(x,y){
    if(x.no==='—') return 1; if(y.no==='—') return -1;
    return x.no<y.no?-1:1;
  });
  return {shartnomalar:out, nakrutkaKoef:nk, obyektSoni:obRows.length};
}
