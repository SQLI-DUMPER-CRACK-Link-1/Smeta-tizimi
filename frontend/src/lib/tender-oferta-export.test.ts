import { describe, expect, it } from 'vitest';
import { ofertaQatorlariniHisobla, type OfertaQator } from './tender-oferta';
import { tenderOfertaXlsx } from './tender-oferta-export';
import { ofertaResursVaraqlariniAniqla } from './tender-oferta-parser';
import type { SheetGrid, XlsxWorkbook } from './f2-import-parse';

const row: OfertaQator = {
  sourceId: 'RES::r2', sourceSheet: 'RES', sourceRow: 2, tartibRaqami: 1, shifr: null,
  nom: 'Цемент', birlik: 'т', hajm: 2, smetaBirlikNarx: 100, smetaSumma: 199.99,
  turi: 'resurs', hisobTuri: 'birlik', blokKaliti: null, manbaHajmUstuni: 4,
};

describe('tender oferta XLSX', () => {
  it('smeta summasi va pudratchi hisobini alohida ustunlarda/formulada saqlaydi', async () => {
    const calculated = ofertaQatorlariniHisobla([row], { rejim: 'foiz', yon: 'pasaytirish', foiz: 10 });
    const XLSX = await import('xlsx-js-style');
    const sourceWb = XLSX.utils.book_new();
    const source = XLSX.utils.aoa_to_sheet([
      ['№', 'Код', 'Наименование ресурса', 'Единица измерения', 'Количество', 'Цена за ед.', 'Сумма'],
      [1, '', 'Цемент', 'т', 2, 100, 199.99],
    ]);
    const other = XLSX.utils.aoa_to_sheet([['Yordamchi varaq'], ['o‘zgarmaydi']]);
    XLSX.utils.book_append_sheet(sourceWb, source, 'RES');
    XLSX.utils.book_append_sheet(sourceWb, other, 'BOSHQA');
    const sourceBytes = XLSX.write(sourceWb, { type: 'array', bookType: 'xlsx' });
    const parsed: XlsxWorkbook = {
      sheets: [{ name: 'RES', rows: sourceWb.Sheets.RES ? XLSX.utils.sheet_to_json(sourceWb.Sheets.RES, { header: 1, raw: true, defval: null }) as SheetGrid : [], merges: [] }],
      sheet: (name) => name === 'RES' ? { name: 'RES', rows: sourceWb.Sheets.RES ? XLSX.utils.sheet_to_json(sourceWb.Sheets.RES, { header: 1, raw: true, defval: null }) as SheetGrid : [], merges: [] } : null,
    };
    const tahlillar = ofertaResursVaraqlariniAniqla(parsed);
    const data = await tenderOfertaXlsx({
      obyektNomi: 'Sinov', manbaFaylNomi: 'res.xlsx', manbaBytes: sourceBytes,
      tanlanganVaraqlar: ['RES'], tahlillar, sozlama: { rejim: 'foiz', yon: 'pasaytirish', foiz: 10 }, qatorlar: calculated.qatorlar,
    });
    const wb = XLSX.read(data, { type: 'array', cellStyles: true });
    expect(wb.SheetNames).toEqual(['RES', 'BOSHQA']);
    expect(wb.Sheets.BOSHQA['A2']?.v).toBe('o‘zgarmaydi');
    const ws = wb.Sheets.RES;
    expect(ws['C2']?.v).toBe('Цемент');
    expect(ws['G2']?.v).toBe(199.99);
    expect(ws['H2']?.v).toBe(90);
    expect(ws['I2']?.f).toBe('E2*H2');
    expect(ws['I2']?.v).toBe(180);
    expect(wb.SheetNames).not.toContain('Oferta');
  });
});
