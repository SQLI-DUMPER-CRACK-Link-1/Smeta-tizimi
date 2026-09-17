import { describe, expect, it } from 'vitest';
import { lrvVaIchkiResniAjrat } from './smeta-lrv-boundary';

describe('LRV ichidagi RES ilovasi chegarasi', () => {
  it('lokal vedomost yakunidan keyingi RESni LRV daraxtidan chiqaradi', () => {
    const result = lrvVaIchkiResniAjrat([
      ['ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ'],
      ['ШИФР', 'НАИМЕНОВАНИЕ', 'ЕД. ИЗМ.', 'КОЛИЧЕСТВО'],
      ['E27', 'Beton ishlari', 'м3', 10],
      ['ИТОГО ПО ЛОКАЛЬНОЙ РЕСУРСНОЙ ВЕДОМОСТИ:'],
      ['ТРУДОВЫЕ РЕСУРСЫ'],
      ['1', 'Ishchi', 'чел-ч', 20],
    ]);
    expect(result.boundaryRow).toBe(4);
    expect(result.boundaryKind).toBe('lrv_total');
    expect(result.lrvRows).toHaveLength(4);
    expect(result.embeddedResRows).toHaveLength(2);
  });

  it('alohida RES titulidan ham ilovani ajratadi', () => {
    const result = lrvVaIchkiResniAjrat([
      ['ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ'], [], [], [], [], [], [], [], [], [],
      ['ВЕДОМОСТЬ ПОТРЕБНЫХ РЕСУРСОВ'],
      ['Beton', 'м3', 850000],
    ]);
    expect(result.boundaryKind).toBe('res_title');
    expect(result.lrvRows).toHaveLength(10);
    expect(result.embeddedResRows[0][0]).toBe('ВЕДОМОСТЬ ПОТРЕБНЫХ РЕСУРСОВ');
  });

  it('oddiy LRVni o‘zboshimchalik bilan kesmaydi', () => {
    const rows = [['ЛОКАЛЬНАЯ СМЕТА'], ['Beton ishlari']];
    expect(lrvVaIchkiResniAjrat(rows)).toEqual({ lrvRows: rows, embeddedResRows: [] });
  });
});
