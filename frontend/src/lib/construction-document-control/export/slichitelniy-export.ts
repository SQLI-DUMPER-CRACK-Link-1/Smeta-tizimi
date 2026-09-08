import ExcelJS from 'exceljs';
import { type ProgressLineResult } from '../types';

export type SlichitelniyHolat = 'mos' | 'farq' | 'noaniq';

export interface SlichitelniyExportOptions {
  projectName: string;
  objectName: string;
  periodLabel: string;
  documentNumber: string;
}

export interface SlichitelniyQator {
  /** Qator raqami emas: barqaror kanonik satr identifikatori. */
  lineId: string;
  description: string;
  unit: string;
  smetaLimitQuantity: number | null;
  approvedF2Quantity: number;
  quantityDifference: number | null;
  smetaControlValue: number | null;
  approvedF2SourceAmount: number | null;
  amountDifference: number | null;
  holat: SlichitelniyHolat;
  evidence: string;
  decision: 'MOS' | 'OCHIQ';
}

const pul = (qiymat: number): number => Math.round((qiymat + Number.EPSILON) * 100) / 100;
const farq = (a: number | null, b: number | null): number | null => a === null || b === null ? null : pul(a - b);

/**
 * TPL-08 ichki slichitelniy proyeksiyasi.
 *
 * A manba — tasdiqlangan o'zgarishlar qo'shilgan smeta limiti;
 * B manba — tasdiqlangan F2ning muzlatilgan hajmi va original summasi.
 * Bu funksiya hech bir qatorni "to'g'rilamaydi" va qator indeksiga tayanmaydi.
 */
export function slichitelniyQatorlariQur(rows: readonly ProgressLineResult[]): SlichitelniyQator[] {
  return rows.map((row) => {
    const smetaControlValue = row.approvedEntitlementQuantity === null || row.baselineReferencePrice === null
      ? null
      : pul(row.approvedEntitlementQuantity * row.baselineReferencePrice);
    const quantityDifference = farq(row.approvedEntitlementQuantity, row.cumulativeQuantity);
    const amountDifference = farq(smetaControlValue, row.cumulativeCertifiedValue);
    const holat: SlichitelniyHolat = quantityDifference === null || amountDifference === null
      ? 'noaniq'
      : Math.abs(quantityDifference) <= 0.000001 && Math.abs(amountDifference) <= 0.01
        ? 'mos'
        : 'farq';

    return {
      lineId: row.lineId,
      description: row.description,
      unit: row.unit,
      smetaLimitQuantity: row.approvedEntitlementQuantity,
      approvedF2Quantity: row.cumulativeQuantity,
      quantityDifference,
      smetaControlValue,
      approvedF2SourceAmount: row.cumulativeCertifiedValue,
      amountDifference,
      holat,
      evidence: row.revisionIds.length ? row.revisionIds.join(', ') : 'NOANIQ',
      decision: holat === 'mos' ? 'MOS' : 'OCHIQ',
    };
  });
}

const excelQiymat = (qiymat: number | null) => qiymat === null ? 'NOANIQ' : qiymat;
const holatMatni: Record<SlichitelniyHolat, string> = { mos: 'MOS', farq: 'FARQ', noaniq: 'NOANIQ' };

export async function generateSlichitelniy(
  rows: readonly ProgressLineResult[],
  options: SlichitelniyExportOptions,
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smeta tizimi';
  const worksheet = workbook.addWorksheet('Slichitelnaya vedomost');
  const lastColumn = 'L';

  worksheet.mergeCells(`A1:${lastColumn}1`);
  const title = worksheet.getCell('A1');
  title.value = `Slichitelnaya vedomost — smeta limiti va tasdiqlangan F2 (${options.periodLabel})`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: 'center' };
  worksheet.mergeCells(`A2:${lastColumn}2`);
  worksheet.getCell('A2').value = `Obyekt: ${options.projectName} — ${options.objectName}`;
  worksheet.mergeCells(`A3:${lastColumn}3`);
  worksheet.getCell('A3').value = `Hujjat raqami: ${options.documentNumber}. Ichki reconciliation: farq avtomatik tuzatilmaydi.`;
  worksheet.mergeCells(`A4:${lastColumn}4`);
  worksheet.getCell('A4').value = 'A manba: smeta limiti (bazaviy + tasdiqlangan o‘zgarish). B manba: tasdiqlangan F2 muzlatilgan qiymati.';
  worksheet.getCell('A4').font = { italic: true, color: { argb: 'FF64748B' } };
  worksheet.addRow([]);

  const header = worksheet.addRow([
    'Taqqoslash kaliti', 'Ish / resurs', 'Birlik',
    'A: smeta limiti (hajm)', 'B: tasdiqlangan F2 (hajm)', 'Hajm farqi',
    'A: smeta nazorat summasi', 'B: F2 manba summasi', 'Summa farqi',
    'Holat', 'Dalil / reviziya', 'Qaror',
  ]);
  header.font = { bold: true };
  header.eachCell((cell) => {
    cell.border = border();
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });

  for (const row of slichitelniyQatorlariQur(rows)) {
    const data = worksheet.addRow([
      row.lineId, row.description, row.unit,
      excelQiymat(row.smetaLimitQuantity), row.approvedF2Quantity, excelQiymat(row.quantityDifference),
      excelQiymat(row.smetaControlValue), excelQiymat(row.approvedF2SourceAmount), excelQiymat(row.amountDifference),
      holatMatni[row.holat], row.evidence, row.decision,
    ]);
    data.eachCell((cell, index) => {
      cell.border = border();
      if (index >= 4 && index <= 9 && typeof cell.value === 'number') cell.numFmt = '#,##0.00';
      if (cell.value === 'NOANIQ') cell.font = { color: { argb: 'FFB45309' }, italic: true };
    });
    if (row.holat === 'farq') data.getCell(10).font = { bold: true, color: { argb: 'FFDC2626' } };
    if (row.holat === 'noaniq') data.getCell(10).font = { bold: true, color: { argb: 'FFB45309' } };
  }

  worksheet.getColumn(1).width = 24;
  worksheet.getColumn(2).width = 42;
  worksheet.getColumn(3).width = 10;
  for (let i = 4; i <= 9; i++) worksheet.getColumn(i).width = 18;
  worksheet.getColumn(10).width = 12;
  worksheet.getColumn(11).width = 28;
  worksheet.getColumn(12).width = 12;
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

function border(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' },
  };
}
