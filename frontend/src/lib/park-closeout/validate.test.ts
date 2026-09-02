import { describe, expect, it } from 'vitest';
import { changeWithoutEvidenceFixture, completeObjectFixture, invalidExportFixture, missingAosrFixture, missingCumulativeFixture, missingF2Fixture, pendingApprovalFixture, supersededDocumentFixture } from './fixtures';
import { parkCloseoutJson, validateParkCloseout } from './validate';

describe('PARK closeout and document export validation', () => {
  it('accepts complete object evidence but keeps Forma-3 explicitly unresolved and non-blocking', () => {
    const result = validateParkCloseout(completeObjectFixture);
    expect(result.exportIssues).toEqual([]);
    expect(result.report.find(row => row.requirement === 'forma3')!.status).toBe('unresolved');
    expect(result.blockingCount).toBe(0);
  });
  it('identifies missing F2, AOSR, cumulative statement, change evidence and superseded contract', () => {
    expect(validateParkCloseout(missingF2Fixture).report.find(row => row.requirement === 'f2-01')!.status).toBe('missing');
    expect(validateParkCloseout(missingAosrFixture).report.find(row => row.requirement === 'aosr')!.blocking).toBe(true);
    expect(validateParkCloseout(missingCumulativeFixture).report.find(row => row.requirement === 'nak-01')!.status).toBe('missing');
    expect(validateParkCloseout(changeWithoutEvidenceFixture).report.find(row => row.requirement === 'change-evidence')!.status).toBe('missing');
    expect(validateParkCloseout(supersededDocumentFixture).report.find(row => row.requirement === 'contract')!.status).toBe('superseded');
  });
  it('treats pending approval as visible but not approved evidence', () => {
    const row = validateParkCloseout(pendingApprovalFixture).report.find(item => item.requirement === 'aosr')!;
    expect(row.status).toBe('missing');
    expect(row.blocking).toBe(true);
  });
  it('rejects export drift in quantity/value, entitlement, price source and approved change inclusion', () => {
    const issues = validateParkCloseout(invalidExportFixture).exportIssues;
    expect(issues.map(issue => issue.rule)).toEqual(expect.arrayContaining(['ENTITLEMENT_QUANTITY', 'ENTITLEMENT_VALUE', 'PRICE_SOURCE_SEPARATION', 'APPROVED_CHANGE_INCLUDED_ONCE']));
  });
  it('generates machine-readable structured output', () => {
    const json = parkCloseoutJson(completeObjectFixture);
    expect(JSON.parse(json).report[0]).toEqual(expect.objectContaining({ objectId: 'object-complete', requirement: expect.any(String), status: expect.any(String), blocking: expect.any(Boolean), evidenceIds: expect.any(Array), reason: expect.any(String) }));
  });
});
