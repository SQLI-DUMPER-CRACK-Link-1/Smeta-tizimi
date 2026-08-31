/* STOR-001B — T2 GLOBAL DRIVE ROOT FALLBACK QO'RIQCHISI (inventar + regress).
 *
 * Kontrakt: docs/architecture/STORAGE_FOUNDATION_CONTRACT_V1.md §7
 *   Hech bir T2 storage caller company/project/object/document papkasini
 *   global `sozAsosiy().rootId` / `ROOT_FOLDER_ID` / `DriveApp.getRootFolder()`
 *   yoki global nomli papka (`Tizim_02`, `_MANBA`) orqali TOPMASLIGI kerak.
 *   Kanonik yo'l: 97_T2Storage.js resolverlari -> saqlangan folder_id.
 *
 * Bu test:
 *   1) T2 GAS storage callerlaridagi taqiqlangan pattern INVENTARINI chiqaradi;
 *   2) har fayl uchun ma'lum BAZELINE dan OSHMAsligini ta'minlaydi
 *      (STOR-001B har callerni ko'chirgani sari BAZELINE kamayadi);
 *   3) ACCEPTANCE = BAZELINE bo'sh (barcha qiymatlar 0) -> STOR-001 storage
 *      integratsiya lane yopiladi.
 *
 * Istisno: `/* LEGACY-STORAGE-ALLOW *\/` izohi bilan belgilangan qator —
 * faqat aniq legacy-only kod uchun (t2_company_storage_legacy_allowlist).
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ILDIZ = path.resolve(__dirname, '..', '..');
const GAS = path.join(ILDIZ, 'Smeta tizimi');

/* T2 storage callerlar. TIZIM_01 fayllari bu ro'yxatda EMAS. */
const T2_FAYLLAR = [
  'T2_Kozgu.js', 'T2_Yuklash.js', 'T2_Import.js', 'T2_F2Import.js',
  'T2_Olchov.js', '95_ObyektHujjat.js', '96_T2Papka.js',
];

/* Taqiqlangan patternlar — T2 papka rezolyutsiyasi global manbadan. */
const PATTERNLAR = [
  { nom: 'global config root (.rootId)', re: /\.rootId\b/ },
  { nom: 'global root folder', re: /getRootFolder\(\)\s*\.\s*(?:getFolders|createFolder|addFile\s*\([^)]*parent)/ },
  { nom: 'global nomli papka (Tizim_02 / _MANBA)', re: /getFoldersByName\(\s*['"](?:Tizim_02|_MANBA)['"]\s*\)/ },
];

/* BAZELINE — hozirgi ma'lum holat (STOR-001B kirish nuqtasi).
 * Har ko'chirishdan keyin mos qiymat kamaytiriladi; 0 ga yetganda olib tashlanadi.
 * Yangi fayl yoki oshgan son -> test YIQILADI. */
const BAZELINE = {
  'T2_Kozgu.js': 2,        // 1x .rootId + 1x 'Tizim_02' (ishchi smeta papkasi)
  'T2_Yuklash.js': 3,      // 1x .rootId + 1x 'Tizim_02' + 1x '_MANBA'
  '95_ObyektHujjat.js': 1, // 1x .rootId (obyekt hujjat papkasi)
  '96_T2Papka.js': 1,      // 1x .rootId (T2 papka helper)
};

function gitTracked(nisbiy) {
  try {
    execFileSync('git', ['-C', ILDIZ, 'ls-files', '--error-unmatch', nisbiy],
      { stdio: 'ignore' });
    return true;
  } catch (e) { return false; }
}

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

console.log('\n── T2 global-root fallback inventari ──');
const topilgan = {};       // fayl -> [{qator, matn, pattern}]
for (const fayl of T2_FAYLLAR) {
  const nisbiy = 'Smeta tizimi/' + fayl;
  const mutlaq = path.join(GAS, fayl);
  if (!fs.existsSync(mutlaq) || !gitTracked(nisbiy)) continue;
  const qatorlar = fs.readFileSync(mutlaq, 'utf8').split(/\r?\n/);
  for (let i = 0; i < qatorlar.length; i++) {
    const q = qatorlar[i];
    if (/LEGACY-STORAGE-ALLOW/.test(q) || /LEGACY-STORAGE-ALLOW/.test(qatorlar[i - 1] || '')) continue;
    for (const p of PATTERNLAR) {
      if (p.re.test(q)) {
        (topilgan[fayl] = topilgan[fayl] || []).push(
          { qator: i + 1, matn: q.trim().slice(0, 90), pattern: p.nom });
      }
    }
  }
}

const jamiFayl = Object.keys(topilgan);
if (!jamiFayl.length) {
  console.log('  (toza — bitta ham global-root pattern yo\'q)');
} else {
  for (const f of jamiFayl) {
    console.log('  • ' + f + '  (' + topilgan[f].length + ')');
    for (const t of topilgan[f]) console.log('      L' + t.qator + '  [' + t.pattern + ']  ' + t.matn);
  }
}

console.log('\n── Regress qo\'riqchisi (bazeline oshmasin) ──');

/* 1) BAZELINE da yo'q faylda topilsa -> yangi qarz, yiqilish. */
for (const f of jamiFayl) {
  if (!(f in BAZELINE)) {
    tek(f + ': BAZELINE ro\'yxatida yo\'q, lekin global-root pattern bor', false,
      'kanonik resolverga ko\'chir yoki LEGACY-STORAGE-ALLOW bilan belgila');
  }
}

/* 2) BAZELINE dagi har fayl uchun son oshmaganini tekshir. */
for (const f of Object.keys(BAZELINE)) {
  const hozir = (topilgan[f] || []).length;
  tek(f + ': global-root pattern soni <= bazeline (' + BAZELINE[f] + ')',
    hozir <= BAZELINE[f],
    'hozir ' + hozir + ' ta — yangi qarz qo\'shilgan');
}

/* 3) Progress ko'rsatkichi: kamaygan fayllarni belgilaydi (informatsion). */
let jamiHozir = 0, jamiBazeline = 0;
for (const f of Object.keys(BAZELINE)) {
  jamiBazeline += BAZELINE[f];
  jamiHozir += (topilgan[f] || []).length;
}
console.log('\n  Progress: ' + jamiHozir + ' / ' + jamiBazeline +
  ' global-root pattern qoldi (ACCEPTANCE = 0).');
if (jamiHozir === 0) console.log('  🎉 STOR-001B acceptance: T2 global Drive fallback = 0');

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
