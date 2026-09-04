-- PRE-USE SCHEMA ROLLBACK for 20260914120000_t2_f2_import_job_v1.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- SAFE ONLY BEFORE ANY JOB HAS BEEN CREATED. Both new tables are additive and
-- carry no other table's data — but once a real F2 import job has run, its
-- job/draft rows ARE the durable record of in-progress or completed work
-- (that is the entire point of §5/§6). Dropping them post-use would destroy
-- exactly the recovery guarantee this migration exists to provide. This
-- script refuses to run in that case.
--
-- POST-USE = do not drop. A genuine schema removal after real usage requires
-- a bespoke, reviewed migration that first archives any in-flight jobs.
-- ═══════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.t2_f2_import_job') is not null
     and exists (select 1 from public.t2_f2_import_job) then
    raise exception 'POST-USE: t2_f2_import_job has % row(s). Pre-use rollback refused.',
      (select count(*) from public.t2_f2_import_job);
  end if;
  if to_regclass('public.t2_f2_import_draft_qator') is not null
     and exists (select 1 from public.t2_f2_import_draft_qator) then
    raise exception 'POST-USE: t2_f2_import_draft_qator has % row(s). Pre-use rollback refused.',
      (select count(*) from public.t2_f2_import_draft_qator);
  end if;
end $$;

drop function if exists public.t2_f2_import_draft_saqla_v1(bigint,bigint,jsonb);
drop function if exists public.t2_f2_import_job_ilgarilash_v1(bigint,bigint,integer,integer,integer,integer,jsonb,text,text);
drop function if exists public.t2_f2_import_job_holat_v1(bigint,bigint);
drop function if exists public.t2_f2_import_job_yarat_v1(bigint,bigint,bigint,uuid,integer);

drop table if exists public.t2_f2_import_draft_qator;
drop table if exists public.t2_f2_import_job;

commit;
