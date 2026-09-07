import { describe, expect, it } from 'vitest';
import { resSatrlariniOl, resNarxIndeksiQur, narxlarniDaraxtgaQoll, katTaxmini } from './SmetaYuklaNative';
import type { AktNode } from '../../lib/f2-match-engine';
import type { F2ColumnConfig } from '../../lib/f2-import-parse';

const cols: F2ColumnConfig = { kod: 0, nom: 1, bir: 2, norma: -1, obyom: -1, narx: 3, sum: -1 };

describe('RES (resursniy vedomost) narx moslashtirish', () => {
  it('kod, nom va birlik ustunlaridan narx katalogini quradi', () => {
    const rows = [
      ['B25', 'Beton B25', 'm3', '500000'],
      ['', 'Armatura', 'kg', '12000,5'],
      ['1', '2', '3', '4'], // ustun-raqamlash qatori -- rad etiladi
      ['', '', '', ''],
    ];
    const satrlar = resSatrlariniOl(rows, cols);
    expect(satrlar).toEqual([
      { kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 },
      { kod: undefined, nom: 'Armatura', birlik: 'kg', narx: 12000.5 },
    ]);
  });

  it('kod ustuvor, topilmasa nom+birlik bo‘yicha moslashadi', () => {
    const idx = resNarxIndeksiQur([
      { kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 },
      { nom: 'Armatura', birlik: 'kg', narx: 12000 },
    ]);
    expect(idx.byKod.get('B25')).toBe(500000);
    expect(idx.byNomBir.get('ARMATURA|KG')).toBe(12000);
  });

  it('LRV daraxtidagi narxsiz rs bargiga RES narxini qo‘llaydi va summa=hajm*narx hisoblaydi', () => {
    const tree: AktNode[] = [{
      uid: '1', type: 'rz', nom: 'Fundament', children: [{
        uid: '2', type: 'bl', nom: 'Beton ishlari', children: [
          { uid: '3', type: 'rs', kod: 'B25', nom: 'Beton B25', bir: 'm3', hajm: 10 },
        ],
      }],
    }];
    const idx = resNarxIndeksiQur([{ kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 500000 }]);
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, idx);
    const rs = out[0].children![0].children![0];
    expect(rs.narx).toBe(500000);
    expect(rs.summa).toBe(5000000);
    expect(mosSoni).toBe(1);
    expect(mosEmasSoni).toBe(0);
  });

  it('LRV faylida allaqachon narx bor bargni ustidan yozmaydi', () => {
    const tree: AktNode[] = [{
      uid: '1', type: 'rs', kod: 'B25', nom: 'Beton B25', bir: 'm3', hajm: 10, narx: 1, summa: 10,
    }];
    const idx = resNarxIndeksiQur([{ kod: 'B25', nom: 'Beton B25', birlik: 'm3', narx: 999999 }]);
    const { tree: out } = narxlarniDaraxtgaQoll(tree, idx);
    expect(out[0].narx).toBe(1);
    expect(out[0].summa).toBe(10);
  });

  it('mos kelmagan bargni jim narxsiz qoldiradi, taxmin qilmaydi', () => {
    const tree: AktNode[] = [{ uid: '1', type: 'rs', kod: 'YOQ', nom: 'Nomalum', bir: 'dona', hajm: 5 }];
    const { tree: out, mosSoni, mosEmasSoni } = narxlarniDaraxtgaQoll(tree, resNarxIndeksiQur([]));
    expect(out[0].narx).toBeUndefined();
    expect(mosSoni).toBe(0);
    expect(mosEmasSoni).toBe(1);
  });
});

describe('katTaxmini (mijoz tomoni ko‘rib chiqish uchun taxmin)', () => {
  it('birlikda ЧЕЛ bo‘lsa ЧЕЛ', () => expect(katTaxmini('Ishchi', 'чел-час')).toBe('ЧЕЛ'));
  it('birlikda МАШ bo‘lsa МАШ', () => expect(katTaxmini('Kran', 'маш-час')).toBe('МАШ'));
  it('nomda ТРУДА МАШИНИСТОВ bo‘lsa МАШ', () => expect(katTaxmini('Затраты труда машинистов', 'чел-час')).toBe('МАШ'));
  it('boshqa hollarda МАТ (standart) -- ОБ/КАБ/М-К hech qachon taxmin qilinmaydi', () => {
    expect(katTaxmini('Кабель ВВГ 3х2,5', 'м')).toBe('МАТ');
    expect(katTaxmini('Экскаватор', 'шт')).toBe('МАТ');
  });
});
