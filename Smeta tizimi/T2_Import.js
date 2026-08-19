/**
 * T2_Import.js — TIZIM_02: FAYLDAN BAZAGA (GAS FAQAT O'QIYDI)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TIZIM_01 BILAN FARQI — YO'NALISH TESKARI:
 *
 *   Tizim_01:  Sheets = haqiqat → GAS hisoblaydi → LRV_PLUS yozadi → baza ko'zgu
 *   Tizim_02:  fayl = xom manba → GAS FAQAT O'QIYDI → Postgres hisoblaydi
 *                                                    → Sheets ko'zgu bo'ladi
 *
 * NEGA SHUNDAY. Foydalanuvchi to'g'ri aytdi: «katta smetalarda GAS juda sekin
 * va ko'p time limitiga urar edi». Dvigatel kodini sanaganimizda sabab aniq
 * ko'rindi (10_Engine.js):
 *
 *     getValues (o'qish) ........ 39 ta   — YENGIL, ommaviy
 *     merge (katak birlashtirish) 21 ta   — juda qimmat
 *     formula yozish ............ 51 ta   — qimmat + qayta hisoblash
 *     varaq yaratish/o'chirish .. 11 ta   — qimmat
 *
 * Ya'ni vaqt FAYLNI O'QISHGA emas, NATIJANI SHEETS'GA QURISHGA ketadi.
 * Shu modul aynan o'sha og'ir qismni olib tashlaydi: GAS faqat o'qiydi va
 * xom qatorlarni bazaga yuboradi. Markirovka, narxlash, jamlash — hammasi
 * Postgres'da, to'plamli SQL bilan (minglab qator bir o'tishda).
 *
 * ⚠️ BU MODUL HECH NARSA YOZMAYDI — na Drive'ga, na Sheets'ga. Tizim_01 ga
 * mutlaqo xavfsiz: uning bironta fayli, varag'i yoki funksiyasi tegilmaydi.
 *
 * ⚠️ XOM QATLAM O'ZGARMAS. Faylda nima bo'lsa shu yuboriladi — hisob natijasi
 * bilan ustiga yozilmaydi. Shuning uchun narxlash qoidasi o'zgarsa Drive'ga
 * QAYTA BORISH SHART EMAS: bitta SQL bilan hammasi qayta narxlanadi.
 */

/* ═══════════════════ SOZLAMA VA PAST-DARAJA REST ═══════════════════════ */

/**
 * Supabase ulanishi. `70_Supabase.js` dagi sozlama bilan BIR XIL loyihaga
 * ulanadi — ikkinchi marta kalit kiritish shart emas. O'sha fayl TEGILMAYDI,
 * faqat o'qiladi.
 */
function _t2Cfg(){
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('SUPABASE_URL'), key = p.getProperty('SUPABASE_KEY');
  if(!url || !key){
    throw 'Supabase sozlanmagan. Apps Script editor → Run: ' +
          'supabaseSozlash("https://xxx.supabase.co", "service_role_key")';
  }
  return {url: String(url).replace(/\/+$/,''), key: key};
}

function _t2Bosh(c, qoshimcha){
  var h = {
    'apikey': c.key,
    'Authorization': 'Bearer ' + c.key,
    'Content-Type': 'application/json'
  };
  if(qoshimcha) for(var k in qoshimcha) h[k] = qoshimcha[k];
  return h;
}

/** PostgREST GET — qatorlarni o'qish. */
function _t2Get(yol){
  var c = _t2Cfg();
  var r = UrlFetchApp.fetch(c.url + '/rest/v1/' + yol, {
    method: 'get', headers: _t2Bosh(c), muteHttpExceptions: true
  });
  var kod = r.getResponseCode();
  if(kod >= 300) throw 'Supabase GET ' + yol + ' (' + kod + '): ' + r.getContentText().slice(0,300);
  return JSON.parse(r.getContentText() || '[]');
}

/** PostgREST POST — qator qo'shish. `qaytar` bo'lsa yozilgan qator qaytadi. */
function _t2Post(jadval, qatorlar, qaytar, onConflict){
  var c = _t2Cfg();
  var yol = c.url + '/rest/v1/' + jadval + (onConflict ? '?on_conflict=' + encodeURIComponent(onConflict) : '');
  var pref = [];
  if(onConflict) pref.push('resolution=merge-duplicates');
  pref.push(qaytar ? 'return=representation' : 'return=minimal');
  var r = UrlFetchApp.fetch(yol, {
    method: 'post', headers: _t2Bosh(c, {'Prefer': pref.join(',')}),
    payload: JSON.stringify(qatorlar), muteHttpExceptions: true
  });
  var kod = r.getResponseCode();
  if(kod >= 300) throw 'Supabase POST ' + jadval + ' (' + kod + '): ' + r.getContentText().slice(0,300);
  return qaytar ? JSON.parse(r.getContentText() || '[]') : null;
}

