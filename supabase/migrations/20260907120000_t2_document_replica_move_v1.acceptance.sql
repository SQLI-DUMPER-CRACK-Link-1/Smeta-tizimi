-- Behavioral acceptance for DRIVE REPLICA managed-move write-back.
-- Run INSIDE a transaction that is ROLLED BACK. Requires 20260902120000 applied.
--   begin; \i 20260907120000_t2_document_replica_move_v1.acceptance.sql  rollback;
-- Substitute :co (company), :actor (active member), :prj (project in :co).

do $$
declare v jsonb; v_doc bigint; v_known_folder text; v_known_obj bigint;
begin
  select folder_id, obyekt_id into v_known_folder, v_known_obj
    from public.t2_object_storage_binding
   where kompaniya_id = :co and folder_id is not null limit 1;

  insert into public.t2_document_registry
    (kompaniya_id, loyiha_id, document_type, status, created_at, original_filename, sha256,
     canonical_storage_status, drive_sync_status, drive_file_id, drive_parent_id, versiya)
  values (:co, :prj, 'aosr', 'active', now(), 'move-doc.pdf', repeat('b',64),
          'stored', 'synced', 'ACC_DRIVEFILE_1', 'ACC_OLD_PARENT', 1)
  returning id into v_doc;

  -- 1. base_version conflict -> REPLICA_CONFLICT (canonical change wins)
  v := public.t2_document_replica_move_v1(:co, :actor, v_doc, 'ACC_DRIVEFILE_1', 'ACC_ELSEWHERE', 999);
  if (v->>'code') <> 'REPLICA_CONFLICT' then raise exception 'FAIL base_version guard: %', v; end if;

  -- 2. move to an UNMANAGED folder -> never guessed. Conflict + review job. R2 retained.
  v := public.t2_document_replica_move_v1(:co, :actor, v_doc, 'ACC_DRIVEFILE_1', 'ACC_UNKNOWN_FOLDER', 1);
  if (v->>'code') <> 'REPLICA_MOVE_UNMANAGED' or (v->>'r2_retained') <> 'true' then
    raise exception 'FAIL unmanaged move: %', v;
  end if;
  if not exists (select 1 from public.t2_replica_sync_job
                 where entity_id = v_doc and operation = 'review' and holat = 'conflict') then
    raise exception 'FAIL no review job for unmanaged move';
  end if;
  if (select sha256 from public.t2_document_registry where id = v_doc) <> repeat('b',64) then
    raise exception 'FAIL canonical sha256 changed by a replica move';
  end if;

  -- 3. move to a KNOWN object binding folder -> managed re-bind of lineage
  if v_known_folder is not null then
    update public.t2_document_registry set versiya = 1, drive_parent_id = 'ACC_OLD_PARENT_2' where id = v_doc;
    v := public.t2_document_replica_move_v1(:co, :actor, v_doc, 'ACC_DRIVEFILE_1', v_known_folder, 1);
    if (v->>'ok') <> 'true' or (v->>'binding') <> 'object' then raise exception 'FAIL managed move: %', v; end if;
    if (select obyekt_id from public.t2_document_registry where id = v_doc) <> v_known_obj then
      raise exception 'FAIL lineage not re-bound to the known object';
    end if;
  end if;

  raise exception 'REPLICA_MOVE_ACCEPTANCE_PASS';
end $$;
