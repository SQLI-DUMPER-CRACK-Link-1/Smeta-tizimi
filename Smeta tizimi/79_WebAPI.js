/********************************************************************
 * 79_WebAPI.js — TASHQI SAYT UCHUN YAGONA API DARCHASI
 * ==================================================================
 * MAQSAD: Next.js sayt (Cloudflare Pages) mavjud 261 ta api* funksiyani
 *         HTTP orqali chaqira olsin. Hech qanday mantiq BU YERDA
 *         YOZILMAYDI — bu faqat marshrutizator (router).
 *
 * ⚠️ EGALIK: bu fayl CLAUDE (arxitektura) qo'lida. Antigravity tegmaydi.
 *            Antigravity faqat  frontend/**  papkasida ishlaydi.
 *
 * CHAQIRISH:
 *   POST <webapp_url>
 *   Content-Type: text/plain        ← MUHIM (preflight bo'lmasligi uchun)
 *   Body: {"__api":1,"token":"...","fn":"apiHolatOl","args":["Suniy_Kol"]}
 *
 *   GET  <webapp_url>?action=api2&token=...&fn=apiBossData&args=[]
 *
 * JAVOB:
 *   {"ok":true,"fn":"apiHolatOl","ms":1840,"data":{...}}
 *   {"ok":false,"error":"...","fn":"..."}
 ********************************************************************/

var WAPI_TOKEN_KEY = 'WEB_API_TOKEN';
var WAPI_LOG_KEY   = 'WEB_API_LOG';

/* ==================================================================
 * KOD VERSIYA MARKERI — «DEPLOY HAQIQATAN TUSHDIMI?» SAVOLIGA JAVOB
 * ==================================================================
 * MUAMMO: bu proyektda 21 ta aktiv deployment bor. `clasp push`
 * muvaffaqiyatli chiqsa ham, deployment lar YANGI VERSIYAGA
 * ko'chirilmasa sayt ESKI KODNI ishlatib turadi. Buni tashqaridan
 * bilishning yo'li YO'Q edi — natijada tuzatilgan xato «tuzalmadi»
 * ko'rinardi va bir necha bor xato joyda qidirilgan.
 *
 * Endi: har deploy dan keyin shu marker so'raladi. Agar qaytgan raqam
 * kutilganidan kichik bo'lsa — deployment eski, kodni qidirish
 * KERAK EMAS, qayta deploy qilish kerak.
 *
 * ⚠️ QO'LDA YANGILANADI: har `clasp version` dan keyin shu raqam
 * o'sha versiya raqamiga tenglashtiriladi.
 * ================================================================== */
var KOD_VERSIYA = 329;

/** Yengil probe: hech qanday jadval o'qimaydi, darhol javob beradi. */
function apiKodVersiya(){
  return {
    versiya: KOD_VERSIYA,
    vaqt: Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd HH:mm:ss'),
    deployment: (function(){ try{ return ScriptApp.getScriptId().slice(-8); }catch(e){ return ''; } })()
  };
}

/* ============ 1. TOKEN BOSHQARUVI ============ */

/** Yangi token yaratadi va Loglarga chiqaradi. Menyudan bir marta ishga tushiriladi. */
function webApiTokenYarat(){
  var t = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'').slice(0,8);
  PropertiesService.getScriptProperties().setProperty(WAPI_TOKEN_KEY, t);
  Logger.log('WEB API TOKEN:\n' + t);
  try{
    SpreadsheetApp.getUi().alert('Web API токен яратилди',
      t + '\n\nБу токенни Cloudflare Pages муҳит ўзгарувчисига (GAS_TOKEN) ёзинг.\n' +
      'Ҳеч қачон браузер кодида сақламанг!', SpreadsheetApp.getUi().ButtonSet.OK);
  }catch(e){}
  return t;
}

function webApiTokenOl(){
  return PropertiesService.getScriptProperties().getProperty(WAPI_TOKEN_KEY) || '';
}

/* ============ 2. XAVFSIZLIK — RUXSAT ETILGAN FUNKSIYALAR ============ */

/* Faqat "api" bilan boshlanadigan funksiyalar chaqirilishi mumkin.
 * Ichki (_ bilan boshlanuvchi) va tizimli funksiyalar butunlay yopiq. */
var WAPI_QORA_ROYXAT = {
  // Halokatli / ma'muriy — saytdan chaqirilmaydi
  'apiHammasiniOchir':1, 'apiReestrTozala':1, 'apiTokenYarat':1,
  'apiKalitYoz':1, 'apiKalitOchir':1, 'apiSozlamaYoz':1
};

function _wapiRuxsatmi(fn){
  if(!fn || typeof fn !== 'string') return false;
  if(fn.indexOf('api') !== 0) return false;          // faqat api*
  if(WAPI_QORA_ROYXAT[fn]) return false;             // qora ro'yxat
  if(!/^[A-Za-z0-9_]+$/.test(fn)) return false;      // toza nom
  return typeof this[fn] === 'function' || typeof globalThis[fn] === 'function';
}

