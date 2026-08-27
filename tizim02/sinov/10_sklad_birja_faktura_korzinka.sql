-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: SKLAD · KORZINKA · B2B BIRJA · FAKTURA · ISH TURI
--   t2_skladga_yozish · trg_t2_akt_qator_sklad(_bekor)
--   t2_korzinkaga_tashlash/tiklash/butunlay_ochirish/korzinka_ol
--   t2_birja_rfq_yarat · t2_birja_taklif_ber
--   t2_faktura_yoz · t2_ish_turi_yoz
-- ══════════════════════════════════════════════════════════════════
--
-- Claude tomonidan 2026-08-27 da Antigravity'ning `06/07/08/09` loyiha
-- fayllari o'rniga TO'LIQ qayta yozildi — topilgan muammolar
-- MULOQOT.md da hujjatlashtirilgan (`$$` chegaralovchisi yo'qligi,
-- sxema nomuvofiqligi, `tur='mat'` o'rniga `kat='МАТ'` bo'lishi kerakligi,
-- fakt/f2 ikki marta yechish xavfi, kompaniya-scoping teshigi,
-- qator qulflanmagan race condition, t2_qator_holat buzilgan ustunlar).
--
-- ⚠️ FAQAT SINOV OBYEKTIDA (id=2). Oxirida tozalaydi.

do $$
declare
  v_r jsonb; v_ok int := 0; v_x int := 0;
  v_harakat_id bigint; v_akt_id bigint; v_rfq_id bigint;
  v_qator_id bigint; v_qoldiq numeric;
  v_opid uuid;
