/**
 * lrv-plus-export.ts — T2-LRV-PLUS-EXPORT-003
 *
 * Ustun tartibi HAQIQIY Tizim-1 LRV_PLUS fayli bilan bir xil (Drive'dan
 * yuklab olinib, formulalari bayt darajasida o'rganilgan). Egasining
 * v2 ustidan bergan tuzatishlari (2026-09-09) shu yerda yopilgan:
 *
 *   - «MARKIROVKA I GA KO'CHISHI KERAK»  → ТИП endi I ustunida (T1 dagidek).
 *   - «J K L M N O ham qiymatlarni formula bilan olishi kerak»
 *                                        → kategoriya ustunlari `=$H{qator}`.
 *   - «eng keraklisi H gacha, shu yergacha jadval aniqroq chizilsin»
 *                                        → A..H chegaralari qalinroq.
 *   - «har bir ish turi va razdellar ichidagi bolachalari bilan
 *      gruppirovka bo'lsin»              → Excel outline (yig'iladigan qator).
 *   - «X va Y kerak emas — eski tizim shundan ierarxiya ko'rgan»
 *                                        → РАЗДЕЛ/ВИД РАБОТ ustunlari olib
 *                                          tashlandi; ierarxiya endi guruhlash.
 *
 * Ustunlar:
 *   A №  B КОД  C НАИМЕНОВАНИЕ  D ЕД.ИЗМ.  E ҲАЖМ(ед)  F ҲАЖМ(жами)
 *   G НАРХ  H СУММА  I ТИП  J ЧЕЛ  K МАШ  L МАТ  M ОБ  N КАБ  O М/К
 *   P ФАКТ ҳажм  Q ОСТАТКА ҳажм  R F2 ОЛИНГАН ҳажм  S F2 МУМКИН ҳажм
 *   T ФАКТ сумма  U ОСТАТКА сумма  V F2 ОЛИНГАН сумма  W F2 МУМКИН сумма
 *   X Даража (yashirin — SUMIF ota-bola filtri uchun)
 *
 * Formulalar (T1 naqshi):
 *   F(rs, bl ostida) = E(norma) × F(ota bl)
 *   H(barg)          = F × G
 *   H(bl/rz)         = bevosita bolalar yig'indisi (SUMIF, yashirin X bo'yicha)
 *   J..O             = `=$H{qator}` — faqat mos kategoriyada, faqat bargda
 *   Q = F − P        (ostatka ҳажм)
 *   S = P − R        (F2 olinishi mumkin = fakt − olingan)
 *   U = H − T        (ostatka сумма)
 *   W = T − V        (F2 mumkin сумма)
 *
 * `xlsx-js-style` ishlatiladi: oddiy SheetJS Community yozishda katak
 * rangini/chegarasini UMUMAN qo'llab-quvvatlamaydi (Pro xususiyat).
 */
import type { T2Qator, T2QatorHolat } from '../api/supabase';
import type { NakrutkaKoeffitsientlar } from '../api/t2-nakrutka';
import { lrvKalitYoz } from './lrv-qayta-import';
import { resursVedomostAoa } from './resurs-vedomost';

/**
 * `toliq` — butun LRV_PLUS (A..W + yashirin Даража).
 * `forma2` — egasining talabi (2026-09-09): «forma 2 xuddi lrv plusni O
 * ustunigacha bo'lgan qismi bilan bir xil bo'lishi shart, faqat sarlavha
 * o'zgaradi va tagida nakrutkalarni hisoblangan jadvali qo'shilishi kerak.
 * qolgan hammasi — formuladan tortib shakl-shamoyilgacha — LRV_PLUS bilan
 * bir xil.» Ya'ni bu ALOHIDA hujjat emas, LRV_PLUSning O gacha kesilgani.
 */
export type LrvPlusRejim = 'toliq' | 'forma2';

export type LrvPlusOptions = {
  rejim?: LrvPlusRejim;
  /** Sarlavha matni. Berilmasa — obyekt nomi (LRV_PLUS odatiy holati). */
  sarlavha?: string;
  davr?: string;
  raqam?: string;
  buyurtmachi?: string;
  pudratchi?: string;
  /**
   * Egasi (2026-09-09): «bu nakrutka qatorlari aslida lrv plusda ham
   * bo'lishi hisoblanishi kerak, bo'lmasa butun tizimda summalar faqat
   * primoy zatratda hisoblanib qoladi.» Ya'ni ikkala rejimda ham (`toliq`
   * VA `forma2`) berilsa qo'shiladi — alohida emas.
   *
   * Koeffitsientlar (foizlar) beriladi, hisoblangan kaskad EMAS — jadval
   * Excelning o'zida `t2_nakrutka_hisobla_v1` bilan BAYT-BAYTIGA bir xil
   * formula bilan quriladi (`nakrutkaKaskadYoz`), shunda foizni Excelda
   * o'zgartirsa butun zanjir qayta hisoblanadi.
   */
  nakrutka?: NakrutkaKoeffitsientlar;
};

