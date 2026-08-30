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
function apiT2ObyektTayyorla(nom, driveId){
  nom = String(nom || '').trim();
  if(!nom) throw 'Obyekt nomi kerak';
  driveId = String(driveId || '').trim();

  var tur = 'obyekt';
  if(/^Shartnoma\s*№/i.test(nom) || nom === 'Taqsimlanmagan') tur = 'shartnoma_jamlanma';
  else if(/^_ШАХСИЙ/i.test(nom)) tur = 'shaxsiy';

  /* ⚠️ 2026-08-19 — KOMPANIYA (multi-tenant).
   *
   * Obyekt nomi endi GLOBAL unikal EMAS, `(kompaniya_id, nom)` unikal.
   * Ya'ni ikki kompaniyada bir xil nomli obyekt bo'lishi MUMKIN va
   * normal. Shuning uchun qidirishda ham kompaniya hisobga olinishi
   * shart — aks holda boshqa kompaniyaning obyektiga yozib qo'yamiz.
   *
   * Kompaniya `t2_sozlama` dan yoki bittagina faol kompaniyadan olinadi.
   * Bir nechta kompaniya bo'lsa va tanlanmagan bo'lsa — TAXMIN
   * QILMAYMIZ, aniq xato beramiz. Noto'g'ri tenantga yozish jim
   * buzilish demak va uni keyin topish juda qiyin. */
  var komp = _t2KompaniyaId();

  var bor = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(nom) +
                   '&kompaniya_id=eq.' + komp + '&select=id,tur,drive_id');
  if(bor.length){
    /* Bor ID hech qachon almashtirilmaydi; faqat hali bo'sh bo'lsa
       yaratilgan/yetim papkaning ID sini bir marta saqlaymiz. */
    if(driveId && !bor[0].drive_id){
      var c = _t2Cfg();
      var r = UrlFetchApp.fetch(c.url + '/rest/v1/t2_obyekt?id=eq.' + bor[0].id, {
        method:'patch', headers:_t2Bosh(c, {'Prefer':'return=minimal'}),
        payload:JSON.stringify({drive_id:driveId}), muteHttpExceptions:true
      });
      if(r.getResponseCode() >= 300) throw 'Supabase PATCH t2_obyekt (' + r.getResponseCode() + '): ' + r.getContentText().slice(0,300);
    }
    return {id: bor[0].id, nom: nom, tur: bor[0].tur,
            kompaniya_id: komp, drive_id: bor[0].drive_id || driveId, yangi: false};
  }

  var yaratildi = _t2Post('t2_obyekt',
    [{nom: nom, tur: tur, kompaniya_id: komp, drive_id: driveId || null}], true);
  return {id: yaratildi[0].id, nom: nom, tur: tur,
          kompaniya_id: komp, yangi: true};
}

/**
 * Joriy kompaniya IDsi.
 *
 * Tartib: ScriptProperties (`T2_KOMPANIYA_ID`) → bittagina faol
 * kompaniya → xato. Oxirgi holat ataylab xato: kompaniya bir nechta
 * bo'lsa va tanlanmagan bo'lsa, «birinchisini olaman» degan taxmin
 * ma'lumotni boshqa mijozga yozib qo'yishi mumkin.
 */
function _t2KompaniyaId(){
  var p = PropertiesService.getScriptProperties();
  var saqlangan = p.getProperty('T2_KOMPANIYA_ID');
  if(saqlangan && /^\d+$/.test(saqlangan)) return Number(saqlangan);

  var faol = _t2Get('t2_kompaniya?faol=is.true&select=id,nom,kod&order=id.asc');
  if(!faol.length) throw 'Faol kompaniya yo\'q. Avval t2_kompaniya ga yozuv qo\'shing.';
  if(faol.length > 1){
    throw 'Bir nechta kompaniya bor (' +
          faol.map(function(k){ return k.kod; }).join(', ') +
          '). Qaysi biriga import qilish kerakligini belgilang: ' +
          'apiT2KompaniyaTanla(<id>).';
  }
  p.setProperty('T2_KOMPANIYA_ID', String(faol[0].id));
  return faol[0].id;
}