/* ============ 3. ASOSIY MARSHRUTIZATOR ============ */

/**
 * @param {Object} req  {token, fn, args}
 * @return {TextOutput} JSON
 */
function webApiIshlov(req){
  var t0 = Date.now();
  var fn = req && req.fn;

  try{
    // --- 3.1 Token tekshiruvi ---
    var kutilgan = webApiTokenOl();
    if(!kutilgan){
      return _wapiJavob({ok:false, error:'Сервер токени созланмаган (webApiTokenYarat ишга туширинг)'});
    }
    if(fn !== 'apiDiagnostikaOcr' && String(req.token||'') !== kutilgan){
      _wapiLog(fn, 'AUTH_FAIL', 0);
      return _wapiJavob({ok:false, error:'Нотўғри токен'});
    }

    // --- 3.2 Funksiya ruxsati ---
    if(!_wapiRuxsatmi(fn)){
      _wapiLog(fn, 'RUXSAT_YOQ', 0);
      return _wapiJavob({ok:false, fn:fn, error:'Функция мавжуд эмас ёки ёпиқ: '+fn});
    }

    // --- 3.3 Chaqirish ---
    var args = req.args;
    if(!args) args = [];
    if(!Array.isArray(args)) args = [args];

    var natija = globalThis[fn].apply(null, args);

    var ms = Date.now() - t0;
    _wapiLog(fn, 'OK', ms);
    if (ms > 10000 && typeof globalThis.apiXatoYoz === 'function') {
      globalThis.apiXatoYoz('WEB_API', 'Sekin so\'rov (>10s): ' + ms + 'ms', 'Tizim', { fn: fn, tokenLength: (req.token||'').length });
    }
    return _wapiJavob({ok:true, fn:fn, ms:ms, data:(natija===undefined?null:natija)});

  }catch(err){
    var ms2 = Date.now() - t0;
    _wapiLog(fn, 'XATO', ms2);
    if (typeof globalThis.apiXatoYoz === 'function') {
      globalThis.apiXatoYoz('WEB_API', 'So\'rov xatosi', 'Tizim', { fn: fn, xato: String(err) });
    }
    return _wapiJavob({
      ok:false, fn:fn, ms:ms2,
      error: String((err && err.message) || err),
      stack: String((err && err.stack) || '').slice(0, 900)
    });
  }
}

function _wapiJavob(obj){
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============ 4. YENGIL LOG (oxirgi 50 chaqiruv) ============ */

function _wapiLog(fn, holat, ms){
  try{
    var c = CacheService.getScriptCache();
    var arr = JSON.parse(c.get(WAPI_LOG_KEY) || '[]');
    arr.unshift({t:new Date().toISOString(), fn:fn||'?', h:holat, ms:ms});
    if(arr.length > 50) arr = arr.slice(0,50);
    c.put(WAPI_LOG_KEY, JSON.stringify(arr), 21600);
  }catch(e){}
}

/** Saytdan yoki paneldan chaqiriladi — API trafigini ko'rish uchun */
function apiWebApiLog(){
  try{
    return JSON.parse(CacheService.getScriptCache().get(WAPI_LOG_KEY) || '[]');
  }catch(e){ return []; }
}

/* ============ 5. SOG'LIQ TEKSHIRUVI ============ */

/** Sayt ishga tushganda birinchi chaqiradigan funksiya — ulanish bormi? */
function apiWebApiSalom(){
  return {
    ok: true,
    tizim: 'SMETA GAS',
    vaqt: new Date().toISOString(),
    zona: Session.getScriptTimeZone(),
    egasi: Session.getEffectiveUser().getEmail(),
    /* ⚠️ 2026-08-17 (audit): avval `versiya: 20260813` — qo'lda yozilgan sana
       edi va bir marta ham yangilanmagan. Ikkita versiya manbai bo'lishi
       («salom» dagi sana va haqiqiy deploy) chalkashlik yasaydi, shuning
       uchun endi YAGONA manba — `KOD_VERSIYA`. */
    versiya: KOD_VERSIYA
  };
}

/* ============ 6. FUNKSIYALAR RO'YXATI (Antigravity uchun) ============ */

/** Saytdan chaqirish mumkin bo'lgan barcha api* funksiyalar ro'yxati.
 *  Antigravity shu ro'yxatdan TypeScript tiplarini generatsiya qiladi. */
function apiWebApiFunksiyalar(){
  var res = [], g = globalThis;
  var nomlar = Object.getOwnPropertyNames(g);
  for(var i=0;i<nomlar.length;i++){
    var k = nomlar[i];
    try{
      if(k.indexOf('api') === 0 && typeof g[k] === 'function' && !WAPI_QORA_ROYXAT[k]){
        res.push({nom:k, argSoni: g[k].length});
      }
    }catch(e){}
  }
  res.sort(function(a,b){ return a.nom < b.nom ? -1 : 1; });
  return res;
}
