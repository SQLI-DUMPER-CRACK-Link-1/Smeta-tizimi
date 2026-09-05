import ExcelJS from 'exceljs';
import { type ProgressLineResult } from '../types';

export interface Forma2ExportOptions {
  projectName: string;
  objectName: string;
  periodLabel: string;
  documentNumber: string;
  contractNumber?: string;
}

export async function generateForma2(
  rows: readonly ProgressLineResult[],
  options: Forma2ExportOptions
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smeta tizimi';
  const worksheet = workbook.addWorksheet('Forma-2');

  // Header meta
  worksheet.mergeCells('A1', 'I1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Bajarilgan ishlar dalolatnomasi (Forma-2)`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  worksheet.getCell('A2').value = `Obyekt: ${options.projectName} - ${options.objectName}`;
  worksheet.getCell('A3').value = `Hujjat raqami: ${options.documentNumber}`;
  worksheet.getCell('A4').value = `Shartnoma: ${options.contractNumber ?? 'Noma\'lum'}`;
  worksheet.getCell('A5').value = `Davr: ${options.periodLabel}`;
  
  for(let i=2; i<=5; i++) {
    worksheet.mergeCells(`A${i}`, `I${i}`);
  }

  worksheet.addRow([]); // empty row

  // Table headers (TPL-06)
  const headerRow1 = worksheet.addRow([
    'T/r',
    'Ishlar nomi',
    'Birlik',
    'Birlik narxi',
    'Joriy oy miqdori',
    'Sertifikatlangan summa (original)',
    'Hisoblangan summa',
    'Farq',
    'Oldingi miqdor',
    'Jami miqdor'
  ]);

  headerRow1.font = { bold: true };
  headerRow1.eachCell((cell) => {
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });

  // Data rows
  let index = 1;
  let totalSertSum = 0;
  let totalHisobSum = 0;

  rows.forEach((row) => {
    // Only output rows that have current quantity or value (F-2 is for current period)
    if (row.currentQuantity === 0 && !row.currentCertifiedValue) return;

    const certVal = row.currentCertifiedValue ?? 0;
    const calcVal = row.f2ValuationValue ?? 0;

    totalSertSum += certVal;
    totalHisobSum += calcVal;

    const dataRow = worksheet.addRow([
      index++,
      row.description,
      row.unit,
      row.currentF2ValuationPrice ?? 0,
      row.currentQuantity,
      certVal,
      calcVal,
      row.variance ?? 0,
      row.previousQuantity,
      row.cumulativeQuantity
    ]);

    dataRow.eachCell((cell, colNumber) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      if (colNumber >= 4 && colNumber <= 10) cell.numFmt = '#,##0.00';
    });

    if ((row.variance && Math.abs(row.variance) > 0.01) || row.warnings.includes('PRICE_VARIANCE')) {
      dataRow.getCell(8).font = { color: { argb: 'FFFF0000' }, bold: true };
    }
  });

  // Footer totals
  const totalRow = worksheet.addRow([
    '', 'JAMI JORIY OY UCHUN:', '', '', '',
    totalSertSum, totalHisobSum, totalSertSum - totalHisobSum, '', ''
  ]);
  totalRow.font = { bold: true };
  totalRow.eachCell((cell, colNumber) => {
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    if (colNumber >= 6 && colNumber <= 8) cell.numFmt = '#,##0.00';
  });
  worksheet.mergeCells(`B${totalRow.number}`, `E${totalRow.number}`);
  totalRow.getCell(2).alignment = { horizontal: 'right' };

  // Adjust column widths
  worksheet.getColumn(1).width = 5;
  worksheet.getColumn(2).width = 45;
  worksheet.getColumn(3).width = 10;
  for (let i = 4; i <= 10; i++) {
    worksheet.getColumn(i).width = 15;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
