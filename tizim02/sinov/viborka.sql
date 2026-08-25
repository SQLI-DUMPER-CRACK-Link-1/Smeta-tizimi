-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: VIBORKA (material tanlash/xarid nazorati)
--   t2_viborka_smetadan_toldir · t2_viborka_qabul_yoz · t2_viborka_holat
-- ══════════════════════════════════════════════════════════════════
--
-- Foydalanuvchi (2026-08-25): «viborka boshqatdan qurilishi kerak».
-- Eski holat: BUTUN tizim uchun bitta umumiy Sheets hujjati, obyektga
-- bog'lanmagan. Yangi: har obyekt o'z qatorlariga ega, reja smetadan
-- avtomat, qabul alohida audit jurnali bilan.
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (`__SINOV__zanjir`). Oxirida tozalaydi.

do $$
declare
  v_ob bigint; v_r jsonb; v_vid bigint; v_ok int := 0; v_x int := 0;
  v_jami0 numeric; v_jami1 numeric;
begin
  select id into v_ob from t2_obyekt where nom = '__SINOV__zanjir';
  if v_ob is null then raise exception 'Sinov obyekti topilmadi'; end if;
  select sum(summa) into v_jami0 from t2_qator where obyekt_id = v_ob and tur = 'rz';

  -- ── 1. Smetadan reja to'ldirish — idempotent ────────────────────
  v_r := t2_viborka_smetadan_toldir(v_ob);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 1 smetadan toldirildi: % yangi', v_r->>'yangi_qator';
    else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;

  v_r := t2_viborka_smetadan_toldir(v_ob);   -- 2-marta — hammasi UPDATE bo'lishi kerak
  if (v_r->>'yangi_qator')::int = 0
    then v_ok := v_ok+1; raise notice 'OK 2 idempotent (0 yangi)';
    else v_x := v_x+1; raise warning 'XATO 2 % yangi chiqdi', v_r->>'yangi_qator'; end if;

  select id into v_vid from t2_viborka
   where obyekt_id = v_ob and nom = 'Бетон М-350, тяжёлый' limit 1;
  if v_vid is null then
    raise exception 'Sinov resursi (Бетон) viborkada topilmadi — smetada yo''qmi?';
  end if;

  -- ── 3. Qabul yozish (qisman) ─────────────────────────────────────
  v_r := t2_viborka_qabul_yoz(v_vid, 1, 500000, 'Sinov YB', current_date, 'sinov',
                              null, gen_random_uuid());
  if (v_r->>'ok') = 'true' and (v_r->>'holat') = 'qisman'
    then v_ok := v_ok+1; raise notice 'OK 3 qisman qabul';
    else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

  -- ── 4. IDEMPOTENTLIK: ayni operation_id ikkinchi qabul yaratmaydi ──
  declare v_opid uuid := gen_random_uuid(); v_qid1 bigint;
  begin
    v_r := t2_viborka_qabul_yoz(v_vid, 5, null, null, current_date, 'idempotent sinov',
                                null, v_opid);
    v_qid1 := (v_r->>'qabul_id')::bigint;
    v_r := t2_viborka_qabul_yoz(v_vid, 5, null, null, current_date, 'idempotent sinov',
                                null, v_opid);
    if (v_r->>'takror') = 'true' and (v_r->>'qabul_id')::bigint = v_qid1
      then v_ok := v_ok+1; raise notice 'OK 4 takroriy operation_id ikkinchi yaratmadi';
      else v_x := v_x+1; raise warning 'XATO 4 %', v_r; end if;
  end;

  -- ── 5. NARX BERILMASA ESKISI SAQLANADI ────────────────────────────
  v_r := t2_viborka_qabul_yoz(v_vid, 1, null, null, current_date, 'narxsiz',
                              null, gen_random_uuid());
  if (select narx from t2_viborka where id = v_vid) = 500000
    then v_ok := v_ok+1; raise notice 'OK 5 narx saqlandi (500000)';
    else v_x := v_x+1; raise warning 'XATO 5 narx: %', (select narx from t2_viborka where id=v_vid); end if;

  -- ── 6. OPTIMISTIK QULF ─────────────────────────────────────────────
  v_r := t2_viborka_qabul_yoz(v_vid, 1, null, null, current_date, 'eski versiya', 1,
                              gen_random_uuid());
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'versiya'
    then v_ok := v_ok+1; raise notice 'OK 6 eski versiya rad etildi';
    else v_x := v_x+1; raise warning 'XATO 6 %', v_r; end if;

  -- ── 7. XAVF BAYROG'I: reja 2 dan oshib qabul qilinganda ───────────
  v_r := t2_viborka_qabul_yoz(v_vid, 100, null, null, current_date, 'ortiqcha qabul',
                              null, gen_random_uuid());
  if (v_r->>'xavf') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 7 xavf bayrogi kotarildi';
    else v_x := v_x+1; raise warning 'XATO 7 %', v_r; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  delete from t2_viborka_qabul where viborka_id in (
    select id from t2_viborka where obyekt_id = v_ob);
  delete from t2_viborka where obyekt_id = v_ob;
  perform t2_rollup(v_ob);
  select sum(summa) into v_jami1 from t2_qator where obyekt_id = v_ob and tur = 'rz';

  if v_jami1 is not distinct from v_jami0
    then v_ok := v_ok+1; raise notice 'OK 8 smeta jami ozgarmadi: %', v_jami1;
    else v_x := v_x+1; raise warning 'XATO 8 jami: % -> %', v_jami0, v_jami1; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'VIBORKA QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
