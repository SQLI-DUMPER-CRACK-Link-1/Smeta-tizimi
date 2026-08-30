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
  check ((status in ('verified','legacy')) = (verified_at is not null))
);
create unique index if not exists t2_company_storage_one_primary_active
  on public.t2_company_storage_workspace(kompaniya_id)
  where primary_workspace and status in ('verified','legacy');

create table if not exists public.t2_project_storage_binding (
  loyiha_id bigint primary key references public.t2_loyiha(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  workspace_id bigint not null references public.t2_company_storage_workspace(id),
  project_root_folder_id text not null,
  provisioning_status text not null check (provisioning_status in ('pending','verified','failed')),
  verified_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), versiya integer not null default 1
);

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
  created_by text, created_at timestamptz not null default now(),
  unique(provider, external_file_id)
);

alter table public.t2_obyekt add column if not exists storage_status text not null default 'pending'
  check (storage_status in ('pending','ready','failed'));
alter table public.t2_obyekt add column if not exists storage_error text;
alter table public.t2_obyekt add column if not exists operation_id uuid;
create unique index if not exists t2_obyekt_operation_id_uniq on public.t2_obyekt(operation_id) where operation_id is not null;

alter table public.t2_company_storage_workspace enable row level security;
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

create or replace function public.t2_object_create_failed_v1(p_obyekt_id bigint,p_operation_id uuid,p_error text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 update t2_obyekt set storage_status='failed',storage_error=left(coalesce(p_error,'OBJECT_CREATE_FAILED'),1000)
 where id=p_obyekt_id and operation_id=p_operation_id
 returning jsonb_build_object('ok',true,'obyekt_id',id,'storage_status',storage_status,'storage_error',storage_error);
$$;
