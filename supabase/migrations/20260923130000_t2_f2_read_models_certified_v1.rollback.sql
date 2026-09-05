-- ROLLBACK for 20260923130000_t2_f2_read_models_certified_v1.sql

begin;

create or replace view public.t2_f2_kat_oy as
select
    a.obyekt_id,
    a.kompaniya_id,
    a.tur,
    a.oy,
    coalesce(q.kat, 'МАТ'::text) as kat,
    count(*) as qator_soni,
    sum(aq.hajm) as jami_hajm,
    sum(aq.summa) as jami_summa
from t2_akt_qator aq
  join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
  join t2_qator q on q.id = aq.qator_id
group by a.obyekt_id, a.kompaniya_id, a.tur, a.oy, coalesce(q.kat, 'МАТ'::text);

create or replace view public.t2_f2_tafsilot as
select
    a.id as akt_id,
    a.obyekt_id,
    a.kompaniya_id,
    a.tur,
    a.oy,
    a.holat as akt_holat,
    a.raqam,
    a.kim as akt_kim,
    a.yaratildi as akt_sana,
    aq.id as akt_qator_id,
    aq.qator_id,
    q.kod,
    q.nom,
    q.birlik,
    q.kat,
    q.tur as qator_tur,
    aq.hajm,
    aq.narx,
    aq.summa,
    aq.izoh
from t2_akt_qator aq
  join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
  join t2_qator q on q.id = aq.qator_id;

commit;
