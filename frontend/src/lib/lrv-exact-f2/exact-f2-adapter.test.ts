import { describe, expect, it } from 'vitest';
import { MISSING_CERTIFIED_PRICE, toExactF2ReadModel } from './exact-f2-adapter';

describe('exact F2 adapter', () => {
  it('must preserve a certified source amount even when quantity times price differs', () => {
    const result = toExactF2ReadModel({
      sourceLineId: 'f2-source-10', certifiedQuantity: 10, certifiedUnitPrice: 123.45,
      certifiedAmount: 1234.49, provenance: 'source_verified',
    });
    expect(result.certifiedAmount).toBe(1234.49);
    expect(result.calculatedAmount).toBe(1234.5);
    expect(result.amountMismatch).toBe(true);
  });

  it('does not invent a source amount for legacy evidence that is absent', () => {
    const result = toExactF2ReadModel({
      sourceLineId: 'legacy-line', certifiedQuantity: 10, certifiedUnitPrice: 123.45,
      certifiedAmount: null, provenance: 'legacy_unproven',
    });
    expect(result.certifiedAmount).toBeNull();
    expect(result.amountMismatch).toBe(false);
  });

  it('fails closed when certified price is absent without an explicit absent-price state', () => {
    expect(() => toExactF2ReadModel({
      sourceLineId: 'missing-price', certifiedQuantity: 10, certifiedUnitPrice: null,
      certifiedAmount: null, provenance: 'source_verified',
    })).toThrow(MISSING_CERTIFIED_PRICE);
  });

  it('permits only the explicit intentionally-absent price state', () => {
    expect(toExactF2ReadModel({
      sourceLineId: 'no-price-evidence', certifiedQuantity: 10, certifiedUnitPrice: null,
      certifiedAmount: null, provenance: 'price_intentionally_absent',
    }).calculatedAmount).toBeNull();
  });
});
