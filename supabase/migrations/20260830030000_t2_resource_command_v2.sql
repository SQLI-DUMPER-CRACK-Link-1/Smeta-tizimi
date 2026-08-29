-- TIZIM_02 forward-only resource command contract.
-- No entity/edge abstraction is introduced: each branch writes only its
-- canonical domain table.  The command table is an idempotency/audit ledger.

create table if not exists public.t2_resurs_command_reestr (
  id bigint generated always as identity primary key,
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  operation_id uuid not null,
  amal text not null check (amal in ('yarat','yangila','bekor')),
  actor_id bigint not null,
  request_json jsonb not null,
  result_json jsonb,
  yaratilgan_vaqt timestamptz not null default now(),
  unique (kompaniya_id, operation_id)
);

create or replace function public.t2_resurs_command_boshlash(
  p_kompaniya_id bigint, p_operation_id uuid, p_amal text,
  p_actor_id bigint, p_request jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_id bigint; v_result jsonb;
begin
  if p_operation_id is null then raise exception 'operation_id majburiy' using errcode='22023'; end if;
  insert into t2_resurs_command_reestr(kompaniya_id,operation_id,amal,actor_id,request_json)
  values(p_kompaniya_id,p_operation_id,p_amal,p_actor_id,p_request)
  on conflict(kompaniya_id,operation_id) do nothing returning id into v_id;
  if v_id is not null then return null; end if;
  select result_json into v_result from t2_resurs_command_reestr
   where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for share;
  if v_result is null then raise exception 'operation_id boshqa transaction tomonidan ishlatilmoqda' using errcode='40001'; end if;
  return jsonb_build_object('idempotent',true,'natija',v_result);
end;
$function$;

create or replace function public.t2_resurs_command_yakunla(
  p_kompaniya_id bigint, p_operation_id uuid, p_result jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
begin
  update t2_resurs_command_reestr set result_json=p_result
   where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id and result_json is null;
  if not found then raise exception 'resource command reestr yakunlanmadi' using errcode='40001'; end if;
  return p_result;
end;
$function$;

create or replace function public.t2_resurs_yarat_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_maydonlar jsonb,
  p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_old jsonb; v_id bigint; v_rol text; v_result jsonb;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if p_tur not in ('sklad','texnika','kadr') or jsonb_typeof(p_maydonlar)<>'object' then
    raise exception 'resource turi yoki maydonlari noto''g''ri' using errcode='22023';
  end if;
  v_old:=t2_resurs_command_boshlash(p_kompaniya_id,p_operation_id,'yarat',p_actor_id,
    jsonb_build_object('tur',p_tur,'maydonlar',p_maydonlar));
  if v_old is not null then return v_old; end if;
  if p_tur='sklad' then
    if coalesce(nullif(trim(p_maydonlar->>'nomi'),''),'')='' then raise exception 'sklad nomi majburiy' using errcode='22023'; end if;
    insert into t2_sklad_mustaqil(kompaniya_id,nomi,manzil,masul_shaxs)
    values(p_kompaniya_id,trim(p_maydonlar->>'nomi'),nullif(trim(p_maydonlar->>'manzil'),''),nullif(trim(p_maydonlar->>'masul_shaxs'),'')) returning id into v_id;
  elsif p_tur='texnika' then
    if coalesce(nullif(trim(p_maydonlar->>'nomi'),''),'')='' then raise exception 'texnika nomi majburiy' using errcode='22023'; end if;
    insert into t2_texnika_mustaqil(kompaniya_id,nomi,davlat_raqami,yoqilgi_mejori)
    values(p_kompaniya_id,trim(p_maydonlar->>'nomi'),nullif(trim(p_maydonlar->>'davlat_raqami'),''),nullif(p_maydonlar->>'yoqilgi_mejori','')::numeric) returning id into v_id;
  else
    if coalesce(nullif(trim(p_maydonlar->>'ism_sharif'),''),'')='' or coalesce(nullif(trim(p_maydonlar->>'lavozim'),''),'')='' then raise exception 'xodim ism_sharifi va lavozimi majburiy' using errcode='22023'; end if;
    insert into t2_kadr_mustaqil(kompaniya_id,ism_sharif,lavozim,oylik_maosh,valyuta)
    values(p_kompaniya_id,trim(p_maydonlar->>'ism_sharif'),trim(p_maydonlar->>'lavozim'),nullif(p_maydonlar->>'oylik_maosh','')::numeric,coalesce(nullif(trim(p_maydonlar->>'valyuta'),''),'UZS')) returning id into v_id;
  end if;
  perform t2_audit_yoz(p_kompaniya_id,'resurs_yaratildi',p_tur,v_id,format('actor_id=%s; rol=%s',p_actor_id,v_rol),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'entity_type',p_tur,'entity_id',v_id,'id',v_id,'version',1);
  return t2_resurs_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

create or replace function public.t2_resurs_yangila_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_id bigint,
  p_maydonlar jsonb, p_kutilgan_versiya integer, p_operation_id uuid,
  p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_old jsonb; v_rol text; v_rows integer; v_result jsonb;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if p_tur not in ('sklad','texnika','kadr') or p_id is null or p_id<=0 or p_kutilgan_versiya is null or p_kutilgan_versiya<1 or jsonb_typeof(p_maydonlar)<>'object' then raise exception 'resource update parametrlari noto''g''ri' using errcode='22023'; end if;
  v_old:=t2_resurs_command_boshlash(p_kompaniya_id,p_operation_id,'yangila',p_actor_id,jsonb_build_object('tur',p_tur,'id',p_id,'maydonlar',p_maydonlar,'kutilgan_versiya',p_kutilgan_versiya));
  if v_old is not null then return v_old; end if;
  if p_tur='sklad' then update t2_sklad_mustaqil set nomi=coalesce(nullif(trim(p_maydonlar->>'nomi'),''),nomi),manzil=case when p_maydonlar ? 'manzil' then nullif(trim(p_maydonlar->>'manzil'),'') else manzil end,masul_shaxs=case when p_maydonlar ? 'masul_shaxs' then nullif(trim(p_maydonlar->>'masul_shaxs'),'') else masul_shaxs end,versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  elsif p_tur='texnika' then update t2_texnika_mustaqil set nomi=coalesce(nullif(trim(p_maydonlar->>'nomi'),''),nomi),davlat_raqami=case when p_maydonlar ? 'davlat_raqami' then nullif(trim(p_maydonlar->>'davlat_raqami'),'') else davlat_raqami end,yoqilgi_mejori=case when p_maydonlar ? 'yoqilgi_mejori' then nullif(p_maydonlar->>'yoqilgi_mejori','')::numeric else yoqilgi_mejori end,versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  else update t2_kadr_mustaqil set ism_sharif=coalesce(nullif(trim(p_maydonlar->>'ism_sharif'),''),ism_sharif),lavozim=coalesce(nullif(trim(p_maydonlar->>'lavozim'),''),lavozim),oylik_maosh=case when p_maydonlar ? 'oylik_maosh' then nullif(p_maydonlar->>'oylik_maosh','')::numeric else oylik_maosh end,valyuta=coalesce(nullif(trim(p_maydonlar->>'valyuta'),''),valyuta),versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya; end if;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'resource topilmadi, tenant boshqa yoki versiya ziddiyatda' using errcode='40001'; end if;
  perform t2_audit_yoz(p_kompaniya_id,'resurs_yangilandi',p_tur,p_id,format('actor_id=%s; rol=%s',p_actor_id,v_rol),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'entity_type',p_tur,'entity_id',p_id,'id',p_id,'version',p_kutilgan_versiya+1);
  return t2_resurs_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

create or replace function public.t2_resurs_bekor_v2(
  p_kompaniya_id bigint, p_actor_id bigint, p_tur text, p_id bigint,
  p_kutilgan_versiya integer, p_operation_id uuid, p_actor_label text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_old jsonb; v_rol text; v_rows integer; v_result jsonb;
begin
  v_rol:=t2_mindmap_actor_tekshir(p_kompaniya_id,p_actor_id);
  if p_tur not in ('sklad','texnika','kadr') or p_id is null or p_id<=0 or p_kutilgan_versiya is null or p_kutilgan_versiya<1 then raise exception 'resource delete parametrlari noto''g''ri' using errcode='22023'; end if;
  v_old:=t2_resurs_command_boshlash(p_kompaniya_id,p_operation_id,'bekor',p_actor_id,jsonb_build_object('tur',p_tur,'id',p_id,'kutilgan_versiya',p_kutilgan_versiya));
  if v_old is not null then return v_old; end if;
  if p_tur='sklad' then update t2_sklad_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  elsif p_tur='texnika' then update t2_texnika_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya;
  else update t2_kadr_mustaqil set holat='bekor',versiya=versiya+1 where id=p_id and kompaniya_id=p_kompaniya_id and holat='faol' and versiya=p_kutilgan_versiya; end if;
  get diagnostics v_rows=row_count; if v_rows<>1 then raise exception 'resource topilmadi, tenant boshqa yoki versiya ziddiyatda' using errcode='40001'; end if;
  perform t2_audit_yoz(p_kompaniya_id,'resurs_bekor_qilindi',p_tur,p_id,format('actor_id=%s; rol=%s',p_actor_id,v_rol),coalesce(p_actor_label,'actor:'||p_actor_id),null);
  v_result:=jsonb_build_object('ok',true,'entity_type',p_tur,'entity_id',p_id,'id',p_id,'version',p_kutilgan_versiya+1,'soft',true);
  return t2_resurs_command_yakunla(p_kompaniya_id,p_operation_id,v_result);
end;
$function$;

revoke all on function public.t2_resurs_command_boshlash(bigint,uuid,text,bigint,jsonb) from public, anon, authenticated;
revoke all on function public.t2_resurs_command_yakunla(bigint,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.t2_resurs_yarat_v2(bigint,bigint,text,jsonb,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_resurs_yangila_v2(bigint,bigint,text,bigint,jsonb,integer,uuid,text) from public, anon, authenticated;
revoke all on function public.t2_resurs_bekor_v2(bigint,bigint,text,bigint,integer,uuid,text) from public, anon, authenticated;
grant execute on function public.t2_resurs_yarat_v2(bigint,bigint,text,jsonb,uuid,text) to service_role;
grant execute on function public.t2_resurs_yangila_v2(bigint,bigint,text,bigint,jsonb,integer,uuid,text) to service_role;
grant execute on function public.t2_resurs_bekor_v2(bigint,bigint,text,bigint,integer,uuid,text) to service_role;
