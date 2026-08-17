/* _f2JobSet / _f2JobGet ni HAQIQIY kod bilan sinaymiz (stub muhitda).
   30_Panel.js dan faqat shu ikki funksiya + konstantalarni ajratib olamiz. */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/PC/Documents/GAS/Smeta tizimi/30_Panel.js', 'utf8');

/* Kerakli bo'lakni matndan ajratamiz — boshqa hech narsa yuklanmaydi */
const bosh = src.indexOf("var _F2_JOB_KEY = 'F2_FON_JOB';");
const oxir = src.indexOf('/* Panel monitoring reconnect', bosh);
if (bosh < 0 || oxir < 0) { console.log('❌ bo\'lak topilmadi'); process.exit(1); }
const kod = src.slice(bosh, oxir);

/* ─── STUB muhit ─── */
let loglar = [], propStore = {}, keshStore = {};
let propYiqilsin = false, keshYiqilsin = false;

const muhit = {
  Logger: { log: (s) => loglar.push(String(s)) },
  PropertiesService: {
    getScriptProperties: () => ({
      setProperty: (k, v) => { if (propYiqilsin) throw new Error('QUOTA_EXCEEDED (stub)'); propStore[k] = v; },
      getProperty: (k) => (propYiqilsin ? (() => { throw new Error('READ_FAIL (stub)'); })() : (propStore[k] ?? null)),
    }),
  },
  cachePut: (k, o) => { if (keshYiqilsin) return false; keshStore[k] = JSON.parse(JSON.stringify(o)); return true; },
  cacheGet: (k) => keshStore[k] ?? null,
};

const fn = new Function(...Object.keys(muhit), kod + '\nreturn {_f2JobSet, _f2JobGet};');
const { _f2JobSet, _f2JobGet } = fn(...Object.values(muhit));

let ok = 0, xato = 0;
const T = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '  → ' + izoh : '')); }
};

console.log('\n── 1. ODATIY YO\'L ──');
_f2JobSet({ status: 'ishlayapti', done: 5, total: 10, xabar: 'test' });
T('Properties ga yozildi', !!propStore['F2_FON_JOB']);
T('keshga ham dublikat yozildi', !!keshStore['f2fon_job_kesh']);
T('o\'qish Properties dan keladi', _f2JobGet().done === 5);
T('yangilandi vaqt belgisi qo\'yildi', typeof _f2JobGet().yangilandi === 'number');
T('ortiqcha log yo\'q', loglar.length === 0, 'loglar: ' + JSON.stringify(loglar));

console.log('\n── 2. PROPERTIES YIQILDI (asosiy xavf) ──');
loglar = []; propYiqilsin = true; keshStore = {};
_f2JobSet({ status: 'tugadi', done: 10, total: 10, xabar: 'Тугади' });
T('xato JIM YUTILMADI — logga tushdi', loglar.some(l => /ScriptProperties yozilmadi/.test(l)));
T('logda status va progress bor', loglar.some(l => /status=tugadi/.test(l) && /10\/10/.test(l)));
T('holat KESHDA saqlandi', keshStore['f2fon_job_kesh'].status === 'tugadi');
T('_f2JobGet keshdan tikladi', _f2JobGet() && _f2JobGet().status === 'tugadi');

console.log('\n── 3. IKKALASI HAM YIQILDI ──');
loglar = []; keshYiqilsin = true; keshStore = {};
_f2JobSet({ status: 'xato', done: 3, total: 9, xabar: 'x' });
T('«HOLAT YO\'QOLDI» ogohlantirishi chiqdi', loglar.some(l => /HOLAT YO'QOLDI/.test(l)));
T('_f2JobGet null qaytardi (soxta holat yo\'q)', _f2JobGet() === null);

console.log('\n── 4. UZUN XABAR HOLATNI YO\'QOTMASLIGI ──');
loglar = []; propYiqilsin = false; keshYiqilsin = false; propStore = {}; keshStore = {};
_f2JobSet({ status: 'xato', done: 1, total: 2, xabar: 'X'.repeat(50000) });
const j4 = _f2JobGet();
T('xabar 500 belgiga qisqartirildi', j4.xabar.length === 500, 'uzunlik: ' + j4.xabar.length);
T('holat baribir saqlandi', j4.status === 'xato' && j4.done === 1);

console.log('\n── 5. null/undefined bilan chaqirilsa ──');
loglar = [];
let crash = false;
try { _f2JobSet(null); _f2JobSet(undefined); } catch (e) { crash = true; }
T('yiqilmadi', !crash);
T('avvalgi holat buzilmadi', _f2JobGet().status === 'xato');

console.log(`\n═══ ${ok} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);
