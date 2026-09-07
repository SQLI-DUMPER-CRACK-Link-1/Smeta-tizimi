-- T2-PTO-OWNER-CRITICAL-CLOSURE bugfix: t2_smeta_import_bulk_v1 crashed
-- (uncaught 22P02 invalid_text_representation, surfaced to the browser as a
-- bare IMPORT_RPC_FAILED) the instant any real-world hajm/narx/summa cell
-- carried anything past a bare number -- confirmed against production with
-- '10,5 м3' (reproducing what a real LRV export commonly contains: a
-- comma-decimal quantity with a trailing unit, non-breaking-space thousands
-- separators, dash placeholders, formula-error text). `nullif(...,'')::numeric`
-- has zero tolerance for any of that.
--
-- t2_son(text) (used already by t2_akt_yarat for the exact same class of
-- input) already solves this: strips non-breaking spaces/whitespace,
-- comma->dot, drops anything left that isn't part of a number, and returns
-- NULL (never throws) when nothing numeric survives. Swapping it in here --
-- same reuse-not-reinvent rule as everywhere else this cutover.

begin;

create or replace function public.t2_smeta_import_bulk_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_source_document_id bigint, p_qatorlar jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_soni integer;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if not exists (select 1 from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','OBJECT_ACCESS_DENIED');
  end if;
  if exists (select 1 from public.t2_qator where obyekt_id=p_obyekt_id) then
    return jsonb_build_object('ok',false,'code','SMETA_ALREADY_EXISTS');
  end if;
  if p_source_document_id is not null and not exists(
      select 1 from public.t2_document_registry d
      where d.id=p_source_document_id and d.kompaniya_id=p_kompaniya_id
        and (d.obyekt_id is null or d.obyekt_id=p_obyekt_id)) then
    return jsonb_build_object('ok',false,'code','SOURCE_DOCUMENT_SCOPE_MISMATCH');
  end if;
  if p_qatorlar is null or jsonb_typeof(p_qatorlar) <> 'array' or jsonb_array_length(p_qatorlar) = 0
     or jsonb_array_length(p_qatorlar) > 60000 then
    return jsonb_build_object('ok',false,'code','BAD_PAYLOAD');
  end if;

  create temporary table t2_smeta_import_map(
    local_id text primary key, id bigint, parent_local_id text, ordinal integer
  ) on commit drop;

  with kir as (
    select
      (x->>'local_id') as local_id, (x->>'parent_local_id') as parent_local_id,
      (x->>'tur') as tur, nullif(x->>'kod','') as kod, nullif(x->>'nom','') as nom,
      nullif(x->>'birlik','') as birlik,
      public.t2_son(x->>'hajm') as hajm, public.t2_son(x->>'narx') as narx,
      public.t2_son(x->>'summa') as summa,
      (ordinality)::integer as ordinal
    from jsonb_array_elements(p_qatorlar) with ordinality as t(x, ordinality)
  ),
  ins as (
    insert into public.t2_qator(obyekt_id, kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      manba_id, tartib, daraja)
    select p_obyekt_id, p_kompaniya_id, tur, kod, nom, birlik, hajm, narx, summa,
      p_source_document_id, ordinal, 0
    from kir order by ordinal
    returning id, tartib
  )
  insert into t2_smeta_import_map(local_id, id, parent_local_id, ordinal)
  select kir.local_id, ins.id, kir.parent_local_id, kir.ordinal
  from kir join ins on ins.tartib = kir.ordinal;

  update public.t2_qator q set ota_id = pmap.id
  from t2_smeta_import_map m
  join t2_smeta_import_map pmap on pmap.local_id = m.parent_local_id
  where q.id = m.id and m.parent_local_id is not null;

  with recursive chuqurlik as (
    select id, 0::int as d from public.t2_qator where obyekt_id=p_obyekt_id and ota_id is null
    union all
    select q.id, c.d+1 from public.t2_qator q join chuqurlik c on q.ota_id = c.id
  )
  update public.t2_qator q set daraja = c.d from chuqurlik c where q.id = c.id;

  select count(*) into v_soni from t2_smeta_import_map;

  perform public.t2_audit_yoz(p_kompaniya_id,'smeta_import_bulk','smeta',p_obyekt_id,
    format('qator_soni=%s; source_document_id=%s',v_soni,p_source_document_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',p_obyekt_id,'qator_soni',v_soni);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'smeta_import_bulk', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.t2_smeta_import_bulk_v1(bigint,bigint,bigint,uuid,bigint,jsonb) to service_role;

commit;
