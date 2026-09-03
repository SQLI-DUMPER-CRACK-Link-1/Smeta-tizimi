-- Rollback for 20260920140000_t2_lrv_sync_envelope_v1. Pure additive
-- table drops -- no existing table touched by the forward migration.
drop table if exists public.t2_lrv_sync_conflict;
drop table if exists public.t2_lrv_sync_event;
