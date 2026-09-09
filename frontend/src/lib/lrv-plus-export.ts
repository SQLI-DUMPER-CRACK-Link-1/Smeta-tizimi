/**
 * lrv-plus-export.ts — T2-LRV-PLUS-EXPORT-001: T1'ning LRV_PLUS Google
 * Sheets faylidagi FORMULA (norma -> hajm -> summa kaskadi) xatti-
 * harakatini haqiqiy .xlsx faylga ko'chiradi. Owner talabi so'zma-so'z:
 * "bl dagi obyomni o'zgartirsam resurs rs lar ham o'zgarishi kerak,
 * obyomga qarab summalar ham o'zgarishi kerak" -- Excelning o'zida,
 * ilovasiz ham.
 *
 * T1'ning haqiqiy formulasi (`Smeta tizimi/10_Engine.js` `_ishlaVaraq`,
 * `00_Config.js` `CFG.C`dan tasdiqlangan):
 *   rs (ishga bog'langan resurs): ОБЪЁМ = НОРМА(shu qator) × ОБЪЁМ(ota bl)
 *   rs/mat/ob:                    СУММА = ОБЪЁМ × ЦЕНА
 *   bl:                           СУММА = SUM(bevosita bolalar SUMMASI)
 *   rz:                           СУММА = SUM(bevosita bolalar SUMMASI)
 * "bevosita bolalar" rz uchun MUHIM: rz ostidagi rs qatorlar bl ichiga
 * allaqachon yig'ilgan -- ularni ikkinchi marta qo'shib yubormaslik uchun
 * yashirin "Даража" (daraja/chuqurlik) ustuni orqali SUMIF bilan FAQAT
 * bir chuqurlik pastdagi qatorlar yig'iladi (T1'da xuddi shu vazifani
 * MARKER ustuni bajaradi).
 *
 * Bu modul ATAYLAB ikkiga bo'lingan:
 *   - `lrvPlusQatorlarniHisobla` — sof funksiya, xlsx kutubxonasisiz test
 *     qilinadi (formulalar/qiymatlar TO'G'RI ekanini tekshirish uchun).
 *   - `lrvPlusFaylBaytlari` / `lrvPlusYuklab` — SheetJS'ni FAQAT shu
 *     eksport tugmasi bosilganda dinamik import qiladi (`xlsxReader.ts`
 *     dagi legacy .xls o'qish bilan bir xil naqsh) -- har bir sahifa
 *     yuklanishida og'ir kutubxona yuklanmasin.
 */
import type { T2Qator } from '../api/supabase';

export interface LrvPlusQator {
  /** 1-indeksli chiqish (sheet) qatori. */
  row: number;
  no: number;
  kod: string;
  nom: string;
  birlik: string;
  tur: string;
  /** E ustuni — faqat bl ota ostidagi rs uchun sarf normasi. */
  norma: number | null;
  /** F ustuni — formula bo'lsa (norma bilan bog'langan rs), '=' siz matn. */
  obyomFormula: string | null;
  /** F ustunidagi joriy/keshlangan qiymat (formula bo'lsa ham ko'rsatish uchun). */
  obyomQiymat: number | null;
  /** G ustuni — birlik narxi (faqat rs/mat/ob barglarida). */
  narx: number | null;
  /** H ustuni — formula ('=' siz matn), bo'sh bo'lsa qiymat ishlatiladi. */
  summaFormula: string | null;
  summaQiymat: number | null;
  /** I ustuni (yashirin) — SUMIF ota-bola aloqasini rz/bl darajasida ajratish uchun. */
  daraja: number;
}

const LEAF_TUR = new Set(['rs', 'mat', 'ob']);
/** rz/bl kabi "ota" turlar -- SUMIF orqali bevosita bolalarini yig'adi. */
const OTA_TUR = new Set(['rz', 'bl']);

/**
 * `qatorlar` allaqachon `tartib` bo'yicha (hujjat tartibi -- ota har doim
 * bolasidan oldin) tartiblangan bo'lishi kerak; xavfsizlik uchun shu
 * yerda ham saralanadi.
 */
