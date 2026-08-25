-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: F2 TAHLIL KO'RINISHLARI
--   t2_f2_kat_oy · t2_f2_tafsilot
-- ══════════════════════════════════════════════════════════════════
--
-- Tizim_01 dagi apiF2QatlamTahlil / apiF2PriamoyZatrat / apiF2OyTafsilot
-- Sheets katagini SKANLAB hisoblardi. Bu ikki ko'rinish ALLAQACHON
-- bazadagi t2_akt_qator + t2_qator dan hisoblaydi — skanlash shart emas.
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (`__SINOV__zanjir`, id=2). Test o'zi yaratgan
-- aktni BEKOR qiladi (o'chirmaydi — akt tarixi saqlanadi) va ko'rinishlar
-- undan CHIQIB ketishini tekshiradi.
--
-- Ishga tushirish: Supabase SQL editorida yoki mcp execute_sql bilan.

do $$
declare v_ob bigint; v_r jsonb; v_akt bigint; v_ok int := 0; v_x int := 0;
begin
  select id into v_ob from t2_obyekt where nom = '__SINOV__zanjir';
  if v_ob is null then raise exception 'Sinov obyekti topilmadi'; end if;

  -- id=70 (rs, ЧЕЛ, narx 21000) va id=67 (mat, МАТ, narx 850000) —
  -- t2_qator_qosh sinovidan qolgan doimiy sinov qatorlari.
  -- ⚠️ Bu obyektda fakt yo'q, shuning uchun p_majburiy=true — biz bu yerda
  -- invariantni emas, KO'RINISHLARNI sinaymiz (invariant alohida sinalgan:
  -- t2_akt_yarat qabul testi / T2_FAZA6_AKT_YADRO.md).
  v_r := t2_akt_yarat(v_ob, 'f2', '2026-08-01'::date,
    jsonb_build_array(
      jsonb_build_object('qator_id', 70, 'hajm', 5),
      jsonb_build_object('qator_id', 67, 'hajm', 2)
    ), null, gen_random_uuid(), 'sinov', 'sinov-test', true);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_akt := (v_r->>'akt_id')::bigint;
         raise notice 'OK 1 akt yaratildi (id=%)', v_akt;
    else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;

  -- ── kat_oy: kategoriya bo'yicha to'g'ri ajratilishi ────────────────
  if (select jami_summa from t2_f2_kat_oy
      where obyekt_id = v_ob and oy = '2026-08-01' and kat = 'ЧЕЛ') = 5 * 21000
    then v_ok := v_ok+1; raise notice 'OK 2 kat_oy ЧЕЛ = 105000';
    else v_x := v_x+1; raise warning 'XATO 2 %',
      (select jami_summa from t2_f2_kat_oy where obyekt_id=v_ob and kat='ЧЕЛ'); end if;

  if (select jami_summa from t2_f2_kat_oy
      where obyekt_id = v_ob and oy = '2026-08-01' and kat = 'МАТ') = 2 * 850000
    then v_ok := v_ok+1; raise notice 'OK 3 kat_oy МАТ = 1700000';
    else v_x := v_x+1; raise warning 'XATO 3 %',
      (select jami_summa from t2_f2_kat_oy where obyekt_id=v_ob and kat='МАТ'); end if;

  -- ── tafsilot: qator darajasida ikkalasi ham ko'rinadi ──────────────
  if (select count(*) from t2_f2_tafsilot where akt_id = v_akt) = 2
    then v_ok := v_ok+1; raise notice 'OK 4 tafsilot 2 qator';
    else v_x := v_x+1; raise warning 'XATO 4 soni: %',
      (select count(*) from t2_f2_tafsilot where akt_id=v_akt); end if;

  -- ── BEKOR QILINGACH ikkala ko'rinishdan ham CHIQISHI shart ─────────
  -- ⚠️ Bekor qilingan akt hisobga kirsa, moliyaviy jami noto'g'ri
  -- chiqadi — bu tekshiruv shu xatoni ushlaydi.
  perform t2_akt_bekor(v_akt, 'sinov tozalash');

  if not exists (select 1 from t2_f2_tafsilot where akt_id = v_akt)
    then v_ok := v_ok+1; raise notice 'OK 5 bekor qilingach tafsilotdan chiqdi';
    else v_x := v_x+1; raise warning 'XATO 5 hali korinadi'; end if;

  if not exists (select 1 from t2_f2_kat_oy where obyekt_id = v_ob and oy = '2026-08-01')
    then v_ok := v_ok+1; raise notice 'OK 6 bekor qilingach kat_oy dan chiqdi';
    else v_x := v_x+1; raise warning 'XATO 6 hali korinadi'; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'F2 TAHLIL QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
