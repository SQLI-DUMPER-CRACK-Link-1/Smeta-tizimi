import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { generateNakopitelniy } from './nakopitelniy-export';
import { generateForma2 } from './forma2-export';
import { generateForma3 } from './forma3-export';
import { type ProgressLineResult, type ProgressValuationResult } from '../types';

describe('Document Export Generators', () => {
  const dummyRow: ProgressLineResult = {
    lineId: 'l1',
    sectionId: 's1',
    description: 'Test ish',
    unit: 'm3',
    baselineQuantity: 100,
    baselineReferencePrice: 500,
    approvedChangeQuantity: 20,
    approvedEntitlementQuantity: 120,
    previousQuantity: 50,
    currentQuantity: 30,
    cumulativeQuantity: 80,
    remainingQuantity: 40,
    previousValue: 25000,
    currentValue: 15000,
    cumulativeValue: 40000,
    remainingValue: 20000,
    previousCertifiedValue: 25000,
    currentCertifiedValue: 15000,
    cumulativeCertifiedValue: 40000,
    currentF2ValuationPrice: 500,
    f2ValuationValue: 15000,
    actualValue: 15000,
    variance: 0,
    changeKinds: [],
    revisionIds: [],
    warnings: []
  };

  const dummyValuation: ProgressValuationResult = {
    input: {} as any,
    rows: [dummyRow],
    totals: {
      previousQuantity: 50,
      currentQuantity: 30,
      cumulativeQuantity: 80,
      remainingQuantity: 40,
      previousValue: 25000,
      currentValue: 15000,
      cumulativeValue: 40000,
      remainingValue: 20000
    }
  };

  it('generates Nakopitelniy Vedomost (TPL-07)', async () => {
    const buffer = await generateNakopitelniy([dummyRow], {
      projectName: 'Test Project',
      objectName: 'Test Object',
      periodLabel: '2026-09',
      documentNumber: 'NAK-1'
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);
    const ws = wb.getWorksheet(1);
    expect(ws).toBeDefined();
    
    // Header check
    expect(ws!.getCell('A1').value).toContain('Nakopitelnaya vedomost');
    
    // Data check (row 6 should be the first data row)
    const dataRow = ws!.getRow(6);
    expect(dataRow.getCell(1).value).toBe('Test ish');
    expect(dataRow.getCell(3).value).toBe(100);
    expect(dataRow.getCell(7).value).toBe(30); // Joriy F-2
  });

  it('generates Forma-2 (TPL-05/06)', async () => {
    const buffer = await generateForma2([dummyRow], {
      projectName: 'Test Project',
      objectName: 'Test Object',
      periodLabel: '2026-09',
      documentNumber: 'F2-1',
      contractNumber: 'C-123'
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);
    const ws = wb.getWorksheet(1);
    expect(ws).toBeDefined();

    expect(ws!.getCell('A1').value).toContain('Forma-2');
    
    const dataRow = ws!.getRow(8); // Data starts at row 8 usually
    expect(dataRow.getCell(2).value).toBe('Test ish');
    expect(dataRow.getCell(5).value).toBe(30); // Joriy oy miqdori
    expect(dataRow.getCell(6).value).toBe(15000); // Sertifikatlangan summa
  });

  it('generates Forma-3 with unresolved taxes (TPL-12)', async () => {
    const buffer = await generateForma3(dummyValuation, {
      projectName: 'Test Project',
      objectName: 'Test Object',
      periodLabel: '2026-09',
      documentNumber: 'F3-1',
      vatRatePercent: null
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);
    const ws = wb.getWorksheet(1);
    
    const vatRow = ws!.getRow(9);
    expect(vatRow.getCell(2).value).toContain('QQS (Aniqlanmagan)');
    expect(vatRow.getCell(3).value).toBe('FORMA3_RULE_UNRESOLVED');
  });

  it('generates Forma-3 with resolved taxes (TPL-12)', async () => {
    const buffer = await generateForma3(dummyValuation, {
      projectName: 'Test Project',
      objectName: 'Test Object',
      periodLabel: '2026-09',
      documentNumber: 'F3-1',
      vatRatePercent: 12
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer.buffer as ArrayBuffer);
    const ws = wb.getWorksheet(1);
    
    const vatRow = ws!.getRow(9);
    expect(vatRow.getCell(2).value).toContain('QQS (12%)');
    expect(vatRow.getCell(4).value).toBe(15000 * 0.12); // QQS joriy davr
  });
});
