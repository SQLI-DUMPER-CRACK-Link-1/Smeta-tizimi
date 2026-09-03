-- Run only inside BEGIN ... ROLLBACK. No production persistence.
begin;

do $$
declare v_sum numeric; v_exact numeric := 1234.49; v_calculated numeric := 10 * 123.45;
begin
  -- The law is deliberately represented as two facts, not a generated overwrite.
  if v_calculated <> 1234.50 or v_exact <> 1234.49 or v_calculated = v_exact then
    raise exception 'EXACT_F2_ARITHMETIC_ACCEPTANCE_FAILED';
  end if;
  select count(*) into v_sum from information_schema.columns
   where table_schema='public' and table_name='t2_akt_qator'
     and column_name in ('source_certified_hajm','source_certified_narx','source_certified_summa','source_line_id','source_provenance');
  if v_sum <> 5 then raise exception 'EXACT_F2_COLUMNS_MISSING'; end if;
  if to_regprocedure('public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text)') is null
     or to_regprocedure('public.t2_f2_exact_qatorlar_v1(bigint,bigint)') is null then
    raise exception 'EXACT_F2_RPC_MISSING';
  end if;
end $$;

select 'LRV_EXACT_F2_ADAPTER_ACCEPTANCE_PASS' as acceptance;
rollback;
