import { describe, expect, it } from 'vitest';
import { formatAniqla, nomNaqshi } from './profil';
import { kitobAnatomiyasi } from './index';

describe('varaq profili (§6)', () => {
  it('format varaq darajasida: ABC4 nomlari, TN belgisi, LRV_PLUS', () => {
    expect(formatAniqla('1203_БВ', [])).toBe('abc4');
    expect(formatAniqla('RES_A', [])).toBe('abc4');
    expect(formatAniqla('Смета', [], 'ТЕРРИТОРИАЛЬНЫЕ СМЕТНЫЕ НОРМАТИВЫ')).toBe('tn');
    expect(formatAniqla('LRV_PLUS', [])).toBe('lrv_plus');
    expect(formatAniqla('Лист1', [])).toBe('nomalum');
    expect(nomNaqshi('1203_БВ')).toBe('#_БВ');
  });

  it('bir xil tuzilmali ikki varaq — bir xil imzo; ustun qo‘shilsa imzo o‘zgaradi', () => {
    const sar = ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ', 'ЕД.ИЗМ', 'КОЛ-ВО', 'ЦЕНА', 'СУММА'];
    const v = (nom: string, s: string[]) => kitobAnatomiyasi({ fayl: 'x', varaqlar: [{ nom, rows: [s, s.map((_x, i) => i + 1), [1, 'Е01', 'ГРУНТ', 'м3', 10, 100, 1000], ['1.1', '1-100', 'ТРУД', 'чел.-ч', 5, 200, 1000]] }] }).varaqlar[0].profil!;
    expect(v('1203_БВ', sar).imzo).toBe(v('1510_БВ', sar).imzo);
    expect(v('1203_БВ', [...sar, 'ПРИМЕЧАНИЕ']).imzo).not.toBe(v('1203_БВ', sar).imzo);
  });
});
