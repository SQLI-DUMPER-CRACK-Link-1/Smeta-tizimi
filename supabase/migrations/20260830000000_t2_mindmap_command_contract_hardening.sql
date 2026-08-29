-- TIZIM_02 forward migration. Do not apply before the live baseline is committed.
-- This adds no universal edge table. Existing domain FK and mapping tables remain authoritative.

create table if not exists public.t2_mindmap_command_reestr (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  operation_id uuid not null,
  amal text not null check (amal in ('bog','bog_ochir','joylashuv','tugun_ochir')),
  actor_id bigint not null,
  request_json jsonb not null,
  result_json jsonb,
  yaratilgan_vaqt timestamptz not null default now(),
  unique (kompaniya_id, operation_id)
);

create or replace function public.t2_mindmap_actor_tekshir(
  p_kompaniya_id bigint,
  p_actor_id bigint
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_rol text;
begin
  if p_kompaniya_id is null or p_kompaniya_id <= 0 then
    raise exception 'kompaniya_id majburiy' using errcode = '22023';
  end if;
  if p_actor_id is null or p_actor_id <= 0 then
    raise exception 'authenticated actor majburiy' using errcode = '22023';
  end if;

  select a.rol into v_rol
    from t2_azolik a
   where a.kompaniya_id = p_kompaniya_id
     and a.foydalanuvchi_id = p_actor_id
     and a.holat = 'faol'
   for share;

  if not found then
    raise exception 'actor bu kompaniyaning faol a’zosi emas'
      using errcode = '42501';
  end if;
  if v_rol in ('boss', 'rahbar') then
    raise exception 'bu rol mindmap mutation qila olmaydi'
      using errcode = '42501';
  end if;
  return v_rol;
end;
$function$;

create or replace function public.t2_mindmap_command_ol(
  p_kompaniya_id bigint,
  p_operation_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
begin
  select result_json into v_result
    from t2_mindmap_command_reestr
   where kompaniya_id = p_kompaniya_id
     and operation_id = p_operation_id;

  if found and v_result is null then
    raise exception 'operation_id hali yakunlanmagan' using errcode = '40001';
  end if;
  return v_result;
end;
$function$;

create or replace function public.t2_mindmap_command_boshlash(
  p_kompaniya_id bigint,
  p_operation_id uuid,
  p_amal text,
  p_actor_id bigint,
  p_request jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_id bigint;
  v_result jsonb;
begin
  if p_operation_id is null then
    raise exception 'operation_id majburiy' using errcode = '22023';
  end if;

  insert into t2_mindmap_command_reestr
    (kompaniya_id, operation_id, amal, actor_id, request_json)
  values
    (p_kompaniya_id, p_operation_id, p_amal, p_actor_id, p_request)
  on conflict (kompaniya_id, operation_id) do nothing
  returning id into v_id;

  if v_id is not null then
    return null;
  end if;

  select result_json into v_result
    from t2_mindmap_command_reestr
   where kompaniya_id = p_kompaniya_id
     and operation_id = p_operation_id
   for share;

  if v_result is null then
    raise exception 'operation_id boshqa transaction tomonidan ishlatilmoqda'
      using errcode = '40001';
  end if;
  return jsonb_build_object('idempotent', true, 'natija', v_result);
end;
$function$;

create or replace function public.t2_mindmap_command_yakunla(
  p_kompaniya_id bigint,
  p_operation_id uuid,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  update t2_mindmap_command_reestr
     set result_json = p_result
   where kompaniya_id = p_kompaniya_id
     and operation_id = p_operation_id
     and result_json is null;

  if not found then
    raise exception 'command reestr yakunlanmadi' using errcode = '40001';
  end if;
  return p_result;
end;
$function$;

create or replace function public.t2_mindmap_bog_v2(
  p_kompaniya_id bigint,
  p_actor_id bigint,
  p_tur text,
  p_manba_id bigint,
  p_maqsad_id bigint,
  p_rol text,
  p_kutilgan_versiya integer,
  p_operation_id uuid,
  p_actor_label text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_rol text;
  v_old jsonb;
  v_current integer;
  v_result jsonb;
  v_same boolean;
  v_rows integer;
begin
  v_rol := t2_mindmap_actor_tekshir(p_kompaniya_id, p_actor_id);
  if p_tur not in ('obyekt_loyiha','shartnoma_loyiha','shartnoma_obyekt',
                   'sklad_obyekt','texnika_obyekt','kadr_obyekt','qatnashchi') then
    raise exception 'ruxsat etilmagan boglanish turi: %', p_tur using errcode = '22023';
  end if;
  if p_manba_id is null or p_manba_id <= 0 or p_maqsad_id is null or p_maqsad_id <= 0 then
    raise exception 'manba_id va maqsad_id musbat bigint bolishi kerak' using errcode = '22023';
  end if;
  if p_kutilgan_versiya is null or p_kutilgan_versiya < 1 then
    raise exception 'kutilgan_versiya majburiy' using errcode = '22023';
  end if;
  if p_tur = 'qatnashchi' and (p_rol is null or p_rol not in ('zakazchik','bosh_pudratchi','subpudratchi','loyihachi','taminotchi')) then
    raise exception 'qatnashchi uchun ruxsat etilgan rol majburiy' using errcode = '22023';
  end if;

  v_old := t2_mindmap_command_boshlash(
    p_kompaniya_id, p_operation_id, 'bog', p_actor_id,
    jsonb_build_object('tur',p_tur,'manba_id',p_manba_id,'maqsad_id',p_maqsad_id,'rol',p_rol,'kutilgan_versiya',p_kutilgan_versiya)
  );
  if v_old is not null then return v_old; end if;

  if p_tur = 'obyekt_loyiha' then
    perform 1 from t2_loyiha where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
    if not found then raise exception 'loyiha boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
    update t2_obyekt set loyiha_id=p_manba_id, versiya=versiya+1
      where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat <> 'bekor' and versiya=p_kutilgan_versiya;
    get diagnostics v_rows = row_count;
  elsif p_tur = 'shartnoma_loyiha' then
    perform 1 from t2_loyiha where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
    if not found then raise exception 'loyiha boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
    update t2_shartnoma set loyiha_id=p_manba_id, versiya=versiya+1
      where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat <> 'bekor' and versiya=p_kutilgan_versiya;
    get diagnostics v_rows = row_count;
  elsif p_tur = 'shartnoma_obyekt' then
    perform 1 from t2_shartnoma where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat <> 'bekor';
    if not found then raise exception 'shartnoma boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
    select versiya into v_current from t2_obyekt where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat <> 'bekor' for update;
    if not found or v_current <> p_kutilgan_versiya then raise exception 'obyekt versiyasi ziddiyatda' using errcode='40001'; end if;
    select exists(select 1 from t2_shartnoma_bog where obyekt_id=p_maqsad_id and shartnoma_id=p_manba_id and holat='faol') into v_same;
    if not v_same and exists(select 1 from t2_shartnoma_bog where obyekt_id=p_maqsad_id and holat='faol') then
      raise exception 'obyekt allaqachon boshqa faol shartnomaga boglangan; avval unlink qiling' using errcode='23505';
    end if;
    if not v_same then
      update t2_shartnoma_bog set holat='faol' where obyekt_id=p_maqsad_id and shartnoma_id=p_manba_id and holat='bekor';
      if not found then insert into t2_shartnoma_bog(obyekt_id,shartnoma_id,holat) values(p_maqsad_id,p_manba_id,'faol'); end if;
      update t2_obyekt set versiya=versiya+1 where id=p_maqsad_id and versiya=p_kutilgan_versiya;
    end if;
  elsif p_tur in ('sklad_obyekt','texnika_obyekt','kadr_obyekt') then
    if p_tur='sklad_obyekt' then perform 1 from t2_sklad_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
    elsif p_tur='texnika_obyekt' then perform 1 from t2_texnika_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
    else perform 1 from t2_kadr_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol'; end if;
    if not found then raise exception 'resurs boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
    select versiya into v_current from t2_obyekt where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat <> 'bekor' for update;
    if not found or v_current <> p_kutilgan_versiya then raise exception 'obyekt versiyasi ziddiyatda' using errcode='40001'; end if;
    if p_tur='sklad_obyekt' then select exists(select 1 from t2_sklad_bog where sklad_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol') into v_same;
    elsif p_tur='texnika_obyekt' then select exists(select 1 from t2_texnika_bog where texnika_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol') into v_same;
    else select exists(select 1 from t2_kadr_bog where kadr_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol') into v_same; end if;
    if not v_same then
      if p_tur='sklad_obyekt' then
        update t2_sklad_bog set holat='faol' where sklad_id=p_manba_id and obyekt_id=p_maqsad_id and holat='bekor';
        if not found then insert into t2_sklad_bog(sklad_id,obyekt_id,holat) values(p_manba_id,p_maqsad_id,'faol'); end if;
      elsif p_tur='texnika_obyekt' then
        update t2_texnika_bog set holat='faol' where texnika_id=p_manba_id and obyekt_id=p_maqsad_id and holat='bekor';
        if not found then insert into t2_texnika_bog(texnika_id,obyekt_id,holat) values(p_manba_id,p_maqsad_id,'faol'); end if;
      else
        update t2_kadr_bog set holat='faol' where kadr_id=p_manba_id and obyekt_id=p_maqsad_id and holat='bekor';
        if not found then insert into t2_kadr_bog(kadr_id,obyekt_id,holat) values(p_manba_id,p_maqsad_id,'faol'); end if;
      end if;
      update t2_obyekt set versiya=versiya+1 where id=p_maqsad_id and versiya=p_kutilgan_versiya;
    end if;
  else
    perform 1 from t2_kontragent where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
    if not found then raise exception 'kontragent boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
    select versiya into v_current from t2_loyiha where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat='faol' for update;
    if not found or v_current <> p_kutilgan_versiya then raise exception 'loyiha versiyasi ziddiyatda' using errcode='40001'; end if;
    update t2_loyiha_qatnashchi set holat='faol', versiya=versiya+1
      where loyiha_id=p_maqsad_id and kontragent_id=p_manba_id and rol=p_rol and holat='bekor';
    if not found and not exists(select 1 from t2_loyiha_qatnashchi where loyiha_id=p_maqsad_id and kontragent_id=p_manba_id and rol=p_rol and holat='faol') then
      insert into t2_loyiha_qatnashchi(loyiha_id,kompaniya_id,kontragent_id,rol,holat,versiya)
      values(p_maqsad_id,p_kompaniya_id,p_manba_id,p_rol,'faol',1);
    end if;
    update t2_loyiha set versiya=versiya+1 where id=p_maqsad_id and versiya=p_kutilgan_versiya;
  end if;

  if p_tur in ('obyekt_loyiha','shartnoma_loyiha') and v_rows <> 1 then
    raise exception 'target topilmadi, boshqa tenantga tegishli yoki versiya ziddiyatda' using errcode='40001';
  end if;

  perform t2_audit_yoz(p_kompaniya_id,'mindmap_boglandi','mindmap',case when p_tur='shartnoma_loyiha' then null else p_maqsad_id end,
    format('actor_id=%s; rol=%s; %s:%s -> %s',p_actor_id,v_rol,p_tur,p_manba_id,p_maqsad_id),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result := jsonb_build_object('ok',true,'tur',p_tur,'manba_id',p_manba_id,'maqsad_id',p_maqsad_id);
  return t2_mindmap_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

-- Unlink is intentionally soft: relationship rows are marked bekor; entities are never deleted.
create or replace function public.t2_mindmap_bog_ochir_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_manba_id bigint,
  p_maqsad_id bigint, p_rol text, p_kutilgan_versiya integer,
  p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_rol text; v_old jsonb; v_current integer; v_result jsonb; v_rows integer;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if p_tur not in ('obyekt_loyiha','shartnoma_loyiha','shartnoma_obyekt','sklad_obyekt','texnika_obyekt','kadr_obyekt','qatnashchi') then raise exception 'ruxsat etilmagan boglanish turi' using errcode='22023'; end if;
  if p_manba_id is null or p_maqsad_id is null or p_kutilgan_versiya is null or p_kutilgan_versiya<1 then raise exception 'ID va kutilgan_versiya majburiy' using errcode='22023'; end if;
  if p_tur='qatnashchi' and (p_rol is null or p_rol not in ('zakazchik','bosh_pudratchi','subpudratchi','loyihachi','taminotchi')) then raise exception 'qatnashchi roli majburiy' using errcode='22023'; end if;
  if p_tur='obyekt_loyiha' then perform 1 from t2_loyiha where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
  elsif p_tur in ('shartnoma_loyiha','shartnoma_obyekt') then perform 1 from t2_shartnoma where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat<>'bekor';
  elsif p_tur='sklad_obyekt' then perform 1 from t2_sklad_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
  elsif p_tur='texnika_obyekt' then perform 1 from t2_texnika_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
  elsif p_tur='kadr_obyekt' then perform 1 from t2_kadr_mustaqil where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol';
  else perform 1 from t2_kontragent where id=p_manba_id and kompaniya_id=p_kompaniya_id and holat='faol'; end if;
  if not found then raise exception 'manba boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
  v_old:=t2_mindmap_command_boshlash(p_kompaniya_id,p_operation_id,'bog_ochir',p_actor_id,jsonb_build_object('tur',p_tur,'manba_id',p_manba_id,'maqsad_id',p_maqsad_id,'rol',p_rol,'kutilgan_versiya',p_kutilgan_versiya));
  if v_old is not null then return v_old; end if;

  if p_tur='obyekt_loyiha' then
    update t2_obyekt set loyiha_id=null,versiya=versiya+1 where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and loyiha_id=p_manba_id and versiya=p_kutilgan_versiya;
    get diagnostics v_rows = row_count;
  elsif p_tur='shartnoma_loyiha' then
    update t2_shartnoma set loyiha_id=null,versiya=versiya+1 where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and loyiha_id=p_manba_id and versiya=p_kutilgan_versiya;
    get diagnostics v_rows = row_count;
  elsif p_tur='qatnashchi' then
    select versiya into v_current from t2_loyiha where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat='faol' for update;
    if not found or v_current<>p_kutilgan_versiya then raise exception 'loyiha versiyasi ziddiyatda yoki tenant boshqa' using errcode='40001'; end if;
    update t2_loyiha_qatnashchi set holat='bekor',versiya=versiya+1 where loyiha_id=p_maqsad_id and kontragent_id=p_manba_id and rol=p_rol and holat='faol';
    if not found then raise exception 'faol qatnashchi boglanishi topilmadi' using errcode='P0002'; end if;
    update t2_loyiha set versiya=versiya+1 where id=p_maqsad_id and versiya=p_kutilgan_versiya;
  else
    select versiya into v_current from t2_obyekt where id=p_maqsad_id and kompaniya_id=p_kompaniya_id and holat<>'bekor' for update;
    if not found or v_current<>p_kutilgan_versiya then raise exception 'obyekt versiyasi ziddiyatda yoki tenant boshqa' using errcode='40001'; end if;
    if p_tur='shartnoma_obyekt' then update t2_shartnoma_bog set holat='bekor' where shartnoma_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol';
    elsif p_tur='sklad_obyekt' then update t2_sklad_bog set holat='bekor' where sklad_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol';
    elsif p_tur='texnika_obyekt' then update t2_texnika_bog set holat='bekor' where texnika_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol';
    else update t2_kadr_bog set holat='bekor' where kadr_id=p_manba_id and obyekt_id=p_maqsad_id and holat='faol'; end if;
    if not found then raise exception 'faol boglanish topilmadi' using errcode='P0002'; end if;
    update t2_obyekt set versiya=versiya+1 where id=p_maqsad_id and versiya=p_kutilgan_versiya;
  end if;
  if p_tur in ('obyekt_loyiha','shartnoma_loyiha') and v_rows <> 1 then raise exception 'boglanish topilmadi, tenant boshqa yoki versiya ziddiyatda' using errcode='40001'; end if;
  perform t2_audit_yoz(p_kompaniya_id,'mindmap_bog_uzildi','mindmap',p_maqsad_id,format('actor_id=%s; rol=%s; %s:%s -/-> %s',p_actor_id,v_rol,p_tur,p_manba_id,p_maqsad_id),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'tur',p_tur,'manba_id',p_manba_id,'maqsad_id',p_maqsad_id,'soft',true);
  return t2_mindmap_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

create or replace function public.t2_mindmap_joylashuv_saqla_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_joylar jsonb, p_operation_id uuid,
  p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_rol text; v_old jsonb; v_j jsonb; v_result jsonb; v_node text;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if jsonb_typeof(p_joylar)<>'array' or jsonb_array_length(p_joylar)=0 or jsonb_array_length(p_joylar)>500 then raise exception 'joylar 1..500 elementli massiv bolishi kerak' using errcode='22023'; end if;
  v_old:=t2_mindmap_command_boshlash(p_kompaniya_id,p_operation_id,'joylashuv',p_actor_id,jsonb_build_object('joylar',p_joylar));
  if v_old is not null then return v_old; end if;
  for v_j in select value from jsonb_array_elements(p_joylar) loop
    v_node:=v_j->>'tugun_id';
    if v_node !~ '^(kompaniya|loyiha|obyekt|shartnoma|sklad|texnika|kadr|kontragent):[0-9]+$'
       or jsonb_typeof(v_j->'x') not in ('number') or jsonb_typeof(v_j->'y') not in ('number') then
      raise exception 'joylashuv elementi yaroqsiz' using errcode='22023';
    end if;
    if not exists(select 1 from jsonb_array_elements(t2_mindmap_grafi(p_kompaniya_id)->'tugunlar') n where n->>'id'=v_node) then
      raise exception 'tugun boshqa tenantga tegishli yoki mavjud emas: %',v_node using errcode='42501';
    end if;
  end loop;
  insert into t2_mindmap_joylashuv(kompaniya_id,tugun_id,x,y)
    select p_kompaniya_id,j->>'tugun_id',(j->>'x')::numeric,(j->>'y')::numeric from jsonb_array_elements(p_joylar) j
  on conflict(kompaniya_id,tugun_id) do update set x=excluded.x,y=excluded.y,yangilandi=now();
  perform t2_audit_yoz(p_kompaniya_id,'mindmap_joylashuv','mindmap',null,format('actor_id=%s; rol=%s; count=%s',p_actor_id,v_rol,jsonb_array_length(p_joylar)),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'saqlandi',jsonb_array_length(p_joylar));
  return t2_mindmap_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

-- Entity soft-delete: no DELETE and no cascading relation deletion.
create or replace function public.t2_mindmap_tugun_ochir_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_id bigint,
  p_kutilgan_versiya integer, p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_rol text; v_old jsonb; v_result jsonb; v_rows integer;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if p_tur not in ('loyiha','shartnoma','sklad','texnika','kadr','kontragent') then
    raise exception 'bu turdagi tugunni mindmapdan ochirib bolmaydi: %',p_tur using errcode='22023';
  end if;
  if p_id is null or p_id<=0 or p_kutilgan_versiya is null or p_kutilgan_versiya<1 then
    raise exception 'id va kutilgan_versiya majburiy' using errcode='22023';
  end if;
  v_old:=t2_mindmap_command_boshlash(p_kompaniya_id,p_operation_id,'tugun_ochir',p_actor_id,jsonb_build_object('tur',p_tur,'id',p_id,'kutilgan_versiya',p_kutilgan_versiya));
  if v_old is not null then return v_old; end if;
  if p_tur='loyiha' then update t2_loyiha set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  elsif p_tur='shartnoma' then update t2_shartnoma set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat<>'bekor' and versiya=p_kutilgan_versiya;
  elsif p_tur='sklad' then update t2_sklad_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  elsif p_tur='texnika' then update t2_texnika_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  elsif p_tur='kadr' then update t2_kadr_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  else update t2_kontragent set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya; end if;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'tugun topilmadi, boshqa tenantga tegishli yoki versiya ziddiyatda' using errcode='40001'; end if;
  perform t2_audit_yoz(p_kompaniya_id,'mindmap_tugun_bekor','mindmap',null,format('actor_id=%s; rol=%s; tur=%s; id=%s',p_actor_id,v_rol,p_tur,p_id),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'tur',p_tur,'id',p_id,'soft',true);
  return t2_mindmap_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

-- V2 functions are gateway-only. Existing V1 RPCs stay untouched until the typed gateway adapter is deployed.
revoke all on function public.t2_mindmap_actor_tekshir(bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_mindmap_command_ol(bigint,uuid) from public, anon, authenticated;
revoke all on function public.t2_mindmap_command_boshlash(bigint,uuid,text,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.t2_mindmap_command_yakunla(bigint,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_mindmap_joylashuv_saqla_v2(bigint,bigint,jsonb,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_mindmap_tugun_ochir_v2(bigint,bigint,text,bigint,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) to service_role;
grant execute on function public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) to service_role;
grant execute on function public.t2_mindmap_joylashuv_saqla_v2(bigint,bigint,jsonb,uuid,text) to service_role;
grant execute on function public.t2_mindmap_tugun_ochir_v2(bigint,bigint,text,bigint,integer,uuid,text) to service_role;

