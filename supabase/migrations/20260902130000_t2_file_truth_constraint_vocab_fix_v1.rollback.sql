-- Rollback for 20260902130000_t2_file_truth_constraint_vocab_fix_v1.
-- PRE-USE ONLY: refuses if any row already relies on the widened vocabulary
-- (a real 'cloudflare_r2' document or a document sitting in 'pending'), since
-- narrowing the CHECK back would either fail immediately on existing data or
-- silently forbid rows that are legitimate canonical-storage state. This is a
-- narrowing rollback, unlike every other additive rollback in this release —
-- treat it as a last resort, not a routine revert.

do $$
begin
  if exists (select 1 from public.t2_document_registry where provider = 'cloudflare_r2') then
    raise exception 'ROLLBACK_REFUSED: cloudflare_r2 provider rows exist — narrowing would orphan canonical documents';
  end if;
  if exists (select 1 from public.t2_document_registry where status = 'pending') then
    raise exception 'ROLLBACK_REFUSED: pending-status rows exist — narrowing would break in-flight reservations';
  end if;
end $$;

begin;

alter table public.t2_document_registry drop constraint if exists t2_document_registry_provider_check;
alter table public.t2_document_registry add constraint t2_document_registry_provider_check
  check (provider = 'google_drive');

alter table public.t2_document_registry drop constraint if exists t2_document_registry_status_check;
alter table public.t2_document_registry add constraint t2_document_registry_status_check
  check (status in ('active','superseded','deleted','failed','replica_missing'));

commit;
