-- Behavioral acceptance for t2_kompaniya_yangila_v1. Run inside a
-- transaction that is ROLLED BACK -- writes nothing permanent. Assumes
-- 20260915120000_t2_effective_authorization_core_v1 and this migration
-- are both already applied. Substitute real ids: :co (company), :boss
-- (an active boss/superadmin-in-company actor), :other (non-member actor).
--
--   begin;
--   \set co 1
--   \set boss 4
--   \set other 999999
--   \i 20260916120000_t2_kompaniya_yangila_v1.acceptance.sql
--   rollback;

do $$
declare
  v jsonb;
  v_co bigint := :co;
  v_boss bigint := :boss;
  v_other bigint := :other;
  v_ver integer;
  v_op1 uuid := gen_random_uuid();
  v_op2 uuid := gen_random_uuid();
begin
  select versiya into v_ver from public.t2_kompaniya where id = v_co;
  if v_ver is null then raise exception 'FAIL fixture: company % not found', v_co; end if;

  -- 1. non-member/non-director actor is denied via the shared authorization core
  v := public.t2_kompaniya_yangila_v1(v_other, v_co, v_ver, 'Should Not Apply', null, null, null, null, null, null, null, null, gen_random_uuid());
  if (v->>'code') <> 'AUTHORIZATION_DENIED' then raise exception 'FAIL outsider guard: %', v; end if;

  -- 2. stale expected_version rejected
  v := public.t2_kompaniya_yangila_v1(v_boss, v_co, v_ver - 1, 'Stale Attempt', null, null, null, null, null, null, null, null, gen_random_uuid());
  if (v->>'code') <> 'STALE_VERSION' then raise exception 'FAIL stale version guard: %', v; end if;

  -- 3. valid update by an authorized actor succeeds, version advances
  v := public.t2_kompaniya_yangila_v1(v_boss, v_co, v_ver, 'Acceptance Test Nomi', '123456789', null, null, null, null, null, null, null, v_op1);
  if (v->>'ok') <> 'true' then raise exception 'FAIL valid update: %', v; end if;
  if (v->>'versiya')::integer <> v_ver + 1 then raise exception 'FAIL version did not advance: %', v; end if;
  if (select toliq_nom from public.t2_kompaniya where id = v_co) <> 'Acceptance Test Nomi' then
    raise exception 'FAIL toliq_nom not written'; end if;

  -- 4. operation_id replay returns the same result, no double-write / no second version bump
  v := public.t2_kompaniya_yangila_v1(v_boss, v_co, v_ver, 'Acceptance Test Nomi', '123456789', null, null, null, null, null, null, null, v_op1);
  if (v->>'ok') <> 'true' or (v->>'versiya')::integer <> v_ver + 1 then
    raise exception 'FAIL idempotent replay: %', v; end if;

  -- 5. invalid INN format rejected before any write
  v := public.t2_kompaniya_yangila_v1(v_boss, v_co, v_ver + 1, null, '12', null, null, null, null, null, null, null, v_op2);
  if (v->>'code') <> 'INN_INVALID' then raise exception 'FAIL INN validation: %', v; end if;

  -- 6. audit trail carries the actual old/new diff, not a generic message
  if not exists (
    select 1 from public.t2_audit_log
     where kompaniya_id = v_co and amal_turi = 'kompaniya_profil_yangila'
       and tafsilot like '%toliq_nom%' and tafsilot like '%inn%'
  ) then raise exception 'FAIL audit diff missing expected fields'; end if;

  raise exception 'T2_KOMPANIYA_YANGILA_V1_ACCEPTANCE_PASS';
end $$;
