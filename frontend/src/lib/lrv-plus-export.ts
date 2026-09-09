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
      // Keshlangan qiymat DOIM formuladan hisoblanadi -- faylni ochmasdan
      // ko'rinadigan son formulaning natijasi bilan bir xil bo'lsin.
      summaQiymat = (obyomQiymat ?? 0) * (narx ?? 0);
    } else if (OTA_TUR.has(tur)) {
      const sp = span.get(q.id);
      if (sp) summaFormula = `SUMIF($X$${sp.c1}:$X$${sp.c2},${daraja + 1},$H$${sp.c1}:$H$${sp.c2})`;
      else summaQiymat = 0;
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
    for (let j = i + 1; j < rows.length && (rows[j].daraja ?? 0) > item.daraja; j++) {
      if ((rows[j].daraja ?? 0) === item.daraja + 1) sum += out[j].summaQiymat ?? 0;
    }
    item.summaQiymat = sum;
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
  qatorlar: T2Qator[], obyektNomi: string, holatlar?: T2QatorHolat[],
): Promise<Uint8Array> {
  const hisob = lrvPlusQatorlarniHisobla(qatorlar, holatlar);
  const ildiz = hisob.filter((q) => q.daraja === 0);
  const jamiSumma = ildiz.reduce((s, q) => s + (q.summaQiymat ?? 0), 0);
  const jamiFakt = ildiz.reduce((s, q) => s + q.faktSumma, 0);
  const jamiF2 = ildiz.reduce((s, q) => s + q.f2Summa, 0);

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
      if (idx >= 0) kat[idx] = q.summaQiymat ?? 0;
    }
    aoa.push([
      q.no, q.kod, q.nom, q.birlik,
      q.birlikHajm ?? '', q.obyomQiymat ?? '', q.narx ?? '', q.summaQiymat ?? '',
      q.tur,
      ...kat,
      q.faktHajm, (q.obyomQiymat ?? 0) - q.faktHajm, q.f2Hajm, q.faktHajm - q.f2Hajm,
      q.faktSumma, (q.summaQiymat ?? 0) - q.faktSumma, q.f2Summa, q.faktSumma - q.f2Summa,
      q.daraja,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  for (const q of hisob) {
    if (q.obyomFormula) ws[`F${q.row}`] = { t: 'n', f: q.obyomFormula, v: q.obyomQiymat ?? 0 };
    if (q.summaFormula) ws[`H${q.row}`] = { t: 'n', f: q.summaFormula, v: q.summaQiymat ?? 0 };
    // Kategoriya ustunlari — T1 dagidek H ga havola (faqat bargda).
    if (LEAF_TUR.has(q.tur)) {
      const ustun = KAT_USTUN[q.kat];
      if (ustun) ws[`${ustun}${q.row}`] = { t: 'n', f: `$H${q.row}`, v: q.summaQiymat ?? 0 };
    }
    ws[`Q${q.row}`] = { t: 'n', f: `F${q.row}-P${q.row}`, v: (q.obyomQiymat ?? 0) - q.faktHajm };
    ws[`S${q.row}`] = { t: 'n', f: `P${q.row}-R${q.row}`, v: q.faktHajm - q.f2Hajm };
    ws[`U${q.row}`] = { t: 'n', f: `H${q.row}-T${q.row}`, v: (q.summaQiymat ?? 0) - q.faktSumma };
    ws[`W${q.row}`] = { t: 'n', f: `T${q.row}-V${q.row}`, v: q.faktSumma - q.f2Summa };
  }

  // ЖАМИ — har bir pul ustuni uchun (hajm ustunlari yig'ilmaydi: turli birlik).
  for (const [ustun, qiymat] of [
    ['H', jamiSumma], ['T', jamiFakt], ['U', jamiSumma - jamiFakt],
    ['V', jamiF2], ['W', jamiFakt - jamiF2],
  ] as Array<[string, number]>) {
    const f = lrvPlusJamiFormula(hisob, ustun);
    if (f) ws[`${ustun}3`] = { t: 'n', f, v: qiymat };
  }
  if (hisob.length) {
    const c1 = hisob[0].row, c2 = hisob[hisob.length - 1].row;
    // Kategoriya ustunlari faqat barglarda to'ladi -> butun ustunni yig'ish xavfsiz.
    for (const col of ['J', 'K', 'L', 'M', 'N', 'O']) {
      ws[`${col}3`] = { t: 'n', f: `SUM(${col}${c1}:${col}${c2})`, v: 0 };
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
