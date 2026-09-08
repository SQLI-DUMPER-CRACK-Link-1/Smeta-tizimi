# Approval queue

No destructive DDL, hard delete, production rewrite, production migration,
deployment, merge to main, or external data write was executed.

## P0 — tenant/RLS/upload boundary

- **Exact action:** review and implement a fail-closed server/RPC/DB boundary
  for object-only reads, missing tenant claims, and `/api/upload` ownership.
- **Why:** current `functions/api/sb.ts:234-249` and `functions/api/upload.ts:1-44`
  do not provide sufficient evidence of tenant-safe behavior.
- **Risk:** changing the boundary can block legacy sessions or reveal schema
  incompatibilities.
- **Rollback:** deploy only a reviewed forward migration/worker version; revert
  the worker to the prior version and apply the approved DB rollback if one is
  supplied. Do not hot-edit production data.
- **Expected result:** authenticated two-company/object-mismatch tests reject
  unauthorized reads/writes with no existence leak.

## P0 — canonical PTO schema / migration

- **Exact action:** reconcile baseline, visible migrations, deployed tables and
  RPC signatures; apply only through the reviewed Supabase migration workflow.
- **Why:** source dispatch references PTO objects whose canonical migration/RPC
  ownership is incomplete in this checkout.
- **Risk:** destructive or incompatible DDL and financial data drift.
- **Rollback:** migration-specific rollback supplied and tested on disposable
  DB before any production application.
- **Expected result:** one table/view/RPC ownership matrix with parity evidence.

## P1 — F2 approval/history and official export

- **Exact action:** approve state machine, immutable certified history,
  correction/reversal semantics and official export rules.
- **Why:** UI symbols exist but append-only approved snapshot and legal formula
  evidence are not established.
- **Risk:** changing certified financial history or producing an invalid official
  document.
- **Rollback:** no production implementation until owner/rule source is signed;
  use draft-only fixtures meanwhile.
- **Expected result:** deterministic approval/history/export contract with tests.

## P1 — Forma-3 / KS-3

- **Exact action:** provide authoritative template and legal/business rule source.
- **Why:** repository has planning references only.
- **Risk:** invented or legally incorrect formula.
- **Rollback:** do not implement until source is available.
- **Expected result:** owner-approved formula, certified read model and export test.

## Owner smoke

- **Exact action:** authenticated vertical smoke from login through object,
  Smeta/LRV/RES, Fakt, F2, approval/history, export, documents, Zayavka,
  refresh/direct URL and logout.
- **Why:** local static gates cannot prove deployed auth/RLS/provider behavior.
- **Risk:** test data mutation; use a disposable or explicitly approved tenant.
- **Rollback:** use only draft/test records and delete/archive according to the
  owner’s approved policy.
- **Expected result:** `READY_FOR_OWNER_SMOKE=YES`; never claim daily use until it
  actually passes.
