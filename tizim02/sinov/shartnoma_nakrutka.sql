-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: ШАРТНОМА + НАКРУТКА
--   t2_nakrutka_hisob · t2_nakrutka_koef · t2_obyekt_nakrutka
--   t2_shartnoma_saqla · t2_shartnoma_bog_saqla · t2_nakrutka_saqla
-- ══════════════════════════════════════════════════════════════════
--
-- ⚠️ Formula qo'lda tekshirilgan (2026-08-25): chel=1000000, mash=500000,
-- mat=2000000, standart koeffitsientlar bilan har oraliq qadam qo'lda
-- hisoblab tasdiqlangan — SQL porti aynan mos.
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (id=2, __SINOV__zanjir). Oxirida tozalaydi.

do $$
declare
  v_r jsonb; v_sh_id bigint; v_ok int := 0; v_x int := 0;
  v_nds_default numeric; v_nds_override numeric;
begin
  -- ── 1. Formula qo'lda tekshirilgan qiymatga MOS ────────────────────
  v_r := t2_nakrutka_hisob(1000000, 500000, 2000000, 0, 0, 0, 0,
    '{"ТРАНСПОРТ_МАТЕРИАЛ":5,"СКЛАДСКИЕ_МАТЕРИАЛ":2,"ПРОЧИЕ_ПОДРЯДЧИК":18,
      "СТРАХОВАНИЕ":0.32,"НДС":12}'::jsonb);
  if (v_r->>'vsego')::numeric = 4826017.9968
    then v_ok := v_ok+1; raise notice 'OK 1 formula aniq mos (vsego=%)', v_r->>'vsego';
    else v_x := v_x+1; raise warning 'XATO 1 vsego: %', v_r->>'vsego'; end if;

  -- ── 2. Chiziqlilik: kategoriya koeffitsientlari yig'indisi = vsego ──
  declare v_kf jsonb; v_yigindi numeric;
  begin
    v_kf := t2_nakrutka_koef('{"ТРАНСПОРТ_МАТЕРИАЛ":5,"СКЛАДСКИЕ_МАТЕРИАЛ":2,
      "ПРОЧИЕ_ПОДРЯДЧИК":18,"СТРАХОВАНИЕ":0.32,"НДС":12}'::jsonb);
    v_yigindi := 1000000*(v_kf->>'ЧЕЛ')::numeric + 500000*(v_kf->>'МАШ')::numeric
               + 2000000*(v_kf->>'МАТ')::numeric;
    if abs(v_yigindi - 4826017.9968) < 0.01
      then v_ok := v_ok+1; raise notice 'OK 2 chiziqlilik tasdiqlandi';
      else v_x := v_x+1; raise warning 'XATO 2 yigindi: %', v_yigindi; end if;
  end;

  -- ── 3. Shartnoma yaratish ──────────────────────────────────────────
  v_r := t2_shartnoma_saqla('__SINOV__001', 'Sinov shartnoma', 'Sinov buyurtmachi',
    1000000, 120000, 1120000, 25000, 'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_sh_id := (v_r->>'shartnoma_id')::bigint;
         raise notice 'OK 3 shartnoma yaratildi (id=%)', v_sh_id;
    else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

  -- ── 4. Optimistik qulf ───────────────────────────────────────────
  v_r := t2_shartnoma_saqla('__SINOV__001', 'x', null,null,null,null,null,null, 0);
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'versiya'
    then v_ok := v_ok+1; raise notice 'OK 4 eski versiya rad etildi';
    else v_x := v_x+1; raise warning 'XATO 4 %', v_r; end if;

  -- ── 5. Default накрутка (bog'lanmagan holatda) ────────────────────
  v_nds_default := (t2_obyekt_nakrutka(2)->'nakrutka'->>'nds')::numeric;

  -- ── 6. Obyektni shartnomaga bog'lash ───────────────────────────────
  v_r := t2_shartnoma_bog_saqla(2, v_sh_id);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 6 obyekt shartnomaga bogландi';
    else v_x := v_x+1; raise warning 'XATO 6 %', v_r; end if;

  -- ── 7. Накрутка override (НДС 12% -> 20%) ─────────────────────────
  v_r := t2_nakrutka_saqla('[{"koef":"НДС","qiymat":20}]'::jsonb, v_sh_id);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 7 override saqlandi';
    else v_x := v_x+1; raise warning 'XATO 7 %', v_r; end if;

  v_nds_override := (t2_obyekt_nakrutka(2)->'nakrutka'->>'nds')::numeric;
  -- 20/12 nisbat aniq bo'lishi kerak
  if abs(v_nds_override / v_nds_default - (20.0/12.0)) < 0.0001
    then v_ok := v_ok+1; raise notice 'OK 8 override qollandi (nisbat 20/12 aniq)';
    else v_x := v_x+1; raise warning 'XATO 8 default=% override=%', v_nds_default, v_nds_override; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  delete from t2_nakrutka where shartnoma_id = v_sh_id;
  delete from t2_shartnoma_bog where obyekt_id = 2;
  delete from t2_shartnoma where id = v_sh_id;

  if not exists (select 1 from t2_shartnoma where raqam = '__SINOV__001')
    then v_ok := v_ok+1; raise notice 'OK 9 tozalandi';
    else v_x := v_x+1; raise warning 'XATO 9 tozalanmadi'; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'SHARTNOMA/NAKRUTKA QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
