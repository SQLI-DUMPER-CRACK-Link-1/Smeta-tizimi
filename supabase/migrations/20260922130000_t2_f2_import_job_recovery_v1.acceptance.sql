-- T2 F2 import recovery acceptance: metadata-only, no job/data mutation.
begin;

do $$
declare
  v_status_constraint text;
  v_fn regprocedure;
begin
  if to_regclass('public.t2_f2_import_job_recovery') is null then
    raise exception 'missing t2_f2_import_job_recovery';
  end if;
  if to_regclass('public.t2_f2_import_job_cancel_event') is null then
    raise exception 'missing t2_f2_import_job_cancel_event';
  end if;
  select pg_get_constraintdef(oid) into v_status_constraint
  from pg_constraint
  where conname = 't2_f2_import_job_status_check';
  if v_status_constraint is null or position('review' in v_status_constraint) = 0 then
    raise exception 'review status is not part of the job contract';
  end if;
  v_fn := to_regprocedure('public.t2_f2_import_job_recover_v1(bigint,bigint,integer,uuid,integer)');
  if v_fn is null then raise exception 'missing recovery RPC'; end if;
  v_fn := to_regprocedure('public.t2_f2_import_job_cancel_v1(bigint,bigint,integer,uuid,text)');
  if v_fn is null then raise exception 'missing cancel RPC'; end if;
  raise notice 'T2_F2_IMPORT_JOB_RECOVERY_ACCEPTANCE_PASS: metadata contract present';
end $$;

rollback;
