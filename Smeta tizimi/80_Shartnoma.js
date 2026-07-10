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
  return _shSheet(_SH_BOG, ['ОБЪЕКТ','ШАРТНОМА_NO','СОНИ'], [250,150,80]);
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

/* ============ ⚡ HAR KATEGORIYA UCHUN ANIQ НАКРУТКА КОЭФФИЦИЕНТИ ============
 * 2026-07-04, foydalanuvchi talabi: "har bir rs/mat/ob накрутка билан қанчага
 * чиқишини аниқ ҳисоблаб бериш" (масалан шебень 79000 сум — склад 2%, транспорт
 * 5%, прочее 18% ва ҳ.к. билан якуний нарх қанча). Аввалги `umumiyKf`
 * (ВСЕГО/ПРЯМЫЕ) ҲАММА категорияга БИР ХИЛ қўлланарди — нотўғри, чунки ЧЕЛ/МАШ
 * учун ТРАНСПОРТ_МАТЕРИАЛ/СКЛАДСКИЕ каби қадамлар умуман татбиқ этилмайди.
 * `nakrutkaHisob` chiziqli (linear) funksiya bo'lgani uchun (barcha amallar
 * qo'shish/foizga ko'paytirish — kvadrat/bo'lish yo'q), har kategoriyaning ANIQ
 * marjinal koeffitsientini probe (faqat o'sha kategoriya=1, qolgani=0) orqali
 * hisoblash mumkin — natija ВСЕГО/1 ана shu kategoriya учун ANIQ ko'paytirgich
 * (approximatsiya EMAS, formula bo'yicha 100% aniq). */
function _nakrutkaKoefTable(nk){
  function koef(probe){ return nakrutkaHisob(probe, nk).vsego; }
  return {
    ЧЕЛ:      koef({chel:1}),
    МАШ:      koef({mash:1}),
    МАТ:      koef({mat:1}),
    ОБ:       koef({ob:1}),
    'М/К':    koef({mat:1, mk:1}),
    КАБ:      koef({mat:1, kab:1}),
    БЕЗСКЛАД: koef({mat:1, bez:1})
  };
}

/* Bitta resurs (rs/mat/ob) uchun to'liq накрутка rasshifrovkasi — xuddi shu
 * `nakrutkaHisob` orqali, faqat berilgan kategoriyaga ANIQ shu resurs narxi
 * qo'yiladi (chiziqlilik tufayli natija = shu resursning накрутка zanjiridagi
 * ANIQ ulushi, boshqa resurslarga aralashmaydi). */
function apiResursNakrutka(obyekt, kategoriya, narx){
  obyekt=String(obyekt||'').trim(); narx=_toNum(narx);
  var bog=(typeof apiShartnomaBogOl==='function')?apiShartnomaBogOl():{};
  var shNo=bog[obyekt] || (typeof _cfgKalit==='function' ? bog[_cfgKalit(obyekt)] : '') || '';
  var nk=shNo?_nakrOl(shNo):_nakrOl();

  var kat=String(kategoriya||'МАТ').toUpperCase();
  var probe={chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0};
  if(kat==='ЧЕЛ') probe.chel=narx;
  else if(kat==='МАШ') probe.mash=narx;
  else if(kat==='ОБ'||kat==='ОБОР') probe.ob=narx;
  else if(kat==='М/К'||kat==='МК'){ probe.mat=narx; probe.mk=narx; }
  else if(kat==='КАБ'||kat==='КАБЕЛ'){ probe.mat=narx; probe.kab=narx; }
  else if(kat==='БЕЗСКЛАД'||kat==='БЕЗ СКЛАД'){ probe.mat=narx; probe.bez=narx; }
  else probe.mat=narx; // default МАТ

  var r=nakrutkaHisob(probe, nk);
  return {obyekt:obyekt, shNo:shNo||'—', kategoriya:kat, sof:narx, bilan:r.vsego, nakrutka:r,
          foiz: narx>0 ? Math.round((r.vsego-narx)/narx*100) : 0};
}

