# HERM-001 — T2 PTO closure source-only report

**Status:** `SOURCE_READY / PRODUCTION_BLOCKED`
**Date:** 2026-09-10
**Branch:** `hermes/t2-pto-closure-v1`
**Worktree:** `C:\Temp\GAS-t2-pto-closure-v1`
**HEAD:** `55ce1c0f28f264984c4a7ecd197c8c393527618d`
**Base:** `origin/main` at `6ebae58914fce627539aa4fcecc2461ec188c5a3`
**Production write:** `false`

## Parallel-device safety

- The work was kept in the dedicated Hermes worktree/branch; the Hermes branch
  was not merged into `main`, reset, cleaned, force-pushed, or used to rewrite
  history.
- Before syncing, the dirty worktree was preserved in the reversible local
  checkpoint `stash@{0}` (`hermes safety checkpoint before origin-main sync
  2026-09-10`). The stash was not dropped.
- HEAD vs working `ops/ACTIVE_TASKS.json` comparison found 31 task IDs on both
  sides, no missing/added IDs, and only `HERM-001` changed.
- `HERM-001` records `machine: pc-ishxona`, the isolated branch, and
  `production_write_allowed: false`.
- Another Claude device remains the owner of its own worktree/main changes;
  no destructive Git operation was used against it.

## Implemented source changes

### WP-1 — F2 lifecycle, approval history, correction

- Added `20260920150000_t2_f2_lifecycle_v1.sql` with additive
  `lifecycle_status`: `draft → submitted → checked → approved/rejected/cancelled`
  plus `superseded` vocabulary.
- Existing `holat` values remain a compatibility projection; new lifecycle
  transitions use explicit named RPCs.
- Added append-only `t2_akt_holat_tarix`, approved immutability guard,
  expected-version check, operation idempotency, actor/company membership
  check, and audit calls.
- Added correction provenance link and `t2_akt_correction_create_v1`: an
  approved source row is not mutated or deleted; a new draft header is created
  and child financial rows must be imported/reviewed again.
- Added metadata-only acceptance and data-preserving rollback files.
- F2 history UI now uses the named lifecycle RPC and follows the three-step
  approval chain. Inline reject/cancel controls require a reason.

### WP-1B — stuck F2 import recovery

- Added `20260922130000_t2_f2_import_job_recovery_v1.sql`.
- `review` is included in the job status contract.
- Stale `running` and manual `review` jobs move only to `paused` with
  `recovery_required=true`; cursor/drafts remain, and `completed_at` is not
  fabricated.
- Added append-only recovery/cancel event tables, optimistic version checks,
  operation idempotency, membership checks, and soft-cancel with required
  reason.
- Added gateway mappings, client contracts, metadata acceptance and
  data-preserving rollback files.
- F2 import UI invokes recovery before resuming a running/review job when it is
  inside the production provider; standalone legacy/test embedding retains its
  old resume behavior.

### WP-1C — LRV_PLUS fidelity/export gate

- `NULL` quantity/price/sum inputs stay unknown; cached Excel values are blank,
  not silent zeroes. Unknown child sums propagate to parent aggregates.
- Added export gate requiring company/project/object/period/source document,
  revision, SHA-256 provenance and a complete read-model flag.
- HolatNative disables Excel export until that provenance/context is complete.

### WP-1D — non-destructive Smeta re-import

- Added pure `smetaQaytaImportDiff` comparison and tests for added/changed/
  removed, same-name/different-code and same-code/different-unit cases.
- Existing Smeta UI now shows a read-only diff preview against canonical rows.
- Removed the native UI’s destructive `smeta_tozala` / “tozalab qayta yuklash”
  path. No old canonical rows are deleted or overwritten by this lane.

### WP-3 — tenant-safe PTO workspace

- Added `PTOWorkspaceContext` and `PTOWorkspaceBar` for company → project →
  object → period → source document → revision.
