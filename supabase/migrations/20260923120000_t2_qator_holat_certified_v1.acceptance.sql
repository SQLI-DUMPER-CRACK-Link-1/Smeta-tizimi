-- ACCEPTANCE for 20260923120000_t2_qator_holat_certified_v1.sql
-- READ-ONLY. No BEGIN/ROLLBACK test-data injection against production (that
-- methodology was explicitly retired after a prior incident -- see
-- ops/handoff/T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md). Instead: prove the
-- view is a complete no-op against CURRENT production data (t2_akt_qator had
-- 0 rows at authoring time -- this migration only changes behavior for
-- FUTURE certified F2 rows) and that it still returns the expected shape.

-- 1) Row count unchanged: one row per t2_qator, same as before.
select
  (select count(*) from public.t2_qator_holat) as holat_rows,
  (select count(*) from public.t2_qator) as qator_rows,
  (select count(*) from public.t2_qator_holat) = (select count(*) from public.t2_qator) as row_count_matches;

-- 2) No-op on current data: since t2_akt_qator has zero certified_* rows
-- today, every f2_hajm/f2_summa value must be IDENTICAL to what the OLD
-- (legacy-only) aggregation would have produced -- i.e. this migration
-- changes nothing observable until the first t2_akt_yarat_v2 row exists.
select
  count(*) filter (where certified_rows_exist) as qatorlar_with_certified_data,
  count(*) as total_qatorlar
from (
  select
    h.id,
    exists (
      select 1 from public.t2_akt_qator aq
      join public.t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
      where aq.qator_id = h.id and a.tur = 'f2'
        and (aq.certified_quantity is not null or aq.certified_amount is not null)
    ) as certified_rows_exist
  from public.t2_qator_holat h
) x;
-- EXPECTED (at authoring time, 2026-09): qatorlar_with_certified_data = 0,
-- total_qatorlar = 17521 (matches known t2_qator count). If
-- qatorlar_with_certified_data > 0 by the time this runs, that's fine (it
-- means a real certified F2 has since been written) -- the fix is doing its
-- job for those rows now; this query is simply the honest "was this a no-op
-- at the time it landed" record.
