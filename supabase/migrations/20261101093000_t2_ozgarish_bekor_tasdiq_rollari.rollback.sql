-- ROLLBACK T2_OZGARISH_BEKOR_TASDIQ_ROLLARI — rol sharti avvalgi holatga (boss/superadmin/rahbar).
begin;
do $$
declare d text; eski text := 'if v_rol not in (''boss'',''superadmin'',''rahbar'') then';
  yangi text := 'if coalesce(btrim(o.sabab), '''') = '''' and o.tur = ''olib_tashlash'' then'
    || E'\n    return jsonb_build_object(''ok'',false,''code'',''SABAB_MAJBURIY'',''xabar'',''Bekor qilish / bajarilmaydigan ish uchun sabab majburiy'');'
    || E'\n  end if;'
    || E'\n  if v_rol not in (''boss'',''superadmin'',''rahbar'') and not (o.tur = ''olib_tashlash'' and v_rol in (''admin'',''pto'',''prorab'')) then';
begin
  d := pg_get_functiondef('public.t2_smeta_ozgarish_tasdiqlash_v1(bigint,bigint,integer,uuid)'::regprocedure);
  if position(yangi in d) = 0 then raise exception 'YANGI SHART TOPILMADI'; end if;
  execute replace(d, yangi, eski);
end $$;
commit;
