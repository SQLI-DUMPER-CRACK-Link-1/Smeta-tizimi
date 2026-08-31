# Resource domain V2 gap audit

## Existing evidence

- `frontend/src/api/t2-resurs.ts` exposes company-filtered resource registry reads for sklad, kadr and texnika.

## Gap

No audited canonical employment, attendance, timesheet, crew membership, equipment assignment, operator, fuel, maintenance, downtime or utilization models were found.

## Required backend work

Keep company membership distinct from employment. Introduce additive employment and equipment operational records with company/project scope, date-range overlap validation, non-negative fuel validation, downtime range validation, expected version, operation id and audit.
