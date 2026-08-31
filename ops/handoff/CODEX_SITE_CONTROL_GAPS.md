# Site Control V2 gap audit

## Existing evidence

- `frontend/src/api/t2-aosr.ts` provides AOSR registry and coverage reads (`t2_aosr_reestr`, `t2_aosr_coverage`) plus version-aware AOSR write/cancel and natural AOSR-to-work-row binding commands.

## Gap

No audited canonical models were found for inspection/checklist, defect/NCR, corrective-action/evidence/closure, safety incident/permit, or technical/author-supervision remarks.

## Required source-ready backend work

Create additive, tenant/project/object/WBS-scoped records with responsible party, severity, due date, status, expected version, operation id and audit. Evidence must use canonical document IDs; closure policy must be explicit and tested. Keep AOSR as its own existing domain rather than relabeling it as generic quality truth.
