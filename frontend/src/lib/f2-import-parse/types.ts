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
}

/** `apiF2FaylOqi`'s "colConfig given" response — the built act tree. */
export interface F2TreeResult {
  ok: true;
  tree: AktNode[];
}

export type F2FaylOqiCoreResult = F2PreviewResult | F2TreeResult;
