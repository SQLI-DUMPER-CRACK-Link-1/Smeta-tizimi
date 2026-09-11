import { describe, expect, it } from 'vitest';
import { nakrutkaMatSof } from './t2-nakrutka';

describe('nakrutka material bucket presentation', () => {
  it('shows only the plain MAT part when the API mat value is the full bucket', () => {
    expect(nakrutkaMatSof({ mat: 1000, mk: 200, kab: 150, bez: 50 })).toBe(600);
  });

  it('does not produce a negative plain MAT value for inconsistent input', () => {
    expect(nakrutkaMatSof({ mat: 100, mk: 80, kab: 40, bez: 20 })).toBe(0);
  });
});