/** Postgres funksiyasini chaqirish (hisob BAZADA bajariladi). */
function _t2Rpc(fn, args){
  var c = _t2Cfg();
  var r = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + fn, {
    method: 'post', headers: _t2Bosh(c),
    payload: JSON.stringify(args || {}), muteHttpExceptions: true
  });
  var kod = r.getResponseCode();
  if(kod >= 300) throw 'Supabase RPC ' + fn + ' (' + kod + '): ' + r.getContentText().slice(0,400);
  var t = r.getContentText();
  try{ return JSON.parse(t); }catch(e){ return t; }
}

function _t2Ochir(jadval, filtr){
  var c = _t2Cfg();
  var r = UrlFetchApp.fetch(c.url + '/rest/v1/' + jadval + '?' + filtr, {
    method: 'delete', headers: _t2Bosh(c, {'Prefer':'return=minimal'}),
    muteHttpExceptions: true
  });
  var kod = r.getResponseCode();
  if(kod >= 300) throw 'Supabase DELETE ' + jadval + ' (' + kod + '): ' + r.getContentText().slice(0,300);
}


/* ═══════════════════ OBYEKT ═══════════════════════════════════════════ */

/**
 * Obyektni bazada ta'minlaydi va id sini qaytaradi.
 *
 * ⚠️ `tur` MUHIM. Eski ko'zguda shartnoma jamlanmasi va shaxsiy sinov
 * smetalari haqiqiy obyektlar bilan bitta jadvalda edi va `sum(smeta)`
 * 730 mlrd berardi — haqiqiy 260 mlrd o'rniga. Shuning uchun nom shaklidan
 * turi ANIQLANADI va jamlashda ajratiladi.
 */
function apiT2ObyektTayyorla(nom){
  nom = String(nom || '').trim();
  if(!nom) throw 'Obyekt nomi kerak';

  var tur = 'obyekt';
  if(/^Shartnoma\s*№/i.test(nom) || nom === 'Taqsimlanmagan') tur = 'shartnoma_jamlanma';
  else if(/^_ШАХСИЙ/i.test(nom)) tur = 'shaxsiy';

  var bor = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(nom) + '&select=id,tur');
  if(bor.length) return {id: bor[0].id, nom: nom, tur: bor[0].tur, yangi: false};

  var yaratildi = _t2Post('t2_obyekt', [{nom: nom, tur: tur}], true);
  return {id: yaratildi[0].id, nom: nom, tur: tur, yangi: true};
}


/* ═══════════════════ FAYL O'QISH (YENGIL QISM) ════════════════════════ */

/**
 * Varaqning formatini aniqlaydi: sarlavha qatorida «КОД»/«ОБОСНОВАНИЕ»
 * bo'lsa ABC4, aks holda TN. Ustunlar joylashuvi shunga qarab suriladi
 * (00_Config.js: SVOD_TN / SVOD_ABC).
 * Yana ma'lumot boshlanadigan qatorni ham qaytaradi.
 */
function _t2FormatAniqla(qiymatlar){
  var format = 'TN', dataQator = 1;
  var chek = Math.min(20, qiymatlar.length);
  for(var i = 0; i < chek; i++){
    var s = qiymatlar[i].join(' ').toUpperCase();
    if(s.indexOf('НАИМЕНОВАНИЕ') >= 0 && (s.indexOf('ЕД.ИЗМ') >= 0 || s.indexOf('ЕД. ИЗМ') >= 0 || s.indexOf('ЕДИЗМ') >= 0)){
      format = (s.indexOf('КОД') >= 0 || s.indexOf('ОБОСНОВАНИЕ') >= 0 || s.indexOf('ШИФР') >= 0) ? 'ABC4' : 'TN';
      dataQator = i + 2;                       // sarlavhadan keyingi qator
      /* Sarlavha ostida ko'pincha USTUN-RAQAMLASH qatori (1|2|3|4…) turadi.
         Uni ham o'tkazib yuboramiz — aks holda «3» nomli soxta razdel
         paydo bo'ladi (bu Tizim_01 da haqiqatan bo'lgan). */
      if(i + 1 < qiymatlar.length){
        var keyingi = qiymatlar[i+1].map(function(x){ return String(x == null ? '' : x).trim(); });
        var sonlar = keyingi.filter(function(x){ return /^\d+$/.test(x); }).length;
        if(sonlar >= 3) dataQator = i + 3;
      }
      break;
    }
  }
  return {format: format, dataQator: dataQator};
}

