/* KODLASH YAXLITLIGI — build'ni yiqitadigan 2 ta takroriy naqsh
 * ═══════════════════════════════════════════════════════════════════
 *
 * ⚠️ NEGA BU TEST BOR — 2026-08-27 da BIR NECHA MARTA (kamida 10 marta,
 * turli fayllarda) production build butunlay yiqilib turdi, aynan
 * ikkita naqsh tufayli:
 *
 *   1) FAYL UTF-16 DA SAQLANGAN — odatda PowerShell `Out-File`/
 *      `Set-Content` `-Encoding utf8` SIZ ishlatilganda. Natija:
 *      `file` UNIX buyrug'i "Unicode text, UTF-16" deb ko'rsatadi,
 *      lekin loyihadagi BARCHA boshqa fayllar UTF-8. Vite/esbuild
 *      buni "stream did not contain valid UTF-8" deb yiqitadi.
 *      (Aynan shu sabab `tizim02/MULOQOT.md` ni 741 qatordan 16
 *      qatorgacha "yeb qo'ygan" edi — butun tarix yo'qolgan.)
 *
 *   2) TEMPLATE LITERAL (backtick + ${...}) BUZILGAN — kod biror
 *      vosita orqali (PowerShell interpolyatsiya, boshqa kanal)
 *      qayta yozilganda backtick harflari yo'qolib, ularning o'rniga
 *      YAKKA BACKSLASH qolib ketadi. Masalan:
 *        className={`px-4 py-2 ${aktiv ? 'a' : 'b'}`}
 *      quyidagicha buziladi:
 *        className={\px-4 py-2 \\}
 *      Bu — sintaksis xatosi, lekin `tsc -p tsconfig.app.json` buni
 *      HAR DOIM ham ushlamaydi (`npm run build` dagi `tsc -b` boshqa
 *      tsconfig zanjiridan o'tadi va ba'zan FAQAT shu yo'lda ko'rinadi).
 *
 * Bu ikkalasi ham `npm run build` ni to'liq ishga tushirmasdan, TEZ
 * va ANIQ ushlanishi kerak — build bir necha o'nlab soniya oladi,
 * bu test esa millisekundlarda ishlaydi.
 *
 * Yiqilsa nima qilish kerak:
 *   — «UTF-16» desa: faylni UTF-8 sifatida qayta yozing (Write/Node
 *     `fs.writeFileSync(path, matn, 'utf8')`, PowerShell'da ASLO emas
 *     — yoki `-Encoding utf8` bilan).
 *   — «buzilgan template literal» desa: o'sha qatorni oching, asl
 *     backtick+${...} ni tiklang (yo'qolgan shart mantiqini qayta
 *     yozish kerak bo'lishi mumkin — asl qiymat ko'pincha
 *     qaytarib bo'lmaydi, chunki backtick harfi umuman yo'qolgan).
 */
const fs = require('fs');
const path = require('path');

const ILDIZ = path.join(__dirname, '..');
const SKAN_PAPKALAR = ['src', 'functions', 'testlar'];
const KENGAYTMALAR = /\.(tsx?|jsx?|cjs|mjs)$/;

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

function fayllarniTop(dir, out) {
  for (const f of fs.readdirSync(dir)) {
    if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) fayllarniTop(p, out);
    else if (KENGAYTMALAR.test(f)) out.push(p);
  }
  return out;
}

let barchaFayllar = [];
for (const papka of SKAN_PAPKALAR) {
  const to_liq = path.join(ILDIZ, papka);
  if (fs.existsSync(to_liq)) fayllarniTop(to_liq, barchaFayllar);
}

console.log('\n── Kodlash yaxlitligi (' + barchaFayllar.length + ' fayl) ──');

const kodlashBuzilgan = [];
const shablonBuzilgan = [];

for (const f of barchaFayllar) {
  const buf = fs.readFileSync(f);
  const nisbiy = path.relative(ILDIZ, f);

  /* 1) UTF-8 qat'iy tekshiruv */
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    kodlashBuzilgan.push(nisbiy);
    continue; // matn sifatida o'qib bo'lmaydi — pastdagi tekshiruvni o'tkazamiz
  }

  /* 2) Buzilgan template literal izlari — faqat .tsx/.jsx/.ts fayllarda,
     JSX className/style ichida backtick o'rniga yakka backslash qolgan
     eng keng tarqalgan shakl: `={\` yoki `\\}` yoki `\` + harf keyin `\\` */
  if (/\.(tsx?|jsx?)$/.test(f)) {
    const matn = buf.toString('utf8');
    /* `={` dan keyin darhol backslash — bu HECH QACHON to'g'ri JS/JSX
       emas (shablon satr `={` dan keyin ochilmaydi). */
    if (/=\{\\[a-zA-Z(]/.test(matn)) {
      shablonBuzilgan.push(nisbiy);
    }
  }
}

tek('barcha fayllar UTF-8 (UTF-16 saqlanib qolmagan)',
    kodlashBuzilgan.length === 0,
    kodlashBuzilgan.length ? 'UTF-16/buzilgan: ' + kodlashBuzilgan.join(', ') : '');

tek('buzilgan template literal (backtick yo\'qolgan) yo\'q',
    shablonBuzilgan.length === 0,
    shablonBuzilgan.length ? 'shubhali: ' + shablonBuzilgan.join(', ') : '');

console.log(`\n${ok} o'tdi, ${xato} yiqildi (${barchaFayllar.length} fayl tekshirildi)`);
process.exit(xato ? 1 : 0);
