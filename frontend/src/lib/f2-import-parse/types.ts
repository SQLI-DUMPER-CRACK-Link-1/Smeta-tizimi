import type { AktNode } from '../f2-match-engine';

/** A raw spreadsheet cell as GAS's `Range.getValues()` would hand it back. */
export type CellValue = string | number | null | undefined;
export type SheetGrid = CellValue[][];

export interface F2ColumnConfig {
  kod: number;
  nom: number;
  bir: number;
  norma: number;
  obyom: number;
  narx: number;
  sum: number;
}

/** `apiF2FaylOqi`'s "no colConfig yet" response — the auto-detected column
 * guess plus a data preview, for a column-mapping confirmation UI. */
export interface F2PreviewResult {
  ok: true;
  mode: 'config';
  hasMarker: boolean;
  cols: F2ColumnConfig;
  maxCol: number;
  preview: Array<{ r: number; cells: string[]; mk: string }>;
  hdrQator: number;
  /** Hajm/narx/summa ustunlari qanday isbotlandi (sarlavha yoki ma'lumot arifmetikasi). */
  ustunDalil?: { qoida: 'sarlavha' | 'arifmetika'; ishonch: 'yuqori' | 'orta' | 'past'; izoh: string };
  /** PTO qo'shgan, xaritaga kirmagan ustunlar — o'qilmaydi, operatorga ko'rsatiladi. */
  qoshimchaUstunlar?: Array<{ ustun: number; sarlavha: string }>;
}

/** `apiF2FaylOqi`'s "colConfig given" response — the built act tree. */
export interface F2TreeResult {
  ok: true;
  tree: AktNode[];
}

export type F2FaylOqiCoreResult = F2PreviewResult | F2TreeResult;