/** Import qaysi kompaniyaga ketishini belgilaydi (bir marta). */
function apiT2KompaniyaTanla(id){
  var faol = _t2Get('t2_kompaniya?id=eq.' + Number(id) + '&select=id,nom,kod,faol');
  if(!faol.length) return {ok:false, xabar:'Bunday kompaniya yo\'q: ' + id};
  if(!faol[0].faol)  return {ok:false, xabar:'Bu kompaniya faol emas: ' + faol[0].kod};
  PropertiesService.getScriptProperties()
    .setProperty('T2_KOMPANIYA_ID', String(faol[0].id));
  return {ok:true, kompaniya: faol[0],
          xabar:'Import endi «' + faol[0].nom + '» ga ketadi'};
}

/** Joriy tanlovni ko'rsatadi — «qaysi kompaniyaga yozayapman?» */
function apiT2KompaniyaHolat(){
  var p = PropertiesService.getScriptProperties();
  var id = p.getProperty('T2_KOMPANIYA_ID');
  var royxat = _t2Get('t2_kompaniya?select=id,nom,kod,faol&order=id.asc');
  var joriy = null;
  for(var i=0;i<royxat.length;i++) if(String(royxat[i].id) === String(id)) joriy = royxat[i];
  return {ok:true, tanlangan: joriy, kompaniyalar: royxat,
          xabar: joriy ? ('Import «' + joriy.nom + '» ga ketadi')
                       : 'Kompaniya tanlanmagan'};
}


/* ═══════════════════ FAYL O'QISH (YENGIL QISM) ════════════════════════ */

/**
 * Varaqning formatini aniqlaydi: sarlavha qatorida «КОД»/«ОБОСНОВАНИЕ»
 * bo'lsa ABC4, aks holda TN. Ustunlar joylashuvi shunga qarab suriladi
 * (00_Config.js: SVOD_TN / SVOD_ABC).
 * Yana ma'lumot boshlanadigan qatorni ham qaytaradi.
 */
