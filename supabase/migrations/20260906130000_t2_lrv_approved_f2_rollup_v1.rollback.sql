-- PRE-USE rollback for 20260906130000_t2_lrv_approved_f2_rollup_v1.
-- Restores the immediately previous certified-source view definition.  Use
-- only before relying on the corrected approved-only semantics; rolling back
-- reintroduces the draft-F2 availability bug.

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
    coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) as f2_hajm,
    coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric) as f2_summa,
    q.hajm - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) as qoldiq_hajm,
    q.summa - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric) as qoldiq_summa,
    greatest(coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric) - coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric), 0::numeric) as f2_mumkin_hajm,
    greatest(coalesce(sum(aq.summa) filter (where a.tur = 'fakt'), 0::numeric) - coalesce(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2'), 0::numeric), 0::numeric) as f2_mumkin_summa,
    case when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) <> 0::numeric
      then round(sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2') / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 2)
      else null::numeric end as f2_narx,
    case when coalesce(sum(aq.hajm) filter (where a.tur = 'fakt'), 0::numeric) <> 0::numeric
      then round(sum(aq.summa) filter (where a.tur = 'fakt') / sum(aq.hajm) filter (where a.tur = 'fakt'), 2)
      else null::numeric end as fakt_narx,
    case when coalesce(sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2'), 0::numeric) <> 0::numeric
      and q.narx is not null and q.narx <> 0::numeric
      then round((sum(coalesce(aq.certified_amount, aq.summa)) filter (where a.tur = 'f2') / sum(coalesce(aq.certified_quantity, aq.hajm)) filter (where a.tur = 'f2') - q.narx) / q.narx * 100::numeric, 1)
      else null::numeric end as f2_narx_farq_foiz
from t2_qator q
  left join t2_akt_qator aq on aq.qator_id = q.id
  left join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
group by q.id, q.obyekt_id, q.tur, q.raqam, q.kod, q.nom, q.birlik, q.kat, q.hajm, q.narx, q.summa;
