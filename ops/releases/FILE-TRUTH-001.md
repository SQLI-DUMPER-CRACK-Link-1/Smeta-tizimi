# FILE-TRUTH-001 — release plan (SOURCE READY, NOT APPLIED)

Branch: `claude/file-truth-r2-sync-v1` · Base: `origin/main @ 2361d10`
Production writes forbidden for this task. This is the package for a later
approved release.

## What ships

| Layer | Change |
|---|---|
| DB | `20260902120000_t2_file_truth_r2_canonical_v1.sql` — additive: canonical R2 columns on `t2_document_registry` (r2_key, sha256, size_bytes, mime_type, revision_seq, canonical_storage_status, versiya), separate `drive_*` / `sheets_*` replica columns, `t2_replica_sync_job` queue, RPCs: `t2_document_canonical_upsert_v1`, `t2_document_canonical_get_v1`, `t2_replica_job_claim_v1/synced_v1/failed_v1`, `t2_document_replica_rename_v1/content_v1/deleted_v1`, `t2_document_canonical_backfill_v1`. Rollback + acceptance included. |
| Cloudflare | `functions/api/hujjat-yukla.ts` (canonical upload: auth → R2 → registry, Drive not awaited, idempotent on operation_id), `functions/api/hujjat-ol.ts` (canonical download: auth → R2 stream, never Drive). Needs env: `SUPABASE_URL`, `SUPABASE_KEY` (already set), `R2_ARCHIVE` binding (already set), `SESSIYA_KALIT` (already set). |
| Frontend | `src/api/t2-hujjat-canonical.ts` client. No screen change. |
| GAS | (later) replica sync worker `apiT2ReplicaSyncTick` + a 1–5 min time-driven trigger — claims `t2_replica_sync_job`, mirrors R2→Drive using `t2_object_storage_binding.folder_id`, calls `t2_replica_job_synced_v1`. Drive-changes poller on the replica folders only → `t2_document_replica_*` commands. NOT in this package; separate handoff. |

## Deployment order (on approval)

1. Apply the migration; run the acceptance SQL in a rolled-back transaction.
2. Verify: idempotency, cross-company reject, canonical get authz, drive replica
   sync callback, content-revision conflict + success, drive-delete R2-retention,
   rename write-back (acceptance covers all 9).
3. Deploy Cloudflare (git push to main → Pages build). `/api/hujjat-yukla` and
   `/api/hujjat-ol` become live. Existing `/api/upload` stays for compatibility
   until callers migrate.
4. (Separate) GAS replica worker + trigger.
5. Backfill: `ops/backfill/FILE-TRUTH-001-backfill.md`.

## Rollback

`*.rollback.sql` — additive-only reversal (drops the new columns/table/functions;
no data deleted; legacy `external_*` values intact). Cloudflare: remove the two
functions / revert the commit.

## Acceptance status

- Static/source guards: `frontend/testlar/t2_file_truth.test.cjs` — **31/31 PASS**
  (no Drive/GAS/Sheets on the canonical path, R2 = file truth, content-addressed
  keys, auth on both endpoints, additive migration, R2-retaining delete,
  conflict engine, operation_id idempotency, service_role-only grants).
- Behavioral acceptance SQL: **READY, not executed** (production write forbidden;
  no disposable Supabase branch). Run per step 1–2 on approval.

## Required tests → coverage

| # | Requirement | Where |
|---|---|---|
| 1 | Drive unavailable → canonical upload + registry PASS | design (upload never awaits Drive) + acceptance step 1 (job enqueued, upload ok) |
| 2 | GAS unavailable → canonical upload/download PASS | `t2_file_truth.test.cjs` (no `/api/gas` on path) |
| 3 | Same operation_id → no duplicate R2 / registry | acceptance step 2 |
| 4 | Cross-company rejected | acceptance step 3 |
| 5 | Download reads R2, not Drive | `t2_file_truth.test.cjs` + acceptance step 4 |
| 6 | Canonical upload → Drive replica PENDING | acceptance step 1b |
| 7 | Drive retry PENDING/FAILED → SYNCED | acceptance step 5 + `t2_replica_job_failed_v1` backoff |
| 8 | Drive rename → metadata write-back | acceptance step 9 |
| 9 | Drive content revision → new canonical R2 revision | acceptance step 7 |
| 10 | Drive delete → canonical R2 NOT hard-deleted | acceptance step 8 |
| 11 | Stale replica base_version → CONFLICT | acceptance step 6 |
| 12 | No global Drive/Sheets scans on core path | `t2_file_truth.test.cjs` |

## Next-morning approval needed: YES

Approve: (a) apply the migration to production + run acceptance; (b) deploy the
two Cloudflare functions. The GAS replica worker + backfill are separate,
later approvals.
