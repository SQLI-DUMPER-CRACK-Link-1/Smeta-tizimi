-- TIZIM_02 storage foundation (corrected consolidation, applied to production
-- 2026-09-01 as a single migration `t2_company_storage_foundation_v1`).
--
-- This file supersedes the earlier split (20260831190000 legacy-write policy,
-- 20260831191000 reconciliation v2) — both are folded in here. Two production
-- bugs found by behavioral acceptance and fixed here:
--   1. DOMAIN COUPLING: storage auth called t2_mindmap_actor_tekshir, which
--      blocks boss/rahbar. Storage now uses a generic, module-agnostic
--      company-membership guard (t2_actor_kompaniya_azo_tekshir).
--   2. AUDIT FK: workspace/project/document audit calls passed a non-object id
--      as t2_audit_yoz(p_obyekt_id) which FKs t2_obyekt(id). Those calls now
--      pass NULL and record the real id in the tafsilot text.
--
-- Drive is an external projection; these rows are the tenant source of truth.
-- Never seed a legacy ROOT here.

create table if not exists public.t2_company_storage_workspace (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  provider text not null check (provider in ('google_drive')),
  mode text not null check (mode in ('shared_drive','my_drive')),
  connection_ref text, drive_id text,
  root_folder_id text not null, root_folder_name text not null,
  status text not null check (status in ('pending','verified','revoked','legacy')),
  primary_workspace boolean not null default true,
  legacy boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  versiya integer not null default 1, operation_id uuid, actor_id bigint references public.t2_foydalanuvchi(id),
  check ((status in ('verified','legacy')) = (verified_at is not null))
);
create table if not exists public.t2_company_storage_legacy_allowlist (
  kompaniya_id bigint primary key references public.t2_kompaniya(id),
  created_at timestamptz not null default now(), created_by text
);
create unique index if not exists t2_company_storage_one_primary_active
  on public.t2_company_storage_workspace(kompaniya_id)
  where primary_workspace and status in ('verified','legacy');
create unique index if not exists t2_company_storage_operation_uq on public.t2_company_storage_workspace(operation_id) where operation_id is not null;
do $mig$ begin
  if not exists (select 1 from pg_constraint where conname='t2_company_storage_legacy_flag_ck') then
    alter table public.t2_company_storage_workspace add constraint t2_company_storage_legacy_flag_ck check ((status='legacy') = legacy);
  end if;
end $mig$;

create table if not exists public.t2_project_storage_binding (
  loyiha_id bigint primary key references public.t2_loyiha(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  workspace_id bigint not null references public.t2_company_storage_workspace(id),
  project_root_folder_id text,
  provisioning_status text not null check (provisioning_status in ('pending','verified','failed')),
  verified_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), versiya integer not null default 1,
  operation_id uuid, storage_error text, actor_id bigint references public.t2_foydalanuvchi(id)
);
create unique index if not exists t2_project_storage_operation_uq on public.t2_project_storage_binding(operation_id) where operation_id is not null;

create table if not exists public.t2_object_storage_binding (
  obyekt_id bigint primary key references public.t2_obyekt(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  loyiha_id bigint not null references public.t2_loyiha(id),
  workspace_id bigint not null references public.t2_company_storage_workspace(id),
  folder_id text not null, parent_folder_id text not null,
  provisioning_status text not null check (provisioning_status in ('pending','verified','failed')),
  verified_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), versiya integer not null default 1,
  operation_id uuid, actor_id bigint references public.t2_foydalanuvchi(id)
);
create unique index if not exists t2_object_storage_operation_uq on public.t2_object_storage_binding(kompaniya_id, operation_id) where operation_id is not null;

create table if not exists public.t2_document_registry (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  loyiha_id bigint not null references public.t2_loyiha(id),
  obyekt_id bigint references public.t2_obyekt(id),
  provider text not null check (provider in ('google_drive')),
  external_file_id text not null, external_parent_id text not null,
  document_type text not null, revision text, checksum text,
  status text not null check (status in ('active','superseded','deleted','failed')),
  created_by text, created_at timestamptz not null default now(), operation_id uuid,
  actor_id bigint references public.t2_foydalanuvchi(id),
  unique(provider, external_file_id)
);
create unique index if not exists t2_document_registry_operation_uq on public.t2_document_registry(kompaniya_id,operation_id) where operation_id is not null;