export interface LrvPlusQator {
  /** Kanonik `t2_qator.id` — fayl qaytib kelganda ANIQ moslashtirish uchun.
   *  Kod bo'yicha moslashtirib bo'lmaydi: `000001` bitta obyektda 852 marta
   *  uchraydi. Faylga yashirin ustun sifatida yoziladi. */
  id: number;
  /** 1-indeksli chiqish (sheet) qatori. */
  row: number;
  no: number;
  kod: string;
  nom: string;
  birlik: string;
  tur: string;
  kat: string;
  /** E — bir birlikka: rs uchun NORMA, qolganlar uchun o'z hajmi. */
  birlikHajm: number | null;
  /** F — jami hajm. Formula bo'lsa '=' siz matn. */
  obyomFormula: string | null;
  obyomQiymat: number | null;
  /** G — birlik narxi (faqat barglarda). */
  narx: number | null;
  /** H — formula ('=' siz), bo'sh bo'lsa qiymat ishlatiladi. */
  summaFormula: string | null;
  summaQiymat: number | null;
  faktHajm: number;
  faktSumma: number;
  f2Hajm: number;
  f2Summa: number;
  /** X (yashirin) va Excel outline darajasi. */
  daraja: number;
}

export type LrvPlusExportContext = {
  kompaniyaId: number;
  loyihaId: number;
  obyektId: number;
  davrId: string;
  sourceDocumentId: string;
  revisionId: string;
  /** Read model to‘liq ekanini server/read-layer isbotlagan bo‘lishi shart. */
  dataComplete: boolean;
  /** Registry SHA-256 provenance; missing/blank checksum blocks export. */
  sourceChecksum?: string | null;
  /**
   * ⚠️ 2026-09-10 (haqiqiy nosozlik, egasi "Karting2"da topdi): `davrId`
   * ro'yxati F2 akt reestridan olinadi (`PTOWorkspaceContext`) -- YANGI
   * obyektda hali birorta ham F2 akt yo'q bo'lsa, ro'yxat BO'SH bo'ladi va
   * foydalanuvchi hech qachon `davr` tanlay olmaydi -- LRV Excel eksporti
   * ABADIY bloklanib qolardi, aynan F2/Fakt hali boshlanmagan (eng ko'p
   * kerak bo'ladigan) bosqichda. Chaqiruvchi shu bayroqni `false` qilib
   * yuborsa (obyektda haqiqatan ham tanlanadigan davr yo'qligini
   * TASDIQLAB), `davrId` talabi qo'yilmaydi -- chunki "davr tanlash"
   * F2 tarixi mavjud bo'lgandagina ma'noli. Berilmasa (`undefined`) --
   * eski qat'iy xatti-harakat saqlanadi (orqaga moslik).
   */
  periodApplicable?: boolean;
};

export type LrvPlusExportGate =
  | { ok: true }
  | { ok: false; reasons: string[] };

function positiveSafeId(value: number | undefined): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function lrvPlusEksportGate(context: Partial<LrvPlusExportContext> | null | undefined): LrvPlusExportGate {
  const reasons: string[] = [];
  const kompaniyaId = context?.kompaniyaId;
  const loyihaId = context?.loyihaId;
  const obyektId = context?.obyektId;
  const davrId = context?.davrId;
  const sourceDocumentId = context?.sourceDocumentId;
  const revisionId = context?.revisionId;
  const sourceChecksum = context?.sourceChecksum;
  if (!positiveSafeId(kompaniyaId)) reasons.push('COMPANY_CONTEXT_REQUIRED');
  if (!positiveSafeId(loyihaId)) reasons.push('PROJECT_CONTEXT_REQUIRED');
  if (!positiveSafeId(obyektId)) reasons.push('OBJECT_CONTEXT_REQUIRED');
  if (context?.periodApplicable !== false && (typeof davrId !== 'string' || !davrId.trim())) reasons.push('PERIOD_CONTEXT_REQUIRED');
  if (typeof sourceDocumentId !== 'string' || !sourceDocumentId.trim()) reasons.push('SOURCE_DOCUMENT_REQUIRED');
  if (typeof revisionId !== 'string' || !revisionId.trim()) reasons.push('REVISION_REQUIRED');
  if (context?.dataComplete !== true) reasons.push('READ_MODEL_NOT_COMPLETE');
  if (typeof sourceChecksum !== 'string' || !sourceChecksum.trim()) reasons.push('SOURCE_CHECKSUM_REQUIRED');
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

export class LrvPlusExportBlockedError extends Error {
  readonly code = 'LRV_PLUS_EXPORT_BLOCKED';
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super('LRV_PLUS eksporti uchun provenance/context yetarli emas: ' + reasons.join(', '));
    this.name = 'LrvPlusExportBlockedError';
    this.reasons = reasons;
  }
}

const LEAF_TUR = new Set(['rs', 'mat', 'ob']);
const OTA_TUR = new Set(['rz', 'bl']);

/** `t2_qator.kat` — migration CHECK bilan tasdiqlangan aniq qiymatlar. */
const KAT_USTUN: Record<string, string> = {
  'ЧЕЛ': 'J', 'МАШ': 'K', 'МАТ': 'L', 'ОБ': 'M', 'КАБ': 'N', 'М/К': 'O',
};
const KAT_TARTIB = ['ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К'];

/** Yashirin Даража ustuni har doim OXIRGI ustun: to'liq rejimda `X`,
 *  Forma-2 (O gacha kesilgan) rejimda `P`. SUMIF shu ustunga tayanadi. */
export const LRV_DARAJA_USTUN: Record<LrvPlusRejim, string> = { toliq: 'X', forma2: 'Q' };

