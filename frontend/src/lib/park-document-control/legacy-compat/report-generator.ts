import { calculatePark, forma3Unresolved, parkScenarioFixture } from '..';
import { compareLegacyScenario, legacyBlRsGolden } from './index';
import type { LegacyRegressionReport } from './types';

/** Machine-readable compatibility output for CI, release evidence and Claude's adapter tests. */
export function generateParkLegacyCompatibilityReport(): LegacyRegressionReport[] {
  const legacyMatch = compareLegacyScenario('legacy_bl_rs_previous_current_cumulative', legacyBlRsGolden);
  const park = calculatePark(parkScenarioFixture);
  const priceVariance = park.lines.find(line => line.lineId === 'mat-cement')!.priceVariance;
  const changeControl: LegacyRegressionReport = {
    scenario: 'approved_pending_change_control', legacyResult: { legacyChangeSemantics: 'not_authoritative' },
    parkResult: { pendingChangeEstimateValue: park.pendingChangeEstimateValue, warnings: park.warnings }, status: 'INTENTIONAL_CHANGE',
    difference: { pending_change_value: park.pendingChangeEstimateValue },
    reason: 'PARK exposes pending changes separately; they do not alter canonical entitlement or frozen periods.',
  };
  const priceControl: LegacyRegressionReport = {
    scenario: 'actual_material_price_is_separate_from_estimate', legacyResult: { actualPriceHistory: 'not_normalized' },
    parkResult: { estimateValue: park.cumulativeEstimateValue, actualValue: park.actualValue, priceVariance }, status: 'INTENTIONAL_CHANGE',
    difference: { price_variance: priceVariance },
    reason: 'Actual material/execution price is reported separately and never overwrites estimate/reference price.',
  };
  const forma3: LegacyRegressionReport = {
    scenario: 'forma3_legal_total', legacyResult: {}, parkResult: { code: forma3Unresolved.code, blockedOutputs: forma3Unresolved.blockedOutputs },
    status: 'UNRESOLVED', difference: { legal_total: null }, reason: 'No authoritative Forma-3 rule evidence is mapped.',
  };
  return [legacyMatch, changeControl, priceControl, forma3];
}

export function generateParkLegacyCompatibilityJson() { return JSON.stringify(generateParkLegacyCompatibilityReport(), null, 2); }
