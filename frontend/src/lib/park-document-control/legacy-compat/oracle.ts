import { calculatePark, roundMoney, roundQuantity } from '..';
import type { LegacyCompatibilityInput, LegacyRegressionReport } from './types';
import { normalizeLegacyF2 } from './normalizer';

/** Legacy-compatible quantity oracle. It is intentionally limited to proven BL→RS propagation and F2 period sums. */
export function legacyQuantityOracle(input: LegacyCompatibilityInput) {
  const normalized = normalizeLegacyF2(input);
  const periods = normalized.input.periods.slice(0, input.throughPeriod + 1);
  const quantities: Record<string, number> = {};
  for (const period of periods) for (const item of period.lines) quantities[item.lineId] = roundQuantity((quantities[item.lineId] ?? 0) + item.quantity);
  const current = periods.at(-1)!;
  const currentQuantity = Object.fromEntries(current.lines.map(line => [line.lineId, line.quantity]));
  return { cumulativeQuantity: quantities, currentQuantity, periodCount: periods.length, warnings: normalized.warnings };
}

export function compareLegacyScenario(scenario: string, input: LegacyCompatibilityInput, expectedStatus: LegacyRegressionReport['status'] = 'MATCH'): LegacyRegressionReport {
  const normalized = normalizeLegacyF2(input); const legacy = legacyQuantityOracle(input); const park = calculatePark(normalized.input);
  const differences: Record<string, number | null> = {};
  for (const line of park.lines) differences[line.lineId] = roundQuantity((legacy.cumulativeQuantity[line.lineId] ?? 0) - line.cumulativeQuantity);
  const hasDifference = Object.values(differences).some(value => value !== 0);
  const status = hasDifference ? 'BUG_FOUND' : expectedStatus;
  return { scenario, legacyResult: legacy, parkResult: { lines: park.lines, cumulativeEstimateValue: park.cumulativeEstimateValue,
    currentEstimateValue: park.currentEstimateValue, warnings: park.warnings }, status,
    difference: differences, reason: hasDifference ? 'Legacy oracle and PARK cumulative quantities diverged.' : expectedStatus === 'MATCH' ? 'Proven legacy quantity behavior matches PARK.' : 'Classified by explicit scenario policy.' };
}

export function reportJson(report: LegacyRegressionReport) { return JSON.stringify(report, null, 2); }
