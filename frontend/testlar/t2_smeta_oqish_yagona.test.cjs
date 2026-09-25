/* SMETA O'QISH YAGONA MODULDA — P6 qo'riqchisi (SMETA_ANATOMIYA_V1 §9).
 *
 * `xlsx` / `xlsx-js-style` kutubxonasini (statik yoki dinamik import) va
 * `sheet_to_json` ni faqat ruxsat etilgan fayllar ishlatadi. Yangi joy smetani
 * o'zicha o'qisa — ustun/rol/RZ aniqlash yana har joyda boshqacha bo'lib
 * ketadi (ustun moslashuvi ham ishlamaydi). Statik importni oxlint ham
 * taqiqlaydi; bu qo'riqchi dinamik `import('xlsx')` va `sheet_to_json` ni ushlaydi.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..');
const RUXSAT = new Set([
  'src/lib/f2-import-parse/xlsxReader.ts',
  'src/lib/hujjat-yozuvchi/kitob.ts',
  'src/lib/lrv-plus-export.ts',
  'src/lib/smeta-anatomiya/korpus/oqish.ts',
]);
const RUXSAT_PAPKA = ['src/lib/smeta-anatomiya/', 'src/lib/hujjat-yozuvchi/'];

function yur(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yur(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !/\.test\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const fayllar = [...yur(path.join(SRC, 'src'), []), ...yur(path.join(SRC, 'functions'), [])];
const buzilish = [];
for (const f of fayllar) {
  const rel = path.relative(SRC, f).split(path.sep).join('/');
  if (RUXSAT.has(rel) || RUXSAT_PAPKA.some((p) => rel.startsWith(p))) continue;
  const t = fs.readFileSync(f, 'utf8');
  if (/from\s+['"]xlsx(-js-style)?['"]|import\(\s*['"]xlsx(-js-style)?['"]\s*\)|require\(\s*['"]xlsx/.test(t)) buzilish.push(`${rel}: xlsx import`);
  if (/\bsheet_to_json\b/.test(t)) buzilish.push(`${rel}: sheet_to_json`);
}
console.log('\n── Smeta faqat yagona modul orqali o\'qiladi ──');
if (buzilish.length) {
  for (const b of buzilish) console.log('  ❌ ' + b);
  console.log('  → smeta-anatomiya / f2-import-parse (readXlsx) / hujjat-yozuvchi dan foydalaning.');
  process.exit(1);
}
console.log(`  ✅ ${fayllar.length} fayl tekshirildi — ruxsatsiz xlsx/sheet_to_json yo'q`);
