-- T2-LRV-CANONICAL-CORE-001 — SOURCE ONLY, productionga apply qilinmaydi.
-- One entity / one ID / one canonical source; Sheet row number identity emas.
begin;
create table if not exists public.t2_lrv_document (
 id bigint generated always as identity primary key, kompaniya_id bigint not null references public.t2_kompaniya(id), obyekt_id bigint references public.t2_obyekt(id), tur text not null check(tur in ('smeta','f2')), external_key text, holat text not null default 'faol' check(holat in ('faol','bekor')), yaratildi timestamptz not null default now(), unique(kompaniya_id, external_key)
);
create table if not exists public.t2_lrv_document_revision (
 id bigint generated always as identity primary key, document_id bigint not null references public.t2_lrv_document(id), revision_no integer not null, source_hash text not null, imported_at timestamptz not null default now(), immutable_snapshot jsonb not null, unique(document_id,revision_no), unique(document_id,source_hash)
);
create table if not exists public.t2_lrv_document_line (
 id bigint generated always as identity primary key, revision_id bigint not null references public.t2_lrv_document_revision(id), external_row_key text not null, line_kind text not null check(line_kind in ('smeta','f2')), code text, nom text not null, birlik text, quantity numeric, unit_price numeric, amount numeric, raw_snapshot jsonb not null, unique(revision_id,external_row_key)
);
create table if not exists public.t2_lrv_work_type (
 id bigint generated always as identity primary key, code text, nom text not null, birlik text not null, holat text not null default 'faol' check(holat in ('faol','bekor')), versiya integer not null default 1, unique(code,nom,birlik)
);
create table if not exists public.t2_lrv_work_alias (
 id bigint generated always as identity primary key, work_type_id bigint not null references public.t2_lrv_work_type(id), alias_nom text not null, alias_birlik text not null default '', source_line_id bigint references public.t2_lrv_document_line(id), confidence numeric not null check(confidence between 0 and 1), confirmed boolean not null default false, unique(work_type_id,alias_nom,alias_birlik)
);
create table if not exists public.t2_lrv_recipe_version (
 id bigint generated always as identity primary key, work_type_id bigint not null references public.t2_lrv_work_type(id), version_no integer not null, holat text not null default 'draft' check(holat in ('draft','approved','retired')), source_revision_id bigint references public.t2_lrv_document_revision(id), unique(work_type_id,version_no)
);
create table if not exists public.t2_lrv_recipe_resource (
 id bigint generated always as identity primary key, recipe_version_id bigint not null references public.t2_lrv_recipe_version(id), resource_kind text not null check(resource_kind in ('labor','material','equipment')), code text, nom text not null, birlik text not null, norm numeric, ordering_key text not null, unique(recipe_version_id,ordering_key)
);
create table if not exists public.t2_lrv_entity (
 id bigint generated always as identity primary key, obyekt_id bigint not null references public.t2_obyekt(id), parent_id bigint references public.t2_lrv_entity(id), entity_kind text not null check(entity_kind in ('base','additional','replacement','resource')), ordering_key text not null, code text, nom text not null, birlik text, baseline_quantity numeric, holat text not null default 'faol' check(holat in ('faol','replaced','bekor')), versiya integer not null default 1, replacement_of_id bigint references public.t2_lrv_entity(id), created_operation_id uuid unique, unique(obyekt_id,ordering_key)
);
create table if not exists public.t2_lrv_approved_f2 (
 id bigint generated always as identity primary key, source_f2_line_id bigint not null references public.t2_lrv_document_line(id), target_lrv_entity_id bigint not null references public.t2_lrv_entity(id), certified_quantity numeric, certified_unit_price numeric, certified_amount numeric, approved_at timestamptz not null, approved_revision integer not null, frozen boolean not null default true check(frozen), unique(source_f2_line_id)
);
create table if not exists public.t2_lrv_sync_event (
 event_id uuid primary key, operation_id uuid not null, origin text not null check(origin in ('supabase','sheets')), entity_id bigint not null references public.t2_lrv_entity(id), entity_version integer not null, base_version integer not null, projection_hash text not null, occurred_at timestamptz not null, unique(origin,operation_id)
);
create table if not exists public.t2_lrv_sync_conflict (
 id bigint generated always as identity primary key, event_id uuid not null, entity_id bigint not null references public.t2_lrv_entity(id), reason text not null check(reason in ('STALE_VERSION','FROZEN_F2','ROW_MAPPING_MISSING')), base_version integer not null, current_version integer not null, created_at timestamptz not null default now(), unique(event_id,reason)
);
alter table public.t2_lrv_document enable row level security; alter table public.t2_lrv_document_revision enable row level security; alter table public.t2_lrv_document_line enable row level security; alter table public.t2_lrv_work_type enable row level security; alter table public.t2_lrv_work_alias enable row level security; alter table public.t2_lrv_recipe_version enable row level security; alter table public.t2_lrv_recipe_resource enable row level security; alter table public.t2_lrv_entity enable row level security; alter table public.t2_lrv_approved_f2 enable row level security; alter table public.t2_lrv_sync_event enable row level security; alter table public.t2_lrv_sync_conflict enable row level security;
revoke all on public.t2_lrv_document, public.t2_lrv_document_revision,
  public.t2_lrv_document_line, public.t2_lrv_work_type, public.t2_lrv_work_alias,
  public.t2_lrv_recipe_version, public.t2_lrv_recipe_resource, public.t2_lrv_entity,
  public.t2_lrv_approved_f2, public.t2_lrv_sync_event, public.t2_lrv_sync_conflict
  from public, anon, authenticated;
comment on table public.t2_lrv_document_line is 'Immutable original source snapshot; source amount never recalculated or overwritten.';
comment on table public.t2_lrv_approved_f2 is 'Frozen certified F2 facts. certified_amount remains source-certified even when qty*unit_price differs.';
commit;
