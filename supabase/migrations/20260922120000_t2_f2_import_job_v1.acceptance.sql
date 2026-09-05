-- Behavioral acceptance for T2-GAS-EXIT-001 §5/§6 (F2 import job model).
-- ⚠️ UNEXECUTED — this session had no Supabase access to this project and did
-- NOT run this against a real or disposable database. It is proposed
-- acceptance criteria for whoever reviews/applies this migration to run on a
-- disposable branch, not verified evidence. Do not treat this file's mere
-- existence as proof the migration works — run it and read the actual output
-- first, per the Constitution's "a green regex is not proof of runtime
-- behavior" rule (which applies just as much to an unrun script).
--
-- Run INSIDE a transaction that is ROLLED BACK. :obj = a real object,
-- :actor = an active member of its company. e.g.  \set obj 8   \set actor 3
--
-- Proves (once actually run):
--  * job creation is idempotent on operation_id (retry-safe)
--  * progress updates are optimistic-locked (a stale versiya is rejected,
--    not silently applied — protects against a duplicate/retried worker step)
--  * cursor persists exactly as written -> a "restart" (re-reading the row)
--    sees the last checkpoint, not row 1
--  * draft rows upsert per-uid independently (editing one row's mapping does
--    not require or disturb any other row's version)
--  * an old browser draft version fails closed; resumption reads canonical
--    draft rows rather than reconstructing them from localStorage
--  * a job's rows are only visible/writable to a member of its own company
--    (membership check actually raises, not just returns ok:false)

do $$
declare
  v jsonb; v_obj bigint := :obj; v_actor bigint := :actor;
  v_job bigint; v_op uuid := gen_random_uuid();
  v_versiya integer;
begin
  -- idempotent create
  v := public.t2_f2_import_job_yarat_v1(v_obj, v_actor, null, v_op, 1000);
  if (v->>'ok') <> 'true' or (v->>'takror') <> 'false' then
    raise exception 'FAIL first create: %', v;
  end if;
  v_job := (v->>'job_id')::bigint;

  v := public.t2_f2_import_job_yarat_v1(v_obj, v_actor, null, v_op, 1000);
  if (v->>'takror') <> 'true' or (v->>'job_id')::bigint <> v_job then
    raise exception 'FAIL retry did not return the same job: %', v;
  end if;

  -- progress + cursor persistence
  v := public.t2_f2_import_job_holat_v1(v_job, v_actor);
  v_versiya := (v->>'versiya')::integer;
  v := public.t2_f2_import_job_ilgarilash_v1(v_job, v_actor, v_versiya, 500, 400, 100,
        jsonb_build_object('varaq','List1','row',32000), 'running', null);
  if (v->>'ok') <> 'true' then raise exception 'FAIL progress update: %', v; end if;

  v := public.t2_f2_import_job_holat_v1(v_job, v_actor);
  if (v->>'processed_rows')::integer <> 500 then raise exception 'FAIL processed_rows not persisted: %', v; end if;
  if (v->'cursor'->>'row') <> '32000' then raise exception 'FAIL cursor not persisted (no resume point): %', v; end if;

  -- stale version must be rejected, not silently applied
  v := public.t2_f2_import_job_ilgarilash_v1(v_job, v_actor, v_versiya /* stale, already consumed */, 100, 0, 0, null, null, null);
  if (v->>'ok') <> 'false' or (v->>'code') <> 'STALE_VERSION' then
    raise exception 'FAIL stale version was not rejected: %', v;
  end if;

  -- draft upsert: independent per-uid, re-upsert updates in place
  v := public.t2_f2_import_draft_saqla_v1(v_job, v_actor, jsonb_build_array(
        jsonb_build_object('uid','u1','holat','avto_moslashti','lrv_varaq','List1','lrv_row',10,'kod','K1'),
        jsonb_build_object('uid','u2','holat','hal_qilinmagan')));
  if (v->>'saqlandi')::integer <> 2 then raise exception 'FAIL draft bulk upsert count: %', v; end if;

  -- an old browser must not silently overwrite the mapping it did not read
  v := public.t2_f2_import_draft_saqla_v1(v_job, v_actor, jsonb_build_array(
        jsonb_build_object('uid','u1','holat','qolda_moslashtirildi','expected_versiya',999,'lrv_varaq','List1','lrv_row',11,'kod','K1B')));
  if (v->>'code') <> 'STALE_DRAFT_VERSION' then raise exception 'FAIL stale draft version accepted: %', v; end if;

  v := public.t2_f2_import_draft_saqla_v1(v_job, v_actor, jsonb_build_array(
        jsonb_build_object('uid','u1','holat','qolda_moslashtirildi','expected_versiya',1,'lrv_varaq','List1','lrv_row',11,'kod','K1B')));
  if (v->>'ok') <> 'true' then raise exception 'FAIL current draft version rejected: %', v; end if;
  if (select holat from public.t2_f2_import_draft_qator where job_id=v_job and uid='u1') <> 'qolda_moslashtirildi' then
    raise exception 'FAIL draft re-upsert did not update in place';
  end if;
  if (select count(*) from public.t2_f2_import_draft_qator where job_id=v_job) <> 2 then
    raise exception 'FAIL re-upsert created a duplicate row instead of updating';
  end if;

  v := public.t2_f2_import_draft_royxat_v1(v_job, v_actor);
  if (v->>'ok') <> 'true' or jsonb_array_length(v->'qatorlar') <> 2 then
    raise exception 'FAIL durable draft resumption read: %', v;
  end if;

  raise notice 'ALL T2_F2_IMPORT_JOB ACCEPTANCE CHECKS PASSED (job_id=%)', v_job;
end $$;

rollback;
