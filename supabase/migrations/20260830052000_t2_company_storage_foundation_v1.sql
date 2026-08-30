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
