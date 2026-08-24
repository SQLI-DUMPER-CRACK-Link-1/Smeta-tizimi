-- ══════════════════════════════════════════════════════════════════
-- QABUL TESTI: t2_qator_qosh
-- ══════════════════════════════════════════════════════════════════
--
-- Nega .sql fayl: bazadagi qoidalarni Node testi ishga tushira olmaydi.
-- Regex bilan «funksiyada shu satr bormi» deb tekshirish esa yolg'on
-- xotirjamlik beradi — bu loyihada shunday bo'lgan.
-- Shuning uchun qoidalar HAQIQIY chaqiruv bilan sinaladi.
--
-- Ishga tushirish: Supabase SQL editorida yoki
--   mcp execute_sql bilan shu faylning mazmunini yuboring.
--
-- ⚠️ FAQAT SINOV OBYEKTIDA ishlaydi (`__SINOV__zanjir`). Boshqa obyekt
-- topsa — to'xtaydi. Oxirida o'zidan keyin TOZALAYDI va jamini
-- boshlang'ich holatga qaytaradi.

do $$
declare
  v_ob      bigint;
  v_bl      bigint;
  v_rz      bigint;
  v_jami0   numeric;
  v_jami1   numeric;
  v_r       jsonb;
  v_id1     bigint;
  v_xato    int := 0;
  v_ok      int := 0;
