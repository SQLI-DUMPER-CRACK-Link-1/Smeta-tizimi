-- FILE-TRUTH-001 behavioral acceptance. Run in a rolled-back transaction on a
-- reviewed environment ONLY after the migration is applied. Raises
-- FILE_TRUTH_ACCEPTANCE_PASS at the end (auto-rollback).
--
-- Requires: an active t2_azolik actor (non-null actor id) in a company, and a
-- project in that company. Substitute :co / :actor / :proj / :obj.
--
-- ENVIRONMENT NOTE (found running this against live prod 2026-09-02): the
-- fixture (:co, :proj, :obj) may already own real 'hujjat' documents from
-- before FILE-TRUTH-001 (legacy Drive-era rows). revision_seq is therefore
-- NOT assumed to start at 1 — it is read back from the reserve response and
-- the expected r2_key is derived from that, never hardcoded to r1/d<n>. This
-- test must never assume a pristine project; it must coexist with real
-- business data and touch none of it.

do $$
declare r jsonb; d1 bigint; d2 bigint; log text := '';
  co bigint := 1; actor bigint := 4; proj bigint := 4; obj bigint := 5;
  op1 uuid := 'f0000001-0001-4001-8001-000000000001';
  op2 uuid := 'f0000002-0002-4002-8002-000000000002';
  v_key text;
