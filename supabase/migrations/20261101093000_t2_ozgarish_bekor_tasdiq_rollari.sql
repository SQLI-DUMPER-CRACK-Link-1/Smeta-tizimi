-- T2_OZGARISH_BEKOR_TASDIQ_ROLLARI — egasi (2026-09-25): "bekor qilingan /
-- bajarilmaydigan ishni PTO va undan balandlar tasdiqlashi kerak, qurilishga
-- aloqadorlar — prorab ham; sabab bo'lishi shart."
--
-- t2_smeta_ozgarish_tasdiqlash_v1 faqat boss/superadmin/rahbar ga ruxsat berardi.
-- Endi FAQAT tur = 'olib_tashlash' (ostatkadan chiqarish) uchun admin, pto va
-- prorab ham tasdiqlaydi; boshqa o'zgartirish turlari avvalgidek qat'iy.
-- Sabab bo'sh bo'lsa olib_tashlash tasdiqlanmaydi (SABAB_MAJBURIY).
-- Faqat bitta shart qatori almashtiriladi (topilmasa — migratsiya to'xtaydi).
-- Rollback: *.rollback.sql (teskari almashtirish). Prod: version 20260925174902
-- (tranzaksiya testi: prorab+sabab — tasdiqlandi; sabab bo'sh — SABAB_MAJBURIY;
-- prorab + boshqa tur — CHANGE_APPROVAL_DENIED).
begin;
do $$
declare d text; eski text := 'if v_rol not in (''boss'',''superadmin'',''rahbar'') then';
  yangi text := 'if coalesce(btrim(o.sabab), '''') = '''' and o.tur = ''olib_tashlash'' then'
    || E'\n    return jsonb_build_object(''ok'',false,''code'',''SABAB_MAJBURIY'',''xabar'',''Bekor qilish / bajarilmaydigan ish uchun sabab majburiy'');'
    || E'\n  end if;'
    || E'\n  if v_rol not in (''boss'',''superadmin'',''rahbar'') and not (o.tur = ''olib_tashlash'' and v_rol in (''admin'',''pto'',''prorab'')) then';
begin
  d := pg_get_functiondef('public.t2_smeta_ozgarish_tasdiqlash_v1(bigint,bigint,integer,uuid)'::regprocedure);
  if position(eski in d) = 0 then raise exception 'ROL SHARTI TOPILMADI — v1 o''zgargan, migratsiya to''xtatildi'; end if;
  if position('SABAB_MAJBURIY' in d) > 0 then raise notice 'allaqachon qo''llangan'; return; end if;
  execute replace(d, eski, yangi);
end $$;
commit;