export function lrvPlusQatorlarniHisobla(
  qatorlar: T2Qator[], holatlar?: T2QatorHolat[], darajaUstun = 'X',
): LrvPlusQator[] {
  const rows = [...qatorlar].sort((a, b) => (a.tartib ?? 0) - (b.tartib ?? 0));
  const DATA_START = 4; // 1: obyekt nomi, 2: sarlavhalar, 3: ЖАМИ, 4+: ma'lumot

  const byId = new Map<number, T2Qator>();
  for (const q of rows) byId.set(q.id, q);

  const holatById = new Map<number, T2QatorHolat>();
  if (holatlar) for (const h of holatlar) holatById.set(h.qator_id, h);

  const rowOf = new Map<number, number>();
  rows.forEach((q, i) => rowOf.set(q.id, DATA_START + i));

  /** Ota (rz/bl) uchun to'liq nasl oralig'i; SUMIF shu oraliqda ishlaydi,
   *  `daraja+1` filtri faqat bevosita bolalarni oladi. */
  const span = new Map<number, { c1: number; c2: number }>();
  for (let i = 0; i < rows.length; i++) {
    const daraja = rows[i].daraja ?? 0;
    let j = i + 1;
    while (j < rows.length && (rows[j].daraja ?? 0) > daraja) j++;
    if (j > i + 1) span.set(rows[i].id, { c1: DATA_START + i + 1, c2: DATA_START + j - 1 });
  }

  const out: LrvPlusQator[] = [];
  for (let i = 0; i < rows.length; i++) {
    const q = rows[i];
    const r = DATA_START + i;
    const daraja = q.daraja ?? 0;
    const tur = q.tur ?? '';
    const parent = q.ota_id != null ? byId.get(q.ota_id) : undefined;
    const parentRow = q.ota_id != null ? rowOf.get(q.ota_id) : undefined;
    const h = holatById.get(q.id);

    // ⚠️ 2026-09-10 (owner): E (ҲАЖМ ед) faqat rs/bl-norma holatida ma'noli
    // ("bir birlikka" normasi) -- boshqa hamma tur uchun (bl/mat/ob va
    // normasiz rs) bu ustun F (ҲАЖМ жами) bilan AYNAN bir xil sonni
    // ikkinchi marta yozardi (formulalar hech qachon E'ga murojaat
    // qilmaydi -- faqat F ishlatiladi). Endi bunday holatda E bo'sh qoladi.
    let birlikHajm: number | null = null;
    let obyomFormula: string | null = null;
    let obyomQiymat: number | null = q.hajm ?? null;
    let narx: number | null = null;
    let summaFormula: string | null = null;
    let summaQiymat: number | null = q.summa ?? null;

    if (tur === 'rs' && parent?.tur === 'bl' && parentRow != null && q.norma != null && q.norma > 0) {
      // T1: ҲАЖМ(жами) = НОРМА × ota bl ning ҲАЖМ(жами)si.
      birlikHajm = q.norma;
      obyomFormula = `E${r}*F${parentRow}`;
    }

    if (LEAF_TUR.has(tur)) {
      narx = q.narx ?? null;
      summaFormula = `F${r}*G${r}`;
      // Missing input is unknown, not zero. The formula remains live in
      // Excel, but its cached value stays blank until both inputs are known.
      summaQiymat = obyomQiymat != null && narx != null ? obyomQiymat * narx : null;
    } else if (OTA_TUR.has(tur)) {
      const sp = span.get(q.id);
      if (sp) summaFormula = `SUMIF($${darajaUstun}$${sp.c1}:$${darajaUstun}$${sp.c2},${daraja + 1},$H$${sp.c1}:$H$${sp.c2})`;
      // No known children -- unknown, not a fabricated zero (Constitution:
      // NULL is never silently converted to zero).
      else summaQiymat = null;
    }

    out.push({
      id: q.id, row: r, no: i + 1, kod: q.kod ?? '', nom: q.nom ?? '', birlik: q.birlik ?? '', tur,
      kat: q.kat ?? '', birlikHajm, obyomFormula, obyomQiymat, narx, summaFormula, summaQiymat,
      faktHajm: h ? h.fakt_hajm : 0, faktSumma: h ? h.fakt_summa : 0,
      f2Hajm: h ? h.f2_hajm : 0, f2Summa: h ? h.f2_summa : 0,
      daraja,
    });
  }

  // Teskari o'tish: rz/bl ning keshlangan SUMMASI bazadagi `summa`ga emas,
  // o'zi hisoblangan bolalar yig'indisiga tayanadi.
  for (let i = rows.length - 1; i >= 0; i--) {
    const item = out[i];
    if (!OTA_TUR.has(item.tur) || !item.summaFormula) continue;
    let sum = 0;
    let hasChild = false;
    let unknownChild = false;
    for (let j = i + 1; j < rows.length && (rows[j].daraja ?? 0) > item.daraja; j++) {
      if ((rows[j].daraja ?? 0) !== item.daraja + 1) continue;
      hasChild = true;
      const childSum = out[j].summaQiymat;
      if (childSum == null) unknownChild = true;
      else sum += childSum;
    }
    item.summaQiymat = hasChild && !unknownChild ? sum : null;
  }

  return out;
}

/** Ildiz (daraja=0) qatorlar yig'indisi — ular allaqachon butun naslning
 *  jami qiymati, shuning uchun ikki marta sanalmaydi. */
export function lrvPlusJamiFormula(qatorlar: LrvPlusQator[], ustun: string, darajaUstun = 'X'): string | null {
  if (!qatorlar.length) return null;
  const c1 = qatorlar[0].row, c2 = qatorlar[qatorlar.length - 1].row;
  return `SUMIF($${darajaUstun}$${c1}:$${darajaUstun}$${c2},0,$${ustun}$${c1}:$${ustun}$${c2})`;
}

export const LRV_PLUS_USTUNLAR = [
  '№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.', 'ҲАЖМ (ед)', 'ҲАЖМ (жами)', 'НАРХ', 'СУММА',
  'ТИП', 'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К',
  'ФАКТ ҳажм', 'ОСТАТКА ҳажм', 'F2 ОЛИНГАН ҳажм', 'F2 ОЛИНИШИ МУМКИН ҳажм',
  'ФАКТ сумма', 'ОСТАТКА сумма', 'F2 ОЛИНГАН сумма', 'F2 ОЛИНИШИ МУМКИН сумма',
  'Даража', 'КАЛИТ',
] as const;

