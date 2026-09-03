-- Rollback for 20260917120000_t2_system_control_split_v1. Pure additive
-- function drops -- t2_system_control_v1 (company-scoped) was never
-- touched by the forward migration, so it is unaffected either way.
drop function if exists public.t2_control_global_write_guard_v1(bigint);
drop function if exists public.t2_system_control_global_v1(bigint);
