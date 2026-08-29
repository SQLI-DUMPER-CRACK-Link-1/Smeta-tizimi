-- Entity/participant command reconciliation (forward-only, additive).
--
-- The live baseline already owns t2_loyiha, t2_kontragent and
-- t2_loyiha_qatnashchi. This migration does not create an edge table or
-- change IDs. It adds one canonical, tenant-aware participant command and
-- routes the existing mindmap participant relation through it.

create or replace function public.t2_loyiha_qatnashchi_biriktir_v2(
  p_kompaniya_id bigint,
  p_actor_id bigint,
  p_loyiha_id bigint,
  p_taraf_kompaniya_id bigint,
  p_kontragent_id bigint,
  p_rol text,
  p_kutilgan_versiya integer,
  p_operation_id uuid,
  p_izoh text default null,
  p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_actor_rol text;
  v_old jsonb;
  v_loyiha_versiya integer;
  v_id bigint;
  v_relation_versiya integer;
  v_result jsonb;
begin
  v_actor_rol := t2_mindmap_actor_tekshir(p_kompaniya_id, p_actor_id);
  if p_loyiha_id is null or p_loyiha_id <= 0 then
    raise exception 'loyiha_id majburiy' using errcode = '22023';
  end if;
  if p_kutilgan_versiya is null or p_kutilgan_versiya < 1 then
    raise exception 'kutilgan_versiya majburiy' using errcode = '22023';
  end if;
  if p_operation_id is null then
    raise exception 'operation_id majburiy' using errcode = '22023';
  end if;
  if p_rol is null or p_rol not in ('zakazchik','bosh_pudratchi','subpudratchi','loyihachi','taminotchi') then
    raise exception 'ruxsat etilmagan loyiha qatnashchi roli: %', p_rol using errcode = '22023';
  end if;
  if (p_taraf_kompaniya_id is null) = (p_kontragent_id is null) then
    raise exception 'aynan bitta taraf kerak: kompaniya yoki kontragent' using errcode = '22023';
  end if;

  -- p_kompaniya_id is always the tenant. It is never written as the party
  -- company when the party is an external kontragent.
  if p_taraf_kompaniya_id is not null then
    if p_taraf_kompaniya_id <> p_kompaniya_id then
      raise exception 'ichki taraf loyiha tenantidan boshqa kompaniya bo''lishi mumkin emas' using errcode = '42501';
    end if;
    if not exists (select 1 from t2_kompaniya k where k.id = p_taraf_kompaniya_id and k.faol is true) then
      raise exception 'taraf kompaniya topilmadi yoki faol emas' using errcode = '42501';
    end if;
  else
    if not exists (select 1 from t2_kontragent k
                    where k.id = p_kontragent_id
                      and k.kompaniya_id = p_kompaniya_id
                      and k.holat = 'faol') then
      raise exception 'kontragent boshqa tenantga tegishli yoki faol emas' using errcode = '42501';
    end if;
  end if;

  v_old := t2_mindmap_command_boshlash(
    p_kompaniya_id, p_operation_id, 'bog', p_actor_id,
    jsonb_build_object('tur','qatnashchi','loyiha_id',p_loyiha_id,
      'taraf_kompaniya_id',p_taraf_kompaniya_id,'kontragent_id',p_kontragent_id,
      'rol',p_rol,'kutilgan_versiya',p_kutilgan_versiya)
  );
  if v_old is not null then return v_old; end if;

  select l.versiya into v_loyiha_versiya
    from t2_loyiha l
   where l.id = p_loyiha_id and l.kompaniya_id = p_kompaniya_id and l.holat = 'faol'
   for update;
  if not found then raise exception 'loyiha boshqa tenantga tegishli yoki faol emas' using errcode = '42501'; end if;
  if v_loyiha_versiya <> p_kutilgan_versiya then
    raise exception 'loyiha versiyasi ziddiyatda' using errcode = '40001';
  end if;

  if p_taraf_kompaniya_id is not null then
    select q.id, q.versiya into v_id, v_relation_versiya
      from t2_loyiha_qatnashchi q
     where q.loyiha_id = p_loyiha_id and q.kompaniya_id = p_taraf_kompaniya_id
       and q.kontragent_id is null and q.rol = p_rol
     order by q.id desc limit 1 for update;
  else
    select q.id, q.versiya into v_id, v_relation_versiya
      from t2_loyiha_qatnashchi q
     where q.loyiha_id = p_loyiha_id and q.kontragent_id = p_kontragent_id
       and q.kompaniya_id is null and q.rol = p_rol
     order by q.id desc limit 1 for update;
  end if;

  if v_id is null then
    insert into t2_loyiha_qatnashchi
      (loyiha_id, kompaniya_id, kontragent_id, rol, izoh, holat, versiya)
    values
      (p_loyiha_id, p_taraf_kompaniya_id, p_kontragent_id, p_rol, p_izoh, 'faol', 1)
    returning id, versiya into v_id, v_relation_versiya;
  else
    update t2_loyiha_qatnashchi
       set holat = 'faol', izoh = coalesce(p_izoh, izoh), versiya = versiya + 1
     where id = v_id
     returning versiya into v_relation_versiya;
  end if;

  update t2_loyiha set versiya = versiya + 1
   where id = p_loyiha_id and versiya = p_kutilgan_versiya;
  if not found then raise exception 'loyiha versiyasi ziddiyatda' using errcode = '40001'; end if;

  perform t2_audit_yoz(p_kompaniya_id, 'loyiha_qatnashchi_biriktirildi', 'loyiha', p_loyiha_id,
    format('actor_id=%s; rol=%s; relation_id=%s',p_actor_id,p_rol,v_id),
    coalesce(p_actor_label,'actor:'||p_actor_id), null);
  v_result := jsonb_build_object('ok',true,'entity_type','qatnashchi','entity_id',v_id,
    'id',v_id,'loyiha_id',p_loyiha_id,'version',v_relation_versiya,
    'loyiha_version',p_kutilgan_versiya + 1);
  return t2_mindmap_command_yakunla(p_kompaniya_id, p_operation_id, v_result);
end;
$function$;

create or replace function public.t2_loyiha_qatnashchi_ochir_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_id bigint,
  p_kutilgan_versiya integer, p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_actor_rol text; v_old jsonb; v_loyiha_id bigint; v_loyiha_versiya integer;
  v_result jsonb;
begin
  v_actor_rol := t2_mindmap_actor_tekshir(p_kompaniya_id, p_actor_id);
  if p_id is null or p_id <= 0 or p_kutilgan_versiya is null or p_kutilgan_versiya < 1 or p_operation_id is null then
    raise exception 'id, kutilgan_versiya va operation_id majburiy' using errcode = '22023';
  end if;
  v_old := t2_mindmap_command_boshlash(p_kompaniya_id, p_operation_id, 'bog_ochir', p_actor_id,
    jsonb_build_object('tur','qatnashchi','id',p_id,'kutilgan_versiya',p_kutilgan_versiya));
  if v_old is not null then return v_old; end if;
  select q.loyiha_id into v_loyiha_id
    from t2_loyiha_qatnashchi q join t2_loyiha l on l.id=q.loyiha_id
   where q.id=p_id and q.holat='faol' and l.kompaniya_id=p_kompaniya_id and l.holat='faol';
  if not found then raise exception 'qatnashchi boshqa tenantga tegishli yoki faol emas' using errcode='42501'; end if;
  select l.versiya into v_loyiha_versiya from t2_loyiha l where l.id=v_loyiha_id for update;
  if v_loyiha_versiya <> p_kutilgan_versiya then raise exception 'loyiha versiyasi ziddiyatda' using errcode='40001'; end if;
  update t2_loyiha_qatnashchi set holat='bekor', versiya=versiya+1 where id=p_id and holat='faol';
  if not found then raise exception 'faol qatnashchi topilmadi' using errcode='P0002'; end if;
  update t2_loyiha set versiya=versiya+1 where id=v_loyiha_id and versiya=p_kutilgan_versiya;
  if not found then raise exception 'loyiha versiyasi ziddiyatda' using errcode='40001'; end if;
  perform t2_audit_yoz(p_kompaniya_id,'loyiha_qatnashchi_uzildi','loyiha',v_loyiha_id,
    format('actor_id=%s; relation_id=%s',p_actor_id,p_id),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'entity_type','qatnashchi','entity_id',p_id,'id',p_id,'soft',true,'loyiha_version',p_kutilgan_versiya+1);
  return t2_mindmap_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

do $rename$
begin
  if to_regprocedure('public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is not null
     and to_regprocedure('public.t2_mindmap_bog_v2_legacy_contract(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is null then
    alter function public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)
      rename to t2_mindmap_bog_v2_legacy_contract;
  end if;
end;
$rename$;

-- A participant relation from the graph is the same command as the module
-- relation. The early return happens before the generic mindmap command ledger
-- is opened, so one operation_id has exactly one receipt.
create or replace function public.t2_mindmap_bog_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_manba_id bigint,
  p_maqsad_id bigint, p_rol text, p_kutilgan_versiya integer,
  p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
begin
  if p_tur = 'qatnashchi' then
    return t2_loyiha_qatnashchi_biriktir_v2(
      p_kompaniya_id,p_actor_id,p_maqsad_id,null,p_manba_id,p_rol,
      p_kutilgan_versiya,p_operation_id,null,p_actor_label);
  end if;
  return public.t2_mindmap_bog_v2_legacy_contract(
    p_kompaniya_id,p_actor_id,p_tur,p_manba_id,p_maqsad_id,p_rol,
    p_kutilgan_versiya,p_operation_id,p_actor_label);
end;
$function$;

do $rename$
begin
  if to_regprocedure('public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is not null
     and to_regprocedure('public.t2_mindmap_bog_ochir_v2_legacy_contract(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)') is null then
    alter function public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text)
      rename to t2_mindmap_bog_ochir_v2_legacy_contract;
  end if;
end;
$rename$;

create or replace function public.t2_mindmap_bog_ochir_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_manba_id bigint,
  p_maqsad_id bigint, p_rol text, p_kutilgan_versiya integer,
  p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_relation_id bigint;
begin
  if p_tur = 'qatnashchi' then
    select q.id into v_relation_id
      from t2_loyiha_qatnashchi q
     where q.loyiha_id=p_maqsad_id and q.kontragent_id=p_manba_id
       and q.kompaniya_id is null and q.rol=p_rol and q.holat='faol'
     order by q.id desc limit 1;
    if v_relation_id is null then
      raise exception 'faol qatnashchi boglanishi topilmadi' using errcode='P0002';
    end if;
    return t2_loyiha_qatnashchi_ochir_v2(
      p_kompaniya_id,p_actor_id,v_relation_id,p_kutilgan_versiya,p_operation_id,p_actor_label);
  end if;
  return public.t2_mindmap_bog_ochir_v2_legacy_contract(
    p_kompaniya_id,p_actor_id,p_tur,p_manba_id,p_maqsad_id,p_rol,
    p_kutilgan_versiya,p_operation_id,p_actor_label);
end;
$function$;

revoke all on function public.t2_loyiha_qatnashchi_biriktir_v2(bigint,bigint,bigint,bigint,bigint,text,integer,uuid,text,text) from public, anon, authenticated;
revoke all on function public.t2_loyiha_qatnashchi_ochir_v2(bigint,bigint,bigint,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.t2_loyiha_qatnashchi_biriktir_v2(bigint,bigint,bigint,bigint,bigint,text,integer,uuid,text,text) to service_role;
grant execute on function public.t2_loyiha_qatnashchi_ochir_v2(bigint,bigint,bigint,integer,uuid,text) to service_role;
grant execute on function public.t2_mindmap_bog_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) to service_role;
grant execute on function public.t2_mindmap_bog_ochir_v2(bigint,bigint,text,bigint,bigint,text,integer,uuid,text) to service_role;
