/********************************************************************
 * 15_IshTurlar.gs — ISH TURLARI KUTUBXONASI
 * ==================================================================
 * Har bir bl + uning rs/mat bolalari = bitta "ish turi" massivi.
 * Barcha obyektlar ishlanganda kutubxona avtomatik to'ldiriladi.
 *
 * XAVFSIZLIK:
 *   - Mavjud qatorlarga HECH QACHON tegmaydi
 *   - Faqat insertRowsAfter ishlatiladi
 *   - Yangi qatorlar marker + bilan belgilanadi (bl+, rs+)
 *   - Kutubxona faqat yangi yozuvlar qo'shadi (ustiga yozmaydi)
 *
 * API:
 *   _ishTurlarYig(plus, obyekt, fmt)  → ishlanganda chaqiriladi
 *   apiIshTurQidir(query, limit)      → qidiruv natijalari
 *   apiIshTurQosh(params)             → LRV ga bl+/rs+ qo'shadi
 *   apiIshTurBarchasi()               → to'liq kutubxona
 ********************************************************************/

var _ITK_SH  = '_ISHTURLAR';   // kutubxona varaq nomi
var _ITK_COLS = 7;             // KEY|BL_KOD|BL_NOM|BL_BIRLIK|FORMAT|MANBA|RS_JSON


/* ============================================================
 * 1. YIGISH — har ishlangandan keyin bl+rs larni saqlash
 * ============================================================ */
