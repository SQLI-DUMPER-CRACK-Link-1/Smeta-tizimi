-- FILE-TRUTH-001: Supabase = business truth, Cloudflare R2 = file truth,
-- Google Drive = secondary synchronized replica, GAS = bridge.
-- SOURCE ONLY — NOT applied to production by this task.
--
-- Contract: docs/architecture/FILE_TRUTH_AND_SECONDARY_REPLICA_V1.md

-- ── 1. t2_document_registry: canonical (R2) columns, additive ─────────────
alter table public.t2_document_registry
  add column if not exists r2_bucket text not null default 'canonical',   -- PRIVATE canonical bucket, no public domain
  add column if not exists r2_key text,
  add column if not exists original_filename text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists expected_size_bytes bigint,                    -- from the client at reserve time
  add column if not exists sha256 text,
  add column if not exists sha256_verified boolean not null default false, -- true only if the server re-hashed the R2 bytes
  add column if not exists hash_source text not null default 'server'
      check (hash_source in ('server','client')),
  add column if not exists revision_seq integer not null default 1,
  add column if not exists canonical_storage_status text not null default 'pending'
      check (canonical_storage_status in ('pending','reserved','stored','failed')),
  add column if not exists versiya integer not null default 1,
  add column if not exists reserved_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  -- Drive replica info (separate from canonical identity)
  add column if not exists drive_file_id text,
  add column if not exists drive_parent_id text,
  add column if not exists drive_revision text,
  add column if not exists drive_sync_status text not null default 'not_configured'
      check (drive_sync_status in ('not_configured','pending','syncing','synced','failed','conflict')),
  add column if not exists drive_last_sync_at timestamptz,
  add column if not exists drive_last_error text,
  -- Sheets replica info (V1 reserved)
  add column if not exists sheets_entity_id text,
  add column if not exists sheets_sync_status text not null default 'not_configured'
      check (sheets_sync_status in ('not_configured','pending','synced','failed','conflict')),
  add column if not exists sheets_last_sync_at timestamptz;

-- status vocabulary grows: replica_missing (Drive copy gone, canonical intact)
alter table public.t2_document_registry drop constraint if exists t2_document_registry_status_check;
alter table public.t2_document_registry add constraint t2_document_registry_status_check
  check (status in ('active','superseded','deleted','failed','replica_missing'));

-- Drive is optional now. Legacy rows keep their external_* values; new writes
-- use drive_*. external_file_id is NEVER the canonical document identity.
alter table public.t2_document_registry alter column provider drop not null;
alter table public.t2_document_registry alter column external_file_id drop not null;
alter table public.t2_document_registry alter column external_parent_id drop not null;

-- Backfill Drive replica columns from legacy external_* (one-time, idempotent).
update public.t2_document_registry
   set drive_file_id = coalesce(drive_file_id, external_file_id),
       drive_parent_id = coalesce(drive_parent_id, external_parent_id),
       drive_sync_status = case when external_file_id is not null and drive_sync_status='not_configured'
                                then 'synced' else drive_sync_status end
 where external_file_id is not null;

create unique index if not exists t2_document_registry_r2_key_uq
  on public.t2_document_registry(r2_key) where r2_key is not null;
create index if not exists t2_document_registry_drive_file_id_ix
  on public.t2_document_registry(drive_file_id) where drive_file_id is not null;
create index if not exists t2_document_registry_lineage_ix
  on public.t2_document_registry(kompaniya_id, loyiha_id, obyekt_id, status);

comment on table public.t2_document_registry is
  'FILE-TRUTH-001: canonical document identity + R2 (file truth) + Drive/Sheets replica state. external_file_id is legacy replica info, never canonical identity.';

