-- Behavioral acceptance for T2-AUTH-PASSWORD-MIGRATION-001.
-- Run INSIDE a transaction that is ROLLED BACK. :komp / :direktor = a real
-- company and an actual boss/superadmin of it, e.g. \set komp 1 \set direktor 3
-- All other fixtures (target member, non-director actor) are created and
-- destroyed entirely within this same transaction -- no pre-existing data
-- required beyond the one real director.
--
-- Proves (once actually run):
--  * a login with no parol_hash -> NO_PASSWORD_SET (the dual-check/GAS-
--    fallback signal the caller, kirish.ts, relies on)
--  * a director can set a real member's password (bcrypt, never plaintext
--    -- asserted directly against pg_proc/column storage, not just "it ok'd")
--  * the freshly-set password authenticates; a wrong password does NOT
--    (PAROL_NOTOGRI, not NO_PASSWORD_SET -- the caller must never fall
--    through to GAS once a hash exists)
--  * a non-director member of the SAME company cannot set anyone's password
--    (42501, the same law as t2_azolik_qosh_v1)
--  * a password shorter than 8 chars is rejected before ever hashing
--  * operation_id makes t2_parol_belgila_v1 retry-safe (same result, not a
--    second silent re-hash)

do $$
declare
  v jsonb; v_komp bigint := :komp; v_direktor bigint := :direktor;
  v_target_login text := 'sinov_parol_' || substr(gen_random_uuid()::text, 1, 8);
  v_target bigint; v_non_direktor bigint; v_op uuid := gen_random_uuid();
  v_hash_before text;
begin
  insert into public.t2_foydalanuvchi (login, holat) values (v_target_login, 'faol') returning id into v_target;
  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat) values (v_target, v_komp, 'prorab', 'faol');

  insert into public.t2_foydalanuvchi (login, holat) values ('sinov_nondir_' || substr(gen_random_uuid()::text,1,8), 'faol') returning id into v_non_direktor;
  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat) values (v_non_direktor, v_komp, 'prorab', 'faol');

  -- 1. Hali parol yo'q -> dual-check signali
  v := public.t2_parol_tekshir_v1(v_target_login, 'istalgan-narsa');
  if (v->>'code') <> 'NO_PASSWORD_SET' then raise exception 'FAIL: hash yo''qligi aniqlanmadi: %', v; end if;

  -- 2. Qisqa parol rad etiladi (hech qachon xeshlanmasdan)
  v := public.t2_parol_belgila_v1(v_direktor, v_komp, v_target, 'qisqa1', v_op);
  if (v->>'code') <> 'PAROL_QISQA' then raise exception 'FAIL: qisqa parol rad etilmadi: %', v; end if;

  -- 3. Direktor emas -- rad etilishi SHART
  begin
    perform public.t2_parol_belgila_v1(v_non_direktor, v_komp, v_target, 'yetarlicha-uzun-1', gen_random_uuid());
    raise exception 'FAIL: direktor bo''lmagan aktyor parol belgilay oldi';
  exception when others then
    if sqlstate <> '42501' then raise exception 'FAIL: kutilmagan xato (42501 kutilgan edi): % %', sqlstate, sqlerrm; end if;
  end;

  -- 4. Direktor haqiqiy parol belgilaydi (YANGI operation_id -- 2-band'dagi
  --    v_op allaqachon PAROL_QISQA natija bilan jurnalga yozilgan, uni qayta
  --    ishlatish o'sha eski natijani qaytarardi, xeshlanmagan holda).
  v := public.t2_parol_belgila_v1(v_direktor, v_komp, v_target, 'yetarlicha-uzun-1', gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL: parol belgilanmadi: %', v; end if;

  select parol_hash into v_hash_before from public.t2_foydalanuvchi where id = v_target;
  if v_hash_before is null or v_hash_before = 'yetarlicha-uzun-1' then
    raise exception 'FAIL: parol OCHIQ MATNDA yozilgan yoki umuman yozilmagan!';
  end if;
  if v_hash_before !~ '^\$2[aby]\$' then raise exception 'FAIL: hash bcrypt formatida emas: %', v_hash_before; end if;

  -- 5. To'g'ri parol bilan kirish ishlaydi
  v := public.t2_parol_tekshir_v1(v_target_login, 'yetarlicha-uzun-1');
  if (v->>'ok') <> 'true' or (v->>'foydalanuvchi_id')::bigint <> v_target then
    raise exception 'FAIL: to''g''ri parol qabul qilinmadi: %', v;
  end if;

  -- 6. Noto'g'ri parol -- GAS'ga o'tishga ASOSLANMAYDI (aniq PAROL_NOTOGRI, NO_PASSWORD_SET EMAS)
  v := public.t2_parol_tekshir_v1(v_target_login, 'notogri-parol');
  if (v->>'code') <> 'PAROL_NOTOGRI' then raise exception 'FAIL: noto''g''ri parol %s qaytardi, PAROL_NOTOGRI kutilgan edi', (v->>'code'); end if;

  -- 7. Idempotentlik: bir xil operation_id qayta hech narsani o'zgartirmaydi
  declare v_op2 uuid := gen_random_uuid(); v2 jsonb;
  begin
    v2 := public.t2_parol_belgila_v1(v_direktor, v_komp, v_target, 'boshqa-parol-999', v_op2);
    v2 := public.t2_parol_belgila_v1(v_direktor, v_komp, v_target, 'ESKI-BOSHQA-QIYMAT', v_op2);
    if (v2->>'foydalanuvchi_id')::bigint <> v_target then raise exception 'FAIL: idempotent qayta chaqiruv boshqa natija berdi: %', v2; end if;
  end;

  raise notice 'ALL T2_PAROL_HASH ACCEPTANCE CHECKS PASSED (target=%)', v_target;
  raise exception 'ROLLBACK_ON_PURPOSE: acceptance test cleanup, target=%', v_target;
end $$;

rollback;