export function lrvPlusQatorlarniHisobla(qatorlar: T2Qator[]): LrvPlusQator[] {
  const rows = [...qatorlar].sort((a, b) => (a.tartib ?? 0) - (b.tartib ?? 0));
  const DATA_START = 4; // 1: obyekt nomi, 2: ustun sarlavhalari, 3: ЖАМИ, 4+: ma'lumot

  const byId = new Map<number, T2Qator>();
  for (const q of rows) byId.set(q.id, q);

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

  const out: LrvPlusQator[] = [];
  for (let i = 0; i < rows.length; i++) {
    const q = rows[i];
    const r = DATA_START + i;
    const daraja = q.daraja ?? 0;
    const tur = q.tur ?? '';
    const parent = q.ota_id != null ? byId.get(q.ota_id) : undefined;
    const parentRow = q.ota_id != null ? rowOf.get(q.ota_id) : undefined;

    let norma: number | null = null;
    let obyomFormula: string | null = null;
    let obyomQiymat: number | null = q.hajm ?? null;
    let narx: number | null = null;
    let summaFormula: string | null = null;
    let summaQiymat: number | null = q.summa ?? null;

    if (tur === 'rs' && parent?.tur === 'bl' && parentRow != null && q.norma != null && q.norma > 0) {
      // T1 formulasi: ОБЪЁМ(rs) = НОРМА(rs) × ОБЪЁМ(ota bl).
      norma = q.norma;
      obyomFormula = `E${r}*F${parentRow}`;
    }

    if (LEAF_TUR.has(tur)) {
      narx = q.narx ?? null;
      summaFormula = `F${r}*G${r}`;
      // Keshlangan qiymat DOIM formuladan hisoblanadi (bazadagi `summa`ga
      // ishonilmaydi) -- shunda .xlsx faylni ochmasdan oldin ham (masalan
      // preview'da) ko'rsatiladigan son formulaning o'zi bilan bir xil bo'ladi.
      summaQiymat = (obyomQiymat ?? 0) * (narx ?? 0);
    } else if (OTA_TUR.has(tur)) {
      const sp = span.get(q.id);
      if (sp) summaFormula = `SUMIF($I$${sp.c1}:$I$${sp.c2},${daraja + 1},$H$${sp.c1}:$H$${sp.c2})`;
      else summaQiymat = 0;
    }

    out.push({
      row: r, no: i + 1, kod: q.kod ?? '', nom: q.nom ?? '', birlik: q.birlik ?? '', tur,
      norma, obyomFormula, obyomQiymat, narx, summaFormula, summaQiymat, daraja,
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

/** Butun smeta jami — ildiz (daraja=0) qatorlar (odatda rz) yig'indisi. */
export function lrvPlusJamiFormula(qatorlar: LrvPlusQator[]): string | null {
  if (!qatorlar.length) return null;
  const c1 = qatorlar[0].row, c2 = qatorlar[qatorlar.length - 1].row;
  return `SUMIF($I$${c1}:$I$${c2},0,$H$${c1}:$H$${c2})`;
}

export const LRV_PLUS_USTUNLAR = ['№', 'Шифр', 'Наименование', 'Ед.изм', 'Норма', 'Объём', 'Цена', 'Сумма', 'Даража'] as const;

/**
 * Haqiqiy .xlsx bayt oqimini quradi. `xlsx` (SheetJS) FAQAT shu funksiya
 * chaqirilganda dinamik yuklanadi -- `xlsxReader.ts`dagi legacy .xls
 * o'qish bilan bir xil naqsh (og'ir kutubxona har sahifa yuklanishida
 * emas, faqat eksport tugmasi bosilganda kiradi).
 */
export async function lrvPlusFaylBaytlari(qatorlar: T2Qator[], obyektNomi: string): Promise<Uint8Array> {
  const hisob = lrvPlusQatorlarniHisobla(qatorlar);
  const jamiFormula = lrvPlusJamiFormula(hisob);
  const jamiQiymat = hisob.filter((q) => q.daraja === 0).reduce((s, q) => s + (q.summaQiymat ?? 0), 0);

  const XLSX = await import('xlsx');
  const aoa: (string | number)[][] = [
    [obyektNomi || 'Smeta'],
    [...LRV_PLUS_USTUNLAR],
    ['', '', 'ЖАМИ', '', '', '', '', jamiQiymat, ''],
  ];
  for (const q of hisob) {
    aoa.push([
      q.no, q.kod, q.nom, q.birlik,
      q.norma ?? '',
      q.obyomFormula ? (q.obyomQiymat ?? 0) : (q.obyomQiymat ?? ''),
      q.narx ?? '',
      q.summaFormula ? (q.summaQiymat ?? 0) : (q.summaQiymat ?? ''),
      q.daraja,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const q of hisob) {
    if (q.obyomFormula) ws[`F${q.row}`] = { t: 'n', f: q.obyomFormula, v: q.obyomQiymat ?? 0 };
    if (q.summaFormula) ws[`H${q.row}`] = { t: 'n', f: q.summaFormula, v: q.summaQiymat ?? 0 };
  }
  if (jamiFormula) ws['H3'] = { t: 'n', f: jamiFormula, v: jamiQiymat };
  ws['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 48 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 7, hidden: true },
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
