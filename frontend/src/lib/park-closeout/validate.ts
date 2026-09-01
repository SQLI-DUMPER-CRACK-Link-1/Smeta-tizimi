import type { CloseoutDocumentMetadata, CloseoutRequirement, CloseoutReportRow, ExportConsistencyIssue, ParkCloseoutReadModel, ParkCloseoutValidation, ParkExportPeriod } from './types';
const EPS = 0.000001;
const same = (a: number, b: number) => Math.abs(a - b) <= EPS;
const blocking = (status: string) => ['missing', 'rejected', 'unresolved'].includes(status);

function documentFor(requirement: CloseoutRequirement, documents: readonly CloseoutDocumentMetadata[]) {
  return documents.filter(document => document.type === requirement.type && (!requirement.periodId || document.periodId === requirement.periodId));
}
export function validateCloseoutRequirements(model: Pick<ParkCloseoutReadModel, 'objectId' | 'documents' | 'requirements'>): CloseoutReportRow[] {
  return model.requirements.map(requirement => {
    if (requirement.evidenceRule === 'forma3_unresolved') return { objectId: model.objectId, requirement: requirement.requirementId, status: 'unresolved', blocking: requirement.required, evidenceIds: [], reason: 'FORMA3_RULE_UNRESOLVED' };
    const candidates = documentFor(requirement, model.documents).filter(document => document.status !== 'superseded');
    const selected = candidates.find(document => requirement.requiresApproved ? document.status === 'approved' : ['approved', 'present', 'pending'].includes(document.status));
    if (selected) return { objectId: model.objectId, requirement: requirement.requirementId, status: selected.status === 'approved' ? 'approved' : selected.status, blocking: false, evidenceIds: [selected.documentId, ...(selected.evidenceIds ?? [])], reason: selected.status === 'approved' ? 'Approved canonical evidence present.' : 'Evidence present but not approved.' };
    const rejected = candidates.find(document => document.status === 'rejected');
    const superseded = documentFor(requirement, model.documents).find(document => document.status === 'superseded');
    const status = rejected ? 'rejected' : superseded ? 'superseded' : requirement.required ? 'missing' : 'required';
    return { objectId: model.objectId, requirement: requirement.requirementId, status, blocking: requirement.required && blocking(status), evidenceIds: rejected ? [rejected.documentId] : superseded ? [superseded.documentId] : [], reason: rejected ? 'Evidence was rejected.' : superseded ? 'Only superseded evidence exists.' : requirement.required ? 'Required evidence is absent.' : 'Optional requirement.' };
  });
}
function issue(period: ParkExportPeriod, rule: string, condition: boolean, reason: string): ExportConsistencyIssue | null { return condition ? null : { periodId: period.periodId, rule, blocking: true, reason }; }
export function validateParkExport(periods: readonly ParkExportPeriod[]): ExportConsistencyIssue[] {
  const issues: ExportConsistencyIssue[] = [];
  const seenRevisions = new Set<string>();
  for (const period of periods) {
    const checks = [
      issue(period, 'PREVIOUS_PLUS_CURRENT_QUANTITY', same(period.previousQuantity + period.currentQuantity, period.cumulativeQuantity), 'previous + current quantity must equal cumulative quantity'),
      issue(period, 'PREVIOUS_PLUS_CURRENT_VALUE', same(period.previousValue + period.currentValue, period.cumulativeValue), 'previous + current value must equal cumulative value'),
      issue(period, 'ENTITLEMENT_QUANTITY', period.cumulativeQuantity <= period.approvedQuantity + EPS, 'cumulative quantity exceeds approved entitlement'),
      issue(period, 'ENTITLEMENT_VALUE', period.cumulativeValue <= period.approvedValue + EPS, 'cumulative value exceeds approved entitlement'),
      issue(period, 'FROZEN_HISTORY', period.frozen, 'export period must reference an immutable/frozen history revision'),
      issue(period, 'REVISION_ID_UNIQUE', !seenRevisions.has(period.revisionId), 'revision id is duplicated across export periods'),
      issue(period, 'PRICE_SOURCE_SEPARATION', !!period.referencePriceSourceId && !!period.actualPriceSourceId && period.referencePriceSourceId !== period.actualPriceSourceId, 'reference and actual price sources must be explicit and distinct'),
      issue(period, 'APPROVED_CHANGE_INCLUDED_ONCE', period.approvedChangeIds.length === period.includedApprovedChangeIds.length && period.approvedChangeIds.every(id => period.includedApprovedChangeIds.filter(candidate => candidate === id).length === 1), 'approved changes must be included exactly once'),
    ];
    seenRevisions.add(period.revisionId); issues.push(...checks.filter((item): item is ExportConsistencyIssue => item !== null));
  }
  return issues;
}
export function validateParkCloseout(model: ParkCloseoutReadModel): ParkCloseoutValidation {
  const report = validateCloseoutRequirements(model); const exportIssues = validateParkExport(model.exportPeriods);
  return { report, exportIssues, blockingCount: report.filter(item => item.blocking).length + exportIssues.filter(item => item.blocking).length };
}
export function parkCloseoutJson(model: ParkCloseoutReadModel) { return JSON.stringify(validateParkCloseout(model), null, 2); }