begin
  -- ── 1. Sinov uchun МАТ qator topamiz ─────────────────────────────
  select id into v_qator_id from t2_qator where obyekt_id = 2 and kat = 'МАТ' limit 1;
  if v_qator_id is null then
    raise exception 'Sinov uchun МАТ qator topilmadi — testni davom ettirib bo''lmaydi';
  end if;

  -- ── 2. Skladga prixod: idempotentlik ──────────────────────────────
  v_opid := gen_random_uuid();
  v_r := t2_skladga_yozish(1,'prixod',2,'mat','2026-08-27'::date,
    '__SINOV__SKLAD','кг',100,null,null,null,'sinov',v_opid,'sinov','sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_harakat_id := (v_r->>'harakat_id')::bigint;
         raise notice 'OK 1 prixod yozildi (id=%)', v_harakat_id;
    else v_x := v_x+1; raise warning 'XATO 1 %', v_r; end if;

  v_r := t2_skladga_yozish(1,'prixod',2,'mat','2026-08-27'::date,
    '__SINOV__SKLAD','кг',100,null,null,null,'sinov',v_opid,'sinov','sinov');
  if (v_r->>'ok') = 'true' and (v_r->>'takror') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 2 idempotentlik ishladi';
    else v_x := v_x+1; raise warning 'XATO 2 %', v_r; end if;

  -- ── 3. Manfiy qoldiqqa yo'l qo'yilmasin ──────────────────────────
  v_r := t2_skladga_yozish(1,'rasxod',2,'mat','2026-08-27'::date,
    '__SINOV__SKLAD','кг',1000,null,null,null,'sinov',gen_random_uuid(),'sinov','sinov');
  if (v_r->>'ok') = 'false'
    then v_ok := v_ok+1; raise notice 'OK 3 yetarsiz qoldiq rad etildi';
    else v_x := v_x+1; raise warning 'XATO 3 %', v_r; end if;

  -- ── 4. F2 (fakt) — trigger sklad yechishi kerak (МАТ qator) ──────
  select qoldiq into v_qoldiq from t2_sklad_qoldiq
    where obyekt_id=2 and nomi=(select nom from t2_qator where id=v_qator_id);
  v_r := t2_akt_yarat(2,'fakt', '2030-01-01'::date,
    jsonb_build_array(jsonb_build_object('qator_id',v_qator_id,'hajm',0.001)),
    null, gen_random_uuid(),'sinov', null, true);
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_akt_id := (v_r->>'akt_id')::bigint;
         raise notice 'OK 4 fakt akt yaratildi (id=%)', v_akt_id;
    else v_x := v_x+1; raise warning 'XATO 4 %', v_r; end if;

  if exists (select 1 from t2_sklad_harakat where obyekt_id=2
             and nomi=(select nom from t2_qator where id=v_qator_id)
             and izoh like 'F2 Akt id=' || v_akt_id || '%')
    then v_ok := v_ok+1; raise notice 'OK 5 trigger sklad harakat yozdi';
    else v_x := v_x+1; raise warning 'XATO 5 trigger ishlamadi'; end if;

  -- ── 6. Faktani bekor qilish — sklad qaytishi kerak ────────────────
  delete from t2_akt_qator where akt_id = v_akt_id;  -- trigger DELETE ni ushlaydi
  if exists (select 1 from t2_sklad_harakat where obyekt_id=2
             and nomi=(select nom from t2_qator where id=v_qator_id)
             and izoh like '%bekor qilingani uchun qaytdi%')
    then v_ok := v_ok+1; raise notice 'OK 6 bekor trigger qoldiqni qaytardi';
    else v_x := v_x+1; raise warning 'XATO 6 bekor trigger ishlamadi'; end if;
  delete from t2_akt where id = v_akt_id;

  -- ── 7. Korzinka: tashlash → qoldiq teskari, tiklash → qoldiq qayta ──
  v_r := t2_korzinkaga_tashlash('t2_sklad_harakat', v_harakat_id, 'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 7 korzinkaga tashlandi';
    else v_x := v_x+1; raise warning 'XATO 7 %', v_r; end if;

  select qoldiq into v_qoldiq from t2_sklad_qoldiq where nomi='__SINOV__SKLAD';
  if v_qoldiq = 0
    then v_ok := v_ok+1; raise notice 'OK 8 korzinkaga tashlash qoldiqni teskari qildi (0)';
    else v_x := v_x+1; raise warning 'XATO 8 qoldiq=%', v_qoldiq; end if;

  v_r := t2_korzinkadan_tiklash('t2_sklad_harakat', v_harakat_id, 'sinov');
  select qoldiq into v_qoldiq from t2_sklad_qoldiq where nomi='__SINOV__SKLAD';
  if (v_r->>'ok') = 'true' and v_qoldiq = 100
    then v_ok := v_ok+1; raise notice 'OK 9 tiklash qoldiqni qayta qo''ydi (100)';
    else v_x := v_x+1; raise warning 'XATO 9 tiklash: r=% qoldiq=%', v_r, v_qoldiq; end if;

  -- ── 10. Butunlay o'chirish faqat bekor holatida ────────────────────
  v_r := t2_butunlay_ochirish('t2_sklad_harakat', v_harakat_id, 'sinov');
  if (v_r->>'ok') = 'false'
    then v_ok := v_ok+1; raise notice 'OK 10 faol harakat butunlay o''chirilmadi (himoya ishladi)';
    else v_x := v_x+1; raise warning 'XATO 10 %', v_r; end if;

  -- ── 11. B2B Birja: RFQ + taklif ────────────────────────────────────
  v_r := t2_birja_rfq_yarat(1,'__SINOV__RFQ','кг',50,'sinov','ochiq',gen_random_uuid(),'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; v_rfq_id := (v_r->>'id')::bigint;
    else v_x := v_x+1; raise warning 'XATO 11 %', v_r; end if;

  v_r := t2_birja_taklif_ber(v_rfq_id,1,25000,'sinov',gen_random_uuid(),'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 12 taklif berildi';
    else v_x := v_x+1; raise warning 'XATO 12 %', v_r; end if;

  -- ── 13. Faktura: kompaniya-scoped update ────────────────────────────
  v_r := t2_faktura_yoz(1,'__SINOV__FAKT-1','2026-08-27'::date,'Sinov MChJ','111222333',
    500000,'yangi','[]'::jsonb,null,null,gen_random_uuid(),'sinov');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1;
    else v_x := v_x+1; raise warning 'XATO 13 %', v_r; end if;

  v_r := t2_faktura_yoz(999,'x','2026-08-27'::date,'x','x',1,'yangi','[]'::jsonb,
    (v_r->>'id')::bigint);
  if (v_r->>'ok') = 'false'
    then v_ok := v_ok+1; raise notice 'OK 14 boshqa kompaniya fakturasini o''zgartira olmadi';
    else v_x := v_x+1; raise warning 'XATO 14 kompaniya himoyasi teshildi: %', v_r; end if;

  -- ── 15. Ish turi ────────────────────────────────────────────────────
  v_r := t2_ish_turi_yoz(1,'__SINOV__001','Sinov ish','м2',1,50000,'ЧЕЛ');
  if (v_r->>'ok') = 'true'
    then v_ok := v_ok+1; raise notice 'OK 15 ish turi yozildi';
    else v_x := v_x+1; raise warning 'XATO 15 %', v_r; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  delete from t2_sklad_harakat where nomi = '__SINOV__SKLAD';
  delete from t2_sklad_qoldiq where nomi = '__SINOV__SKLAD';
  delete from t2_birja_taklif where rfq_id = v_rfq_id;
  delete from t2_birja_rfq where id = v_rfq_id;
  delete from t2_faktura where raqam = '__SINOV__FAKT-1';
  delete from t2_ish_turi where kod = '__SINOV__001';

  if not exists (select 1 from t2_sklad_qoldiq where nomi='__SINOV__SKLAD')
    then v_ok := v_ok+1; raise notice 'OK 16 tozalandi';
    else v_x := v_x+1; raise warning 'XATO 16 tozalanmadi'; end if;

  raise notice '==== % otdi, % yiqildi ====', v_ok, v_x;
  if v_x > 0 then raise exception 'SKLAD/KORZINKA/BIRJA/FAKTURA QABUL TESTI YIQILDI: % ta xato', v_x; end if;
end $$;
