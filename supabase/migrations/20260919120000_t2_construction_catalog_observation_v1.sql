-- T2-GAS-EXIT-LRV-CONTROL-001 foundation -- Construction Catalog
-- observation layer. SOURCE ONLY. Production freeze active -- NOT
-- applied in this task. See ops/handoff/T2_CONSTRUCTION_CATALOG_001.md.
--
-- Additive only. Does not touch t2_ish_turi / t2_narx / t2_qator /
-- t2_akt_qator / t2_material_alias_royxat -- those stay canonical truth.
-- These tables are the missing provenance-tracked "sighting" layer: every
-- observed work-type/resource occurrence from an imported document, kept
-- separate from canonical until a human confirms a deterministic match
-- (t2_catalog_match_candidate). No write RPC in this task -- schema only.

begin;

create table if not exists public.t2_work_type_observation (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.t2_kompaniya(id),
  project_id bigint references public.t2_loyiha(id),
  object_id bigint references public.t2_obyekt(id),
  document_id bigint,                 -- t2_manba.id or t2_akt.id, depending on source_type
  revision_id bigint,
  source_line_id bigint,              -- t2_xom.id when available (smeta); null for F2 today
  code text,
  name text,
  unit text,
  source_type text not null check (source_type in ('smeta','f2','other')),
  created_at timestamptz not null default now()
);
create index if not exists t2_work_type_observation_company_idx
  on public.t2_work_type_observation (company_id, code);
create index if not exists t2_work_type_observation_object_idx
  on public.t2_work_type_observation (object_id) where object_id is not null;

create table if not exists public.t2_resource_observation (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.t2_kompaniya(id),
  project_id bigint references public.t2_loyiha(id),
  object_id bigint references public.t2_obyekt(id),
  document_id bigint,
  revision_id bigint,
  source_line_id bigint,
  resource_kind text not null check (resource_kind in ('labor','machine','material','equipment','other')),
  code text,
  name text,
  unit text,
  source_type text not null check (source_type in ('smeta','f2','other')),
  created_at timestamptz not null default now()
);
create index if not exists t2_resource_observation_company_idx
  on public.t2_resource_observation (company_id, code);

create table if not exists public.t2_work_resource_observation (
  id bigint generated always as identity primary key,
  work_type_observation_id bigint not null references public.t2_work_type_observation(id) on delete cascade,
  resource_observation_id bigint not null references public.t2_resource_observation(id) on delete cascade,
  observed_qty numeric,
  observed_unit text,
  created_at timestamptz not null default now(),
  unique (work_type_observation_id, resource_observation_id)
);

create table if not exists public.t2_catalog_match_candidate (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.t2_kompaniya(id),
  observation_type text not null check (observation_type in ('work_type','resource')),
  observation_id bigint not null,     -- t2_work_type_observation.id or t2_resource_observation.id, per observation_type
  candidate_canonical_kod text,
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  holat text not null default 'kutmoqda' check (holat in ('kutmoqda','tasdiqlangan','rad_etilgan')),
  reviewed_by bigint references public.t2_foydalanuvchi(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists t2_catalog_match_candidate_pending_idx
  on public.t2_catalog_match_candidate (company_id, holat) where holat = 'kutmoqda';

alter table public.t2_work_type_observation enable row level security;
alter table public.t2_resource_observation enable row level security;
alter table public.t2_work_resource_observation enable row level security;
alter table public.t2_catalog_match_candidate enable row level security;

revoke all on public.t2_work_type_observation, public.t2_resource_observation,
  public.t2_work_resource_observation, public.t2_catalog_match_candidate
  from public, anon, authenticated;

comment on table public.t2_work_type_observation is
  'T2-GAS-EXIT-LRV-CONTROL-001: provenance-tracked work-type sighting from an imported document. Does NOT auto-update t2_ish_turi -- see t2_catalog_match_candidate for the human-reviewed merge path.';
comment on table public.t2_resource_observation is
  'T2-GAS-EXIT-LRV-CONTROL-001: provenance-tracked resource (labor/machine/material/equipment) sighting from an imported document. Does NOT auto-update t2_narx/t2_material_alias_royxat.';
comment on table public.t2_work_resource_observation is
  'T2-GAS-EXIT-LRV-CONTROL-001: the recipe line -- this work-type observation was seen with this resource observation at this quantity, in this one document occurrence.';
comment on table public.t2_catalog_match_candidate is
  'T2-GAS-EXIT-LRV-CONTROL-001: ambiguous observation -> canonical-code match queue. Fuzzy suggestion (confidence) allowed; fuzzy AUTO merge is not -- only holat=tasdiqlangan (human-reviewed) feeds a canonical table, via a merge command not written in this task.';

commit;
