/**
 * RES resurs KATEGORIYASI (ЧЕЛ/МАШ/МАТ/ОБ/М/К/КАБ) uchun yagona, umumiy
 * mantiq. Smeta importi (SmetaYuklaNative) va Tender Oferta bir xil
 * qoidadan foydalanadi -- ikki xil 'haqiqat' bo‘lmasligi uchun shu yerga
 * ko‘chirildi (kod o‘zgarmadi, faqat joyi). Workflow siyosati har
 * sahifada alohida bo‘lishi mumkin, lekin manbani tushunish bitta.
 */
import type { T2ResursKategoriya } from '../api/supabase';

/**
 * RES faylidagi BO'LIM SARLAVHASINI kategoriyaga o'giradi.
 *
 * NIMA UCHUN SHART: МАТ va ОБ ni birlikdan (m3, sht, kompl, m2...) ajratib
 * BO'LMAYDI -- egasining haqiqiy fayllarida «РЕКЛАМНЫЙ БАННЕР, М2» ham,
 * «КОНЦЕВАЯ КАБЕЛЬНАЯ МУФТА, КОМПЛ» ham ОБОРУДОВАНИЕ bo'limida turadi,
 * «КИРПИЧ, ШТ» esa МАТЕРИАЛЬНЫЕ РЕСУРСЫ da. Ya'ni birlik hech narsa
 * demaydi -- yagona ishonchli manba bo'lim sarlavhasi.
 *
 * Drive'dagi RES fayllari (Karting, Navoiy KL-10 kV va b.) o'rganildi --
 * tuzilma hamma joyda bir xil:
 *     ТРУДОВЫЕ РЕСУРСЫ                    -> ЧЕЛ
 *     СТРОИТЕЛЬНЫЕ МАШИНЫ И МЕХАНИЗМЫ     -> МАШ
 *     МАТЕРИАЛЬНЫЕ РЕСУРСЫ                -> МАТ
 *     КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ -> М/К (kabel bo'lsa КАБ)
 *     ОБОРУДОВАНИЕ                        -> ОБ
 * va har biri «ИТОГО ...» qatori bilan yopiladi.
 *
 * T1 (10_Engine.js) ham aynan shu naqshdan foydalanardi, lekin sozlama
 * varag'idagi ANIQ iboralar bilan ('СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ') -- ular
 * haqiqiy sarlavha 'МАТЕРИАЛЬНЫЕ РЕСУРСЫ' ga mos kelmaydi. Shuning uchun
 * bu yerda ANIQ ibora emas, O'ZAK bo'yicha tekshiriladi.
 *
 * @returns kategoriya, yoki 'YAKUN' (ИТОГО/ЖАМИ -- bo'lim tugadi), yoki
 *          null (bu sarlavha emas).
 */
const RES_BOLIM_NAQSH: ReadonlyArray<readonly [RegExp, T2ResursKategoriya]> = [
  [/^ТРУДОВЫЕ\s+РЕСУРСЫ$/, 'ЧЕЛ'],
  [/^ЗАТРАТЫ\s+ТРУДА(\s+(РАБОЧИХ|РАБОЧИХ-СТРОИТЕЛЕЙ|СТРОИТЕЛЕЙ))?$/, 'ЧЕЛ'],
  [/^ЗАТРАТЫ\s+ТРУДА\s+МАШИНИСТОВ$/, 'МАШ'],
  [/^(СТРОИТЕЛЬНЫЕ\s+)?МАШИНЫ(\s+И\s+МЕХАНИЗМЫ)?$/, 'МАШ'],
  [/^МЕХАНИЗМЫ$/, 'МАШ'],
  /* «… И КОНСТРУКЦИИ» qo'shimchasi bilan ham keladi -- egasining Stella
     faylida bo'lim aynan «СТРОИТЕЛЬНЫЕ МАТЕРИАЛЫ И КОНСТРУКЦИИ» deb
     nomlangan va oldingi ($ bilan tugaydigan) naqsh unga mos kelmagan:
     natijada butun material oqimi bo'limsiz qolib, zaxira qoida bo'yicha
     МАТ bo'lgan va ОБ undan ajralmagan. */
  [/^МАТЕРИАЛЬНЫЕ\s+РЕСУРСЫ(\s+И\s+КОНСТРУКЦИИ)?$/, 'МАТ'],
  [/^(СТРОИТЕЛЬНЫЕ\s+)?МАТЕРИАЛЫ(\s+И\s+(КОНСТРУКЦИИ|ИЗДЕЛИЯ))?$/, 'МАТ'],
  [/^КАБЕЛЬ(НАЯ\s+ПРОДУКЦИЯ|НЫЕ\s+ИЗДЕЛИЯ)?$/, 'КАБ'],
  [/^ПРОВОДА?\s+И\s+КАБЕЛИ$/, 'КАБ'],
  [/^КОНСТРУКЦИИ\s+ЗАВОДСКОГО\s+ИЗГОТОВЛЕНИЯ$/, 'М/К'],
  [/^(МЕТАЛЛО)?КОНСТРУКЦИИ$/, 'М/К'],
  [/^ОБОРУДОВАНИ[ЕЯ](\s+И\s+(ИНВЕНТАРЬ|МЕБЕЛЬ))?$/, 'ОБ'],
];

