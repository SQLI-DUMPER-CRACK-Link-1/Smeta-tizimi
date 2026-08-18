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
