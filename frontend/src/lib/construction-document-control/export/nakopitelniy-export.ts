import ExcelJS from 'exceljs';
import { type ProgressLineResult } from '../types';
import { nakopitelniyHolat } from '../calculation';

export interface NakopitelniyExportOptions {
  projectName: string;
  objectName: string;
  periodLabel: string;
  documentNumber: string;
}

export async function generateNakopitelniy(
  rows: readonly ProgressLineResult[],
  options: NakopitelniyExportOptions
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Smeta tizimi';
  const worksheet = workbook.addWorksheet('Nakopitelnaya vedomost');

  // Header meta
  worksheet.mergeCells('A1', 'K1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = `Nakopitelnaya vedomost (Davr: ${options.periodLabel})`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  worksheet.mergeCells('A2', 'K2');
  worksheet.getCell('A2').value = `Obyekt: ${options.projectName} - ${options.objectName}`;
  worksheet.getCell('A2').font = { italic: true };
  
  worksheet.mergeCells('A3', 'K3');
  worksheet.getCell('A3').value = `Hujjat raqami: ${options.documentNumber}`;

  worksheet.addRow([]); // empty row

  // Table headers (TPL-07)
  const headerRow = worksheet.addRow([
    'Smeta satri',
    'Birlik',
    'Bazaviy hajm',
    'Tasdiqlangan o\'zgarish',
    'Jami limit',
    'Oldingi tasdiqlangan F-2',
    'Joriy F-2',
    'Jami F-2',
    'Qoldiq',
    'Sertifikatlangan summa',
    'Holat'
  ]);

  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    cell.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });

  // Check mismatch
  const mismatchRows = rows.filter(r => r.warnings.includes('NAKOPITELNIY_MISMATCH'));
  if (mismatchRows.length > 0) {
    worksheet.insertRow(5, ['DIQQAT: Nakopitelniy Mismatch xatosi topildi! Ba\'zi qatorlarda summalash to\'g\'ri kelmayapti.']);
    const alertRow = worksheet.getRow(5);
    alertRow.font = { color: { argb: 'FFFF0000' }, bold: true };
    worksheet.mergeCells('A5', 'K5');
  }

  // Data rows
  rows.forEach((row) => {
    const isMismatch = row.warnings.includes('NAKOPITELNIY_MISMATCH');
    const holat = nakopitelniyHolat(row);
    
    // Convert holat to uppercase or formatted
    let holatDisplay: string = holat;
    if (holat === 'ortiqcha') holatDisplay = 'ORTIQCHA';
    if (holat === 'chegara') holatDisplay = 'CHEGARA';
    if (holat === 'normal') holatDisplay = 'NORMAL';
    if (holat === 'aniq_emas') holatDisplay = 'ANIQ EMAS';
    if (isMismatch) holatDisplay += ' (MISMATCH)';

    // ⚠️ NARX O'ZIDAN TO'QILMAYDI: sertifikatlangan summa noma'lum (null)
    // bo'lsa -- masalan qatorda narx manbasi hali qayd etilmagan -- bu
    // yerda "0" YOZILMAYDI (0 "hali sertifikatlanmagan" bilan bir xil
    // ko'rinib, haqiqiy noaniqlikni yashirib qo'yardi). "NOANIQ" yoziladi.
    const summaNoaniq = row.cumulativeCertifiedValue == null;
    const baselineQuantityNoaniq = row.baselineQuantity == null;
    const entitlementNoaniq = row.approvedEntitlementQuantity == null;
    const remainingQuantityNoaniq = row.remainingQuantity == null;
    const remainingValueNoaniq = row.remainingValue == null;
    const dataRow = worksheet.addRow([
      row.description,
      row.unit,
      baselineQuantityNoaniq ? 'NOANIQ' : row.baselineQuantity,
      row.approvedChangeQuantity,
      entitlementNoaniq ? 'NOANIQ' : row.approvedEntitlementQuantity,
      row.previousQuantity,
      row.currentQuantity,
      row.cumulativeQuantity,
      remainingQuantityNoaniq ? 'NOANIQ' : row.remainingQuantity,
      summaNoaniq ? 'NOANIQ' : row.cumulativeCertifiedValue,
      holatDisplay
    ]);

    // Simple formatting
    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      // Numbers formatting (columns 3 to 10)
      if (colNumber >= 3 && colNumber <= 10 && typeof cell.value === 'number') {
        cell.numFmt = '#,##0.00';
      }
    });
    if (baselineQuantityNoaniq) dataRow.getCell(3).font = { color: { argb: 'FFFF0000' }, italic: true };
    if (entitlementNoaniq) dataRow.getCell(5).font = { color: { argb: 'FFFF0000' }, italic: true };
    if (remainingQuantityNoaniq) dataRow.getCell(9).font = { color: { argb: 'FFFF0000' }, italic: true };
    if (remainingValueNoaniq) dataRow.getCell(9).note = 'Remaining value: NOANIQ';
    if (summaNoaniq) dataRow.getCell(10).font = { color: { argb: 'FFFF0000' }, italic: true };

    if (holat === 'ortiqcha' || isMismatch) {
      dataRow.getCell(11).font = { color: { argb: 'FFFF0000' }, bold: true }; // Red
    } else if (holat === 'chegara') {
      dataRow.getCell(11).font = { color: { argb: 'FFFFA500' }, bold: true }; // Orange
    }
  });

  // Adjust column widths
  worksheet.getColumn(1).width = 40;
  worksheet.getColumn(2).width = 10;
  for (let i = 3; i <= 11; i++) {
    worksheet.getColumn(i).width = 15;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
