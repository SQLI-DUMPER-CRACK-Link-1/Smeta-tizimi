-- Rollback for 20260920120000_t2_akt_qator_certified_v1. PRE-USE ONLY:
-- raises if any row has been written with provenance_status='source_certified'
-- (i.e. t2_akt_yarat_v2 has been used) -- dropping columns after real
-- certified data exists would destroy that data, not just schema.
do $$
begin
  if exists (select 1 from public.t2_akt_qator where provenance_status = 'source_certified') then
    raise exception 'ROLLBACK_BLOCKED: certified F2 data exists (t2_akt_qator.provenance_status=source_certified). This rollback is pre-use only.';
  end if;
end $$;

alter table public.t2_akt_qator
  drop column if exists replaces_line_id,
  drop column if exists change_type,
  drop column if exists provenance_status,
  drop column if exists raw_snapshot,
  drop column if exists certified_source_hash,
  drop column if exists certified_amount,
  drop column if exists certified_unit_price,
  drop column if exists certified_quantity;

alter table public.t2_qator
  drop column if exists replaces_line_id,
  drop column if exists change_type;
