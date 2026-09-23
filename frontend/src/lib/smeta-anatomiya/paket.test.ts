import { describe, expect, it } from 'vitest';
import { paketAnatomiyasi, lokalSarlavhasi } from './paket';
import { sarlavhaYoli } from './ierarxiya';
import type { Katak } from './turlar';

/** ABC4 STR LRV shakli: lokallar "РАЗДЕЛ: СМЕТА № …" bilan, obyekt yo'q. */
const STR: Katak[][] = [
  ['СВОДНАЯ ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ 1'],
  ['№№', 'ОБОСНОВАНИЕ', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'КОЛ-ВО'],
  [null, null, null, null, 'НА ЕДИНИЦУ', 'ПО ПРОЕКТУ'],
  [1, 2, 3, 4, 5, 6],
  ['РАЗДЕЛ: СМЕТА № 01 НА НАСОСНАЯ №1'],
  ['РАЗДЕЛ: ФУНДАМЕНТ'],
  ['1', 'E1', 'БЕТОН', 'М3', '2'],
  ['1.1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '5', '10'],
  ['РАЗДЕЛ: СМЕТА № 01 НА НАСОСНО-ФИЛЬТРОВАЛЬНАЯ ОБОРУДОВАНИЕ'],
  ['РАЗДЕЛ: НАСОСНАЯ'],
  ['2', 'E2', 'МОНТАЖ', 'ШТ', '1'],
  ['2.1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '7', '7'],
];

/** CB_DET2 svod: bir xil "01" raqami ikki obyektda — tartib va nom hal qiladi. */
const SVOD: Katak[][] = [
  ['Сводный расчет по статьям затрат'],
  ['№№', '№№ рег.', 'Наименование объектов и смет', 'Затраты труда (чел-час)', 'Наименование затрат'],
  [1, 2, 3, 4, 5],
  ['ИСКУССТВЕННАЯ ОЗЕРА'],
  ['01', '13.08.2026', 'НАСОСНАЯ №1', 10, 0],
  [null, null, 'ИТОГО', 10, 0],
  ['ФОНТАН'],
  ['01', null, 'НАСОСНО-ФИЛЬТРОВАЛЬНАЯ ОБОРУДОВАНИЕ', 8, 0],
];

describe('paket: svod orqali obyekt darajasi (D8)', () => {
  it('lokal sarlavha shakli', () => {
    expect(lokalSarlavhasi('РАЗДЕЛ: СМЕТА № 01-01 НА КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА')).toEqual({ raqam: '01-01', nom: 'КОНСТРУКТИВНАЯ ЧАСТЬ-ОЗЕРА' });
    expect(lokalSarlavhasi('РАЗДЕЛ: ФУНДАМЕНТ')).toBeNull();
  });

  it('lokallar obyektlarga bog\'lanadi; mehnat mos — yuqori, farq — past + review', () => {
    const pk = paketAnatomiyasi([
      { fayl: 'str.xls', varaqlar: [{ nom: 'LRV', rows: STR }] },
      { fayl: 'svod.xls', varaqlar: [{ nom: '$ТИТУЛ$', rows: SVOD }] },
    ]);
    expect(pk.svod.map((s) => `${s.obyekt}/${s.raqam}/${s.chelSoat}`)).toEqual(['ИСКУССТВЕННАЯ ОЗЕРА/01/10', 'ФОНТАН/01/8']);
    expect(pk.boglanish.map((b) => [b.svod?.obyekt, b.ishonch, b.farq])).toEqual([
      ['ИСКУССТВЕННАЯ ОЗЕРА', 'yuqori', 0],
      ['ФОНТАН', 'past', -1],
    ]);
    const v = pk.kitoblar[0].varaqlar[0];
    const barcha = [...v.titul, ...v.sarlavhalar];
    expect(sarlavhaYoli(barcha, v.ishlar[0].sarlavha).map((s) => s.xom))
      .toEqual(['ИСКУССТВЕННАЯ ОЗЕРА', 'РАЗДЕЛ: СМЕТА № 01 НА НАСОСНАЯ №1', 'РАЗДЕЛ: ФУНДАМЕНТ']);
    expect(sarlavhaYoli(barcha, v.ishlar[1].sarlavha)[0].xom).toBe('ФОНТАН');
    expect(sarlavhaYoli(barcha, v.ishlar[1].sarlavha).map((s) => s.daraja)).toEqual([1, 2, 3]);
    expect(v.review.some((r) => r.kod === 'svod_mehnat_farqi')).toBe(true);
  });

  it('svod yo\'q — hech narsa o\'ylab topilmaydi', () => {
    const pk = paketAnatomiyasi([{ fayl: 'str.xls', varaqlar: [{ nom: 'LRV', rows: STR }] }]);
    expect(pk.boglanish).toEqual([]);
    expect(pk.kitoblar[0].varaqlar[0].sarlavhalar.some((s) => s.tur === 'obyekt')).toBe(false);
  });
});
