import { describe, expect, it } from 'vitest';
import { smetaPaketResTargetlariniTaklifQil, smetaPaketTasdiqImzosi, smetaPaketTanloviniTekshir, smetaVaraqniTahlilQil, type SmetaPackageSheetChoice } from './smeta-source-analysis';

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
    expect(result.suggestedIgnore).toBe(false);
    expect(result.dataRows).toBe(0);
  });

  it('obyekt qiymati xulosasini RES deb noto‘g‘ri tanlamaydi', () => {
    const result = smetaVaraqniTahlilQil([
      ['РЕКОМЕНДУЕМАЯ СТОИМОСТЬ ОБЪЕКТА В ТЕКУЩИХ ЦЕНАХ'],
      ['НАИМЕНОВАНИЕ ЗАТРАТ', 'ЦЕНА'],
      ['ЗАТРАТЫ НА МАТЕРИАЛЫ', 5019131967],
      ['ЗАТРАТЫ НА ТРАНСПОРТ', 418774643.6],
    ]);
    expect(result.detectedRole).toBe('unknown');
    expect(result.suggestedIgnore).toBe(true);
    expect(result.ignoreReason).toContain('xulosa');
  });

  it('transport xarajatlari varag‘ini avtomatik e’tiborsiz qiladi', () => {
    const result = smetaVaraqniTahlilQil([
      ['Расчёт затрат транспорта'],
      ['Наименование материалов', 'Ед.изм', 'Кол-во', 'Стоимость всего сум'],
      ['Асфальтобетон', 'ТН', 6494.997, 109189156.62],
    ]);
    expect(result.detectedRole).toBe('unknown');
    expect(result.suggestedIgnore).toBe(true);
  });

  it('TN varag‘idagi siyrak bo‘sh ustunlarni xavfsiz tahlil qiladi', () => {
    const sparse: Array<string | null> = [];
    sparse[0] = 'ТН. ЛОКАЛЬНАЯ СМЕТА';
    sparse[5] = 'КОЛИЧЕСТВО';
    const result = smetaVaraqniTahlilQil([sparse]);
    // Bir dona title satri yakuniy LRV qarori uchun dalil emas; muhim
    // kafolat — siyrak kataklar xato bermaydi va operator review oladi.
    expect(result.detectedRole).toBe('unknown');
    expect(result.dataRows).toBe(1);
  });
});

