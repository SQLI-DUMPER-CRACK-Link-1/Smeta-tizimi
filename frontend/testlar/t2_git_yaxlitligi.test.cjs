/* GIT YAXLITLIGI — takrorlangan incidentlar uchun qo'riqchi.
 *
 * 1) Drive sinxronizatsiyasi `fayl (1).tsx` nusxasini Gitga olib
 *    kirsa, u ko'pincha haqiqiy ishni chetda qoldiradi yoki reestrni buzadi.
 * 2) O'zbekcha apostrof (`'`) JavaScript identifikatorida yaroqsiz;
 *    bitta shunday deklaratsiya butun buildni yiqitadi.
 *
 * Ishchi katalog emas, Git indeksi tekshiriladi: qo'riqchi aynan
 * commitga kirayotgan faylni himoya qilishi kerak.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ILDIZ = path.resolve(__dirname, '..', '..');
let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

function gitFayllari() {
  return execFileSync('git', ['-C', ILDIZ, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean);
}

const fayllar = gitFayllari();

console.log('\n── Git dublikat qo\'riqchisi ──');
const dublikatlar = fayllar.filter((f) => f.includes(' (1)'));
tek('`(1)` qo\'shimchali fayl Git indeksida yo\'q', dublikatlar.length === 0,
  dublikatlar.length ? 'o\'chirish yoki mazmunini kanonik faylga ko\'chirish kerak: ' + dublikatlar.join(', ') : '');

console.log('\n── Apostrofli identifikator qo\'riqchisi ──');
const kodFayllari = fayllar.filter((f) => /\.(?:[cm]?js|[cm]?ts|jsx|tsx)$/i.test(f));
const apostrofli = [];
/* Deklaratsiya boshida tekshirish matn/comment ichidagi tasodifiy so'zlarni
   emas, haqiqiy function/const/let/var shaklini nishonga oladi. */
const APOSTROFLI_DEKLARATSIYA = /(?:^|[;\n])\s*(?:(?:export|declare|default)\s+)*(?:async\s+)?(?:function\s*\*?\s+|(?:const|let|var)\s+)([A-Za-z_$][A-Za-z0-9_$]*')/gm;

for (const nisbiy of kodFayllari) {
  const mutlaq = path.join(ILDIZ, nisbiy);
  const matn = fs.readFileSync(mutlaq, 'utf8');
  for (const mos of matn.matchAll(APOSTROFLI_DEKLARATSIYA)) {
    apostrofli.push(nisbiy + ': ' + mos[1]);
  }
}

tek('function/const/let/var identifikatorida apostrof yo\'q', apostrofli.length === 0,
  apostrofli.length ? 'JS sintaksisi buziladi: ' + apostrofli.join(', ') : '');

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi (' + kodFayllari.length + ' Git-fayl tekshirildi)');
process.exit(xato ? 1 : 0);
