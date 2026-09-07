import ExcelJS from 'exceljs';
import type { NakopitelniyQator } from '../api/t2-nakopitelniy';

export interface NakopitelniyVedomostExportOptions {
  obyektNom: string;
  davr: string;
}

/** Real line-by-line PTO nakopitelniy vedomost export -- raw t2_nakopitelniy_v1
 *  rows (Fakt/PREV-F2/CURRENT-F2/CUMULATIVE-F2/REMAINING), not the abstract
 *  ProgressLineResult shape (which has no Fakt dimension at all). */
export async function nakopitelniyVedomostExportXlsx(
  qatorlar: readonly NakopitelniyQator[],
  options: NakopitelniyVedomostExportOptions,
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Smeta tizimi';
  const ws = wb.addWorksheet('Nakopitelniy');

  ws.mergeCells('A1', 'O1');
  ws.getCell('A1').value = `Nakopitelnaya vedomost — ${options.obyektNom} (${options.davr})`;
  ws.getCell('A1').font = { bold: true, size: 14 };

  const groupRow = ws.addRow(['', '', '', 'SMETA', '', '', 'FAKT', 'OLDINGI F2', '', 'JORIY F2', '', '', 'JAMI F2', '', 'QOLDIQ']);
  ws.mergeCells('D2:F2'); ws.mergeCells('H2:I2'); ws.mergeCells('J2:L2'); ws.mergeCells('M2:N2');
  groupRow.font = { bold: true };
  groupRow.eachCell(c => { c.alignment = { horizontal: 'center' }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; });

  const header = ws.addRow([
    'Kod', 'Nomi', 'Birlik',
    'Hajm', 'Narx', 'Summa',
    'Hajm',
    'Hajm', 'Summa',
    'Hajm', 'Narx', 'Summa',
    'Hajm', 'Summa',
    'Smeta qoldiq', 'F2 mumkin',
  ]);
  header.font = { bold: true };
  header.eachCell(c => { c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });

  for (const q of qatorlar) {
    if (q.tur === 'rz') {
      const r = ws.addRow([q.nom]);
      ws.mergeCells(`A${r.number}:P${r.number}`);
      r.font = { bold: true };
      r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      continue;
    }
    const row = ws.addRow([
      q.kod || '', q.nom || '', q.birlik || '',
      q.smeta_hajm, q.smeta_narx, q.smeta_summa,
      q.fakt_hajm,
      q.oldingi_hajm, q.oldingi_summa,
      q.joriy_hajm, q.joriy_hajm ? Math.round((q.joriy_summa / q.joriy_hajm) * 100) / 100 : null, q.joriy_summa,
      q.jami_hajm, q.jami_summa,
      q.qoldiq_hajm, q.f2_mumkin_hajm,
    ]);
    row.eachCell((c, i) => { if (i >= 4 && typeof c.value === 'number') c.numFmt = '#,##0.00'; });
    if (q.f2_mumkin_hajm < 0) row.getCell(16).font = { color: { argb: 'FFFF0000' }, bold: true };
  }

  ws.getColumn(2).width = 42;
  for (let i = 1; i <= 16; i++) if (i !== 2) ws.getColumn(i).width = 13;
  ws.views = [{ state: 'frozen', ySplit: 3 }];

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
