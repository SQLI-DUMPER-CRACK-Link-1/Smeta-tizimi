/* ================= LRV O'QISH/YOZISHNING YAGONA STANDARTI =================
 * BARCHA modullar (DASHBOARD, Tashxis, Boss, Resurs, Supabase, Panel)
 * LRV varag'ini FAQAT shu funksiya orqali o'qiydi.
 * Qoidalar BIR joyda: marker normalize, kategoriya aniqlash, start-qator. */

function lrvOqi(sh, opts) {
  opts = opts || {};
  var a = sozAsosiy(), col = CFG.C;
  var last = sh.getLastRow();
  var start = a.dataQator > 0 ? a.dataQator : _autoData(sh);
  if (last < start) return [];
  
  var jamiRow = start - 1;

  // Agar faqat JAMI kerak bo'lsa (DASHBOARD / BossObyekt)
  if (opts.faqatJami && jamiRow > 0) {
    // ⚠️ AVVAL tekshiramiz: start-1 haqiqatan ЖАМИ qatorimi? Aks holda _jamiQator
    // begona qatorni (masalan eski/nostandart fayl sarlavhasini) ЖАМИ formulalar
    // bilan BOSIB YUBORARDI — keyin tekshiruv "endi ЖАМИ-ku" deb o'tib ketardi
    // (yozishdan keyin tekshirish = himoyasiz). Marker mos kelmasa — pastdagi
    // to'liq (leaf) o'qishga tushamiz, hech narsa yozilmaydi.
    var mkCheck = String(sh.getRange(jamiRow, col.MARKER).getValue()||'').trim().toUpperCase();
    if (mkCheck === 'ЖАМИ' || mkCheck === 'JAMI') {
    // ЖАМИ qatori to'g'ri ishlashi uchun avval uning formulalarini yangilab olamiz
    // shunday qilib eski LRV fayllardagi '+' li qatorlar tushib qolmaydi
    _jamiQator(sh, jamiRow, start, last);

    // Yig'indilarni o'qib olish (1 ta qator)
    var jv = sh.getRange(jamiRow, 1, 1, col.ST_OST).getValues()[0];

    // Qatorni tasdiqlash
    var mkRaw = String(jv[col.MARKER-1]||'').trim().toUpperCase();
    if (mkRaw === 'ЖАМИ' || mkRaw === 'JAMI') {
      return [{
        row: jamiRow, tur: 'jami', isQosh: false, kat: 'ЖАМИ',
        nom: 'ЖАМИ', birlik: '', kod: '', e: 0, f: 0, narx: 0,
        smeta: _toNum(jv[col.ST_RES-1]),
        stFakt: _toNum(jv[col.ST_FAKT-1]),
        stF2: _toNum(jv[col.ST_F2-1]),
        stOst: _toNum(jv[col.ST_OST-1]),
        cats: { // Nakrutka/BossObyekt uchun kategoriyalar
          'ЧЕЛ': _toNum(jv[col.CHEL-1]),
          'МАШ': _toNum(jv[col.MASH-1]),
          'МАТ': _toNum(jv[col.MAT-1]),
          'ОБ': _toNum(jv[col.OB-1]),
          'М/К': _toNum(jv[col.MK-1]),
          'КАБ': _toNum(jv[col.KAB-1]),
          'БЕЗ': _toNum(jv[col.BEZSKLAD-1])
        }
      }];
    }
    }
  }

  // Odatdagi o'qish
  var n = last - start + 1;
  var g = sh.getRange(start, 1, n, col.ST_OST).getValues();
  var rows = [];
  for (var i = 0; i < n; i++) {
    var mkRaw = String(g[i][col.MARKER-1]||'').trim().toLowerCase();
    var isQosh = /[+~]$/.test(mkRaw);
    var mk = mkRaw.replace(/[+~]$/,'');
    if (mk!=='rz' && mk!=='bl' && mk!=='rs' && mk!=='mat' && mk!=='ob') continue;
    if (opts.faqatLeaf && (mk==='rz' || mk==='bl')) continue;
    
    // KATEGORIYA — yagona qoida (ustunda qiymat bor-yo'qligi bo'yicha)
    var kat = '?';
    if      (_toNum(g[i][col.CHEL-1]) > 0) kat = 'ЧЕЛ';
    else if (_toNum(g[i][col.MASH-1]) > 0) kat = 'МАШ';
    else if (_toNum(g[i][col.OB-1])   > 0) kat = 'ОБ';
    else if (_toNum(g[i][col.MK-1])   > 0) kat = 'М/К';
    else if (_toNum(g[i][col.KAB-1])  > 0) kat = 'КАБ';
    else if (_toNum(g[i][col.MAT-1])  > 0) kat = 'МАТ';
    
    rows.push({
      row: start+i, tur: mk, isQosh: isQosh, kat: kat,
      nom: String(g[i][col.NOM-1]||'').trim(),
      birlik: String(g[i][col.BIRLIK-1]||'').trim(),
      kod: String(g[i][col.KOD-1]||'').trim(),
      e: _toNum(g[i][col.E-1]), f: _toNum(g[i][col.F-1]),
      narx: _toNum(g[i][col.NARX-1]),
      smeta: _toNum(g[i][col.ST_RES-1]),
      stFakt: _toNum(g[i][col.ST_FAKT-1]),
      stF2: _toNum(g[i][col.ST_F2-1]),
      stOst: _toNum(g[i][col.ST_OST-1]),
      fakt: _toNum(g[i][col.FAKT-1]),
      f2ol: _toNum(g[i][col.F2OL-1]),
      f2mum: _toNum(g[i][col.F2MUM-1])
    });
  }
  return rows;
}

/* Obyektning BARCHA LRV varaqlari bo'yicha lrvOqi — jami hisoblagichlar uchun */
function lrvOqiHammasi(plusSS, opts) {
  var out = [], sheets = plusSS.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    if (sheets[s].getName().indexOf(CFG.LRV_SHEET) !== 0) continue;
    var rows = lrvOqi(sheets[s], opts);
    for (var i = 0; i < rows.length; i++) { 
      rows[i].varaq = sheets[s].getName(); 
      out.push(rows[i]); 
    }
  }
  return out;
}

/* LRV'ga FAKT/F2 yozishning YAGONA eshigi (Yozishdan keyingi standartlashtirish). 
 * Har yozuvdan keyin: formulalar ta'minlanadi + kesh invalidatsiya + DASHBOARD yangilanadi. */
function lrvYoz(obyekt, sh){
  var a=sozAsosiy(), st=a.dataQator>0?a.dataQator:_autoData(sh), ls=sh.getLastRow();
  if(ls>=st){ try{ _oyFormulaToldur(sh, st, ls); }catch(e){} }
  try{ _oyYigindiFormulalarYangila(sh); }catch(e){}
  _holatInvalidate(obyekt);
  try{ serverYozFile(obyekt, sh.getParent(), a); }catch(e){}   // DASHBOARD darhol jonli
  if(typeof _sbDirty==='function'){ try{ _sbDirty(obyekt); }catch(e){} }
}