function _t2FormatAniqla(qiymatlar){
  var chek = Math.min(25, qiymatlar.length);

  /* ══ 1) FORMAT — SHART ATAYLAB TOR QOLDIRILDI ══
   *
   * Vasvasa: shartni kengaytirib «Единица измерения» ni ham tanitish.
   * QILINMAYDI. Sabab: format 'ABC4' bo'lsa `t2_tasnif` BUTUNLAY boshqa
   * — ancha qo'pol — tasnif shoxiga o'tadi. 'TN' shoxi esa uzoq sozlangan
   * (Fast food faylida 1458 qatordan 1452 tasi to'g'ri ajratildi).
   * Shartni kengaytirsak, «Шифр» so'zi bor har fayl JIM ABC4 ga
   * o'tib ketardi va tasnif yomonlashardi. */
  var format = 'TN';
  for(var i = 0; i < chek; i++){
    var s = qiymatlar[i].join(' ').toUpperCase();
    if(s.indexOf('НАИМЕНОВАНИЕ') >= 0 &&
       (s.indexOf('ЕД.ИЗМ') >= 0 || s.indexOf('ЕД. ИЗМ') >= 0 || s.indexOf('ЕДИЗМ') >= 0)){
      format = (s.indexOf('КОД') >= 0 || s.indexOf('ОБОСНОВАНИЕ') >= 0 ||
                s.indexOf('ШИФР') >= 0) ? 'ABC4' : 'TN';
      break;
    }
  }

  /* ══ 2) DATA QATOR — ALOHIDA VA KENGROQ QIDIRUV ══
   *
   * Yuqoridagi tor shart «Единица измерения» deb yozilgan faylni
   * TOPMAYDI. O'shanda dataQator=1 bo'lib qolardi va sarlavha qatorlari
   * ma'lumot sifatida o'qilardi:
   *   • «Наименование работ и затрат» degan soxta MATERIAL
   *   • ustun-raqamlash qatoridan (1|2|3…) soxta NARX (nom='3', narx=6)
   *
   * Shuning uchun dataQator formatdan MUSTAQIL topiladi. */
  var dataQator = 1;
  for(var j = 0; j < chek; j++){
    var h = qiymatlar[j].join(' ').toUpperCase().replace(/[^А-ЯЁA-Z]/g, '');
    if(h.indexOf('НАИМЕНОВАН') < 0) continue;
    if(h.indexOf('ЕДИНИЦ') < 0 && h.indexOf('ЕДИЗМ') < 0 && h.indexOf('УЛЧОВ') < 0) continue;

    dataQator = j + 2;                          // sarlavhadan keyingi qator

    /* Sarlavhadan keyin yana xizmat qatorlari bo'lishi mumkin: ostki
       sarlavhalar («в базисном уровне», «на ед.изм.», «общая») va
       USTUN-RAQAMLASH qatori. Eng oxirgisidan keyin boshlaymiz.
       Ilgari faqat KEYINGI qator qaralardi — bu faylda raqamlash
       qatori 3 qator pastda edi va o'tkazib yuborilgan. */
    for(var k = j + 1; k < Math.min(j + 7, qiymatlar.length); k++){
      var xat = qiymatlar[k].map(function(x){ return String(x == null ? '' : x).trim(); });
      var toza = xat.filter(function(x){ return x !== ''; });
      /* ⚠️ «3 ta son bor» YETARLI EMAS: hajm/narx/summa ham son bo'ladi
         va haqiqiy ma'lumot qatori o'tkazib yuborilardi. Ustun-raqamlash
         qatorining belgisi — hamma katak KETMA-KET butun son. */
      var raqamlash = toza.length >= 3 && toza.every(function(x, idx){
        return /^\d{1,2}$/.test(x) && Number(x) === Number(toza[0]) + idx;
      });
      if(raqamlash) dataQator = k + 2;
    }
    break;
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
function apiT2FaylImport(obyekt, faylId, varaq, rol, boshQator){
  var t0 = Date.now();
  try{
    rol = (rol === 'svodka') ? 'svodka' : 'lokalka';

    /* ══ BO'LAKLI IMPORT ══
     *
     * Foydalanuvchi: «bu katta smetalarda ishlay olmasak GAS dan
     * o'tganimizni tezlikdan boshqa foydasi yo'q ekanda».
     *
     * To'g'ri. Postgres 50 000 qatorni ~40 soniyada ishlaydi, lekin GAS
     * bitta ijroga 6 daqiqa beradi va varaqni o'qib JSON ga aylantirish
     * o'sha byudjetni yeydi. Yechim — hammasini bitta ijroda qilmaslik.
     *
     * `boshQator` berilsa import O'SHA QATORDAN davom etadi va vaqt
     * byudjeti tugaganda `tugadi:false` bilan qaytadi. Chaqiruvchi
     * (panel) `keyingi_qator` bilan qayta chaqiradi.
     *
     * Bir chaqiruvda ko'pi bilan `BOLAK` qator: 6 daqiqa emas, ~1 daqiqa
     * ishlaydi va foydalanuvchi jarayonni ko'rib turadi. */
    var BOLAK = 12000;
    var CHEK  = 3.0 * 60 * 1000;          // bitta ijro uchun xavfsiz chegara
    boshQator = Math.max(1, Number(boshQator) || 1);
    var davomi = (boshQator > 1);

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

    /* ── BU BO'LAKNING ORALIG'I ── */
    var oxirBolak = Math.min(oxirgiQ, boshQator + BOLAK - 1);
    var soniBolak = oxirBolak - boshQator + 1;

    var manba, tanish;

    if(!davomi){
      /* BIRINCHI BO'LAK: format aniqlanadi (u faqat yuqori qatorlarda
         bo'ladi) va manba yozuvi yaratiladi. */
      var tSarl = Date.now();
      var sarlavha = sh.getRange(1, 1, Math.min(30, oxirgiQ), oxirgiU).getValues();
      tanish = _t2FormatAniqla(sarlavha);
      var msSarl = Date.now() - tSarl;

      /* Eski import bo'lsa tozalanadi (qayta yuklash xavfsiz) */
      var eski = _t2Get('t2_manba?obyekt_id=eq.' + ob.id +
                        '&fayl_id=eq.' + encodeURIComponent(faylId) +
                        '&varaq=eq.' + encodeURIComponent(varaq) + '&select=id');
      if(eski.length) _t2Ochir('t2_manba', 'id=eq.' + eski[0].id);

      manba = _t2Post('t2_manba', [{
        obyekt_id: ob.id, rol: rol, fayl_id: faylId, fayl_nom: fayl.getName(),
        varaq: varaq, format: tanish.format, data_qator: tanish.dataQator,
        qator_soni: oxirgiQ, holat: (oxirgiQ > BOLAK ? 'yuklanmoqda' : 'xom')
      }], true)[0];
    }else{
      /* DAVOMI: format allaqachon aniqlangan — qayta aniqlamaymiz.
         Aks holda har bo'lakda boshqacha chiqib qolishi mumkin edi. */
      var bor = _t2Get('t2_manba?obyekt_id=eq.' + ob.id +
                       '&fayl_id=eq.' + encodeURIComponent(faylId) +
                       '&varaq=eq.' + encodeURIComponent(varaq) +
                       '&select=id,format,data_qator');
      if(!bor.length) return {ok:false, xabar:'Davom ettirish uchun manba topilmadi — ' +
                                              'importni boshidan boshlang'};
      manba = bor[0];
      tanish = {format: bor[0].format, dataQator: bor[0].data_qator};
    }

    /* ── FAQAT SHU BO'LAKNI O'QIYMIZ ──
       Butun varaqni har bo'lakda qayta o'qish 50 000 qatorda vaqtning
       katta qismini yeb qo'yardi. */
    var tOqish = Date.now();
    var qiymatlar = sh.getRange(boshQator, 1, soniBolak, oxirgiU).getValues();
    var msOqish = Date.now() - tOqish;

    var tMerge = Date.now();
    var mm = _t2MergeXarita(sh, boshQator, soniBolak);
    var msMerge = Date.now() - tMerge;

    /* ── Xom qatorlar ── */
    var qatorlar = [];
    for(var r = 0; r < qiymatlar.length; r++){
      var haqiqiyQ = boshQator + r;
      var hujayra = qiymatlar[r].map(function(v){
        return (v === null || v === undefined) ? '' : String(v);
      });
      /* Butunlay bo'sh qatorni yubormaymiz — hajmni bekorga oshiradi */
      var bormi = false;
      for(var k = 0; k < hujayra.length; k++){ if(hujayra[k] !== ''){ bormi = true; break; } }
      if(!bormi) continue;

      qatorlar.push({
        manba_id: manba.id, qator: haqiqiyQ, hujayra: hujayra,
        merge_full: !!mm.full[haqiqiyQ], merge_ef: !!mm.ef[haqiqiyQ]
      });
    }

    var tYuk = Date.now();
    _t2XomYubor(qatorlar, t0);
    var msYuklash = Date.now() - tYuk;

    /* ── Tugadimi? ── */
    var tugadi = (oxirBolak >= oxirgiQ);
    /* Vaqt byudjetidan oshib ketgan bo'lsak ham to'xtaymiz: keyingi
       bo'lak yangi ijroda, toza byudjet bilan boshlanadi. */
    if(!tugadi && (Date.now() - t0) > CHEK){ /* shunchaki to'xtaymiz */ }

    if(tugadi){
      try{ _t2Post('t2_manba', [{id: manba.id, holat: 'xom'}], false, 'id'); }catch(e2){}
    }

    return {
      ok: true, obyekt: obyekt, obyekt_id: ob.id, manba_id: manba.id,
      rol: rol, varaq: varaq, format: tanish.format, data_qator: tanish.dataQator,
      xom_qator: qatorlar.length,
      /* ⚡ Bo'lakli import holati — chaqiruvchi shularga qarab davom etadi */
      tugadi: tugadi,
      keyingi_qator: tugadi ? null : (oxirBolak + 1),
      jami_qator: oxirgiQ,
      ishlangan: oxirBolak,
      foiz: Math.round(100 * oxirBolak / oxirgiQ),
      vaqt: {oqish: msOqish, merge: msMerge, yuklash: msYuklash, jami: Date.now() - t0},
      izoh: 'GAS faqat o\'qidi va yubordi — hech narsa hisoblanmadi va yozilmadi.'
    };

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e), ms: Date.now() - t0};
  }
}

