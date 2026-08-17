/* SUPABASE DIRTY-RO'YXAT testi — HAQIQIY kod, stub muhitda.
   Asosiy shart: push YIQILGAN obyekt ro'yxatda QOLISHI kerak.
   (Avval butun ro'yxat o'chirilardi va u obyekt boshqa hech qachon
   sinxlanmasdi — Supabase da eskirgan ma'lumot abadiy qolardi.) */
const fs = require('fs');
const src = fs.readFileSync('C:/Users/PC/Documents/GAS/Smeta tizimi/70_Supabase.js', 'utf8');

/* Dirty-tracking bo'lagini ajratamiz */
const bosh = src.indexOf('function _sbDirty(obyekt){');
const oxir = src.indexOf('/* ============ SOATLIK SINX', bosh);
if (bosh < 0 || oxir < 0) { console.log('❌ bo\'lak topilmadi'); process.exit(1); }
const kod = src.slice(bosh, oxir);

let loglar = [], store = {}, yozishYiqilsin = false;
const muhit = {
  Logger: { log: (s) => loglar.push(String(s)) },
  PropertiesService: {
    getScriptProperties: () => ({
      setProperty: (k, v) => { if (yozishYiqilsin) throw new Error('QUOTA (stub)'); store[k] = v; },
      getProperty:  (k) => store[k] ?? null,
      deleteProperty: (k) => { delete store[k]; },
    }),
  },
};
const fn = new Function(...Object.keys(muhit), kod +
  '\nreturn {_sbDirty,_sbDirtyOl,_sbDirtyTozala,_sbDirtyOchir};');
const { _sbDirty, _sbDirtyOl, _sbDirtyTozala, _sbDirtyOchir } = fn(...Object.values(muhit));

let ok = 0, xato = 0;
const T = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '  → ' + izoh : '')); }
};

console.log('\n── 1. BELGILASH ──');
_sbDirty('Amfiteatr'); _sbDirty('Suniy_Kol'); _sbDirty('Amfiteatr');
T('uch chaqiruv → ikki unikal obyekt', _sbDirtyOl().length === 2, JSON.stringify(_sbDirtyOl()));
T('bo\'sh nom e\'tiborsiz', (_sbDirty(''), _sbDirty(null), _sbDirtyOl().length === 2));

console.log('\n── 2. ASOSIY XAVF: YIQILGAN OBYEKT RO\'YXATDA QOLISHI ──');
store = {}; _sbDirty('A'); _sbDirty('B'); _sbDirty('C');
/* A va C push bo'ldi, B yiqildi */
_sbDirtyOchir(['A', 'C']);
const qolgan = _sbDirtyOl();
T('yiqilgan «B» ro\'yxatda QOLDI', qolgan.length === 1 && qolgan[0] === 'B', JSON.stringify(qolgan));
T('muvaffaqiyatli A va C chiqib ketdi', !qolgan.includes('A') && !qolgan.includes('C'));

console.log('\n── 3. HAMMASI MUVAFFAQIYATLI → kalit butunlay o\'chadi ──');
store = {}; _sbDirty('X'); _sbDirty('Y');
_sbDirtyOchir(['X', 'Y']);
T('ro\'yxat bo\'sh', _sbDirtyOl().length === 0);
T('SB_DIRTY kaliti o\'chirildi (axlat qolmadi)', store['SB_DIRTY'] === undefined);

console.log('\n── 4. POYGA: sinx paytida yangi o\'zgarish ──');
store = {}; _sbDirty('Eski1'); _sbDirty('Eski2');
const olindi = _sbDirtyOl();            // sinx ro'yxatni oldi
_sbDirty('SinxPaytidaYangi');           // ish davomida yangi o'zgarish keldi
_sbDirtyOchir(olindi);                  // faqat OLINGANLAR o'chiriladi
const q4 = _sbDirtyOl();
T('sinx paytida kelgan yangi belgi SAQLANDI', q4.length === 1 && q4[0] === 'SinxPaytidaYangi', JSON.stringify(q4));

console.log('\n── 5. TOZALASH (to\'liq sinx boshida) ──');
store = {}; _sbDirty('P'); _sbDirty('Q');
_sbDirtyTozala();
T('butun ro\'yxat tozalandi', _sbDirtyOl().length === 0);

console.log('\n── 6. YOZUV YIQILSA — JIM EMAS ──');
store = {}; loglar = []; yozishYiqilsin = true;
_sbDirty('Yiqiladi');
T('xato logga tushdi', loglar.some(l => /dirty belgilanmadi/.test(l)));
T('logda obyekt nomi bor', loglar.some(l => /Yiqiladi/.test(l)));
T('«kunlik to\'liq sinx tuzatadi» izohi bor', loglar.some(l => /kunlik/.test(l)));
yozishYiqilsin = false;

console.log('\n── 7. _sbDirtyOchir bo\'sh/nosoz argument ──');
store = {}; _sbDirty('Z');
let crash = false;
try { _sbDirtyOchir([]); _sbDirtyOchir(null); _sbDirtyOchir(undefined); } catch (e) { crash = true; }
T('yiqilmadi', !crash);
T('ro\'yxat o\'zgarmadi', _sbDirtyOl().length === 1 && _sbDirtyOl()[0] === 'Z');

console.log(`\n═══ ${ok} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);
