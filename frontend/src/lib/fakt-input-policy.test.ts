import { describe, expect, it } from 'vitest';
import { faktKiritishIzohi, faktQoldaKiritiladimi } from './fakt-input-policy';

describe('Fakt input policy', () => {
  it('operator faqat BL, MAT va OB qatoriga Fakt kiritishini ruxsat qiladi', () => {
    expect(['bl', 'mat', 'ob'].every(faktQoldaKiritiladimi)).toBe(true);
    expect(['rs', 'rz', 'unknown'].some(faktQoldaKiritiladimi)).toBe(false);
  });

  it('RS uchun norma asosidagi derivatsiyani aniq tushuntiradi', () => {
    expect(faktKiritishIzohi('rs')).toContain('BL Fakt');
    expect(faktKiritishIzohi('rs')).toContain('norma');
  });
});