/* Yengil: FAQAT накрутка koeffitsientlari + % konfiguratsiyasi (DASHBOARD o'qilmaydi,
 * xato bermaydi). Panel har obyekt tanlanganda BIR MARTA yuklab, keyin BARCHA summalar
 * yonida (rs/mat/ob/bl/rz/KPI) накрутка bilan narxni MIJIZ TARAFDA (JS) darhol hisoblaydi —
 * server chaqiruvi shart emas, tugma bosish shart emas. */
function apiNakrutkaKoef(obyekt){
  obyekt=String(obyekt||'').trim();
  var bog=(typeof apiShartnomaBogOl==='function')?apiShartnomaBogOl():{};
  var shNo=bog[obyekt] || (typeof _cfgKalit==='function' ? bog[_cfgKalit(obyekt)] : '') || '';
  var nk=shNo?_nakrOl(shNo):_nakrOl();
  return {shNo:shNo||'', kf:_nakrutkaKoefTable(nk), nk:nk};
}

/* ============ ⚡ HAR OBYEKT UCHUN НАКРУТКА (smetani boshidan hisoblab) ============
 * Har bir obyekt (dogovorga biriktirilgan yo'q taqdirda ham) uchun to'liq
 * накрутка zanjirini hisoblaydi — DASHBOARD dagi kategoriya jamilaridan (tez,
 * LRV ochilmaydi). Obyekt biror ШАРТНОМА ga biriktirilgan bo'lsa — o'sha
 * shartnomaning накрутка override qiymatlari ishlatiladi (aks holda umumiy
 * default). Natija: ПРЯМЫЕ (xarajat asosi) va ВСЕГО (mijozga ko'rinadigan,
 * НДС bilan yakuniy narx) — farqi НАКРУТКА (устама/фойда salohiyati). */
function apiObyektNakrutka(obyekt){
  obyekt=String(obyekt||'').trim();
  if(!obyekt) throw 'Обект номи бўш';
  var a=sozAsosiy();
  var dash=_dash(_serverSS(a));
  var cats={chel:0,mash:0,mat:0,ob:0,mk:0,kab:0,bez:0};
  var smeta=0, fakt=0, f2=0, ost=0, found=false;
  if(dash.getLastRow()>=2){
    var v=dash.getRange(2,1,dash.getLastRow()-1,11).getValues();
    for(var i=0;i<v.length;i++){
      var nom=String(v[i][0]||'').trim();
      if(nom!==obyekt) continue;
      cats.chel=_toNum(v[i][2]); cats.mash=_toNum(v[i][3]); cats.mat=_toNum(v[i][4]);
      cats.ob=_toNum(v[i][5]);   cats.mk=_toNum(v[i][6]);   cats.kab=_toNum(v[i][7]);
      smeta=_toNum(v[i][1]); fakt=_toNum(v[i][8]); f2=_toNum(v[i][9]); ost=_toNum(v[i][10]);
      found=true; break;
    }
  }
  if(!found) throw 'Обект DASHBOARD да топилмади: '+obyekt+' (аввал [Ишла] ва Dashboard янгилаш керак)';

  var bog=apiShartnomaBogOl();
  var shNo=bog[obyekt] || (typeof _cfgKalit==='function' ? bog[_cfgKalit(obyekt)] : '') || '';
  var nk=shNo?_nakrOl(shNo):_nakrOl();
  var nakrutka=nakrutkaHisob(cats, nk);

  // ⚡ 2026-07-04: avval BITTA umumiy koeffitsient (ВСЕГО/ПРЯМЫЕ) hammaga bir xil
  // qo'llanardi — noto'g'ri (ЧЕЛ/МАШ ga ТРАНСПОРТ/СКЛАД qadamlari umuman tegishli
  // emas). Endi har kategoriya uchun ANIQ marjinal koeffitsient (_nakrutkaKoefTable,
  // formula chiziqli bo'lgani uchun 100% aniq, approximatsiya emas).
  var kf=_nakrutkaKoefTable(nk);
  var umumiyKf = (nakrutka.pryamye>0) ? (nakrutka.vsego/nakrutka.pryamye) : 1; // orqaga moslik uchun saqlandi

  return {
    obyekt:obyekt, shNo:shNo||'—', cats:cats,
    smeta:smeta, fakt:fakt, f2:f2, ost:ost,
    nakrutka:nakrutka,
    umumiyKf:umumiyKf,
    kf:kf,
    narxlar:{
      chel:{sof:nakrutka.chel, bilan:nakrutka.chel*kf.ЧЕЛ},
      mash:{sof:nakrutka.mash, bilan:nakrutka.mash*kf.МАШ},
      mat:{sof:nakrutka.mat,  bilan:nakrutka.mat*kf.МАТ},
      ob:{sof:nakrutka.ob,    bilan:nakrutka.ob*kf.ОБ},
      kab:{sof:nakrutka.kab, bilan:nakrutka.kab*kf.КАБ}
    }
  };
}

