/* IKKI AGENT HUDUDI — TO'QNASHUV QO'RIQCHISI
 * ═══════════════════════════════════════════════════════════════════
 *
 * ⚠️ NEGA BU TEST BOR:
 *
 * 2026-06-25 da incident bo'lgan: eski bazadan `clasp push` qilinib,
 * 24+ jonli funksiya bosib ketilgan. Sabab texnik emas edi — ikki
 * tomon bir-birining nima qilayotganini bilmasdi.
 *
 * `tizim02/navbat.json` shu muammoning yechimi: kim qaysi domenni
 * olgani yozilgan. Lekin yozilgan hujjat o'z-o'zidan hech nimani
 * himoya qilmaydi — u eskirsa, yana o'sha holatga qaytamiz.
 *
 * Shu test uni tirik saqlaydi:
 *   • yangi domen paydo bo'lsa va egasi belgilanmasa → YIQILADI
 *   • egasi noma'lum agent bo'lsa → YIQILADI
 *   • MULOQOT.md yo'q faylga havola qilsa → YIQILADI
 */
const fs = require('fs');
const path = require('path');

const ILDIZ = path.join(__dirname, '..', '..');
const T2 = path.join(ILDIZ, 'tizim02');

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

console.log('\n── Muloqot fayllari joyida ──');

tek('navbat.json mavjud', fs.existsSync(path.join(T2, 'navbat.json')));
tek('MULOQOT.md mavjud', fs.existsSync(path.join(T2, 'MULOQOT.md')));
if (!fs.existsSync(path.join(T2, 'navbat.json'))) {
  console.log('\n' + ok + ' o\'tdi, ' + (xato + 1) + ' yiqildi');
  process.exit(1);
}

const N = JSON.parse(fs.readFileSync(path.join(T2, 'navbat.json'), 'utf8'));
const R = JSON.parse(fs.readFileSync(path.join(T2, 'REGISTR.json'), 'utf8'));
const MD = fs.readFileSync(path.join(T2, 'MULOQOT.md'), 'utf8');

console.log('\n── Hudud to\'liq va ziddiyatsiz ──');

const kochiriladigan = Object.entries(R.domenlar)
  .filter(([, x]) => x.kochiriladi).map(([d]) => d).sort();
const olingan = Object.keys(N.hudud).filter((k) => k[0] !== '_').sort();

/* ⚠️ ASOSIY TEKSHIRUV: ko'chiriladigan HAR BIR domenning egasi bo'lsin.
   Egasiz domen = ikki agent bir vaqtda olib qolishi mumkin bo'lgan
   joy = to'qnashuv. */
const egasiz = kochiriladigan.filter((d) => !olingan.includes(d));
tek('har bir ko\'chiriladigan domenning egasi bor', egasiz.length === 0,
    'egasiz: ' + egasiz.join(', ') + ' → tizim02/navbat.json ga qo\'shing');

const yoq = olingan.filter((d) => !kochiriladigan.includes(d));
tek('navbatda mavjud bo\'lmagan domen yo\'q', yoq.length === 0,
    'reestrda yo\'q: ' + yoq.join(', '));

const AGENTLAR = Object.keys(N.agentlar).concat(['kelishilsin']);
const notanish = olingan.filter((d) => !AGENTLAR.includes(N.hudud[d].egasi));
tek('har bir egasi tanilgan agent', notanish.length === 0,
    notanish.map((d) => d + '→' + N.hudud[d].egasi).join(', '));

const HOLATLAR = ['navbatda', 'ishlanmoqda', 'yarim', 'tayyor', 'kutilmoqda'];
const yomonHolat = olingan.filter((d) => !HOLATLAR.includes(N.hudud[d].holat));
tek('holat qiymatlari ruxsat etilganlardan', yomonHolat.length === 0,
    yomonHolat.join(', '));

/* ⚠️ Bir agent bir vaqtda BITTA domen ustida ishlasin. Ikkitasini
   ochiq qoldirsa, yarim ish qoladi va ikkinchi agent kutadi. */
for (const agent of Object.keys(N.agentlar)) {
  const band = olingan.filter((d) => N.hudud[d].egasi === agent &&
                                     N.hudud[d].holat === 'ishlanmoqda');
  tek(agent + ': bir vaqtda ko\'pi bilan 1 domen ochiq', band.length <= 1,
      'ochiq: ' + band.join(', '));
}

console.log('\n── Umumiy fayllar va taqiq haqiqiy ──');

/* Umumiy fayllar ro'yxati HAQIQIY fayllarga ishora qilsin — yo'q
   faylga ogohlantirish yozish agentni chalg'itadi. */
const umumiyYoq = (N.umumiy_fayllar.royxat || [])
  .map((x) => x.fayl).filter((f) => !fs.existsSync(path.join(ILDIZ, f)));
tek('umumiy fayllar ro\'yxati haqiqiy', umumiyYoq.length === 0,
    'yo\'q: ' + umumiyYoq.join(', '));

const taqiqYoq = (N.taqiq.fayllar || [])
  .filter((f) => !fs.existsSync(path.join(ILDIZ, f)));
tek('taqiq ro\'yxatidagi fayllar mavjud', taqiqYoq.length === 0,
    'yo\'q: ' + taqiqYoq.join(', '));

/* ⚠️ Ikki joyda takrorlangan ro'yxat — eng katta to'qnashuv nuqtasi.
   Ogohlantirish navbat.json da YOZILGAN bo'lishi shart. */
tek('AMALLAR ikki joyda ekani ogohlantirilgan',
    JSON.stringify(N.umumiy_fayllar).includes('t2_kompaniya.test.cjs'));

console.log('\n── MULOQOT.md ishonchli ──');

const havolalar = (MD.match(/`([A-Za-z0-9_./-]+\.(md|json|cjs|sql|ts|tsx|js))`/g) || [])
  .map((x) => x.replace(/`/g, ''))
  .filter((x) => x.indexOf('/') > 0 && x.indexOf('*') < 0);
const havolaYoq = [...new Set(havolalar)]
  .filter((y) => !fs.existsSync(path.join(ILDIZ, y)));
tek('ichki havolalar haqiqiy fayllarga', havolaYoq.length === 0,
    'yo\'q: ' + havolaYoq.join(', '));

/* ⚠️ NAZORAT RAQAMLARI — har o'zgarishdan keyin solishtiriladigan
   yagona mezon. Ular yo'qolsa, «buzildimi yo'qmi» degan savolga
   javob beradigan hech narsa qolmaydi. */
tek('nazorat raqamlari yozilgan',
    MD.includes('744 054 071.73') && MD.includes('43 596 859 620.62'),
    'Fast food va Amfiteatr jamilari MULOQOT.md da bo\'lishi shart');

tek('jurnal bo\'limi bor', /XABARLAR JURNALI/i.test(MD));
tek('jurnalda kamida bitta yozuv bor', /^### \[\d{4}-\d{2}-\d{2}\]/m.test(MD));

/* Har ikkala agent ham hujjatda tilga olingan bo'lsin — biri
   unutilsa, u o'zini hudud egasi deb hisoblamaydi. */
for (const agent of Object.keys(N.agentlar)) {
  tek('MULOQOT.md da «' + agent + '» tilga olingan',
      MD.toLowerCase().includes(agent.toLowerCase()));
}

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
