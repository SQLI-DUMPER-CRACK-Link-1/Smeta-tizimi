# FILE-TRUTH-001 — release plan (SOURCE READY, NOT APPLIED)

Branch: `claude/file-truth-r2-sync-v1` · Base: `origin/main @ 2361d10`
Production writes forbidden for this task. This is the package for a later
approved release.

## What ships

| Layer | Change |
|---|---|
| DB | `20260902120000_t2_file_truth_r2_canonical_v1.sql` — additive: canonical columns on `t2_document_registry` (r2_key, sha256, sha256_verified, hash_source, size_bytes, expected_size_bytes, mime_type, revision_seq, canonical_storage_status incl. `reserved`, versiya, reserved_at, finalized_at), separate `drive_*` / `sheets_*` replica columns, `t2_replica_sync_job` queue. **Two-phase RPCs**: `t2_document_canonical_reserve_v1` / `_finalize_v1` / `_reconcile_v1` (no orphan R2 objects); `t2_document_canonical_get_v1` (stored-only, authz); `t2_replica_job_claim_v1/synced_v1/failed_v1`; `t2_document_replica_rename_v1/content_v1/deleted_v1`; `t2_document_canonical_backfill_v1`. Rollback + acceptance included. |
| Cloudflare | `functions/api/hujjat-yukla.ts` (two-phase upload: reserve → R2 → finalize; small file buffered+verified, large file true `file.stream()`; Drive not awaited; idempotent), `functions/api/hujjat-ol.ts` (user download: auth → R2 stream, never Drive), `functions/api/hujjat-r2.ts` (INTERNAL replica read, `X-Replica-Sync-Secret`). **New bindings/env (dashboard):** `R2_CANONICAL` → a **new PRIVATE bucket, no custom domain**; `REPLICA_SYNC_SECRET`; `CANONICAL_HASH_INLINE_LIMIT` (default 25 MiB); `CANONICAL_MAX_UPLOAD_BYTES` (default 512 MiB). Existing `R2_ARCHIVE` + public domain stay for the legacy archive only. |
| Frontend | `src/api/t2-hujjat-canonical.ts` client (browser computes sha256, sends size). No screen change. |
| GAS | `Smeta tizimi/98_T2ReplicaSync.js` — `apiT2ReplicaSyncTick()` (bounded batch, time-budgeted) claims `t2_replica_sync_job`, mirrors canonical R2 → the object's `t2_object_storage_binding.folder_id` (no Drive scan) via the internal `/api/hujjat-r2` endpoint, calls `t2_replica_job_synced_v1`. `apiT2ReplicaDriveWriteback()` — rename/delete write-back on known `drive_file_id` docs only; content write-back is queued (R2 copy-in is a follow-up). **Deployment requirement:** a 1–5 min `apiT2ReplicaSyncTick` time-driven trigger + Script Properties `REPLICA_SYNC_SECRET`, `R2_INTERNAL_URL`. |

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