-- ── 2. Replica sync job queue ────────────────────────────────────────────
create table if not exists public.t2_replica_sync_job (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  target text not null check (target in ('drive','sheets')),
  entity_type text not null check (entity_type in ('document')),
  entity_id bigint not null,
  operation text not null check (operation in ('mirror','rename','move','content','delete','review')),
  holat text not null default 'pending' check (holat in ('pending','running','synced','failed','conflict')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  base_version integer,
  source_hash text,
  operation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists t2_replica_sync_job_pick_ix
  on public.t2_replica_sync_job(target, holat, next_attempt_at) where holat in ('pending','failed');
create unique index if not exists t2_replica_sync_job_dedupe_uq
  on public.t2_replica_sync_job(target, entity_type, entity_id, operation, operation_id)
  where operation_id is not null;
alter table public.t2_replica_sync_job enable row level security;
revoke all on table public.t2_replica_sync_job from anon, authenticated;
create policy t2_replica_sync_job_read on public.t2_replica_sync_job
  for select to authenticated using ((select public.t2_storage_actor_company_access_v1(kompaniya_id)));

-- ── 3. Two-phase canonical commit (no orphan R2 objects) ─────────────────
--
--   PHASE 1  t2_document_canonical_reserve_v1  -> allocates document_id,
--            canonical_storage_status='reserved', computes the deterministic
--            r2_key from document_id. Idempotent on operation_id.
--   PHASE 2  (Cloudflare function)             -> streams bytes to R2 at r2_key.
--   PHASE 3  t2_document_canonical_finalize_v1  -> 'stored' + 'active', sets
--            sha256/size, supersedes prior active, enqueues the Drive job.
--   RECON    t2_document_canonical_reconcile_v1 -> a reserved row with no R2
--            object after N minutes is failed; the caller cleans the key.

create or replace function public.t2_document_canonical_reserve_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_loyiha_id bigint, p_obyekt_id bigint,
  p_document_type text, p_original_filename text, p_mime_type text,
  p_expected_size bigint, p_client_sha256 text, p_operation_id uuid, p_revision text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry; v_seq integer; v_key text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended('doccanon:'||p_operation_id::text,0));
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);

  if p_obyekt_id is not null and not exists(
      select 1 from public.t2_obyekt o where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id
        and (p_loyiha_id is null or o.loyiha_id=p_loyiha_id)) then
    return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  if p_loyiha_id is not null and not exists(
      select 1 from public.t2_loyiha l where l.id=p_loyiha_id and l.kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH'); end if;

  select * into d from public.t2_document_registry where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if found then
    if d.loyiha_id is distinct from p_loyiha_id or d.obyekt_id is distinct from p_obyekt_id then
      return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
      'r2_bucket',d.r2_bucket,'r2_key',d.r2_key,'canonical_storage_status',d.canonical_storage_status,
      'versiya',d.versiya,'retry',true);
  end if;

  select coalesce(max(revision_seq),0)+1 into v_seq from public.t2_document_registry
   where kompaniya_id=p_kompaniya_id and loyiha_id is not distinct from p_loyiha_id
     and obyekt_id is not distinct from p_obyekt_id and document_type=btrim(p_document_type);

  insert into public.t2_document_registry(
      kompaniya_id,loyiha_id,obyekt_id,provider,document_type,revision,revision_seq,
      original_filename,mime_type,expected_size_bytes,sha256,r2_bucket,
      canonical_storage_status,status,versiya,created_by,actor_id,operation_id,
      reserved_at,drive_sync_status)
    values (p_kompaniya_id,p_loyiha_id,p_obyekt_id,'cloudflare_r2',btrim(p_document_type),
      p_revision,v_seq,p_original_filename,p_mime_type,p_expected_size,nullif(btrim(p_client_sha256),''),
      'canonical','reserved','pending',1,'t2-web',p_actor_id,p_operation_id,now(),'not_configured')
    returning * into d;

  -- deterministic key from the allocated document_id
  v_key := format('docs/%s/%s/%s/d%s/r%s', p_kompaniya_id,
                  coalesce(p_loyiha_id::text,'_'), coalesce(p_obyekt_id::text,'_'), d.id, v_seq);
  update public.t2_document_registry set r2_key=v_key, updated_at=now() where id=d.id returning * into d;

  perform public.t2_audit_yoz(p_kompaniya_id,'document_canonical_reserved','file_truth',d.obyekt_id,
    format('document_id=%s; r2_key=%s; actor_id=%s',d.id,v_key,p_actor_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
    'r2_bucket',d.r2_bucket,'r2_key',v_key,'canonical_storage_status','reserved','versiya',d.versiya);
end $$;

create or replace function public.t2_document_canonical_finalize_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint, p_operation_id uuid,
  p_r2_key text, p_sha256 text, p_size_bytes bigint, p_sha256_verified boolean, p_hash_source text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  perform pg_advisory_xact_lock(hashtextextended('doccanon:'||p_operation_id::text,0));
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
  select * into d from public.t2_document_registry
   where id=p_document_id and kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if d.canonical_storage_status='stored' then
    return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
      'r2_key',d.r2_key,'sha256',d.sha256,'versiya',d.versiya,'retry',true); end if;
  if d.r2_key is distinct from btrim(p_r2_key) then
    return jsonb_build_object('ok',false,'code','CANONICAL_KEY_MISMATCH'); end if;
  if nullif(btrim(p_sha256),'') is null then
    return jsonb_build_object('ok',false,'code','DOCUMENT_CONTRACT_INVALID'); end if;
  if d.sha256 is not null and d.sha256 <> btrim(p_sha256) then
    return jsonb_build_object('ok',false,'code','CANONICAL_HASH_MISMATCH'); end if;

  -- supersede the current active revision of the same (co,proj,obj,type)
  if d.revision_seq>1 then
    update public.t2_document_registry set status='superseded', updated_at=now()
     where kompaniya_id=p_kompaniya_id and loyiha_id is not distinct from d.loyiha_id
       and obyekt_id is not distinct from d.obyekt_id and document_type=d.document_type
       and status='active' and id<>d.id;
  end if;

  update public.t2_document_registry
     set sha256=btrim(p_sha256), size_bytes=p_size_bytes, sha256_verified=coalesce(p_sha256_verified,false),
         hash_source=case when p_hash_source in ('server','client') then p_hash_source else 'client' end,
         canonical_storage_status='stored', status='active', finalized_at=now(), updated_at=now()
   where id=d.id returning * into d;

  insert into public.t2_replica_sync_job(kompaniya_id,target,entity_type,entity_id,operation,base_version,source_hash,operation_id)
    values (p_kompaniya_id,'drive','document',d.id,'mirror',d.versiya,d.sha256,p_operation_id)
    on conflict do nothing;
  update public.t2_document_registry set drive_sync_status='pending' where id=d.id and drive_sync_status='not_configured';

  perform public.t2_audit_yoz(p_kompaniya_id,'document_canonical_stored','file_truth',d.obyekt_id,
    format('document_id=%s; sha256=%s; verified=%s; size=%s; actor_id=%s',d.id,d.sha256,d.sha256_verified,d.size_bytes,p_actor_id),
    'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'revision_seq',d.revision_seq,
    'r2_key',d.r2_key,'sha256',d.sha256,'sha256_verified',d.sha256_verified,'versiya',d.versiya);
