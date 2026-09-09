/**
 * lrv-plus-export.ts — T2-LRV-PLUS-EXPORT-002: T1'ning haqiqiy LRV_PLUS
 * Google Sheets faylini (bevosita Drive'dan yuklab olib, bayt darajasida
 * o'rganilgan) va egasining aniq talabini birlashtiradi:
 *
 *   "smeta strukturasi shaklida ... narxlangan f2 kiritilsa hammasi
 *   kiritilgan ... butun obyektni to'liq nazorat qilinayotganini
 *   ko'rsata oladigan, xuddi LRV kabi ranglangan dizaynda ... fakt smeta
 *   ostatka f2 olingan f2 olinishi mumkin har biri uchun har bir qatorda
 *   aniq qiymat bo'lishi kerak."
 *
 * V1 (T2-LRV-PLUS-EXPORT-001, endi eskirgan) faqat 9 ustunli MVP edi —
 * FAKT/F2/OSTATKA umuman yo'q, rang yo'q. Bu haqiqiy T1 LRV_PLUS bilan
 * solishtirilganda ("San qilib bergan tizim umuman unaqa ishlamayapdi")
 * yetarli emas edi.
 *
 * Haqiqiy T1 formulasi (real fayldan tasdiqlangan, `Amfiteatr` obyekti):
 *   ОБЪЁМ(rs, bl ostida) = НОРМА(rs) × ОБЪЁМ(ota bl)      — E{row}*E{bl}
 *   СУММА(barg)          = ОБЪЁМ × ЦЕНА                    — F*G
 *   СУММА(bl/rz)         = SUM(bevosita bolalar SUMMASI)   — SUMIF daraja bo'yicha
 *   ФАКТ(rs)              = НОРМА(rs) × ФАКТ(ota bl)        — Q{row}=Q{bl}*E{row}
 *   ОСТАТКА              = SMETA − ФАКТ                    — R=E-Q
 *   ОСТАТКА Ф2           = ФАКТ − ЗАБРАН(Ф2)                — T=Q-S
 * Rang (T1 `00_Config.js` CFG.RANG): rz=sariq, bl=ko'k+oq shrift,
 * mat=yashil, rs=rangsiz.
 *
 * T2'da ФАКТ/Ф2/ОСТАТКА uchun serverda ALLAQACHON to'liq (har bir
 * daraja — rs/mat/ob VA bl/rz — uchun) yig'ilgan qiymat bor
 * (`t2_qator_holat` view'i, `T2QatorHolat`). Shuning uchun bu ustunlar
 * uchun kaskadni JS'da qayta hisoblash SHART EMAS — faqat literal
 * qiymat sifatida yoziladi; faqat ОСТАТКА/ОСТАТКА-Ф2 Excelning o'zida
 * jonli formula (haqiqiy T1 R=E-Q, T=Q-S naqshi) — shu bilan SMETA
 * ustunini Excelda o'zgartirsa, ОСТАТКА avtomatik yangilanadi.
 *
 * Bu modul ATAYLAB ikkiga bo'lingan (v1'dagi kabi):
 *   - `lrvPlusQatorlarniHisobla` — sof funksiya, xlsx kutubxonasisiz test
 *     qilinadi (formulalar/qiymatlar TO'G'RI ekanini tekshirish uchun).
 *   - `lrvPlusFaylBaytlari` / `lrvPlusYuklab` — `xlsx-js-style`ni FAQAT
 *     shu eksport tugmasi bosilganda dinamik import qiladi (og'ir
 *     kutubxona har sahifa yuklanishida emas). `xlsx-js-style` oddiy
 *     `xlsx` (SheetJS Community)dan farqli — Community versiya yozishda
 *     katak rangini/shriftini UMUMAN qo'llab-quvvatlamaydi (bu Pro
 *     xususiyat); `xlsx-js-style` xuddi shu API'ga ega, ranglash
 *     qo'shilgan, bepul fork.
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
  /** F ustuni — faqat bl ota ostidagi rs uchun sarf normasi. */
  norma: number | null;
  /** G ustuni — formula bo'lsa (norma bilan bog'langan rs), '=' siz matn. */
  obyomFormula: string | null;
  obyomQiymat: number | null;
  /** H ustuni — birlik narxi (faqat rs/mat/ob barglarida). */
  narx: number | null;
  /** I ustuni — formula ('=' siz matn), bo'sh bo'lsa qiymat ishlatiladi. */
  summaFormula: string | null;
  summaQiymat: number | null;
  /** ФАКТ/Ф2 — serverda (`t2_qator_holat`) allaqachon har daraja uchun
   *  yig'ilgan, literal qiymat sifatida yoziladi. */
  faktHajm: number;
  faktSumma: number;
  f2Hajm: number;
  f2Summa: number;
  /** Kontekst — eng yaqin rz/bl ota nomi (izlash/filtr uchun qulay). */
  razdel: string;
  vidRabot: string;
  /** Z ustuni (yashirin) — SUMIF ota-bola aloqasini rz/bl darajasida ajratish uchun. */
  daraja: number;
}

