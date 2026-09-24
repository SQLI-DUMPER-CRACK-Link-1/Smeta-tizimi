-- T2 OBYEKT READ-MODEL TEZLIK KONTRAKTI (2026-09-25, egasi: "har safar san tezlatib
-- berishing yaxshi yechim emas — tizim shu yechimga moslashishi kerak").
--
-- QOIDA: obyekt_id ustuni bor va t2_qator ga tayangan HAR view, `obyekt_id = N`
-- bilan so'ralganda t2_qator ni to'liq aylanmasligi (Seq Scan) kerak — faqat shu
-- obyekt qatorlari (indeks) o'qiladi. Aks holda view butun baza hajmiga qarab
-- sekinlashadi (V1: t2_qator_holat 3.8 s/sahifa, t2_lrv 3.6 s).
--
-- View lar AVTOMATIK topiladi (ro'yxat qo'lda yuritilmaydi): yangi view qo'shilsa
-- u ham tekshiriladi. Faqat reja (EXPLAIN, ANALYZE siz) — ma'lumot o'qilmaydi,
-- production da xavfsiz. Qoidani buzgan view topilsa — EXCEPTION ro'yxat bilan.
--
-- Yangi view yozishda: CTE ikki marta ishlatilsa `AS NOT MATERIALIZED`, o'z-o'ziga
-- (ota) join da `parent.obyekt_id = d.obyekt_id` qo'shing.
--
-- Ishga tushirish: Supabase SQL / psql da shu faylni bajaring. PASS da NOTICE.

do $$
declare v record; v_plan json; v_obj bigint; v_buzilgan text := ''; v_soni int := 0;
begin
  select obyekt_id into v_obj from public.t2_qator group by obyekt_id order by count(*) desc limit 1;
  if v_obj is null then raise notice 'TEZLIK_KONTRAKTI: t2_qator bo''sh — tekshiruv o''tkazildi'; return; end if;
  for v in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'obyekt_id' and not a.attisdropped)
      and exists (select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid
                  where r.ev_class = c.oid and d.refobjid = 'public.t2_qator'::regclass)
    order by 1
  loop
    v_soni := v_soni + 1;
    execute format('explain (format json) select * from public.%I where obyekt_id = %s', v.relname, v_obj) into v_plan;
    if v_plan::text ~ '"Node Type": "Seq Scan",[^}]*"Relation Name": "t2_qator"' then
      v_buzilgan := v_buzilgan || E'\n  - ' || v.relname;
    end if;
  end loop;
  if v_buzilgan <> '' then
    raise exception 'TEZLIK_KONTRAKTI_FAIL (obyekt %): quyidagi view lar butun t2_qator ni aylanadi:%', v_obj, v_buzilgan;
  end if;
  raise notice 'TEZLIK_KONTRAKTI_PASS: % ta obyekt read-model (obyekt %) indeks bilan o''qiydi', v_soni, v_obj;
end $$;