/**
 * Merge bayroqlari. Markirovka ularsiz ishlay olmaydi: razdel aynan
 * A:F birlashuvi bilan belgilanadi.
 *
 * ⚡ Advanced Sheets API BITTA chaqiruvda barcha merge'ni qaytaradi.
 * `getMergedRanges()` minglab merged katakli varaqda daqiqalab qotadi
 * (Amfiteatr АРХИТЕКТУРНАЯ ЧАСТЬ da aynan shu 6-daqiqa timeout bergan).
 * API ishlamasa — eski usulga xavfsiz qaytadi.
 */
function _t2MergeXarita(sh, boshlanish, soni){
  var full = {}, ef = {}, oxir = boshlanish + soni - 1, merges = null;
  try{
    var nomSh = sh.getName().replace(/'/g, "''");
    var javob = Sheets.Spreadsheets.get(sh.getParent().getId(),
                  {ranges: ["'" + nomSh + "'"], fields: 'sheets(merges)'});
    var xom = (javob.sheets && javob.sheets[0] && javob.sheets[0].merges) || [];
    merges = [];
    for(var i = 0; i < xom.length; i++){
      var g = xom[i];
      var r = (g.startRowIndex || 0) + 1,
          c1 = (g.startColumnIndex || 0) + 1,
          c2 = g.endColumnIndex || c1;
      if(r < boshlanish || r > oxir || c1 > 6) continue;
      merges.push({row: r, c1: c1, c2: c2});
    }
  }catch(e){ merges = null; }

  if(merges === null){
    merges = sh.getRange(boshlanish, 1, soni, 6).getMergedRanges().map(function(m){
      return {row: m.getRow(), c1: m.getColumn(), c2: m.getColumn() + m.getNumColumns() - 1};
    });
  }

  for(var j = 0; j < merges.length; j++){
    var m2 = merges[j];
    if(m2.c1 === 1 && m2.c2 >= 6) full[m2.row] = true;
    else if(m2.c1 >= 2 && m2.c2 >= 6) ef[m2.row] = true;
  }
  return {full: full, ef: ef};
}


/* ═══════════════════ IMPORT ═══════════════════════════════════════════ */

/**
 * Bitta varaqni xom holda bazaga yuklaydi.
 *
 * @param {string} obyekt  obyekt nomi
 * @param {string} faylId  Google Sheets fayl ID
 * @param {string} varaq   varaq nomi (bo'sh bo'lsa — birinchi mos varaq)
 * @param {string} rol     'lokalka' (smeta) yoki 'svodka' (narx manbai)
 */
function apiT2FaylImport(obyekt, faylId, varaq, rol){
  var t0 = Date.now();
  try{
    rol = (rol === 'svodka') ? 'svodka' : 'lokalka';
    var ob = apiT2ObyektTayyorla(obyekt);

    /* ⚠️ Google Sheets bo'lmagan faylni `openById` ga berish V8 dvigatelini
       BUTUNLAY qulatadi — try/catch ham ushlamaydi (00_BOSH_QONUN 6.6).
       Shuning uchun MIME OQ RO'YXAT bilan tekshiriladi. */
    var fayl = DriveApp.getFileById(faylId);
    if(fayl.getMimeType() !== MimeType.GOOGLE_SHEETS){
      return {ok:false, xabar: 'Bu Google Sheets emas («' + fayl.getMimeType() + '»). ' +
              'Excel fayl avval konvert qilinishi kerak.'};
    }

    var ss = SpreadsheetApp.openById(faylId);
    var sh = varaq ? ss.getSheetByName(varaq) : null;
    if(!sh){
      var barcha = ss.getSheets();
      for(var i = 0; i < barcha.length; i++){
        if(barcha[i].getName().charAt(0) !== '_' && barcha[i].getLastRow() > 1){ sh = barcha[i]; break; }
      }
    }
    if(!sh) return {ok:false, xabar:'Mos varaq topilmadi'};
    varaq = sh.getName();

    var oxirgiQ = sh.getLastRow(), oxirgiU = Math.max(8, sh.getLastColumn());
    if(oxirgiQ < 2) return {ok:false, xabar:'Varaq bo\'sh: ' + varaq};

    /* ── YENGIL QISM: bitta ommaviy o'qish ── */
    var tOqish = Date.now();
    var qiymatlar = sh.getRange(1, 1, oxirgiQ, oxirgiU).getValues();
    var msOqish = Date.now() - tOqish;

    var tanish = _t2FormatAniqla(qiymatlar);
    var tMerge = Date.now();
    var mm = _t2MergeXarita(sh, 1, oxirgiQ);
    var msMerge = Date.now() - tMerge;

    /* ── Eski import bo'lsa tozalanadi (qayta yuklash xavfsiz) ── */
    var eski = _t2Get('t2_manba?obyekt_id=eq.' + ob.id +
                      '&fayl_id=eq.' + encodeURIComponent(faylId) +
                      '&varaq=eq.' + encodeURIComponent(varaq) + '&select=id');
    if(eski.length) _t2Ochir('t2_manba', 'id=eq.' + eski[0].id);

    var manba = _t2Post('t2_manba', [{
      obyekt_id: ob.id, rol: rol, fayl_id: faylId, fayl_nom: fayl.getName(),
      varaq: varaq, format: tanish.format, data_qator: tanish.dataQator,
      qator_soni: oxirgiQ
    }], true)[0];

    /* ── Xom qatorlar ── */
    var qatorlar = [];
    for(var r = 0; r < qiymatlar.length; r++){
      var hujayra = qiymatlar[r].map(function(v){
        return (v === null || v === undefined) ? '' : String(v);
      });
      /* Butunlay bo'sh qatorni yubormaymiz — hajmni bekorga oshiradi */
      var bormi = false;
      for(var k = 0; k < hujayra.length; k++){ if(hujayra[k] !== ''){ bormi = true; break; } }
      if(!bormi) continue;

      qatorlar.push({
        manba_id: manba.id, qator: r + 1, hujayra: hujayra,
        merge_full: !!mm.full[r+1], merge_ef: !!mm.ef[r+1]
      });
    }

    /* ── Bo'laklab PARALLEL yuborish ──
       Ketma-ket yuborilsa har bo'lak ~1 soniya kutadi va katta smetada
       6-daqiqa limitiga urilamiz. `fetchAll` hammasini birga yuboradi. */
    var tYuk = Date.now();
    _t2XomYubor(qatorlar);
    var msYuklash = Date.now() - tYuk;

    return {
      ok: true, obyekt: obyekt, obyekt_id: ob.id, manba_id: manba.id,
      rol: rol, varaq: varaq, format: tanish.format, data_qator: tanish.dataQator,
      xom_qator: qatorlar.length,
      vaqt: {oqish: msOqish, merge: msMerge, yuklash: msYuklash, jami: Date.now() - t0},
      izoh: 'GAS faqat o\'qidi va yubordi — hech narsa hisoblanmadi va yozilmadi.'
    };

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e), ms: Date.now() - t0};
  }
}

