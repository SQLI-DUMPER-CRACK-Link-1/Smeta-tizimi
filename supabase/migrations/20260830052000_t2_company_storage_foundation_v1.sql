-- TIZIM_02 storage foundation. Drive is an external projection; these rows are
-- the tenant-scoped source of truth. Do not seed a legacy ROOT here.
create table if not exists public.t2_company_storage_workspace (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  provider text not null check (provider in ('google_drive')),
  mode text not null check (mode in ('shared_drive','my_drive')),
  connection_ref text,
  drive_id text,
  root_folder_id text not null,
  root_folder_name text not null,
  status text not null check (status in ('pending','verified','revoked','legacy')),
  primary_workspace boolean not null default true,
  legacy boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  versiya integer not null default 1,
  operation_id uuid,
  check ((status in ('verified','legacy')) = (verified_at is not null))
);
create table if not exists public.t2_company_storage_legacy_allowlist (
  kompaniya_id bigint primary key references public.t2_kompaniya(id),
  created_at timestamptz not null default now(),
  created_by text
);
create unique index if not exists t2_company_storage_one_primary_active
  on public.t2_company_storage_workspace(kompaniya_id)
  where primary_workspace and status in ('verified','legacy');
alter table public.t2_company_storage_workspace add column if not exists operation_id uuid;
alter table public.t2_company_storage_workspace add constraint t2_company_storage_legacy_flag_ck check ((status='legacy') = legacy);

create table if not exists public.t2_project_storage_binding (
  loyiha_id bigint primary key references public.t2_loyiha(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  workspace_id bigint not null references public.t2_company_storage_workspace(id),
  project_root_folder_id text,
  provisioning_status text not null check (provisioning_status in ('pending','verified','failed')),
  verified_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), versiya integer not null default 1,
  operation_id uuid,
  storage_error text
);
alter table public.t2_project_storage_binding alter column project_root_folder_id drop not null;
alter table public.t2_project_storage_binding add column if not exists operation_id uuid;
alter table public.t2_project_storage_binding add column if not exists storage_error text;
create unique index if not exists t2_project_storage_operation_uq on public.t2_project_storage_binding(operation_id) where operation_id is not null;

create table if not exists public.t2_object_storage_binding (
  obyekt_id bigint primary key references public.t2_obyekt(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  loyiha_id bigint not null references public.t2_loyiha(id),
  workspace_id bigint not null references public.t2_company_storage_workspace(id),
  folder_id text not null, parent_folder_id text not null,
  provisioning_status text not null check (provisioning_status in ('pending','verified','failed')),
  verified_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), versiya integer not null default 1
);

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
  unique(provider, external_file_id)
);
alter table public.t2_document_registry add column if not exists operation_id uuid;
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

-- Read-only reconciliation. It never guesses or writes Drive IDs.
create or replace view public.t2_storage_reconciliation_v1 with (security_invoker=true) as
select o.id as obyekt_id,o.kompaniya_id,o.loyiha_id,o.nom,o.drive_id as legacy_drive_id,
 case when b.obyekt_id is not null then 'MATCHED'
      when o.loyiha_id is null then 'MISSING'
      else 'AMBIGUOUS' end as reconciliation_status
from public.t2_obyekt o left join public.t2_object_storage_binding b on b.obyekt_id=o.id;

comment on table public.t2_company_storage_workspace is 'Canonical tenant storage workspace; never inferred from ROOT_FOLDER_ID.';

