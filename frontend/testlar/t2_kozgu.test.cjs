/* TIZIM_02 KO'ZGU — LRV_PLUS SHAKLI
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi (haqiqiy LRV_PLUS bilan taqqoslab):
 *   «norma ustuni yangi jadvalda umuman yo'q»
 *   «qatorlarni raqamlash 1 1.1 1.2 … kabi davom etishi kerak edi»
 *   «resurslarni turiga qarab alohida ustunlarga ham ajratishi kerak,
 *    chunki shundan nakrutka hisoblanadi»
 *   «lrv plus fayllarni o'qib chiq va hozirgi oyna jadvalimiz ham
 *    shunaqa bo'lishini … taminlashing kerak»
 *
 * Bu tekshiruvlar ko'zgu jadvalining shaklini QULFLAYDI. Ular sof
 * mantiq — GAS ishga tushirmasdan ham buzilishni ushlaydi.
 */
const fs = require('fs');
const path = require('path');

const ILDIZ = path.join(__dirname, '..', '..');
const KOZGU = fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', 'T2_Kozgu.js'), 'utf8');
const CFG = fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', '00_Config.js'), 'utf8');

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

console.log('\n── Ustunlar LRV_PLUS bilan mos ──');

const um = KOZGU.match(/var USTUNLAR = \[([\s\S]*?)\];/);
tek('USTUNLAR ro\'yxati topildi', !!um);

