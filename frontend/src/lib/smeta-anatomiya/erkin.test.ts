import { describe, expect, it } from 'vitest';
import { kitobAnatomiyasi } from './index';
import { formulaHavolalari } from './erkin';
import type { Katak } from './turlar';

const TRANSP: Katak[][] = [
  [null, 'Расчёт затрат транспорта'],
  [],
  [null, '№', 'Наименование материалов', 'Ед.изм', 'Кол-во', 'Кол-во (тн)', 'Дальность возки (км)', 'Грузооборот тн.км.', 'Стоимость тн.км в сум', 'Стоимость всего сум.'],
  [null, 1, 'Асфальтобетон', 'тн', 100, 100, 10, 1000, 1227.1, 1227100],
  [null, null, 'ИТОГО:', 'сум', null, null, null, null, null, 1227100],
];
const SVOD: Katak[][] = [
  [null, 'РЕКОМЕНДУЕМАЯ СТОИМОСТЬ ОБЪЕКТА'],
  ['№№ ПП', 'НАИМЕНОВАНИЕ ЗАТРАТ', 'Цена'],
  [1, 2, 3],
  [1, 'ЗАТРАТЫ НА ОБОРУДОВАНИЕ', 0],
  [5, 'ЗАТРАТЫ НА ТРАНСПОРТНЫЕ РАСХОДЫ', 1227100],
];
// SVOD!C5 = трансп.!J5
const SVOD_F: Array<Array<string | null>> = [];
SVOD_F[4] = [null, null, 'трансп.!J5'];

describe('erkin varaqlar', () => {
  it('formula havolalari: tirnoqli va oddiy varaq nomi, $ belgilar', () => {
    expect(formulaHavolalari("'4230_БР'!$G$123*0.05+трансп.!J15")).toEqual([
      { varaq: '4230_БР', katak: 'G123' }, { varaq: 'трансп.', katak: 'J15' },
    ]);
  });

  it('transport: yakuniy summa ИТОГО dan, svod qatori formula bilan (yuqori)', () => {
    const a = kitobAnatomiyasi({ fayl: 'f.xlsx', varaqlar: [
      { nom: 'сводн.', rows: SVOD, formulalar: SVOD_F }, { nom: 'трансп.', rows: TRANSP },
    ] });
    expect(a.varaqlar.map((v) => v.rol)).toEqual(['svod', 'transport']);
    expect(a.erkin).toHaveLength(1);
    const e = a.erkin[0];
    expect(e.yakuniy).toMatchObject({ qiymat: 1227100, manzil: { varaq: 'трансп.', qator: 5, ustun: 10 } });
    expect(e.svodQatori).toMatchObject({ xom: 'ЗАТРАТЫ НА ТРАНСПОРТНЫЕ РАСХОДЫ', manzil: { varaq: 'сводн.', qator: 5 }, dalil: { qoida: 'formula', ishonch: 'yuqori' } });
    expect(e.holat).toBe('kutmoqda');
  });

  it('formula yo\'q — faqat qiymat tengligi (o\'rta); ИТОГО yo\'q — null va review', () => {
    const a = kitobAnatomiyasi({ fayl: 'f.xlsx', varaqlar: [{ nom: 'сводн.', rows: SVOD }, { nom: 'трансп.', rows: TRANSP }] });
    expect(a.erkin[0].svodQatori?.dalil).toMatchObject({ qoida: 'qiymat_tengligi', ishonch: 'orta' });
    const b = kitobAnatomiyasi({ fayl: 'g.xlsx', varaqlar: [{ nom: 'трансп.', rows: TRANSP.slice(0, 4) }] });
    expect(b.erkin[0].yakuniy).toBeNull();
    expect(b.review.some((r) => r.kod === 'erkin_summa_yoq')).toBe(true);
  });
});
