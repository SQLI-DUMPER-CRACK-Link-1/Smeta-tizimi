-- Run after forward migration in a disposable DB, or append its DO block to a
-- BEGIN...ROLLBACK migration validation transaction. Hech qanday test qatori saqlanmaydi.
begin;
do $acceptance$
declare
  v_seed bigint := 800000000000 + txid_current();
  v_boss bigint := v_seed + 1; v_pto bigint := v_seed + 2;
  v_super bigint := v_seed + 3; v_unknown bigint := v_seed + 4;
  v_company_a bigint := v_seed + 10; v_company_b bigint := v_seed + 11;
  v_project bigint := v_seed + 20; v_object bigint := v_seed + 21;
  v_cap text := 'auth_core_acceptance_' || txid_current()::text;
  v_result jsonb; v_def text; v_acl text;
begin
  select pg_get_functiondef(p.oid), coalesce(array_to_string(p.proacl, ','), '')
    into v_def, v_acl
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 't2_effective_authorization_v1';
  if v_def is null then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: function absent'; end if;
  if position('t2_platforma_rol' in v_def) > 0
     or position('t2_azolik' in v_def) = 0
     or position('t2_capability_effective_v1' in v_def) = 0
     or position('t2_loyiha_foydalanuvchi_ruxsat' in v_def) = 0
     or position('t2_obyekt_foydalanuvchi_ruxsat' in v_def) = 0 then
    raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: canonical truth mismatch';
  end if;
  if position('anon=X' in v_acl) > 0 or position('authenticated=X' in v_acl) > 0 then
    raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: public caller grant';
  end if;

  insert into public.t2_foydalanuvchi(id, login, holat) overriding system value values
    (v_boss, 'authcore_boss_' || txid_current(), 'faol'),
    (v_pto, 'authcore_pto_' || txid_current(), 'faol'),
    (v_super, 'authcore_super_' || txid_current(), 'faol'),
    (v_unknown, 'authcore_unknown_' || txid_current(), 'faol');
  insert into public.t2_kompaniya(id, nom, kod, faol) overriding system value values
    (v_company_a, 'AUTH CORE A', 'AUTHA' || txid_current(), true),
    (v_company_b, 'AUTH CORE B', 'AUTHB' || txid_current(), true);
  insert into public.t2_loyiha(id, kompaniya_id, nom, holat) overriding system value
    values (v_project, v_company_a, 'AUTH CORE PROJECT', 'faol');
  insert into public.t2_obyekt(id, nom, kompaniya_id, loyiha_id, holat) overriding system value
    values (v_object, 'AUTH CORE OBJECT', v_company_a, v_project, 'faol');
  insert into public.t2_azolik(foydalanuvchi_id, kompaniya_id, rol, holat) values
    (v_boss, v_company_a, 'boss', 'faol'),
    (v_pto, v_company_a, 'pto', 'faol'),
    (v_super, v_company_a, 'superadmin', 'faol'),
    (v_unknown, v_company_a, '__unknown__', 'faol');
  insert into public.t2_loyiha_foydalanuvchi_ruxsat(loyiha_id, foydalanuvchi_id, ruxsat, holat)
    values (v_project, v_boss, 'write', 'faol');
  insert into public.t2_capability(kod, nom, turi, default_holat, owner_domain, kill_switch)
    values (v_cap, 'AUTH CORE acceptance', 'capability', 'off', 'system', false);

  -- A normal member + project scope; B revoked; C role changed; D forged company.
  v_result := public.t2_effective_authorization_v1(v_boss, v_company_a, v_project, null, 'project.write', null);
  if coalesce((v_result ->> 'allowed')::boolean, false) is not true then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: normal_member'; end if;
  update public.t2_azolik set holat = 'bekor' where foydalanuvchi_id = v_boss and kompaniya_id = v_company_a;
  v_result := public.t2_effective_authorization_v1(v_boss, v_company_a, null, null, 'company.read', null);
  if v_result ->> 'reason' <> 'COMPANY_MEMBERSHIP_REQUIRED' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: revoked_member'; end if;
  update public.t2_azolik set holat = 'faol', rol = 'pto' where foydalanuvchi_id = v_boss and kompaniya_id = v_company_a;
  v_result := public.t2_effective_authorization_v1(v_boss, v_company_a, null, null, 'company.profile.update', null);
  if v_result ->> 'reason' <> 'PERMISSION_DENIED' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: role_changed'; end if;
  v_result := public.t2_effective_authorization_v1(v_pto, v_company_b, v_project, null, 'project.read', null);
  if coalesce((v_result ->> 'allowed')::boolean, false) then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: forged_company'; end if;

  -- E platform superadmin has global and explicit company context without synthetic B membership.
  v_result := public.t2_effective_authorization_v1(v_super, null, null, null, 'control.global.write', null);
  if coalesce((v_result ->> 'allowed')::boolean, false) is not true then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: platform_global'; end if;
  v_result := public.t2_effective_authorization_v1(v_super, v_company_b, null, null, 'company.read', null);
  if coalesce((v_result ->> 'allowed')::boolean, false) is not true or v_result ->> 'membership_role' is not null then
    raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: platform_company_context'; end if;
  -- F ordinary boss never receives global control.
  v_result := public.t2_effective_authorization_v1(v_pto, null, null, null, 'control.global.read', null);
  if coalesce((v_result ->> 'allowed')::boolean, false) then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: non_platform_global'; end if;
  -- G/H project/object scope; I unknown role; J disabled capability.
  v_result := public.t2_effective_authorization_v1(v_pto, v_company_a, v_project, null, 'project.read', null);
  if v_result ->> 'reason' <> 'PROJECT_SCOPE_DENIED' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: project_denied'; end if;
  v_result := public.t2_effective_authorization_v1(v_pto, v_company_a, v_project, v_object, 'object.read', null);
  if v_result ->> 'reason' <> 'OBJECT_SCOPE_DENIED' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: object_denied'; end if;
  v_result := public.t2_effective_authorization_v1(v_unknown, v_company_a, null, null, 'company.read', null);
  if v_result ->> 'reason' <> 'UNKNOWN_ROLE' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: unknown_role'; end if;
  v_result := public.t2_effective_authorization_v1(v_pto, v_company_a, null, null, 'company.read', v_cap);
  if v_result ->> 'reason' <> 'CAPABILITY_DISABLED' then raise exception 'AUTH_CORE_ACCEPTANCE_FAIL: capability_disabled'; end if;
end
$acceptance$;
select 'AUTH_CORE_ACCEPTANCE_PASS' as acceptance;
rollback;