function _ishTurlarYig(plus, obyekt, fmt){
  var col = CFG.C;
  var sheets = plus.getSheets();
  var items = {};

  for(var s = 0; s < sheets.length; s++){
    var sh = sheets[s];
    if(sh.getName().indexOf(CFG.LRV_SHEET) !== 0) continue;
    var last = sh.getLastRow();
    var start = _autoData(sh);
    if(last < start) continue;
    var n = last - start + 1;
    // E ustunigacha o'qiymiz (hajm va norm uchun)
    var v = sh.getRange(start, 1, n, col.MARKER).getValues();

    var curBl = null, curRs = [];

    for(var i = 0; i < n; i++){
      var mk = String(v[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');

      if(mk === 'rz'){
        _itkFlush(items, curBl, curRs, obyekt, fmt);
        curBl = null; curRs = [];

      } else if(mk === 'bl'){
        _itkFlush(items, curBl, curRs, obyekt, fmt);
        curBl = {
          kod:    String(v[i][col.KOD-1]   ||'').trim(),
          nom:    String(v[i][col.NOM-1]   ||'').trim(),
          birlik: String(v[i][col.BIRLIK-1]||'').trim(),
          e:      _toNum(v[i][col.E-1])          // hajm (norm birlikda)
        };
        curRs = [];

      } else if(mk === 'rs' && curBl){
        var norm = _toNum(v[i][col.E-1]);  // rs.E = norm per bl unit
        // Agar F da formula bo'lsa: F = bl.E × rs.E → norm = rs.E (to'g'ri)
        curRs.push({
          kod:    String(v[i][col.KOD-1]   ||'').trim(),
          nom:    String(v[i][col.NOM-1]   ||'').trim(),
          birlik: String(v[i][col.BIRLIK-1]||'').trim(),
          norm:   norm
          // cat keyinroq _findPrice orqali to'ldiriladi
        });

      } else if((mk === 'mat' || mk === 'ob')){
        _itkFlush(items, curBl, curRs, obyekt, fmt);
        curBl = null; curRs = [];
      }
    }
    _itkFlush(items, curBl, curRs, obyekt, fmt);
  }

  return _itkSaqlaBatch(items);
}

function _itkFlush(items, bl, rs, manba, fmt){
  if(!bl || !bl.nom || !bl.birlik || !rs.length) return;
  var key = _itkKey(bl.nom, bl.birlik);
  if(items[key]) return;  // birinchi manba ustunlik qiladi
  items[key] = {
    key:      key,
    blKod:    bl.kod,
    blNom:    bl.nom,
    blBirlik: bl.birlik,
    fmt:      fmt || 'TN',
    manba:    manba,
    sana:     Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd'),
    rs:       rs
  };
}

function _itkKey(nom, birlik){
  var s = _norm(nom) + '||' + _normBirlik(birlik);
  var h = 5381;
  for(var i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) & 0x7fffffff;
  return h.toString(36);
}

function _itkSaqlaBatch(items){
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(_ITK_SH);

  // Mavjud keylarni yig'amiz
  var existing = {};
  if(sh && sh.getLastRow() >= 2){
    var ev = sh.getRange(2, 1, sh.getLastRow()-1, 1).getValues();
    for(var i = 0; i < ev.length; i++){
      var k = String(ev[i][0]||'').trim();
      if(k) existing[k] = true;
    }
  }

  if(!sh){
    sh = ss.insertSheet(_ITK_SH);
    sh.getRange(1,1,1,_ITK_COLS)
      .setValues([['KEY','BL_KOD','BL_NOM','BL_BIRLIK','FORMAT','MANBA','RS_JSON']])
      .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidth(1,80); sh.setColumnWidth(2,120);
    sh.setColumnWidth(3,420); sh.setColumnWidth(4,90);
    sh.setColumnWidth(5,70);  sh.setColumnWidth(6,140);
    sh.setColumnWidth(7,600);
    sh.hideSheet();
  }

  // Faqat yangi yozuvlarni qo'shamiz
  var newRows = [];
  for(var key in items){
    if(existing[key]) continue;
    var it = items[key];
    newRows.push([
      it.key, it.blKod, it.blNom, it.blBirlik,
      it.fmt, it.manba, JSON.stringify(it.rs)
    ]);
  }
  if(newRows.length){
    sh.getRange(sh.getLastRow()+1, 1, newRows.length, _ITK_COLS).setValues(newRows);
  }
  return newRows.length;
}


/* ============================================================
 * 2. QIDIRUV — nom/kod/birlik bo'yicha
 * ============================================================ */
function apiIshTurQidir(query, limit){
  var sh = SpreadsheetApp.getActive().getSheetByName(_ITK_SH);
  if(!sh || sh.getLastRow() < 2) return [];

  var v = sh.getRange(2, 1, sh.getLastRow()-1, _ITK_COLS).getValues();
  var q = _norm((query||'').trim());
  var results = [];

  for(var i = 0; i < v.length; i++){
    var key    = String(v[i][0]||'').trim();
    var blKod  = String(v[i][1]||'').trim();
    var blNom  = String(v[i][2]||'').trim();
    var blBir  = String(v[i][3]||'').trim();
    var fmt    = String(v[i][4]||'TN');
    var manba  = String(v[i][5]||'');
    var nomU   = _norm(blNom);
    var kodU   = blKod.toUpperCase();

    if(!key || !blNom) continue;

    var score = 0;
    if(q){
      if(nomU === q)                    score = 100;
      else if(nomU.indexOf(q) === 0)    score = 80;
      else if(nomU.indexOf(q) >= 0)     score = 60;
      else if(kodU.indexOf(query.toUpperCase()) >= 0) score = 70;
      else {
        var qt = _tok(q), nt = _tok(nomU), m = 0;
        for(var t in qt) if(nt[t]) m++;
        if(m > 0) score = m * 15;
      }
    } else {
      score = 1; // bo'sh query → hammasi
    }

    if(score > 0){
      var rsRaw = v[i][6];
      var rs = [];
      try { rs = JSON.parse(rsRaw || '[]'); } catch(e){}
      results.push({
        key: key, blKod: blKod, blNom: blNom, blBirlik: blBir,
        fmt: fmt, manba: manba, rs: rs, score: score
      });
    }
  }

  results.sort(function(a,b){ return b.score - a.score; });
  return limit ? results.slice(0, limit) : results;
}

function apiIshTurBarchasi(){
  return apiIshTurQidir('', 500);
}


/* ============================================================
 * 3. QO'SHISH — xavfsiz insertRowsAfter, mavjud qatorlarga tegmaydi
 *
 * params = {
 *   obyekt:      string,        — ob'ekt nomi
 *   varaq:       string,        — "LRV" yoki "LRV_2"
 *   afterRow:    number,        — shu qatordan KEYIN qo'shiladi
 *   key:         string,        — kutubxona ish turi KEY si
 *   hajm:        number,        — bl.E (foydalanuvchi kiritadi)
 * }
 * ============================================================ */
function apiIshTurQosh(params){
  var obyekt    = params.obyekt;
  var varaqNom  = params.varaq;
  var afterRow  = Number(params.afterRow);
  var key       = params.key;
  var hajm      = _toNum(params.hajm);

  if(!obyekt || !varaqNom || !afterRow || !key)
    throw 'Parametrlar to\'liq emas';
  if(hajm <= 0)
    throw 'Hajm 0 dan katta bo\'lishi kerak';

  // Kutubxonadan ish turini olamiz
  var it = _itkOl(key);
  if(!it) throw 'Ish turi topilmadi (key=' + key + ')';

  // LRV_PLUS faylini ochamiz
  var plus = _plusTop(obyekt);
  if(!plus) throw 'LRV_PLUS topilmadi — avval "Qayta qur" qiling';

  var sh = plus.getSheetByName(varaqNom);
  if(!sh) throw 'Varaq topilmadi: ' + varaqNom;

  // Joriy so'nggi qator sanasini tekshiramiz —
  // afterRow sheet chegarasidan chiqmasin
  if(afterRow < 1 || afterRow > sh.getLastRow())
    throw 'afterRow noto\'g\'ri: ' + afterRow;

  var col = CFG.C, CL = _cl;
  var nRows = 1 + it.rs.length;   // bl+ + rs+ lar

  // ── XAVFSIZ QATOR QOSHISH ──────────────────────────────────
  sh.insertRowsAfter(afterRow, nRows);
  // Endi: afterRow+1 = bl+,  afterRow+2..afterRow+nRows = rs+
  var blRow = afterRow + 1;
  var c1    = blRow + 1;
  var c2    = blRow + it.rs.length;

  // Narx bazasini bir marta yuklaymiz
  var pdb = _itkPdb(obyekt);
  var a = sozAsosiy(), kat = sozKategoriya(), fm = sozFaktNarx(), nkM = _narxlarKatMap();
  var oylar = _f2Oylar(sh);

  // BATCH: barcha qatorlarni xotirada qurib, bitta yozish
    var maxCol = col.ST_OST;
  if(oylar.length > 0) maxCol = oylar[oylar.length-1].col + 2;
  var width = maxCol;
  var allData = [];

  // BL+ qatori
  var blData = []; for(var c=0;c<width;c++) blData.push('');
  blData[col.NO-1]=''; blData[col.KOD-1]=it.blKod; blData[col.NOM-1]=it.blNom;
  blData[col.BIRLIK-1]=it.blBirlik; blData[col.E-1]=hajm; blData[col.F-1]=hajm;
  blData[col.MARKER-1]='bl+'; blData[col.FAKT-1]=0;
  blData[col.QOLDIQ-1]='=$'+CL(col.E)+blRow+'-$'+CL(col.FAKT)+blRow;
  blData[col.F2OL-1]=_f2sum(blRow,0,_f2OyCols(sh));
  blData[col.F2MUM-1]='=$'+CL(col.FAKT)+blRow+'-$'+CL(col.F2OL)+blRow;
    if(col.H_BL) blData[col.H_BL-1]=it.blNom;
  for(var o=0;o<oylar.length;o++){
    var oc = oylar[o].col;
    blData[oc-1]=0;
    blData[oc]='=$'+CL(col.NARX)+blRow;
    blData[oc+1]='=$'+CL(oc)+blRow+'*$'+CL(oc+1)+blRow;
  }
  allData.push(blData);

  // RS+ qatorlar
  for(var i=0;i<it.rs.length;i++){
    var rs=it.rs[i], r=blRow+1+i;
    var row=[]; for(var c=0;c<width;c++) row.push('');
    row[col.KOD-1]=rs.kod; row[col.NOM-1]=rs.nom; row[col.BIRLIK-1]=rs.birlik;
    row[col.E-1]=rs.norm;
    row[col.F-1]='='+CL(col.E)+'$'+blRow+'*'+CL(col.E)+r;
    row[col.MARKER-1]='rs+';
    var p=pdb?_findPrice(rs.nom,rs.birlik,rs.kod,pdb,kat,fm,a,nkM):{narx:0,cat:'МАТ'};
    row[col.NARX-1]=p.narx;
    row[col.SMETA-1]='=$'+CL(col.F)+r+'*$'+CL(col.NARX)+r;
    var cat=(p.cat||rs.cat||'МАТ').toUpperCase();
    var mainC=(cat==='КАБ'||cat==='КАБЕЛ')?'МАТ':cat;
    var ref='=$'+CL(col.SMETA)+r;
    if(mainC==='ЧЕЛ') row[col.CHEL-1]=ref;
    else if(mainC==='МАШ') row[col.MASH-1]=ref;
    else if(mainC==='ОБ'||mainC==='ОБОР') row[col.OB-1]=ref;
    else if(mainC==='МК'||mainC==='М/К') row[col.MK-1]=ref;
    else row[col.MAT-1]=ref;
    row[col.FAKT-1]='='+CL(col.FAKT)+'$'+blRow+'*'+CL(col.E)+r;
    row[col.QOLDIQ-1]='=$'+CL(col.F)+r+'-$'+CL(col.FAKT)+r;
    row[col.F2OL-1]=_f2sum(r,0,_f2OyCols(sh));
    row[col.F2MUM-1]='=$'+CL(col.FAKT)+r+'-$'+CL(col.F2OL)+r;
    row[col.ST_RES-1]='=$'+CL(col.SMETA)+r;
    row[col.ST_FAKT-1]='=$'+CL(col.FAKT)+r+'*$'+CL(col.NARX)+r;
    row[col.ST_F2-1]=_f2sum(r,2,_f2OyCols(sh));
    row[col.ST_OST-1]='=$'+CL(col.F2MUM)+r+'*$'+CL(col.NARX)+r;
        for(var o=0;o<oylar.length;o++){
      var oc = oylar[o].col;
      row[oc-1]='='+CL(oc)+'$'+blRow+'*'+CL(col.E)+r;
      row[oc]='=$'+CL(col.NARX)+r;
      row[oc+1]='=$'+CL(oc)+r+'*$'+CL(oc+1)+r;
    }
    allData.push(row);
  }

  // BL+ SMETA va ST formulalari (rs lar bor bo'lsa)
  if(it.rs.length>0){
    allData[0][col.SMETA-1]='=SUM($'+CL(col.SMETA)+c1+':$'+CL(col.SMETA)+c2+')';
    allData[0][col.ST_RES-1]='=SUM($'+CL(col.ST_RES)+c1+':$'+CL(col.ST_RES)+c2+')';
    allData[0][col.ST_FAKT-1]='=SUM($'+CL(col.ST_FAKT)+c1+':$'+CL(col.ST_FAKT)+c2+')';
    allData[0][col.ST_F2-1]='=SUM($'+CL(col.ST_F2)+c1+':$'+CL(col.ST_F2)+c2+')';
    allData[0][col.ST_OST-1]='=SUM($'+CL(col.ST_OST)+c1+':$'+CL(col.ST_OST)+c2+')';
  }

  // BITTA YOZISH (avval 200+ API call edi → endi 1 ta)
  sh.getRange(blRow,1,nRows,width).setValues(allData);
  // Rang
  if(it.rs.length>0) sh.getRange(c1,1,it.rs.length,width).setBackground(CFG.RANG_QOSH);

  // BL+ rangi
  sh.getRange(blRow, 1, 1, col.ST_OST).setBackground(CFG.RANG_QOSH);
  sh.getRange(blRow, 1, 1, col.ST_OST).setFontColor(null);

  SpreadsheetApp.flush();
  return {
    ok:     true,
    blRow:  blRow,
    nRows:  nRows,
    blNom:  it.blNom,
    xabar:  '✅ Qo\'shildi: ' + it.blNom + ' (' + hajm + ' ' + it.blBirlik + ')'
  };
}


/* ============================================================
 * 4. YORDAMCHI FUNKSIYALAR
 * ============================================================ */
function _itkOl(key){
  var sh = SpreadsheetApp.getActive().getSheetByName(_ITK_SH);
  if(!sh || sh.getLastRow() < 2) return null;
  var v = sh.getRange(2, 1, sh.getLastRow()-1, _ITK_COLS).getValues();
  for(var i = 0; i < v.length; i++){
    if(String(v[i][0]).trim() === key){
      var rs = [];
      try { rs = JSON.parse(v[i][6] || '[]'); } catch(e){}
      return {
        key: String(v[i][0]), blKod: String(v[i][1]),
        blNom: String(v[i][2]), blBirlik: String(v[i][3]),
        fmt: String(v[i][4]), manba: String(v[i][5]), rs: rs
      };
    }
  }
  return null;
}

// Svodkadan narx bazasini yuklash (bir martalik)
function _itkPdb(obyekt){
  try {
    var obs = papkaSkan(), target = null;
    for(var i = 0; i < obs.length; i++)
      if(obs[i].obyekt === obyekt){ target = obs[i]; break; }
    if(!target || !target.svodFile) return null;
    var fmt    = _normFormat(target.format || 'TN');
    var svodCfg = (fmt === 'ABC4') ? CFG.SVOD_ABC : CFG.SVOD_TN;
    var kat    = sozKategoriya();
    var svodSS = _openAsSheet(target.svodFile, target.folderId);
    var savedOraliq = _oraliqlarOl(obyekt);
    var pdb    = _priceDB(svodSS, kat, svodCfg, fmt, [], savedOraliq);
    _cleanupTmp(svodSS);
    return pdb;
  } catch(e){ return null; }
}

// afterRow ni aniqlash: tanlangan bl ning so'nggi rs/mat bolasi
function apiIshTurAfterRow(obyekt, varaq, blRow){
  var plus = _plusTop(obyekt);
  if(!plus) return {afterRow: blRow};
  var sh = plus.getSheetByName(varaq);
  if(!sh) return {afterRow: blRow};
  var col = CFG.C;
  var last = sh.getLastRow();
  if(blRow >= last) return {afterRow: blRow};
  var n = last - blRow;
  var v = sh.getRange(blRow+1, col.MARKER, n, 1).getValues();
  var lastChild = blRow;
  for(var i = 0; i < v.length; i++){
    var mk = String(v[i][0]||'').trim().toLowerCase().replace(/[+~]$/,'');
    if(mk === 'bl' || mk === 'rz') break;
    if(mk === 'rs' || (mk === 'mat' || mk === 'ob')) lastChild = blRow + 1 + i;
  }
  return {afterRow: lastChild};
}


/* ============================================================
 * 5. SHAXSIY SMETA YASAGICH
 * ============================================================ */
function apiShaxsiySmetaYarat(config, ishlar){
  if(!config || !config.nom) throw 'Смета номини киритинг';
  if(!ishlar || !ishlar.length) throw 'Камида битта иш тури танланг';

  var chelStavka = _toNum(config.chelStavka);
  var narxMap = _shSmetaNarxMap();
  var items = [];

  for(var i = 0; i < ishlar.length; i++){
    var hajm = _toNum(ishlar[i].hajm);
    if(hajm <= 0) continue;
    var blJami = 0;
    var rsItems = [];
    var rsList = ishlar[i].rs || [];
    for(var r = 0; r < rsList.length; r++){
      var rs = rsList[r];
      var birlikU = String(rs.birlik||'').trim().toUpperCase();
      var narx = 0;
      var nomUpper = String(rs.nom||'').toUpperCase();
      
      var rCat = rs.cat;
      var tempCat = rCat;
      if(!tempCat) {
         if(nomUpper.indexOf('ТРУДА МАШИНИСТОВ') !== -1) tempCat = 'MASH';
         else if(birlikU.indexOf('ЧЕЛ') !== -1) tempCat = 'MEH';
         else if(birlikU.indexOf('МАШ') !== -1) tempCat = 'MASH';
         else if(nomUpper.indexOf('ОБОРУДОВАН') !== -1 || nomUpper.indexOf('УСТАНОВКА') !== -1) tempCat = 'OBOR';
         else tempCat = 'MAT';
      }

      if(nomUpper.indexOf('ТРУДА МАШИНИСТОВ') !== -1) {
        narx = 0; // Mashinist ish haqi mashina narxida hisoblanadi
      } else if(tempCat === 'MEH' && chelStavka > 0){
        narx = chelStavka;
      } else if(rs.narx !== undefined && rs.narx !== null && String(rs.narx).trim() !== '') {
        narx = _toNum(rs.narx);
      } else {
        narx = _shSmetaNarx(rs.nom, rs.birlik, narxMap);
      }
      
      var rsHajm = hajm * _toNum(rs.norm);
      var rsSumma = rsHajm * narx;
      blJami += rsSumma;
      rsItems.push({ nom:rs.nom, birlik:rs.birlik, norm:_toNum(rs.norm), hajm:rsHajm, narx:narx, summa:rsSumma, kod:rs.kod||'' });
    }
    items.push({ nom:ishlar[i].nom, birlik:ishlar[i].birlik, kod:ishlar[i].kod, hajm:hajm, rs:rsItems, jami:blJami });
  }
  if(!items.length) throw 'Ишлар топилмади кутубхонада';

  var ss = SpreadsheetApp.create('СМЕТА — ' + config.nom);
  var sh = ss.getSheets()[0];
  sh.setName('ЛОКАЛЬНАЯ СМЕТА');
  sh.setColumnWidth(1,50); sh.setColumnWidth(2,120); sh.setColumnWidth(3,350);
  sh.setColumnWidth(4,70); sh.setColumnWidth(5,80); sh.setColumnWidth(6,90); 
  sh.setColumnWidth(7,100); sh.setColumnWidth(8,120); 
  sh.setColumnWidth(9,90); sh.setColumnWidth(10,90); sh.setColumnWidth(11,90); sh.setColumnWidth(12,90);
  sh.setColumnWidth(13,40);
  var row = 1, W = 13;

  // ШАПКА — Тасдиқлаш
  sh.getRange(row,1,1,3).merge().setValue('ТАСДИҚЛАЙМАН:').setFontWeight('bold');
  sh.getRange(row,5,1,3).merge().setValue('"РОЗИМАН":').setFontWeight('bold');
  row++;
  sh.getRange(row,1,1,3).merge().setValue(config.zakazchik||'Заказчик');
  sh.getRange(row,5,1,3).merge().setValue(config.podryad||'Подрядчик');
  row++;
  sh.getRange(row,1,1,3).merge().setValue('_____________ '+(config.zakFio||'')).setFontStyle('italic');
  sh.getRange(row,5,1,3).merge().setValue('_____________ '+(config.podFio||'')).setFontStyle('italic');
  row++;
  sh.getRange(row,1,1,3).merge().setValue('"___" _____________ 20___ й.');
  sh.getRange(row,5,1,3).merge().setValue('"___" _____________ 20___ й.');
  row += 2;

  // Смета номи
  sh.getRange(row,1,1,W).merge()
    .setValue((config.raqam?config.raqam+' — ':'')+config.nom)
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  row++;
  if(config.obyekt){
    sh.getRange(row,1,1,W).merge().setValue('Объект: '+config.obyekt)
      .setFontSize(11).setHorizontalAlignment('center').setFontColor('#333333');
    row++;
  }
  if(config.loyihachi){
    sh.getRange(row,1,1,W).merge().setValue('Лойиҳачи: '+config.loyihachi)
      .setFontSize(10).setHorizontalAlignment('center').setFontColor('#666666');
    row++;
  }
  if(config.sana){
    sh.getRange(row,1,1,W).merge().setValue('Сана: '+config.sana)
      .setFontSize(10).setHorizontalAlignment('center').setFontColor('#666666');
    row++;
  }
  row++;

  // ЖАДВАЛ САРЛАВҲАСИ
  sh.getRange(row,1,1,W).setValues([['№','Шифр, Номера нормативов','Наименование работ и затрат','Ед. изм.','Норма / Объем','Общий объем','Цена на ед., сум','ВСЕГО затрат, сум', 'З/пл', 'Эксп.маш', 'Мат.рес', 'Оборуд.', 'Маркер']])
    .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff')
    .setHorizontalAlignment('center').setBorder(true,true,true,true,true,true);
  sh.getRange(row,1,1,W).setWrap(true);
  sh.setRowHeight(row, 40);
  sh.setFrozenRows(row);
  row++;

  // ИШЛАР
  for(var b = 0; b < items.length; b++){
    var bl = items[b];
    var blRow = row;
    
    // BL qatori (Hajmni E ustunga, formula H ustunga yoziladi)
    sh.getRange(row,1,1,W).setValues([[(b+1), bl.kod||'', bl.nom, bl.birlik, bl.hajm, '', '', '', '', '', '', '', 'bl']]);
    sh.getRange(row,1,1,W).setFontWeight('bold').setBackground('#4a86e8').setFontColor('#ffffff')
      .setBorder(true,true,true,true,true,true);
    sh.getRange(row,1,1,W).setWrap(true);
    sh.getRange(row,8,1,5).setNumberFormat('#,##0.00');
    row++;
    
    var rsStartRow = row;
    // Kategoriyalash funksiyasi
    var getCat = function(nom, birlik, rCat) {
      if(rCat) return rCat;
      var nU = String(nom||'').toUpperCase();
      var bU = String(birlik||'').toUpperCase();
      if(nU.indexOf('ТРУДА МАШИНИСТОВ') !== -1) return 'MASH';
      if(bU.indexOf('ЧЕЛ') !== -1) return 'MEH';
      if(bU.indexOf('МАШ') !== -1) return 'MASH';
      if(nU.indexOf('ОБОРУДОВАН') !== -1 || nU.indexOf('УСТАНОВКА') !== -1) return 'OBOR';
      return 'MAT';
    };

    // RS qatorlari
    bl.rs.sort(function(a, b){
      var cA = getCat(a.nom, a.birlik, a.cat);
      var cB = getCat(b.nom, b.birlik, b.cat);
      var w = { 'MEH': 1, 'MASH': 2, 'MAT': 3, 'OBOR': 4 };
      if(w[cA] !== w[cB]) return w[cA] - w[cB];
      return String(a.kod||'').localeCompare(String(b.kod||''));
    });

    for(var ri = 0; ri < bl.rs.length; ri++){
      var rsi = bl.rs[ri];
      sh.getRange(row,1,1,W).setValues([[(b+1)+'.'+(ri+1), rsi.kod||'', rsi.nom, rsi.birlik, rsi.norm, '', rsi.narx, '', '', '', '', '', 'rs']]);
      // Formulalar
      sh.getRange(row,6).setFormula('=E'+row+'*E'+blRow); // F = norm * bl_hajm
      sh.getRange(row,8).setFormula('=F'+row+'*G'+row);   // H = F * narx
      
      var cat = getCat(rsi.nom, rsi.birlik, rsi.cat);
      if(cat === 'MEH'){
        sh.getRange(row,9).setFormula('=H'+row); // I = З/пл
      } else if(cat === 'MASH'){
        sh.getRange(row,10).setFormula('=H'+row); // J = Эксп.маш
      } else if(cat === 'OBOR'){
        sh.getRange(row,12).setFormula('=H'+row); // L = Оборуд
      } else {
        sh.getRange(row,11).setFormula('=H'+row); // K = Мат.рес
      }
      
      sh.getRange(row,1,1,W).setFontColor('#1155cc').setFontStyle('italic')
        .setBorder(true,true,true,true,true,true);
      sh.getRange(row,1,1,W).setWrap(true);
      sh.getRange(row,5).setNumberFormat('#,##0.000');
      sh.getRange(row,6).setNumberFormat('#,##0.000');
      sh.getRange(row,7).setNumberFormat('#,##0.00');
      sh.getRange(row,8,1,5).setNumberFormat('#,##0.00');
      row++;
    }
    
    // BL uchun jami formula
    if(row > rsStartRow){
      sh.getRange(blRow, 8).setFormula('=SUM(H'+rsStartRow+':H'+(row-1)+')');
      sh.getRange(blRow, 9).setFormula('=SUM(I'+rsStartRow+':I'+(row-1)+')');
      sh.getRange(blRow, 10).setFormula('=SUM(J'+rsStartRow+':J'+(row-1)+')');
      sh.getRange(blRow, 11).setFormula('=SUM(K'+rsStartRow+':K'+(row-1)+')');
      sh.getRange(blRow, 12).setFormula('=SUM(L'+rsStartRow+':L'+(row-1)+')');
    } else {
      sh.getRange(blRow, 8, 1, 5).setValue(0);
    }
  }

  // ЖАМИ ПОДВАЛ (СВОД)
  row++;
  var startRow = 8; // Jadval boshlangan qator (headerdan keyingi)
  var jamiRow = row;

  var addFooter = function(title, unit, formula, isBold) {
     sh.getRange(row, 1, 1, 6).merge().setValue(title).setHorizontalAlignment('left').setWrap(true);
     if(isBold) sh.getRange(row, 1, 1, 6).setFontWeight('bold');
     sh.getRange(row, 7).setValue(unit).setHorizontalAlignment('center');
     sh.getRange(row, 8).setFormula(formula).setNumberFormat('#,##0.00');
     if(isBold) sh.getRange(row, 8).setFontWeight('bold');
     sh.getRange(row, 1, 1, 8).setBorder(true,true,true,true,true,true);
     return row++;
  };

  addFooter('ИТОГО ПРЯМЫЕ ЗАТРАТЫ', 'СУМ', '=SUMIF(M'+startRow+':M'+(jamiRow-1)+', "bl", H'+startRow+':H'+(jamiRow-1)+')', true);
  var mehRow = addFooter('ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ (В Т.Ч. СОЦСТРАХ 12%)', 'СУМ', '=SUMIF(M'+startRow+':M'+(jamiRow-1)+', "bl", I'+startRow+':I'+(jamiRow-1)+')', false);
  var mashRow = addFooter('ЗАТРАТЫ МАШИН И МЕХАНИЗМОВ', 'СУМ', '=SUMIF(M'+startRow+':M'+(jamiRow-1)+', "bl", J'+startRow+':J'+(jamiRow-1)+')', false);
  var matRow = addFooter('МАТЕРИАЛЫ', 'СУМ', '=SUMIF(M'+startRow+':M'+(jamiRow-1)+', "bl", K'+startRow+':K'+(jamiRow-1)+')', false);

  var matTr = _toNum(config.matTr);
  var matTrRow = null;
  if(matTr > 0) matTrRow = addFooter('ТРАНСПОРТНЫЕ РАСХОДЫ НА МАТЕРИАЛЫ '+matTr+'%', 'СУМ', '=H'+matRow+'*'+(matTr/100), false);

  var matSkl = _toNum(config.matSkl);
  var matSklRow = null;
  if(matSkl > 0) matSklRow = addFooter('СКЛАДСКИЕ РАСХОДЫ НА МАТЕРИАЛЫ '+matSkl+'%', 'СУМ', '=H'+matRow+'*'+(matSkl/100), false);

  var fItogo1 = '=H'+jamiRow;
  if(matTrRow) fItogo1 += '+H'+matTrRow;
  if(matSklRow) fItogo1 += '+H'+matSklRow;
  var itogo1Row = addFooter('ИТОГО', 'СУМ', fItogo1, true);

  var proch = _toNum(config.proch);
  var prochRow = null;
  if(proch > 0) prochRow = addFooter('ПРОЧИЕ ЗАТРАТЫ И РАСХОДЫ ПОДРЯДЧИКА '+proch+'%', 'СУМ', '=H'+itogo1Row+'*'+(proch/100), false);

  var fItogo2 = '=H'+itogo1Row;
  if(prochRow) fItogo2 += '+H'+prochRow;
  var itogo2Row = addFooter('ИТОГО', 'СУМ', fItogo2, true);

  var obRow = addFooter('ОБОРУДОВАНИЯ', 'СУМ', '=SUMIF(M'+startRow+':M'+(jamiRow-1)+', "bl", L'+startRow+':L'+(jamiRow-1)+')', false);

  var obTr = _toNum(config.obTr);
  var obTrRow = null;
  if(obTr > 0) obTrRow = addFooter('ТРАНСПОРТНЫЕ РАСХОДЫ НА ОБОРУДОВАНИЯ '+obTr+'%', 'СУМ', '=H'+obRow+'*'+(obTr/100), false);

  var obSkl = _toNum(config.obSkl);
  var obSklRow = null;
  if(obSkl > 0) obSklRow = addFooter('ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ НА ОБОРУДОВАНИЯ '+obSkl+'%', 'СУМ', '=H'+obRow+'*'+(obSkl/100), false);

  var fItogo3 = '=H'+itogo2Row+'+H'+obRow;
  if(obTrRow) fItogo3 += '+H'+obTrRow;
  if(obSklRow) fItogo3 += '+H'+obSklRow;
  var itogo3Row = addFooter('ИТОГО', 'СУМ', fItogo3, true);

  var strah = _toNum(config.strah);
  var strahRow = null;
  if(strah > 0) strahRow = addFooter('ЗАТРАТЫ НА СТРАХОВАНИЕ ОБЪЕКТА '+strah+'%', 'СУМ', '=H'+itogo3Row+'*'+(strah/100), false);

  var risk = _toNum(config.risk);
  var riskRow = null;
  if(risk > 0) riskRow = addFooter('КОЭФФИЦИЕНТ РИСКА '+risk+'%', 'СУМ', '=H'+itogo3Row+'*'+(risk/100), false);

  var fItogo4 = '=H'+itogo3Row;
  if(strahRow) fItogo4 += '+H'+strahRow;
  if(riskRow) fItogo4 += '+H'+riskRow;
  var itogo4Row = addFooter('ИТОГО', 'СУМ', fItogo4, true);

  var nds = _toNum(config.nds);
  var ndsRow = null;
  if(nds > 0) ndsRow = addFooter('НДС '+nds+'%', 'СУМ', '=H'+itogo4Row+'*'+(nds/100), false);

  var fVsego = '=H'+itogo4Row;
  if(ndsRow) fVsego += '+H'+ndsRow;
  var vsegoRow = addFooter('ВСЕГО СТОИМОСТЬ СТРОИТЕЛЬСТВА В ТЕКУЩИХ ЦЕНАХ', 'СУМ', fVsego, true);

  row += 2;

  // ПОДВАЛ — имзолар
  sh.getRange(row,1,1,W).merge().setValue('ИМЗОЛАР:').setFontWeight('bold').setFontSize(11);
  row += 2;
  sh.getRange(row,1,1,3).merge().setValue('Заказчик:').setFontWeight('bold');
  sh.getRange(row,5,1,3).merge().setValue(config.zakazchik||'');
  row++;
  sh.getRange(row,1,1,3).merge().setValue('_____________ / '+(config.zakFio||'____________'));
  sh.getRange(row,5,1,3).merge().setValue('М.П.');
  row += 2;
  sh.getRange(row,1,1,3).merge().setValue('Подрядчик:').setFontWeight('bold');
  sh.getRange(row,5,1,3).merge().setValue(config.podryad||'');
  row++;
  sh.getRange(row,1,1,3).merge().setValue('_____________ / '+(config.podFio||'____________'));
  sh.getRange(row,5,1,3).merge().setValue('М.П.');
  row += 2;
  if(config.subPod){
    sh.getRange(row,1,1,3).merge().setValue('Субподрядчик:').setFontWeight('bold');
    sh.getRange(row,5,1,3).merge().setValue(config.subPod);
    row++;
    sh.getRange(row,1,1,3).merge().setValue('_____________ / '+(config.subFio||'____________'));
    sh.getRange(row,5,1,3).merge().setValue('М.П.');
  }

  SpreadsheetApp.flush();

  // Папкага кўчириш
  try{
    var a = sozAsosiy();
    var root = DriveApp.getFolderById(a.rootId);
    var sfIt = root.getFoldersByName('_ШАХСИЙ_СМЕТАЛАР');
    var smetaFolder = sfIt.hasNext() ? sfIt.next() : root.createFolder('_ШАХСИЙ_СМЕТАЛАР');
    var file = DriveApp.getFileById(ss.getId());
    smetaFolder.addFile(file);
    try{ DriveApp.getRootFolder().removeFile(file); }catch(e){}
  }catch(e){ Logger.log('Папкага кўчириш: '+e); }

  return { ok:true, url:ss.getUrl(), nom:config.nom, ishlar:items.length, jami:umumiyJami,
    xabar:'✅ Смета яратилди: '+config.nom+' ('+items.length+' та иш)' };
}

function _shSmetaNarxMap(){
  var map = {};
  try{
    var sh1 = SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_NARX);
    if(sh1 && sh1.getLastRow()>=2){
      var v=sh1.getDataRange().getValues();
      for(var i=1;i<v.length;i++){
        var n=_norm(String(v[i][0]||'')), b=_normBirlik(String(v[i][1]||'')), p=_toNum(v[i][3]);
        if(n&&p>0) map[n+'||'+b]=Math.max(map[n+'||'+b]||0,p);
      }
    }
  }catch(e){}
  try{
    var sh2 = SpreadsheetApp.getActive().getSheetByName(CFG.NARXLAR);
    if(sh2 && sh2.getLastRow()>=2){
      var v2=sh2.getDataRange().getValues();
      for(var j=1;j<v2.length;j++){
        var n2=_norm(String(v2[j][0]||'')), b2=_normBirlik(String(v2[j][1]||'')), p2=_toNum(v2[j][2]);
        if(n2&&p2>0) map[n2+'||'+b2]=Math.max(map[n2+'||'+b2]||0,p2);
      }
    }
  }catch(e){}
  return map;
}

function _shSmetaNarx(nom,birlik,map){
  return map[_norm(nom)+'||'+_normBirlik(birlik)]||0;
}

function apiShaxsiySmetalar(){
  var list = [];
  try{
    var a=sozAsosiy(), root=DriveApp.getFolderById(a.rootId);
    var sfIt=root.getFoldersByName('_ШАХСИЙ_СМЕТАЛАР');
    if(!sfIt.hasNext()) return list;
    var files=sfIt.next().getFiles();
    while(files.hasNext()){
      var f=files.next();
      list.push({ id:f.getId(), nom:f.getName(), url:f.getUrl(),
        sana:Utilities.formatDate(f.getLastUpdated(),'Asia/Tashkent','dd.MM.yyyy HH:mm') });
    }
  }catch(e){}
  list.sort(function(a,b){ return b.sana.localeCompare(a.sana); });
  return list;
}