/** Xom qatorlarni bo'laklab, parallel yuboradi. */
function _t2XomYubor(qatorlar){
  if(!qatorlar.length) return;
  var c = _t2Cfg(), BOLAK = 500, sorovlar = [];
  for(var i = 0; i < qatorlar.length; i += BOLAK){
    sorovlar.push({
      url: c.url + '/rest/v1/t2_xom',
      method: 'post',
      headers: _t2Bosh(c, {'Prefer': 'return=minimal'}),
      payload: JSON.stringify(qatorlar.slice(i, i + BOLAK)),
      muteHttpExceptions: true
    });
  }
  var javoblar = UrlFetchApp.fetchAll(sorovlar);
  for(var j = 0; j < javoblar.length; j++){
    var kod = javoblar[j].getResponseCode();
    if(kod >= 300) throw 't2_xom yuklash xatosi (' + kod + '): ' +
                         javoblar[j].getContentText().slice(0,300);
  }
}


/* ═══════════════════ HISOB — BAZADA BAJARILADI ════════════════════════ */

/**
 * Obyektni to'liq qayta hisoblaydi. GAS hech narsa hisoblamaydi — faqat
 * Postgres funksiyalarini chaqiradi va natijani qaytaradi.
 *
 * Tartib MUHIM: avval svodkadan narx bazasi, keyin markirovka, keyin
 * narxlash, oxirida jamlash.
 */
