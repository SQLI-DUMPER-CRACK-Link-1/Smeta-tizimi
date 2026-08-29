-- FORWARD-ONLY MIGRATION (not applied to production by this change)
-- Requires the canonical live baseline captured at 2026-08-29T04:23:22Z.
-- Do not run this file through the Dashboard SQL editor. Apply only through the
-- reviewed Supabase migration workflow after the baseline capture is committed.

create table public.t2_signal (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  signal_type text not null,
  severity text not null check (severity in ('info', 'warning', 'error', 'critical')),
  title text not null,
  details jsonb,
  manba text not null,
  manba_id text,
  operation_id uuid,
  state text not null default 'open' check (state in ('open', 'resolved', 'dismissed')),
  detected_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- NULL operation_id is intentionally allowed for non-idempotent observations.
create unique index t2_signal_kompaniya_operation_uniq
  on public.t2_signal (kompaniya_id, operation_id)
  where operation_id is not null;
create index t2_signal_open_entity_idx
  on public.t2_signal (kompaniya_id, entity_type, entity_id)
  where state = 'open';
create index t2_signal_open_due_idx
  on public.t2_signal (kompaniya_id, due_at)
  where state = 'open';

alter table public.t2_signal enable row level security;

-- Deliberately no permissive policy here. Existing T2 identity-to-auth mapping
-- is not canonical yet; a policy is added only in a later reviewed migration.

create function public.t2_signal_emit(
  p_kompaniya_id bigint,
  p_entity_type text,
  p_entity_id text,
  p_signal_type text,
  p_severity text,
  p_title text,
  p_manba text,
  p_operation_id uuid default null,
  p_manba_id text default null,
  p_details jsonb default null,
  p_due_at timestamptz default null
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_signal_id bigint;
begin
  if p_operation_id is null then
    insert into public.t2_signal (
      kompaniya_id, entity_type, entity_id, signal_type, severity, title,
      details, manba, manba_id, operation_id, due_at
    ) values (
      p_kompaniya_id, p_entity_type, p_entity_id, p_signal_type, p_severity,
      p_title, p_details, p_manba, p_manba_id, p_operation_id, p_due_at
    ) returning id into v_signal_id;
  else
    insert into public.t2_signal (
      kompaniya_id, entity_type, entity_id, signal_type, severity, title,
      details, manba, manba_id, operation_id, due_at
    ) values (
      p_kompaniya_id, p_entity_type, p_entity_id, p_signal_type, p_severity,
      p_title, p_details, p_manba, p_manba_id, p_operation_id, p_due_at
    ) on conflict (kompaniya_id, operation_id) where operation_id is not null
    do update set
      entity_type = excluded.entity_type,
      entity_id = excluded.entity_id,
      signal_type = excluded.signal_type,
      severity = excluded.severity,
      title = excluded.title,
      details = excluded.details,
      manba = excluded.manba,
      manba_id = excluded.manba_id,
      due_at = excluded.due_at,
      state = 'open',
      detected_at = now(),
      resolved_at = null,
      updated_at = now()
    returning id into v_signal_id;
  end if;

  return v_signal_id;
end;
$$;

create function public.t2_signal_resolve(
  p_kompaniya_id bigint,
  p_operation_id uuid
) returns void
language sql
security invoker
set search_path = public
as $$
  update public.t2_signal
     set state = 'resolved', resolved_at = now(), updated_at = now()
   where kompaniya_id = p_kompaniya_id
     and operation_id = p_operation_id
     and state = 'open';
$$;

revoke all on public.t2_signal from anon, authenticated;
revoke all on function public.t2_signal_emit(bigint, text, text, text, text, text, text, uuid, text, jsonb, timestamptz) from public;
revoke all on function public.t2_signal_resolve(bigint, uuid) from public;

