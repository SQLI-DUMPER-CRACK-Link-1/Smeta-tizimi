-- T2-PTO-DAILY-WORKFLOW-CLOSURE-007 Section 21 -- same certified_* gap as
-- 20260923120000 (t2_qator_holat), found in two more read models during the
-- mandated re-audit:
--
-- 1. t2_f2_kat_oy (monthly category rollup): `sum(aq.hajm)`/`sum(aq.summa)`
--    -- fixed the same way (coalesce certified_quantity/certified_amount
--    over legacy). Safe unconditionally: certified_* is only ever non-null
--    on tur='f2' rows written via t2_akt_yarat_v2; fakt rows never have it
--    set, so the coalesce is a no-op for them regardless of a.tur.
-- 2. t2_f2_tafsilot ("Exact F2 History" detail view, per-akt_qator row):
--    exposed only the raw legacy hajm/narx/summa. ADDING (not replacing)
--    certified_quantity/certified_unit_price/certified_amount/
--    provenance_status columns -- this is a row-level detail view, so
--    existing consumers reading hajm/narx/summa keep their exact current
--    meaning; anything that specifically needs the frozen exact-source
--    triplet (the actual point of "Exact F2 History") can now read it
--    directly instead of recomputing/guessing.

begin;

create or replace view public.t2_f2_kat_oy as
select
    a.obyekt_id,
    a.kompaniya_id,
    a.tur,
    a.oy,
    coalesce(q.kat, 'МАТ'::text) as kat,
    count(*) as qator_soni,
    sum(coalesce(aq.certified_quantity, aq.hajm)) as jami_hajm,
    sum(coalesce(aq.certified_amount, aq.summa)) as jami_summa
from t2_akt_qator aq
  join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
  join t2_qator q on q.id = aq.qator_id
group by a.obyekt_id, a.kompaniya_id, a.tur, a.oy, coalesce(q.kat, 'МАТ'::text);

comment on view public.t2_f2_kat_oy is
  'T2-PTO-DAILY-WORKFLOW-CLOSURE-007: monthly category rollup. jami_hajm/jami_summa prefer certified_quantity/certified_amount (t2_akt_yarat_v2 exact-source rows) over legacy generated hajm/summa.';

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
    aq.izoh,
    aq.certified_quantity,
    aq.certified_unit_price,
    aq.certified_amount,
    aq.provenance_status,
    -- Convenience "display" values: exact-source triplet when this row was
    -- certified via t2_akt_yarat_v2, legacy otherwise -- what most "Exact F2
    -- History" UI actually wants to render without its own coalesce logic.
    coalesce(aq.certified_quantity, aq.hajm) as gorunish_hajm,
    coalesce(aq.certified_unit_price, aq.narx) as gorunish_narx,
    coalesce(aq.certified_amount, aq.summa) as gorunish_summa
from t2_akt_qator aq
  join t2_akt a on a.id = aq.akt_id and a.holat <> 'bekor'
  join t2_qator q on q.id = aq.qator_id;

comment on view public.t2_f2_tafsilot is
  'T2-PTO-DAILY-WORKFLOW-CLOSURE-007: per-row F2/fakt detail ("Exact F2 History" source). hajm/narx/summa remain the raw legacy columns (unchanged meaning); certified_* expose the frozen exact-source triplet directly when present (t2_akt_yarat_v2); gorunish_* (display) columns are the coalesced convenience read most UI actually wants.';

commit;
