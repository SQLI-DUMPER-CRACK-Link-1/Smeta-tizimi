import { describe, expect, it } from 'vitest';
import { calculatePark, forma3Unresolved } from '..';
import { compareLegacyScenario, generateParkLegacyCompatibilityReport, legacyBlRsGolden, legacyQuantityOracle, legacyZeroAndOverCertification, normalizeLegacyF2, reportJson } from './index';

describe('PARK legacy compatibility regression lab', () => {
  it('normalizes BL/RS without treating a row number as canonical identity', () => {
    const normalized = normalizeLegacyF2(legacyBlRsGolden);
    expect(normalized.identities.find(item => item.parkLineId === 'rs-cement')!.identityKind).toBe('stable_id');
    expect(normalized.input.periods[0].lines.find(item => item.lineId === 'rs-cement')!.quantity).toBe(8);
    expect(normalized.input.periods[1].lines.find(item => item.lineId === 'rs-cement')!.quantity).toBe(12);
  });

  it('matches previous/current/cumulative BL and proportional RS legacy quantities', () => {
    const report = compareLegacyScenario('BL_RS_proportional', legacyBlRsGolden);
    const park = calculatePark(normalizeLegacyF2(legacyBlRsGolden).input);
    expect(report.status).toBe('MATCH');
    expect(park.lines.find(line => line.lineId === 'bl-concrete')!.cumulativeQuantity).toBe(100);
    expect(park.lines.find(line => line.lineId === 'rs-cement')!.currentQuantity).toBe(12);
    expect(park.lines.find(line => line.lineId === 'rs-steel')!.previousQuantity).toBe(5);
    expect(park.lines.find(line => line.lineId === 'rs-steel')!.cumulativeQuantity).toBe(10);
    expect(reportJson(report)).toContain('"status": "MATCH"');
  });

  it('flags legacy migration identity, preserves zero/empty periods and detects over-certification', () => {
    const normalized = normalizeLegacyF2(legacyZeroAndOverCertification);
    const result = calculatePark(normalized.input);
    expect(normalized.warnings).toEqual(['LEGACY_MIGRATION_IDENTITY:LRV_PLUS:42']);
    expect(result.lines[0].previousQuantity).toBe(0);
    expect(result.lines[0].currentQuantity).toBe(12);
    expect(result.lines[0].overCertified).toBe(true);
    expect(result.lines[0].estimateValue).toBe(120.06);
  });

  it('keeps revision input immutable and refuses fabricated Forma-3 legal totals', () => {
    const before = structuredClone(legacyBlRsGolden);
    legacyQuantityOracle(legacyBlRsGolden);
    expect(legacyBlRsGolden).toEqual(before);
    expect(forma3Unresolved.blockedOutputs).toContain('payment_due');
  });

  it('generates structured MATCH, intentional-change and unresolved evidence rather than a markdown-only report', () => {
    const report = generateParkLegacyCompatibilityReport();
    expect(report.map(item => item.status)).toEqual(['MATCH', 'INTENTIONAL_CHANGE', 'INTENTIONAL_CHANGE', 'UNRESOLVED']);
    expect(report[0]).toHaveProperty('legacyResult');
    expect(report[0]).toHaveProperty('parkResult');
    expect(report[0]).toHaveProperty('difference');
  });
});