describe('package selection safety', () => {
  it('bitta XLSX ichidagi RES faqat o‘sha XLSX LRV manbasiga birikadi', () => {
    const sheets = [base(), base({ id: 'sheet-2', sourceKey: 'res-a', selectedRole: 'res', targetLrvSourceKeys: ['source-b'] }), base({ id: 'sheet-3', workbookId: 'book-b', sourceKey: 'source-b' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_INTERNAL_RES_TARGET_MISMATCH', sheetId: 'sheet-2' });
  });

  it('tashqi RES faqat operator aniq tanlagan bitta LRVga birikadi', () => {
    const sheets = [base(), base({ id: 'sheet-2', workbookId: 'book-res', sourceKey: 'res-external', selectedRole: 'res' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_RES_TARGET_REQUIRED', sheetId: 'sheet-2' });
  });

  it('tashqi RES checkbox bilan BIR NECHTA LRVga birikadi (egasi 2026-09-23)', () => {
    const lrvB = base({ id: 'sheet-b', workbookId: 'book-b', sourceKey: 'source-b' });
    const res = base({ id: 'sheet-r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a', 'source-b'] });
    const sheets = [base(), lrvB, res];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: true });
  });

  it('takroriy yoki mavjud bo‘lmagan nishon — rad; ichki RES boshqa fayl LRVsiga — rad', () => {
    const lrvB = base({ id: 'sheet-b', workbookId: 'book-b', sourceKey: 'source-b' });
    const takror = [base(), lrvB, base({ id: 'r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a', 'source-a'] })];
    expect(smetaPaketTanloviniTekshir(takror, smetaPaketTasdiqImzosi(takror))).toMatchObject({ ok: false, code: 'PACKAGE_RES_TARGET_INVALID' });
    const begona = [base(), base({ id: 'r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['yoq'] })];
    expect(smetaPaketTanloviniTekshir(begona, smetaPaketTasdiqImzosi(begona))).toMatchObject({ ok: false, code: 'PACKAGE_RES_TARGET_INVALID' });
    const ichki = [base(), lrvB, base({ id: 'r', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a', 'source-b'] })];
    expect(smetaPaketTanloviniTekshir(ichki, smetaPaketTasdiqImzosi(ichki))).toMatchObject({ ok: false, code: 'PACKAGE_INTERNAL_RES_TARGET_MISMATCH' });
  });

  it('tasdiq imzosi nishonlar tartibiga bog‘liq emas, lekin nishon o‘zgarsa tasdiq yaroqsiz', () => {
    const lrvB = base({ id: 'sheet-b', workbookId: 'book-b', sourceKey: 'source-b' });
    const ab = [base(), lrvB, base({ id: 'r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a', 'source-b'] })];
    const ba = [base(), lrvB, base({ id: 'r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-b', 'source-a'] })];
    const faqatA = [base(), lrvB, base({ id: 'r', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a'] })];
    expect(smetaPaketTasdiqImzosi(ab)).toBe(smetaPaketTasdiqImzosi(ba));
    expect(smetaPaketTanloviniTekshir(faqatA, smetaPaketTasdiqImzosi(ab))).toMatchObject({ ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' });
  });

  it('tasdiqlashsiz importni va tahlil o‘zgargan eski tasdiqni bloklaydi', () => {
    const sheets = [base(), base({ id: 'sheet-2', workbookId: 'book-res', sourceKey: 'res', selectedRole: 'res', targetLrvSourceKeys: ['source-a'] })];
    const signature = smetaPaketTasdiqImzosi(sheets);
    expect(smetaPaketTanloviniTekshir(sheets)).toEqual({ ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' });
    expect(smetaPaketTanloviniTekshir([...sheets.slice(0, 1), { ...sheets[1], analysisKey: 'changed' }], signature)).toEqual({ ok: false, code: 'PACKAGE_CONFIRMATION_REQUIRED' });
  });

  it('source-key kesishmasini bloklaydi', () => {
    const sheets = [base(), base({ id: 'sheet-2', sourceKey: 'source-a' })];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: false, code: 'PACKAGE_SOURCE_KEY_DUPLICATE', sheetId: 'sheet-2' });
  });

  it('xulosa va transport varaqlari ignore bo‘lsa, haqiqiy LRV+RES paketi rol xatosiz tasdiqlanadi', () => {
    const sheets = [
      base({ id: 'summary', sourceKey: 'summary', selectedRole: 'ignore' }),
      base({ id: 'transport', sourceKey: 'transport', selectedRole: 'ignore' }),
      base({ id: 'lrv-4230', sourceKey: 'lrv-4230', selectedRole: 'lrv' }),
      base({ id: 'res-4230', sourceKey: 'res-4230', selectedRole: 'res', targetLrvSourceKeys: ['lrv-4230'] }),
    ];
    expect(smetaPaketTanloviniTekshir(sheets, smetaPaketTasdiqImzosi(sheets))).toEqual({ ok: true });
  });

  it('bitta fayldagi yagona LRV uchun RES targetini deterministik taklif qiladi', () => {
    const sheets = [
      base({ id: 'lrv', sourceKey: 'lrv', workbookId: 'book-a' }),
      base({ id: 'res', sourceKey: 'res', workbookId: 'book-a', selectedRole: 'res' }),
    ];
    expect(smetaPaketResTargetlariniTaklifQil(sheets)[1].targetLrvSourceKeys).toEqual(['lrv']);
  });

  it('bir nechta LRV bo‘lsa RESni indeks yoki nom bilan taxminan aralashtirmaydi', () => {
    const sheets = [
      base({ id: 'lrv-a', sourceKey: 'lrv-a', workbookId: 'book-a' }),
      base({ id: 'lrv-b', sourceKey: 'lrv-b', workbookId: 'book-a' }),
      base({ id: 'res', sourceKey: 'res', workbookId: 'book-a', selectedRole: 'res' }),
    ];
    expect(smetaPaketResTargetlariniTaklifQil(sheets)[2].targetLrvSourceKeys).toBeUndefined();
  });
});