/** Forma-2: A..O — LRV_PLUS bilan AYNAN bir xil; keyin hujjatning o'z
 *  ustunlari. `ЗАМЕЧАНИЕ` — buyurtmachi qo'lda yozadigan ustun; `Даража` va
 *  `ID` yashirin (`ID` qaytib kelgan faylni aniq moslashtirish uchun). */
export const LRV_FORMA2_USTUNLAR = [
  ...LRV_PLUS_USTUNLAR.slice(0, 15), 'ЗАМЕЧАНИЕ', 'Даража', 'КАЛИТ',
] as const;

/** Fayl qaysi obyekt/davrga tegishli ekanini mashina o'qiy oladigan belgi —
 *  tahrirlangan fayl BOSHQA obyektga import qilinib ketmasligi uchun. */
export const LRV_BELGI_PREFIKS = 'T2-LRV/';
export function lrvBelgiYoz(obyektId: number, davr: string, rejim: LrvPlusRejim): string {
  return `${LRV_BELGI_PREFIKS}${rejim};obyekt=${obyektId};davr=${davr || '-'};v=1`;
}
export function lrvBelgiOqi(matn: unknown): { rejim: string; obyektId: number; davr: string } | null {
  const s = String(matn ?? '');
  if (!s.startsWith(LRV_BELGI_PREFIKS)) return null;
  const q = s.slice(LRV_BELGI_PREFIKS.length);
  const rejim = q.split(';')[0] || '';
  const obyekt = Number(/obyekt=(\d+)/.exec(q)?.[1] ?? NaN);
  const davr = /davr=([^;]*)/.exec(q)?.[1] ?? '';
  return Number.isFinite(obyekt) ? { rejim, obyektId: obyekt, davr } : null;
}

/** «H gacha» — egasi uchun eng muhim zona; chegarasi qalinroq. */
const ASOSIY_ZONA_OXIRI = 7; // 0-indeks: A..H

const CHIZIQ = { style: 'thin', color: { rgb: 'B0B0B0' } } as const;
const QALIN = { style: 'medium', color: { rgb: '606060' } } as const;

function chegara(c: number) {
  const asosiy = c <= ASOSIY_ZONA_OXIRI;
  const v = asosiy ? QALIN : CHIZIQ;
  return { top: v, bottom: v, left: v, right: v };
}

/** T1 `00_Config.js` CFG.RANG: rz sariq, bl ko'k + oq shrift, mat yashil. */
const RANG: Record<string, { fill?: { patternType: string; fgColor: { rgb: string } }; font?: { bold?: boolean; color?: { rgb: string } } }> = {
  rz: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } }, font: { bold: true } },
  bl: { fill: { patternType: 'solid', fgColor: { rgb: '4A86E8' } }, font: { bold: true, color: { rgb: 'FFFFFF' } } },
  mat: { fill: { patternType: 'solid', fgColor: { rgb: 'D9EAD3' } } },
};

/**
 * Nakrutka kaskadi jadvalining bitta qatori. `pctKoef` berilsa E ustunida
 * TAHRIRLANADIGAN foiz katagi chiqadi (literal son); `summaFormula` shu
 * foiz katagiga va yuqoridagi qatorlarga/`J3..O3` kategoriya jamilariga
 * tayanadi — Excelning o'zida qayta hisoblanadi.
 */
type NakrutkaQator = {
  label: string;
  pctKoef: keyof NakrutkaKoeffitsientlar | null;
  /** `r` — shu qatorning o'zi yozilayotgan Excel qator raqami. */
  summaFormula: (r: number) => string;
  /**
   * Kutilgan JS qiymati — .v keshi to'g'ri bo'lishi uchun. `summaOldin[i]`
   * — i-INDEKSLI (0-based) OLDINGI qatorning ALLAQACHON hisoblangan
   * summasi (FOIZLAR bu massivga KIRMAYDI — faqat summa, aralashtirilmasin).
   */
  summaJS: (kat: NakrutkaHisob, koef: NakrutkaKoeffitsientlar, summaOldin: number[]) => number;
  jami?: boolean;
};

type NakrutkaHisob = {
  chel: number; mash: number; mat: number; ob: number; kab: number; mk: number;
};

/**
 * `t2_nakrutka_hisobla_v1` (migratsiya `20261014090000`) bilan BAYT-
 * BAYTIGA bir xil kaskad — endi Excel formula sifatida. `mat` bu yerda
 * TO'LIQ bucket (МАТ+КАБ+М/К), server RPC'dagi bilan bir xil semantika;
 * `kab`/`mk` undan formulada QAYTA ayiriladi.
 */
