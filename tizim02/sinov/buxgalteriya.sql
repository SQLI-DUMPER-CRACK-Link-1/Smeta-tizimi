-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: БУХГАЛТЕРИЯ (to'lovlar, xarajatlar, dashboard)
--   t2_tolov_yoz/tahrir/ochir · t2_xarajat_yoz/tahrir/ochir
--   t2_bux_dashboard · t2_debitor_aging · t2_bux_umumiy
-- ══════════════════════════════════════════════════════════════════
--
-- ⚠️ 2026-08-25: birinchi ishga tushirishda `t2_bux_dashboard.tolangan`
-- doim 0 chiqdi — sabab: `sum(x) FILTER(avans/tolov) - sum(y) FILTER(qaytarim)`
-- da `qaytarim` qatori yo'q bo'lsa ikkinchi sum() NULL qaytaradi va
-- NULL ayirish BUTUN natijani NULL qiladi (keyin COALESCE uni 0 ga
-- yashiradi). Tuzatildi: har ikki sum() alohida COALESCE(...,0) bilan
-- o'raldi. Bu test aynan shu holatni ushlab qoladi (5-band).
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (id=2, __SINOV__BUX). Oxirida tozalaydi.

do $$
declare
  v_r jsonb; v_sh_id bigint; v_tolov_id bigint; v_xarajat_id bigint;
  v_ok int := 0; v_x int := 0;
  v_dash record; v_umumiy record;
begin
  -- ── 1. Sinov shartnoma yaratish ─────────────────────────────────────
  v_r := t2_shartnoma_saqla('__SINOV__BUX', 'Sinov bux shartnoma', null,
    null, null, 10000000);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_sh_id := (v_r->>'shartnoma_id')::bigint;
         raise notice 'OK 1 shartnoma yaratildi (id=%)', v_sh_id;
    else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;

  -- ── 2. Obyektni bog'lash ─────────────────────────────────────────────
  v_r := t2_shartnoma_bog_saqla(2, v_sh_id);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 2 obyekt bog''landi';
    else v_x := v_x+1; raise warning 'XATO 2 %', v_r; end if;

  -- ── 3. To'lov yozish (idempotent — operation_id bilan) ─────────────
  declare v_opid uuid := gen_random_uuid();
  begin
    v_r := t2_tolov_yoz(v_sh_id, 5000000, 'tolov', null, 2, 'sinov tolov', v_opid);
    if (v_r->>'ok') = 'true'
      then v_ok := v_ok+1; v_tolov_id := (v_r->>'tolov_id')::bigint;
           raise notice 'OK 3 tolov yozildi (id=%)', v_tolov_id;
      else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

    -- ── 4. Xuddi shu operation_id bilan qayta yuborish = takror (yangi qator emas) ──
    v_r := t2_tolov_yoz(v_sh_id, 5000000, 'tolov', null, 2, 'sinov tolov', v_opid);
    if (v_r->>'ok') = 'true' and (v_r->>'takror') = 'true'
         and (v_r->>'tolov_id')::bigint = v_tolov_id
      then v_ok := v_ok+1; raise notice 'OK 4 idempotentlik ishladi (takrorlanmadi)';
      else v_x := v_x+1; raise warning 'XATO 4 %', v_r; end if;
  end;

  -- ── 5. Xarajat yozish ────────────────────────────────────────────────
  v_r := t2_xarajat_yoz(1000000, 'sinov toifa', null, 'sinov xarajat', gen_random_uuid());
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_xarajat_id := (v_r->>'xarajat_id')::bigint;
         raise notice 'OK 5 xarajat yozildi (id=%)', v_xarajat_id;
    else v_x := v_x+1; raise warning 'XATO 5 %', v_r; end if;

  -- ── 6. Dashboard: NULL-poisoning bugi qaytmaganini tekshirish ───────
  select * into v_dash from t2_bux_dashboard where shartnoma_id = v_sh_id;
  if v_dash.tolangan = 5000000 and v_dash.bajarilgan = 0
       and v_dash.avans = 5000000 and v_dash.debitor = 0
    then v_ok := v_ok+1; raise notice 'OK 6 dashboard aniq (tolangan=%, avans=%)',
      v_dash.tolangan, v_dash.avans;
    else v_x := v_x+1; raise warning 'XATO 6 dashboard: tolangan=% bajarilgan=% avans=% debitor=%',
      v_dash.tolangan, v_dash.bajarilgan, v_dash.avans, v_dash.debitor; end if;

  -- ── 7. Umumiy (kompaniya darajasida) — sinov summalarini o'z ichiga oladi ──
  select * into v_umumiy from t2_bux_umumiy;
  if v_umumiy.jami_tolangan >= 5000000 and v_umumiy.jami_xarajat >= 1000000
    then v_ok := v_ok+1; raise notice 'OK 7 umumiy hisobga oldi';
    else v_x := v_x+1; raise warning 'XATO 7 %', v_umumiy; end if;

  -- ── 8. To'lovni bekor qilish (soft-cancel, o'chirilmaydi) ───────────
  v_r := t2_tolov_ochir(v_tolov_id, null);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 8 %', v_r; end if;

  select * into v_dash from t2_bux_dashboard where shartnoma_id = v_sh_id;
  if v_dash.tolangan = 0 and exists (select 1 from t2_tolov where id = v_tolov_id and holat = 'bekor')
    then v_ok := v_ok+1; raise notice 'OK 8 bekor qilingach dashboarddan chiqdi, lekin qatori qoldi (tarix)';
    else v_x := v_x+1; raise warning 'XATO 8 bekordan keyin: tolangan=%', v_dash.tolangan; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  delete from t2_xarajat where id = v_xarajat_id;
  delete from t2_tolov where shartnoma_id = v_sh_id;
  delete from t2_shartnoma_bog where obyekt_id = 2 and shartnoma_id = v_sh_id;
  delete from t2_shartnoma where id = v_sh_id;

  if not exists (select 1 from t2_shartnoma where raqam = '__SINOV__BUX')
    then v_ok := v_ok+1; raise notice 'OK 9 tozalandi';
    else v_x := v_x+1; raise warning 'XATO 9 tozalanmadi'; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'BUXGALTERIYA QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
