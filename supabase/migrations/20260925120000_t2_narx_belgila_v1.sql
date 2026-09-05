-- T2-PTO-CLOSURE-007: company-scoped manual price registry command.
--
-- The Pages gateway supplies p_kim from the verified session, never from the
-- browser payload.  The current legacy gateway has no company-id parameter for
-- this action.  Therefore this RPC deliberately resolves ONLY a single active
-- membership and fails closed for a multi-company actor instead of guessing a
-- tenant.  The later company-context gateway contract may pass an explicit
-- context; it must not weaken this guard.

begin;

create or replace function public.t2_narx_belgila(
  p_nom text,
  p_birlik text,
  p_narx numeric,
  p_kat text default null,
  p_izoh text default null,
  p_kutilgan_versiya integer default null,
  p_manba text default 'frontend',
  p_kim text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_nom text;
  v_birlik text;
  v_nom_key text;
  v_birlik_key text;
  v_birlik_identity text;
  v_kat text;
  v_kompaniya_id bigint;
  v_rol text;
  v_azolik_soni integer;
  v_narx public.t2_narx%rowtype;
  v_markaz jsonb;
  v_eski_narx numeric;
begin
  v_nom := btrim(coalesce(p_nom, ''));
  v_birlik := nullif(btrim(coalesce(p_birlik, '')), '');
  if v_nom = '' then
    return jsonb_build_object('ok', false, 'sabab', 'NAME_REQUIRED');
  end if;
  if p_narx is null or p_narx <= 0 then
    -- Zero means "free" and must never stand in for an unknown price.
    return jsonb_build_object('ok', false, 'sabab', 'PRICE_REQUIRED');
  end if;
  if coalesce(btrim(p_kim), '') = '' then
    return jsonb_build_object('ok', false, 'sabab', 'AUTH_ACTOR_REQUIRED');
  end if;

  /* Existing imports use upper-case, punctuation-free identity keys. */
  v_nom_key := upper(regexp_replace(v_nom, '[^[:alnum:]]', '', 'g'));
  v_birlik_key := upper(regexp_replace(coalesce(v_birlik, ''), '[^[:alnum:]]', '', 'g'));
  if v_nom_key = '' then
    return jsonb_build_object('ok', false, 'sabab', 'NAME_REQUIRED');
  end if;

  /* The authenticated gateway supplies only p_kim today.  Ambiguity is a
     security failure, never an invitation to update every tenant. */
  select count(*), min(a.kompaniya_id), min(a.rol)
    into v_azolik_soni, v_kompaniya_id, v_rol
  from public.t2_foydalanuvchi f
  join public.t2_azolik a on a.foydalanuvchi_id = f.id and a.holat = 'faol'
  where f.holat = 'faol'
    and (lower(coalesce(f.email, '')) = lower(btrim(p_kim))
      or lower(f.login) = lower(btrim(p_kim)));

  if v_azolik_soni = 0 then
    return jsonb_build_object('ok', false, 'sabab', 'ACTOR_MEMBERSHIP_REQUIRED');
  end if;
  if v_azolik_soni <> 1 then
    return jsonb_build_object('ok', false, 'sabab', 'COMPANY_CONTEXT_REQUIRED');
  end if;
  if v_rol in ('boss', 'rahbar') then
    return jsonb_build_object('ok', false, 'sabab', 'WRITE_FORBIDDEN');
  end if;

  /* ЧЕЛ and МАШ are derived from the unit.  A client may not poison them
     through a category dropdown or an arbitrary resource name. */
  v_birlik_identity := upper(regexp_replace(coalesce(v_birlik, ''), '[^[:alnum:]]', '', 'g'));
  if v_birlik_identity in ('ЧЕЛЧ', 'ЧЕЛСОАТ', 'CHELCH', 'CHELSOAT') then
    v_kat := 'ЧЕЛ';
  elsif v_birlik_identity in ('МАШЧ', 'МАШСОАТ', 'MASHCH', 'MASHSOAT') then
    v_kat := 'МАШ';
  elsif p_kat is null or btrim(p_kat) = '' then
    v_kat := null;
  elsif btrim(p_kat) in ('МАТ', 'ОБ', 'М/К', 'КАБ') then
    v_kat := btrim(p_kat);
  else
    return jsonb_build_object('ok', false, 'sabab', 'CATEGORY_INVALID');
  end if;

  select * into v_narx
    from public.t2_narx
   where kompaniya_id = v_kompaniya_id
     and obyekt_id is null
     and nom_key = v_nom_key
     and birlik_key = v_birlik_key
   for update;

  if found then
    if p_kutilgan_versiya is null then
      return jsonb_build_object('ok', false, 'sabab', 'VERSION_REQUIRED',
        'bordagi_versiya', v_narx.versiya);
    end if;
    if v_narx.versiya <> p_kutilgan_versiya then
      return jsonb_build_object('ok', false, 'sabab', 'STALE_VERSION',
        'bordagi_versiya', v_narx.versiya, 'siz_yuborgan', p_kutilgan_versiya,
        'bordagi_narx', v_narx.narx);
    end if;
    v_eski_narx := v_narx.narx;

    update public.t2_narx
       set narx = p_narx,
           kat = coalesce(v_kat, kat),
           manba = 'registr',
           belgilangan = true,
           izoh = nullif(btrim(p_izoh), ''),
           kim = nullif(btrim(p_kim), ''),
           yangilandi = now()
     where id = v_narx.id
     returning * into v_narx;
  else
    if p_kutilgan_versiya is not null then
      return jsonb_build_object('ok', false, 'sabab', 'PRICE_NOT_FOUND_FOR_VERSION');
    end if;

    insert into public.t2_narx
      (kompaniya_id, obyekt_id, nom_key, birlik_key, nom, birlik, narx, kat,
       manba, belgilangan, shubhali, izoh, kim)
    values
      (v_kompaniya_id, null, v_nom_key, v_birlik_key, v_nom, v_birlik, p_narx, v_kat,
       'registr', true, false, nullif(btrim(p_izoh), ''), nullif(btrim(p_kim), ''))
    returning * into v_narx;
  end if;

  perform public.t2_audit_yoz(v_kompaniya_id, 'narx_belgila', 'narx', null,
    format('narx_id=%s; versiya=%s; manba=%s', v_narx.id, v_narx.versiya, coalesce(nullif(btrim(p_manba), ''), 'frontend')),
    nullif(btrim(p_kim), ''), null);

  select to_jsonb(m) into v_markaz
    from public.t2_narx_markaz m
   where m.kompaniya_id = v_kompaniya_id
     and m.nom_key = v_nom_key
     and m.birlik_key = v_birlik_key;

  return jsonb_build_object('ok', true, 'narx_id', v_narx.id,
    'versiya', v_narx.versiya, 'eski_narx', v_eski_narx,
    'yangi_narx', v_narx.narx, 'markaz', v_markaz);
end;
$function$;

revoke all on function public.t2_narx_belgila(text, text, numeric, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.t2_narx_belgila(text, text, numeric, text, text, integer, text, text)
  to service_role;

commit;
