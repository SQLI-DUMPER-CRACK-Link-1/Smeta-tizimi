-- T2-PTO-OWNER-CRITICAL-CLOSURE P0-1: native object creation, off the
-- Google Drive storage-provisioning chain.
--
-- `t2_object_create_v1` (20260830052000_t2_company_storage_foundation_v1.sql)
-- is NOT usable as a production "create object" entry point: it hard-requires
-- a company Google Drive workspace (`t2_company_storage_workspace`) AND a
-- project storage binding (`t2_project_storage_binding`) to already be bound
-- and 'verified' with a REAL Drive folder id, or it returns
-- OBJECT_STORAGE_NOT_PROVISIONED. Confirmed against production: zero
-- Cloudflare Function calls that chain at all (t2_company_storage_bind_v1 /
-- t2_project_storage_provision_v1 / t2_project_storage_bind_v1 /
-- t2_object_create_v1 have no caller in frontend/functions), and its only
-- frontend consumer (`frontend/src/test02/TestSaqlash.tsx`) reads hardcoded
-- mock rows, not this RPC. Canonical file storage today is R2
-- (FILE-TRUTH-001, t2_document_registry.canonical_storage_status) -- per
-- document, not per Drive folder -- so gating object creation on a Drive
-- folder binding is a dead architecture and must not block daily use.
--
-- This RPC creates a t2_obyekt row directly, with the same idempotency law
-- as every other native command this cutover (t2_onboarding_command_log).

begin;

create or replace function public.t2_obyekt_yarat_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_loyiha_id bigint,
  p_nom text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_prev jsonb; v_rol text; v_obyekt public.t2_obyekt;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss','director','pto') then
    raise exception 'WRITE_ROLE_REQUIRED' using errcode='42501';
  end if;

  if nullif(btrim(p_nom),'') is null then
    return jsonb_build_object('ok',false,'code','OBYEKT_NOM_REQUIRED');
  end if;
  if p_loyiha_id is not null and not exists(
      select 1 from public.t2_loyiha where id=p_loyiha_id and kompaniya_id=p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH');
  end if;

  insert into public.t2_obyekt(nom, tur, kompaniya_id, loyiha_id, storage_status, operation_id)
    values (btrim(p_nom), 'obyekt', p_kompaniya_id, p_loyiha_id, 'ready', p_operation_id)
    returning * into v_obyekt;

  perform public.t2_audit_yoz(p_kompaniya_id,'obyekt_yarat','obyekt',v_obyekt.id,
    format('nom=%s; loyiha_id=%s; actor_id=%s',v_obyekt.nom,p_loyiha_id,p_actor_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'obyekt_id',v_obyekt.id,'nom',v_obyekt.nom,'loyiha_id',v_obyekt.loyiha_id,'versiya',v_obyekt.versiya);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'obyekt_yarat', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_obyekt_yarat_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_obyekt_yarat_v1(bigint,bigint,bigint,text,uuid) to service_role;

commit;
