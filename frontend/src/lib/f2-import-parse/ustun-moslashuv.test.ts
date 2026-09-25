/**
 * Egasi (2026-09-25): "asosan bir xil bo'ladi, lekin ba'zi PTO lar F2 kabi
 * hujjatlarni qilganida ustun qo'shib qo'yishi yoki o'zgartirishi mumkin —
 * shunga moslasha olishi kerak". Har holat — sintetik, real shaklli F2 akt.
 */
import { describe, expect, it } from 'vitest';
import { f2UstunAniqla } from './columnDetect';
import { f2FaylOqiCore } from './treeBuild';
import { kitobAnatomiyasi } from '../smeta-anatomiya';
import type { SheetGrid } from './types';

/** Asl F2 akt shakli (TN/ABC4): 8 ustun. Resurs: norma × ish hajmi, narx, summa. */
const ASL_SARLAVHA = ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'НА ЕДИНИЦУ', 'ПО ПРОЕКТУ', 'НА.ЕД.ИЗМ', 'ОБЩАЯ'];
const RESURSLAR: Array<[string, string, string, number, number, number]> = [
  ['1-100', 'ЗАТРАТЫ ТРУДА РАБОЧИХ', 'чел.-ч', 0.5, 20, 25_000],
  ['2264', 'ЭКСКАВАТОР', 'маш.-ч', 0.05, 2, 310_000],
  ['С101', 'ПЕСОК', 'м3', 1.1, 44, 120_000],
  ['С401', 'БЕТОН В25', 'м3', 1.02, 40.8, 900_000],
];

/** `qoshimcha(ustunNomi, qiymat)` — PTO qo'shgan ustun: (sarlavha, joy, qiymat funksiyasi). */
function f2(sarlavha: string[], qator: (r: typeof RESURSLAR[number]) => Array<string | number | null>): SheetGrid {
  return [
    ['АКТ ПРИЕМКИ ВЫПОЛНЕННЫХ РАБОТ (Ф-2)'],
    sarlavha,
    sarlavha.map((_s, i) => i + 1),
    ['1', 'Е01-01', 'РАЗРАБОТКА ГРУНТА', 'м3', 40, null, null, 1_000_000],
    ...RESURSLAR.map(qator),
  ] as SheetGrid;
}

