import { describe, expect, it } from 'vitest';
import { varaqniTahlilQil } from './varaq';
import { anatomiyadanAktDaraxt, daraxtBarglari, daraxtlarTengmi } from './akt-daraxt';
import type { AktNode } from '../f2-match-engine';
import type { Katak } from './turlar';

const ROWS: Katak[][] = [
  ['НАИМЕНОВАНИЕ ОБЪЕКТА: ИСКУССТВЕННАЯ ОЗЕРА'],
  ['ЛОКАЛЬНАЯ РЕСУРСНАЯ ВЕДОМОСТЬ № 01-04'],
  ['КОЛОДЦЕВ (ПРОФИЛЬ К1)'],
  ['№№', 'ОБОСНОВАНИЕ', 'НАИМЕНОВАНИЕ РАБОТ И РЕСУРСОВ', 'ЕД.ИЗМ', 'КОЛ-ВО'],
  [null, null, null, null, 'НА ЕДИНИЦУ', 'ПО ПРОЕКТУ'],
  [1, 2, 3, 4, 5, 6],
  ['РАЗДЕЛ: КОЛОДЕЦ'],
  ['1', 'E1', 'РАЗРАБОТКА ГРУНТА', '1000М3', '0,01'],
  ['ЗЕМЛЯНЫЕ РАБОТЫ'],
  ['2', 'E2', 'ЗАСЫПКА', '100М3', '0,5'],
  ['2.1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '10', '5'],
  ['3', '615-1', 'БЕТОН КЛ. В12,5', 'М3', '3,6'],
  ['4', '', 'ХАЖМСИЗ ИШ', 'М3', null],
  ['ВЕДОМОСТЬ РЕСУРСОВ'],
  ['ТРУДОВЫЕ РЕСУРСЫ'],
  ['1', '000001', 'ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ', 'ЧЕЛ-Ч', '5'],
];

describe('anatomiyadanAktDaraxt', () => {
  const v = varaqniTahlilQil('k.xls', { nom: 'LRV', rows: ROWS });
  const { tree, otkazildi } = anatomiyadanAktDaraxt(v);

  it('RZ ichma-ich va hujjat tartibida; titul obyekti daraxtga kirmaydi', () => {
    expect(tree).toHaveLength(1);
    const lokal = tree[0];
    expect(lokal).toMatchObject({ type: 'rz', nom: 'КОЛОДЦЕВ (ПРОФИЛЬ К1)' });
    const razdel = lokal.children![0];
    expect(razdel).toMatchObject({ type: 'rz', nom: 'РАЗДЕЛ: КОЛОДЕЦ' });
    // РАЗДЕЛ ichida: avval o'z ishi (1), keyin bola blok — hujjat tartibi.
    expect(razdel.children!.map((n) => [n.type, n.nom])).toEqual([
      ['mat', 'РАЗРАБОТКА ГРУНТА'],
      ['rz', 'ЗЕМЛЯНЫЕ РАБОТЫ'],
    ]);
  });

  it('bl/rs/mat treeBuild qoidasi; hajmsiz qator o\'tkaziladi; vedomost ish emas', () => {
    expect(daraxtBarglari(tree)).toEqual([
      `mat|E1|РАЗРАБОТКА ГРУНТА|${(0.01).toPrecision(12)}`,
      `bl|E2|ЗАСЫПКА|${(0.5).toPrecision(12)}`,
      `rs|000001|ЗАТРАТЫ ТРУДА РАБОЧИХ-СТРОИТЕЛЕЙ|${(5).toPrecision(12)}`,
      `mat|615-1|БЕТОН КЛ. В12,5|${(3.6).toPrecision(12)}`,
    ]);
    expect(otkazildi).toBe(1);
    const rs = (tree[0].children![0].children![1].children![0].children![0]) as AktNode & { norma?: number };
    expect(rs.norma).toBe(10);
  });
});

describe('daraxtlarTengmi', () => {
  const barg = (type: AktNode['type'], nom: string, hajm: number): AktNode => ({ uid: nom, type, nom, hajm, kod: '' });
  const yangi = [{ uid: 'r', type: 'rz' as const, nom: 'R', children: [barg('bl', 'A', 1), barg('mat', 'B', 2)] }];

  it('RZ farqi e\'tiborsiz — barglar teng bo\'lsa teng', () => {
    const eski = [{ uid: 'x', type: 'rz' as const, nom: 'X', children: [barg('bl', 'A', 1)] }, { uid: 'y', type: 'rz' as const, nom: 'Y', children: [barg('mat', 'B', 2)] }];
    expect(daraxtlarTengmi(eski, yangi)).toMatchObject({ teng: true, vedomostChiqarildi: 0 });
  });

  it('ortiqcha eski barglar faqat vedomostdan bo\'lsa — teng + vedomostChiqarildi', () => {
    const eski = [...yangi, { uid: 'v', type: 'rz' as const, nom: 'ВЕДОМОСТЬ', children: [barg('mat', 'ЦЕМЕНТ', 9)] }];
    expect(daraxtlarTengmi(eski, yangi, ['ЦЕМЕНТ'])).toMatchObject({ teng: true, vedomostChiqarildi: 1 });
    expect(daraxtlarTengmi(eski, yangi, ['БОШҚА'])).toMatchObject({ teng: false });
  });

  it('hajm yoki tartib farq qilsa — teng emas', () => {
    const eski = [{ uid: 'r', type: 'rz' as const, nom: 'R', children: [barg('mat', 'B', 2), barg('bl', 'A', 1)] }];
    expect(daraxtlarTengmi(eski, yangi).teng).toBe(false);
    const eski2 = [{ uid: 'r', type: 'rz' as const, nom: 'R', children: [barg('bl', 'A', 1.5), barg('mat', 'B', 2)] }];
    expect(daraxtlarTengmi(eski2, yangi).teng).toBe(false);
  });
});
