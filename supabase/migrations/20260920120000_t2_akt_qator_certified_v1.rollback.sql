-- Rollback for 20260920120000_t2_akt_qator_certified_v1. PRE-USE ONLY:
-- raises if any row has been written with provenance_status='source_certified'
-- or 'price_intentionally_absent' (i.e. t2_akt_yarat_v2 has been used) --
-- dropping columns after real certified data exists would destroy that
-- data, not just schema.
do $$
begin
  if exists (select 1 from public.t2_akt_qator where provenance_status in ('source_certified','price_intentionally_absent')) then
    raise exception 'ROLLBACK_BLOCKED: certified F2 data exists. This rollback is pre-use only.';
  end if;
end $$;

drop trigger if exists t2_akt_qator_certified_freeze_v1_trg on public.t2_akt_qator;
drop function if exists public.t2_akt_qator_certified_freeze_v1();

alter table public.t2_akt_qator
  drop constraint if exists t2_akt_qator_change_type_ck,
  drop constraint if exists t2_akt_qator_certified_integrity_ck,
  drop constraint if exists t2_akt_qator_provenance_status_ck,
  drop column if exists replaces_line_id,
  drop column if exists change_type,
  drop column if exists provenance_status,
  drop column if exists raw_snapshot,
  drop column if exists certified_source_hash,
  drop column if exists certified_amount,
  drop column if exists certified_unit_price,
  drop column if exists certified_quantity;

alter table public.t2_qator
  drop constraint if exists t2_qator_change_type_ck,
  drop column if exists change_id,
  drop column if exists replaces_line_id,
  drop column if exists change_type;