alter table public.t2_obyekt add column if not exists storage_status text not null default 'pending'
  check (storage_status in ('pending','ready','failed'));
alter table public.t2_obyekt add column if not exists storage_error text;
alter table public.t2_obyekt add column if not exists operation_id uuid;
create unique index if not exists t2_obyekt_operation_id_uniq on public.t2_obyekt(operation_id) where operation_id is not null;

alter table public.t2_company_storage_workspace enable row level security;
alter table public.t2_company_storage_legacy_allowlist enable row level security;
alter table public.t2_project_storage_binding enable row level security;
alter table public.t2_object_storage_binding enable row level security;
alter table public.t2_document_registry enable row level security;

comment on table public.t2_company_storage_workspace is 'Canonical tenant storage workspace; never inferred from ROOT_FOLDER_ID.';
comment on table public.t2_company_storage_legacy_allowlist is 'Companies explicitly permitted a legacy (TIZIM_01 root) workspace. Legacy = read/reconcile only; write commands return LEGACY_WORKSPACE_FORBIDDEN.';

-- ── Generic company-membership guard (canonical, module-agnostic) ──────────
create or replace function public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id bigint, p_actor_id bigint)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0 then raise exception 'kompaniya_id majburiy' using errcode='22023'; end if;
  if p_actor_id is null or p_actor_id <= 0 then raise exception 'authenticated actor majburiy' using errcode='22023'; end if;
  select a.rol into v_rol from public.t2_azolik a
   where a.kompaniya_id=p_kompaniya_id and a.foydalanuvchi_id=p_actor_id and a.holat='faol' for share;
  if not found then raise exception 'actor bu kompaniyaning faol a''zosi emas' using errcode='42501'; end if;
  return v_rol;
end $$;
revoke all on function public.t2_actor_kompaniya_azo_tekshir(bigint,bigint) from public, anon, authenticated;

create or replace function public.t2_storage_actor_company_access_v1(p_kompaniya_id bigint)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists (
    select 1 from public.t2_azolik a
    where a.kompaniya_id=p_kompaniya_id and a.holat='faol'
      and a.foydalanuvchi_id = nullif((select auth.jwt()->'app_metadata'->>'t2_actor_id'),'')::bigint
  );
$$;
revoke all on function public.t2_storage_actor_company_access_v1(bigint) from public, anon;
grant execute on function public.t2_storage_actor_company_access_v1(bigint) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['t2_company_storage_workspace','t2_company_storage_legacy_allowlist','t2_project_storage_binding','t2_object_storage_binding','t2_document_registry'] loop
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('drop policy if exists t2_storage_tenant_read_v1 on public.%I', t);
    execute format('create policy t2_storage_tenant_read_v1 on public.%I for select to authenticated using ((select public.t2_storage_actor_company_access_v1(kompaniya_id)))', t);
  end loop;
end $$;

create or replace function public.t2_storage_actor_require_v1(p_kompaniya_id bigint,p_actor_id bigint)
returns text language plpgsql security definer set search_path=public,pg_temp as $$
begin
  return public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id,p_actor_id);
end $$;
revoke all on function public.t2_storage_actor_require_v1(bigint,bigint) from public, anon, authenticated;

-- ── Deterministic reconciliation (flag B) ────────────────────────────────
create or replace view public.t2_storage_reconciliation_v2 with (security_invoker=true) as
select o.id as obyekt_id, o.kompaniya_id, o.loyiha_id, o.nom as obyekt_nom,
  nullif(btrim(o.drive_id),'') as legacy_drive_id, b.folder_id as canonical_folder_id,
  b.provisioning_status as binding_status,
  case
    when b.obyekt_id is not null and b.provisioning_status='verified' and nullif(btrim(o.drive_id),'') is not null and b.folder_id=btrim(o.drive_id) then 'MATCHED'
    when b.obyekt_id is not null and b.provisioning_status='verified' and nullif(btrim(o.drive_id),'') is not null and b.folder_id<>btrim(o.drive_id) then 'CONFLICT_CHECK'
    when b.obyekt_id is not null and b.provisioning_status='verified' then 'BOUND_NEW'
    when nullif(btrim(o.drive_id),'') is not null then 'PENDING'
    else 'NONE'
  end as reconciliation_status
