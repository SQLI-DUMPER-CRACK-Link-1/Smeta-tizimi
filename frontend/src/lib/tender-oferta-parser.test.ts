import { describe, expect, it } from 'vitest';
import { ofertaResursVaraqlariniAniqla, ofertaTanlanganQatorlari } from './tender-oferta-parser';
import type { SheetGrid, XlsxWorkbook } from './f2-import-parse';

function workbook(sheets: Array<{ name: string; rows: unknown[][] }>): XlsxWorkbook {
  return {
    sheets: sheets.map((sheet) => ({ ...sheet, rows: sheet.rows as SheetGrid, merges: [] })),
    sheet: (name: string) => sheets.find((sheet) => sheet.name === name) ? { ...sheets.find((sheet) => sheet.name === name)!, rows: sheets.find((sheet) => sheet.name === name)!.rows as SheetGrid, merges: [] } : null,
  };
}

describe('tender oferta RES parseri', () => {
  it('kod bo‘lmagan RES satrlarini ham saqlaydi va ikki varaqni ajratadi', () => {
    const wb = workbook([
      { name: 'RES-MAT', rows: [
        ['№', 'Наименование ресурсов', 'Единица измерения', 'Количество', 'Сметная стоимость на ед. изм.', 'Общая стоимость'],
        [1, 'Бетон B25', 'м3', 10, 123.45, 1234.49],
        [2, 'Вода', 'м3', 2, 8.5, 17],
      ] },
      { name: 'Локальная смета', rows: [
        ['Шифр', 'Наименование работ и затрат', 'Единица измерения', 'Количество', 'Сметная стоимость'],
        ['E1', 'Земляные работы', 'м3', 10, 1000],
      ] },
    ]);
    const result = ofertaResursVaraqlariniAniqla(wb);
    const res = result.find((sheet) => sheet.nom === 'RES-MAT');
    const lrv = result.find((sheet) => sheet.nom === 'Локальная смета');
    expect(res?.role).toBe('res');
    expect(res?.qatorlar).toHaveLength(2);
    expect(res?.qatorlar[0]).toMatchObject({ shifr: null, hajm: 10, smetaBirlikNarx: 123.45, smetaSumma: 1234.49 });
    expect(lrv?.role).toBe('lrv');
    expect(ofertaTanlanganQatorlari(result, ['RES-MAT'])).toHaveLength(2);
  });

  it('tartib raqami bo‘lmasa qatorni indeks bilan qayta identifikatsiya qilmaydi', () => {
    const wb = workbook([{ name: 'RES', rows: [
      ['Код', 'Ресурс', 'Ед. изм.', 'Кол-во', 'Цена за ед.', 'Сумма'],
      ['', 'Щебень', 'м3', 4, 50, 200],
    ] }]);
    const [sheet] = ofertaResursVaraqlariniAniqla(wb);
    expect(sheet.qatorlar[0].tartibRaqami).toBeNull();
    expect(sheet.qatorlar[0].sourceId).toBe('RES::r2');
  });

  it('bo‘lim va jami satrlarini resursdan ajratib saqlaydi', () => {
    const wb = workbook([{ name: 'RES', rows: [
      ['№', 'Наименование ресурсов', 'Ед. изм.', 'Количество', 'Цена за ед.', 'Итого'],
      ['', 'МАТЕРИАЛЫ', '', '', '', ''],
      [1, 'Цемент', 'т', 1, 100, 100],
      ['', 'ИТОГО', '', '', '', 100],
    ] }]);
    const [sheet] = ofertaResursVaraqlariniAniqla(wb);
    expect(sheet.qatorlar.map((row) => row.nom)).toEqual(['МАТЕРИАЛЫ', 'Цемент', 'ИТОГО']);
    expect(sheet.qatorlar[0].turi).toBe('bolim');
    expect(sheet.qatorlar[2].turi).toBe('jami');
  });

  it('katta harfli nomlangan bo‘lim keyingi jami qamrovini yangi blokdan boshlaydi', () => {
    const wb = workbook([{ name: 'RES', rows: [
      ['№', 'Наименование ресурсов', 'Ед. изм.', 'Количество', 'Цена за ед.', 'Итого'],
      [1, 'Цемент', 'т', 1, 100, 100],
      ['', 'ИТОГО', '', '', '', 100],
      ['', 'МЕТАЛЛОКОНСТРУКЦИИ', '', '', '', ''],
      [2, 'Профиль', 'т', 2, 200, 400],
      ['', 'ИТОГО', '', '', '', 400],
    ] }]);
    const [sheet] = ofertaResursVaraqlariniAniqla(wb);
    const totals = sheet.qatorlar.filter((row) => row.turi === 'jami');
    expect(totals).toHaveLength(2);
    expect(totals[0].blokKaliti).not.toBe(totals[1].blokKaliti);
    expect(sheet.qatorlar.find((row) => row.nom === 'Профиль')?.blokKaliti).toBe(totals[1].blokKaliti);
  });

  it('T2 LRV_PLUS sarlavhasini RES deb adashtirmaydi, Uzbekcha narx/hajm tokenlarini o‘qiydi', () => {
    const wb = workbook([{ name: 'LRV_PLUS', rows: [
      ['№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.', 'ҲАЖМ (ед)', 'НАРХ', 'СУММА'],
      [1, 'A-1', 'Иш номи', 'м3', 2, 100, 200],
    ] }]);
    const [sheet] = ofertaResursVaraqlariniAniqla(wb);
    expect(sheet.role).toBe('lrv');
    expect(sheet.qatorlar[0]).toMatchObject({ hajm: 2, smetaBirlikNarx: 100, smetaSumma: 200 });
  });

  it('bitta narx ustunini umumiy summa deb takrorlamaydi', () => {
    const wb = workbook([{ name: 'RES_A', rows: [
      ['Код', 'Ресурс', 'Ед. изм.', 'Количество', 'Цена за ед.'],
      ['', 'Щебень', 'м3', 4, 50],
    ] }]);
    const [sheet] = ofertaResursVaraqlariniAniqla(wb);
    expect(sheet.qatorlar[0].smetaBirlikNarx).toBe(50);
    expect(sheet.qatorlar[0].smetaSumma).toBeNull();
  });

  it('RES va RES_A ayni ko‘rinish bo‘lsa, avtomatik ikki marta tanlamaydi', () => {
    const rows = [
      ['№', 'Код', 'Наименование ресурса', 'Ед. изм.', 'Количество', 'Цена за ед.', 'Сумма'],
      [1, 'M-1', 'Цемент', 'т', 2, 100, 200],
      [2, 'M-2', 'Песок', 'м3', 3, 50, 150],
      ['', '', 'ИТОГО', 'СУМ', '', '', 350],
    ];
    const altRows = [
      ['№', 'Наименование ресурса', 'Ед. изм.', 'Количество', 'Цена за ед.', 'Сумма'],
      [1, 'Цемент', 'т', 2, 100, 200],
      [2, 'Песок', 'м3', 3, 50, 150],
      ['', 'ИТОГО', 'СУМ', '', '', 350],
    ];
    const result = ofertaResursVaraqlariniAniqla(workbook([
      { name: 'RES', rows },
      { name: 'RES_A', rows: altRows },
    ]));
    expect(result.find((sheet) => sheet.nom === 'RES_A')?.alternativVaraq).toBe('RES');
    expect(ofertaTanlanganQatorlari(result, ['RES', 'RES_A'])).toHaveLength(3);
    expect(ofertaTanlanganQatorlari(result, ['RES_A'])).toHaveLength(3);
  });
});