end $$;

-- Reconcile stale reservations. p_r2_key_exists is provided by the caller
-- (the reconcile worker HEADs R2 for each key). No R2 access from Postgres.
create or replace function public.t2_document_canonical_reconcile_v1(
  p_document_id bigint, p_r2_key_exists boolean, p_sha256 text default null, p_size bigint default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  select * into d from public.t2_document_registry where id=p_document_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if d.canonical_storage_status<>'reserved' then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_action',d.canonical_storage_status); end if;
  if d.reserved_at > now() - interval '15 minutes' then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_action','too_recent'); end if;
  if p_r2_key_exists and coalesce(nullif(btrim(p_sha256),''),d.sha256) is not null then
    update public.t2_document_registry
       set canonical_storage_status='stored', status='active', finalized_at=now(),
           sha256=coalesce(nullif(btrim(p_sha256),''),d.sha256), size_bytes=coalesce(p_size,d.size_bytes),
           sha256_verified=false, hash_source='client', updated_at=now()
     where id=d.id returning * into d;
    insert into public.t2_replica_sync_job(kompaniya_id,target,entity_type,entity_id,operation,base_version,source_hash)
      values (d.kompaniya_id,'drive','document',d.id,'mirror',d.versiya,d.sha256) on conflict do nothing;
    return jsonb_build_object('ok',true,'document_id',d.id,'action','finalized_from_r2');
  else
    update public.t2_document_registry set canonical_storage_status='failed', status='failed', updated_at=now()
     where id=d.id;
    return jsonb_build_object('ok',true,'document_id',d.id,'action','failed_no_binary','r2_key',d.r2_key);
  end if;
end $$;

-- ── 4. Canonical read authorization + row ────────────────────────────────
create or replace function public.t2_document_canonical_get_v1(p_actor_id bigint, p_document_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  select * into d from public.t2_document_registry where id=p_document_id;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  perform public.t2_actor_kompaniya_azo_tekshir(d.kompaniya_id,p_actor_id);
  if d.canonical_storage_status <> 'stored' or d.r2_key is null then
    return jsonb_build_object('ok',false,'code','CANONICAL_BINARY_MISSING',
      'canonical_storage_status',d.canonical_storage_status); end if;
  return jsonb_build_object('ok',true,'document_id',d.id,'kompaniya_id',d.kompaniya_id,
    'r2_bucket',d.r2_bucket,'r2_key',d.r2_key,'mime_type',d.mime_type,
    'original_filename',d.original_filename,'size_bytes',d.size_bytes,'sha256',d.sha256,
    'sha256_verified',d.sha256_verified,'status',d.status,'versiya',d.versiya);
end $$;

-- ── 5. Replica job lifecycle ─────────────────────────────────────────────
create or replace function public.t2_replica_job_claim_v1(p_target text, p_limit integer default 10)
returns setof public.t2_replica_sync_job language sql security definer set search_path=public,pg_temp as $$
  update public.t2_replica_sync_job j set holat='running', updated_at=now(), attempts=attempts+1
   where j.id in (
     select id from public.t2_replica_sync_job
      where target=p_target and holat in ('pending','failed') and next_attempt_at<=now()
      order by next_attempt_at asc limit greatest(1,least(p_limit,50))
      for update skip locked)
  returning j.*;
$$;

create or replace function public.t2_replica_job_synced_v1(p_job_id bigint, p_drive_file_id text, p_drive_revision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.t2_replica_sync_job;
begin
  update public.t2_replica_sync_job set holat='synced', last_error=null, updated_at=now()
   where id=p_job_id returning * into j;
  if not found then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  if j.entity_type='document' then
    update public.t2_document_registry
       set drive_file_id=p_drive_file_id, drive_revision=p_drive_revision,
           drive_sync_status='synced', drive_last_sync_at=now(), drive_last_error=null, updated_at=now()
     where id=j.entity_id;
  end if;
  return jsonb_build_object('ok',true,'job_id',j.id);
end $$;

create or replace function public.t2_replica_job_failed_v1(p_job_id bigint, p_error text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare j public.t2_replica_sync_job;
begin
  update public.t2_replica_sync_job
     set holat=case when attempts>=8 then 'failed' else 'pending' end,
         next_attempt_at=now() + (least(attempts,8) * interval '2 minutes'),
         last_error=left(coalesce(p_error,'replica sync failed'),1000), updated_at=now()
   where id=p_job_id returning * into j;
  if not found then return jsonb_build_object('ok',false,'code','JOB_NOT_FOUND'); end if;
  if j.entity_type='document' and j.holat='failed' then
    update public.t2_document_registry set drive_sync_status='failed',
      drive_last_error=left(coalesce(p_error,'replica sync failed'),1000), updated_at=now()
     where id=j.entity_id;
  end if;
  return jsonb_build_object('ok',true,'job_id',j.id,'holat',j.holat,'attempts',j.attempts);
end $$;

-- ── 6. Drive write-back commands ─────────────────────────────────────────
create or replace function public.t2_document_replica_rename_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint, p_drive_file_id text,
  p_new_name text, p_drive_revision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
  select * into d from public.t2_document_registry where id=p_document_id and kompaniya_id=p_kompaniya_id for update;
  if not found or d.drive_file_id is distinct from p_drive_file_id then
    return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  update public.t2_document_registry
     set original_filename=btrim(p_new_name), drive_revision=p_drive_revision,
         drive_last_sync_at=now(), updated_at=now()
   where id=p_document_id;
  perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_renamed','file_truth',d.obyekt_id,
    format('document_id=%s; new_name=%s; actor_id=%s',d.id,btrim(p_new_name),p_actor_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id);
end $$;

create or replace function public.t2_document_replica_content_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint,
  p_new_r2_key text, p_new_sha256 text, p_new_size bigint, p_drive_revision text, p_base_version integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry; nd public.t2_document_registry;
begin
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
  select * into d from public.t2_document_registry where id=p_document_id and kompaniya_id=p_kompaniya_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if p_base_version is null or d.versiya<>p_base_version then
    return jsonb_build_object('ok',false,'code','REPLICA_CONFLICT','version',d.versiya); end if;
  if nullif(btrim(p_new_r2_key),'') is null or nullif(btrim(p_new_sha256),'') is null then
    return jsonb_build_object('ok',false,'code','DOCUMENT_CONTRACT_INVALID'); end if;
  if p_new_sha256 = d.sha256 then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_change',true); end if;

  update public.t2_document_registry set status='superseded', updated_at=now() where id=d.id;
  insert into public.t2_document_registry(
      kompaniya_id,loyiha_id,obyekt_id,provider,document_type,revision,revision_seq,
      original_filename,mime_type,size_bytes,sha256,r2_bucket,r2_key,
      canonical_storage_status,status,versiya,created_by,actor_id,operation_id,
      drive_file_id,drive_parent_id,drive_revision,drive_sync_status,drive_last_sync_at)
    values (d.kompaniya_id,d.loyiha_id,d.obyekt_id,'cloudflare_r2',d.document_type,d.revision,d.revision_seq+1,
      d.original_filename,d.mime_type,p_new_size,btrim(p_new_sha256),d.r2_bucket,btrim(p_new_r2_key),
      'stored','active',1,'drive-replica',p_actor_id,gen_random_uuid(),
      d.drive_file_id,d.drive_parent_id,p_drive_revision,'synced',now())
    returning * into nd;
  perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_content_revision','file_truth',d.obyekt_id,
    format('from_document_id=%s; to_document_id=%s; sha256=%s; actor_id=%s',d.id,nd.id,nd.sha256,p_actor_id),
    'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',nd.id,'revision_seq',nd.revision_seq,'superseded',d.id);
end $$;

create or replace function public.t2_document_replica_deleted_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint, p_drive_file_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
  select * into d from public.t2_document_registry where id=p_document_id and kompaniya_id=p_kompaniya_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  -- canonical R2 is NEVER hard-deleted here. Mark the replica missing + review.
  update public.t2_document_registry
     set drive_sync_status='failed', drive_last_error='drive file deleted by user',
         status=case when status='active' then 'replica_missing' else status end, updated_at=now()
   where id=p_document_id;
  insert into public.t2_replica_sync_job(kompaniya_id,target,entity_type,entity_id,operation,base_version)
    values (p_kompaniya_id,'drive','document',p_document_id,'review',d.versiya);
  perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_deleted_review','file_truth',d.obyekt_id,
    format('document_id=%s; drive_file_id=%s; canonical R2 retained; actor_id=%s',d.id,p_drive_file_id,p_actor_id),
    'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'status','replica_missing','r2_retained',true);
end $$;

-- ── 7. Backfill helper (Drive-only -> canonical R2) ──────────────────────
create or replace function public.t2_document_canonical_backfill_v1(
  p_document_id bigint, p_r2_key text, p_sha256 text, p_size bigint, p_mime text, p_drive_revision text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  select * into d from public.t2_document_registry where id=p_document_id for update;
  if not found then return jsonb_build_object('ok',false,'code','DOCUMENT_NOT_FOUND'); end if;
  if d.r2_key is not null then return jsonb_build_object('ok',true,'document_id',d.id,'already',true); end if;
  update public.t2_document_registry
     set r2_key=btrim(p_r2_key), sha256=btrim(p_sha256), size_bytes=p_size,
         mime_type=coalesce(p_mime,mime_type), canonical_storage_status='stored',
         drive_revision=p_drive_revision, drive_sync_status='synced', drive_last_sync_at=now(), updated_at=now()
   where id=p_document_id;
  return jsonb_build_object('ok',true,'document_id',d.id,'backfilled',true);
end $$;

-- ── 8. Grants: service_role only (GAS bridge + Cloudflare functions) ─────
revoke all on function
  public.t2_document_canonical_reserve_v1(bigint,bigint,bigint,bigint,text,text,text,bigint,text,uuid,text),
  public.t2_document_canonical_finalize_v1(bigint,bigint,bigint,uuid,text,text,bigint,boolean,text),
  public.t2_document_canonical_reconcile_v1(bigint,boolean,text,bigint),
  public.t2_document_canonical_get_v1(bigint,bigint),
  public.t2_replica_job_claim_v1(text,integer),
  public.t2_replica_job_synced_v1(bigint,text,text),
  public.t2_replica_job_failed_v1(bigint,text),
  public.t2_document_replica_rename_v1(bigint,bigint,bigint,text,text,text),
  public.t2_document_replica_content_v1(bigint,bigint,bigint,text,text,bigint,text,integer),
  public.t2_document_replica_deleted_v1(bigint,bigint,bigint,text),
  public.t2_document_canonical_backfill_v1(bigint,text,text,bigint,text,text)
from public, anon, authenticated;