function apiT2Ishla(obyekt){
  var t0 = Date.now();
  try{
    var ob = apiT2ObyektTayyorla(obyekt);
    var manbalar = _t2Get('t2_manba?obyekt_id=eq.' + ob.id + '&select=id,rol,varaq,format');
    if(!manbalar.length) return {ok:false, xabar:'Bu obyektga hali fayl import qilinmagan'};

    var natija = {ok:true, obyekt: obyekt, bosqichlar: []};

    // 1) Svodkalardan narx bazasi
    for(var i = 0; i < manbalar.length; i++){
      if(manbalar[i].rol !== 'svodka') continue;
      var tN = Date.now();
      var r1 = _t2Rpc('t2_narx_svodkadan', {p_manba_id: manbalar[i].id});
      natija.bosqichlar.push({bosqich:'narx_bazasi', varaq: manbalar[i].varaq,
                              ms: Date.now() - tN, natija: r1});
    }

    // 2) Lokalkalarni markirovka
    for(var j = 0; j < manbalar.length; j++){
      if(manbalar[j].rol !== 'lokalka') continue;
      var tM = Date.now();
      var r2 = _t2Rpc('t2_markirovka', {p_manba_id: manbalar[j].id});
      natija.bosqichlar.push({bosqich:'markirovka', varaq: manbalar[j].varaq,
                              ms: Date.now() - tM, natija: r2});
    }

    // 3) Narxlash
    var tNx = Date.now();
    natija.bosqichlar.push({bosqich:'narxlash', ms: Date.now() - tNx,
                            natija: _t2Rpc('t2_narxla', {p_obyekt_id: ob.id})});

    // 4) Jamlash
    var tR = Date.now();
    natija.jami = _t2Rpc('t2_rollup', {p_obyekt_id: ob.id});
    natija.bosqichlar.push({bosqich:'jamlash', ms: Date.now() - tR, natija: natija.jami});

    natija.ms = Date.now() - t0;
    return natija;

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e), ms: Date.now() - t0};
  }
}


/**
 * To'liq zanjir: obyekt papkasini topib, lokalka va svodkani import qiladi
 * va hisoblaydi. Bu — «smeta yuklash → narxlash → daraxt» ning bir tugmasi.
 *
 * ⚠️ `skanBitta` ishlatiladi (o'z qidiruvimni yozmayman): u kesh, zaxira
 * skan va bog'lash sozlamalarini hisobga oladi hamda LOKALKA/СВОДКА ni
 * ajratib beradi. Ko'p smetali obyektda «Amfiteatr - 109983_...» PAPKA
 * EMAS — u papka ichidagi bitta smeta fayli; buni qayta yozish xato bo'lardi.
 */
function apiT2ObyektImport(obyekt){
  var t0 = Date.now();
  try{
    var ob = skanBitta(obyekt);
    if(!ob) return {ok:false, xabar:'Obyekt topilmadi: ' + obyekt};

    var natijalar = [], xatolar = [];

    function importQil(fayl, rol){
      if(!fayl) return;
      try{
        var r = apiT2FaylImport(obyekt, fayl.getId(), '', rol);
        natijalar.push(r);
        if(!r.ok) xatolar.push(rol + ' «' + fayl.getName() + '»: ' + r.xabar);
      }catch(e){
        xatolar.push(rol + ': ' + ((e && e.message) || e));
      }
    }

    if(ob.lokFiles && ob.lokFiles.length){
      for(var i = 0; i < ob.lokFiles.length; i++) importQil(ob.lokFiles[i], 'lokalka');
    } else {
      importQil(ob.lokFile, 'lokalka');
    }
    importQil(ob.svodFile, 'svodka');

    var hisob = null;
    if(natijalar.some(function(r){ return r.ok; })) hisob = apiT2Ishla(obyekt);

    return {ok: !!(hisob && hisob.ok), obyekt: obyekt,
            import: natijalar, hisob: hisob, xatolar: xatolar,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e), ms: Date.now() - t0};
  }
}


/** Ulanish va sxema tayyorligini tekshiradi. */
function apiT2Test(){
  try{
    var ob = _t2Get('t2_obyekt?select=id&limit=1');
    return {ok:true, xabar:'Supabase Tizim_02 sxemasi ulangan', obyekt_bor: ob.length};
  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}
