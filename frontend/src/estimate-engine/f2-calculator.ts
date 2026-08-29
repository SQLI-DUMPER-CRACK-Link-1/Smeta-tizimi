import type { F2Draft, F2Input, ValidationIssue } from './types';

const round = (value: number) => Math.round((value + Number.EPSILON) * 1e6) / 1e6;
export function calculateF2Draft(input: F2Input, policy: 'warning' | 'block' = 'warning'): F2Draft {
  const values = [input.previousCertified, input.currentReported, input.estimateQuantity];
  if (values.some(value => value != null && (!Number.isFinite(value) || value < 0))) throw new Error('F2 quantities must be non-negative finite numbers');
  const issues: ValidationIssue[] = []; const cumulative = round(input.previousCertified + input.currentReported);
  const unmatchedWork = !input.matchedEstimateItemId || input.estimateQuantity == null;
  if (unmatchedWork) issues.push({ severity: 'block', code: 'UNMATCHED_WORK', message: 'Work has no canonical estimate-item match; it must not be silently added to F2.', requiredAction: 'Match an existing smeta item or create it through the approved workflow.' });
  let remaining: number | undefined;
  if (input.estimateQuantity != null) {
    remaining = round(input.estimateQuantity - cumulative);
    if (cumulative > input.estimateQuantity) issues.push({ severity: policy === 'block' ? 'block' : 'warning', code: 'F2_EXCEEDS_ESTIMATE', message: `Certified cumulative quantity ${cumulative} ${input.unit} exceeds estimate quantity ${input.estimateQuantity} ${input.unit}.`, requiredAction: 'Review quantities and approval policy.' });
  }
  return { current: input.currentReported, cumulative, remaining, unmatchedWork, issues };
}
