-- Source acceptance for T2-PTO contract scope.
-- Execute only in an isolated database or inside BEGIN ... ROLLBACK with
-- production-like fixtures.  This script intentionally creates no business
-- rows and cannot claim live production acceptance by itself.
do $$
begin
  if to_regclass('public.t2_shartnoma_qator_qamrov') is null then
    raise exception 'FAIL: t2_shartnoma_qator_qamrov missing';
  end if;
  if to_regprocedure('public.t2_shartnoma_qamrov_ol_v1(bigint,bigint)') is null then
    raise exception 'FAIL: qamrov read RPC missing';
  end if;
  if to_regprocedure('public.t2_shartnoma_qamrov_saqla_v1(bigint,bigint,bigint,bigint,bigint,text,numeric,text,bigint,uuid,integer)') is null then
    raise exception 'FAIL: qamrov write RPC missing';
  end if;
  if to_regprocedure('public.t2_obyekt_nakrutka_v1(bigint,bigint,bigint)') is null then
    raise exception 'FAIL: nakrutka scope RPC missing';
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid='public.t2_shartnoma_qator_qamrov'::regclass
       and conname='t2_shartnoma_qator_qamrov_holat_check'
  ) then
    raise exception 'FAIL: status constraint missing';
  end if;
  raise notice 'T2_SHARTNOMA_QAMROV_ACCEPTANCE_PASS';
end $$;

-- Required behavioral checks for isolated fixtures:
-- A) a linked object's qator is included when no override exists;
-- B) 'chiqarilgan' removes it from nakrutka direct-cost sums;
-- C) hajm_override scales only the contract result and never t2_qator.summa;
-- D) a qator from another object/tenant is rejected;
-- E) duplicate operation_id returns the original result;
-- F) stale qamrov version returns VERSION_CONFLICT;
-- G) two objects under one contract are evaluated by the same scope rules.