const LEAF_TUR = new Set(['rs', 'mat', 'ob']);
/** rz/bl kabi "ota" turlar -- SUMIF orqali bevosita bolalarini yig'adi. */
const OTA_TUR = new Set(['rz', 'bl']);

/** T2 `t2_qator.kat` — CHECK constraint bilan tasdiqlangan aniq qiymatlar
 *  (`20261013090000_t2_resurs_kategoriya_registry_v1.sql`). */
const KATEGORIYA_USTUN: Record<string, number> = { 'ЧЕЛ': 0, 'МАШ': 1, 'МАТ': 2, 'ОБ': 3, 'КАБ': 4, 'М/К': 5 };
const KATEGORIYA_SONI = 6;

/**
 * `qatorlar` allaqachon `tartib` bo'yicha (hujjat tartibi -- ota har doim
 * bolasidan oldin) tartiblangan bo'lishi kerak; xavfsizlik uchun shu
 * yerda ham saralanadi. `holatlar` — `sbT2QatorHolatOl` natijasi,
 * `qator_id` bo'yicha bog'lanadi (ixtiyoriy — berilmasa FAKT/Ф2 nolga
 * tushadi).
 */
export function lrvPlusQatorlarniHisobla(qatorlar: T2Qator[], holatlar?: T2QatorHolat[]): LrvPlusQator[] {
  const rows = [...qatorlar].sort((a, b) => (a.tartib ?? 0) - (b.tartib ?? 0));
  const DATA_START = 4; // 1: obyekt nomi, 2: ustun sarlavhalari, 3: ЖАМИ, 4+: ma'lumot

  const byId = new Map<number, T2Qator>();
  for (const q of rows) byId.set(q.id, q);

  const holatById = new Map<number, T2QatorHolat>();
  if (holatlar) for (const h of holatlar) holatById.set(h.qator_id, h);

  const rowOf = new Map<number, number>();
  rows.forEach((q, i) => rowOf.set(q.id, DATA_START + i));

  /** Har bir ota (rz/bl) uchun TO'LIQ nasl oralig'i [c1,c2] (o'zidan keyingi,
   *  chuqurligi undan katta bo'lgan barcha qatorlar). SUMIF shu oraliqda
   *  ishlaydi, keyin `daraja+1` filtri orqali faqat bevosita bolalarni oladi. */
  const span = new Map<number, { c1: number; c2: number }>();
  for (let i = 0; i < rows.length; i++) {
    const daraja = rows[i].daraja ?? 0;
    let j = i + 1;
    while (j < rows.length && (rows[j].daraja ?? 0) > daraja) j++;
    if (j > i + 1) span.set(rows[i].id, { c1: DATA_START + i + 1, c2: DATA_START + j - 1 });
  }

  /** Eng yaqin ota (rz yoki bl) nomi — kontekst ustunlari uchun. */
  function ajdodNomi(q: T2Qator, turlar: Set<string>): string {
    let cur = q.ota_id != null ? byId.get(q.ota_id) : undefined;
    while (cur) {
      if (cur.tur && turlar.has(cur.tur)) return cur.nom ?? '';
      cur = cur.ota_id != null ? byId.get(cur.ota_id) : undefined;
    }
    return '';
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

    let norma: number | null = null;
    let obyomFormula: string | null = null;
    let obyomQiymat: number | null = q.hajm ?? null;
    let narx: number | null = null;
    let summaFormula: string | null = null;
    let summaQiymat: number | null = q.summa ?? null;

    if (tur === 'rs' && parent?.tur === 'bl' && parentRow != null && q.norma != null && q.norma > 0) {
      // T1 formulasi: ОБЪЁМ(rs) = НОРМА(rs) × ОБЪЁМ(ota bl).
      norma = q.norma;
      obyomFormula = `F${r}*G${parentRow}`;
    }

    if (LEAF_TUR.has(tur)) {
      narx = q.narx ?? null;
      summaFormula = `G${r}*H${r}`;
      // Keshlangan qiymat DOIM formuladan hisoblanadi (bazadagi `summa`ga
      // ishonilmaydi) -- shunda .xlsx faylni ochmasdan oldin ham (masalan
      // preview'da) ko'rsatiladigan son formulaning o'zi bilan bir xil bo'ladi.
      summaQiymat = (obyomQiymat ?? 0) * (narx ?? 0);
    } else if (OTA_TUR.has(tur)) {
      const sp = span.get(q.id);
      if (sp) summaFormula = `SUMIF($Z$${sp.c1}:$Z$${sp.c2},${daraja + 1},$I$${sp.c1}:$I$${sp.c2})`;
      else summaQiymat = 0;
    }

    out.push({
      row: r, no: i + 1, kod: q.kod ?? '', nom: q.nom ?? '', birlik: q.birlik ?? '', tur,
      kat: q.kat ?? '',
      norma, obyomFormula, obyomQiymat, narx, summaFormula, summaQiymat,
      faktHajm: h ? h.fakt_hajm : 0, faktSumma: h ? h.fakt_summa : 0,
      f2Hajm: h ? h.f2_hajm : 0, f2Summa: h ? h.f2_summa : 0,
      razdel: ajdodNomi(q, new Set(['rz'])), vidRabot: ajdodNomi(q, new Set(['bl'])),
      daraja,
    });
  }

  // Ikkinchi (TESKARI) o'tish: rz/bl'ning keshlangan SUMMASI bazadagi
  // `summa`ga emas, balki O'ZI hisoblangan bolalar yig'indisiga tayanadi --
  // shu bilan fayldagi ko'rsatiladigan son formulaning natijasi bilan
  // DOIM bir xil bo'ladi (bazadagi rollup vaqtincha eskirgan bo'lsa ham).
  // Oxiridan boshiga o'tish -- har bir ota o'z bolalarining YAKUNIY
  // (allaqachon hisoblangan) qiymatini topadi.
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

/** Butun smeta jami — ildiz (daraja=0) qatorlar (odatda rz) yig'indisi.
 *  `ustun` — qaysi ustundagi qiymatlarni yig'ish kerak (I=СУММА,
 *  P=ФАКТ СУММА va h.k.); ildiz qatorlar allaqachon o'z butun
 *  naslining to'liq yig'indisi bo'lgani uchun bu ODDIY SUMIF (butun
 *  qator oralig'ida, daraja=0 filtri bilan) — ikki marta qo'shmaydi. */
export function lrvPlusJamiFormula(qatorlar: LrvPlusQator[], ustun: string): string | null {
  if (!qatorlar.length) return null;
  const c1 = qatorlar[0].row, c2 = qatorlar[qatorlar.length - 1].row;
  return `SUMIF($Z$${c1}:$Z$${c2},0,$${ustun}$${c1}:$${ustun}$${c2})`;
}

export const LRV_PLUS_USTUNLAR = [
  '№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.', 'ТИП', 'НОРМА', 'ОБЪЁМ', 'ЦЕНА', 'СУММА',
  'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ', 'КАБ', 'М/К',
  'ФАКТ ОБЪЁМ', 'ФАКТ СУММА', 'ОСТАТКА ОБЪЁМ', 'ОСТАТКА СУММА',
  'F2 ОЛИНГАН ОБЪЁМ', 'F2 ОЛИНГАН СУММА', 'F2 ОЛИНИШИ МУМКИН ОБЪЁМ', 'F2 ОЛИНИШИ МУМКИН СУММА',
  'РАЗДЕЛ', 'ВИД РАБОТ', 'Даража',
] as const;

/** T1 `00_Config.js` `CFG.RANG`dan tasdiqlangan rang sxemasi. */
const RANG = {
  rz: { fill: { patternType: 'solid', fgColor: { rgb: 'FFFF00' } } },
  bl: { fill: { patternType: 'solid', fgColor: { rgb: '4A86E8' } }, font: { color: { rgb: 'FFFFFF' }, bold: true } },
  mat: { fill: { patternType: 'solid', fgColor: { rgb: 'D9EAD3' } } },
} as const;

/**
 * Haqiqiy .xlsx bayt oqimini quradi. `xlsx-js-style` FAQAT shu funksiya
 * chaqirilganda dinamik yuklanadi -- `xlsxReader.ts`dagi legacy .xls
 * o'qish bilan bir xil naqsh (og'ir kutubxona har sahifa yuklanishida
 * emas, faqat eksport tugmasi bosilganda kiradi).
 */
export async function lrvPlusFaylBaytlari(
  qatorlar: T2Qator[], obyektNomi: string, holatlar?: T2QatorHolat[],
): Promise<Uint8Array> {
  const hisob = lrvPlusQatorlarniHisobla(qatorlar, holatlar);
  const jamiSumma = hisob.filter((q) => q.daraja === 0).reduce((s, q) => s + (q.summaQiymat ?? 0), 0);
  const jamiFakt = hisob.filter((q) => q.daraja === 0).reduce((s, q) => s + q.faktSumma, 0);
  const jamiF2 = hisob.filter((q) => q.daraja === 0).reduce((s, q) => s + q.f2Summa, 0);

  const XLSX = await import('xlsx-js-style');
  const NCOLS = LRV_PLUS_USTUNLAR.length;

  const aoa: (string | number)[][] = [
    [obyektNomi || 'Smeta'],
    [...LRV_PLUS_USTUNLAR],
    Array.from({ length: NCOLS }, () => '' as string | number),
  ];
  aoa[2][2] = 'ЖАМИ';
  aoa[2][8] = jamiSumma; // I — СУММА
  aoa[2][16] = jamiFakt; // Q — ФАКТ СУММА
  aoa[2][20] = jamiF2; // U — F2 ОЛИНГАН СУММА

  for (const q of hisob) {
    const ostatkaHajm = (q.obyomQiymat ?? 0) - q.faktHajm;
    const ostatkaSumma = (q.summaQiymat ?? 0) - q.faktSumma;
    const f2MumkinHajm = q.faktHajm - q.f2Hajm;
    const f2MumkinSumma = q.faktSumma - q.f2Summa;
    const katIdx = KATEGORIYA_USTUN[q.kat];
    const katVal = LEAF_TUR.has(q.tur) && katIdx != null ? (q.summaQiymat ?? 0) : '';
    const kat: (string | number)[] = Array.from({ length: KATEGORIYA_SONI }, () => '');
    if (LEAF_TUR.has(q.tur) && katIdx != null) kat[katIdx] = katVal;

    aoa.push([
      q.no, q.kod, q.nom, q.birlik, q.tur,
      q.norma ?? '',
      q.obyomFormula ? (q.obyomQiymat ?? 0) : (q.obyomQiymat ?? ''),
      q.narx ?? '',
      q.summaFormula ? (q.summaQiymat ?? 0) : (q.summaQiymat ?? ''),
      ...kat,
      q.faktHajm, q.faktSumma,
      ostatkaHajm, ostatkaSumma,
      q.f2Hajm, q.f2Summa,
      f2MumkinHajm, f2MumkinSumma,
      q.razdel, q.vidRabot,
      q.daraja,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const q of hisob) {
    if (q.obyomFormula) ws[`G${q.row}`] = { t: 'n', f: q.obyomFormula, v: q.obyomQiymat ?? 0 };
    if (q.summaFormula) ws[`I${q.row}`] = { t: 'n', f: q.summaFormula, v: q.summaQiymat ?? 0 };
    // T1 haqiqiy formulasi: R(ОСТАТКА)=E(smeta)-Q(fakt), T(ОСТАТКА Ф2)=Q(fakt)-S(f2 olingan).
    ws[`R${q.row}`] = { t: 'n', f: `G${q.row}-P${q.row}`, v: (q.obyomQiymat ?? 0) - q.faktHajm };
    ws[`S${q.row}`] = { t: 'n', f: `I${q.row}-Q${q.row}`, v: (q.summaQiymat ?? 0) - q.faktSumma };
    ws[`V${q.row}`] = { t: 'n', f: `P${q.row}-T${q.row}`, v: q.faktHajm - q.f2Hajm };
    ws[`W${q.row}`] = { t: 'n', f: `Q${q.row}-U${q.row}`, v: q.faktSumma - q.f2Summa };
  }
  /* ЖАМИ qatori HAR BIR pul ustuni uchun -- egasi butun obyekt nazorat
     ostidaligini bitta qatordan ko'rishi kerak. Hajm ustunlari
     yig'ilmaydi: turli birliklarni (М3, ШТ, ЧЕЛ-Ч) qo'shish ma'nosiz. */
  const jamiOstatka = jamiSumma - jamiFakt;
  const jamiF2Mumkin = jamiFakt - jamiF2;
  for (const [ustun, katak, qiymat] of [
    ['I', 'I3', jamiSumma], ['Q', 'Q3', jamiFakt], ['S', 'S3', jamiOstatka],
    ['U', 'U3', jamiF2], ['W', 'W3', jamiF2Mumkin],
  ] as Array<[string, string, number]>) {
    const f = lrvPlusJamiFormula(hisob, ustun);
    if (f) ws[katak] = { t: 'n', f, v: qiymat };
  }
  if (hisob.length) {
    const c1 = hisob[0].row, c2 = hisob[hisob.length - 1].row;
    for (const col of ['J', 'K', 'L', 'M', 'N', 'O']) ws[`${col}3`] = { t: 'n', f: `SUM(${col}${c1}:${col}${c2})`, v: 0 };
  }

  // Rang: T1'ning CFG.RANG sxemasi — rz=sariq, bl=ko'k+oq shrift, mat=yashil.
  for (const q of hisob) {
    const style = RANG[q.tur as keyof typeof RANG];
    if (!style) continue;
    for (let c = 0; c < NCOLS; c++) {
      const ref = XLSX.utils.encode_cell({ r: q.row - 1, c });
      const cell = ws[ref];
      if (cell) cell.s = style;
    }
  }
  // Sarlavha va ЖАМИ qatorlarini ham ajratib ko'rsatish.
  for (let c = 0; c < NCOLS; c++) {
    const header = ws[XLSX.utils.encode_cell({ r: 1, c })];
    if (header) header.s = { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'EFEFEF' } } };
    const jami = ws[XLSX.utils.encode_cell({ r: 2, c })];
    if (jami) jami.s = { font: { bold: true } };
  }

  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 42 }, { wch: 9 }, { wch: 6 }, { wch: 8 },
    { wch: 11 }, { wch: 11 }, { wch: 13 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 },
    { wch: 11 }, { wch: 13 }, { wch: 11 }, { wch: 13 },
    { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 15 },
    { wch: 22 }, { wch: 22 },
    { wch: 7, hidden: true },
  ];

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