from public.t2_obyekt o
left join public.t2_object_storage_binding b on b.obyekt_id=o.id and b.kompaniya_id=o.kompaniya_id;
comment on view public.t2_storage_reconciliation_v2 is 'Deterministic legacy->canonical reconciliation. MATCHED only on exact folder-id equality; never name-guessed.';

create or replace view public.t2_storage_reconciliation_v1 with (security_invoker=true) as
select obyekt_id, kompaniya_id, loyiha_id, obyekt_nom as nom, legacy_drive_id,
  case reconciliation_status when 'MATCHED' then 'MATCHED' when 'NONE' then 'MISSING' else 'AMBIGUOUS' end as reconciliation_status
from public.t2_storage_reconciliation_v2;

-- ── Legacy write policy helper (flag A) ──────────────────────────────────
create or replace function public.t2_storage_primary_workspace_status_v1(p_kompaniya_id bigint)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select w.status from public.t2_company_storage_workspace w
  where w.kompaniya_id=p_kompaniya_id and w.primary_workspace and w.status in ('verified','legacy')
  order by w.id limit 1;
$$;
revoke all on function public.t2_storage_primary_workspace_status_v1(bigint) from public, anon, authenticated;

-- ── Commands (actor-bound, idempotent, version-checked, fail-closed) ─────
-- AUDIT FIX: non-object entities pass t2_audit_yoz(p_obyekt_id => NULL).

create or replace function public.t2_company_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_root_folder_id text,p_root_folder_name text,p_provider text,p_mode text,p_drive_id text,p_operation_id uuid,p_expected_version integer default null,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.t2_company_storage_workspace; s text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if nullif(btrim(p_root_folder_id),'') is null or p_provider<>'google_drive' or p_mode not in ('shared_drive','my_drive') then return jsonb_build_object('ok',false,'code','STORAGE_ROOT_NOT_VERIFIED'); end if;
  if p_legacy and not exists(select 1 from public.t2_company_storage_legacy_allowlist where kompaniya_id=p_kompaniya_id) then return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN'); end if;
  select * into w from public.t2_company_storage_workspace where operation_id=p_operation_id for update;
  if found then
    if w.kompaniya_id<>p_kompaniya_id or w.root_folder_id<>btrim(p_root_folder_id) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    return jsonb_build_object('ok',true,'workspace_id',w.id,'status',w.status,'version',w.versiya,'retry',true);
  end if;
  select * into w from public.t2_company_storage_workspace where kompaniya_id=p_kompaniya_id and primary_workspace and status in ('verified','legacy') for update;
  if found and (p_expected_version is null or w.versiya<>p_expected_version) then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',w.versiya); end if;
  if not found and coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
  s := case when p_legacy then 'legacy' else 'verified' end;
  if found then update public.t2_company_storage_workspace set root_folder_id=btrim(p_root_folder_id),root_folder_name=btrim(p_root_folder_name),provider=p_provider,mode=p_mode,drive_id=p_drive_id,status=s,legacy=p_legacy,verified_at=now(),updated_at=now(),versiya=versiya+1,operation_id=p_operation_id,actor_id=p_actor_id where id=w.id returning * into w;
  else insert into public.t2_company_storage_workspace(kompaniya_id,provider,mode,drive_id,root_folder_id,root_folder_name,status,legacy,verified_at,operation_id,actor_id) values(p_kompaniya_id,p_provider,p_mode,p_drive_id,btrim(p_root_folder_id),btrim(p_root_folder_name),s,p_legacy,now(),p_operation_id,p_actor_id) returning * into w; end if;
  perform public.t2_audit_yoz(p_kompaniya_id,'storage_workspace_bound','storage',null,format('workspace_id=%s; actor_id=%s; operation_id=%s',w.id,p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'workspace_id',w.id,'status',w.status,'version',w.versiya,'root_folder_id',w.root_folder_id);
end $$;

create or replace function public.t2_project_storage_provision_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.t2_company_storage_workspace; b public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if public.t2_storage_primary_workspace_status_v1(p_kompaniya_id)='legacy' then return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN'); end if;
  if not exists(select 1 from public.t2_loyiha where id=p_loyiha_id and kompaniya_id=p_kompaniya_id and holat='faol') then return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH'); end if;
  select * into b from public.t2_project_storage_binding where operation_id=p_operation_id for update;
  if found then if b.kompaniya_id<>p_kompaniya_id or b.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'project_root_folder_id',b.project_root_folder_id,'provisioning_status',b.provisioning_status,'version',b.versiya,'retry',true); end if;
  select * into w from public.t2_company_storage_workspace where kompaniya_id=p_kompaniya_id and primary_workspace and status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','STORAGE_WORKSPACE_NOT_CONFIGURED'); end if;
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id for update;
  if found then
    if b.kompaniya_id<>p_kompaniya_id or b.workspace_id<>w.id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    if p_expected_version is not null and b.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',b.versiya); end if;
    update public.t2_project_storage_binding set operation_id=p_operation_id,actor_id=p_actor_id where loyiha_id=p_loyiha_id returning * into b;
  else
    if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
    insert into public.t2_project_storage_binding(loyiha_id,kompaniya_id,workspace_id,provisioning_status,operation_id,actor_id) values(p_loyiha_id,p_kompaniya_id,w.id,'pending',p_operation_id,p_actor_id) returning * into b;
  end if;
  perform public.t2_audit_yoz(p_kompaniya_id,'project_storage_provisioned','storage',null,format('loyiha_id=%s; actor_id=%s; operation_id=%s',p_loyiha_id,p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'root_folder_id',w.root_folder_id,'provisioning_status',b.provisioning_status,'version',b.versiya);
end $$;

create or replace function public.t2_project_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_project_root_folder_id text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and workspace_id=p_workspace_id for update;
  if not found then return jsonb_build_object('ok',false,'code','PROJECT_STORAGE_NOT_BOUND'); end if;
  if b.operation_id<>p_operation_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  if p_expected_version is not null and b.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',b.versiya); end if;
  if b.provisioning_status='verified' then return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'project_root_folder_id',b.project_root_folder_id,'provisioning_status','verified','version',b.versiya,'retry',true); end if;
  update public.t2_project_storage_binding set project_root_folder_id=btrim(p_project_root_folder_id),provisioning_status='verified',storage_error=null,verified_at=now(),updated_at=now(),versiya=versiya+1 where loyiha_id=p_loyiha_id returning * into b;
  return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'project_root_folder_id',b.project_root_folder_id,'provisioning_status','verified','version',b.versiya);
