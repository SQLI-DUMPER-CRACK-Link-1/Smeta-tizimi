-- T2-PTO-RES-PRICING-002
-- V1 faqat deterministik kod+nom+birlik mosligini yozadi. Real RES
-- fayllaridagi yozuv farqi uchun V2 PTOning aniq manba satrini tanlashiga
-- ruxsat beradi; hech qachon pozitsiya, o'xshashlik yoki narx bo'yicha
-- taxmin qilmaydi.

begin;

create or replace function public.t2_smeta_narxla_res_v2(
  p_kompaniya_id bigint,
  p_actor_id bigint,
  p_obyekt_id bigint,
  p_operation_id uuid,
  p_narxlar jsonb,
  p_qolda_moslash jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_rol text;
  v_obyekt_kompaniya bigint;
  v_old jsonb;
  v_kiritilgan integer := 0;
  v_yaroqli integer := 0;
  v_ziddiyatli integer := 0;
  v_narxsiz integer := 0;
  v_avto_mos integer := 0;
  v_qolda_mos integer := 0;
  v_yozildi integer := 0;
  v_natija jsonb;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0
     or p_actor_id is null or p_actor_id <= 0
     or p_obyekt_id is null or p_obyekt_id <= 0
     or p_operation_id is null then
    raise exception 'kompaniya, actor, obyekt va operation_id majburiy' using errcode = '22023';
  end if;
  if jsonb_typeof(p_narxlar) <> 'array'
     or jsonb_array_length(p_narxlar) = 0 or jsonb_array_length(p_narxlar) > 10000 then
    raise exception 'p_narxlar 1..10000 qator JSON array bo''lishi shart' using errcode = '22023';
  end if;
  if jsonb_typeof(p_qolda_moslash) <> 'array' or jsonb_array_length(p_qolda_moslash) > 10000 then
    raise exception 'p_qolda_moslash 0..10000 qator JSON array bo''lishi shart' using errcode = '22023';
  end if;

  select o.kompaniya_id into v_obyekt_kompaniya
    from public.t2_obyekt o
   where o.id = p_obyekt_id and o.holat <> 'bekor';
  if not found or v_obyekt_kompaniya <> p_kompaniya_id then
    raise exception 'obyekt boshqa tenantga tegishli yoki faol emas' using errcode = '42501';
  end if;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin', 'superadmin', 'boss', 'director', 'pto') then
    raise exception 'bu rol RES narxlashga ruxsatli emas' using errcode = '42501';
  end if;

  -- Tenant va actor tekshirilgandan keyingina idempotent javob beriladi.
  select natija into v_old from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_old || jsonb_build_object('takror', true); end if;

  if exists (
    select 1 from jsonb_to_recordset(p_narxlar) as x(source_ref text, kod text, nom text, birlik text, narx numeric)
     where coalesce(btrim(x.source_ref), '') = '' or coalesce(btrim(x.nom), '') = ''
        or coalesce(btrim(x.birlik), '') = '' or x.narx is null or x.narx <= 0
  ) or exists (
    select 1 from jsonb_to_recordset(p_narxlar) as x(source_ref text, kod text, nom text, birlik text, narx numeric)
     group by x.source_ref having count(*) <> 1
  ) then
    raise exception 'Har RES qatorida takrorlanmas manba IDsi, nom, birlik va musbat narx bo''lishi shart' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_qolda_moslash) as m(qator_id bigint, source_ref text)
     where m.qator_id is null or m.qator_id <= 0 or coalesce(btrim(m.source_ref), '') = ''
  ) or exists (
    select 1 from jsonb_to_recordset(p_qolda_moslash) as m(qator_id bigint, source_ref text)
     group by m.qator_id having count(*) <> 1
  ) then
    raise exception 'Qo''lda bog''lash qatori bir marta, qator IDsi va manba IDsi bilan berilishi shart' using errcode = '22023';
  end if;

  perform set_config('t2.manba', 'narxlash', true);
  perform set_config('t2.kim', 'actor:' || p_actor_id::text, true);

  with source_raw as (
    select x.source_ref,
      nullif(regexp_replace(upper(coalesce(x.kod, '')), '[[:space:][:punct:]]', '', 'g'), '') as kod_key,
      public.t2_resurs_nom_kalit(x.nom) as nom_key,
      public.t2_resurs_birlik_kalit(x.birlik) as birlik_key, x.narx
    from jsonb_to_recordset(p_narxlar) as x(source_ref text, kod text, nom text, birlik text, narx numeric)
  ), source_grouped as (
    select kod_key, nom_key, birlik_key, min(narx) as narx, count(distinct narx) as narx_soni
    from source_raw where nom_key <> '' and birlik_key <> '' group by kod_key, nom_key, birlik_key
  )
  select (select count(*) from source_raw),
         (select count(*) from source_grouped where narx_soni = 1),
         (select count(*) from source_grouped where narx_soni <> 1)
    into v_kiritilgan, v_yaroqli, v_ziddiyatli;

  -- Qo'lda bog'lash faqat avtomatik aniq moslik yo'q resursga ruxsatli.
  -- Manba satri aynan yuklangan p_narxlar ichidan kelishi shart.
  with source_raw as (
    select x.source_ref,
      nullif(regexp_replace(upper(coalesce(x.kod, '')), '[[:space:][:punct:]]', '', 'g'), '') as kod_key,
      public.t2_resurs_nom_kalit(x.nom) as nom_key,
      public.t2_resurs_birlik_kalit(x.birlik) as birlik_key, x.narx
    from jsonb_to_recordset(p_narxlar) as x(source_ref text, kod text, nom text, birlik text, narx numeric)
  ), source_grouped as (
    select kod_key, nom_key, birlik_key, min(narx) as narx
    from source_raw where nom_key <> '' and birlik_key <> '' group by kod_key, nom_key, birlik_key having count(distinct narx) = 1
  ), target as (
    select q.id, q.hajm, q.nom, q.birlik, q.kod from public.t2_qator q
     where q.kompaniya_id = p_kompaniya_id and q.obyekt_id = p_obyekt_id
       and q.tur in ('rs', 'mat', 'ob') and (q.narx is null or q.narx = 0)
  ), auto_candidate as (
    select t.id, s.narx from target t join source_grouped s
      on public.t2_resurs_nom_kalit(t.nom) = s.nom_key
     and public.t2_resurs_birlik_kalit(t.birlik) = s.birlik_key
     and (s.kod_key is null or s.kod_key = regexp_replace(upper(coalesce(t.kod, '')), '[[:space:][:punct:]]', '', 'g'))
  ), auto_unique as (
    select id, min(narx) as narx from auto_candidate group by id having count(distinct narx) = 1
  ), manual_raw as (
    select m.qator_id, m.source_ref from jsonb_to_recordset(p_qolda_moslash) as m(qator_id bigint, source_ref text)
  ), manual_valid as (
    select m.qator_id, s.narx from manual_raw m join target t on t.id = m.qator_id
      join source_raw s on s.source_ref = m.source_ref
      left join auto_unique a on a.id = m.qator_id
     where a.id is null
  )
  select (select count(*) from target),
         (select count(*) from auto_unique),
         (select count(*) from manual_valid)
    into v_narxsiz, v_avto_mos, v_qolda_mos;

  if v_qolda_mos <> jsonb_array_length(p_qolda_moslash) then
    raise exception 'Qo''lda bog''lash faqat shu obyektning narxsiz RS/MAT/OB qatori va yuklangan RES manba satri uchun mumkin; avtomatik aniq moslik qayta bog''lanmaydi' using errcode = '22023';
  end if;

  with source_raw as (
    select x.source_ref,
      nullif(regexp_replace(upper(coalesce(x.kod, '')), '[[:space:][:punct:]]', '', 'g'), '') as kod_key,
      public.t2_resurs_nom_kalit(x.nom) as nom_key,
      public.t2_resurs_birlik_kalit(x.birlik) as birlik_key, x.narx
    from jsonb_to_recordset(p_narxlar) as x(source_ref text, kod text, nom text, birlik text, narx numeric)
  ), source_grouped as (
    select kod_key, nom_key, birlik_key, min(narx) as narx
    from source_raw where nom_key <> '' and birlik_key <> '' group by kod_key, nom_key, birlik_key having count(distinct narx) = 1
  ), target as (
    select q.id, q.hajm, q.nom, q.birlik, q.kod from public.t2_qator q
     where q.kompaniya_id = p_kompaniya_id and q.obyekt_id = p_obyekt_id
       and q.tur in ('rs', 'mat', 'ob') and (q.narx is null or q.narx = 0)
  ), auto_candidate as (
    select t.id, s.narx from target t join source_grouped s
      on public.t2_resurs_nom_kalit(t.nom) = s.nom_key
     and public.t2_resurs_birlik_kalit(t.birlik) = s.birlik_key
     and (s.kod_key is null or s.kod_key = regexp_replace(upper(coalesce(t.kod, '')), '[[:space:][:punct:]]', '', 'g'))
  ), auto_unique as (
    select id, min(narx) as narx from auto_candidate group by id having count(distinct narx) = 1
  ), manual_raw as (
    select m.qator_id, m.source_ref from jsonb_to_recordset(p_qolda_moslash) as m(qator_id bigint, source_ref text)
  ), manual_updates as (
    select m.qator_id as id, s.narx from manual_raw m join source_raw s on s.source_ref = m.source_ref
  ), all_updates as (
    select id, narx from manual_updates
    union all
    select a.id, a.narx from auto_unique a where not exists (select 1 from manual_updates m where m.id = a.id)
  ), updated as (
    update public.t2_qator q set narx = u.narx,
      summa = case when q.hajm is null then null else q.hajm * u.narx end,
      narx_usul = 'RES'
    from all_updates u where q.id = u.id and (q.narx is null or q.narx = 0)
    returning q.id
  ) select count(*) into v_yozildi from updated;

  perform public.t2_rollup(p_obyekt_id);
  if v_narxsiz < 5000 then perform public.t2_signal_refresh_object(p_kompaniya_id, p_obyekt_id); end if;
  v_natija := jsonb_build_object(
    'ok', true, 'takror', false, 'obyekt_id', p_obyekt_id,
    'kiritilgan', v_kiritilgan, 'yaroqli_manba', v_yaroqli, 'ziddiyatli_manba', v_ziddiyatli,
    'narxsiz', v_narxsiz, 'avto_mos', v_avto_mos, 'qolda_mos', v_qolda_mos,
    'mos', v_avto_mos + v_qolda_mos, 'yozildi', v_yozildi,
    'narxsiz_qoldi', greatest(v_narxsiz - v_yozildi, 0)
  );
  insert into public.t2_onboarding_command_log(operation_id, actor_id, command, natija)
  values (p_operation_id, p_actor_id, 't2_smeta_narxla_res_v2', v_natija);
  perform public.t2_audit_yoz(p_kompaniya_id, 'smeta_narxla_res', 'smeta', p_obyekt_id,
    format('RES qator=%s; avtomatik=%s; qolda=%s; yozildi=%s', v_kiritilgan, v_avto_mos, v_qolda_mos, v_yozildi),
    'actor:' || p_actor_id::text, null);
  return v_natija;
end;
$function$;

revoke all on function public.t2_smeta_narxla_res_v2(bigint, bigint, bigint, uuid, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.t2_smeta_narxla_res_v2(bigint, bigint, bigint, uuid, jsonb, jsonb) to service_role;

commit;
