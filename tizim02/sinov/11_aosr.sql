-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: АОСР (yashirin ishlar akti)
--   t2_aosr_yoz · t2_aosr_bekor · t2_aosr_bog_saqla · t2_aosr_bog_ochir
--   t2_aosr_reestr · t2_aosr_coverage · t2_yashirin_mi
-- ══════════════════════════════════════════════════════════════════
--
-- `Smeta tizimi/45_Hujjatlar.js` (akt qismi) dan Postgres-native qayta
-- qurildi (2026-08-27, foydalanuvchi qarori bilan). Asosiy arxitektura
-- farqi: Tizim_01 da BITTA umumiy Sheets fayl OBJECT_NAME matn
-- moslashtirish orqali; bu yerda har akt REAL obyekt_id ga bog'langan,
-- ko'p-ko'pga bog'lanish alohida jadvalda (t2_aosr_bog).
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (id=2). Oxirida tozalaydi.

do $$
declare
  v_r jsonb; v_ok int := 0; v_x int := 0;
  v_aosr_id bigint; v_akt_id bigint; v_qator_id bigint;
begin
  select id into v_qator_id from t2_qator where obyekt_id=2 and tur='bl' limit 1;
  if v_qator_id is null then raise exception 'sinov uchun bl qator topilmadi'; end if;

  -- ── 1. Akt yaratish (idempotentlik) ──────────────────────────────
  declare v_opid uuid := gen_random_uuid();
  begin
    v_r := t2_aosr_yoz(2,'__SINOV__AOSR-1','Sinov yashirin ish','2032-01-01'::date,
      '2032-01-05'::date,'1 m3',null,'sinov','yangi',null,null,v_opid,'frontend','sinov');
    if (v_r->>'ok') = 'true'
      then v_ok := v_ok+1; v_aosr_id := (v_r->>'id')::bigint;
      else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;

    v_r := t2_aosr_yoz(2,'__SINOV__AOSR-1','Sinov yashirin ish','2032-01-01'::date,
      '2032-01-05'::date,'1 m3',null,'sinov','yangi',null,null,v_opid,'frontend','sinov');
    if (v_r->>'ok') = 'true' and (v_r->>'takror') = 'true'
      then v_ok := v_ok+1;
      else v_x := v_x+1; raise warning 'XATO 2 idempotentlik: %', v_r; end if;
  end;

  -- ── 2. Fakt akt yaratamiz (coverage sinash uchun) ────────────────
  v_r := t2_akt_yarat(2,'fakt','2033-01-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id',v_qator_id,'hajm',1)),
    null, gen_random_uuid(),'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_akt_id := (v_r->>'akt_id')::bigint;
    else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

  -- ── 3. Bog'lashdan OLDIN — coverage'da akt_bor=false bo'lishi kerak ──
  if exists (select 1 from t2_aosr_coverage where qator_id=v_qator_id and akt_bor=false)
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 4 bog''lanmasdan oldin akt_bor allaqachon true'; end if;

  -- ── 4. Bog'lash ───────────────────────────────────────────────────
  v_r := t2_aosr_bog_saqla(ARRAY[v_aosr_id], ARRAY[v_qator_id]);
  if (v_r->>'ok') = 'true' and (v_r->>'yangi_boglanish')::int = 1
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 5 %', v_r; end if;

  -- ── 5. Bog'lashdan KEYIN — coverage'da akt_bor=true bo'lishi kerak ──
  if exists (select 1 from t2_aosr_coverage where qator_id=v_qator_id and akt_bor=true)
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 6 bog''langandan keyin ham akt_bor=false qoldi'; end if;

  -- ── 6. Reestr — boglangan_ish_soni to'g'ri ────────────────────────
  if exists (select 1 from t2_aosr_reestr where id=v_aosr_id and boglangan_ish_soni=1)
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 7 reestr boglangan_ish_soni noto''g''ri'; end if;

  -- ── 7. Qayta bog'lash — dublikat qo'shilmasin ────────────────────
  v_r := t2_aosr_bog_saqla(ARRAY[v_aosr_id], ARRAY[v_qator_id]);
  if (v_r->>'ok') = 'true' and (v_r->>'yangi_boglanish')::int = 0
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 8 dublikat oldi olinmadi: %', v_r; end if;

  -- ── 8. Uzish ──────────────────────────────────────────────────────
  v_r := t2_aosr_bog_ochir(v_aosr_id, v_qator_id);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 9 %', v_r; end if;

  if exists (select 1 from t2_aosr_coverage where qator_id=v_qator_id and akt_bor=false)
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 10 uzilgandan keyin ham akt_bor=true qoldi'; end if;

  -- ── 9. Versiyalangan tahrirlash + optimistik qulf ────────────────
  v_r := t2_aosr_yoz(2,null,'Yangi nom',null,null,null,null,null,null,v_aosr_id,1,null,'frontend','sinov');
  if (v_r->>'ok') = 'true' and (v_r->>'versiya')::int = 2
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 11 %', v_r; end if;

  v_r := t2_aosr_yoz(2,null,'x',null,null,null,null,null,null,v_aosr_id,1,null,'frontend','sinov');
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'versiya'
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 12 eski versiya rad etilmadi: %', v_r; end if;

  -- ── 10. Bekor qilish (soft-cancel, reestrdan chiqadi) ────────────
  v_r := t2_aosr_bekor(v_aosr_id, 2);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 13 %', v_r; end if;

  if not exists (select 1 from t2_aosr_reestr where id=v_aosr_id)
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 14 bekor qilingan akt reestrda ko''rinmoqda'; end if;

  -- ── 11. Yashirin ish aniqlash ──────────────────────────────────────
  if t2_yashirin_mi('Устройство свайного фундамента') = true
     and t2_yashirin_mi('Малярные работы') = false
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 15 yashirin_mi noto''g''ri ishladi'; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  delete from t2_aosr_bog where aosr_id=v_aosr_id;
  delete from t2_aosr where id=v_aosr_id;
  delete from t2_akt_qator where akt_id=v_akt_id;
  delete from t2_akt where id=v_akt_id;

  if not exists (select 1 from t2_aosr where raqam='__SINOV__AOSR-1')
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 16 tozalanmadi'; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'АОСР QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