end $$;

create or replace function public.t2_object_create_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_nom text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_project_storage_binding; o public.t2_obyekt;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if public.t2_storage_primary_workspace_status_v1(p_kompaniya_id)='legacy' then return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN'); end if;
  select * into o from public.t2_obyekt where operation_id=p_operation_id for update;
  if found then if o.kompaniya_id<>p_kompaniya_id or o.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status',o.storage_status,'version',o.versiya,'retry',true); end if;
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and provisioning_status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_STORAGE_NOT_PROVISIONED'); end if;
  if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
  insert into public.t2_obyekt(nom,tur,kompaniya_id,loyiha_id,operation_id,storage_status,versiya) values(btrim(p_nom),'obyekt',p_kompaniya_id,p_loyiha_id,p_operation_id,'pending',1) returning * into o;
  perform public.t2_audit_yoz(p_kompaniya_id,'object_storage_pending','storage',o.id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','pending','version',o.versiya);
end $$;

create or replace function public.t2_object_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_folder_id text,p_parent_folder_id text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_object_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if not exists(select 1 from public.t2_obyekt o join public.t2_project_storage_binding p on p.loyiha_id=o.loyiha_id join public.t2_company_storage_workspace w on w.id=p.workspace_id where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id and o.loyiha_id=p_loyiha_id and p.workspace_id=p_workspace_id and p.provisioning_status='verified' and w.kompaniya_id=p_kompaniya_id and w.status='verified') then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  select * into b from public.t2_object_storage_binding where obyekt_id=p_obyekt_id for update;
  if found then if b.operation_id<>p_operation_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; if p_expected_version is not null and b.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',b.versiya); end if; return jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'folder_id',b.folder_id,'version',b.versiya,'retry',true); end if;
  insert into public.t2_object_storage_binding(obyekt_id,kompaniya_id,loyiha_id,workspace_id,folder_id,parent_folder_id,provisioning_status,verified_at,operation_id,actor_id) values(p_obyekt_id,p_kompaniya_id,p_loyiha_id,p_workspace_id,btrim(p_folder_id),btrim(p_parent_folder_id),'verified',now(),p_operation_id,p_actor_id) returning * into b;
  return jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'folder_id',b.folder_id,'version',b.versiya);
