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
const MOSLASH = fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', '35_F2Moslash.js'), 'utf8');

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
tek('Tizim_01 ning apiF2FaylOqi si chaqiriladi', /apiF2FaylOqi\(faylId, varaq,/.test(F2));
tek('apiF2FaylOqi haqiqatan mavjud', /function apiF2FaylOqi\(/.test(PANEL));
tek('varaqlar ro\'yxati ham qayta ishlatiladi', /apiF2VaraklarOl\(faylId\)/.test(F2));

/* Faylni OCHISH/O'QISH mantig'i takrorlanmasligi shart — MIME
   xavfsizligi, #REF! himoyasi, konvert hammasi 30_Panel.js da qoladi.
   (Ustun aniqlash uchun zaxira BOR va u ataylab — pastda.) */
tek('faylni o\'qish mantig\'i TAKRORLANMAGAN',
    !/getDataRange|SpreadsheetApp\.openById|Drive\.Files/.test(F2));

console.log('\n── Ierarxik moslashtirish ──');

tek('ota blok belgilari uzatiladi', /ota_kod:/.test(F2) && /ota_nom:/.test(F2));
tek('blok bolalariga O\'Z kodini beradi',
    /var yangiKod = \(tugun\.type === 'bl'\)/.test(F2));
/* ⚠️ MOSLASHTIRISH TIZIM_01 NING DVIGATELI BILAN.
   Men bir marta o'zimning sodda SQL moslashtirishimni yozgandim
   (nom + birlik + ota blok). U 35_F2Moslash.js dagi HAR BIR qoidani
   tashlab yuborardi — birlik qalqoni (Т↔КГ 1000x), kod-kanon
   (2.57 mlrd ko'rilmagan ish), yetim qutqarish, razdel doirasi.
   Foydalanuvchi buni darrov ko'rdi. Qayta yozish TAQIQLANADI. */
tek('dvigatel chaqiriladi (apiF2AvtoMoslash)',
    /apiF2AvtoMoslash\(aktTree, null, \{lrvTree: lrvTree\}\)/.test(F2));
tek('dvigatel haqiqatan mavjud', /function apiF2AvtoMoslash\(/.test(MOSLASH));
tek('o\'z moslashtirishi YO\'Q', !/t2_f2_moslash|t2_f2_import/.test(
      F2.replace(/\/\*[\s\S]*?\*\//g, '')),
    'ikkita moslashtirish = ekranda bir natija, hujjatda boshqasi');
tek('hujjat yagona eshikdan yaraladi', /'t2_akt_yarat'/.test(F2));

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
/* ⚠️ Ikkalasi AYNI o'qish yordamchisidan foydalanishi shart — aks
   holda ekranda bir narsa ko'rinib, hujjatga boshqasi tushardi. */
tek('ko\'rish va import bir xil o\'qish yo\'lidan',
    (F2.match(/var oq = _t2F2Oqi\(/g) || []).length === 2);

console.log('\n── mode:\'config\' XATO deb o\'qilmasin ──');

/* ⚠️ `apiF2FaylOqi` colConfig berilmasa DOIM mode:'config' qaytaradi —
   ustunlarni TOPGAN bo'lsa ham. Bu «aniqlanmadi» degani EMAS.
   Men bir marta shu xatoni qildim: LRV_PLUS faylida ustunlar aslida
   topilgan edi, lekin ekranda «ustunlar aniqlanmadi» chiqdi. */
tek('aniqlangan ustunlar AVTOMATIK qabul qilinadi',
    /var ikkinchi = apiF2FaylOqi\(faylId, varaq, c\)/.test(F2),
    'birinchi chaqiruv taklif beradi, ikkinchisi daraxtni qaytaradi');
tek('faqat nom/bir topilmasa sozlash so\'raladi',
    /if\(!\(Number\(c\.nom\) >= 0\) \|\| !\(Number\(c\.bir\) >= 0\)\)/.test(F2));
tek('ustunlar javobda qaytariladi (odam tuzatishi uchun)',
    /cols: oq\.cols/.test(F2));
/* ⚠️ Chap panel AYNAN shu daraxtdan chiziladi. Bir marta uni
   javobdan tushirib qoldirganman — ekran bo'm-bo'sh chiqardi va
   hech qanday xato ko'rinmasdi. */
tek('daraxt javobda qaytariladi', /tree: oq.tree/.test(F2),
    "busiz chap panel bo'sh qoladi");

console.log('\n── Kuchli zaxira aniqlagich ──');

tek('_t2F2UstunKuchli mavjud', /function _t2F2UstunKuchli\(/.test(F2));
tek('faqat sarlavha TOPILMAGANDA ishlaydi', /if\(!birinchi\.hdrQator\)/.test(F2),
    'Tizim_01 nikini almashtirmaydi, to\'ldiradi');
/* Produksiya funksiyasi o'z joyida va imzosi o'zgarmagan */
tek('30_Panel.js dagi _f2UstunAniqla joyida',
    /function _f2UstunAniqla\(data\)\{/.test(PANEL),
    'zaxira aniqlagich uni ALMASHTIRMAYDI, faqat to\'ldiradi');

const km = F2.match(/function _t2F2UstunKuchli[\s\S]*?\n\}\n/);
tek('kuchli aniqlagich topildi', !!km);
if (km) {
  // eslint-disable-next-line no-eval
  eval(km[0]);
  const pv = (rows) => rows.map((cells, i) => ({ r: i + 1, cells }));

  /* Uchta HAQIQIY sarlavha — fayllardan olingan */
  const holatlar = [
    ['Amfiteatr svodka (ЕД.\\nИЗМ. — qator uzilishi)', pv([
      [' НАВОИЙ', '', '', '', '', ''],
      ['N\nп/п', 'НАИМЕНОВАНИЕ', 'ЕД.\nИЗМ.', 'КОЛ-ВО', 'ЦЕНА\n ЗА ЕД.', 'СУММА \n(сум)'],
      ['1', '2', '3', '4', '5', '6'],
    ]), { nom: 1, bir: 2, obyom: 3, narx: 4, sum: 5 }],

    ['Fast food LRV (norma/obyom ajralgan)', pv([
      ['FAST FOOD', '', '', '', '', ''],
      ['N п.п.', 'Шифр номера норм', 'Наименование работ и затрат',
       'Единица измерения', 'Количество', ''],
      ['', '', '', '', 'на. ед. измерения', 'по проектным данным'],
    ]), { kod: 1, nom: 2, bir: 3, norma: 4, obyom: 5 }],

    ['Fast food svodka (narx guruhi ostida «на.ед.»)', pv([
      ['FAST FOOD', '', '', '', '', '', '', ''],
      ['N п.п.', 'Шифр номера норм', 'Наименование работ и затрат',
       'Единица измерения', 'Количество', 'Сметная стоимость', '', ''],
      ['', '', '', '', '', 'в базисном уровне', '', ''],
      ['', '', '', '', '', 'на.ед.изм.', 'общая', ''],
    ]), { kod: 1, nom: 2, bir: 3, obyom: 4, narx: 5, sum: 6 }],
  ];

  for (const [nom, preview, kut] of holatlar) {
    const d = _t2F2UstunKuchli(preview);
    const mos = d && Object.keys(kut).every((k) => d[k] === kut[k]);
    tek(nom, !!mos, d ? JSON.stringify(d) : 'topilmadi');
  }

  /* ⚠️ «на ед.» ikkala guruhda ham uchraydi — chalkashmasligi shart */
  const svod = _t2F2UstunKuchli(pv([
    ['N', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ', 'Количество', 'Сметная стоимость', ''],
    ['', '', '', '', 'на.ед.изм.', 'общая'],
  ]));
  tek('narx guruhidagi «на.ед.» NORMA deb o\'qilmadi',
      svod && svod.norma === -1 && svod.narx === 4,
      JSON.stringify(svod));
}

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


console.log('\n── HAQIQIY DVIGATEL BILAN (Node ichida ishlaydi) ──');

/* ⚠️ Bu bo'lim REGEX emas — 35_F2Moslash.js ning O'ZI Node ichida
   ishga tushiriladi va ko'prik unga haqiqiy daraxt beradi.
   Sabab: «t2_f2_moslash chaqirilyaptimi» degan regex testi men SQL
   moslashtirishni yozganimda ham YASHIL edi. Xatti-harakat
   tekshirilmasa, test hech nimadan himoya qilmaydi. */
const vm = require('vm');
const qum = {
  Date, Math, String, Number, JSON, Object, Array, RegExp,
  isNaN, isFinite, parseFloat, parseInt, console,
  /* Bazaga chiqadigan yagona bog'lanish — stub */
  _t2QatorlarOl: null,
};
vm.createContext(qum);
/* Dvigatel 10_Engine.js dagi lotin→kirill jadvaliga tayanadi
   (Е1-1-1 ni E1-1-1 deb yozilgan faylda ham tanish uchun). */
qum._LAT2CYR = eval('(' +
  fs.readFileSync(path.join(ILDIZ, 'Smeta tizimi', '10_Engine.js'), 'utf8')
    .match(/var _LAT2CYR=({[^}]*})/)[1] + ')');
vm.runInContext(MOSLASH, qum);   // dvigatel
vm.runInContext(F2, qum);        // ko'prik

/* ── Smeta (t2_daraxt qatorlari) ──
   ⚠️ ATAYLAB: «ЗАТРАТЫ ТРУДА / ЧЕЛ.-Ч» va «БЕТОН М200 / М3» IKKI
   razdelda ham bor. Fast food obyektida 1262 qatorga atigi 404 unikal
   (nom, birlik) to'g'ri kelgan — aynan shu holat. Faqat nomga qarab
   moslashtirsak, pul boshqa razdelga yoziladi. */
const SMETA = [
  {id:1,  ota_id:null, tur:'rz',  nom:'ЗЕМЛЯНЫЕ РАБОТЫ',        kod:'',        birlik:'',       narx:null},
  {id:2,  ota_id:1,    tur:'bl',  nom:'РАЗРАБОТКА ГРУНТА',      kod:'Е1-1-1',  birlik:'1000М3', narx:null},
  {id:3,  ota_id:2,    tur:'rs',  nom:'ЗАТРАТЫ ТРУДА',          kod:'',        birlik:'ЧЕЛ.-Ч', narx:null},
  {id:4,  ota_id:2,    tur:'mat', nom:'БЕТОН М200',             kod:'',        birlik:'М3',     narx:500000},
  {id:5,  ota_id:null, tur:'rz',  nom:'ФУНДАМЕНТЫ',             kod:'',        birlik:'',       narx:null},
  {id:6,  ota_id:5,    tur:'bl',  nom:'УСТРОЙСТВО ФУНДАМЕНТА',  kod:'Е6-1-1',  birlik:'100М3',  narx:null},
  {id:7,  ota_id:6,    tur:'rs',  nom:'ЗАТРАТЫ ТРУДА',          kod:'',        birlik:'ЧЕЛ.-Ч', narx:null},
  {id:8,  ota_id:6,    tur:'mat', nom:'БЕТОН М200',             kod:'',        birlik:'М3',     narx:500000},
  {id:9,  ota_id:6,    tur:'mat', nom:'АРМАТУРА',               kod:'',        birlik:'Т',      narx:9000000},
];

/* ── F2 hujjati (apiF2FaylOqi qaytaradigan shakl) ── */
const AKT = [
  {type:'rz', nom:'ЗЕМЛЯНЫЕ РАБОТЫ', children:[
    {type:'bl', uid:'u_bl1', kod:'Е1-1-1', nom:'РАЗРАБОТКА ГРУНТА', bir:'1000М3', hajm:0.16, children:[
      {type:'rs',  uid:'a1', nom:'ЗАТРАТЫ ТРУДА', bir:'ЧЕЛ.-Ч', hajm:4.69, narx:0,      children:[]},
      {type:'mat', uid:'a2', nom:'БЕТОН М200',    bir:'М3',     hajm:12,   narx:500000, children:[]},
    ]},
  ]},
  {type:'rz', nom:'ФУНДАМЕНТЫ', children:[
    {type:'bl', uid:'u_bl2', kod:'Е6-1-1', nom:'УСТРОЙСТВО ФУНДАМЕНТА', bir:'100М3', hajm:0.05, children:[
      {type:'rs',  uid:'b1', nom:'ЗАТРАТЫ ТРУДА', bir:'ЧЕЛ.-Ч', hajm:9.31, narx:0,      children:[]},
      /* ПЕРЕРАСЧЁТ — manfiy, haqiqiy hujjat */
      {type:'mat', uid:'b2', nom:'БЕТОН М200',    bir:'М3',     hajm:-4,   narx:500000, children:[]},
      /* ⚠️ Т ↔ КГ = 1000 baravar xato. Dvigatel BLOKLASHI shart */
      {type:'mat', uid:'b3', nom:'АРМАТУРА',      bir:'КГ',     hajm:2500, narx:9000,   children:[]},
    ]},
  ]},
];

qum._t2QatorlarOl = () => SMETA;
const mos = qum._t2F2Moslashtir(1, AKT);
const top = (uid) => mos.qatorlar.find((x) => x.uid === uid);

tek('moslashtirish ishladi', mos.ok === true, JSON.stringify(mos.xabar || ''));
tek('smeta daraxti qurildi (2 razdel, 7 tugun)',
    mos.lrv.razdel === 2 && mos.lrv.tugun === 7, JSON.stringify(mos.lrv));

/* ⚠️ ENG MUHIM TEKSHIRUV */
tek('BIR XIL nom O\'Z razdelidagi qatorga bog\'landi',
    top('a1') && top('b1') && top('a1').qator_id === 3 && top('b1').qator_id === 7,
    'a1→' + (top('a1') || {}).qator_id + ', b1→' + (top('b1') || {}).qator_id + ' (kutilgan 3 va 7)');
tek('material ham o\'z razdeliga',
    top('a2') && top('b2') && top('a2').qator_id === 4 && top('b2').qator_id === 8,
    'a2→' + (top('a2') || {}).qator_id + ', b2→' + (top('b2') || {}).qator_id);

tek('ПЕРЕРАСЧЁТ manfiy hajm saqlandi', top('b2') && top('b2').hajm === -4);

/* ⚠️ Т↔КГ: dvigatel bu qatorni O'TKAZMASLIGI shart */
tek('birlik farqli qator BLOKLANDI (Т↔КГ)',
    top('b3') && top('b3').holat === 'topilmadi',
    'kutilgan: topilmadi, olingan: ' + ((top('b3') || {}).holat));
tek('bloklash SABABI aytildi (jim o\'tmadi)',
    top('b3') && String((top('b3') || {}).sabab || '').length > 0,
    JSON.stringify((top('b3') || {}).sabab));

/* ⚠️ REESTR: qancha kirdi = qancha joylashdi */
tek('reestr kafolati: kirgan = moslandi + topilmadi',
    mos.kafolat === true && mos.kirgan === 5 && mos.moslandi === 4 && mos.topilmadi === 1,
    'kirgan=' + mos.kirgan + ' moslandi=' + mos.moslandi + ' topilmadi=' + mos.topilmadi);

/* Ish (bl) qatori hujjatga TUSHMAYDI — aks holda ikki marta sanaladi
   (bl summasi bolalarining yig'indisi). */
tek('ish qatori (bl) hujjatga kirmadi',
    !mos.qatorlar.some((x) => x.uid === 'u_bl1' || x.uid === 'u_bl2'));

/* Narxi yo'q qator: hujjatda BO'SH qoladi, smetadan to'ldirilmaydi */
tek('narxsiz qatorda narx BO\'SH', top('a1') && top('a1').narx === undefined,
    'smeta narxidan to\'ldirish = soxta hujjat');

console.log('\n── Razdel ILDIZDA bo\'lmasa ham topiladi ──');

/* ⚠️ Dvigatel indekslarni FAQAT eng yuqori darajadagi 'rz' dan quradi
   (35_F2Moslash.js:163, :194). Razdel bir daraja pastda bo'lsa indeks
   bo'sh qolib, hech nima moslashmaydi — XATO CHIQMAYDI, shunchaki 0.
   Shuning uchun razdellar ildizga ko'tariladi. */
qum._t2QatorlarOl = () => [
  {id:100, ota_id:null, tur:'fayl', nom:'SMETA-1', kod:'', birlik:'', narx:null},
].concat(SMETA.map((q) => ({...q, ota_id: q.ota_id === null ? 100 : q.ota_id})));

const chuqur = qum._t2F2Moslashtir(1, AKT);
tek('ichkaridagi razdel ildizga ko\'tarildi',
    chuqur.lrv.razdel === 2, JSON.stringify(chuqur.lrv));
tek('chuqur daraxtda ham AYNI natija',
    chuqur.moslandi === 4 && chuqur.topilmadi === 1,
    'moslandi=' + chuqur.moslandi + ' topilmadi=' + chuqur.topilmadi);

/* Razdelsiz smeta — dvigatel baribir ishlashi kerak (global doira) */
qum._t2QatorlarOl = () => SMETA.filter((q) => q.tur !== 'rz')
  .map((q) => ({...q, ota_id: (q.id === 2 || q.id === 6) ? null : q.ota_id}));
const rzsiz = qum._t2F2Moslashtir(1, AKT);
tek('razdelsiz smetada ham moslashadi (0 emas)',
    rzsiz.moslandi > 0, 'moslandi=' + rzsiz.moslandi);

console.log('\n' + ok + ' o\'tdi, ' + xato + ' yiqildi');
process.exit(xato ? 1 : 0);
