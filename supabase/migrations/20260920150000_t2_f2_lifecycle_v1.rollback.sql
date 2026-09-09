-- Data-preserving rollback for 20260920150000_t2_f2_lifecycle_v1.
--
-- This intentionally removes executable behavior only. It does not DROP the
-- lifecycle columns/history/correction link because doing so would destroy
-- approval provenance. The forward migration is idempotent and can be
-- re-applied after the deployment decision is made.

begin;

drop trigger if exists t2_akt_lifecycle_history_capture on public.t2_akt;
drop trigger if exists t2_akt_lifecycle_projection_guard on public.t2_akt;

drop function if exists public.t2_akt_lifecycle_history_v1(bigint,bigint,bigint);
drop function if exists public.t2_akt_correction_create_v1(bigint,bigint,bigint,uuid,integer,bigint,text,text);
drop function if exists public.t2_akt_lifecycle_transition_v1(bigint,bigint,text,bigint,integer,uuid,text);
drop function if exists public.t2_akt_lifecycle_history_capture_v1();
drop function if exists public.t2_akt_lifecycle_projection_guard_v1();

commit;

-- Deliberately retained for evidence preservation:
-- public.t2_akt_holat_tarix
-- public.t2_akt_correction_link
-- t2_akt.lifecycle_* and t2_akt.correction_of_akt_id
