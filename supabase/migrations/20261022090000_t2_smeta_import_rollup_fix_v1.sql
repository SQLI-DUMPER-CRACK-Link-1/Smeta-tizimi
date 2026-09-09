-- T2-SMETA-IMPORT-ROLLUP-001
--
-- HODISA (egasi, 2026-09-09): «obyektga kirilganda daraxt ochilganda
-- hammasi 0 bo'lib turibdi, ichida narxlangan resurslari bo'lgan taqdirda
-- ham».
--
-- ILDIZ SABAB: birorta smeta-import RPC'si `t2_rollup` ni CHAQIRMAYDI.
-- Tekshirildi (jonli katalog):
--   t2_smeta_import_boshla_v1  -> rollup: yo'q
--   t2_smeta_import_bolak_v1   -> rollup: yo'q
--   t2_smeta_import_bulk_v1    -> rollup: yo'q  (signal refresh bor)
--   t2_smeta_import_yakunla_v1 -> rollup: yo'q  (signal refresh bor)
-- `t2_rollup` ni faqat `t2_qator_qosh`, `t2_qator_tahrir` va
-- `t2_smeta_narxla_res_v1` chaqiradi.
--
-- Ya'ni: agar smeta NARXI BILAN import qilinsa (LRV faylning o'zida narx
-- bo'lsa), barg qatorlar `narx`/`summa` bilan yoziladi, lekin ota (bl/rz)
-- qatorlarning `summa`si HECH QACHON hisoblanmaydi — daraxt 0 ko'rsatadi.
-- RES orqali narxlangan obyektlarda muammo ko'rinmaydi, chunki
-- `t2_smeta_narxla_res_v1` oxirida rollup qiladi.
--
-- JONLI DALIL (2026-09-09):
--   obyekt 64 «Karting»   : barglar 985 075 713 621.30, ildiz 0.00, 358/358 ota nol
--   obyekt 65 «Karting1»  : barglar 985 075 713 621.30, ildiz 0.00, 358/358 ota nol
--   obyekt 69 «GAME CLUB» : barglar   8 153 706 872.08, ildiz 0.00, 336/336 ota nol
-- Solishtirish uchun sog'lom obyektlar (RES bilan narxlangan):
--   obyekt 5, 6, 8, 10 — ildiz summasi barglar summasiga TENG.
--
-- TUZATISH: import yakunida `t2_rollup` chaqiriladi. `t2_rollup` o'zi
-- birinchi qatorda `t2_manba_belgila('rollup')` qiladi — bu trigger-skip
-- ro'yxatidagi qiymat, shuning uchun ommaviy yangilash trigger kaskadini
-- (57014 timeout) keltirib chiqarmaydi.
--
-- Rollback tranzaksiyasida tekshirilgan: obyekt 64 uchun ildiz
-- 0.00 -> 985 075 713 621.30 (barglar summasiga AYNAN teng),
-- `narxsiz_qator: 0`, `yetim_qator: 0`, nol qolgan `bl`: 0.

begin;

do $$
declare
  v_def text;
begin
  -- ── t2_smeta_import_yakunla_v1 ──────────────────────────────────────
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 't2_smeta_import_yakunla_v1';

  if v_def is null then
    raise exception 't2_smeta_import_yakunla_v1 topilmadi';
  end if;

  if v_def ilike '%t2_rollup%' then
    raise notice 't2_smeta_import_yakunla_v1: rollup allaqachon bor, o''tkazib yuborildi';
  else
    -- Signal refresh chaqiruvidan OLDIN rollup qilinadi: signal ota
    -- qatorlarning yangilangan summasiga tayanadi.
    v_def := regexp_replace(
      v_def,
      '(perform\s+public\.t2_signal_refresh_object\s*\()',
      'perform public.t2_rollup(p_obyekt_id);' || E'\n    ' || '\1',
      'i');
    if v_def not ilike '%t2_rollup%' then
      raise exception 't2_smeta_import_yakunla_v1: signal_refresh chaqiruvi topilmadi — qo''lda ko''rib chiqing';
    end if;
    execute v_def;
    raise notice 't2_smeta_import_yakunla_v1: rollup qo''shildi';
  end if;

  -- ── t2_smeta_import_bulk_v1 ─────────────────────────────────────────
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 't2_smeta_import_bulk_v1';

  if v_def is null then
    raise exception 't2_smeta_import_bulk_v1 topilmadi';
  end if;

  if v_def ilike '%t2_rollup%' then
    raise notice 't2_smeta_import_bulk_v1: rollup allaqachon bor, o''tkazib yuborildi';
  else
    v_def := regexp_replace(
      v_def,
      '(perform\s+public\.t2_signal_refresh_object\s*\()',
      'perform public.t2_rollup(p_obyekt_id);' || E'\n    ' || '\1',
      'i');
    if v_def not ilike '%t2_rollup%' then
      raise exception 't2_smeta_import_bulk_v1: signal_refresh chaqiruvi topilmadi — qo''lda ko''rib chiqing';
    end if;
    execute v_def;
    raise notice 't2_smeta_import_bulk_v1: rollup qo''shildi';
  end if;
end $$;

-- ── Tekshiruv: ikkala funksiyada ham rollup bo'lishi SHART ────────────
do $$
declare v_yoq text;
begin
  select string_agg(p.proname, ', ') into v_yoq
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('t2_smeta_import_yakunla_v1', 't2_smeta_import_bulk_v1')
    and pg_get_functiondef(p.oid) not ilike '%t2_rollup%';
  if v_yoq is not null then
    raise exception 'ROLLUP QO''SHILMADI: %', v_yoq;
  end if;
end $$;

commit;