/** Xom qatorlarni bo'laklab, parallel yuboradi. */
function _t2XomYubor(qatorlar, t0){
  if(!qatorlar.length) return;
  var c = _t2Cfg(), BOLAK = 500, TOLQIN = 20;    // 20 × 500 = 10 000 qator
  var CHEK = 4.5 * 60 * 1000;                     // GAS limiti 6 daq.
  t0 = t0 || Date.now();

  /* ⚠️ HAMMASINI BIRDAN YUBORMAYMIZ.
   *
   * 50 000 qatorli smeta 100 ta so'rov demak; ularni bitta `fetchAll`
   * ga solsak butun JSON bir vaqtda xotirada turadi (~20 MB) va GAS
   * xotira/so'rov chegarasiga urilib, sababi tushunarsiz xato beradi.
   * To'lqinlab yuborish xotirani chegarada ushlab turadi.
   *
   * O'lchangan: 1958 xom qator ≈ 11 s (shundan Postgres atigi 1.2 s).
   * Ya'ni cheklov Postgres emas, GAS tomoni. */
  var sorovlar = [];
  for(var i = 0; i < qatorlar.length; i += BOLAK){
    sorovlar.push({
      url: c.url + '/rest/v1/t2_xom',
      method: 'post',
      headers: _t2Bosh(c, {'Prefer': 'return=minimal'}),
      payload: JSON.stringify(qatorlar.slice(i, i + BOLAK)),
      muteHttpExceptions: true
    });
  }

  for(var t = 0; t < sorovlar.length; t += TOLQIN){
    /* ⚠️ VAQT QO'RIQCHISI.
     * Limitga urilsak GAS ijroni JIM to'xtatadi: yarim yuklangan
     * ma'lumot qoladi va sabab hech qayerda ko'rinmaydi. Undan ko'ra
     * o'zimiz to'xtab, NIMA QILISH kerakligini aytamiz. */
    if(Date.now() - t0 > CHEK){
      throw 'Hujjat juda katta: ' + qatorlar.length + ' qatordan ' +
            (t * BOLAK) + ' tasi yuklandi va vaqt chegarasiga yaqinlashdik ' +
            '(GAS bitta ishga 6 daqiqa beradi). Hujjatni varaqlarga bo\'lib ' +
            'yuklang — har varaq alohida import qilinadi va bir obyektga ' +
            'qo\'shiladi.';
    }
    var javoblar = UrlFetchApp.fetchAll(sorovlar.slice(t, t + TOLQIN));
    for(var j = 0; j < javoblar.length; j++){
      var kod = javoblar[j].getResponseCode();
      if(kod >= 300) throw 't2_xom yuklash xatosi (' + kod + '): ' +
                           javoblar[j].getContentText().slice(0,300);
    }
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

    /* Import/narxlash/rollup qatorlarni ommaviy o'zgartiradi. SQL trigger
       bu bosqichlarda har bir qator uchun butun signal modelini qayta
       hisoblamaydi; yakunda shu obyekt uchun BIR marta yangilanadi. */
    var tS = Date.now();
    natija.bosqichlar.push({bosqich:'signal_yangilash', ms: Date.now() - tS,
      natija: _t2Rpc('t2_signal_refresh_object', {
        p_kompaniya_id: ob.kompaniya_id,
        p_obyekt_id: ob.id
      })});

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