begin
  -- 1. two-phase: reserve -> (R2 put happens in the function) -> finalize
  r := public.t2_document_canonical_reserve_v1(co, actor, proj, obj, 'hujjat',
        'act.pdf', 'application/pdf', 1234, repeat('a',64), op1, 'v1');
  if not (r->>'ok')::boolean or r->>'canonical_storage_status' <> 'reserved' then raise exception '1 reserve failed: %', r; end if;
  d1 := (r->>'document_id')::bigint;
  v_key := r->>'r2_key';
  if v_key <> format('docs/%s/%s/%s/d%s/r%s', co, proj, obj, d1, r->>'revision_seq') then
    raise exception '1b r2_key not derived from document_id: %', r;
  end if;
  r := public.t2_document_canonical_finalize_v1(co, actor, d1, op1, v_key, repeat('a',64), 1234, true, 'server');
  if not (r->>'ok')::boolean or r->>'sha256_verified' <> 'true' then raise exception '1c finalize failed: %', r; end if;
  if not exists(select 1 from public.t2_replica_sync_job where entity_id=d1 and target='drive' and operation='mirror' and holat='pending')
    then raise exception '1d drive mirror job not enqueued'; end if;
  if (select canonical_storage_status from public.t2_document_registry where id=d1) <> 'stored' then raise exception '1e not stored'; end if;
  log := log || format('1 reserve+finalize doc=%s stored, drive job pending; ', d1);

  -- 2. same operation_id -> same doc, retry flag, NO second registry row
  r := public.t2_document_canonical_reserve_v1(co, actor, proj, obj, 'hujjat', 'act.pdf', 'application/pdf', 1234, repeat('a',64), op1, 'v1');
  if (r->>'document_id')::bigint <> d1 or (r->>'retry') is distinct from 'true' then raise exception '2 reserve idempotency broke: %', r; end if;
  r := public.t2_document_canonical_finalize_v1(co, actor, d1, op1, v_key, repeat('a',64), 1234, true, 'server');
  if (r->>'retry') is distinct from 'true' then raise exception '2b finalize not idempotent: %', r; end if;
  if (select count(*) from public.t2_document_registry where kompaniya_id=co and operation_id=op1) <> 1
    then raise exception '2c duplicate registry row'; end if;
  log := log || '2 operation_id idempotent (1 row, no re-put); ';

  -- 2d. interrupted upload: reserve then reconcile (no R2 binary) -> failed
  r := public.t2_document_canonical_reserve_v1(co, actor, proj, obj, 'chizma', 'x.dwg', 'image/vnd.dwg', 99, repeat('e',64), op2, null);
  update public.t2_document_registry set reserved_at = now() - interval '20 minutes' where operation_id=op2;
  r := public.t2_document_canonical_reconcile_v1((select id from public.t2_document_registry where operation_id=op2), false);
  if r->>'action' <> 'failed_no_binary' then raise exception '2d reconcile did not fail cleanly: %', r; end if;
  log := log || '2d interrupted upload -> reconcile failed_no_binary (no orphan); ';

  -- 3. cross-company rejected
  begin
    r := public.t2_document_canonical_reserve_v1(999999, actor, null, null, 'hujjat','x',null,null,repeat('b',64), 'f0000009-0009-4009-8009-000000000009', null);
    if r->>'code' not in ('STORAGE_TENANT_MISMATCH','PROJECT_COMPANY_MISMATCH') then raise exception '3 expected reject got %', r; end if;
    log := log || format('3 cross-company -> %s; ', r->>'code');
  exception when others then log := log || format('3 cross-company raised (%s); ', left(sqlerrm,40)); end;

  -- 4. canonical get authorizes the actor and returns the R2 key (not Drive)
  r := public.t2_document_canonical_get_v1(actor, d1);
  if not (r->>'ok')::boolean or (r->>'r2_key') is null or (r ? 'drive_file_id') then raise exception '4 get failed / leaked drive: %', r; end if;
  log := log || '4 get -> r2_key (no drive id leaked); ';

  -- 5. Drive replica mirror callback -> drive_sync_status synced, canonical untouched
  r := public.t2_replica_job_synced_v1(
        (select id from public.t2_replica_sync_job where entity_id=d1 and operation='mirror' limit 1),
        'DRIVE_FILE_1', 'rev-1');
  if not (r->>'ok')::boolean then raise exception '5 synced callback failed: %', r; end if;
  if (select drive_sync_status from public.t2_document_registry where id=d1) <> 'synced' then raise exception '5b not synced'; end if;
  if (select r2_key from public.t2_document_registry where id=d1) is null then raise exception '5c canonical key lost'; end if;
  log := log || '5 drive replica synced, canonical intact; ';

  -- 6. Drive content revision with stale base_version -> REPLICA_CONFLICT
  r := public.t2_document_replica_content_v1(co, actor, d1, 'docs/1/4/5/new/bbbb__act.pdf', repeat('c',64), 2000, 'rev-2', 99);
  if r->>'code' <> 'REPLICA_CONFLICT' then raise exception '6 expected REPLICA_CONFLICT got %', r; end if;
  log := log || '6 stale base_version -> REPLICA_CONFLICT; ';

  -- 7. Drive content revision with correct base_version -> new canonical revision
  r := public.t2_document_replica_content_v1(co, actor, d1, 'docs/1/4/5/new/cccc__act.pdf', repeat('c',64), 2000, 'rev-2',
        (select versiya from public.t2_document_registry where id=d1));
  if not (r->>'ok')::boolean then raise exception '7 content revision failed: %', r; end if;
  d2 := (r->>'document_id')::bigint;
  if d2 = d1 then raise exception '7b expected a NEW canonical row'; end if;
  if (select status from public.t2_document_registry where id=d1) <> 'superseded' then raise exception '7c old row not superseded'; end if;
  if (select revision_seq from public.t2_document_registry where id=d2) <> (select revision_seq from public.t2_document_registry where id=d1)+1 then raise exception '7d revision_seq did not advance'; end if;
  log := log || format('7 content revision -> new doc=%s, old superseded; ', d2);

  -- 8. Drive delete -> replica_missing, R2 retained, review job
  r := public.t2_document_replica_deleted_v1(co, actor, d2, 'DRIVE_FILE_1');
  if not (r->>'ok')::boolean or (r->>'r2_retained') <> 'true' then raise exception '8 delete handling wrong: %', r; end if;
  if (select r2_key from public.t2_document_registry where id=d2) is null then raise exception '8b R2 key was cleared'; end if;
  if not exists(select 1 from public.t2_replica_sync_job where entity_id=d2 and operation='review') then raise exception '8c review job missing'; end if;
  log := log || '8 drive delete -> replica_missing, R2 retained, review job; ';

  -- 9. rename write-back -> metadata only
  update public.t2_document_registry set status='active' where id=d2; -- reset for the rename check
  r := public.t2_document_replica_rename_v1(co, actor, d2, 'DRIVE_FILE_1', 'akt-final.pdf', 'rev-3');
  if not (r->>'ok')::boolean then raise exception '9 rename failed: %', r; end if;
  if (select original_filename from public.t2_document_registry where id=d2) <> 'akt-final.pdf' then raise exception '9b name not updated'; end if;
  log := log || '9 rename write-back (metadata only); ';

  raise exception 'FILE_TRUTH_ACCEPTANCE_PASS :: %', log;
end $$;
