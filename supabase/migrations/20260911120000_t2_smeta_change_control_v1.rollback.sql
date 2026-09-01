-- PRE-USE SCHEMA ROLLBACK for 20260911120000_t2_smeta_change_control_v1.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- SAFE ONLY BEFORE THE FEATURE HAS BEEN USED. Fully additive schema.
--
-- If ANY change order exists (t2_smeta_ozgarish has rows) or ANY 'ozgarish'
-- revision exists, a plain rollback would delete governed business/audit
-- history while the t2_qator mutations those orders applied would REMAIN in
-- place — an inconsistent, non-auditable state. This script REFUSES that.
--
-- POST-USE = FORWARD REPAIR (do NOT delete history):
--   * keep t2_smeta_ozgarish / _qator / the 'ozgarish' revisions
--   * to undo a specific approved change, call
--       t2_smeta_ozgarish_qaytar_v1(<id>, <actor>, 'reason', <op>)
--     which restores lines + writes a COMPENSATING revision (forward event)
--   * a real schema removal after use needs a bespoke reviewed migration that
--     first archives t2_smeta_ozgarish + t2_smeta_revision('ozgarish') elsewhere
-- ═══════════════════════════════════════════════════════════════════════════
begin;

do $$
begin
  if to_regclass('public.t2_smeta_ozgarish') is not null
     and exists (select 1 from public.t2_smeta_ozgarish) then
    raise exception 'POST-USE: % change order(s) exist. Pre-use rollback refused — use t2_smeta_ozgarish_qaytar_v1 / forward repair (see header).',
      (select count(*) from public.t2_smeta_ozgarish);
  end if;
  if to_regclass('public.t2_smeta_revision') is not null
     and exists (select 1 from public.t2_smeta_revision where tur = 'ozgarish') then
    raise exception 'POST-USE: % change-revision(s) exist. Pre-use rollback refused.',
      (select count(*) from public.t2_smeta_revision where tur = 'ozgarish');
  end if;
end $$;

alter table public.t2_smeta_revision drop constraint if exists t2_smeta_revision_ozgarish_fk;
drop function if exists public.t2_smeta_baseline_asl_v1(bigint,bigint);
drop function if exists public.t2_smeta_ozgarish_royxat_v1(bigint,bigint,integer);
drop function if exists public.t2_smeta_ozgarish_qaytar_v1(bigint,bigint,text,uuid);
drop function if exists public.t2_smeta_ozgarish_tasdiqlash_v1(bigint,bigint,integer,uuid);
drop function if exists public.t2_smeta_ozgarish_yarat_v1(bigint,bigint,text,text,jsonb,text,uuid,date,text,bigint,text);
drop table if exists public.t2_smeta_ozgarish_qator;
drop table if exists public.t2_smeta_ozgarish;

commit;