- Scope IDs are validated against active-company/project server reads; invalid
  deep-link IDs are cleared instead of guessed.
- Canonical scope aliases are URL-synchronised and survive route navigation/
  refresh. Company switch clears downstream scope and loaded lists.
- AdminShell mounts one provider; F2, F2 history, F2 preparation, Smeta, Holat
  and Narxlar native surfaces sync object selection to the shared scope.
- Dynamic PTO routes are classified by `routeScope` so direct URLs reach the
  company auth guard.

### UI/UX lane

- Preserved the presentation-only UI agent work and added a keyboard-accessible
  mobile menu trigger/backdrop with reduced-motion-safe shared PTO primitives.
- No calculations, test IDs, canonical payload fields or existing named RPC
  payloads were changed except the explicit F2 lifecycle transition client.

### WP-2 / ERP documentation

- Regenerated `docs/audit/T2_SCHEMA_INVENTORY_2026-09.md`.
- Added `docs/research/ERP_REQUIREMENTS_T2_PTO_MATRIX_2026-09.md` from three
  Lex.uz sources. It is documentation-only; vendor connector/API code was not
  added.
- The matrix explicitly marks ERP vendor API, ERI, QR verification and
  external EHF integration as deferred/unverified.

## Verification evidence

| Check | Result |
|---|---|
| `node ops/governance-check.cjs` | PASS; only stale `CURRENT_STATE.main_sha` warning remains |
| `node frontend/testlar/t2_f2_lifecycle.test.cjs` | PASS; 21 source-contract assertions |
| `node frontend/testlar/t2_pto_closure_hermes.test.cjs` | PASS; 7 cross-cutting assertions |
| targeted F2/LRV/context Vitest | PASS; 3 files, 27 tests |
| `PTOUi.test.tsx` | PASS; 2 tests |
| `npm run tekshir` | PASS; all checks passed |
| `npm run lint` | exit 0; repository has existing warnings, no new actionable error |
| `npm run build` | exit 0; browser tsc, functions tsc and Vite bundle passed |
| full Vitest | PASS; 65 files, 391 tests; 10k engine 450 ms, 50k engine 1906 ms, release 50k 808.43 ms |
| ERP citation verify | PASS; 3/3 sources, 8/8 verbatim quotes, 43 prose sentences, 22 provenance-marked (51%) |
| schema inventory | PASS_STATIC_INVENTORY; 102 direct RPC names, 148 migration function definitions |

## Unresolved / blocked

- New SQL migrations were **not applied** to Supabase. There is no local
  reviewed baseline runner, `supabase` CLI or `psql` in this worktree, and no
  production credentials were used.
- SQL runtime/application, RLS/grant behavior, live tenant isolation, live
  history readback, actual job 2/3 recovery, authenticated browser smoke and
  live export/readback remain unproven.
- `frontend/functions/api/sb.ts` still needs a named GET-only reader mapping for
  `t2_akt_lifecycle_history_v1`; an ownership request is recorded in
  `ops/mailbox/HERM-001/03-hermes@pc-ishxona.md` because that shared file is
  owned by another lane. No unapproved edit was made there.
- ERP research provider coverage remains partial: some configured search
  providers returned 403/DNS/response-shape failures. No legal or financial
  rule was invented to fill the gap.
- User-provided live facts (`t2_qator=36,654`, `t2_akt_qator=0`, akt 19 without
  child rows, F2 jobs 2/3 `running/review`) were not modified or independently
  read back in this source-only lane.
- No production migration, deploy, destructive SQL/delete, RLS/auth
  architecture change, Cloudflare deploy, Drive/R2 mass change, secret
  rotation or force-push was performed.

## Handoff

The branch contains reversible source changes and local evidence only. Before
any merge/deploy, the DB owner must review the migration against the actual
production schema, run the metadata acceptance and disposable data-path tests,
then obtain the separately required authenticated owner smoke approval.