end $$;

create or replace function public.t2_object_create_ready_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.t2_obyekt;
begin
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  select * into o from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id for update;
  if not found or o.operation_id<>p_operation_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  if p_expected_version is not null and o.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',o.versiya); end if;
  if o.storage_status='ready' then return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','ready','version',o.versiya,'retry',true); end if;
  if not exists(select 1 from public.t2_object_storage_binding where obyekt_id=p_obyekt_id and provisioning_status='verified') then return jsonb_build_object('ok',false,'code','OBJECT_STORAGE_NOT_PROVISIONED'); end if;
  update public.t2_obyekt set storage_status='ready',storage_error=null,versiya=versiya+1,yangilandi=now() where id=p_obyekt_id returning * into o;
  return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','ready','version',o.versiya);
end $$;

create or replace function public.t2_document_registry_upsert_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_obyekt_id bigint,p_provider text,p_external_file_id text,p_external_parent_id text,p_document_type text,p_revision text,p_operation_id uuid,p_created_by text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.t2_document_registry;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if not exists(select 1 from public.t2_object_storage_binding b where b.obyekt_id=p_obyekt_id and b.kompaniya_id=p_kompaniya_id and b.loyiha_id=p_loyiha_id and b.provisioning_status='verified' and b.folder_id=btrim(p_external_parent_id)) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  select * into d from public.t2_document_registry where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if found then if d.loyiha_id<>p_loyiha_id or d.obyekt_id<>p_obyekt_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'document_id',d.id,'external_file_id',d.external_file_id,'status',d.status,'retry',true); end if;
  insert into public.t2_document_registry(kompaniya_id,loyiha_id,obyekt_id,provider,external_file_id,external_parent_id,document_type,revision,status,created_by,operation_id,actor_id) values(p_kompaniya_id,p_loyiha_id,p_obyekt_id,p_provider,btrim(p_external_file_id),btrim(p_external_parent_id),btrim(p_document_type),p_revision,'active',p_created_by,p_operation_id,p_actor_id) returning * into d;
  perform public.t2_audit_yoz(p_kompaniya_id,'storage_document_registered','storage',p_obyekt_id,format('document_id=%s; actor_id=%s; operation_id=%s',d.id,p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'external_file_id',d.external_file_id,'status',d.status);
end $$;

create or replace function public.t2_project_storage_failed_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_operation_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_project_storage_binding;
begin
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  update public.t2_project_storage_binding set provisioning_status='failed',storage_error=left(coalesce(p_error,'PROJECT_STORAGE_PROVISION_FAILED'),1000),updated_at=now(),versiya=versiya+1 where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and operation_id=p_operation_id returning * into b;
  if not found then return jsonb_build_object('ok',false,'code','PROJECT_STORAGE_NOT_BOUND'); end if;
  return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'provisioning_status','failed','version',b.versiya);
end $$;

create or replace function public.t2_object_create_failed_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_operation_id uuid,p_error text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.t2_obyekt;
begin
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  update public.t2_obyekt set storage_status='failed',storage_error=left(coalesce(p_error,'OBJECT_CREATE_FAILED'),1000),versiya=versiya+1,yangilandi=now() where id=p_obyekt_id and kompaniya_id=p_kompaniya_id and operation_id=p_operation_id returning * into o;
  if not found then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','failed','version',o.versiya);
end $$;

revoke all on function
  public.t2_company_storage_bind_v1(bigint,bigint,text,text,text,text,text,uuid,integer,boolean),
  public.t2_project_storage_provision_v1(bigint,bigint,bigint,uuid,integer),
  public.t2_project_storage_bind_v1(bigint,bigint,bigint,bigint,text,uuid,integer),
  public.t2_object_create_v1(bigint,bigint,bigint,text,uuid,integer),
  public.t2_object_storage_bind_v1(bigint,bigint,bigint,bigint,bigint,text,text,uuid,integer),
  public.t2_object_create_ready_v1(bigint,bigint,bigint,uuid,integer),
  public.t2_document_registry_upsert_v1(bigint,bigint,bigint,bigint,text,text,text,text,text,uuid,text),
  public.t2_project_storage_failed_v1(bigint,bigint,bigint,uuid,text),
  public.t2_object_create_failed_v1(bigint,bigint,bigint,uuid,text)
from public, anon, authenticated;
