-- T2-LRV-EXACT-F2-INTEGRATION-003 -- sync envelope (Bridge gap fix,
-- schema-only half). SOURCE ONLY. Production freeze active -- NOT
-- applied in this task. See ops/handoff/T2_BRIDGE_CALLER_AUDIT_003.md
-- and T2_LRV_EXACT_F2_INTEGRATION_003.md Section 3/7.
--
-- ADAPTs Codex's t2_lrv_sync_event/t2_lrv_sync_conflict semantics
-- (codex/t2-lrv-canonical-core-v1, ACCEPTED in full) onto the EXISTING
-- entities (t2_qator, t2_akt_qator) instead of a new parallel
-- t2_lrv_entity table -- there is no single "entity" table, so a
-- generic (entity_table, entity_id) pair is used instead of a foreign key
-- to one table.
--
-- Schema only. The GAS-side writer (Smeta tizimi/T2_Kozgu.js) is NOT
-- changed in this task -- wiring it to write real events here is a
-- GAS-deploy-requiring follow-up, out of scope under the production
-- freeze ("GAS deploy YO'Q").

begin;

create table if not exists public.t2_lrv_sync_event (
  event_id uuid primary key,
  operation_id uuid not null,
  origin text not null check (origin in ('supabase','sheets')),
  entity_table text not null check (entity_table in ('t2_qator','t2_akt_qator')),
  entity_id bigint not null,
  entity_version integer not null,
  base_version integer not null,
  projection_hash text not null,
  occurred_at timestamptz not null default now(),
  unique (origin, operation_id)
);
create index if not exists t2_lrv_sync_event_entity_idx
  on public.t2_lrv_sync_event (entity_table, entity_id, occurred_at desc);

create table if not exists public.t2_lrv_sync_conflict (
  id bigint generated always as identity primary key,
  event_id uuid not null references public.t2_lrv_sync_event(event_id),
  entity_table text not null check (entity_table in ('t2_qator','t2_akt_qator')),
  entity_id bigint not null,
  reason text not null check (reason in ('STALE_VERSION','FROZEN_F2','ROW_MAPPING_MISSING')),
  base_version integer not null,
  current_version integer not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, reason)
);
create index if not exists t2_lrv_sync_conflict_open_idx
  on public.t2_lrv_sync_conflict (entity_table, entity_id) where not resolved;

alter table public.t2_lrv_sync_event enable row level security;
alter table public.t2_lrv_sync_conflict enable row level security;
revoke all on public.t2_lrv_sync_event, public.t2_lrv_sync_conflict from public, anon, authenticated;

comment on table public.t2_lrv_sync_event is
  'T2-LRV-EXACT-F2-INTEGRATION-003: Sheets<->Supabase sync envelope, adapted from codex/t2-lrv-canonical-core-v1 (ACCEPTED semantics) onto existing t2_qator/t2_akt_qator via a generic (entity_table, entity_id) pair -- no parallel t2_lrv_entity table. operation_id gives idempotency the current GAS bridge (T2_Kozgu.js) lacks (see T2_BRIDGE_CALLER_AUDIT_003.md Part B1).';
comment on table public.t2_lrv_sync_conflict is
  'One row per detected conflict: STALE_VERSION (base_version mismatch), FROZEN_F2 (attempted edit of a certified/frozen F2 line), ROW_MAPPING_MISSING (sheet row has no known canonical entity). This is the dead-letter/conflict queue T2_BRIDGE_CALLER_AUDIT_003.md found missing.';

commit;
