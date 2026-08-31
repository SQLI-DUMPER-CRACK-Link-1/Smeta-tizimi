# Schedule V2 backend gap audit

## Existing evidence

- `frontend/src/api/t2-grafik.ts` documents existing `t2_grafik_qator`, `t2_grafik_holat` and version-protected save/update commands.
- Existing activity granularity: company, object, name, start/finish, duration, percent and status.
- The adapter explicitly states WBS/dependencies/CPM are not implemented.

## Preserve the existing truth

Do not create an unrelated schedule table without a reconciliation plan. Either extend `t2_grafik_qator` additively or introduce a schedule header/child model with a documented one-time mapping.

## V2 additions needed

1. Project and optional WBS/party linkage, baseline snapshot and immutable baseline policy.
2. Activity dependency relation with same-company/project checks, FS/SS/FF/SF and lag.
3. Progress update/audit records, actual and forecast dates.
4. Deterministic validators: cycle rejection, 0..100 percent, cross-project dependency rejection, variance and overdue rules.
5. Bounded overview/lookahead/late-activity reads. CPM remains P1 unless a DAG helper is tested.
