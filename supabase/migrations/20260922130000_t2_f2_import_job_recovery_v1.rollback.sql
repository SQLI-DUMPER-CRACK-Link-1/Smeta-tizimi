-- Data-preserving rollback for 20260922130000_t2_f2_import_job_recovery_v1.
-- Executable recovery/cancel behavior is removed; recovery/cancel event data
-- and job columns remain so an approved forward migration can be re-applied
-- without erasing the audit trail or draft state.

begin;

drop function if exists public.t2_f2_import_job_recover_v1(bigint,bigint,integer,uuid,integer);
drop function if exists public.t2_f2_import_job_cancel_v1(bigint,bigint,integer,uuid,text);

commit;