let ustunlar = [];
if (um) {
  ustunlar = um[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const KUTILGAN = ['№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.',
                    'ХАЖМ (ед)', 'ХАЖМ (жами)', 'НАРХ (1 ед)', 'СУММА', 'ТИП',
                    'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ'];
  /* 13 ta KO'RINADIGAN ustun + 2 ta yashirin xizmat ustuni (_id, _v).
     Xizmat ustunlari oxirida — o'rtaga qo'yilsa LRV_PLUS tartibi buzilardi. */
  tek('15 ta ustun (13 ko\'rinadigan + 2 yashirin)',
      ustunlar.length === 15, 'topildi: ' + ustunlar.length);
  tek('birinchi 13 tasi LRV_PLUS tartibida',
      JSON.stringify(ustunlar.slice(0, 13)) === JSON.stringify(KUTILGAN),
      JSON.stringify(ustunlar.slice(0, 13)));
  tek('xizmat ustunlari OXIRIDA',
      ustunlar[13] === '_id' && ustunlar[14] === '_v');
  tek('NORMA ustuni bor (avval yo\'q edi)', ustunlar.includes('ХАЖМ (ед)'));
  tek('ТИП ustuni bor — rz/bl/rs/mat/ob', ustunlar.includes('ТИП'));
  tek('kategoriya ustunlari bor', ['ЧЕЛ','МАШ','МАТ','ОБ'].every((k) => ustunlar.includes(k)));
}

/* LRV_PLUS ning o'z xaritasi 00_Config.js da. Ko'zgu undan chetlashmasin. */
const cm = CFG.match(/CHEL:(\d+), *MASH:(\d+), *MAT:(\d+), *OB:(\d+)/);
tek('00_Config.js dagi CHEL/МАШ/МАТ/ОБ tartibi o\'qildi', !!cm);
if (cm && ustunlar.length >= 13) {
  const [, chel, mash, mat, obq] = cm.map(Number);
  /* LRV_PLUS: J=10 ЧЕЛ, K=11 МАШ, L=12 МАТ, M=13 ОБ */
  const kozguTartib = ['ЧЕЛ','МАШ','МАТ','ОБ'].map((k) => ustunlar.indexOf(k) + 1);
  tek('kategoriya tartibi LRV_PLUS bilan bir xil (ЧЕЛ→МАШ→МАТ→ОБ)',
      JSON.stringify(kozguTartib) === JSON.stringify([chel, mash, mat, obq]),
      'ko\'zgu: ' + kozguTartib.join(',') + '  LRV_PLUS: ' + [chel, mash, mat, obq].join(','));
}

console.log('\n── № va NORMA manbai ──');

tek('№ smetaning ASL raqamidan (r.raqam)', /qator\[0\] = r\.raqam \|\| ''/.test(KOZGU),
    'oddiy qator sanog\'i (xom_qator) odam izlaydigan belgi emas');
tek('NORMA `r.norma` dan olinadi', /C_NORMA - 1\] = \(r\.norma/.test(KOZGU));
tek('ХАЖМ (жами) `r.hajm` dan olinadi', /C_HAJM - 1\]\s*= \(r\.hajm/.test(KOZGU));
tek('t2_daraxt dan norma/raqam so\'raladi (view yangilangan)',
    /t2_daraxt/.test(KOZGU));

console.log('\n── Kategoriya ustunlari: IKKI MARTA sanalmasin ──');

tek('kategoriya summasi FAQAT resurs qatorida yoziladi',
    /if\(resursmi && summa !== null\)\{/.test(KOZGU),
    'blok/razdel summasi bolalarining yig\'indisi — qo\'shilsa ikki marta sanaladi');
tek('ЧЕЛ/МАШ/ОБ aniq, qolgani МАТ',
    /r\.kat === 'ЧЕЛ'/.test(KOZGU) && /r\.kat === 'МАШ'/.test(KOZGU) &&
    /r\.kat === 'ОБ'/.test(KOZGU) && /МАТ — qolgani/.test(KOZGU));

/* Taqsimot mantiqini haqiqiy raqamlar bilan sinaymiz (Fast food 1этаж) */
const namuna = [
  { tur: 'rz',  kat: null,  summa: 744054071.73 },   // razdel — sanalmaydi
  { tur: 'bl',  kat: null,  summa: 588205.56 },      // blok  — sanalmaydi
  { tur: 'rs',  kat: 'ЧЕЛ', summa: 137467242.72 },
  { tur: 'rs',  kat: 'МАШ', summa: 16648419.35 },
  { tur: 'mat', kat: 'МАТ', summa: 471236584.66 },
  { tur: 'ob',  kat: 'ОБ',  summa: 118701825.00 },
  { tur: 'rs',  kat: null,  summa: 100 },            // kat yo'q → МАТ
];
const ust = { 'ЧЕЛ': 0, 'МАШ': 0, 'МАТ': 0, 'ОБ': 0 };
for (const r of namuna) {
  const resursmi = (r.tur === 'rs' || r.tur === 'mat' || r.tur === 'ob');
  if (!resursmi || r.summa === null) continue;
  if (r.kat === 'ЧЕЛ') ust['ЧЕЛ'] += r.summa;
  else if (r.kat === 'МАШ') ust['МАШ'] += r.summa;
  else if (r.kat === 'ОБ') ust['ОБ'] += r.summa;
  else ust['МАТ'] += r.summa;
}
const jamiUst = ust['ЧЕЛ'] + ust['МАШ'] + ust['МАТ'] + ust['ОБ'];
const resursJami = namuna
  .filter((r) => ['rs', 'mat', 'ob'].includes(r.tur))
  .reduce((a, r) => a + r.summa, 0);
const hammaJami = namuna.reduce((a, r) => a + r.summa, 0);

tek('kategoriyalar yig\'indisi = RESURSLAR yig\'indisi',
    Math.abs(jamiUst - resursJami) < 0.01,
    jamiUst + ' ≠ ' + resursJami);
/* Razdel va blok summasi bolalarining yig'indisi. Agar ular ham
   kategoriya ustuniga tushsa, yig'indi resurslarnikidan OSHIB ketadi. */
tek('razdel/blok kategoriyaga TUSHMAYDI',
    Math.abs(jamiUst - hammaJami) > 1 && jamiUst < hammaJami,
    'ikki marta sanash bor: ' + jamiUst + ' vs ' + hammaJami);
tek('kategoriyasiz resurs МАТ ga tushadi',
    Math.abs(ust['МАТ'] - (471236584.66 + 100)) < 0.01);

console.log('\n── Ogohlantirish saqlanadi ──');

tek('narx yo\'q bo\'lsa 0 EMAS, «нарх йўқ»', /'нарх йўқ'/.test(KOZGU),
    '0 yozilsa hujjat resursni «bepul» deb ko\'rsatardi');
tek('to\'liq bo\'lmagan JAMI ogohlantirish bilan',
    /ЖАМИ ТЎЛИҚ ЭМАС/.test(KOZGU));
tek('kategoriya jamlanmasi sarlavhada ko\'rsatiladi', /katJami/.test(KOZGU));

console.log('\n── Sheets → baza qaytish yo\'li ──');

/* Foydalanuvchi: «bu sheets oynasida ishlangan ishlar supabase ga ham
   o'ta olishi kerak edi». Ko'zgu endi bir tomonlama emas. */
tek('apiT2KozguQaytar bor', /function apiT2KozguQaytar\(/.test(KOZGU));

/* Qatorni ANIQLASH — qator raqami bilan emas, o'zgarmas id bilan.
   Qator qo'shilsa/o'chsa raqam suriladi va tahrir boshqa resursga tushardi. */
tek('yashirin `_id` va `_v` ustunlari yoziladi',
    /'_id', '_v'/.test(KOZGU) && /qator\[C_ID - 1\]\s*= r\.id/.test(KOZGU));
tek('ular ko\'zdan yashiriladi, lekin o\'chirilmaydi',
    /hideColumns\(C_ID, 2\)/.test(KOZGU));
tek('qaytishda qator `_id` orqali topiladi', /var id = Number\(qiy\[i\]\[13\]\)/.test(KOZGU));

/* Ziddiyat — «oxirgi yozgan yutadi» BO'LMASLIGI kerak */
tek('kutilgan versiya yuboriladi', /p_kutilgan_versiya: kutilganV/.test(KOZGU));
tek('ziddiyat ro\'yxatga yig\'iladi, jim o\'tkazilmaydi',
    /ziddiyat\.push\(\{/.test(KOZGU));
tek('panel ziddiyatni ochiq aytadi',
    /qator YOZILMADI/.test(fs.readFileSync(
      path.join(ILDIZ, 'frontend', 'src', 'test02', 'TestImport.tsx'), 'utf8')));

/* FAQAT odam kiritadigan maydonlar qaytadi */
const mm = KOZGU.match(/var MAYDON = \[([\s\S]*?)\];/);
tek('qaytariladigan maydonlar ro\'yxati bor', !!mm);
if (mm) {
  const maydonlar = (mm[1].match(/nom: '(\w+)'/g) || []).map((s) => s.split("'")[1]);
  tek('faqat nom/birlik/hajm/narx',
      JSON.stringify(maydonlar) === JSON.stringify(['nom', 'birlik', 'hajm', 'narx']),
      JSON.stringify(maydonlar));
  tek('СУММА va kategoriya QAYTARILMAYDI (hisobdan keladi)',
      !maydonlar.includes('summa') && !maydonlar.includes('kat'));
}

/* Narx o'zidan to'qilmasin */
tek('bo\'sh katak 0 deb YOZILMAYDI',
    /if\(xom === '' \|\| xom == null\) continue;/.test(KOZGU),
    '0 «bepul» degan ma\'noni beradi — bu yolg\'on hujjat');
tek('«нарх йўқ» yozuvi son deb o\'qilmaydi',
    /indexOf\('нарх'\) >= 0\) continue/.test(KOZGU));

/* O'zgarish bo'lsa hisob eskiradi */
tek('yozilgach qayta hisoblanadi', /if\(ozgardi\)\{[\s\S]{0,200}apiT2Ishla/.test(KOZGU));

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
