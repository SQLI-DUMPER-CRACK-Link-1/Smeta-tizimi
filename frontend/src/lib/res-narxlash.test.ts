import { describe, expect, it } from 'vitest';
import { resBirlikKalit, resNarxlashPreview, resNomKalit, resQatorlariniOl, resUstunlariniAniqla } from './res-narxlash';

describe('RES narxlash kalitlari', () => {
  it('bazadagi nom va birlik normalizatorlari bilan moslashadi', () => {
    expect(resNomKalit('«Вода Ё»')).toBe(resNomKalit(' вода е '));
    expect(resBirlikKalit('м³')).toBe(resBirlikKalit('М3'));
    expect(resBirlikKalit('ЧЕЛ.-Ч')).toBe(resBirlikKalit('чел-ч'));
  });

  it('haqiqiy RES ikki qatorli narx sarlavhasini o‘qiydi', () => {
    const rows = [
      ['N', 'Шифр номера нормативов и коды ресурсов', 'Наименование работ и затрат', 'Единица измерения', 'Количество', 'Сметная стоимость', ''],
      ['', '', '', '', '', 'на.ед.изм.', 'общая'],
      ['1', 'B-25', 'Бетон Ё 25', 'м³', '10', '123.45', '1234.5'],
    ];
    const cols = resUstunlariniAniqla(rows);
    expect(cols).not.toBeNull();
    expect(resQatorlariniOl(rows, cols!)).toEqual([{ kod: 'B-25', nom: 'Бетон Ё 25', birlik: 'м³', narx: 123.45 }]);
  });

  it('mavjud narxni o‘zgartirmaydi va kod mismatchni rad etadi', () => {
    const result = resNarxlashPreview([
      { id: 1, tur: 'mat', kod: 'B25', nom: 'Бетон Ё 25', birlik: 'м3', narx: 0 },
      { id: 2, tur: 'mat', kod: 'B30', nom: 'Бетон Ё 25', birlik: 'м3', narx: 0 },
      { id: 3, tur: 'mat', kod: 'B25', nom: 'Бетон Ё 25', birlik: 'м3', narx: 99 },
    ], [{ kod: 'b 25', nom: 'бетон е 25', birlik: 'м³', narx: 123.45 }]);
    expect(result.narxsiz).toBe(2);
    expect(result.mos).toBe(1);
    expect(result.qatorNarxlari.get(1)).toBe(123.45);
    expect(result.qatorNarxlari.has(2)).toBe(false);
  });

  it('bir manba kalitida ikki narx bo‘lsa avtomatik yozishni bloklaydi', () => {
    const result = resNarxlashPreview(
      [{ id: 1, tur: 'mat', kod: 'C', nom: 'Maxsus resurs', birlik: 'шт', narx: null }],
      [{ kod: 'C', nom: 'Maxsus resurs', birlik: 'шт', narx: 100 }, { kod: 'C', nom: 'Maxsus resurs', birlik: 'шт', narx: 200 }],
    );
    expect(result.ziddiyatliManba).toBe(1);
    expect(result.mos).toBe(0);
  });
});
