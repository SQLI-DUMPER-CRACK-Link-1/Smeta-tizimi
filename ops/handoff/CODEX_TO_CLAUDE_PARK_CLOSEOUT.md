# CODEX → CLAUDE: PARK closeout and export validation lab

## Status

`READY_FOR_CLAUDE_PARK_CLOSEOUT`

## Branch

- Branch: `codex/park-closeout-lab-v1`
- Base: `origin/integration/next-main-release-v1 @ 5658dd8b4502d2b130757594c1c5dd846502ef11`
- Read the branch HEAD after push for exact commit.

## Evidence inspected

- `F2_TOLIQ_NAZORAT_REJASI.md` and `Smeta tizimi/{37_F2TezYoz.js,38_F2Nazorat.js,39_F2Reestr.js}`: F2 reestr, direct document/write reconciliation, muhr/frozen-period intent, and no guessed totals.
- `frontend/src/admin/qismlar/F2Kafolat.tsx`: visible truthful difference controls.
- `frontend/src/api/t2-aosr.ts`: object-ID-based AOSR registry/status and M:N work linkage.
- `frontend/src/api/t2-shartnoma.ts`: tenant-scoped contract read model and historical cancellation semantics.
- `frontend/src/admin/sahifalar/{F2Import.tsx,F2Tayyorlash.tsx,Shartnoma.tsx,Fakturalar.tsx}` plus `KOPRIK/01_API_SHARTNOMA.md`.

## Reusable source

| Need | Path |
|---|---|
| Typed closeout/read-port contract | `frontend/src/lib/park-closeout/types.ts` |
| Pure completeness + export validator | `frontend/src/lib/park-closeout/validate.ts` |
| Acceptance fixtures | `frontend/src/lib/park-closeout/fixtures.ts` |
| Unit tests | `frontend/src/lib/park-closeout/validate.test.ts` |
| Read-only UI components | `frontend/src/components/park-closeout/` |
| Static guard | `frontend/testlar/t2_park_closeout.test.cjs` |

## Canonical adapter contract

`ParkCloseoutPort.read({ companyId, projectId, objectId })` is the only required integration seam. Claude should map canonical document registry metadata and PARK export read models into `ParkCloseoutReadModel`; this branch creates no API endpoint, table, migration, route, or writer.

## Validation controls

- document requirement status: `required`, `present`, `pending`, `approved`, `rejected`, `superseded`, `missing`, `unresolved`;
- required approved contract/F2/Nakopitelniy/AOSR/change-evidence presence;
- F2 export: previous + current = cumulative for quantity and value independently;
- cumulative quantity/value cannot exceed approved entitlement;
- immutable/frozen period and unique revision IDs;
- separate reference and actual price-source IDs;
- each approved change included exactly once.

## Acceptance fixtures

- complete object;
- missing F2;
- missing AOSR;
- only superseded contract evidence;
- pending AOSR approval;
- approved change without evidence;
- closed F2 with missing cumulative statement;
- invalid export (over-entitlement, same price source, missing approved-change inclusion);
- Forma-3 remains `FORMA3_RULE_UNRESOLVED` and never emits legal/payment total.

## Required UI composition

Use `<ParkCloseoutMatrix>`, `<MissingDocumentsPanel>`, `<BlockingIssuesPanel>`, and `<PeriodReconciliationPanel>` only after the canonical adapter supplies a real read model. These components are read-only and make no HTTP/GAS/Drive calls.

## Test evidence

- Focused Vitest: 5 tests passed.
- Closeout static guard: 7 checks passed.
- TypeScript: passed.
- `git diff --check`: passed.

No closeout bug was found in the deterministic fixture lab. Before release Claude must run this validator against real canonical F2/AOSR/document-registry fixtures; missing authoritative Forma-3 legal evidence remains a deliberate unresolved condition.
