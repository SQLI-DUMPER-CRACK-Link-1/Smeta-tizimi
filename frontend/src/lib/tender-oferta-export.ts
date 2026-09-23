import type { BookType, CellObject, WorkSheet } from 'xlsx-js-style';
import type { OfertaNarxSozlamasi, OfertaQatorNatija } from './tender-oferta';
import type { OfertaSheetTahlili } from './tender-oferta-parser';

export type OfertaEksportInput = {
  obyektNomi?: string;
  manbaFaylNomi: string;
  manbaBytes: ArrayBuffer | Uint8Array;
  tanlanganVaraqlar: readonly string[];
  tahlillar: readonly OfertaSheetTahlili[];
  sozlama: OfertaNarxSozlamasi;
  qatorlar: readonly OfertaQatorNatija[];
};

const NUM_FMT = '#,##0.00;[Red]-#,##0.00;–';
const HEADER_FILL = { patternType: 'solid', fgColor: { rgb: '1F4E79' } };
const INPUT_FILL = { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } };
const RESULT_FILL = { patternType: 'solid', fgColor: { rgb: 'E2F0D9' } };
const TOTAL_FILL = { patternType: 'solid', fgColor: { rgb: 'D9EAF7' } };

function safeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'resurs';
}

function extension(name: string): string {
  const match = name.match(/\.(xlsx|xlsm|xls)$/i);
  return (match?.[1] ?? 'xlsx').toLowerCase();
}

function outputBookType(name: string): BookType {
  const ext = extension(name);
  if (ext === 'xls') return 'biff8';
  return ext as BookType;
}

function cellAddress(row: number, col: number): string {
  const letters: string[] = [];
  let n = col + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters.unshift(String.fromCharCode(65 + rem));
    n = Math.floor((n - 1) / 26);
  }
  return `${letters.join('')}${row + 1}`;
}

function asCell(value: unknown): CellObject | undefined {
  if (!value || typeof value !== 'object') return undefined;
  return value as CellObject;
}

function styleOf(ws: WorkSheet, row: number, col: number): Record<string, unknown> {
  const cell = asCell(ws[cellAddress(row, col)]);
  return cell?.s && typeof cell.s === 'object' ? { ...(cell.s as Record<string, unknown>) } : {};
}

function styleWithFill(ws: WorkSheet, row: number, col: number, fill: Record<string, unknown>): Record<string, unknown> {
  return { ...styleOf(ws, row, col), fill };
}

function writeText(ws: WorkSheet, row: number, col: number, value: string, style: Record<string, unknown>): void {
  ws[cellAddress(row, col)] = { t: 's', v: value, s: style };
}

function writeNumber(ws: WorkSheet, row: number, col: number, value: number | null, style: Record<string, unknown>, formula?: string): void {
  if (value == null || !Number.isFinite(value)) return;
  ws[cellAddress(row, col)] = { t: 'n', v: value, s: style, z: NUM_FMT, ...(formula ? { f: formula } : {}) } as CellObject;
}

function isLeaf(qator: OfertaQatorNatija): boolean {
  return qator.turi === 'resurs' || qator.turi === 'sklad_xarajati' || qator.turi === 'transport_xarajati';
}

function childRows(qator: OfertaQatorNatija, rows: readonly OfertaQatorNatija[]): OfertaQatorNatija[] {
  const candidates = qator.jamiQamrovi === 'varaq'
    ? rows.filter((candidate) => candidate.sourceSheet === qator.sourceSheet && isLeaf(candidate))
    : rows.filter((candidate) => candidate.blokKaliti === qator.blokKaliti && isLeaf(candidate));
  return candidates.filter((candidate) => candidate.sourceRow < qator.sourceRow || qator.jamiQamrovi === 'varaq');
}

function sourceTotalFormula(qator: OfertaQatorNatija, sozlama: OfertaNarxSozlamasi): string | undefined {
  if (qator.manbaSummaUstuni == null || qator.manbaSummaUstuni < 0 || sozlama.rejim !== 'foiz') return undefined;
  const source = cellAddress(qator.sourceRow - 1, qator.manbaSummaUstuni);
  const percent = Number(sozlama.foiz ?? 0);
  if (!Number.isFinite(percent) || percent < 0) return undefined;
  return `${source}*(1${sozlama.yon === 'oshirish' ? '+' : '-'}${percent}/100)`;
}

function quantityFormula(qator: OfertaQatorNatija, priceCol: number): string | undefined {
  if (qator.hisobTuri !== 'birlik' || qator.manbaHajmUstuni == null || qator.manbaHajmUstuni < 0 || qator.hajm == null) return undefined;
  return `${cellAddress(qator.sourceRow - 1, qator.manbaHajmUstuni)}*${cellAddress(qator.sourceRow - 1, priceCol)}`;
}

function subtotalFormula(qator: OfertaQatorNatija, rows: readonly OfertaQatorNatija[], resultCol: number): string | undefined {
  const children = childRows(qator, rows);
  if (!children.length || children.length > 300) return undefined;
  const refs = children.map((child) => cellAddress(child.sourceRow - 1, resultCol));
  return `SUM(${refs.join(',')})`;
}

