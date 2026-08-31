-- Rollback for 20260902120000_t2_file_truth_r2_canonical_v1. Additive only —
-- no data is destroyed; legacy external_* values are left intact.
drop function if exists public.t2_document_canonical_reserve_v1(bigint,bigint,bigint,bigint,text,text,text,bigint,text,uuid,text);
drop function if exists public.t2_document_canonical_finalize_v1(bigint,bigint,bigint,uuid,text,text,bigint,boolean,text);
drop function if exists public.t2_document_canonical_reconcile_v1(bigint,boolean,text,bigint);
drop function if exists public.t2_document_canonical_get_v1(bigint,bigint);
drop function if exists public.t2_replica_job_claim_v1(text,integer);
drop function if exists public.t2_replica_job_synced_v1(bigint,text,text);
drop function if exists public.t2_replica_job_failed_v1(bigint,text);
drop function if exists public.t2_document_replica_rename_v1(bigint,bigint,bigint,text,text,text);
drop function if exists public.t2_document_replica_content_v1(bigint,bigint,bigint,text,text,bigint,text,integer);
drop function if exists public.t2_document_replica_deleted_v1(bigint,bigint,bigint,text);
drop function if exists public.t2_document_canonical_backfill_v1(bigint,text,text,bigint,text,text);
drop table if exists public.t2_replica_sync_job;
alter table public.t2_document_registry drop constraint if exists t2_document_registry_status_check;
alter table public.t2_document_registry add constraint t2_document_registry_status_check
  check (status in ('active','superseded','deleted','failed'));
alter table public.t2_document_registry
  drop column if exists r2_bucket, drop column if exists r2_key,
  drop column if exists original_filename, drop column if exists mime_type,
  drop column if exists size_bytes, drop column if exists expected_size_bytes,
  drop column if exists sha256, drop column if exists sha256_verified,
  drop column if exists hash_source,
  drop column if exists revision_seq, drop column if exists canonical_storage_status,
  drop column if exists versiya, drop column if exists reserved_at,
  drop column if exists finalized_at, drop column if exists updated_at,
  drop column if exists drive_file_id, drop column if exists drive_parent_id,
  drop column if exists drive_revision, drop column if exists drive_sync_status,
  drop column if exists drive_last_sync_at, drop column if exists drive_last_error,
  drop column if exists sheets_entity_id, drop column if exists sheets_sync_status,
  drop column if exists sheets_last_sync_at;
