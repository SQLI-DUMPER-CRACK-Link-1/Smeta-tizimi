/* FRONTEND TIPI ↔ GAS HAQIQATI nomuvofiqligi skaneri.
 *
 * NIMA UCHUN BOR. 2026-08-17: «Shaxsiy smeta umuman ishlamaydi» va
 * Monitoring dagi bo'sh «TRIGGERLAR» oynasi — ikkalasining sababi bir xil
 * bo'lib chiqdi: `gas<TIP>()` da yozilgan TIP GAS haqiqatda qaytaradigan
 * maydonlarga MOS EMAS edi.
 *
 * Bu xatoni TypeScript KO'RMAYDI: `gas<T>()` tipi qo'lda yozilgan ishonch,
 * tekshiruv emas. Server boshqa maydon qaytarsa TS jim turadi, ekranda esa
 * bo'sh qator / bo'sh oyna paydo bo'ladi va sababi ko'rinmaydi.
 *
 * ISHLATISH:  node testlar/shartnoma.tekshir.cjs
 * Chiqish kodi: 0 — to'liq nomuvofiqlik yo'q, 1 — bor.
 *
 * ⚠️ Bu evristika: GAS tanasidagi obyekt kalitlarini matn bo'yicha yig'adi,
 * shuning uchun «QISMAN» ro'yxatida soxta signal bo'lishi mumkin (masalan
 * yordamchi funksiya qaytargan maydonlar). «TO'LIQ» esa deyarli har doim
 * haqiqiy xato — bir ham maydon mos kelmasligi tasodif emas.
 */
const fs = require('fs');
const path = require('path');
const FE = path.join(__dirname, '..', 'src');
const GAS = path.join(__dirname, '..', '..', 'Smeta tizimi');

/** Funksiya tanasini qo'pol ajratadi (keyingi top-level `function` gacha). */
function tanaOl(src, nom) {
  const re = new RegExp('^function\\s+' + nom + '\\s*\\(', 'm');
  const m = re.exec(src);
  if (!m) return null;
  const qoldiq = src.slice(m.index + 1);
  const keyingi = qoldiq.search(/^function\s+[A-Za-z_$]/m);
  return keyingi < 0 ? src.slice(m.index) : src.slice(m.index, m.index + 1 + keyingi);
}

const gasMaydon = {};
for (const f of fs.readdirSync(GAS).filter((x) => /\.js$/.test(x))) {
  const src = fs.readFileSync(path.join(GAS, f), 'utf8');
  for (const m of src.matchAll(/^function\s+(api[A-Za-z0-9_]*)\s*\(/gm)) {
    const tana = tanaOl(src, m[1]);
    if (!tana) continue;
    const s = new Set();
    for (const r of tana.matchAll(/[{,]\s*([A-Za-z_$][\w$]*)\s*:/g)) s.add(r[1]);
    for (const r of tana.matchAll(/\b\w+\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) s.add(r[1]);
    if (s.size) gasMaydon[m[1]] = s;
  }
}

function walk(d, a = []) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p, a);
    else if (/\.tsx?$/.test(p)) a.push(p);
  }
  return a;
}

const toliq = [];
const qisman = [];
for (const f of walk(FE)) {
  const src = fs.readFileSync(f, 'utf8');
  const L = src.split(/\r?\n/);
  for (const m of src.matchAll(/gas\s*<([\s\S]{0,400}?)>\s*\(\s*['"](api[\w]+)['"]/g)) {
    const gasM = gasMaydon[m[2]];
    if (!gasM) continue;
    const tipMaydon = [...m[1].matchAll(/([A-Za-z_$][\w$]*)\s*\??\s*:/g)].map((x) => x[1]);
    if (!tipMaydon.length) continue;
    const yoq = tipMaydon.filter((k) => !gasM.has(k));
    if (!yoq.length) continue;
    const satr = L.findIndex((l) => l.indexOf("'" + m[2] + "'") >= 0) + 1;
    const nisbiy = path.relative(FE, f).split(path.sep).join('/');
    const yozuv = { fayl: nisbiy, satr, api: m[2], yoq,
                    kutilgan: tipMaydon, gasBor: [...gasM].slice(0, 12) };
    if (yoq.length === tipMaydon.length) toliq.push(yozuv);
    else qisman.push(yozuv);
  }
}

console.log('GAS api* (obyekt qaytaradigan): ' + Object.keys(gasMaydon).length);
console.log('\n🔴 TO\'LIQ NOMUVOFIQLIK (bir ham maydon mos emas): ' + toliq.length + ' ta');
for (const s of toliq) {
  console.log('\n  ' + s.fayl + ':' + s.satr + '  →  ' + s.api);
  console.log('     frontend kutadi : ' + s.kutilgan.join(', '));
  console.log('     GAS da bor      : ' + s.gasBor.join(', '));
}
console.log('\n🟡 QISMAN (ba\'zi maydon yo\'q — soxta signal bo\'lishi mumkin): ' + qisman.length + ' ta');
for (const s of qisman) {
  console.log('  ' + s.fayl + ':' + s.satr + '  ' + s.api + '  →  yo\'q: ' + s.yoq.join(', '));
}
process.exit(toliq.length ? 1 : 0);
