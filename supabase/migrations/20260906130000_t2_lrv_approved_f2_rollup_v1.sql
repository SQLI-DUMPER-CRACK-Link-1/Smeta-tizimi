-- T2-PTO-DAILY-WORKFLOW: approved-only F2 rollup.
--
-- `t2_qator_holat` is the canonical daily LRV read model.  Its previous
-- version excluded only `bekor` acts, so an F2 qoralama could reduce
-- `f2_mumkin_hajm` before anyone approved that document.  That violates the
-- law that only approved F2 contributes to history and availability.
--
-- This is a view-only, additive correction.  No table row is changed.  Fakt
-- aggregation remains exactly as before; only F2 FILTER clauses require
-- `a.holat = 'tasdiqlangan'`.  Certified quantity/amount remain preferred for
-- exact-source rows; legacy rows still use their stored compatibility values.

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
    coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) as f2_hajm,
    coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) as f2_summa,
    q.hajm - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) as qoldiq_hajm,
    q.summa - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) as qoldiq_summa,
    greatest(
      coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric)
      - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric),
      0::numeric
    ) as f2_mumkin_hajm,
    greatest(
      coalesce(sum(aq.summa) filter (where a.tur = 'fakt'), 0::numeric)
      - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric),
      0::numeric
    ) as f2_mumkin_summa,
    case
      when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) <> 0::numeric
        then round(
          sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan')
          / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'),
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
      when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan'), 0::numeric) <> 0::numeric
        and q.narx is not null and q.narx <> 0::numeric
        then round(
          (
            sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan')
            / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2' and a.holat = 'tasdiqlangan')
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
  'T2-PTO-DAILY-WORKFLOW: LRV qator rollup; only tasdiqlangan F2 contributes to history, F2 mumkin and qoldiq. Certified source amount remains exact.';
