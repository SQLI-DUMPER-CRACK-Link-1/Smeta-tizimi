-- T2-PTO-CLOSURE-007: date/market-price import command.
-- Each source row is accounted for explicitly: kirgan = yozildi + tashlandi.

begin;

create or replace function public.t2_narx_sana_qosh(
  p_sana date,
  p_qatorlar jsonb,
  p_manba text default null,
  p_kim text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_kompaniya_id bigint;
  v_rol text;
  v_azolik_soni integer;
  v_kirgan integer := 0;
  v_yozildi integer := 0;
  v_tashlandi integer := 0;
  v_tashlangan jsonb := '[]'::jsonb;
  v_korilgan text[] := array[]::text[];
  v_q jsonb;
  v_tartib integer;
  v_nom text;
  v_birlik text;
  v_nom_key text;
  v_birlik_key text;
  v_kalit text;
  v_narx numeric;
begin
  if p_sana is null then
    return jsonb_build_object('ok', false, 'sabab', 'DATE_REQUIRED');
  end if;
  if jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0 then
    return jsonb_build_object('ok', false, 'sabab', 'ROWS_REQUIRED');
  end if;
  if coalesce(btrim(p_kim), '') = '' then
    return jsonb_build_object('ok', false, 'sabab', 'AUTH_ACTOR_REQUIRED');
  end if;

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

  for v_q, v_tartib in select value, ordinality::integer from jsonb_array_elements(p_qatorlar) with ordinality loop
    v_kirgan := v_kirgan + 1;
    if jsonb_typeof(v_q) <> 'object' then
      v_tashlandi := v_tashlandi + 1;
      v_tashlangan := v_tashlangan || jsonb_build_array(jsonb_build_object('tartib', v_tartib, 'sabab', 'ROW_OBJECT_REQUIRED'));
      continue;
    end if;

    v_nom := btrim(coalesce(v_q->>'nom', ''));
    v_birlik := nullif(btrim(coalesce(v_q->>'birlik', '')), '');
    v_nom_key := upper(regexp_replace(v_nom, '[^[:alnum:]]', '', 'g'));
    v_birlik_key := upper(regexp_replace(coalesce(v_birlik, ''), '[^[:alnum:]]', '', 'g'));
    if v_nom_key = '' then
      v_tashlandi := v_tashlandi + 1;
      v_tashlangan := v_tashlangan || jsonb_build_array(jsonb_build_object('tartib', v_tartib, 'sabab', 'NAME_REQUIRED'));
      continue;
    end if;
    begin
      v_narx := nullif(btrim(v_q->>'narx'), '')::numeric;
    exception when invalid_text_representation then
      v_narx := null;
    end;
    if v_narx is null or v_narx <= 0 then
      v_tashlandi := v_tashlandi + 1;
      v_tashlangan := v_tashlangan || jsonb_build_array(jsonb_build_object('tartib', v_tartib, 'sabab', 'PRICE_REQUIRED'));
      continue;
    end if;

    v_kalit := v_nom_key || '|' || v_birlik_key;
    if v_kalit = any(v_korilgan) then
      v_tashlandi := v_tashlandi + 1;
      v_tashlangan := v_tashlangan || jsonb_build_array(jsonb_build_object('tartib', v_tartib, 'sabab', 'DUPLICATE_INPUT_KEY'));
      continue;
    end if;
    v_korilgan := array_append(v_korilgan, v_kalit);

    /* `nom_key`/`birlik_key` are generated columns in the existing table.
       We still calculate them above for duplicate accounting, but PostgreSQL
       owns their stored value. */
    insert into public.t2_narx_sana
      (kompaniya_id, nom, birlik, sana, narx, manba, izoh, kim)
    values
      (v_kompaniya_id, v_nom, v_birlik, p_sana, v_narx,
       coalesce(nullif(btrim(p_manba), ''), 'frontend'), nullif(btrim(v_q->>'izoh'), ''), nullif(btrim(p_kim), ''))
    on conflict (kompaniya_id, nom_key, birlik_key, sana) do update
      set nom = excluded.nom,
          birlik = excluded.birlik,
          narx = excluded.narx,
          manba = excluded.manba,
          izoh = excluded.izoh,
          kim = excluded.kim;
    v_yozildi := v_yozildi + 1;
  end loop;

  if v_kirgan <> v_yozildi + v_tashlandi then
    raise exception 'narx sana accounting invariant buzildi' using errcode = 'XX000';
  end if;

  perform public.t2_audit_yoz(v_kompaniya_id, 'narx_sana_qosh', 'narx', null,
    format('sana=%s; kirgan=%s; yozildi=%s; tashlandi=%s', p_sana, v_kirgan, v_yozildi, v_tashlandi),
    nullif(btrim(p_kim), ''), null);

  return jsonb_build_object('ok', true, 'kirgan', v_kirgan, 'yozildi', v_yozildi,
    'tashlandi', v_tashlandi, 'kafolat', true, 'tashlangan_qatorlar', v_tashlangan);
end;
$function$;

revoke all on function public.t2_narx_sana_qosh(date, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.t2_narx_sana_qosh(date, jsonb, text, text)
  to service_role;

commit;
