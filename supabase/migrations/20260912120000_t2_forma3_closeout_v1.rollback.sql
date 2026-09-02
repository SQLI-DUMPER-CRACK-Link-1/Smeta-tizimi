-- PRE-USE SCHEMA ROLLBACK for 20260912120000_t2_forma3_closeout_v1.sql
-- Additive. REFUSES if any Forma-3 certificate exists (deleting it would strip
-- the t2_akt.forma3_id links while leaving the acts). Post-use: keep the tables;
-- to void a certificate set t2_forma3.holat='bekor' (a forward, audited state).
begin;

do $$
begin
  if to_regclass('public.t2_forma3') is not null and exists (select 1 from public.t2_forma3) then
    raise exception 'POST-USE: % Forma-3 certificate(s) exist. Pre-use rollback refused — set holat=bekor instead.',
      (select count(*) from public.t2_forma3);
  end if;
end $$;

drop function if exists public.t2_workbench_v1(bigint,bigint,date,integer);
drop function if exists public.t2_forma3_royxat_v1(bigint,bigint,bigint);
drop function if exists public.t2_obyekt_yakunlash_v1(bigint,bigint);
drop function if exists public.t2_forma3_qoida_belgila_v1(bigint,bigint,text,uuid);
drop function if exists public.t2_forma3_yarat_v1(bigint,bigint,bigint,bigint,date,date,bigint[],text,uuid);
drop table if exists public.t2_forma3_akt;
drop table if exists public.t2_forma3;
drop table if exists public.t2_yakunlash_talab;

commit;
