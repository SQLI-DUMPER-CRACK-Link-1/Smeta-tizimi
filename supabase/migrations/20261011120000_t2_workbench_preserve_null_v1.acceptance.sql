-- Read-only acceptance for 20261011120000_t2_workbench_preserve_null_v1.sql.
-- Run only after the migration in a disposable/approved environment.
-- This script performs no writes and deliberately raises PASS so a SQL
-- runner cannot confuse a silent no-op with a successful acceptance.

begin;

do $$
declare
  v_obj bigint;
  v_actor bigint;
  v_result jsonb;
  v_line jsonb;
begin
  if not exists (
    select 1 from pg_proc
    where oid = 'public.t2_workbench_v1(bigint,bigint,date,integer)'::regprocedure
      and pg_get_functiondef(oid) like '%baselineQuantity%'
      and pg_get_functiondef(oid) like '%baselineReferencePrice%'
      and pg_get_functiondef(oid) not like '%coalesce(q.hajm,0)%'
      and pg_get_functiondef(oid) not like '%coalesce(q.narx,0)%'
  ) then
    raise exception 'FAIL: t2_workbench_v1 still collapses baseline NULL to zero';
  end if;

  select q.obyekt_id into v_obj
  from public.t2_qator q
  where q.tur in ('rs','mat','ob') and (q.hajm is null or q.narx is null)
  order by q.obyekt_id, q.id limit 1;
  if v_obj is null then
    raise exception 'FAIL: no NULL baseline fixture exists for behavioral acceptance';
  end if;
  select a.foydalanuvchi_id into v_actor
  from public.t2_azolik a
  join public.t2_obyekt o on o.kompaniya_id = a.kompaniya_id and o.id = v_obj
  where a.holat = 'faol'
  order by a.foydalanuvchi_id limit 1;
  if v_actor is null then
    raise exception 'FAIL: no active actor for NULL baseline fixture';
  end if;

  v_result := public.t2_workbench_v1(v_obj, v_actor, null, 3000);
  select l into v_line
  from jsonb_array_elements(v_result->'valuation'->'lines') l
  where (l->>'lineId')::bigint in (
    select q.id from public.t2_qator q
    where q.obyekt_id = v_obj and q.tur in ('rs','mat','ob')
      and (q.hajm is null or q.narx is null)
  )
  and ((l->>'baselineQuantity') is null or (l->>'baselineReferencePrice') is null)
  limit 1;
  if v_line is null then
    raise exception 'FAIL: NULL baseline fact was not preserved in workbench JSON';
  end if;
  if v_line ? 'baselineReferencePrice' and v_line->'baselineReferencePrice' <> 'null'::jsonb
     and v_line ? 'baselineQuantity' and v_line->'baselineQuantity' <> 'null'::jsonb then
    raise exception 'FAIL: selected NULL baseline row returned no NULL field';
  end if;

  raise exception 'T2_WORKBENCH_NULL_SEMANTICS_ACCEPTANCE_PASS';
end $$;

rollback;
