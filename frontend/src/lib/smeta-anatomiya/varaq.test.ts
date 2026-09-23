import { describe, expect, it } from 'vitest';
import { kitobAnatomiyasi, sarlavhaYoli } from './index';
import { son } from './matn';
import type { Katak } from './turlar';

/** ABC4 lokal LRV shakli (sintetik, real fayl tuzilmasidan). */
const ABC4_LRV: Katak[][] = [
  ['НАИМЕНОВАНИЕ СТРОЙКИ: НАВОИЙ'],
  ['НАИМЕНОВАНИЕ ОБЪЕКТА: ИСКУССТВЕННАЯ ОЗЕРА'],
  [],
  ['ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ № 01-04'],
  ['КОЛОДЦЕВ (ПРОФИЛЬ К1)'],
  ['№№', 'ОБОСНОВАНИЕ', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'КОЛ-ВО'],
  [null, null, null, null, 'НА ЕДИНИЦУ', 'ПО ПРОЕКТУ'],
  [1, 2, 3, 4, 5, 6],
  ['РАЗДЕЛ: КОЛОДЕЦ (ЛИСТ .-39)'],
  ['ЗЕМЛЯНЫЕ РАБОТЫ'],
  ['1', 'E1-1-195-20', 'РАЗРАБОТКА ГРУНТА', '1000М3', '0,01017'],
  ['1.1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '5,02', '0,0510534'],
  ['1.2', '001942', 'ЭКСКАВАТОРЫ', 'МАШ-Ч', '10,59', null],
  ['КОЛОДЕЦ К1'],
  ['2', '615-1', 'БЕТОН КЛ. В12,5', 'М3', '3,6'],
  ['ВЕДОМОСТЬ РЕСУРСОВ'],
  ['ТРУДОВЫЕ РЕСУРСЫ'],
  ['1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '323,19'],
  [null, null, 'Составил: ____ САМАТОВ'],
];

/** Faravon "БВ"/"БР" shakli: titul izohlari, bir xil sarlavha. */
const FARAVON_BR: Katak[][] = [
  [null, 'НА СТРОИТЕЛЬСТВО ДОРОГИ'],
  [null, '(наименование стройки)'],
  ['на', 'ДОРОЖНАЯ ОДЕЖДА. УЧАСТОК №1.'],
  [null, '(наименование работ и затрат, наименование объекта)'],
  ['N п.п.', 'Шифр номера нормативов и коды ресурсов', 'Наименование работ и затрат', 'Единица измерения', 'Количество ', 'Сметная стоимость'],
  [null, null, null, null, null, 'в текущем (прогнозном)'],
  [null, null, null, null, null, 'на.ед.изм.', 'общая'],
  [1, 2, 3, 4, 5, 6, 7],
  [null, null, 'ТРУДОВЫЕ РЕСУРСЫ'],
  ['1', '1', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ.-Ч', 12315.2466, 29421.2, 362329333],
  [null, 'ИТОГО ПО ТРУДОВЫМ РЕСУРСАМ:', null, 'СУМ', null, null, 362329333],
];

describe('varaq anatomiyasi', () => {
  it('ABC4 LRV: rol, titul yo\'li, ish/resurs, vergulli son, NULL saqlanadi, vedomost ajraladi', () => {
    const a = kitobAnatomiyasi({ fayl: 'k.xls', varaqlar: [{ nom: 'LRV', rows: ABC4_LRV }] });
    const v = a.varaqlar[0];
    expect(v.rol).toBe('lrv');
    expect(v.ishlar.map((i) => i.tartib)).toEqual(['1', '2']);
    const ish = v.ishlar[0];
    expect(ish.hajm).toBe(0.01017);
    expect(ish.resurslar[0]).toMatchObject({ normaBirlikka: 5.02, hajm: 0.0510534 });
    expect(ish.resurslar[1].hajm).toBeNull(); // bo'sh katak 0 EMAS
    const barcha = [...v.titul, ...v.sarlavhalar];
    expect(sarlavhaYoli(barcha, ish.sarlavha).map((s) => s.xom))
      .toEqual(['ИСКУССТВЕННАЯ ОЗЕРА', 'КОЛОДЦЕВ (ПРОФИЛЬ К1)', 'РАЗДЕЛ: КОЛОДЕЦ (ЛИСТ .-39)', 'ЗЕМЛЯНЫЕ РАБОТЫ']);
    expect(sarlavhaYoli(barcha, v.ishlar[1].sarlavha).at(-1)!.xom).toBe('КОЛОДЕЦ К1');
    expect(v.titul.find((s) => s.tur === 'lokal')!.belgi).toBe('№ 01-04');
    expect(v.vedomost).toHaveLength(1);
    expect(v.vedomost[0].guruh).toBe('ТРУДОВЫЕ РЕСУРСЫ');
    expect(v.ishlar[0].manzil).toMatchObject({ varaq: 'LRV', qator: 11, ustun: 3 });
    expect(v.review).toEqual([]);
  });

  it('Faravon БР: sarlavhasi LRV ga o\'xshasa ham ma\'lumot shakli bo\'yicha RES', () => {
    const a = kitobAnatomiyasi({ fayl: 'f.xlsx', varaqlar: [{ nom: '4230_БР', rows: FARAVON_BR }] });
    const v = a.varaqlar[0];
    expect(v.rol).toBe('res');
    expect(v.ustunlar).toMatchObject({ tartib: 0, shifr: 1, nom: 2, birlik: 3, hajmLoyiha: 4, narx: 5, summa: 6 });
    expect(v.vedomost[0]).toMatchObject({ xom: 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', hajm: 12315.2466, narx: 29421.2, summa: 362329333, guruh: 'ТРУДОВЫЕ РЕСУРСЫ' });
    expect(v.jamilar[0].qiymat).toBe(362329333);
  });

  it('F5_UZB va LRV bir xil ishlar bersa — biri asosiy, biri dublikat', () => {
    const a = kitobAnatomiyasi({ fayl: 'k.xls', varaqlar: [{ nom: 'F5_UZB', rows: ABC4_LRV }, { nom: 'LRV', rows: ABC4_LRV }] });
    expect(a.asosiyLrv).toBe('F5_UZB');
    expect(a.dublikat).toEqual([{ varaq: 'LRV', asl: 'F5_UZB', sabab: expect.any(String) }]);
  });
});

describe('son', () => {
  it('vergul, bo\'shliq, qavs; son emas → null', () => {
    expect(son('0,0510534')).toBe(0.0510534);
    expect(son('1 234,5')).toBe(1234.5);
    expect(son('(12)')).toBe(-12);
    expect(son('')).toBeNull();
    expect(son('ЦЕНА')).toBeNull();
    expect(son('1.2.3')).toBeNull();
  });
});
