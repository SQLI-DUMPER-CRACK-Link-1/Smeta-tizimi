/* TIZIM_02 — SMETA SARLAVHASINI TANISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * NEGA BU TEST BOR:
 *
 * «Fast food 1этаж» obyektida narx qamrovi 8.4% chiqdi (1159 qator
 * narxsiz). Ildiz sabab — sarlavha qatori TOPILMAGAN edi:
 * aniqlagich faqat «ед.изм» ni bilardi, faylda esa «Единица измерения»
 * deb to'liq yozilgan. Natijada:
 *     data_qator = 1  →  sarlavha qatorlari ma'lumot bo'lib o'qildi
 *     format     = TN →  (bu qismi to'g'ri edi)
 *
 * Sarlavha topilgach qamrov 100% bo'ldi.
 *
 * Bu xatoni `tsc` ham, tiplar ham ushlamaydi — u faqat HAQIQIY fayl
 * tuzilishida ko'rinadi. Shuning uchun ikkala haqiqiy fayl (LRV va RES)
 * shu yerda qulflab qo'yiladi.
 */
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', '..', 'Smeta tizimi', 'T2_Import.js'), 'utf8');

const kod = SRC.match(/function _t2FormatAniqla[\s\S]*?\n\}/);
if (!kod) { console.error('  ❌ _t2FormatAniqla topilmadi'); process.exit(1); }
// eslint-disable-next-line no-eval
eval(kod[0]);

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

/** Siyrak xaritadan to'liq varaq yasaydi (bo'sh qatorlar tiklanadi). */
const qur = (xarita, oxirgi, kengligi) => {
  const out = [];
  for (let r = 1; r <= oxirgi; r++) out.push(xarita[r] || Array(kengligi).fill(''));
  return out;
};

/* ── Haqiqiy fayllar: Fast food 1этаж (bazadan olingan) ── */

const SVODKA = qur({
  3:  ['FAST FOOD', '', '', '', '', '', '', ''],
  7:  ['АР И КЖ', '', '', '', '', '', '', ''],
  8:  ['N п.п.', 'Шифр номера норм', 'Наименование работ и затрат',
       'Единица измерения', 'Количество', 'Сметная стоимость', '', ''],
  9:  ['', '', '', '', '', 'в базисном уровне', '', ''],
  10: ['', '', '', '', '', 'на.ед.изм.', 'общая', ''],
  11: ['1', '2', '3', '4', '5', '6', '7', ''],
  12: ['', '', 'ТРУДОВЫЕ РЕСУРСЫ', '', '', '', '', ''],
  13: ['1', '1', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ.-Ч',
       '3907.4018', '29421', '114959668.3578', ''],
}, 14, 8);

const LOKALKA = qur({
  3:  ['FAST FOOD', '', '', '', '', ''],
  5:  ['АР И КЖ', '', '', '', '', ''],
  6:  ['N п.п.', 'Шифр номера норм', 'Наименование работ и затрат',
       'Единица измерения', 'Количество', ''],
  7:  ['', '', '', '', 'на. ед. измерения', 'по проектным данным'],
  8:  ['1', '2', '3', '4', '5', '6'],
  9:  ['', '', 'FAST FOOD', '', '', ''],
  12: ['1', 'Е0101-009-08 ДОП', 'РАЗРАБОТКА ГРУНТА В ОТВАЛ', '1000М3', '0.1679', ''],
}, 13, 6);

/* Tizim_01 uslubi — «Ед.изм.» qisqartmasi. Avval ham ishlagan,
   buzilmasligi SHART. */
const ESKI = qur({
  4: ['№', 'Обоснование', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена'],
  5: ['1', '2', '3', '4', '5', '6'],
  6: ['', '', 'ЗЕМЛЯНЫЕ РАБОТЫ', '', '', ''],
}, 8, 6);

/* Sarlavhasiz varaq — hech narsa taxmin qilinmasin */
const SARLAVHASIZ = qur({
  1: ['', '', 'ЗЕМЛЯНЫЕ РАБОТЫ', '', '', ''],
  2: ['1', 'Е01', 'РАЗРАБОТКА ГРУНТА', 'М3', '5', ''],
}, 4, 6);

console.log('\n── Sarlavha va ma\'lumot boshlanishi ──');

const sina = (nom, q, kutFormat, kutQator) => {
  const r = _t2FormatAniqla(q);
  tek(nom + '  →  ' + r.format + ' / qator ' + r.dataQator,
      r.format === kutFormat && r.dataQator === kutQator,
      'kutilgan: ' + kutFormat + ' / ' + kutQator);
};

sina('SVODKA «Единица измерения»', SVODKA, 'TN', 12);
sina('LOKALKA «Единица измерения»', LOKALKA, 'TN', 9);
sina('Tizim_01 «Ед.изм.»', ESKI, 'ABC4', 6);
sina('Sarlavhasiz varaq', SARLAVHASIZ, 'TN', 1);

console.log('\n── Ustun-raqamlash qatorini tanish ──');

/* ⚠️ Ilgari qoida «3 ta son bor» edi. Bu XATO: hajm/narx/summa ham
   son bo'ladi va haqiqiy ma'lumot qatori sarlavha deb o'tkazib
   yuborilishi mumkin edi. Endi KETMA-KET butun son talab qilinadi. */
const RAQAMLI_DATA = qur({
  4: ['№', 'Обоснование', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена'],
  5: ['1', '2', '3', '4', '5', '6'],
  // Haqiqiy ma'lumot: uchta son bor, lekin ketma-ket EMAS
  6: ['7', '12', 'ЩЕБЕНЬ', 'М3', '20', '35'],
}, 8, 6);
sina('Sonli ma\'lumot qatori sarlavha DEB O\'QILMAYDI', RAQAMLI_DATA, 'ABC4', 6);

/* Format sharti ATAYLAB tor: kengaytirilsa fayl jim ABC4 ga o'tib
   ketadi va t2_tasnif boshqa (qo'pol) shoxga tushadi. */
tek('format sharti tor qolgan (izoh bilan qulflangan)',
    /SHART ATAYLAB TOR QOLDIRILDI/.test(SRC));
tek('dataQator formatdan MUSTAQIL topiladi',
    /ALOHIDA VA KENGROQ QIDIRUV/.test(SRC));

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
