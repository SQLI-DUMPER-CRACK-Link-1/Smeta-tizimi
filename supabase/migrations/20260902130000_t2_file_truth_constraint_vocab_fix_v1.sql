-- FILE-TRUTH-001 forward hotfix — closes prod/source drift.
-- Applied to production 2026-09-02 during NEXT-MAIN-RELEASE-V1 rollout, as two
-- ad-hoc apply_migration calls (t2_file_truth_provider_check_fix,
-- t2_file_truth_status_check_fix). This file is the canonical source-of-truth
-- record of that same fix, re-applied idempotently so repo history and prod
-- history describe the same schema.
--
-- Root cause: 20260902120000_t2_file_truth_r2_canonical_v1.sql made `provider`
-- nullable and widened the `status` vocabulary, but left/wrote CHECK
-- constraints that did not include the two new values its own functions
-- actually write:
--   A. provider  — old constraint was `provider = 'google_drive'` (single
--      value only). t2_document_canonical_reserve_v1 / _content_v1 insert
--      provider='cloudflare_r2', which the constraint silently rejected.
--   B. status    — the migration's own status_check rewrite enumerated
--      ('active','superseded','deleted','failed','replica_missing') but
--      t2_document_canonical_reserve_v1 inserts status='pending' for a
--      newly reserved (not yet uploaded) document.
-- Discovered by the FILE-TRUTH-001 acceptance script against live prod
-- (BEGIN...ROLLBACK), before any real document used the canonical path.
--
-- Fix scope: additive/forward only. Widens both vocabularies; narrows
-- nothing; deletes no data; safe to re-run (drop-if-exists + add).

begin;

alter table public.t2_document_registry drop constraint if exists t2_document_registry_provider_check;
alter table public.t2_document_registry add constraint t2_document_registry_provider_check
  check (provider is null or provider in ('google_drive','cloudflare_r2'));

alter table public.t2_document_registry drop constraint if exists t2_document_registry_status_check;
alter table public.t2_document_registry add constraint t2_document_registry_status_check
  check (status in ('pending','active','superseded','deleted','failed','replica_missing'));

commit;
