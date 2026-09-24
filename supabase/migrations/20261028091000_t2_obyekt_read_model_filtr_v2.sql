-- T2_OBYEKT_READ_MODEL_FILTR_V2 (2026-09-25, Claude, SMETA-ANAT-001)
--
-- `supabase/tests/t2_obyekt_read_model_tezlik_contract.sql` (avtomatik: obyekt_id
-- ustuni bor va t2_qator ga tayangan HAR view) yana ikkitasini topdi — obyekt
-- filtri bilan so'ralganda butun t2_qator ni aylanardi:
--   t2_lrv               (Sheets ko'prigi)  obyekt 84: 3 631 ms -> 105 ms
--   t2_obyekt_nakrutka   (Nakrutka sahifasi) obyekt 84:    79 ms ->   7 ms
-- Ikkalasida natija o'zgarmaydi (production, faqat o'qish: ikki tomonlama
-- EXCEPT = 0 / 0). Sabab V1 dagidek: CTE materialize bo'lib filtr ichkariga
-- tushmasdi. Ustun nomi/turi/tartibi o'zgarmaydi, grantlar saqlanadi.

-- 1) t2_obyekt_nakrutka: bazadagi ta'rifning o'zi, faqat CTE lar NOT MATERIALIZED.
do $$
declare d text;
begin
  d := pg_get_viewdef('public.t2_obyekt_nakrutka'::regclass, true);
  if d ~ 'kat AS NOT MATERIALIZED' then
    raise notice 't2_obyekt_nakrutka allaqachon tuzatilgan';
  else
    d := replace(d, 'WITH kat AS (', 'WITH kat AS NOT MATERIALIZED (');
    d := replace(d, 'resolved AS (', 'resolved AS NOT MATERIALIZED (');
    if d !~ 'kat AS NOT MATERIALIZED' or d !~ 'resolved AS NOT MATERIALIZED' then
      raise exception 't2_obyekt_nakrutka: kutilgan CTE lar topilmadi — ta''rif o''zgargan, qo''lda ko''ring';
    end if;
    execute 'create or replace view public.t2_obyekt_nakrutka as ' || d;
  end if;
end $$;

-- 2) t2_lrv: rz CTE obyekt_id ni ham beradi va u bilan bog'lanadi.
create or replace view public.t2_lrv as
with rz as not materialized (
  select q_1.id, q_1.obyekt_id,
    coalesce(r.nom, q_1.nom) as razdel_nom, coalesce(r.d1, q_1.d1) as d1,
    coalesce(r.d2, q_1.d2) as d2, coalesce(r.d3, q_1.d3) as d3
  from public.t2_qator q_1
    left join lateral (
      select p.nom, p.d1, p.d2, p.d3 from public.t2_qator p
      where p.tur = 'rz'::text
        and (p.id = q_1.ota_id or p.id = ((select o_1.ota_id from public.t2_qator o_1 where o_1.id = q_1.ota_id)))
      limit 1
    ) r on true
)
select q.obyekt_id, o.nom as "ОБЪЕКТ", q.tartib as _tartib, q.daraja as _daraja, q.id as _id, q.ota_id as _ota_id,
  q.xom_qator as "№", q.kod as "КОД", q.nom as "НАИМЕНОВАНИЕ", q.birlik as "ЕД. ИЗМ.",
  null::numeric as "ҲАЖМ (ед)", q.hajm as "ҲАЖМ (жами)", q.narx as "НАРХ (1 ед)", q.summa as "СУММА", q.tur as "ТИП",
  case when q.kat = 'ЧЕЛ'::text then q.summa else null::numeric end as "ЧЕЛ",
  case when q.kat = 'МАШ'::text then q.summa else null::numeric end as "МАШ",
  case when q.kat = 'МАТ'::text then q.summa else null::numeric end as "МАТ",
  case when q.kat = 'ОБ'::text then q.summa else null::numeric end as "ОБ",
  null::numeric as "БЕЗ СКЛАД",
  case when q.kat = 'М/К'::text then q.summa else null::numeric end as "М/К",
  case when q.kat = 'КАБ'::text then q.summa else null::numeric end as "ПРОВОД",
  null::numeric as "Факт объем", null::numeric as "Остатка объем", null::numeric as "Забран на Ф2", null::numeric as "Остатка Ф2",
  rz.d1 as "ҚАВАТ 1", rz.d2 as "ҚАВАТ 2", rz.d3 as "ҚАВАТ 3", null::text as "ВИД РАБОТ", rz.razdel_nom as "РАЗДЕЛ",
  case when q.tur = any (array['rs'::text, 'mat'::text, 'ob'::text]) then q.summa else null::numeric end as "Стоимость ресурс",
  null::numeric as "Стоимость Факт рес", null::numeric as "Стоимость Ф2 ресур", null::numeric as "Стоимость остатка",
  q.narx_usul as _narx_usul, q.qoshimcha as _qoshimcha, q.zamena as _zamena
from public.t2_qator q
  join public.t2_obyekt o on o.id = q.obyekt_id
  left join rz on rz.id = q.id and rz.obyekt_id = q.obyekt_id
order by q.obyekt_id, q.tartib;
