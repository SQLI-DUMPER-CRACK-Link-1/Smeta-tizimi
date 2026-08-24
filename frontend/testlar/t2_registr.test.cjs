/* TIZIM_01 → TIZIM_02 KO'CHIRISH REESTRI — DRIFT QO'RIQCHISI
 * ═══════════════════════════════════════════════════════════════════
 *
 * ⚠️ NEGA BU TEST BOR:
 *
 * Ko'chirish xaritasi — hujjat emas, TIZIM HOLATI. Qo'lda yozilgan
 * xarita birinchi kunidayoq eskiradi: kimdir Tizim_01 ga yangi `api*`
 * qo'shadi, xaritada u yo'q, va «hammasi ko'chirildi» degan soxta
 * tasavvur paydo bo'ladi. Bu loyihada allaqachon bir marta bo'lgan —
 * 140 hookdan 30 tasi ekranga umuman ulanmagan edi va buni hech kim
 * bilmasdi.
 *
 * Shuning uchun xarita KODDAN yasaladi va bu test uni har safar qayta
 * yasab solishtiradi. Eskirgan bo'lsa — YIQILADI.
 *
 * Yiqilsa nima qilish kerak:
 *     node tizim02/registr.gen.cjs
 * va agar «TASNIFSIZ» desa — `tizim02/tasnif.json` ga domen qo'shing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ILDIZ = path.join(__dirname, '..', '..');
const T2 = path.join(ILDIZ, 'tizim02');

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

console.log('\n── Reestr koddan yasaladi va eskirmaydi ──');

tek('generator mavjud', fs.existsSync(path.join(T2, 'registr.gen.cjs')));
tek('tasnif qo\'lda to\'ldiriladi', fs.existsSync(path.join(T2, 'tasnif.json')));
tek('REGISTR.json yasalgan', fs.existsSync(path.join(T2, 'REGISTR.json')));

/* ⚠️ ASOSIY TEKSHIRUV: reestrni qayta yasab, diskdagisi bilan
   solishtiramiz. Tizim_01 ga yangi funksiya qo'shilgan bo'lsa —
   farq chiqadi va shu yerda ushlanadi. */
let drift = null;
try {
  execFileSync(process.execPath, [path.join(T2, 'registr.gen.cjs'), '--tekshir'],
               { cwd: ILDIZ, stdio: 'pipe' });
} catch (e) {
  drift = String((e.stderr && e.stderr.toString()) || e.message).trim();
}
tek('reestr kod bilan MOS (drift yo\'q)', drift === null, drift);

const R = JSON.parse(fs.readFileSync(path.join(T2, 'REGISTR.json'), 'utf8'));

tek('har bir funksiyaning domeni bor', R.tasnifsiz.length === 0,
    R.tasnifsiz.join(', '));

console.log('\n── Reestr mazmuni ma\'noli ──');

const F = Object.values(R.funksiyalar);
tek('funksiyalar topildi (>200)', F.length > 200, 'topildi: ' + F.length);

const HOLATLAR = ['tayyor', 'qisman', 'kutilmoqda', 'joyida', 'kerakmas'];
tek('holat qiymatlari faqat ruxsat etilganlardan',
    F.every((f) => HOLATLAR.includes(f.holat)));

const QATLAMLAR = ['SUPABASE', 'GAS', 'KOPRIK', 'YOQ'];
tek('qatlam qiymatlari faqat ruxsat etilganlardan',
    F.every((f) => QATLAMLAR.includes(f.qatlam)));

/* ⚠️ GAS qatlami «qarz» EMAS. Uni foizga qo'shish tizimni
   bor-yo'g'idan yomonroq ko'rsatardi va navbatni buzardi. */
tek('GAS qatlamidagilar «joyida», qarz emas',
    F.filter((f) => f.qatlam === 'GAS').every((f) => f.holat === 'joyida'));
tek('foiz faqat ko\'chiriladiganlardan hisoblanadi',
    R.manba.hisobga === R.manba.jami - R.manba.joyida - R.manba.kerakmas,
    JSON.stringify(R.manba));

/* ⚠️ «Tayyor» deyish uchun NIMA qoplagani yozilgan bo'lishi shart.
   Busiz «tayyor» so'zi tekshirib bo'lmaydigan da'vo bo'lib qoladi. */
tek('«tayyor» va «qisman» larda qopladi ko\'rsatilgan',
    F.filter((f) => f.holat === 'tayyor' || f.holat === 'qisman')
     .every((f) => !!f.qopladi),
    F.filter((f) => (f.holat === 'tayyor' || f.holat === 'qisman') && !f.qopladi)
     .map((f) => f.fayl).join(', '));

console.log('\n── Navbat agent uchun aniq ──');

tek('navbat tartibi bor', Array.isArray(R.navbat) && R.navbat.length > 0);
tek('navbatdagi har bir domen haqiqatan mavjud',
    R.navbat.every((d) => R.domenlar[d]),
    R.navbat.filter((d) => !R.domenlar[d]).join(', '));

const keyingi = R.navbat.find((d) => R.domenlar[d] && R.domenlar[d].kochiriladi &&
                                     R.domenlar[d].foiz < 100);
tek('keyingi ish aniqlanadi', !!keyingi, 'hammasi tugagan bo\'lsa — bu yaxshi');

tek('KEYINGI.md yasalgan va keyingi ishni ko\'rsatadi', (() => {
  const md = fs.readFileSync(path.join(T2, 'KEYINGI.md'), 'utf8');
  return !keyingi || md.includes('Keyingi ish: `' + keyingi + '`');
})());

tek('qatlam arxitekturasi hujjatlashtirilgan',
    fs.existsSync(path.join(T2, 'ARXITEKTURA.md')));
/* Havolalar HAQIQIY fayllarga ketsin — yo'q faylga havola
   agentni chalg'itadi va u qoidalarni umuman o'qimay qoladi. */
tek('AGENT.md dagi ichki havolalar mavjud', (() => {
  const md = fs.readFileSync(path.join(T2, 'AGENT.md'), 'utf8');
  const yollar = (md.match(/`([A-Za-z0-9_./-]+\.(md|json|cjs|sql))`/g) || [])
    .map((x) => x.replace(/`/g, ''))
    .filter((x) => x.indexOf('/') > 0 && x.indexOf('*') < 0);
  const yoq = yollar.filter((y) => !fs.existsSync(path.join(ILDIZ, y)));
  if (yoq.length) console.log('       yo\'q: ' + yoq.join(', '));
  return yoq.length === 0;
})());
tek('agent shartnomasi mavjud', fs.existsSync(path.join(T2, 'AGENT.md')),
    'AI agent qaysi qoidalar bilan ishlashini bilishi kerak');

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
