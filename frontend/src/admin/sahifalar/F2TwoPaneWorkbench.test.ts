import { describe, expect, it } from 'vitest';
import { flatSourceNodes } from './F2TwoPaneWorkbench';
import type { F2ExactManbaTugun } from '../../test02/f2-exact-payload';

/**
 * T2-F2-IMPORT-TUR-CASCADE-001: haqiqiy hodisa -- F2 import sessiyasi
 * qayta tiklanganda (resume), asl daraxt (rz/bl/rs/mat/ob) yo'qoladi,
 * faqat tekis qoralama qatorlari qoladi. Bu fallback funksiya avval
 * HAMMA qatorni majburan 'rs' deb belgilardi -- ob (jihoz) ham, mat
 * (material) ham "oddiy resurs" bo'lib ko'rinardi. Endi qoralamada
 * saqlangan haqiqiy `tur`dan foydalanadi.
 */
describe('flatSourceNodes', () => {
  const labels = new Map([['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']]);

  it('qoralamada saqlangan haqiqiy turni ishlatadi -- rs va ob aralashtirilmaydi', () => {
    const flat: F2ExactManbaTugun[] = [
      { uid: 'a', hajm: 1, narx: 10, summa: 10, tur: 'rs' },
      { uid: 'b', hajm: 2, narx: 20, summa: 40, tur: 'ob' },
      { uid: 'c', hajm: 3, narx: 30, summa: 90, tur: 'mat' },
    ];
    const nodes = flatSourceNodes(flat, labels);
    expect(nodes.map((n) => n.type)).toEqual(['rs', 'ob', 'mat']);
  });

  it('eski (tur maydoni qo\'shilishidan oldingi) qoralamada -- tur yo\'q bo\'lsa "rs"ga qaytadi', () => {
    const flat: F2ExactManbaTugun[] = [{ uid: 'd', hajm: 1, narx: 10, summa: 10 }];
    const nodes = flatSourceNodes(flat, labels);
    expect(nodes[0].type).toBe('rs');
  });

  it('noma\'lum/buzilgan tur qiymatini xavfsiz "rs"ga tushiradi', () => {
    const flat: F2ExactManbaTugun[] = [{ uid: 'a', hajm: 1, narx: 10, summa: 10, tur: 'noma-lum' }];
    const nodes = flatSourceNodes(flat, labels);
    expect(nodes[0].type).toBe('rs');
  });
});