function extendRef(ws: WorkSheet, maxCol: number): void {
  const ref = typeof ws['!ref'] === 'string' ? ws['!ref'] : 'A1:A1';
  const decoded = ref.split(':');
  const end = decoded[decoded.length - 1].match(/^([A-Z]+)(\d+)$/i);
  if (!end) return;
  let col = 0;
  for (const char of end[1].toUpperCase()) col = col * 26 + char.charCodeAt(0) - 64;
  col -= 1;
  const row = Number(end[2]) - 1;
  const newEnd = cellAddress(row, Math.max(col, maxCol));
  ws['!ref'] = `${decoded[0]}:${newEnd}`;
}

function appendColumns(ws: WorkSheet, columns: number): void {
  const current = Array.isArray(ws['!cols']) ? [...ws['!cols']] : [];
  current[columns] = { ...(current[columns] || {}), wch: 21 };
  current[columns + 1] = { ...(current[columns + 1] || {}), wch: 22 };
  ws['!cols'] = current;
}

function modifySheet(
  ws: WorkSheet,
  analysis: OfertaSheetTahlili,
  rows: readonly OfertaQatorNatija[],
  sozlama: OfertaNarxSozlamasi,
): void {
  const usedRef = typeof ws['!ref'] === 'string' ? ws['!ref'] : 'A1:A1';
  const rangeEnd = usedRef.split(':').at(-1)?.match(/^([A-Z]+)\d+$/i);
  if (!rangeEnd || !analysis.ustunlar) return;
  let maxCol = 0;
  for (const char of rangeEnd[1].toUpperCase()) maxCol = maxCol * 26 + char.charCodeAt(0) - 64;
  maxCol -= 1;
  const priceCol = maxCol + 1;
  const resultCol = maxCol + 2;
  const headerRow = analysis.ustunlar.sarlavhaBoshlanishi;
  const headerBase = Math.max(0, maxCol);
  writeText(ws, headerRow, priceCol, 'Pudratchi birlik narxi', styleWithFill(ws, headerRow, headerBase, HEADER_FILL));
  writeText(ws, headerRow, resultCol, 'Pudratchi taklif summasi', styleWithFill(ws, headerRow, headerBase, HEADER_FILL));

  const sameSheet = rows.filter((qator) => qator.sourceSheet === analysis.nom);
  for (const qator of sameSheet) {
    const row = qator.sourceRow - 1;
    const originalStyle = styleOf(ws, row, headerBase);
    if (qator.turi === 'bolim') continue;
    if (qator.turi === 'jami') {
      const totalStyle = { ...originalStyle, fill: TOTAL_FILL };
      const formula = subtotalFormula(qator, sameSheet, resultCol);
      writeNumber(ws, row, resultCol, qator.pudratchiSumma, totalStyle, formula);
      continue;
    }
    const inputStyle = { ...originalStyle, fill: INPUT_FILL };
    const resultStyle = { ...originalStyle, fill: RESULT_FILL };
    if (qator.pudratchiBirlikNarx != null) writeNumber(ws, row, priceCol, qator.pudratchiBirlikNarx, inputStyle);
    const formula = qator.hisobTuri === 'manba_jami'
      ? sourceTotalFormula(qator, sozlama)
      : quantityFormula(qator, priceCol);
    writeNumber(ws, row, resultCol, qator.pudratchiSumma, resultStyle, formula);
  }
  appendColumns(ws, priceCol);
  extendRef(ws, resultCol);
}

/**
 * Manba RES/ABC/TN workbookini yangi jadvalga ko'chirmaydi. Shu workbookning
 * barcha mavjud varaqlari saqlanadi va faqat tanlangan RES/transport varaqlariga
 * oxiridan ikkita oferta ustuni qo'shiladi. LRV, yordamchi va boshqa varaqlar
 * o'zgarmaydi.
 */
export async function tenderOfertaXlsx(input: OfertaEksportInput): Promise<Uint8Array> {
  const XLSX = await import('xlsx-js-style');
  const bytes = input.manbaBytes instanceof Uint8Array ? input.manbaBytes : new Uint8Array(input.manbaBytes);
  const workbook = XLSX.read(bytes, { type: 'array', cellStyles: true, cellNF: true, cellFormula: true, bookVBA: true });
  const selected = new Set(input.tanlanganVaraqlar);
  for (const analysis of input.tahlillar) {
    if (!selected.has(analysis.nom) || (analysis.role !== 'res' && analysis.role !== 'transport')) continue;
    if (analysis.alternativVaraq && selected.has(analysis.alternativVaraq)) continue;
    const sheet = workbook.Sheets[analysis.nom];
    if (sheet) modifySheet(sheet, analysis, input.qatorlar, input.sozlama);
  }
  const output = XLSX.write(workbook, { type: 'array', bookType: outputBookType(input.manbaFaylNomi), cellStyles: true, bookVBA: true });
  return output instanceof Uint8Array ? output : new Uint8Array(output as ArrayBuffer);
}

export function ofertaFaylNomi(manbaFaylNomi?: string): string {
  const source = safeFilePart(manbaFaylNomi || 'resurs.xlsx');
  const match = source.match(/\.(xlsx|xlsm|xls)$/i);
  const stem = match ? source.slice(0, -match[0].length) : source;
  const ext = match?.[1].toLowerCase() ?? 'xlsx';
  return `${stem}_OFERTA.${ext}`;
}