create or replace function public.t2_object_create_v1(p_kompaniya_id bigint,p_loyiha_id bigint,p_nom text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_obyekt public.t2_obyekt; v_bind public.t2_project_storage_binding;
begin
  select b.* into v_bind from public.t2_project_storage_binding b join public.t2_loyiha l on l.id=b.loyiha_id
   join public.t2_company_storage_workspace w on w.id=b.workspace_id
   where b.loyiha_id=p_loyiha_id and b.kompaniya_id=p_kompaniya_id and l.kompaniya_id=p_kompaniya_id
     and b.provisioning_status='verified' and w.kompaniya_id=p_kompaniya_id and w.status in ('verified','legacy');
  if not found then return jsonb_build_object('ok',false,'code','PROJECT_STORAGE_NOT_BOUND'); end if;
  select * into v_obyekt from public.t2_obyekt where operation_id=p_operation_id;
  if found then
    if v_obyekt.kompaniya_id<>p_kompaniya_id or v_obyekt.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    return jsonb_build_object('ok',true,'obyekt_id',v_obyekt.id,'storage_status',v_obyekt.storage_status,'retry',true);
  end if;
  insert into public.t2_obyekt(nom,tur,kompaniya_id,loyiha_id,operation_id,storage_status)
    values (btrim(p_nom),'obyekt',p_kompaniya_id,p_loyiha_id,p_operation_id,'pending') returning * into v_obyekt;
  return jsonb_build_object('ok',true,'obyekt_id',v_obyekt.id,'storage_status','pending');
exception when unique_violation then
  select * into v_obyekt from public.t2_obyekt where operation_id=p_operation_id;
  return jsonb_build_object('ok',true,'obyekt_id',v_obyekt.id,'storage_status',v_obyekt.storage_status,'retry',true);
end $$;

create or replace function public.t2_company_storage_bind_v1(
  p_kompaniya_id bigint,p_root_folder_id text,p_root_folder_name text,p_provider text,p_mode text,
  p_drive_id text,p_operation_id uuid,p_expected_version integer default null,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_workspace public.t2_company_storage_workspace; v_status text;
begin
  if p_kompaniya_id is null or p_root_folder_id is null or btrim(p_root_folder_id)='' or p_operation_id is null then return jsonb_build_object('ok',false,'code','STORAGE_ROOT_INVALID'); end if;
  if p_provider<>'google_drive' or p_mode not in ('shared_drive','my_drive') then return jsonb_build_object('ok',false,'code','STORAGE_MODE_MISMATCH'); end if;
  if p_legacy and not exists(select 1 from public.t2_company_storage_legacy_allowlist where kompaniya_id=p_kompaniya_id) then return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN'); end if;
  select * into v_workspace from public.t2_company_storage_workspace where operation_id=p_operation_id;
  if found then
    if p_expected_version is not null and v_workspace.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',v_workspace.versiya); end if;
    if v_workspace.kompaniya_id<>p_kompaniya_id or v_workspace.root_folder_id<>p_root_folder_id or v_workspace.mode<>p_mode then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    return jsonb_build_object('ok',true,'workspace_id',v_workspace.id,'kompaniya_id',v_workspace.kompaniya_id,'status',v_workspace.status,'version',v_workspace.versiya,'retry',true);
  end if;
  if p_legacy then v_status:='legacy'; else v_status:='verified'; end if;
  select * into v_workspace from public.t2_company_storage_workspace where kompaniya_id=p_kompaniya_id and primary_workspace and status in ('verified','legacy') for update;
  if found then
    if p_expected_version is null or v_workspace.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',v_workspace.versiya); end if;
    if v_workspace.legacy and not p_legacy then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    update public.t2_company_storage_workspace set root_folder_id=btrim(p_root_folder_id),root_folder_name=btrim(p_root_folder_name),provider=p_provider,mode=p_mode,drive_id=p_drive_id,status=v_status,legacy=p_legacy,verified_at=now(),updated_at=now(),versiya=versiya+1,operation_id=p_operation_id where id=v_workspace.id returning * into v_workspace;
  else
    if p_expected_version is not null and p_expected_version<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
    insert into public.t2_company_storage_workspace(kompaniya_id,provider,mode,drive_id,root_folder_id,root_folder_name,status,primary_workspace,legacy,verified_at,operation_id)
      values(p_kompaniya_id,p_provider,p_mode,p_drive_id,btrim(p_root_folder_id),btrim(p_root_folder_name),v_status,true,p_legacy,now(),p_operation_id) returning * into v_workspace;
  end if;
  return jsonb_build_object('ok',true,'workspace_id',v_workspace.id,'kompaniya_id',v_workspace.kompaniya_id,'status',v_workspace.status,'version',v_workspace.versiya,'root_folder_id',v_workspace.root_folder_id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH');
end $$;

create or replace function public.t2_object_storage_bind_v1(p_obyekt_id bigint,p_kompaniya_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_folder_id text,p_parent_folder_id text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from t2_obyekt o join t2_project_storage_binding b on b.loyiha_id=o.loyiha_id join t2_company_storage_workspace w on w.id=b.workspace_id where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id and o.loyiha_id=p_loyiha_id and b.workspace_id=p_workspace_id and b.kompaniya_id=p_kompaniya_id and w.kompaniya_id=p_kompaniya_id and w.status in ('verified','legacy')) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  insert into t2_object_storage_binding(obyekt_id,kompaniya_id,loyiha_id,workspace_id,folder_id,parent_folder_id,provisioning_status,verified_at) values(p_obyekt_id,p_kompaniya_id,p_loyiha_id,p_workspace_id,btrim(p_folder_id),btrim(p_parent_folder_id),'verified',now()) on conflict(obyekt_id) do update set folder_id=excluded.folder_id,parent_folder_id=excluded.parent_folder_id,provisioning_status='verified',verified_at=now();
  return jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'folder_id',p_folder_id);
end $$;

create or replace function public.t2_object_create_ready_v1(p_obyekt_id bigint,p_operation_id uuid)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 update t2_obyekt set storage_status='ready',storage_error=null where id=p_obyekt_id and operation_id=p_operation_id and exists(select 1 from t2_object_storage_binding b where b.obyekt_id=p_obyekt_id and b.provisioning_status='verified') returning jsonb_build_object('ok',true,'obyekt_id',id,'storage_status',storage_status);
$$;

create or replace function public.t2_project_storage_provision_v1(p_kompaniya_id bigint,p_loyiha_id bigint,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_project public.t2_loyiha; v_workspace public.t2_company_storage_workspace; v_binding public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select * into v_project from public.t2_loyiha where id=p_loyiha_id;
  if not found then return jsonb_build_object('ok',false,'code','PROJECT_NOT_FOUND'); end if;
  if v_project.kompaniya_id<>p_kompaniya_id then return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH'); end if;
  select * into v_workspace from public.t2_company_storage_workspace where kompaniya_id=p_kompaniya_id and primary_workspace and status in ('verified','legacy') order by id limit 1;
  if not found then return jsonb_build_object('ok',false,'code','STORAGE_WORKSPACE_NOT_CONFIGURED'); end if;
  select * into v_binding from public.t2_project_storage_binding where operation_id=p_operation_id;
  if found then
    if v_binding.loyiha_id<>p_loyiha_id or v_binding.kompaniya_id<>p_kompaniya_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    if p_expected_version is not null and v_binding.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',v_binding.versiya); end if;
    return jsonb_build_object('ok',true,'project_id',v_binding.loyiha_id,'workspace_id',v_binding.workspace_id,'project_root_folder_id',v_binding.project_root_folder_id,'provisioning_status',v_binding.provisioning_status,'retry',true);
  end if;
  select * into v_binding from public.t2_project_storage_binding where loyiha_id=p_loyiha_id;
  if found then
    if v_binding.kompaniya_id<>p_kompaniya_id or v_binding.workspace_id<>v_workspace.id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    update public.t2_project_storage_binding set operation_id=p_operation_id where loyiha_id=p_loyiha_id and operation_id is null;
    return jsonb_build_object('ok',true,'project_id',v_binding.loyiha_id,'workspace_id',v_binding.workspace_id,'project_root_folder_id',v_binding.project_root_folder_id,'provisioning_status',v_binding.provisioning_status,'retry',true);
  end if;
  insert into public.t2_project_storage_binding(loyiha_id,kompaniya_id,workspace_id,provisioning_status,operation_id)
    values(p_loyiha_id,p_kompaniya_id,v_workspace.id,'pending',p_operation_id)
    returning * into v_binding;
  return jsonb_build_object('ok',true,'project_id',p_loyiha_id,'workspace_id',v_workspace.id,'root_folder_id',v_workspace.root_folder_id,'provisioning_status','pending');
exception when unique_violation then
  select * into v_binding from public.t2_project_storage_binding where operation_id=p_operation_id;
  if found and v_binding.kompaniya_id=p_kompaniya_id and v_binding.loyiha_id=p_loyiha_id then return jsonb_build_object('ok',true,'project_id',v_binding.loyiha_id,'workspace_id',v_binding.workspace_id,'project_root_folder_id',v_binding.project_root_folder_id,'provisioning_status',v_binding.provisioning_status,'retry',true); end if;
  return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH');
end $$;

create or replace function public.t2_project_storage_bind_v1(p_kompaniya_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_project_root_folder_id text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_binding public.t2_project_storage_binding;
begin
  if not exists(select 1 from t2_loyiha l join t2_company_storage_workspace w on w.kompaniya_id=l.kompaniya_id and w.id=p_workspace_id where l.id=p_loyiha_id and l.kompaniya_id=p_kompaniya_id and w.status in ('verified','legacy') and w.primary_workspace) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  update t2_project_storage_binding set project_root_folder_id=btrim(p_project_root_folder_id),provisioning_status='verified',storage_error=null,verified_at=now(),updated_at=now(),operation_id=coalesce(operation_id,p_operation_id),versiya=versiya+1 where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and workspace_id=p_workspace_id and (operation_id=p_operation_id or operation_id is null) returning * into v_binding;
  if not found then return jsonb_build_object('ok',false,'code','PROJECT_STORAGE_NOT_BOUND'); end if;
  return jsonb_build_object('ok',true,'project_id',v_binding.loyiha_id,'workspace_id',v_binding.workspace_id,'project_root_folder_id',v_binding.project_root_folder_id,'provisioning_status','verified');
end $$;

create or replace function public.t2_project_storage_failed_v1(p_loyiha_id bigint,p_operation_id uuid,p_error text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 update t2_project_storage_binding set provisioning_status='failed',storage_error=left(coalesce(p_error,'PROJECT_STORAGE_PROVISION_FAILED'),1000),updated_at=now()
 where loyiha_id=p_loyiha_id and operation_id=p_operation_id
 returning jsonb_build_object('ok',true,'project_id',loyiha_id,'provisioning_status',provisioning_status,'storage_error',storage_error);
$$;

create or replace function public.t2_document_registry_upsert_v1(
  p_kompaniya_id bigint,p_loyiha_id bigint,p_obyekt_id bigint,p_provider text,
  p_external_file_id text,p_external_parent_id text,p_document_type text,p_revision text,
  p_operation_id uuid,p_created_by text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_row public.t2_document_registry;
begin
  if p_operation_id is null or p_external_file_id is null or btrim(p_external_file_id)='' then return jsonb_build_object('ok',false,'code','DOCUMENT_CONTRACT_INVALID'); end if;
  if not exists(select 1 from t2_obyekt o join t2_loyiha l on l.id=o.loyiha_id and l.kompaniya_id=o.kompaniya_id join t2_object_storage_binding b on b.obyekt_id=o.id and b.loyiha_id=l.id and b.kompaniya_id=l.kompaniya_id join t2_company_storage_workspace w on w.id=b.workspace_id and w.kompaniya_id=l.kompaniya_id where o.id=p_obyekt_id and o.loyiha_id=p_loyiha_id and o.kompaniya_id=p_kompaniya_id and b.provisioning_status='verified' and w.status in ('verified','legacy')) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  select * into v_row from t2_document_registry where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id;
  if found then
    if v_row.loyiha_id<>p_loyiha_id or v_row.obyekt_id<>p_obyekt_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    return jsonb_build_object('ok',true,'document_id',v_row.id,'external_file_id',v_row.external_file_id,'status',v_row.status,'retry',true);
  end if;
  insert into t2_document_registry(kompaniya_id,loyiha_id,obyekt_id,provider,external_file_id,external_parent_id,document_type,revision,status,created_by,operation_id)
    values(p_kompaniya_id,p_loyiha_id,p_obyekt_id,p_provider,btrim(p_external_file_id),btrim(p_external_parent_id),btrim(p_document_type),p_revision,'active',p_created_by,p_operation_id)
    returning * into v_row;
  return jsonb_build_object('ok',true,'document_id',v_row.id,'external_file_id',v_row.external_file_id,'status',v_row.status);
exception when unique_violation then
  select * into v_row from t2_document_registry where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id;
  if found then return jsonb_build_object('ok',true,'document_id',v_row.id,'external_file_id',v_row.external_file_id,'status',v_row.status,'retry',true); end if;
  return jsonb_build_object('ok',false,'code','DOCUMENT_IDEMPOTENCY_CONFLICT');
end $$;

create or replace function public.t2_object_create_failed_v1(p_obyekt_id bigint,p_operation_id uuid,p_error text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 update t2_obyekt set storage_status='failed',storage_error=left(coalesce(p_error,'OBJECT_CREATE_FAILED'),1000)
 where id=p_obyekt_id and operation_id=p_operation_id
 returning jsonb_build_object('ok',true,'obyekt_id',id,'storage_status',storage_status,'storage_error',storage_error);
$$;

-- STOR-001 hardening.  The first part of this forward migration established
-- the tables.  This part deliberately replaces its provisional commands with
-- actor-bound commands before the migration is ever released.  The GAS bridge
-- uses service_role, so every command must validate the supplied T2 actor in
-- the database; RLS alone is not a service-role boundary.
alter table public.t2_company_storage_workspace add column if not exists actor_id bigint references public.t2_foydalanuvchi(id);
alter table public.t2_project_storage_binding add column if not exists actor_id bigint references public.t2_foydalanuvchi(id);
alter table public.t2_object_storage_binding add column if not exists operation_id uuid;
alter table public.t2_object_storage_binding add column if not exists versiya integer not null default 1;
alter table public.t2_object_storage_binding add column if not exists actor_id bigint references public.t2_foydalanuvchi(id);
alter table public.t2_document_registry add column if not exists actor_id bigint references public.t2_foydalanuvchi(id);
create unique index if not exists t2_company_storage_operation_uq on public.t2_company_storage_workspace(operation_id) where operation_id is not null;
create unique index if not exists t2_object_storage_operation_uq on public.t2_object_storage_binding(kompaniya_id, operation_id) where operation_id is not null;

-- App metadata is immutable to the client.  If an integration has not issued
-- this claim, direct Data API reads fail closed; commands still independently
-- validate their explicit actor against t2_azolik.
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

drop function if exists public.t2_object_create_v1(bigint,bigint,text,uuid,integer);
drop function if exists public.t2_company_storage_bind_v1(bigint,text,text,text,text,text,uuid,integer,boolean);
drop function if exists public.t2_project_storage_provision_v1(bigint,bigint,uuid,integer);
drop function if exists public.t2_project_storage_bind_v1(bigint,bigint,bigint,text,uuid);
drop function if exists public.t2_object_storage_bind_v1(bigint,bigint,bigint,bigint,text,text,uuid);
drop function if exists public.t2_object_create_ready_v1(bigint,uuid);
drop function if exists public.t2_object_create_failed_v1(bigint,uuid,text);
drop function if exists public.t2_project_storage_failed_v1(bigint,uuid,text);
drop function if exists public.t2_document_registry_upsert_v1(bigint,bigint,bigint,text,text,text,text,text,uuid,text);

create or replace function public.t2_storage_actor_require_v1(p_kompaniya_id bigint,p_actor_id bigint)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
end $$;
revoke all on function public.t2_storage_actor_require_v1(bigint,bigint) from public, anon, authenticated;

create or replace function public.t2_company_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_root_folder_id text,p_root_folder_name text,p_provider text,p_mode text,p_drive_id text,p_operation_id uuid,p_expected_version integer default null,p_legacy boolean default false)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.t2_company_storage_workspace; s text;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
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
  s:=case when p_legacy then 'legacy' else 'verified' end;
  if found then update public.t2_company_storage_workspace set root_folder_id=btrim(p_root_folder_id),root_folder_name=btrim(p_root_folder_name),provider=p_provider,mode=p_mode,drive_id=p_drive_id,status=s,legacy=p_legacy,verified_at=now(),updated_at=now(),versiya=versiya+1,operation_id=p_operation_id,actor_id=p_actor_id where id=w.id returning * into w;
  else insert into public.t2_company_storage_workspace(kompaniya_id,provider,mode,drive_id,root_folder_id,root_folder_name,status,legacy,verified_at,operation_id,actor_id) values(p_kompaniya_id,p_provider,p_mode,p_drive_id,btrim(p_root_folder_id),btrim(p_root_folder_name),s,p_legacy,now(),p_operation_id,p_actor_id) returning * into w; end if;
  perform public.t2_audit_yoz(p_kompaniya_id,'storage_workspace_bound','storage',w.id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'workspace_id',w.id,'status',w.status,'version',w.versiya,'root_folder_id',w.root_folder_id);
end $$;

create or replace function public.t2_project_storage_provision_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.t2_company_storage_workspace; b public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
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
  perform public.t2_audit_yoz(p_kompaniya_id,'project_storage_provisioned','loyiha',p_loyiha_id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'root_folder_id',w.root_folder_id,'provisioning_status',b.provisioning_status,'version',b.versiya);
end $$;

create or replace function public.t2_project_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_project_root_folder_id text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
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
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  select * into o from public.t2_obyekt where operation_id=p_operation_id for update;
  if found then if o.kompaniya_id<>p_kompaniya_id or o.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status',o.storage_status,'version',o.versiya,'retry',true); end if;
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and provisioning_status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_STORAGE_NOT_PROVISIONED'); end if;
  if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
  insert into public.t2_obyekt(nom,tur,kompaniya_id,loyiha_id,operation_id,storage_status,versiya) values(btrim(p_nom),'obyekt',p_kompaniya_id,p_loyiha_id,p_operation_id,'pending',1) returning * into o;
  perform public.t2_audit_yoz(p_kompaniya_id,'object_storage_pending','obyekt',o.id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','pending','version',o.versiya);
end $$;

create or replace function public.t2_object_storage_bind_v1(p_kompaniya_id bigint,p_actor_id bigint,p_obyekt_id bigint,p_loyiha_id bigint,p_workspace_id bigint,p_folder_id text,p_parent_folder_id text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_object_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
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
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id); select * into o from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id for update;
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
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if; perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0)); perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if not exists(select 1 from public.t2_object_storage_binding b where b.obyekt_id=p_obyekt_id and b.kompaniya_id=p_kompaniya_id and b.loyiha_id=p_loyiha_id and b.provisioning_status='verified' and b.folder_id=btrim(p_external_parent_id)) then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
  select * into d from public.t2_document_registry where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update;
  if found then if d.loyiha_id<>p_loyiha_id or d.obyekt_id<>p_obyekt_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'document_id',d.id,'external_file_id',d.external_file_id,'status',d.status,'retry',true); end if;
  insert into public.t2_document_registry(kompaniya_id,loyiha_id,obyekt_id,provider,external_file_id,external_parent_id,document_type,revision,status,created_by,operation_id,actor_id) values(p_kompaniya_id,p_loyiha_id,p_obyekt_id,p_provider,btrim(p_external_file_id),btrim(p_external_parent_id),btrim(p_document_type),p_revision,'active',p_created_by,p_operation_id,p_actor_id) returning * into d;
  perform public.t2_audit_yoz(p_kompaniya_id,'storage_document_registered','hujjat',d.id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'document_id',d.id,'external_file_id',d.external_file_id,'status',d.status);
end $$;

revoke all on function public.t2_company_storage_bind_v1(bigint,bigint,text,text,text,text,text,uuid,integer,boolean), public.t2_project_storage_provision_v1(bigint,bigint,bigint,uuid,integer), public.t2_project_storage_bind_v1(bigint,bigint,bigint,bigint,text,uuid,integer), public.t2_object_create_v1(bigint,bigint,bigint,text,uuid,integer), public.t2_object_storage_bind_v1(bigint,bigint,bigint,bigint,bigint,text,text,uuid,integer), public.t2_object_create_ready_v1(bigint,bigint,bigint,uuid,integer), public.t2_document_registry_upsert_v1(bigint,bigint,bigint,bigint,text,text,text,text,text,uuid,text) from public, anon, authenticated;

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
revoke all on function public.t2_project_storage_failed_v1(bigint,bigint,bigint,uuid,text), public.t2_object_create_failed_v1(bigint,bigint,bigint,uuid,text) from public, anon, authenticated;
