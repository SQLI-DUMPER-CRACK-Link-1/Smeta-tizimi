-- T2 F2 lifecycle acceptance: metadata-only, no financial row writes.
-- Run only against an explicitly selected target database by the DB owner.

begin;

do $$
declare
  v text;
  required_columns text[] := array[
    'lifecycle_status', 'lifecycle_updated_at', 'lifecycle_updated_by',
    'lifecycle_reason', 'lifecycle_submitted_at', 'lifecycle_checked_at',
    'lifecycle_approved_at', 'lifecycle_rejected_at',
    'lifecycle_cancelled_at', 'lifecycle_superseded_at', 'correction_of_akt_id'
  ];
  c text;
begin
  if to_regclass('public.t2_akt') is null then raise exception 'ACCEPTANCE_FAIL: t2_akt missing'; end if;
  if to_regclass('public.t2_akt_holat_tarix') is null then raise exception 'ACCEPTANCE_FAIL: lifecycle history table missing'; end if;
  if to_regclass('public.t2_akt_correction_link') is null then raise exception 'ACCEPTANCE_FAIL: correction link table missing'; end if;

  foreach c in array required_columns loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 't2_akt' and column_name = c
    ) then raise exception 'ACCEPTANCE_FAIL: t2_akt column missing: %', c; end if;
  end loop;

  if not exists (select 1 from pg_constraint where conname = 't2_akt_lifecycle_status_check') then
    raise exception 'ACCEPTANCE_FAIL: lifecycle status check missing';
  end if;
  if to_regprocedure('public.t2_akt_lifecycle_transition_v1(bigint,bigint,text,bigint,integer,uuid,text)') is null then
    raise exception 'ACCEPTANCE_FAIL: transition RPC missing';
  end if;
  if to_regprocedure('public.t2_akt_correction_create_v1(bigint,bigint,bigint,uuid,integer,bigint,text,text)') is null then
    raise exception 'ACCEPTANCE_FAIL: correction RPC missing';
  end if;
  if to_regprocedure('public.t2_akt_lifecycle_history_v1(bigint,bigint,bigint)') is null then
    raise exception 'ACCEPTANCE_FAIL: history read RPC missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 't2_akt_lifecycle_projection_guard') then
    raise exception 'ACCEPTANCE_FAIL: projection trigger missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 't2_akt_lifecycle_history_capture') then
    raise exception 'ACCEPTANCE_FAIL: history trigger missing';
  end if;

  select prosrc into v from pg_proc
  where oid = to_regprocedure('public.t2_akt_lifecycle_transition_v1(bigint,bigint,text,bigint,integer,uuid,text)');
  if v is null or position('STALE_VERSION' in v) = 0 or position('OPERATION_ID_REQUIRED' in v) = 0 then
    raise exception 'ACCEPTANCE_FAIL: transition optimistic-lock/idempotency guard missing';
  end if;
  select prosrc into v from pg_proc
  where oid = to_regprocedure('public.t2_akt_lifecycle_projection_guard_v1()');
  if v is null or position('approved akt immutable' in v) = 0 then
    raise exception 'ACCEPTANCE_FAIL: approved immutability guard missing';
  end if;

  raise notice 'T2_F2_LIFECYCLE_ACCEPTANCE_PASS: metadata contract present';
end $$;

rollback;