/**
 * Bo'lim SARLAVHASI yo'q blokning turini PODVAL FOIZLARIDAN aniqlaydi.
 *
 * Owner (2026-09-10): «resurs vedemost da ... ob ajratilmasdan materialga
 * aralashtirib tashlanayapdiku». Egasining Stella faylida oborudovaniye
 * ALOHIDA VARAQDA turadi va uning ustida hech qanday «ОБОРУДОВАНИЕ»
 * sarlavhasi YO'Q -- blok faqat oxiridagi nakrutka qatorlari bilan
 * ajraladi (fayldan aynan ko'chirilgan):
 *
 *   oborudovaniye:  «ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ=1,2%» + «ТРАНСПОРТНЫЕ УСЛУГИ=2%»
 *   material:       «ЗАГОТОВИТЕЛЬНО-СКЛАДСКИЕ РАСХОДЫ =2% И М/К=0,75%» + «…=5%»
 *
 * Ajratuvchi belgi -- «М/К» so'zi: u material blokida bo'ladi, oborudovaniye
 * blokida esa bo'lmaydi.
 */
export function podvalBlokTuri(nom: string): 'ОБ' | 'МАТ' | null {
  const s = String(nom || '').toUpperCase().replace(/Ё/g, 'Е');
  if (!/ЗАГОТОВИТЕЛЬНО[\s-]*СКЛАДСКИ|СКЛАДСКИЕ\s+РАСХОДЫ/.test(s)) return null;
  if (/М\s*\/?\s*К/.test(s)) return 'МАТ';
  if (/1[.,]2\s*%/.test(s)) return 'ОБ';
  return null;
}

/**
 * Sarlavha matnini solishtirish uchun normallashtiradi: boshidagi raqam/
 * rim raqami tartiblash ("III.", "2)"), oxiridagi ikki nuqta va ortiqcha
 * bo'shliqlar olib tashlanadi.
 */
