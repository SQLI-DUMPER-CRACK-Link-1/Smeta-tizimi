/* TIZIM_02 — F2/AKT FAYLINI IMPORT QILISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tashqi F2 fayli smeta qatorlariga bog'lanadi. Eng katta xavf:
 * hajmni NOTO'G'RI qatorga yozib qo'yish.
 *
 * Fast food obyektida 1 262 resurs qatori bor, lekin unikal
 * (nom, birlik) juftligi atigi 404 ta — bir resurs o'rtacha 3 marta
 * uchraydi, turli bloklar ostida. Shuning uchun moslashtirish
 * IERARXIK bo'lishi shart: avval ota blok, keyin resurs o'sha blok
 * ichida.
 *
 * Jonli sinovda ota ma'lumotisiz bitta nom 106 ta nomzod bergan.
 * Tavakkaliga birinchisini tanlash — pulni boshqa blokka yozish demak.
 */
const fs = require('fs');
const path = require('path');

const ILDIZ = path.join(__dirname, '..', '..');
const F2 = fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', 'T2_F2Import.js'), 'utf8');
const PANEL = fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', '30_Panel.js'), 'utf8');

let ok = 0, xato = 0;
const tek = (nom, shart, izoh) => {
  if (shart) { ok++; console.log('  ✅ ' + nom); }
  else { xato++; console.log('  ❌ ' + nom + (izoh ? '\n       ' + izoh : '')); }
};

console.log('\n── Borini qayta yozmaslik ──');

/* Faylni o'qish Tizim_01 da uzoq sozlangan: MIME xavfsizligi (Sheets
   bo'lmagan faylni openById ga berish V8 ni qulatadi), .xlsx ni faqat
   qiymat bilan ochish (#REF! himoyasi), 3 shablon uchun ustun
   avtoaniqlash, F-yoki-E hajm qoidasi. Uni takrorlash xato bo'lardi. */
tek('Tizim_01 ning apiF2FaylOqi si chaqiriladi', /apiF2FaylOqi\(faylId, varaq, colConfig\)/.test(F2));
tek('apiF2FaylOqi haqiqatan mavjud', /function apiF2FaylOqi\(/.test(PANEL));
tek('varaqlar ro\'yxati ham qayta ishlatiladi', /apiF2VaraklarOl\(faylId\)/.test(F2));
tek('ustun aniqlash TAKRORLANMAGAN', !/НАИМЕНОВАНИЕ/.test(F2),
    '_f2UstunAniqla 30_Panel.js da qoladi');

console.log('\n── Ierarxik moslashtirish ──');

tek('ota blok belgilari uzatiladi', /ota_kod:/.test(F2) && /ota_nom:/.test(F2));
tek('blok bolalariga O\'Z kodini beradi',
    /var yangiKod = \(tugun\.type === 'bl'\)/.test(F2));
tek('moslashtirish BAZADA (t2_f2_moslash)', /'t2_f2_moslash'/.test(F2));
tek('import BAZADA (t2_f2_import)', /'t2_f2_import'/.test(F2));

console.log('\n── Qat\'iy qoidalar ──');

/* ⚠️ ПЕРЕРАСЧЁТ manfiy hajm bilan keladi va u haqiqiy hujjat */
tek('MANFIY hajm tashlanmaydi', /h !== 0/.test(F2) && !/h > 0/.test(F2),
    '`> 0` sharti manfiy korrektirovkani yo\'qotardi');
tek('hajmsiz qator yuborilmaydi', /isFinite\(h\) && h !== 0/.test(F2));

/* ⚠️ Narx o'zidan to'qilmaydi */
tek('narx 0 bo\'lsa YUBORILMAYDI', /Number\(tugun\.narx\) > 0.*undefined/s.test(F2),
    'baza smetadagi narxni ishlatadi; hech qayerda bo\'lmasa summa BO\'SH qoladi');

/* ⚠️ Idempotentlik */
tek('operationId MAJBURIY', /operationId majburiy/.test(F2));
tek('operationId chaqiruvchidan olinadi, bu yerda YASALMAYDI',
    !/randomUUID|Utilities\.getUuid/.test(F2),
    'yasab bersak qayta urinish yangi UUID bilan ketib ikkinchi hujjat yaratardi');

console.log('\n── Ko\'rish va import ajratilgan ──');

/* Odam import qilishdan OLDIN nima bo'lishini ko'rishi kerak */
tek('apiT2F2Korish — faqat o\'qiydi', /function apiT2F2Korish\(/.test(F2));
tek('apiT2F2Import — yozadi', /function apiT2F2Import\(/.test(F2));
tek('ustun sozlash rejimi qaytariladi', /oqish\.mode === 'config'/.test(F2));
tek('importda ustun tasdiqlanmagan bo\'lsa TO\'XTAYDI',
    /avval «Ko\\'rish» bilan/.test(F2));

console.log('\n── Yassilash mantig\'i (haqiqiy daraxtda) ──');

const m = F2.match(/function _t2F2Tekisla[\s\S]*?\n\}/);
tek('_t2F2Tekisla topildi', !!m);
if (m) {
  // eslint-disable-next-line no-eval
  eval(m[0]);
  const daraxt = [{ type: 'rz', nom: 'ЗЕМЛЯНЫЕ', children: [
    { type: 'bl', kod: 'E01', nom: 'BLOK BIR', hajm: 0.16, children: [
      { type: 'rs', nom: 'ЗАТРАТЫ ТРУДА', bir: 'ЧЕЛ.-Ч', hajm: 4.69, narx: 0 },
      { type: 'rs', nom: 'ЭКСКАВАТОРЫ',   bir: 'МАШ.-Ч', hajm: 4.69, narx: 125342 },
      { type: 'rs', nom: 'HAJMSIZ',       bir: 'ШТ',     hajm: 0,    narx: 5 },
    ] },
    { type: 'bl', kod: 'E02', nom: 'BLOK IKKI', hajm: 0.05, children: [
      { type: 'rs', nom: 'ЗАТРАТЫ ТРУДА', bir: 'ЧЕЛ.-Ч', hajm: 9.31, narx: 0 },
    ] },
    { type: 'rs', nom: 'KORREKTIROVKA', bir: 'М3', hajm: -4, narx: 1850 },
  ] }];
  const r = _t2F2Tekisla(daraxt);

  tek('hajmsiz qator tashlandi', r.length === 4, 'topildi: ' + r.length);
  tek('manfiy hajm saqlandi', r.some((x) => x.hajm === -4));
  tek('1-blok bolalari o\'z otasini oldi',
      r[0].ota_kod === 'E01' && r[1].ota_kod === 'E01');
  tek('2-blok bolasi BOSHQA otani oldi', r[2].ota_kod === 'E02');
  /* ⚠️ ASOSIY MAQSAD: bir xil nom turli blokka bog'lanishi kerak */
  tek('BIR XIL nom turli blokka bog\'landi',
      r[0].nom === r[2].nom && r[0].ota_kod !== r[2].ota_kod);
  tek('blok ostida bo\'lmagan qator otasiz', r[3].ota_kod === undefined);
  tek('narx 0 yuborilmadi', r[0].narx === undefined);
  tek('narx bor bo\'lsa yuborildi', r[1].narx === 125342);
}

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
