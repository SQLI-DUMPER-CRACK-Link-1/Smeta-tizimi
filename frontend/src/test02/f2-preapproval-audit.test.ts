import { describe, expect, it } from 'vitest';
import { f2IstisnolarniGuruhla } from './f2-preapproval-audit';

describe('F2 pre-approval istisno guruhlari', () => {
  it('faqat kelgan istisnolarni turlari bo\'yicha ajratadi', () => {
    const result = f2IstisnolarniGuruhla([
      { turi: 'NEEDS_REVIEW', qatorId: 10 },
      { turi: 'ARITHMETIC_MISMATCH', qatorId: 11, hisoblangan: 100, hujjatdagi: 99.99, farq: 0.01 },
      { turi: 'NEGATIVE_HAJM', qatorId: 12, hajm: -3 },
    ]);
    expect(result.NEEDS_REVIEW).toHaveLength(1);
    expect(result.ARITHMETIC_MISMATCH).toHaveLength(1);
    expect(result.NEGATIVE_HAJM).toHaveLength(1);
  });

  it('toza batch uchun bo\'sh to\'rtta guruh qaytaradi', () => {
    expect(f2IstisnolarniGuruhla([])).toEqual({ NEEDS_REVIEW: [], ARITHMETIC_MISMATCH: [], NEGATIVE_HAJM: [], CONFLICTING_PRICES: [] });
  });

  it('CONFLICTING_PRICES ham o\'z guruhiga tushadi (Claude tomonidan qo\'shilgan istisno turi)', () => {
    const result = f2IstisnolarniGuruhla([{ turi: 'CONFLICTING_PRICES', qatorId: 13, narxlar: [100, 150] }]);
    expect(result.CONFLICTING_PRICES).toHaveLength(1);
  });
});
