import { describe, expect, it } from 'vitest';
import { smetaPaketTasdiqImzosi, smetaPaketTanloviniTekshir, smetaVaraqniTahlilQil, type SmetaPackageSheetChoice } from './smeta-source-analysis';

const base = (override: Partial<SmetaPackageSheetChoice> = {}): SmetaPackageSheetChoice => ({
  id: 'sheet-1', workbookId: 'book-a', sourceKey: 'source-a', analysisKey: 'analysis-a', selectedRole: 'lrv', ...override,
});

describe('universal smeta package sheet analysis', () => {
  it('TN qurilish LRV varag‘ini mazmunidan topadi', () => {
    const result = smetaVaraqniTahlilQil([
      ['ТН 2026. ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ'],
      ['ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ', 'ЕД. ИЗМ.', 'КОЛИЧЕСТВО', 'ОБЪЕМ'],
      ['01-01', 'Beton ishlari', 'М3', 10, 10],
    ]);
    expect(result.detectedRole).toBe('lrv');
    expect(result.confidence).toBe('high');
  });

  it('ABC4 uslubidagi LRV varag‘ini mazmunidan topadi', () => {
    const result = smetaVaraqniTahlilQil([
      ['ABC4', 'ЛОКАЛЬНАЯ СМЕТА'],
      ['ШИФР', 'ВИД РАБОТ', 'ЕД. ИЗМ.', 'КОЛИЧЕСТВО', 'СТОИМОСТЬ'],
      ['A-1', 'Asfalt yotqizish', 'Т', 22, 100000],
    ]);
    expect(result.detectedRole).toBe('lrv');
  });

  it('shifrsiz RESni nom + birlik + narx hamda RES bo‘limi bilan topadi', () => {
    const result = smetaVaraqniTahlilQil([
      ['МАТЕРИАЛЬНЫЕ РЕСУРСЫ'],
      ['НАИМЕНОВАНИЕ', 'ЕД. ИЗМ.', 'ЦЕНА'],
      ['Beton B25', 'М3', 850000],
      ['Armatura A500', 'Т', 7200000],
      ['Qum', 'М3', 110000],
    ]);
    expect(result.detectedRole).toBe('res');
    expect(result.codelessResRows).toBeGreaterThanOrEqual(2);
  });

  it('cover/izoh varag‘ini noma’lum qoldiradi — u auto-import bo‘lmaydi', () => {
    const result = smetaVaraqniTahlilQil([['FAROVON YANGI O‘ZBEKISTON'], ['Izoh va tasdiqlash varag‘i']]);
    expect(result.detectedRole).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('bo‘sh yoki nostandart worksheet panelni yiqitmaydi — faqat unknown bo‘ladi', () => {
    const result = smetaVaraqniTahlilQil(undefined);
    expect(result.detectedRole).toBe('unknown');
    expect(result.dataRows).toBe(0);
  });
});

describe('package selection safety', () => {
  it('bitta XLSX ichidagi RES faqat o‘sha XLSX LRV manbasiga birikadi', () => {
    const sheets = [base(), base({ id: 'sheet-2', sourceKey: 'res-a', selectedRole: 'res', targetLrvSourceKey: 'source-b' }), base({ id: 'sheet-3', workbookId: 'book-b', sourceKey: 'source-b' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_INTERNAL_RES_TARGET_MISMATCH', sheetId: 'sheet-2' });
  });

  it('tashqi RES faqat operator aniq tanlagan bitta LRVga birikadi', () => {
    const sheets = [base(), base({ id: 'sheet-2', workbookId: 'book-res', sourceKey: 'res-external', selectedRole: 'res' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_RES_TARGET_REQUIRED', sheetId: 'sheet-2' });
  });

  it('tasdiqlashsiz importni va tahlil o‘zgargan eski tasdiqni bloklaydi', () => {
    const sheets = [base(), base({ id: 'sheet-2', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKey: 'source-a' })];
    const signature = smetaPaketTasdiqImzosi(sheets);
    expect(smetaPaketTanloviniTekshir(sheets)).toEqual({ ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' });
    expect(smetaPaketTanloviniTekshir([...sheets.slice(0, 1), { ...sheets[1], analysisKey: 'changed' }], signature)).toEqual({ ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' });
  });

  it('source-key kesishmasini bloklaydi', () => {
    const sheets = [base(), base({ id: 'sheet-2', sourceKey: 'source-a' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_SOURCE_KEY_DUPLICATE', sheetId: 'sheet-2' });
  });
});