function nakrutkaQatorlarQur(): NakrutkaQator[] {
  return [
    {
      label: 'Прямые затраты (ЧЕЛ+МАШ+МАТ+ОБ)', pctKoef: null,
      summaFormula: () => '=ROUND(J3+K3+L3+M3+N3+O3,2)',
      summaJS: (kat) => kat.chel + kat.mash + kat.mat + kat.ob,
    },
    {
      label: 'Транспорт (материалы)', pctKoef: 'ТРАНСПОРТ_МАТЕРИАЛ',
      summaFormula: (r) => `=ROUND((L3+O3)*E${r}/100,2)`,
      summaJS: (kat, koef) => (kat.mat - kat.kab) * (koef.ТРАНСПОРТ_МАТЕРИАЛ ?? 0) / 100,
    },
    {
      label: 'Складские (материалы)', pctKoef: 'СКЛАДСКИЕ_МАТЕРИАЛ',
      summaFormula: (r) => `=ROUND((L3+N3)*E${r}/100,2)`,
      summaJS: (kat, koef) => (kat.mat - kat.mk) * (koef.СКЛАДСКИЕ_МАТЕРИАЛ ?? 0) / 100,
    },
    {
      label: 'Складские (М/К)', pctKoef: 'СКЛАДСКИЕ_МК',
      summaFormula: (r) => `=ROUND(O3*E${r}/100,2)`,
      summaJS: (kat, koef) => kat.mk * (koef.СКЛАДСКИЕ_МК ?? 0) / 100,
    },
    {
      label: 'Транспорт (кабель)', pctKoef: 'ТРАНСПОРТ_КАБЕЛЬ',
      summaFormula: (r) => `=ROUND(N3*E${r}/100,2)`,
      summaJS: (kat, koef) => kat.kab * (koef.ТРАНСПОРТ_КАБЕЛЬ ?? 0) / 100,
    },
    {
      label: 'ИТОГО-1 (прямые − ОБ + транспорт/склад)', pctKoef: null,
      summaFormula: (r) => `=ROUND(F${r - 5}-M3+F${r - 4}+F${r - 3}+F${r - 2}+F${r - 1},2)`,
      summaJS: (kat, _koef, s) => s[0] - kat.ob + s[1] + s[2] + s[3] + s[4],
      jami: true,
    },
    {
      label: 'Прочие расходы подрядчика', pctKoef: 'ПРОЧИЕ_ПОДРЯДЧИК',
      summaFormula: (r) => `=ROUND(F${r - 1}*E${r}/100,2)`,
      summaJS: (_kat, koef, s) => s[5] * (koef.ПРОЧИЕ_ПОДРЯДЧИК ?? 0) / 100,
    },
    {
      label: 'ИТОГО-2', pctKoef: null,
      summaFormula: (r) => `=ROUND(F${r - 2}+F${r - 1},2)`,
      summaJS: (_kat, _koef, s) => s[5] + s[6],
      jami: true,
    },
    {
      label: 'Транспорт (оборудование)', pctKoef: 'ТРАНСПОРТ_ОБОРУД',
      summaFormula: (r) => `=ROUND(M3*E${r}/100,2)`,
      summaJS: (kat, koef) => kat.ob * (koef.ТРАНСПОРТ_ОБОРУД ?? 0) / 100,
    },
    {
      label: 'Заготовительно-складские (оборудование)', pctKoef: 'ЗАГОТ_СКЛАД_ОБОРУД',
      summaFormula: (r) => `=ROUND(M3*E${r}/100,2)`,
      summaJS: (kat, koef) => kat.ob * (koef.ЗАГОТ_СКЛАД_ОБОРУД ?? 0) / 100,
    },
    {
      label: 'ИТОГО-3 (+ ОБ + транспорт/заготовка)', pctKoef: null,
      summaFormula: (r) => `=ROUND(F${r - 4}+M3+F${r - 2}+F${r - 1},2)`,
      summaJS: (kat, _koef, s) => s[7] + kat.ob + s[8] + s[9],
      jami: true,
    },
    {
      label: 'Страхование объекта', pctKoef: 'СТРАХОВАНИЕ',
      summaFormula: (r) => `=ROUND(F${r - 1}*E${r}/100,2)`,
      summaJS: (_kat, koef, s) => s[10] * (koef.СТРАХОВАНИЕ ?? 0) / 100,
    },
    {
      label: 'Риск', pctKoef: 'РИСК',
      summaFormula: (r) => `=ROUND(F${r - 2}*E${r}/100,2)`,
      summaJS: (_kat, koef, s) => s[10] * (koef.РИСК ?? 0) / 100,
    },
    {
      label: 'ИТОГО-4', pctKoef: null,
      summaFormula: (r) => `=ROUND(F${r - 3}+F${r - 2}+F${r - 1},2)`,
      summaJS: (_kat, _koef, s) => s[10] + s[11] + s[12],
      jami: true,
    },
    {
      label: 'НДС', pctKoef: 'НДС',
      summaFormula: (r) => `=ROUND(F${r - 1}*E${r}/100,2)`,
      summaJS: (_kat, koef, s) => s[13] * (koef.НДС ?? 0) / 100,
    },
    {
      label: 'ВСЕГО (с учётом накрутки и НДС)', pctKoef: null,
      summaFormula: (r) => `=ROUND(F${r - 2}+F${r - 1},2)`,
      summaJS: (_kat, _koef, s) => s[13] + s[14],
      jami: true,
    },
  ];
}

/**
 * Nakrutka kaskadi jadvalini `ws` ga yozadi, `startRow` dan boshlab.
 * `J3..O3` (kategoriya ЖАМИ formulalari) allaqachon faylda yozilgan
 * bo'lishi shart — bu funksiya faqat ularga HAVOLA qiladi, qayta
 * hisoblamaydi (ikkinchi haqiqat manbai emas).
 */
