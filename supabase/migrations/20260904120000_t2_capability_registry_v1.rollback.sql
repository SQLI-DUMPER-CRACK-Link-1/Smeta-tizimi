-- Rollback for 20260904120000_t2_capability_registry_v1.sql
-- Additive migration; rollback drops everything it introduced. No business data loss
-- (capability config only). Signals/audit are untouched.
begin;

drop function if exists public.t2_system_control_v1(bigint,bigint,bigint);
drop function if exists public.t2_deploy_state_set_v1(bigint,text,text,text,text,uuid);
drop function if exists public.t2_job_control_v1(bigint,text,text,uuid);
drop function if exists public.t2_capability_killswitch_v1(bigint,text,boolean,text,uuid);
drop function if exists public.t2_capability_override_set_v1(bigint,text,text,bigint,text,text,integer,uuid);
drop function if exists public.t2_capability_effective_v1(text,bigint,bigint);
drop function if exists public.t2_control_actor_home_company(bigint);

drop table if exists public.t2_control_command_log;
drop table if exists public.t2_capability_override;
drop table if exists public.t2_capability;
drop table if exists public.t2_job;
drop table if exists public.t2_integration_health;
drop table if exists public.t2_deploy_state;

commit;