/* ============ НАКРУТКА ЖАДВАЛИ — SMETANING O'ZIGA, ASOSIY ЛРВ PODVALIDA ============
 * 2026-07-04, foydalanuvchi talabi: накрутка Panel modalida ko'rinib, smetaning
 * o'zida (LRV_PLUS faylida) YO'Q edi — eski qo'lda tizimda F2 akt fayli LRV
 * varag'ining PODVALIDA (pastida) shu zanjir jonli formulalar bilan turgan.
 * ⚡ 2026-07-04 (кечқурун): birinchi versiya buni ALOHIDA "НАКРУТКА" varaqqa
 * yozgan edi — foydalanuvchi buni yoqtirmadi ("alohida listga tushib qolayapdi,
 * hujjatning ostida yoki tepasida bo'lishi kerak"). Endi ASOSIY "ЛРВ" varaqning
 * ENG OSTIGA (mavjud qatorlardan pastroqqa, A-C ustunlarga) yoziladi — aynan
 * eski qo'lda tizimdagi PODVAL joylashuvi kabi, alohida varaq YO'Q.
 * Har "ЛРВ*" varaqlarning ЖАМИ qatoridagi kategoriya ustunlaridan (ЧЕЛ/МАШ/МАТ/
 * ОБ/М-К/КАБ) LIVE cross-sheet formula bilan yig'ib, ПРЯМЫЕ→ВСЕГО zanjirini
 * quradi (nakrutkaHisob bilan bir xil mantiq). % ustuni ODDIY QIYMAT (shartnoma
 * override bo'lsa o'shandan, aks holda umumiy default) — DASHBOARD'ga BOG'LIQ EMAS.
 */