function nakrutkaKaskadYoz(
  ws: import('xlsx-js-style').WorkSheet, XLSX: typeof import('xlsx-js-style'),
  startRow: number, koef: NakrutkaKoeffitsientlar, kat: NakrutkaHisob,
): number {
  ws[XLSX.utils.encode_cell({ r: startRow - 1, c: 1 })] = {
    t: 's', v: 'НАКРУТКА (қўшимча харажатлар ва ҚҚС)', s: { font: { bold: true, sz: 12 } },
  };
  const boshQator = startRow + 1;
  const bosh = [['Показатель', 1], ['%', 4], ['Сумма', 5]] as const;
  for (const [matn, ustun] of bosh) {
    const ref = XLSX.utils.encode_cell({ r: boshQator - 1, c: ustun });
    ws[ref] = { t: 's', v: matn, s: { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'EFEFEF' } }, border: chegara(0) } };
  }

  const qatorlar = nakrutkaQatorlarQur();
  // FAQAT summa (foizlar aralashtirilmaydi) — `summaJS` shu indekslar
  // bo'yicha OLDINGI qatorlarga murojaat qiladi.
  const summaOldin: number[] = [];
  let r = boshQator + 1;
  for (const q of qatorlar) {
    ws[XLSX.utils.encode_cell({ r: r - 1, c: 1 })] = { t: 's', v: q.label, s: { font: { bold: !!q.jami } } };
    if (q.pctKoef) {
      const pct = koef[q.pctKoef] ?? 0;
      ws[`E${r}`] = { t: 'n', v: pct, s: { fill: { patternType: 'solid', fgColor: { rgb: 'FFF9E0' } } } };
    }
    const summaJS = Math.round(q.summaJS(kat, koef, summaOldin) * 100) / 100;
    ws[`F${r}`] = {
      t: 'n', f: q.summaFormula(r).replace(/^=/, ''), v: summaJS,
      s: q.jami ? { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } }, border: chegara(0) } : undefined,
    };
    summaOldin.push(summaJS);
    r++;
  }
  return r; // birinchi bo'sh qator (jadvaldan keyin)
}

