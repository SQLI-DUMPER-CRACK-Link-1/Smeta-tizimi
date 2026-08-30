/* BARCHA TEKSHIRUVLARNI BITTA BUYRUQDA YURGIZADI.
 *
 *    node testlar/hammasi.cjs
 *
 * Bu testlar `tsc` va lint ko'rmaydigan xatolarni ushlaydi — ular
 * 2026-08-17 da haqiqiy nosozliklardan tug'ilgan:
 *   • menyu havolasi ↔ marshrut nomuvofiqligi (foydalanuvchini kirish
 *     sahifasiga otib yuborardi)
 *   • frontend tipi ↔ GAS javobi nomuvofiqligi (bo'sh oyna / bo'sh qator)
 *   • obyekt kartasi BOSHQA obyektni ochishi
 *
 * Chiqish kodi 0 — hammasi toza, 1 — kamida bittasi yiqildi.
 */
const { execFileSync } = require('child_process');
const path = require('path');

const TESTLAR = [
  ['Menyu havolasi ↔ marshrut',        'marshrut.test.mjs'],
  ['Obyekt kartasi qaysi nomni ochadi', 'obyekt_guruh.test.cjs'],
  ['Frontend tipi ↔ GAS javobi',        'shartnoma.tekshir.cjs'],
  ['TIZIM_02 kompaniya + versiya',      't2_kompaniya.test.cjs'],
  ['TIZIM_02 hujjat darajasi',          't2_hujjat.test.cjs'],
  ['TIZIM_02 ko‘zgu LRV_PLUS shakli',   't2_kozgu.test.cjs'],
  ['TIZIM_02 F2 fayl importi',          't2_f2import.test.cjs'],
  ['TIZIM_02 smeta sarlavhasi',         't2_format.test.cjs'],
  ['TIZIM_02 ko‘chirish reestri',      't2_registr.test.cjs'],
  ['TIZIM_02 ikki agent hududi',       't2_navbat.test.cjs'],
  ['TIZIM_02 kodlash yaxlitligi',       't2_kodlash_yaxlitligi.test.cjs'],
  ['Git dublikat + apostrof qo\'riqchisi', 't2_git_yaxlitligi.test.cjs'],
  ['T2 object-create vertical slice',  't2_object_create.test.cjs'],
  ['T2 project-storage provisioning', 't2_project_storage.test.cjs'],
  ['T2 company-storage workspace', 't2_company_storage.test.cjs'],
  ['T2 document upload registry', 't2_document_upload.test.cjs'],
];

let yiqildi = 0;
for (const [nom, fayl] of TESTLAR) {
  console.log('\n══════════════════════════════════════════════');
  console.log('  ' + nom + '   (' + fayl + ')');
  console.log('══════════════════════════════════════════════');
  try {
    const chiqish = execFileSync(process.execPath, [path.join(__dirname, fayl)],
      { encoding: 'utf8' });
    process.stdout.write(chiqish);
  } catch (e) {
    yiqildi++;
    if (e.stdout) process.stdout.write(e.stdout);
    if (e.stderr) process.stderr.write(e.stderr);
    console.log('  ⛔ YIQILDI');
  }
}

console.log('\n══════════════════════════════════════════════');
console.log(yiqildi ? '⛔ ' + yiqildi + ' ta tekshiruv yiqildi'
                    : '✅ Barcha tekshiruvlar o\'tdi');
console.log('══════════════════════════════════════════════');
process.exit(yiqildi ? 1 : 0);
