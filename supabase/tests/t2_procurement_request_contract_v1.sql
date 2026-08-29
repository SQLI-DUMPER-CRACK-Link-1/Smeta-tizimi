-- Read-only contract checks. Execute in a disposable/dev database after the
-- migration; this file intentionally contains no writes.
do $$ begin
  if to_regclass('public.t2_erp_taminot') is null then raise exception 'request truth table missing'; end if;
  if to_regclass('public.t2_zayavka_royxat') is null then raise exception 'request read view missing'; end if;
  if (select count(*) from pg_proc where proname = 't2_procurement_request_create') <> 1 then raise exception 'create RPC missing'; end if;
  if (select count(*) from pg_proc where proname = 't2_procurement_request_transition') <> 1 then raise exception 'transition RPC missing'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='t2_erp_taminot' and column_name='remaining_qty') then raise exception 'remaining_qty must be derived'; end if;
end $$;
