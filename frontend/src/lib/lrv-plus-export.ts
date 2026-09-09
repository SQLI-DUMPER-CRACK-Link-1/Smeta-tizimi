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

export interface LrvPlusQator {
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
  if (typeof davrId !== 'string' || !davrId.trim()) reasons.push('PERIOD_CONTEXT_REQUIRED');
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

export function lrvPlusQatorlarniHisobla(qatorlar: T2Qator[], holatlar?: T2QatorHolat[]): LrvPlusQator[] {
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

    let birlikHajm: number | null = q.hajm ?? null;
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
      if (sp) summaFormula = `SUMIF($X$${sp.c1}:$X$${sp.c2},${daraja + 1},$H$${sp.c1}:$H$${sp.c2})`;
      else summaQiymat = null;
    }

    out.push({
      row: r, no: i + 1, kod: q.kod ?? '', nom: q.nom ?? '', birlik: q.birlik ?? '', tur,
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
export function lrvPlusJamiFormula(qatorlar: LrvPlusQator[], ustun: string): string | null {
  if (!qatorlar.length) return null;
  const c1 = qatorlar[0].row, c2 = qatorlar[qatorlar.length - 1].row;
  return `SUMIF($X$${c1}:$X$${c2},0,$${ustun}$${c1}:$${ustun}$${c2})`;
}

export const LRV_PLUS_USTUNLAR = [
  '№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.', 'ҲАЖМ (ед)', 'ҲАЖМ (жами)', 'НАРХ', 'СУММА',
  'ТИП', 'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К',
  'ФАКТ ҳажм', 'ОСТАТКА ҳажм', 'F2 ОЛИНГАН ҳажм', 'F2 ОЛИНИШИ МУМКИН ҳажм',
  'ФАКТ сумма', 'ОСТАТКА сумма', 'F2 ОЛИНГАН сумма', 'F2 ОЛИНИШИ МУМКИН сумма',
  'Даража',
] as const;

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

export async function lrvPlusFaylBaytlari(
  qatorlar: T2Qator[], obyektNomi: string, holatlar?: T2QatorHolat[], context?: LrvPlusExportContext,
): Promise<Uint8Array> {
  if (context) {
    const gate = lrvPlusEksportGate(context);
    if (!gate.ok) throw new LrvPlusExportBlockedError(gate.reasons);
  }
  const hisob = lrvPlusQatorlarniHisobla(qatorlar, holatlar);
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

  const XLSX = await import('xlsx-js-style');
  const NCOLS = LRV_PLUS_USTUNLAR.length;

  const aoa: (string | number)[][] = [
    [obyektNomi || 'Smeta'],
    [...LRV_PLUS_USTUNLAR],
    Array.from({ length: NCOLS }, () => '' as string | number),
  ];
  aoa[2][2] = 'ЖАМИ';

  for (const q of hisob) {
    const kat: (string | number)[] = Array.from({ length: 6 }, () => '');
    if (LEAF_TUR.has(q.tur)) {
      const idx = KAT_TARTIB.indexOf(q.kat);
      if (idx >= 0) kat[idx] = q.summaQiymat ?? '';
    }
    aoa.push([
      q.no, q.kod, q.nom, q.birlik,
      q.birlikHajm ?? '', q.obyomQiymat ?? '', q.narx ?? '', q.summaQiymat ?? '',
      q.tur,
      ...kat,
      q.faktHajm, q.obyomQiymat == null ? '' : q.obyomQiymat - q.faktHajm, q.f2Hajm, q.faktHajm - q.f2Hajm,
      q.faktSumma, q.summaQiymat == null ? '' : q.summaQiymat - q.faktSumma, q.f2Summa, q.faktSumma - q.f2Summa,
      q.daraja,
    ]);
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
    ws[`Q${q.row}`] = { t: 'n', f: `F${q.row}-P${q.row}`, ...(q.obyomQiymat == null ? {} : { v: q.obyomQiymat - q.faktHajm }) };
    ws[`S${q.row}`] = { t: 'n', f: `P${q.row}-R${q.row}`, v: q.faktHajm - q.f2Hajm };
    ws[`U${q.row}`] = { t: 'n', f: `H${q.row}-T${q.row}`, ...(q.summaQiymat == null ? {} : { v: q.summaQiymat - q.faktSumma }) };
    ws[`W${q.row}`] = { t: 'n', f: `T${q.row}-V${q.row}`, v: q.faktSumma - q.f2Summa };
  }

  // ЖАМИ — har bir pul ustuni uchun (hajm ustunlari yig'ilmaydi: turli birlik).
  const ayirma = (a: number | null, b: number | null): number | null => a == null || b == null ? null : a - b;
  for (const [ustun, qiymat] of [
    ['H', jamiSumma], ['T', jamiFakt], ['U', ayirma(jamiSumma, jamiFakt)],
    ['V', jamiF2], ['W', ayirma(jamiFakt, jamiF2)],
  ] as Array<[string, number | null]>) {
    const f = lrvPlusJamiFormula(hisob, ustun);
    if (f) ws[`${ustun}3`] = { t: 'n', f, ...(qiymat == null ? {} : { v: qiymat }) };
  }
  if (hisob.length) {
    const c1 = hisob[0].row, c2 = hisob[hisob.length - 1].row;
    // Kategoriya ustunlari faqat barglarda to'ladi -> butun ustunni yig'ish xavfsiz.
    for (const col of ['J', 'K', 'L', 'M', 'N', 'O']) {
      ws[`${col}3`] = { t: 'n', f: `SUM(${col}${c1}:${col}${c2})` };
    }
  }

  // ── Uslub: chegara + qator turi rangi ──────────────────────────────
  for (const q of hisob) {
    const rang = RANG[q.tur];
    for (let c = 0; c < NCOLS; c++) {
      const ref = XLSX.utils.encode_cell({ r: q.row - 1, c });
      const cell = ws[ref];
      if (!cell) continue;
      cell.s = { border: chegara(c), ...(rang || {}) };
    }
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

  ws['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 46 }, { wch: 9 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 6 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 11 }, { wch: 12 }, { wch: 13 }, { wch: 15 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 7, hidden: true },
  ];
  ws['!autofilter'] = { ref: `A2:${XLSX.utils.encode_col(NCOLS - 1)}${3 + hisob.length}` };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'LRV_PLUS');
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
