-- Behavioral acceptance for the platform-role backfill. Run inside a
-- transaction that is ROLLED BACK. Assumes 20260915120000
-- (t2_effective_authorization_core_v1) and this backfill are both applied.

do $$
declare v jsonb; v_superadmin_actor bigint;
begin
  select foydalanuvchi_id into v_superadmin_actor from public.t2_azolik
   where rol = 'superadmin' and holat = 'faol' limit 1;
  if v_superadmin_actor is null then raise exception 'FAIL fixture: no live superadmin azolik row found'; end if;

  if not exists (select 1 from public.t2_platforma_rol where foydalanuvchi_id = v_superadmin_actor and rol = 'platform_superadmin' and holat='faol') then
    raise exception 'FAIL backfill did not grant platform_superadmin to actor %', v_superadmin_actor;
  end if;

  v := public.t2_effective_authorization_v1(v_superadmin_actor, 1, null, null, 'company.profile.update', null);
  if (v->>'allowed') <> 'true' then
    raise exception 'FAIL backfilled superadmin still denied company.profile.update: %', v;
  end if;
  if (v->>'platform_role') <> 'platform_superadmin' then
    raise exception 'FAIL platform_role not reported correctly: %', v;
  end if;

  raise exception 'T2_PLATFORMA_ROL_BACKFILL_V1_ACCEPTANCE_PASS';
end $$;
