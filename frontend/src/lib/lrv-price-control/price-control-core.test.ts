import { describe, expect, it } from 'vitest';
import { calculateAtRiskAmount, calculateFrozenAmount, classifyCertifiedPrice, effectiveReferencePrice, validatePriceBasis } from './price-control-core';
describe('LRV price control', () => {
  it('freezes approved below-reference F2 only', () => expect(calculateFrozenAmount(500,80,100,true)).toBe(10000));
  it('classifies matrix deterministically', () => { expect(classifyCertifiedPrice(100,effectiveReferencePrice(null,100))).toBe('NORMAL'); expect(classifyCertifiedPrice(120,effectiveReferencePrice(115,100))).toBe('ABOVE_APPROVED_BASIS'); });
  it('keeps draft only at risk', () => { expect(calculateFrozenAmount(10,80,100,false)).toBe(0); expect(calculateAtRiskAmount(10,120,100,false)).toBe(200); });
  it('requires approved basis for additional work', () => { const r=validatePriceBasis(true,effectiveReferencePrice(null,null)); expect(r.ok).toBe(false); if(!r.ok) expect(r.code).toBe('PRICE_BASIS_REQUIRED'); });
});
