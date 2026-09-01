import { describe, expect, it } from 'vitest';
import { calculatePark, forma3Unresolved, parkScenarioFixture, roundMoney, roundQuantity } from './index';

describe('PARK F2/nakopitelniy deterministic calculation', () => {
  it('reconciles previous/current/cumulative and keeps estimate and actual prices separate', () => {
    const result = calculatePark(parkScenarioFixture);
    expect(result.previousEstimateValue).toBe(6_000_000);
    expect(result.currentEstimateValue).toBe(7_900_000);
    expect(result.cumulativeEstimateValue).toBe(13_900_000);
    expect(result.actualValue).toBe(13_850_000);
    expect(result.priceVariance).toBe(-50_000);
  });

  it('includes approved changes, excludes pending changes and preserves remaining entitlement', () => {
    const result = calculatePark(parkScenarioFixture);
    const concrete = result.lines.find(line => line.lineId === 'work-concrete')!;
    const drainage = result.lines.find(line => line.lineId === 'work-drain')!;
    expect(concrete.approvedQuantity).toBe(120);
    expect(concrete.cumulativeQuantity).toBe(90);
    expect(concrete.remainingQuantity).toBe(30);
    expect(drainage.approvedQuantity).toBe(15);
    expect(drainage.remainingQuantity).toBe(10);
    expect(result.lines.find(line => line.lineId === 'work-finish')!.remainingQuantity).toBe(15);
    expect(result.lines.find(line => line.lineId === 'mat-cement-alt')!.approvedQuantity).toBe(1);
    expect(result.lines.find(line => line.lineId === 'waterproof-line')!.approvedQuantity).toBe(8);
    expect(result.pendingChangeEstimateValue).toBe(-1_000_000);
  });

  it('is idempotent and does not mutate frozen prior period history', () => {
    const before = structuredClone(parkScenarioFixture);
    expect(calculatePark(parkScenarioFixture)).toEqual(calculatePark(parkScenarioFixture));
    expect(parkScenarioFixture).toEqual(before);
  });

  it('marks over-certified quantity instead of hiding it with a negative balance', () => {
    const input = structuredClone(parkScenarioFixture);
    input.periods[1].lines[0].quantity = 90;
    const line = calculatePark(input).lines.find(item => item.lineId === 'work-concrete')!;
    expect(line.overCertified).toBe(true);
    expect(line.remainingQuantity).toBe(-10);
  });

  it('rejects an invalid period and makes Forma-3 unresolved rather than guessing legal meaning', () => {
    expect(() => calculatePark({ ...parkScenarioFixture, throughPeriod: 2 })).toThrow('PARK_PERIOD_OUT_OF_RANGE');
    expect(forma3Unresolved.code).toBe('FORMA3_RULE_UNRESOLVED');
  });

  it('uses deterministic construction rounding for quantity and money', () => {
    expect(roundQuantity(1 / 3)).toBe(0.333333);
    expect(roundMoney(10.005)).toBe(10.01);
  });
});