begin
  select id into v_ob from t2_obyekt where nom = '__SINOV__zanjir';
  if v_ob is null then
    raise exception 'Sinov obyekti «__SINOV__zanjir» topilmadi — test bajarilmadi';
  end if;

  select id into v_rz from t2_qator
   where obyekt_id = v_ob and tur = 'rz' order by tartib limit 1;
  select id into v_bl from t2_qator
   where obyekt_id = v_ob and tur = 'bl' and hajm is not null order by tartib limit 1;
  if v_rz is null or v_bl is null then
    raise exception 'Sinov obyektida rz yoki hajmli bl yo''q — test bajarilmadi';
  end if;

  select sum(summa) into v_jami0 from t2_qator where obyekt_id = v_ob and tur = 'rz';
  raise notice 'Boshlang''ich jami: %', v_jami0;

  -- ── 1. NORMA ≠ HAJM: rs da hajm = ota.hajm × norma ────────────────
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__NORMA', v_bl, null, 'ЧЕЛ-Ч', 0.5, 1000,
                       null, null, null, '11111111-0000-0000-0000-000000000001');
  v_id1 := (v_r->>'qator_id')::bigint;
  if (v_r->>'hajm')::numeric =
     (select hajm * 0.5 from t2_qator where id = v_bl)
    then v_ok := v_ok + 1; raise notice 'OK  1. hajm = ota.hajm x norma';
    else v_xato := v_xato + 1; raise warning 'XATO 1. hajm: %', v_r->>'hajm'; end if;

  -- ── 2. IDEMPOTENTLIK: ayni operation_id ikkinchi qator yaratmaydi ──
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__NORMA', v_bl, null, 'ЧЕЛ-Ч', 0.5, 1000,
                       null, null, null, '11111111-0000-0000-0000-000000000001');
  if (v_r->>'takror') = 'true' and (v_r->>'qator_id')::bigint = v_id1
    then v_ok := v_ok + 1; raise notice 'OK  2. takroriy so''rov yangi qator yaratmadi';
    else v_xato := v_xato + 1; raise warning 'XATO 2. %', v_r; end if;

  -- ── 3. ПЕРЕРАСЧЁТ: manfiy norma O'TISHI shart ─────────────────────
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__MANFIY', v_bl, null, 'М3', -0.2, 5000,
                       null, null, null, '11111111-0000-0000-0000-000000000002');
  if (v_r->>'ok') = 'true' and (v_r->>'hajm')::numeric < 0
    then v_ok := v_ok + 1; raise notice 'OK  3. manfiy norma o''tdi (hajm %)', v_r->>'hajm';
    else v_xato := v_xato + 1; raise warning 'XATO 3. manfiy bloklandi: %', v_r; end if;

  -- ── 4. NARX O'ZIDAN TO'QILMAYDI ───────────────────────────────────
  v_r := t2_qator_qosh(v_ob, 'mat', '__T__НАРХСИЗ_ЯГОНА_НОМ', v_rz, null, 'ШТ', 7, null,
                       null, null, null, '11111111-0000-0000-0000-000000000003');
  if v_r->'narx' = 'null'::jsonb
    then v_ok := v_ok + 1; raise notice 'OK  4. narx topilmadi -> BO''SH (0 emas)';
    else v_xato := v_xato + 1; raise warning 'XATO 4. narx to''qildi: %', v_r->>'narx'; end if;

  -- ── 5. ЧЕЛ/МАШ BIRLIKDAN — tanlov bosib o'tolmaydi ────────────────
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__КАТ', v_bl, null, 'ЧЕЛ-Ч', 1, 100,
                       null, 'ОБ', null, '11111111-0000-0000-0000-000000000004');
  if (v_r->>'kat') = 'ЧЕЛ'
    then v_ok := v_ok + 1; raise notice 'OK  5. birlik yetakchi (ОБ tanlovi bosib o''tolmadi)';
    else v_xato := v_xato + 1; raise warning 'XATO 5. kat: %', v_r->>'kat'; end if;

  -- ── 6. TUZILISH: bl ostiga bl qo'shib bo'lmaydi ───────────────────
  v_r := t2_qator_qosh(v_ob, 'bl', '__T__НОТУГРИ', v_bl, null, null, 1, null,
                       null, null, null, '11111111-0000-0000-0000-000000000005');
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'tuzilish'
    then v_ok := v_ok + 1; raise notice 'OK  6. tuzilish buzilishi bloklandi';
    else v_xato := v_xato + 1; raise warning 'XATO 6. %', v_r; end if;

  -- ── 7. e_obyom: hajm AYNAN norma ──────────────────────────────────
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__БУТУН', v_bl, null, 'М3', 9, 200,
                       true, null, null, '11111111-0000-0000-0000-000000000006');
  if (v_r->>'hajm')::numeric = 9
    then v_ok := v_ok + 1; raise notice 'OK  7. e_obyom -> hajm ko''paytirilmadi';
    else v_xato := v_xato + 1; raise warning 'XATO 7. hajm: %', v_r->>'hajm'; end if;

  -- ── 8. BEGONA OTA: boshqa obyektning qatoriga ulanmaydi ───────────
  v_r := t2_qator_qosh(v_ob, 'rs', '__T__БЕГОНА',
                       (select id from t2_qator where obyekt_id <> v_ob limit 1),
                       null, 'М3', 1, 10, null, null, null,
                       '11111111-0000-0000-0000-000000000007');
  if (v_r->>'ok') = 'false' and (v_r->>'sabab') = 'ota'
    then v_ok := v_ok + 1; raise notice 'OK  8. begona ota bloklandi';
    else v_xato := v_xato + 1; raise warning 'XATO 8. %', v_r; end if;

  -- ── TOZALASH ──────────────────────────────────────────────────────
  -- ⚠️ Avval bu qatorlar biror AKTda ishlatilmaganini tekshiramiz:
  --    t2_akt_qator -> t2_qator CASCADE, o'chirsak akt qatorlari ham
  --    jimgina ketardi (bu tizimda bir marta bo'lgan).
  if exists (select 1 from t2_akt_qator a
             join t2_qator q on q.id = a.qator_id
             where q.obyekt_id = v_ob and q.nom like '\_\_T\_\_%') then
    raise exception 'Sinov qatorlari aktda ishlatilgan — TOZALANMADI, qo''lda ko''ring';
  end if;
  delete from t2_qator where obyekt_id = v_ob and nom like '\_\_T\_\_%';
  perform t2_rollup(v_ob);
  select sum(summa) into v_jami1 from t2_qator where obyekt_id = v_ob and tur = 'rz';

  if v_jami1 is not distinct from v_jami0
    then v_ok := v_ok + 1; raise notice 'OK  9. jami boshlang''ich holatga qaytdi: %', v_jami1;
    else v_xato := v_xato + 1;
         raise warning 'XATO 9. jami qaytmadi: % -> %', v_jami0, v_jami1; end if;

  raise notice '════ % o''tdi, % yiqildi ════', v_ok, v_xato;
  if v_xato > 0 then raise exception 'QABUL TESTI YIQILDI: % ta xato', v_xato; end if;
end $$;
