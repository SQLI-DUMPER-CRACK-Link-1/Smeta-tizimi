-- STOR-001 live-smoke fix: object storage provisioning for an EXISTING object.
--
-- Bug: the visible-slice "Papkani tayyorlash / qayta urinish" button routed an
-- existing object (created via mindmap or the old flow, storage_status='pending'
-- from the migration default, versiya>1, no matching operation_id) through
-- t2_object_create_v1 -> apiT2YangiObyektYarat. That is a CREATE contract:
-- expected_version must be 0/null, and it INSERTs a new row + a new Drive
-- folder. Result: STALE_VERSION (version:0), or, worse, a duplicate object and
-- a duplicate Drive folder.
--
-- Fix: a dedicated provisioning command that takes an existing obyekt_id,
-- checks the object's REAL version for optimistic locking, is idempotent on
-- obyekt_id (the object_storage_binding PK), and never inserts an object.

create or replace function public.t2_object_storage_provision_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_obyekt_id bigint,
  p_operation_id uuid, p_expected_version integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.t2_obyekt; b public.t2_project_storage_binding; ob public.t2_object_storage_binding;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  perform pg_advisory_xact_lock(hashtextextended('objprov:'||p_obyekt_id::text,0));
  perform public.t2_storage_actor_require_v1(p_kompaniya_id,p_actor_id);
  if public.t2_storage_primary_workspace_status_v1(p_kompaniya_id)='legacy' then
    return jsonb_build_object('ok',false,'code','LEGACY_WORKSPACE_FORBIDDEN');
  end if;

  select * into o from public.t2_obyekt where id=p_obyekt_id and kompaniya_id=p_kompaniya_id for update;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_NOT_FOUND'); end if;

  -- Already fully provisioned -> idempotent success (any operation_id).
  select * into ob from public.t2_object_storage_binding where obyekt_id=p_obyekt_id and provisioning_status='verified';
  if found and o.storage_status='ready' then
    select * into b from public.t2_project_storage_binding where loyiha_id=o.loyiha_id;
    return jsonb_build_object('ok',true,'obyekt_id',o.id,'loyiha_id',o.loyiha_id,
      'workspace_id',ob.workspace_id,'folder_id',ob.folder_id,
      'project_root_folder_id',b.project_root_folder_id,'storage_status','ready',
      'version',o.versiya,'retry',true);
  end if;

  -- Optimistic lock against the object's ACTUAL version (not 0).
  if p_expected_version is not null and o.versiya<>p_expected_version then
    return jsonb_build_object('ok',false,'code','STALE_VERSION','version',o.versiya);
  end if;

  -- The object's project must have a verified storage binding.
  select * into b from public.t2_project_storage_binding
   where loyiha_id=o.loyiha_id and kompaniya_id=p_kompaniya_id and provisioning_status='verified' for share;
  if not found then return jsonb_build_object('ok',false,'code','OBJECT_STORAGE_NOT_PROVISIONED'); end if;

  -- Stamp this provisioning attempt. No version bump here: the flow's terminal
  -- step (t2_object_create_ready_v1) is the one that bumps versiya.
  update public.t2_obyekt
     set operation_id=p_operation_id,
         storage_status=case when storage_status='ready' then storage_status else 'pending' end,
         storage_error=null, yangilandi=now()
   where id=p_obyekt_id
   returning * into o;

  perform public.t2_audit_yoz(p_kompaniya_id,'object_storage_provision_started','storage',o.id,
    format('actor_id=%s; operation_id=%s',p_actor_id,p_operation_id),'actor:'||p_actor_id,null);

  return jsonb_build_object('ok',true,'obyekt_id',o.id,'loyiha_id',o.loyiha_id,
    'workspace_id',b.workspace_id,'project_root_folder_id',b.project_root_folder_id,
    'existing_folder_id',(select folder_id from public.t2_object_storage_binding where obyekt_id=p_obyekt_id),
    'storage_status','pending','version',o.versiya);
end $$;

revoke all on function public.t2_object_storage_provision_v1(bigint,bigint,bigint,uuid,integer)
  from public, anon, authenticated;

comment on function public.t2_object_storage_provision_v1(bigint,bigint,bigint,uuid,integer) is
  'STOR-001: provision Drive storage for an EXISTING object. Optimistic lock on the object version; idempotent on obyekt_id; never inserts an object. Use t2_object_create_v1 only to create a brand-new object.';
