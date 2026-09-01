# CODEX → CLAUDE: PARK document-control support lane

## Status

`READY_FOR_CLAUDE_PARK_INTEGRATION`

## Exact commits

- V3 safe checkpoint: `e50898e98332211b674ac3739f68d9736c44e5f2`
  (`d0d025a` contains its Commercial/Procurement/Schedule implementation).
- PARK pure engine and reusable UI: `a6f868d` on
  `codex/construction-os-expansion-v3`.

V3 has **not** received more scope after its checkpoint. There is no local
Postgres/Supabase disposable environment in this worktree (`psql` absent), so
the existing V3 migration acceptance remains source-ready rather than
runtime-accepted. No production action occurred.

## Reusable source

| Need | Path |
|---|---|
| Pure F2/nakopitelniy/change valuation | `frontend/src/lib/park-document-control/calculation.ts` |
| Canonical-input and result contracts | `frontend/src/lib/park-document-control/types.ts` |
| Typed adapter boundary, no invented endpoint | `frontend/src/api/t2-park-document-control.ts` |
| Explicit Forma-3 unresolved contract | `frontend/src/lib/park-document-control/forma3.ts` |
| Real scenarios fixture | `frontend/src/lib/park-document-control/fixtures.ts` |
| Read-only, reusable professional UI | `frontend/src/components/park-document-control/` |
| Engine tests | `frontend/src/lib/park-document-control/calculation.test.ts` |
| Static core-dependency guard | `frontend/testlar/t2_park_document_control.test.cjs` |

## Evidence-derived assumptions

1. F2 document total and amount written to estimate must reconcile; a nonzero
   difference is a visible control state, not a guessed success.
2. Estimate/reference material price and actual execution/material price are
   independent fields. `actualUnitPrice` never overwrites
   `estimateUnitPrice`.
3. Only `approved` changes affect canonical payable/cumulative entitlement.
   `pending` changes remain a separately reported projection.
4. Historical F2 period inputs are `frozen: true`; correction must be a new
   revision/snapshot, not an in-place rewrite.
5. Every line/change uses IDs. The engine has no Drive, Sheets, GAS, filename,
   or name-based lookup dependency.

## Coverage in fixture/tests

- material actual price above and below estimate;
- previous/current/cumulative F2 and partial quantity;
- remaining quantity/value and over-certification warning;
- approved additional, removal, quantity increase/decrease, replacement,
  new section/item; pending replacement excluded from canonical totals;
- deterministic money/quantity rounding and repeated calculation;
- immutable historical snapshot check.

## Forma-3

No authoritative Forma-3 legal/business rule was found in the reviewed F2
evidence. `forma3Unresolved` returns `FORMA3_RULE_UNRESOLVED` and blocks legal
total, payment-due and tax-treatment outputs. Do not map it to a payment
formula until a country/contract pack plus approved template/evidence is
supplied.

## Claude integration contract

1. Read canonical F2/estimate/change data through an implementation of
   `ParkDocumentControlPort.read()`.
2. Map existing canonical IDs into `ParkCalculationInput`; do not add a PARK
   database/table or a competing F2 document store.
3. Persist a correction only through an existing/new canonical revision command
   implementing `createRevision()` with `operationId` and `expectedVersion`.
4. Pass the resulting input to `<ParkF2ControlPanel input={input} />` in the
   Claude-owned product route. The component itself performs no fetch/write.
5. A Drive/GAS failure may change replica status only; it must not prevent this
   calculation from rendering.

## Verification

- PARK Vitest engine suite: 6 tests passed.
- `node frontend/testlar/t2_park_document_control.test.cjs`: 8 guards passed.
- `npx tsc -b`: passed after PARK sources were added.
- Full build/lint/full suite must be rerun by the release integration branch;
  no claim is made here for checks not completed in this checkpoint.
