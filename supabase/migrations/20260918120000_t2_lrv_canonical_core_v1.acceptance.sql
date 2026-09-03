-- Run after forward migration only in disposable DB or enclosing BEGIN...ROLLBACK.
begin;
do $$ begin
 if to_regclass('public.t2_lrv_document_line') is null or to_regclass('public.t2_lrv_approved_f2') is null then raise exception 'LRV_ACCEPTANCE_FAIL: source/f2 model absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='t2_lrv_approved_f2' and column_name='certified_amount') then raise exception 'LRV_ACCEPTANCE_FAIL: exact amount absent'; end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='t2_lrv_document_line' and column_name in ('sheet_row','row_number')) then raise exception 'LRV_ACCEPTANCE_FAIL: positional identity forbidden'; end if;
end $$;
select 'LRV_CANONICAL_ACCEPTANCE_PASS' as acceptance;
rollback;