function resSarlavhaNormal(nom: string): string {
  return String(nom || '')
    .toUpperCase().replace(/Ё/g, 'Е')
    .replace(/^[\s№IVX0-9.)-]+/, '')
    .replace(/[\s:.;]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resBolimKategoriya(nom: string): T2ResursKategoriya | 'YAKUN' | null {
  const s = resSarlavhaNormal(nom);
  if (!s) return null;
  if (s.includes('ИТОГО') || s.includes('ЖАМИ') || s.includes('ВСЕГО')) return 'YAKUN';
  /* Owner (2026-09-10): 23 ta resurs (БЕТОН, ПЕСОК, РАСТВОР, ЩЕБЕНЬ, ПРОВОД …)
   * noto'g'ri М/К bo'lib chiqdi. Sabab: bu yerda `includes('КОНСТРУКЦИИ')`
   * ishlatilardi, RES faylida esa «КОНСТРУКЦИИ СТАЛЬНЫЕ ПО ПРОЕКТУ»,
   * «АРМАТУРА ДЛЯ МОНОЛИТНЫХ ЖЕЛЕЗОБЕТОННЫХ КОНСТРУКЦИЙ …» kabi RESURS
   * nomlari bor. Narxi bo'sh bo'lgan shunday qator sarlavha deb o'qilib,
   * undan keyingi BUTUN material oqimi М/К ga o'tib ketardi (М/К nakrutka
   * foizi МАТ'nikidan boshqa -- ya'ni bu pulga ta'sir qiladi).
   * Endi sarlavha TO'LIQ moslik bo'yicha aniqlanadi: uzun resurs nomi
   * hech qachon sarlavhaga aylanmaydi. */
  for (const [naqsh, kat] of RES_BOLIM_NAQSH) if (naqsh.test(s)) return kat;
  return null;
}

/* Tayyor konstruksiya nomi KONSTRUKSIYANING O'ZI bilan boshlanadi. Nomi
   «АРМАТУРА ДЛЯ … КОНСТРУКЦИЙ» yoki «ПРОКАТ ДЛЯ АРМИРОВАНИЯ Ж/Б
   КОНСТРУКЦИЙ» bo'lganlar konstruksiya UCHUN xomashyo -- ular МАТ. */
const MK_NOM = /^(МЕТАЛЛО)?КОНСТРУКЦ|^ОТДЕЛЬНЫЕ\s+КОНСТРУКТИВНЫЕ|^КОНСТРУКТИВНЫЕ\s+ЭЛЕМЕНТ/;
/** Tayyor konstruksiya OG'IRLIKDA o'lchanadi (кг/т) -- shtukada emas. */
const MK_BIRLIK = /^(КГ|Т|ТН|ТОННА?)$/;
/** «ПРОВОЛОКА» BU YERGA TUSHMAYDI (ПРОВОЛ ≠ ПРОВОД) -- u bog'lash simi, МАТ. */
const KAB_NOM = /^(КАБЕЛ|ПРОВОД)/;

/**
 * Owner (2026-09-10): «mk ni aniqlash ancha og'ir masala … haqiqiy mk bu
 * TAYYOR KONSTRUKSIYA, kg yoki tonnada belgilanadigan narsa. kabel provod
 * ham shunaqa — shu oilaga kiruvchi, metr yoki km da berilgan narsalar.»
 *
 * Bo'lim sarlavhasi bu ikkisini AYTA OLMAYDI: egasining haqiqiy RES
 * faylida (Karting) alohida «КОНСТРУКЦИИ ЗАВОДСКОГО ИЗГОТОВЛЕНИЯ» bo'limi
 * umuman YO'Q — tayyor konstruksiyalar ham, kabellar ham «МАТЕРИАЛЬНЫЕ
 * РЕСУРСЫ» ichida turadi. Shuning uchun М/К va КАБ qator darajasida,
 * nom + birlik JUFTLIGI bo'yicha aniqlanadi.
 *
 * Qoida ATAYLAB TOR: ikkala shart mos kelmasa qator bo'lim kategoriyasida
 * (odatda МАТ) qoladi. Sabab — egasining ogohlantirishi: «sani mantiqing
 * bo'yicha armatura balo battar hamma prokatlar mk ga kirib ketadi».
 * Kabel/provod nomi esa o'z-o'zidan aniq, shuning uchun unga birlik sharti
 * qo'yilmaydi (egasining faylida «ПРОВОДА … МЕДНЫЕ» tonnada ham keladi).
 * Shubhali qolgan qatorlarni foydalanuvchi import oldidagi ro'yxatda
 * tuzatadi va tanlov registrda eslab qolinadi.
 */
export function resursMkKabAniqla(
  nom: string, birlik: string, bolimKat?: T2ResursKategoriya,
): T2ResursKategoriya | undefined {
  const n = String(nom || '').toUpperCase().replace(/Ё/g, 'Е').trim();
  const b = String(birlik || '').toUpperCase().replace(/Ё/g, 'Е').replace(/[.\s]/g, '').trim();

  /* ⭐ BIRLIK ENG USTUN. Owner (2026-09-10): «bu yana adashayapdida
     kategoriya topishda. mash chas aniqku bazilarida mat deb tashlagan».
     ЧЕЛ-Ч va МАШ-Ч birligi turganda kategoriya SHUBHASIZ -- uni na bo'lim
     sarlavhasi, na podval foizi o'zgartira olmasligi kerak.

     Bu aynan shu xatoning oldini oladi: egasining faylida bo'lim
     sarlavhalari o'qilmay qolgan, keyin material podvali (…=2% И М/К=0,75%)
     uchrab, orqaga belgilash BUTUN blokni -- ishchi soati va 70+ mashinani
     ham -- МАТ qilib qo'ygan edi. Endi ular bu bosqichdayoq ЧЕЛ/МАШ
     bo'ladi va keyingi hech bir qoida ularga tegmaydi. */
  if (b.startsWith('ЧЕЛ')) return /МАШИНИСТ/.test(n) ? 'МАШ' : 'ЧЕЛ';
  if (b.startsWith('МАШ')) return 'МАШ';

  if (!n) return bolimKat;
  if (KAB_NOM.test(n)) return 'КАБ';
  if (MK_NOM.test(n) && MK_BIRLIK.test(b)) return 'М/К';
  return bolimKat;
}
