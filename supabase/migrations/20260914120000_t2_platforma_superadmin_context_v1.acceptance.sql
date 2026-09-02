-- Behavioral acceptance for 20260914120000_t2_platforma_superadmin_context_v1.
-- Run INSIDE a transaction that is ROLLED BACK. No :params.
--
-- Proves:
--  A. normal member -> unchanged (their real role returned)
--  B. non-member, non-superadmin -> still 42501 (no weakening)
--  C. platform superadmin, NOT a member of the company -> 'superadmin'
--     WITHOUT any t2_azolik row being written (no synthetic membership)
--  D. superadmin path refuses a non-existent company
--  E. t2_platforma_superadmin resolver cannot be satisfied by a non-superadmin role

do $$
declare
  v_komp1 bigint; v_komp2 bigint;
  v_sa bigint; v_normal bigint;
  v_azolik_before bigint; v_azolik_after bigint;
  v_rol text;
begin
  -- ── fixtures ──
  insert into public.t2_kompaniya (nom, kod, faol) values ('ACC SA co-1', 'ACCSA1', true) returning id into v_komp1;
  insert into public.t2_kompaniya (nom, kod, faol) values ('ACC SA co-2', 'ACCSA2', true) returning id into v_komp2;
  insert into public.t2_foydalanuvchi (login, holat) values ('acc_sa_'||floor(random()*1e9), 'faol') returning id into v_sa;
  insert into public.t2_foydalanuvchi (login, holat) values ('acc_normal_'||floor(random()*1e9), 'faol') returning id into v_normal;

  -- superadmin is a member of co-1 only; normal user is a member of co-1 as prorab
  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat) values (v_sa, v_komp1, 'superadmin', 'faol');
  insert into public.t2_azolik (foydalanuvchi_id, kompaniya_id, rol, holat) values (v_normal, v_komp1, 'prorab', 'faol');

  -- ── A. normal member: real role ──
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp1, v_normal);
  if v_rol <> 'prorab' then raise exception 'FAIL A: normal member role = % (kutildi prorab)', v_rol; end if;

  -- ── B. non-member, non-superadmin: still 42501 ──
  begin
    perform public.t2_actor_kompaniya_azo_tekshir(v_komp2, v_normal);
    raise exception 'FAIL B: non-member non-superadmin got access to co-2';
  exception when insufficient_privilege then null;  -- 42501 = expected
  end;

  -- ── C. platform superadmin, NOT a member of co-2 -> 'superadmin', zero new azolik ──
  select count(*) into v_azolik_before from public.t2_azolik;
  v_rol := public.t2_actor_kompaniya_azo_tekshir(v_komp2, v_sa);
  if v_rol <> 'superadmin' then raise exception 'FAIL C: superadmin cross-company role = % (kutildi superadmin)', v_rol; end if;
  select count(*) into v_azolik_after from public.t2_azolik;
  if v_azolik_after <> v_azolik_before then raise exception 'FAIL C: superadmin path wrote % synthetic t2_azolik row(s)', v_azolik_after - v_azolik_before; end if;

  -- ── D. superadmin path refuses a non-existent company ──
  begin
    perform public.t2_actor_kompaniya_azo_tekshir(999999999, v_sa);
    raise exception 'FAIL D: superadmin got a role for a non-existent company';
  exception when insufficient_privilege then null;
  end;

  -- ── E. resolver: a boss (not superadmin) is NOT a platform superadmin ──
  if public.t2_platforma_superadmin(v_normal) then raise exception 'FAIL E: prorab flagged as platform superadmin'; end if;
  if not public.t2_platforma_superadmin(v_sa) then raise exception 'FAIL E: real superadmin not flagged'; end if;

  raise exception 'PLATFORMA_SUPERADMIN_CONTEXT_ACCEPTANCE_PASS';
end $$;
