import type { EstimateDocument, ValidationIssue } from './types';

export function validateCanonicalEstimate(document: EstimateDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const section of document.sections) for (const work of section.items) {
    if (work.quantity != null && !work.unit) issues.push({ severity: 'error', code: 'WORK_UNIT_REQUIRED', message: `${work.name} has quantity but no unit.`, requiredAction: 'Supply an explicit unit.' });
    if (!work.source.length) issues.push({ severity: 'error', code: 'WORK_EVIDENCE_REQUIRED', message: `${work.name} has no source evidence.`, requiredAction: 'Attach source evidence.' });
  }
  return issues;
}
