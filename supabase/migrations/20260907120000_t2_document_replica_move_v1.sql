-- DRIVE REPLICA — managed MOVE write-back (FILE-TRUTH-001 completion)
-- SOURCE ONLY — NOT applied to production by this task.
-- Depends on 20260902120000 (canonical columns + t2_replica_sync_job) and the
-- storage-foundation bindings (t2_object_storage_binding / t2_project_storage_binding).
--
-- Law: a Drive folder move is a REPLICA event. The canonical document identity
-- and its R2 object are never touched. We re-bind lineage ONLY when the new
-- parent is a KNOWN company binding; otherwise we fail closed (conflict + review),
-- never guessing. base_version guards against a concurrent canonical change.

begin;

create or replace function public.t2_document_replica_move_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_document_id bigint,
  p_drive_file_id text, p_new_parent_id text, p_base_version integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  d public.t2_document_registry;
  v_obj_obyekt bigint; v_obj_loyiha bigint; v_prj_loyiha bigint;
begin
  perform public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);

  select * into d from public.t2_document_registry
    where id = p_document_id and kompaniya_id = p_kompaniya_id for update;
  if not found or d.drive_file_id is distinct from p_drive_file_id then
    return jsonb_build_object('ok',false,'code','STORAGE_TENANT_MISMATCH');
  end if;
  if p_base_version is null or d.versiya <> p_base_version then
    return jsonb_build_object('ok',false,'code','REPLICA_CONFLICT','version',d.versiya);
  end if;
  if coalesce(btrim(p_new_parent_id),'') = '' then
    return jsonb_build_object('ok',false,'code','DOCUMENT_CONTRACT_INVALID');
  end if;
  if p_new_parent_id = d.drive_parent_id then
    return jsonb_build_object('ok',true,'document_id',d.id,'no_change',true);
  end if;

  -- 1. new parent is a KNOWN object binding for this company -> managed re-bind
  select obyekt_id, loyiha_id into v_obj_obyekt, v_obj_loyiha
    from public.t2_object_storage_binding
   where kompaniya_id = p_kompaniya_id and folder_id = p_new_parent_id
   limit 1;
  if found then
    update public.t2_document_registry
       set obyekt_id = v_obj_obyekt, loyiha_id = v_obj_loyiha,
           drive_parent_id = p_new_parent_id, drive_sync_status = 'synced',
           drive_last_error = null, drive_last_sync_at = now(),
           versiya = versiya + 1, updated_at = now()
     where id = d.id;
    perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_moved_managed','file_truth',v_obj_obyekt,
      format('document_id=%s; new_obyekt_id=%s; new_parent=%s; actor_id=%s', d.id, v_obj_obyekt, p_new_parent_id, p_actor_id),
      'actor:'||p_actor_id, null);
    return jsonb_build_object('ok',true,'document_id',d.id,'binding','object',
      'obyekt_id',v_obj_obyekt,'loyiha_id',v_obj_loyiha);
  end if;

  -- 2. new parent is a KNOWN project root binding for this company -> managed re-bind
  select loyiha_id into v_prj_loyiha
    from public.t2_project_storage_binding
   where kompaniya_id = p_kompaniya_id and project_root_folder_id = p_new_parent_id
   limit 1;
  if found then
    update public.t2_document_registry
       set obyekt_id = null, loyiha_id = v_prj_loyiha,
           drive_parent_id = p_new_parent_id, drive_sync_status = 'synced',
           drive_last_error = null, drive_last_sync_at = now(),
           versiya = versiya + 1, updated_at = now()
     where id = d.id;
    perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_moved_managed','file_truth',null,
      format('document_id=%s; new_loyiha_id=%s (project root); new_parent=%s; actor_id=%s', d.id, v_prj_loyiha, p_new_parent_id, p_actor_id),
      'actor:'||p_actor_id, null);
    return jsonb_build_object('ok',true,'document_id',d.id,'binding','project','loyiha_id',v_prj_loyiha);
  end if;

  -- 3. UNMANAGED move — never guess. Conflict + review job. Canonical R2 untouched.
  update public.t2_document_registry
     set drive_sync_status = 'conflict',
         drive_last_error = 'drive file moved to an unmanaged folder: '||p_new_parent_id,
         updated_at = now()
   where id = d.id;
  insert into public.t2_replica_sync_job
    (kompaniya_id, target, entity_type, entity_id, operation, holat, base_version, last_error)
  values
    (p_kompaniya_id, 'drive', 'document', d.id, 'review', 'conflict', d.versiya,
     'unmanaged move to '||p_new_parent_id);
  perform public.t2_audit_yoz(p_kompaniya_id,'document_replica_move_unmanaged','file_truth',d.obyekt_id,
    format('document_id=%s; drive_file_id=%s; new_parent=%s; canonical R2 retained; actor_id=%s',
           d.id, p_drive_file_id, p_new_parent_id, p_actor_id),
    'actor:'||p_actor_id, null);
  return jsonb_build_object('ok',false,'code','REPLICA_MOVE_UNMANAGED','document_id',d.id,'r2_retained',true);
end $$;

revoke all on function public.t2_document_replica_move_v1(bigint,bigint,bigint,text,text,integer) from public, anon, authenticated;

comment on function public.t2_document_replica_move_v1(bigint,bigint,bigint,text,text,integer) is
  'DRIVE REPLICA managed move write-back: re-bind lineage only to a KNOWN company binding, else conflict+review. base_version guarded. Canonical R2 never touched.';

commit;
