# CODEX → CLAUDE: PARK legacy compatibility and regression lab

## Status

`READY_FOR_CLAUDE_PARK_QA`

## Branch and commits

- Branch: `codex/park-regression-lab-v1`
- Base: `origin/integration/next-main-release-v1 @ 5658dd8b4502d2b130757594c1c5dd846502ef11`
- This handoff's final commit must be read from the branch HEAD after push.

Only reusable PARK source was selectively carried from `8d1a490`; no V3 Commercial/Procurement/Schedule code was brought into this branch.

## Legacy sources inspected

- `Smeta tizimi/37_F2TezYoz.js` — F2 period columns, direct F2 values, multi-sheet routing and dop/zamena handling.
- `Smeta tizimi/38_F2Nazorat.js` and `39_F2Reestr.js` — reestr reconciliation, immutable/muhr period protection, exact document-vs-written comparison.
- `frontend/src/admin/qismlar/F2Kafolat.tsx` — truthful document/estimate difference display.
- `frontend/src/admin/{sahifalar/F2Import.tsx,sahifalar/F2Tayyorlash.tsx,store/f2Saqlash.ts,store/useF2Store.ts}` and `frontend/src/umumiy/ui/F2Daraxt.tsx`.
- `KOPRIK/08_FAZA_3_F2.md`, `KOPRIK/17_F2_IKKI_PANEL.md`, `F2_TOLIQ_NAZORAT_REJASI.md`, `NAKRUTKA_VA_F2_TAHLIL_ANTIGRAVITY.md`.

## Reusable code

| Purpose | Path |
|---|---|
| Legacy input and report types | `frontend/src/lib/park-document-control/legacy-compat/types.ts` |
| Legacy → PARK normalizer | `frontend/src/lib/park-document-control/legacy-compat/normalizer.ts` |
| Deterministic BL→RS / F2 oracle | `frontend/src/lib/park-document-control/legacy-compat/oracle.ts` |
| Golden legacy fixtures | `frontend/src/lib/park-document-control/legacy-compat/fixtures.ts` |
| Structured JSON generator | `frontend/src/lib/park-document-control/legacy-compat/report-generator.ts` |
| Regression tests | `frontend/src/lib/park-document-control/legacy-compat/legacy-compat.test.ts` |
| PARK core tests | `frontend/src/lib/park-document-control/calculation.test.ts` |

## Proven normalizer behavior

- Stable legacy IDs are retained. Missing IDs become visible `legacy-migration:<sheet>:<row>` identities; raw row number is never canonical PARK identity.
- Legacy `RS` receives proportional `BL` quantity only when F2 has no direct RS quantity. Direct resource quantity wins.
- Blank direct price stays absent; it is never invented from estimate history.
- Frozen legacy periods become frozen PARK snapshots. The normalizer never mutates source input.

## Golden classification output

`generateParkLegacyCompatibilityReport()` returns structured objects with `scenario`, `legacyResult`, `parkResult`, `status`, `difference`, `reason`.

| Status | Count | Scenario |
|---|---:|---|
| MATCH | 1 | BL/RS previous/current/cumulative quantities |
| INTENTIONAL_CHANGE | 2 | pending-change isolation; actual-vs-estimate price separation |
| BUG_FOUND | 0 | none in tested oracle cases |
| UNRESOLVED | 1 | Forma-3 legal/payment total |

Coverage: zero/empty F2 period, partial and 100% BL quantities, multiple periods, direct RS override, proportional RS propagation, over-certification, rounding, frozen-history immutability, material price above/below baseline, approved/pending/rejected change semantics, additional/removed/increased/decreased/new/replacement scope.

## Mandatory release constraints

1. Keep `actualUnitPrice` and `estimateUnitPrice` separate in Claude's adapter.
2. Pending/rejected change must not enter entitlement/cumulative totals.
3. Preserve old F2 snapshots; corrections require a new revision.
4. Use real canonical ID where available. A migration identity is a review/backfill marker, not permission to use row number as truth.
5. Keep `FORMA3_RULE_UNRESOLVED` until a verified legal/contract source is mapped.

## Tests and environment

- Focused Vitest: 11 tests passed (PARK core + legacy regression).
- Static PARK guard: 11 checks passed.
- TypeScript: passed.
- `git diff --check`: passed.
- Disposable V3 acceptance blocker: `docker`, `supabase` CLI and `psql` are not installed. No production fallback was attempted.

## Claude action

Implement the existing canonical adapter behind `ParkDocumentControlPort`, then call `generateParkLegacyCompatibilityReport()` in integration/CI against real mapped F2 fixtures before release. No backend/table is supplied by this branch.
