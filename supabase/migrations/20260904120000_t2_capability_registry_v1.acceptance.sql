-- Behavioral acceptance for CTRL-001 capability registry.
-- Run INSIDE a transaction that is ROLLED BACK — writes nothing permanent.
-- Substitute real ids: :co (company), :boss (boss/superadmin actor), :outsider (non-member).
--
--   begin;
--   \set co 1
--   \set boss 3
--   \i 20260904120000_t2_capability_registry_v1.acceptance.sql
--   rollback;

do $$
declare
  v jsonb;
  v_co bigint := :co;
  v_boss bigint := :boss;
  v_op uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
begin
  -- 1. effective resolves to capability default when no override
  v := public.t2_capability_effective_v1('mindmap.create', v_co, null);
  if (v->>'manba') <> 'default' or (v->>'holat') <> 'on' then
    raise exception 'FAIL default precedence: %', v;
  end if;

  -- 2. company override beats default
  v := public.t2_capability_override_set_v1(v_boss,'mindmap.create','company',v_co,'off','acceptance',0,v_op);
  if (v->>'ok') <> 'true' then raise exception 'FAIL override_set: %', v; end if;
  v := public.t2_capability_effective_v1('mindmap.create', v_co, null);
  if (v->>'manba') <> 'company' or (v->>'holat') <> 'off' then
    raise exception 'FAIL company precedence: %', v;
  end if;

  -- 3. idempotency replay: same operation_id returns the same result, no double write
  v := public.t2_capability_override_set_v1(v_boss,'mindmap.create','company',v_co,'off','acceptance',0,v_op);
  if (v->>'ok') <> 'true' then raise exception 'FAIL idempotent replay: %', v; end if;
  if (select count(*) from public.t2_capability_override
        where capability_kod='mindmap.create' and scope='company' and scope_id=v_co) <> 1 then
    raise exception 'FAIL idempotent double insert';
  end if;

  -- 4. optimistic lock: stale expected_version rejected
  v := public.t2_capability_override_set_v1(v_boss,'mindmap.create','company',v_co,'on','x',0,gen_random_uuid());
  if (v->>'code') <> 'STALE_VERSION' then raise exception 'FAIL stale version guard: %', v; end if;

  -- 5. kill-switch: global off on a kill_switch capability = hard stop everywhere
  v := public.t2_capability_killswitch_v1(v_boss,'storage.document_upload',true,'incident',gen_random_uuid());
  if (v->>'ok') <> 'true' then raise exception 'FAIL killswitch on: %', v; end if;
  v := public.t2_capability_effective_v1('storage.document_upload', v_co, null);
  if (v->>'manba') <> 'killswitch' or (v->>'holat') <> 'off' then
    raise exception 'FAIL killswitch hard stop: %', v;
  end if;
  -- narrower 'on' override cannot defeat an active kill-switch
  v := public.t2_capability_override_set_v1(v_boss,'storage.document_upload','company',v_co,'on','try',0,gen_random_uuid());
  if (v->>'code') <> 'KILLSWITCH_ACTIVE' then raise exception 'FAIL killswitch blocks narrower on: %', v; end if;

  -- 6. operation_id required
  v := public.t2_capability_override_set_v1(v_boss,'mindmap.create','global',null,'off','x',0,null);
  if (v->>'code') <> 'OPERATION_ID_REQUIRED' then raise exception 'FAIL op_id required: %', v; end if;

  -- 7. non-privileged / outsider cannot write global scope
  begin
    v := public.t2_capability_override_set_v1(999999,'mindmap.create','global',null,'off','x',0,gen_random_uuid());
    if (v->>'code') <> 'CONTROL_PERMISSION_DENIED' then raise exception 'FAIL outsider global guard: %', v; end if;
  exception when others then
    if sqlstate <> '42501' then raise; end if;  -- membership guard raising is also acceptable
  end;

  -- 8. aggregate read model returns bounded, structured data
  v := public.t2_system_control_v1(v_co, v_boss, null);
  if (v->>'ok') <> 'true' then raise exception 'FAIL system_control read: %', v; end if;
  if jsonb_array_length(v->'capabilities') = 0 then raise exception 'FAIL no capabilities in read model'; end if;
  if jsonb_array_length(v->'auditEvents') > 50 then raise exception 'FAIL audit not bounded'; end if;
  if jsonb_array_length(v->'incidents') > 25 then raise exception 'FAIL incidents not bounded'; end if;

  -- 9. job control precedence + pausability
  v := public.t2_job_control_v1(v_boss,'replica_sync','pause',gen_random_uuid());
  if (v->>'ok') <> 'true' or (v->>'holat') <> 'paused' then raise exception 'FAIL job pause: %', v; end if;
  v := public.t2_job_control_v1(v_boss,'replica_sync','pause',gen_random_uuid());
  if (v->>'code') <> 'JOB_NOT_PAUSABLE' then raise exception 'FAIL job re-pause guard: %', v; end if;

  raise exception 'CTRL_ACCEPTANCE_PASS';
end $$;
