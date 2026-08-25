-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: NARXLAR MARKAZI
--   t2_narx_belgila · t2_narx_sana_qosh · t2_narxla · t2_narx_markaz
-- ══════════════════════════════════════════════════════════════════
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (`__SINOV__zanjir`). Oxirida o'zidan keyin
-- tozalaydi va jamini boshlang'ich holatga qaytaradi (8-tekshiruv).
--
-- Ishga tushirish: Supabase SQL editorida yoki mcp execute_sql bilan.
-- Hech qanday xato chiqmasa — hammasi o'tdi (xato bo'lsa exception).

do $$
declare v_r jsonb; v_ok int := 0; v_x int := 0;
        v_jami0 numeric; v_jami1 numeric; v_ver int; v_ob bigint;
begin
  select id into v_ob from t2_obyekt where nom = '__SINOV__zanjir';
  if v_ob is null then
    raise exception 'Sinov obyekti topilmadi — test bajarilmadi';
  end if;
  select sum(summa) into v_jami0 from t2_qator where obyekt_id = v_ob and tur = 'rz';

  -- ── 1. NARX BELGILASH ─────────────────────────────────────────────
  v_r := t2_narx_belgila('Штукатурка стен', 'м2', 12345, 'МАТ', 'sinov uchun');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 1 narx belgilandi';
    else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;
  v_ver := (v_r->>'versiya')::int;

  -- ── 2. OPTIMISTIK QULF ────────────────────────────────────────────
  -- ⚠️ Ikki odam bir narxni bir vaqtda o'zgartirsa, oxirgisi JIMGINA
  -- yutmasin. Eski versiya bilan yozuv RAD etilishi shart.
  v_r := t2_narx_belgila('Штукатурка стен','м2', 999, null, null, v_ver - 1);
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'versiya'
    then v_ok := v_ok+1; raise notice 'OK 2 eski versiya rad etildi';
    else v_x := v_x+1; raise warning 'XATO 2 %', v_r; end if;

  -- ── 3. NARX O'ZIDAN TO'QILMAYDI ───────────────────────────────────
  -- «Belgilangan narx» — ATAYLAB qo'yilgan raqam. Noma'lum bo'lsa
  -- bu funksiya umuman chaqirilmaydi.
  v_r := t2_narx_belgila('Штукатурка стен','м2', null);
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'narx'
    then v_ok := v_ok+1; raise notice 'OK 3 narxsiz belgilash rad etildi';
    else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

  -- ── 4. BELGILANGAN NARX SMETAGA TUSHADI ───────────────────────────
  -- ⚠️ Bu bo'shliq edi: `t2_narxla` registrdan faqat `kat` va
  -- `belgilangan` (bool) ni o'qirdi, NARXNING O'ZINI emas — ya'ni odam
  -- narx belgilasa u smetaga HECH QACHON tushmasdi.
  v_r := t2_narxla(v_ob);
  if (v_r->>'BELGILANGAN')::int >= 1
    then v_ok := v_ok+1; raise notice 'OK 4 BELGILANGAN % qator', v_r->>'BELGILANGAN';
    else v_x := v_x+1; raise warning 'XATO 4 %', v_r; end if;

  -- ── 5. QO'LDA KIRITILGAN NARXGA TEGILMAYDI ────────────────────────
  -- ⚠️ HAQIQIY HODISA (19-avg): ikki odam narxni qo'lda tuzatdi
  -- (20000 → 20500 → 21000), keyin `t2_narxla` uni JIMGINA 20000 ga
  -- qaytardi. Sabab: QOL belgisi 20-avgustda qo'shilgan, undan oldingi
  -- tahrirlar himoyasiz qolgan. `t2_narx_qol_xavf` shuni ko'rsatadi.
  if (select narx from t2_qator
      where obyekt_id = v_ob and narx_usul = 'QOL' limit 1) is not null
    then v_ok := v_ok+1; raise notice 'OK 5 QOL qatori saqlandi';
    else v_x := v_x+1; raise warning 'XATO 5 QOL qatori yoqoldi'; end if;

  -- ── 6. SANA NARXI + REESTR KAFOLATI ───────────────────────────────
  -- Yaroqsiz qator JIM tashlanmaydi: kirgan = yozildi + tashlandi
  v_r := t2_narx_sana_qosh(current_date,
    '[{"nom":"СИНОВ САНА РЕСУРС","birlik":"ШТ","narx":5000},
      {"nom":"","birlik":"ШТ","narx":100},
      {"nom":"НАРХСИЗ","birlik":"ШТ"}]'::jsonb, 'sinov');
  if (v_r->>'ok') = 'true' and (v_r->>'yozildi')::int = 1
     and (v_r->>'tashlandi')::int = 2 and (v_r->>'kafolat') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 6 reestr kafolati';
    else v_x := v_x+1; raise warning 'XATO 6 %', v_r; end if;

  -- ── 7. MARKAZ: natija = MAX(belgilangan, smeta, sana) ─────────────
  if (select natija from t2_narx_markaz
      where nom_key = t2_nom_key('Штукатурка стен')
        and birlik_key = t2_birlik_key('м2')) = 12345
    then v_ok := v_ok+1; raise notice 'OK 7 markaz natijasi togri';
    else v_x := v_x+1; raise warning 'XATO 7 %',
      (select natija from t2_narx_markaz
       where nom_key = t2_nom_key('Штукатурка стен')); end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  perform set_config('t2.manba', 'baza', true);
  delete from t2_narx      where obyekt_id is null and nom_key = t2_nom_key('Штукатурка стен');
  delete from t2_narx_sana where nom_key = t2_nom_key('СИНОВ САНА РЕСУРС');
  perform t2_narxla(v_ob);
  perform t2_rollup(v_ob);
  select sum(summa) into v_jami1 from t2_qator where obyekt_id = v_ob and tur = 'rz';

  if v_jami1 is not distinct from v_jami0
    then v_ok := v_ok+1; raise notice 'OK 8 jami qaytdi: %', v_jami1;
    else v_x := v_x+1; raise warning 'XATO 8 jami: % -> %', v_jami0, v_jami1; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'NARXLASH QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
