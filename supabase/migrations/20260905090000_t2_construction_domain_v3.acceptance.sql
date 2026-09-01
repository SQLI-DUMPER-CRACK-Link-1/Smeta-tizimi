-- Execute with disposable tenant fixtures. The sentinel is intentionally rolled back.
begin;
do $$ begin
  if not exists(select 1 from pg_proc where proname='t2_commercial_contract_get_v2') then raise exception 'commercial RPC missing'; end if;
  if not exists(select 1 from pg_proc where proname='t2_procurement_receipt_record_v2') then raise exception 'procurement receipt RPC missing'; end if;
  if not exists(select 1 from pg_proc where proname='t2_schedule_dependency_create_v2') then raise exception 'schedule dependency RPC missing'; end if;
  if exists(select 1 from information_schema.role_routine_grants where specific_schema='public' and routine_name in ('t2_commercial_contract_get_v2','t2_procurement_receipt_record_v2','t2_schedule_dependency_create_v2') and grantee in ('anon','authenticated','PUBLIC')) then raise exception 'V3 RPC exposed'; end if;
  if not exists(select 1 from pg_class where relname='t2_change_order' and relrowsecurity) then raise exception 'commercial RLS missing'; end if;
  if not exists(select 1 from pg_class where relname='t2_procurement_receipt_v2' and relrowsecurity) then raise exception 'procurement RLS missing'; end if;
  if not exists(select 1 from pg_class where relname='t2_grafik_boglanish_v2' and relrowsecurity) then raise exception 'schedule RLS missing'; end if;
  raise exception 'CONSTRUCTION_DOMAIN_V3_ACCEPTANCE_PASS';
end $$;
rollback;