var NAKR_SHEET = 'НАКРУТКА';      // eski (bekor qilingan) alohida varaq nomi — migratsiya uchun
var NAKR_MARK  = '🧮 НАКРУТКА ZANJIRI';
function _nakrutkaSheetYoz(plus, obyekt){
  var col=CFG.C, CL=_cl;
  // Eski (bekor qilingan) alohida "НАКРУТКА" varaqni tozalaymiz — endi podvalda.
  var oldSep=plus.getSheetByName(NAKR_SHEET); if(oldSep){ try{ plus.deleteSheet(oldSep); }catch(e){} }

  // Har "ЛРВ*" varaqning ЖАМИ qatorini topamiz (bo'sh obyektda ЖАМИ bo'lmasligi mumkin);
  // asosiy varaq — nomi aynan CFG.LRV_SHEET ("ЛРВ", suffiksiz) bo'lgani, топилмаса biринчиси.
  var sheets=plus.getSheets(), jamiRows=[], mainSh=null;
  for(var s=0;s<sheets.length;s++){
    var sh=sheets[s], nm=sh.getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    if(!mainSh || nm===CFG.LRV_SHEET) mainSh=sh;
    var last=sh.getLastRow(); if(last<1) continue;
    var scan=Math.min(last,60);
    var vm=sh.getRange(1,col.MARKER,scan,1).getValues();
    for(var i=0;i<vm.length;i++){
      if(String(vm[i][0]||'').trim()==='ЖАМИ'){ jamiRows.push({nom:nm, row:i+1}); break; }
    }
  }
  if(!jamiRows.length || !mainSh) return; // hali ЖАМИ yo'q — накрутка ma'nosiz

  function katSum(c){
    return '=' + jamiRows.map(function(j){
      return "'"+j.nom.replace(/'/g,"''")+"'!"+CL(c)+j.row;
    }).join('+');
  }

  // Накрутка %лари — shartnomaga biriktirilgan bo'lsa override, aks holda umumiy default
  var bog=(typeof apiShartnomaBogOl==='function')?apiShartnomaBogOl():{};
  var shNo=bog[obyekt] || (typeof _cfgKalit==='function' ? bog[_cfgKalit(obyekt)] : '') || '';
  var nk=_nakrOl(shNo);
  function pct(key){ return nk[key]||0; }

  var sh=mainSh;
  // Oldingi накрутка bloki (shu podvalda, oldingi [Ишла]dan qolgan) bo'lsa — tozalaymiz.
  var mLast=sh.getLastRow();
  var oldStart=-1;
  if(mLast>0){
    var aCol=sh.getRange(1,1,mLast,1).getValues();
    for(var i=0;i<aCol.length;i++){
      if(String(aCol[i][0]||'').indexOf(NAKR_MARK)>=0){ oldStart=i+1; break; }
    }
  }
  if(oldStart>0) sh.getRange(oldStart,1,mLast-oldStart+1,3).clearContent().clearFormat();
  var r0 = oldStart>0 ? oldStart : sh.getLastRow()+3;

  sh.getRange(r0,1,1,3).setValues([[NAKR_MARK+' ('+(shNo?('шартнома '+shNo):'умумий default')+')','%','СУММА']])
    .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');

  // ⚡⚡⚡ 2026-07-05 STANDART FORMAT (foydalanuvchi 1-rasm) — aynan davlat namunasi
  //   tartibi/nomlari bilan. Qator raqamlari OLDINDAN belgilanadi (20 qator ketma-ket),
  //   shunda formulalar oldinga (masalan ИТОГО ПРЯМЫЕ → ОБОРУДОВАНИЯ qatoriga) murojaat
  //   qila oladi. Kategoriya jamilari (ЧЕЛ/МАШ/МАТ/ОБ/КАБ) ko'rinadigan qatorlarning
  //   O'ZIDA turadi; М/К va БЕЗ СКЛАД faqat склад formulasida inline ishlatiladi.
  var b0 = r0;                 // sarlavha qatori (yuqorida yozilgan)
  var rPry  = b0+1;  // ИТОГО ПРЯМЫЕ ЗАТРАТЫ
  var rChel = b0+2;  // ЗАТРАТЫ ТРУДА
  var rMash = b0+3;  // ЗАТРАТЫ МАШИН
  var rMat  = b0+4;  // МАТЕРИАЛЫ
  var rTrM  = b0+5;  // ТРАНСП. МАТ 5%
  var rSkl  = b0+6;  // СКЛАД. МАТ+М/К
  var rKab  = b0+7;  // КАБЕЛИ И ПРОВОДА
  var rTrK  = b0+8;  // ТРАНСП. КАБ 1.5%
  var rIt1  = b0+9;  // ИТОГО (оборудсиз)
  var rProch= b0+10; // ПРОЧИЕ 18%
  var rIt2  = b0+11; // ИТОГО
  var rOb   = b0+12; // ОБОРУДОВАНИЯ
  var rTrO  = b0+13; // ТРАНСП. ОБОРУД 2%
  var rZag  = b0+14; // ЗАГОТ-СКЛАД ОБОРУД 1.2%
  var rIt3  = b0+15; // ИТОГО
  var rStr  = b0+16; // СТРАХОВАНИЕ 0.32%
  var rRisk = b0+17; // КОЭФФ. РИСКА
  var rIt4  = b0+18; // ИТОГО
  var rNds  = b0+19; // НДС
  var rVseg = b0+20; // ВСЕГО

  var pTrM=pct('ТРАНСПОРТ_МАТЕРИАЛ'), pSkl=pct('СКЛАДСКИЕ_МАТЕРИАЛ'), pMk=pct('СКЛАДСКИЕ_МК'),
      pTrK=pct('ТРАНСПОРТ_КАБЕЛЬ'), pProch=pct('ПРОЧИЕ_ПОДРЯДЧИК'), pTrO=pct('ТРАНСПОРТ_ОБОРУД'),
      pZag=pct('ЗАГОТ_СКЛАД_ОБОРУД'), pStr=pct('СТРАХОВАНИЕ'), pRisk=pct('РИСК'), pNds=pct('НДС');
  var matS=katSum(col.MAT), mkS=katSum(col.MK), bezS=katSum(col.BEZSKLAD);

  var L=[
    // [row, label, %(yoki ''), formula, boldMi]
    [rPry,  'ИТОГО ПРЯМЫЕ ЗАТРАТЫ', '', '=C'+rChel+'+C'+rMash+'+C'+rMat+'+C'+rOb, 1],
    [rChel, 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ (В Т.Ч. СОЦСТРАХ 12%)', '', katSum(col.CHEL), 0],
    [rMash, 'ЗАТРАТЫ МАШИН И МЕХАНИЗМОВ', '', katSum(col.MASH), 0],
    [rMat,  'МАТЕРИАЛЫ', '', matS, 0],
    [rTrM,  'ТРАНСПОРТНЫЕ РАСХОДЫ НА МАТЕРИАЛЫ '+pTrM+'%', pTrM, '=(C'+rMat+'-C'+rKab+')*'+pTrM+'/100', 0],
    [rSkl,  'СКЛАДСКИЕ РАСХОДЫ НА МАТЕРИАЛЫ '+pSkl+'% И М/К '+pMk+'%', '', '=(C'+rMat+'-('+bezS.slice(1)+')-('+mkS.slice(1)+'))*'+pSkl+'/100+('+mkS.slice(1)+')*'+pMk+'/100', 0],
    [rKab,  'КАБЕЛИ И ПРОВОДА', '', katSum(col.KAB), 0],
    [rTrK,  'ТРАНСПОРТНЫЕ РАСХОДЫ НА КАБЕЛИ И ПРОВОДА '+pTrK+'%', pTrK, '=C'+rKab+'*'+pTrK+'/100', 0],
    [rIt1,  'ИТОГО', '', '=C'+rPry+'-C'+rOb+'+C'+rTrM+'+C'+rSkl+'+C'+rTrK, 1],
    [rProch,'ПРОЧИЕ ЗАТРАТЫ И РАСХОДЫ ПОДРЯДЧИКА '+pProch+'%', pProch, '=C'+rIt1+'*'+pProch+'/100', 0],
    [rIt2,  'ИТОГО', '', '=C'+rIt1+'+C'+rProch, 1],
    [rOb,   'ОБОРУДОВАНИЯ', '', katSum(col.OB), 0],
    [rTrO,  'ТРАНСПОРТНЫЕ РАСХОДЫ НА ОБОРУДОВАНИЯ '+pTrO+'%', pTrO, '=C'+rOb+'*'+pTrO+'/100', 0],
    [rZag,  'ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ НА ОБОРУДОВАНИЯ '+pZag+'%', pZag, '=C'+rOb+'*'+pZag+'/100', 0],
    [rIt3,  'ИТОГО', '', '=C'+rIt2+'+C'+rOb+'+C'+rTrO+'+C'+rZag, 1],
    [rStr,  'ЗАТРАТЫ НА СТРАХОВАНИЕ ОБЪЕКТА '+pStr+'%', pStr, '=C'+rIt3+'*'+pStr+'/100', 0],
    [rRisk, 'КОЭФФИЦИЕНТ РИСКА'+(pRisk?(' '+pRisk+'%'):''), pRisk, '=C'+rIt3+'*'+pRisk+'/100', 0],
    [rIt4,  'ИТОГО', '', '=C'+rIt3+'+C'+rStr+'+C'+rRisk, 1],
    [rNds,  'НДС '+pNds+'%', pNds, '=C'+rIt4+'*'+pNds+'/100', 0],
    [rVseg, 'ВСЕГО СТОИМОСТЬ СТРОИТЕЛЬСТВА В ТЕКУЩИХ ЦЕНАХ', '', '=C'+rIt4+'+C'+rNds, 2]
  ];
  L.forEach(function(x){
    sh.getRange(x[0],1).setValue(x[1]);
    sh.getRange(x[0],2).setValue(x[2]===''?'':x[2]);
    sh.getRange(x[0],3).setFormula(x[3]);
    if(x[4]===1) sh.getRange(x[0],1,1,3).setFontWeight('bold').setBackground('#ffe599');
    else if(x[4]===2) sh.getRange(x[0],1,1,3).setFontWeight('bold').setBackground('#2e7d32').setFontColor('#ffffff');
  });
  sh.getRange(rPry,3,20,1).setNumberFormat('#,##0.####');
  sh.getRange(rPry,2,20,1).setNumberFormat('0.####');
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

function apiShartnomaBogFullOl(){
  var sh=_bogSheet(), m={};
  if(sh.getLastRow()>=2){
    var maxCols = sh.getMaxColumns();
    var cols = Math.min(3, maxCols);
    if(cols >= 2){
      var v=sh.getRange(2,1,sh.getLastRow()-1,cols).getValues();
      for(var i=0;i<v.length;i++){
        var ob=String(v[i][0]||'').trim();
        var no=String(v[i][1]||'').trim();
        var soni=(cols>=3)?(parseFloat(v[i][2])||1):1;
        if(ob) m[ob]={no:no, soni:soni};
      }
    }
  }
  return m;
}

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

function apiShartnomaBogSaqla(obyekt, shartnomaNo, soni){
  var sh=_bogSheet(), last=sh.getLastRow(), found=0;
  obyekt=String(obyekt||'').trim();
  soni=parseFloat(soni)||1;
  if(!obyekt) throw 'Объект бўш';
  if(last>=2){
    var v=sh.getRange(2,1,last-1,1).getValues();
    for(var i=0;i<v.length;i++) if(String(v[i][0]).trim()===obyekt){ found=i+2; break; }
  }
  var no=String(shartnomaNo||'').trim();
  
  // Ensure the sheet has at least 3 columns to save the 'soni'
  if(sh.getMaxColumns() < 3) {
    sh.insertColumnAfter(sh.getMaxColumns());
    sh.getRange(1, 3).setValue('СОНИ').setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
  }

  if(found){
    if(no) sh.getRange(found,2,1,2).setValues([[no, soni]]);
    else sh.deleteRow(found);   // bo'sh → biriktirish o'chiriladi
  } else if(no){
    sh.appendRow([obyekt, no, soni]);
  }
  return {ok:true, xabar:obyekt+' → '+(no||'(бўшатилди)')+(soni>1?' (x'+soni+')':'')};
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
  var bogFull=(typeof apiShartnomaBogFullOl==='function')?apiShartnomaBogFullOl():{};
  for(var o=0;o<obRows.length;o++){
    var r=obRows[o];
    var kalit = (typeof _cfgKalit==='function') ? _cfgKalit(r.obyekt) : r.obyekt;
    
    var bg=bogFull[r.obyekt];
    if(!bg) bg=bogFull[kalit];
    if(!bg) bg={no:'',soni:1};
    
    var no=bg.no || bog[r.obyekt] || bog[kalit] || '—';
    var soni=bg.soni || 1;
    
    var G=g(no);
    
    var vSmeta = r.smeta * soni;
    var vChel = r.chel * soni;
    var vMash = r.mash * soni;
    var vMat = r.mat * soni;
    var vOb = r.ob * soni;
    var vMk = r.mk * soni;
    var vKab = r.kab * soni;
    var vFakt = r.fakt * soni;
    var vF2 = r.f2 * soni;
    var vOst = r.ost * soni;
    
    // Jamlash: agar obyektlar bitta papkadan bo'lsa (kalit bir xil), ularni qo'shib yuboramiz
    var gName = kalit + (soni>1 ? ' (x'+soni+')' : '');
    var existing = null;
    for(var e=0; e<G.obyektlar.length; e++){
      if(G.obyektlar[e].obyekt === gName) {
        existing = G.obyektlar[e];
        break;
      }
    }
    
    if(existing) {
      existing.smeta += vSmeta;
      existing.chel += vChel;
      existing.mash += vMash;
      existing.mat += vMat;
      existing.ob += vOb;
      existing.mk += vMk;
      existing.kab += vKab;
      existing.fakt += vFakt;
      existing.f2 += vF2;
      existing.ost += vOst;
    } else {
      var mR = {
        obyekt: gName,
        obyektAsl: kalit,
        soni: soni,
        smeta: vSmeta,
        chel: vChel,
        mash: vMash,
        mat: vMat,
        ob: vOb,
        mk: vMk,
        kab: vKab,
        fakt: vFakt,
        f2: vF2,
        ost: vOst
      };
      G.obyektlar.push(mR);
    }
    
    G.smeta+=vSmeta; G.fakt+=vFakt; G.f2+=vF2; G.ost+=vOst;
    G.cats.chel+=vChel; G.cats.mash+=vMash; G.cats.mat+=vMat;
    G.cats.ob+=vOb; G.cats.mk+=vMk; G.cats.kab+=vKab;
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
    // ⚡⚡⚡ 2026-07-10: НАКРУТКА-МУВОФИҚ Ф2/ФАКТ. Фойдаланувчи кўрсатган хато:
    //   ШАРТНОМА суммаси (dog_summa) фойдаланувчи қўлда киритган, НДС/накрутка
    //   БИЛАН якуний рақам. Ф2/ФАКТ эса LRV'дан тоза (накрутkasiz, faqat
    //   ПРЯМЫЕ) келади. Тоза Ф2 ни накрутkali dog_summa'ga тўғридан-тўғри
    //   бўлиш — foiz сунъий КАМ чиқаради (apples-to-oranges). Аниқ ечим —
    //   Ф2/ФАКТ ни ҲАМ шу шартнома учун ҳисобланган СМЕТА→ВСЕГО коэффициенти
    //   билан кўпайтириб, тахминий "накрутkali эквивалент"га келтирамиз.
    //   (100% aniq emas — Ф2 kategoriya tarkibi butun smetadan farq qilishi
    //   mumkin — lekin toza/накрутkali aralashishidan ANCHA to'g'ri.)
    var _nkRatio = G3.nakrutka.pryamye>0 ? (G3.nakrutka.vsego/G3.nakrutka.pryamye) : 1;
    G3.nkRatio = _nkRatio;
    G3.jamiFaktNakr = G3.jamiFakt * _nkRatio;
    G3.jamiF2Nakr = G3.jamiF2 * _nkRatio;
    out.push(G3);
  }
  // Tartib: avval shartnomalilar, '—' oxirida
  out.sort(function(x,y){
    if(x.no==='—') return 1; if(y.no==='—') return -1;
    return x.no<y.no?-1:1;
  });
  return {shartnomalar:out, nakrutkaKoef:nk, obyektSoni:obRows.length};
}