describe('F2 ustunlarini moslashuvchan tushunish', () => {
  it('asl shakl: sarlavha ma’lumot bilan tasdiqlanadi (ishonch yuqori)', () => {
    const d = f2UstunAniqla(f2(ASL_SARLAVHA, (r) => ['', r[0], r[1], r[2], r[3], r[4], r[5], r[4] * r[5]]));
    expect([d.obyom, d.narx, d.sum]).toEqual([5, 6, 7]);
    expect(d.dalil).toMatchObject({ qoida: 'sarlavha', ishonch: 'yuqori' });
  });

  it('PTO "КОЛ-ВО ПО СМЕТЕ" qo‘shib, "ПО ПРОЕКТУ" ni "ВЫПОЛНЕНО" deb o‘zgartirgan — bajarilgan hajm olinadi', () => {
    const sarlavha = ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'НА ЕДИНИЦУ', 'КОЛ-ВО ПО СМЕТЕ', 'ВЫПОЛНЕНО', 'ЦЕНА', 'СУММА'];
    const grid = f2(sarlavha, (r) => ['', r[0], r[1], r[2], r[3], r[4] * 3, r[4], r[5], r[4] * r[5]]);
    const d = f2UstunAniqla(grid);
    expect([d.obyom, d.narx, d.sum]).toEqual([6, 7, 8]);
    expect(d.dalil?.qoida).toBe('arifmetika');
    expect(d.dalil?.izoh).toContain('hajm: 6→7-ustun');
    expect(d.qoshimcha).toEqual([{ ustun: 5, sarlavha: 'КОЛ-ВО ПО СМЕТЕ' }]);
    // To'liq o'qish: daraxtdagi PESOK hajmi bajarilgan 44, smetadagi 132 emas.
    const t = f2FaylOqiCore(grid, d);
    if (!('tree' in t)) throw new Error('daraxt kutilgan edi');
    const barglar = JSON.stringify(t.tree);
    expect(barglar).toContain('ПЕСОК');
    expect(barglar).not.toContain('132');
  });

  it('"ОБЩАЯ" "СТОИМОСТЬ ВСЕГО, СУМ" deb qayta nomlangan va oxiriga "ПРИМЕЧАНИЕ" qo‘shilgan', () => {
    const sarlavha = [...ASL_SARLAVHA.slice(0, 7), 'ИТОГО СТОИМОСТЬ, СУМ', 'ПРИМЕЧАНИЕ'];
    const d = f2UstunAniqla(f2(sarlavha, (r) => ['', r[0], r[1], r[2], r[3], r[4], r[5], r[4] * r[5], 'по акту 7']));
    expect([d.obyom, d.narx, d.sum]).toEqual([5, 6, 7]);
    expect(d.qoshimcha).toEqual([{ ustun: 8, sarlavha: 'ПРИМЕЧАНИЕ' }]);
  });

  it('PTO narx va summa joyini almashtirgan, oraga "ОСТАТОК" (sonli) qo‘shgan', () => {
    const sarlavha = ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'НА ЕДИНИЦУ', 'ПО ПРОЕКТУ', 'СУММА', 'ОСТАТОК', 'ЦЕНА'];
    const d = f2UstunAniqla(f2(sarlavha, (r) => ['', r[0], r[1], r[2], r[3], r[4], r[4] * r[5], 7, r[5]]));
    expect([d.obyom, d.sum, d.narx]).toEqual([5, 6, 8]);
    expect(d.qoshimcha?.map((q) => q.sarlavha)).toEqual(['ОСТАТОК']);
  });

  it('isbot yetarli bo‘lmasa (narxsiz akt) — sarlavha natijasi qoladi, ishonch past (taxmin yo‘q)', () => {
    const d = f2UstunAniqla(f2(ASL_SARLAVHA, (r) => ['', r[0], r[1], r[2], r[3], r[4], null, null]));
    expect([d.obyom, d.narx, d.sum]).toEqual([5, 6, 7]);
    expect(d.dalil?.ishonch).toBe('past');
  });
});

describe('Smeta anatomiyasi — PTO o‘zgartirgan LRV ustunlari', () => {
  it('LRV da "КОЛ-ВО ПО СМЕТЕ" + "ВЫПОЛНЕНО" — anatomiya ma’lumot bo‘yicha hajm/narx/summa ni topadi, qo‘shimcha ustun ko‘rsatiladi', () => {
    const rows = [
      ['ЛОКАЛЬНАЯ СМЕТА № 01-01'],
      ['№', 'ШИФР', 'НАИМЕНОВАНИЕ РАБОТ И ЗАТРАТ', 'ЕД.ИЗМ', 'НА ЕДИНИЦУ', 'КОЛ-ВО ПО СМЕТЕ', 'ВЫПОЛНЕНО', 'ЦЕНА', 'СУММА', 'ПРИМЕЧАНИЕ'],
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      ['РАЗДЕЛ 1. ЗЕМЛЯНЫЕ РАБОТЫ'],
      [1, 'Е01-01', 'РАЗРАБОТКА ГРУНТА', 'м3', null, 120, 40, null, 1_000_000, ''],
      ...RESURSLAR.map((r, i) => [`1.${i + 1}`, r[0], r[1], r[2], r[3], r[4] * 3, r[4], r[5], r[4] * r[5], 'проверено']),
    ];
    const a = kitobAnatomiyasi({ fayl: 'x.xlsx', varaqlar: [{ nom: 'LRV', rows }] });
    const v = a.varaqlar[0];
    expect(v.rol).toBe('lrv');
    expect([v.ustunlar?.hajmLoyiha, v.ustunlar?.narx, v.ustunlar?.summa]).toEqual([6, 7, 8]);
    expect(v.rolDalil.some((d) => d.qoida === 'ustunlar:arifmetika')).toBe(true);
    expect(v.qoshimchaUstunlar?.map((q) => q.sarlavha)).toEqual(['КОЛ-ВО ПО СМЕТЕ', 'ПРИМЕЧАНИЕ']);
  });
});
