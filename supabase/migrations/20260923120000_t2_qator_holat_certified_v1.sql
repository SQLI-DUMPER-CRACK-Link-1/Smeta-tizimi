-- T2-PTO-DAILY-WORKFLOW-CLOSURE-007 Section 21 -- fix a real, live P0 gap:
-- `t2_qator_holat` (the read model behind the daily LRV/Fakt/F2-mumkin
-- surface) still aggregates F2 via the LEGACY `t2_akt_qator.hajm`/`summa`
-- columns. `summa` is a Postgres GENERATED column (`hajm * narx`) -- for any
-- F2 row certified via `t2_akt_yarat_v2` where the source document's own
-- amount differs from qty*price (the entire reason certified_amount exists),
-- this view silently shows the WRONG number: the recomputed product, not the
-- frozen source truth. Example (the owner's own worked case): qty=10,
-- price=123.45, certified_amount=1234.49 -- legacy summa (GENERATED)
-- computes 1234.50 and this view reports THAT, even though the correct
-- certified_amount (1234.49) is sitting right there in the same row.
--
-- FIX: prefer certified_quantity/certified_amount when present (i.e. the row
-- was written via t2_akt_yarat_v2 -- provenance_status IN
-- ('source_certified','price_intentionally_absent')), fall back to the
-- legacy hajm/summa otherwise (older rows, and all `fakt`-type rows, which
-- t2_akt_yarat_v2 never touches). FAKT aggregation is UNCHANGED -- certified_*
-- only ever applies to F2 rows.
--
-- Additive/safe: CREATE OR REPLACE VIEW, same column list/names/order as the
-- live view (captured via pg_get_viewdef before this change), only the F2
-- aggregate expressions change. No table/column dropped, no data touched.

begin;

create or replace view public.t2_qator_holat as
select
    q.id,
    q.id as qator_id,
    q.obyekt_id,
    q.tur,
    q.raqam,
    q.kod,
    q.nom,
    q.birlik,
    q.kat,
    q.hajm as smeta_hajm,
    q.narx as smeta_narx,
    q.summa as smeta_summa,
    coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric) as fakt_hajm,
    coalesce(sum(aq.summa) filter (where a.tur = 'fakt'), 0::numeric) as fakt_summa,
    -- F2: certified_* (t2_akt_yarat_v2 rows) takes priority over legacy
    -- hajm/summa (GENERATED, can silently disagree with the source document).
    coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) as f2_hajm,
    coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric) as f2_summa,
    q.hajm - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) as qoldiq_hajm,
    q.summa - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric) as qoldiq_summa,
    greatest(
      coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric)
      - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric),
      0::numeric
    ) as f2_mumkin_hajm,
    greatest(
      coalesce(sum(aq.summa) filter (where a.tur = 'fakt'), 0::numeric)
      - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric),
      0::numeric
    ) as f2_mumkin_summa,
    case
      when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) <> 0::numeric
        then round(
          sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2')
          / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'),
          2
        )
      else null::numeric
    end as f2_narx,
    case
      when coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric) <> 0::numeric
        then round(sum(aq.summa) filter (where a.tur = 'fakt') / sum(aq.hajm) filter (where a.tur = 'fakt'), 2)
      else null::numeric
    end as fakt_narx,
    case
      when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) <> 0::numeric
        and q.narx is not null and q.narx <> 0::numeric
        then round(
          (
            sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2')
            / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2')
            - q.narx
          ) / q.narx * 100::numeric,
          1
        )
      else null::numeric
    end as f2_narx_farq_foiz
from t2_qator q
  left join t2_akt_qator aq on aq.qator_id = q.id
  left join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
group by q.id, q.obyekt_id, q.tur, q.raqam, q.kod, q.nom, q.birlik, q.kat, q.hajm, q.narx, q.summa;

comment on view public.t2_qator_holat is
  'T2-PTO-DAILY-WORKFLOW-CLOSURE-007: LRV per-qator smeta/fakt/f2 rollup. F2 aggregates prefer certified_quantity/certified_amount (t2_akt_yarat_v2, exact-source law) over legacy generated hajm/summa when present -- see this migration''s header for the qty*price-vs-certified_amount bug this fixes.';

commit;
