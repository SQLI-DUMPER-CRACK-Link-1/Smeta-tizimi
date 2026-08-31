-- STOR-001 flag A — canonical legacy-workspace write policy.
--
-- PRINCIPLE: TIZIM_01 root is EXPLICIT legacy compatibility only. A company
-- whose primary storage workspace is `status='legacy'` may be READ and
-- RECONCILED, but new TIZIM_02 write flows must NOT create folders, bindings
-- or documents under the legacy root. There is no silent fallback: the write
-- commands fail closed with the stable code LEGACY_WORKSPACE_FORBIDDEN so the
-- UI can route the user to an explicit legacy adapter instead.
--
-- Before this migration the resolvers accepted status in ('verified','legacy')
-- while t2_object_storage_bind_v1 / t2_document_registry_upsert_v1 required
-- 'verified' — an inconsistent, hard-to-read policy. This migration makes the
-- rule uniform at the two remaining lenient entry points
-- (t2_project_storage_provision_v1, t2_object_create_v1) and documents it.

create or replace function public.t2_storage_primary_workspace_status_v1(p_kompaniya_id bigint)
returns text language sql stable security definer set search_path=public,pg_temp as $$
  select w.status
  from public.t2_company_storage_workspace w
  where w.kompaniya_id = p_kompaniya_id and w.primary_workspace
    and w.status in ('verified','legacy')
  order by w.id
  limit 1;
$$;
revoke all on function public.t2_storage_primary_workspace_status_v1(bigint) from public, anon, authenticated;

comment on function public.t2_storage_primary_workspace_status_v1(bigint) is
  'STOR-001: primary storage workspace status for a company (verified|legacy|null). Used to fail closed on legacy write attempts.';

-- t2_project_storage_provision_v1: reject legacy before touching anything.
create or replace function public.t2_project_storage_provision_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.t2_company_storage_workspace; b public.t2_project_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if public.t2_storage_primary_workspace_status_v1(p_kompaniya_id) = 'legacy' then
    return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN');
  end if;
  if not exists(select 1 from public.t2_loyiha where id=p_loyiha_id and kompaniya_id=p_kompaniya_id and holat='faol') then return jsonb_build_object('ok',false,'code','PROJECT_COMPANY_MISMATCH'); end if;
  select * into b from public.t2_project_storage_binding where operation_id=p_operation_id for update;
  if found then if b.kompaniya_id<>p_kompaniya_id or b.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'project_root_folder_id',b.project_root_folder_id,'provisioning_status',b.provisioning_status,'version',b.versiya,'retry',true); end if;
  select * into w from public.t2_company_storage_workspace where kompaniya_id=p_kompaniya_id and primary_workspace and status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','STORAGE_WORKSPACE_NOT_CONFIGURED'); end if;
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id for update;
  if found then
    if b.kompaniya_id<>p_kompaniya_id or b.workspace_id<>w.id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if;
    if p_expected_version is not null and b.versiya<>p_expected_version then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',b.versiya); end if;
    update public.t2_project_storage_binding set operation_id=p_operation_id,actor_id=p_actor_id where loyiha_id=p_loyiha_id returning * into b;
  else
    if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
    insert into public.t2_project_storage_binding(loyiha_id,kompaniya_id,workspace_id,provisioning_status,operation_id,actor_id) values(p_loyiha_id,p_kompaniya_id,w.id,'pending',p_operation_id,p_actor_id) returning * into b;
  end if;
  perform public.t2_audit_yoz(p_kompaniya_id,'project_storage_provisioned','loyiha',p_loyiha_id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'project_id',b.loyiha_id,'workspace_id',b.workspace_id,'root_folder_id',w.root_folder_id,'provisioning_status',b.provisioning_status,'version',b.versiya);
end $$;

-- t2_object_create_v1: reject legacy up front too.
create or replace function public.t2_object_create_v1(p_kompaniya_id bigint,p_actor_id bigint,p_loyiha_id bigint,p_nom text,p_operation_id uuid,p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.t2_project_storage_binding; o public.t2_obyekt;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if public.t2_storage_primary_workspace_status_v1(p_kompaniya_id) = 'legacy' then
    return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN');
  end if;
  select * into o from public.t2_obyekt where operation_id=p_operation_id for update;
  if found then if o.kompaniya_id<>p_kompaniya_id or o.loyiha_id<>p_loyiha_id then return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH'); end if; return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status',o.storage_status,'version',o.versiya,'retry',true); end if;
  select * into b from public.t2_project_storage_binding where loyiha_id=p_loyiha_id and kompaniya_id=p_kompaniya_id and provisioning_status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_STORAGE_NOT_PROVISIONED'); end if;
  if coalesce(p_expected_version,0)<>0 then return jsonb_build_object('ok',false,'code','STALE_VERSION','version',0); end if;
  insert into public.t2_obyekt(nom,tur,kompaniya_id,loyiha_id,operation_id,storage_status,versiya) values(btrim(p_nom),'obyekt',p_kompaniya_id,p_loyiha_id,p_operation_id,'pending',1) returning * into o;
  perform public.t2_audit_yoz(p_kompaniya_id,'object_storage_pending','obyekt',o.id,format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);
  return jsonb_build_object('ok',true,'obyekt_id',o.id,'storage_status','pending','version',o.versiya);
end $$;

revoke all on function public.t2_project_storage_provision_v1(bigint,bigint,bigint,uuid,integer), public.t2_object_create_v1(bigint,bigint,bigint,text,uuid,integer) from public, anon, authenticated;

comment on table public.t2_company_storage_legacy_allowlist is
  'STOR-001: companies explicitly permitted a legacy (TIZIM_01 root) workspace. Legacy workspaces are read/reconcile only; write commands return LEGACY_WORKSPACE_FORBIDDEN.';