export async function lrvPlusFaylBaytlari(
  qatorlar: T2Qator[], obyektNomi: string, holatlar?: T2QatorHolat[],
  options?: LrvPlusOptions, context?: LrvPlusExportContext,
): Promise<Uint8Array> {
  if (context) {
    const gate = lrvPlusEksportGate(context);
    if (!gate.ok) throw new LrvPlusExportBlockedError(gate.reasons);
  }
  const rejim = options?.rejim ?? 'toliq';
  const darajaUstun = LRV_DARAJA_USTUN[rejim];
  const ustunlar = rejim === 'forma2' ? LRV_FORMA2_USTUNLAR : LRV_PLUS_USTUNLAR;
  const hisob = lrvPlusQatorlarniHisobla(qatorlar, holatlar, darajaUstun);
  const ildiz = hisob.filter((q) => q.daraja === 0);
  const knownSum = (items: LrvPlusQator[], pick: (row: LrvPlusQator) => number | null): number | null => {
    let sum = 0;
    for (const item of items) {
      const value = pick(item);
      if (value == null) return null;
      sum += value;
    }
    return items.length ? sum : null;
  };
  const jamiSumma = knownSum(ildiz, (q) => q.summaQiymat);
  const jamiFakt = knownSum(ildiz, (q) => q.faktSumma);
  const jamiF2 = knownSum(ildiz, (q) => q.f2Summa);

  // Kategoriya ЖАМИ — J3..O3 keshlangan qiymati va nakrutka kaskadi shu
  // yerdan oladi (faqat barglar, T1 dagidek).
  const katYigindi: Record<string, number> = { 'ЧЕЛ': 0, 'МАШ': 0, 'МАТ': 0, 'ОБ': 0, 'КАБ': 0, 'М/К': 0 };
  for (const q of hisob) {
    if (LEAF_TUR.has(q.tur) && q.kat in katYigindi) katYigindi[q.kat] += q.summaQiymat ?? 0;
  }

  const XLSX = await import('xlsx-js-style');
  const NCOLS = ustunlar.length;

  const sarlavhaMatn = options?.sarlavha ?? (rejim === 'forma2'
    ? `ФОРМА-2 · Акт выполненных работ${options?.raqam ? ' №' + options.raqam : ''} — ${obyektNomi || 'Smeta'}${options?.davr ? ' — ' + options.davr : ''}`
    : (obyektNomi || 'Smeta'));

  // ⚠️ 2026-09-10 (owner, haqiqiy nosozlik): raqamli ustunlarda noma'lum
  // qiymat uchun `''` (bo'sh MATN) ishlatilsa, Excel'da o'sha katakka
  // murojaat qiluvchi HAR QANDAY jonli formula (masalan Q ustunidagi
  // `F-P`) `#ЗНАЧ!` (#VALUE!) xatosi bilan yiqiladi -- matnni sondan
  // ayirib/ko'paytirib bo'lmaydi. `null`/`undefined` esa `aoa_to_sheet`da
  // katakning O'ZINI umuman yaratmaydi (haqiqiy BO'SH katak), Excel buni
  // arifmetikada xavfsiz 0 deb oladi. Shu sabab quyida `?? ''` emas,
  // `?? null` ishlatiladi.
  const aoa: (string | number | null)[][] = [
    [sarlavhaMatn],
    [...ustunlar],
    Array.from({ length: NCOLS }, () => '' as string | number),
  ];
  aoa[2][2] = 'ЖАМИ';

  for (const q of hisob) {
    const kat: (string | number | null)[] = Array.from({ length: 6 }, () => null);
    if (LEAF_TUR.has(q.tur)) {
      const idx = KAT_TARTIB.indexOf(q.kat);
      if (idx >= 0) kat[idx] = q.summaQiymat ?? null;
    }
    const asosiy = [
      q.no, q.kod, q.nom, q.birlik,
      q.birlikHajm ?? null, q.obyomQiymat ?? null, q.narx ?? null, q.summaQiymat ?? null,
      q.tur,
      ...kat,
    ];
    if (rejim === 'forma2') {
      // A..O + ЗАМЕЧАНИЕ (bo'sh, buyurtmachi to'ldiradi) + Даража + КАЛИТ.
      aoa.push([...asosiy, '', q.daraja, lrvKalitYoz(q.id, q.kod, q.nom, q.birlik)]);
    } else {
      aoa.push([
        ...asosiy,
        q.faktHajm, q.obyomQiymat == null ? '' : q.obyomQiymat - q.faktHajm, q.f2Hajm, q.faktHajm - q.f2Hajm,
        q.faktSumma, q.summaQiymat == null ? '' : q.summaQiymat - q.faktSumma, q.f2Summa, q.faktSumma - q.f2Summa,
        q.daraja,
        lrvKalitYoz(q.id, q.kod, q.nom, q.birlik),
      ]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (const q of hisob) {
    if (q.obyomFormula) ws[`F${q.row}`] = { t: 'n', f: q.obyomFormula, ...(q.obyomQiymat == null ? {} : { v: q.obyomQiymat }) };
    if (q.summaFormula) ws[`H${q.row}`] = { t: 'n', f: q.summaFormula, ...(q.summaQiymat == null ? {} : { v: q.summaQiymat }) };
    // Kategoriya ustunlari — T1 dagidek H ga havola (faqat bargda).
    if (LEAF_TUR.has(q.tur)) {
      const ustun = KAT_USTUN[q.kat];
      if (ustun) ws[`${ustun}${q.row}`] = { t: 'n', f: `$H${q.row}`, ...(q.summaQiymat == null ? {} : { v: q.summaQiymat }) };
    }
    if (rejim === 'toliq') {
      ws[`Q${q.row}`] = { t: 'n', f: `F${q.row}-P${q.row}`, ...(q.obyomQiymat == null ? {} : { v: q.obyomQiymat - q.faktHajm }) };
      ws[`S${q.row}`] = { t: 'n', f: `P${q.row}-R${q.row}`, v: q.faktHajm - q.f2Hajm };
      ws[`U${q.row}`] = { t: 'n', f: `H${q.row}-T${q.row}`, ...(q.summaQiymat == null ? {} : { v: q.summaQiymat - q.faktSumma }) };
      ws[`W${q.row}`] = { t: 'n', f: `T${q.row}-V${q.row}`, v: q.faktSumma - q.f2Summa };
    }
  }

  // ЖАМИ — har bir pul ustuni uchun (hajm ustunlari yig'ilmaydi: turli birlik).
  // Noma'lum (null) qo'shiluvchi -- natija ham noma'lum, 0 emas.
  const ayirma = (a: number | null, b: number | null): number | null => a == null || b == null ? null : a - b;
  const jamiUstunlar: Array<[string, number | null]> = [['H', jamiSumma]];
  if (rejim === 'toliq') {
    jamiUstunlar.push(['T', jamiFakt], ['U', ayirma(jamiSumma, jamiFakt)], ['V', jamiF2], ['W', ayirma(jamiFakt, jamiF2)]);
  }
  for (const [ustun, qiymat] of jamiUstunlar) {
    const f = lrvPlusJamiFormula(hisob, ustun, darajaUstun);
    if (f) ws[`${ustun}3`] = { t: 'n', f, ...(qiymat == null ? {} : { v: qiymat }) };
  }
  if (hisob.length) {
    const c1 = hisob[0].row, c2 = hisob[hisob.length - 1].row;
    // Kategoriya ustunlari faqat barglarda to'ladi -> butun ustunni yig'ish
    // xavfsiz. Keshlangan qiymat ENDI TO'G'RI (avval 0 edi) — nakrutka
    // kaskadi va SheetJS bilan formula-recalc'siz o'quvchilar shunga tayanadi.
    for (const col of ['J', 'K', 'L', 'M', 'N', 'O'] as const) {
      const kalitlar: Record<string, string> = { J: 'ЧЕЛ', K: 'МАШ', L: 'МАТ', M: 'ОБ', N: 'КАБ', O: 'М/К' };
      ws[`${col}3`] = { t: 'n', f: `SUM(${col}${c1}:${col}${c2})`, v: katYigindi[kalitlar[col]] };
    }
  }

  /* Owner (2026-09-10): «son tekst formatlari yacheyka ichiga kirib
     ketmasligi kerak ideal ko'rinishi». Format berilmasa Excel katta
     summani xom holda chiqaradi (471209797.5111) -- u katakka sig'maydi
     va tor ustunda `#####` bo'lib qoladi. Mingliklar ajratilgan format
     ham kengligini oldindan aytib beradi, ham egasining hujjatlaridagi
     ko'rinishga mos keladi (471,209,797.51).

     Nom ustuni (C) esa o'ralib ko'rsatiladi -- resurs nomlari juda uzun
     («КРАНЫ НА АВТОМОБИЛЬНОМ ХОДУ ПРИ РАБОТЕ НА ДРУГИХ ВИДАХ …»), ular
     qo'shni katak to'la bo'lsa kesilib qolardi. */
  const PUL_FORMAT = '#,##0.00';
  const HAJM_FORMAT = '#,##0.####';
  /** C = nom; E/F = hajm; G/H = narx va summa; J..O = kategoriya summalari. */
  const NOM_USTUN = 2;
  const HAJM_USTUN = new Set([4, 5]);
  const PUL_USTUN = new Set([6, 7, 9, 10, 11, 12, 13, 14]);

  // ── Uslub: chegara + qator turi rangi ──────────────────────────────
  for (const q of hisob) {
    const rang = RANG[q.tur];
    for (let c = 0; c < NCOLS; c++) {
      const ref = XLSX.utils.encode_cell({ r: q.row - 1, c });
      const cell = ws[ref];
      if (!cell) continue;
      cell.s = { border: chegara(c), ...(rang || {}) };
      if (c === NOM_USTUN) {
        cell.s.alignment = { ...(cell.s.alignment || {}), wrapText: true, vertical: 'top' };
      } else if (cell.t === 'n') {
        cell.z = HAJM_USTUN.has(c) ? HAJM_FORMAT : PUL_USTUN.has(c) ? PUL_FORMAT : cell.z;
      }
    }
  }
  // ЖАМИ qatoridagi va kategoriya jamilaridagi sonlar ham bir xil formatda
  for (let c = 0; c < NCOLS; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 2, c })];
    if (cell && cell.t === 'n') cell.z = PUL_USTUN.has(c) || c === 7 ? PUL_FORMAT : HAJM_FORMAT;
  }
  for (const r of [1, 2]) { // sarlavha va ЖАМИ
    for (let c = 0; c < NCOLS; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      cell.s = {
        border: chegara(c),
        font: { bold: true },
        fill: { patternType: 'solid', fgColor: { rgb: r === 1 ? 'EFEFEF' : 'FFF2CC' } },
        alignment: r === 1 ? { wrapText: true, vertical: 'center', horizontal: 'center' } : undefined,
      };
    }
  }

  // ── Guruhlash: rz > bl > resurs (yig'iladigan qatorlar) ─────────────
  const rowInfo: Array<{ level?: number; hpt?: number }> = [];
  rowInfo[1] = { hpt: 30 }; // sarlavha balandroq (wrapText)
  for (const q of hisob) rowInfo[q.row - 1] = { level: Math.min(q.daraja, 7) };
  ws['!rows'] = rowInfo;

  const asosiyKengliklar = [
    { wch: 5 }, { wch: 14 }, { wch: 46 }, { wch: 9 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  ];
  ws['!cols'] = rejim === 'toliq'
    ? [
        ...asosiyKengliklar,
        { wch: 11 }, { wch: 12 }, { wch: 13 }, { wch: 15 },
        { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
        { wch: 7, hidden: true },   // Даража
        { wch: 18, hidden: true },  // КАЛИТ
      ]
    : [
        ...asosiyKengliklar,
        { wch: 30 },                // ЗАМЕЧАНИЕ
        { wch: 7, hidden: true },   // Даража
        { wch: 18, hidden: true },  // КАЛИТ
      ];
  const oxirgiMalumotQator = 3 + hisob.length;
  ws['!autofilter'] = { ref: `A2:${XLSX.utils.encode_col(NCOLS - 1)}${oxirgiMalumotQator}` };

  // ── Nakrutka kaskadi — egasining talabi bo'yicha ikkala rejimda ham,
  // faqat koeffitsientlar berilganda (o'ylab topilgan son bo'lmasin). ──
  if (options?.nakrutka) {
    const kat: NakrutkaHisob = {
      chel: katYigindi['ЧЕЛ'], mash: katYigindi['МАШ'],
      mat: katYigindi['МАТ'] + katYigindi['КАБ'] + katYigindi['М/К'],
      ob: katYigindi['ОБ'], kab: katYigindi['КАБ'], mk: katYigindi['М/К'],
    };
    const oxirgiNakrutkaQator = nakrutkaKaskadYoz(ws, XLSX, oxirgiMalumotQator + 2, options.nakrutka, kat);
    // ⚠️ SheetJS asl `aoa_to_sheet` chegarasidan (`!ref`) TASHQARIDA qo'lda
    // qo'shilgan kataklarni YOZISHDA JIM TASHLAB YUBORADI (tekshirilgan:
    // `XLSX.write` keyin qayta o'qilganda `!ref`dan tashqari katak yo'qoladi).
    // Nakrutka jadvali har doim asl ma'lumot oralig'idan pastda bo'lgani
    // uchun `!ref` shu yerda albatta kengaytiriladi.
    const joriy = XLSX.utils.decode_range(ws['!ref'] as string);
    joriy.e.r = Math.max(joriy.e.r, oxirgiNakrutkaQator - 1);
    ws['!ref'] = XLSX.utils.encode_range(joriy);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, rejim === 'forma2' ? 'FORMA_2' : 'LRV_PLUS');

  // Owner (2026-09-10): "excel lrv hujjatlari ichida bo'lishi kerak" --
  // resurs vedomosti (ЧЕЛ/МАШ/МАТ/ОБ/КАБ/М-К kesimida) ilova ichidagi
  // alohida ko'rinish (ResursVedomostNative.tsx) bilan cheklanmasin,
  // eksportning O'ZI ichida alohida varaq bo'lib chiqsin. Ekrandagi va
  // shu yerdagi hisob-kitob BITTA manba (resursVedomostAoa/
  // resursVedomostKategoriyalarga) -- ikkinchi haqiqat yaratilmaydi.
  const resursWs = XLSX.utils.aoa_to_sheet(resursVedomostAoa(holatlar ?? []));
  resursWs['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 46 }, { wch: 10 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, resursWs, 'RESURS_VEDOMOST');

  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Uint8Array(out);
}

/** Brauzerda faylni yuklab olishga majburlaydi (blob + vaqtinchalik link). */
export function lrvPlusYuklab(bytes: Uint8Array, obyektNomi: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = new Blob([bytes as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(obyektNomi || 'smeta').replace(/[\\/:*?"<>|]/g, '_')}_LRV_PLUS.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(url);
  }
}
