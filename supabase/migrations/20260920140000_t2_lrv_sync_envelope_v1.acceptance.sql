-- Behavioral acceptance for the sync envelope. Run inside a transaction
-- that is ROLLED BACK. Substitute :qator with a real t2_qator.id.

do $$
declare v_qator bigint := :qator; v_event uuid := gen_random_uuid();
begin
  insert into public.t2_lrv_sync_event
    (event_id, operation_id, origin, entity_table, entity_id, entity_version, base_version, projection_hash)
  values (v_event, gen_random_uuid(), 'sheets', 't2_qator', v_qator, 2, 1, 'hash-abc');

  -- duplicate (origin, operation_id) is rejected -- idempotency the GAS
  -- bridge currently lacks (T2_BRIDGE_CALLER_AUDIT_003.md Part B1).
  begin
    insert into public.t2_lrv_sync_event
      (event_id, operation_id, origin, entity_table, entity_id, entity_version, base_version, projection_hash)
    select gen_random_uuid(), operation_id, origin, entity_table, entity_id, entity_version, base_version, projection_hash
    from public.t2_lrv_sync_event where event_id = v_event;
    raise exception 'FAIL duplicate (origin, operation_id) should have been rejected by the unique constraint';
  exception when unique_violation then null; -- expected
  end;

  insert into public.t2_lrv_sync_conflict
    (event_id, entity_table, entity_id, reason, base_version, current_version)
  values (v_event, 't2_qator', v_qator, 'STALE_VERSION', 1, 2);
  if not exists (select 1 from public.t2_lrv_sync_conflict where event_id = v_event and not resolved) then
    raise exception 'FAIL conflict row not found as unresolved';
  end if;

  raise exception 'T2_LRV_SYNC_ENVELOPE_V1_ACCEPTANCE_PASS';
end $$;
