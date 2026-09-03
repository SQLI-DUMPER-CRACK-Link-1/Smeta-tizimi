-- Behavioral acceptance for the System Control global/company split. Run
-- inside a transaction that is ROLLED BACK. Assumes 20260915120000,
-- 20260915130000, and this migration are all applied. Substitute :platform
-- (a backfilled platform_superadmin actor) and :companyboss (a real
-- company 'boss' membership actor with no platform role).

do $$
declare
  v jsonb;
  v_platform_actor bigint := :platform;
  v_company_boss bigint := :companyboss;
begin
  -- 1. platform actor reaches the global view
  v := public.t2_system_control_global_v1(v_platform_actor);
  if (v->>'ok') <> 'true' then raise exception 'FAIL platform actor denied global view: %', v; end if;
  if (v->>'scope') <> 'global' then raise exception 'FAIL scope not global: %', v; end if;

  -- 2. company boss (no platform role) is DENIED the global view -- the
  -- exact law the owner stated: "Company boss: platform-wide kill switch
  -- boshqara OLMASIN."
  v := public.t2_system_control_global_v1(v_company_boss);
  if (v->>'code') <> 'AUTHORIZATION_DENIED' then
    raise exception 'FAIL company boss was NOT denied global control: %', v;
  end if;

  -- 3. company-scoped t2_system_control_v1 is untouched -- the company
  -- boss can still reach their own company's view exactly as before.
  v := public.t2_system_control_v1(1, v_company_boss, null);
  if (v->>'ok') <> 'true' then raise exception 'FAIL company-scoped view regressed for company boss: %', v; end if;

  -- 4. global write guard denies the company boss too
  v := public.t2_control_global_write_guard_v1(v_company_boss);
  if (v->>'allowed') <> 'false' then raise exception 'FAIL global write guard let a company boss through: %', v; end if;

  raise exception 'T2_SYSTEM_CONTROL_SPLIT_V1_ACCEPTANCE_PASS';
end $$;
