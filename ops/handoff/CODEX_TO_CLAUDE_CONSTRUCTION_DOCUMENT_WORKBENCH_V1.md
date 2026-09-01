# CODEX → CLAUDE: Universal Construction Document Control Workbench V1

## Status

`CONSTRUCTION_DOCUMENT_WORKBENCH_V1_READY_FOR_INTEGRATION`

## Branch

- Branch: `codex/construction-document-control-workbench-v1`
- Base: `origin/integration/next-main-release-v1 @ 5658dd8b4502d2b130757594c1c5dd846502ef11`
- Exact source commit: read branch HEAD after push.

## Generic architecture

The workbench is project/object generic. `Navoi Park` exists only under
`fixtures/navoi-park`; no type, port, UI route, API, migration or canonical
entity is Park-specific. It contains no backend write, Supabase fetch, GAS,
Drive or Sheets dependency.

## Code paths

| Area | Path |
|---|---|
| Generic value/change/revision/closeout model | `frontend/src/lib/construction-document-control/types.ts` |
| Deterministic progress valuation engine | `frontend/src/lib/construction-document-control/calculation.ts` |
| Typed backend binding seams | `frontend/src/lib/construction-document-control/ports.ts` |
| Closeout/export/exception validators | `frontend/src/lib/construction-document-control/validation.ts` |
| Legacy migration warnings | `frontend/src/lib/construction-document-control/legacy.ts` |
| Navoi Park acceptance fixture | `frontend/src/lib/construction-document-control/fixtures/navoi-park/acceptance.ts` |
| Workbench UI | `frontend/src/components/construction-document-control/` |
| Tests | `frontend/src/lib/construction-document-control/*test.ts` |

## Typed ports Claude must bind

- `ConstructionDocumentControlPort` — bounded project/object workbench read model.
- `ProgressValuationReadPort` — paginated/filtered 10k-row read model.
- `ChangeControlCommandPort` — canonical operation/version guarded create/decision commands.
- `ProjectCloseoutPort` — canonical document metadata + configurable requirement pack.

No endpoint name is invented by this branch.

## UI surfaces

- project/object overview and exception center;
- Progress Valuation/F2 grid: baseline reference, F2 valuation and actual procurement values are displayed separately;
- Nakopitelniy previous/current/cumulative/remaining for quantity and value;
- change control before/request/result with evidence/revision/actor metadata;
- immutable revision timeline;
- generic `ProjectCloseoutMatrix`, missing-documents, blocking-issues and period-reconciliation panels;
- export preview, validation summary and reconciliation errors;
- explicit payment/certification slot: `FORMA3_RULE_UNRESOLVED`.

## Performance characteristics

- `ProgressValuationPage` requires `offset`/`limit` and optional search/section filter.
- UI renders only the supplied page; it does no per-row network fetch.
- Pure calculation benchmark covers 10,000 BOQ rows under 3 seconds locally.
- No O(n²) pairwise comparison or Drive/Sheets/GAS call exists on client path.

## Test evidence

- focused Vitest: 6 tests passed (calculation, price separation, cumulative reconciliation, revision immutability, closeout, export and 10k fixture);
- static architecture guard: 9 checks passed;
- TypeScript/build/`npm run tekshir` must be confirmed at the final commit before merge.

## Legacy compatibility

`legacyCompatibilityWarnings()` makes missing stable ID, row-derived migration identity, and direct-RS override visible. It never treats a raw row number as canonical identity. Claude should combine it with the earlier legacy regression-lab oracle when mapping historical F2 data.

## Unresolved

- Forma-3/payment legal calculation remains `FORMA3_RULE_UNRESOLVED`; no totals are generated.
- Requirement packs are data-driven; this workbench does not declare universal statutory document requirements.
- Claude must bind real canonical read models, document metadata/evidence IDs, revision sources and authorized change commands.

No production action, main merge, migration, canonical database truth or duplicate F2/Nakopitelniy store was created.
