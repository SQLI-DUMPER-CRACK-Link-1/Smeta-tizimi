-- T2-RUXSAT-QOSHIMCHA-001: owner talabi -- "boss yoki admin ruxsatlarni
-- boshqara olmaydi" -- "Rollar va Ruxsatlar" tabi ataylab FAQAT o'qish
-- uchun edi (rol o'zi belgilagan qattiq ruxsat to'plami, a'zolikning
-- o'zi orqali beriladi). Owner aniq so'radi: HAR BIR A'ZOGA alohida
-- QO'SHIMCHA ruxsat berish (rolini o'zgartirmasdan).
--
-- ⚠️ MUHIM CHEGARA (owner bilan kelishilgan, ochiq aytilgan): bu
-- qo'shimcha ruxsat FAQAT `t2_effective_authorization_v1` orqali
-- o'tadigan tekshiruvlarda ishlaydi (hozircha `/api/company`'ning
-- authorize yo'li). Ko'pgina yozish RPC'lari (t2_qator_tahrir,
-- t2_smeta_import_*, t2_fakt_yoz, t2_narx_belgila va h.k.) bu markaziy
-- funksiyani UMUMAN chaqirmaydi -- ularning har biri o'zining alohida,
-- qattiq yozilgan rol-tekshiruviga ega. Bu qo'shimcha ruxsat O'SHA
-- individual RPC'larni RETROAKTIV o'zgartirmaydi.
--
-- `control.global.*` (platforma darajasidagi) ruxsatlar HECH QACHON
-- kompaniya darajasida berilmaydi -- bu CHECK constraint bilan ta'minlanadi.

begin;

create table if not exists public.t2_azolik_ruxsat_qoshimcha (
  id bigint generated always as identity primary key,
  azolik_id bigint not null references public.t2_azolik(id) on delete cascade,
  ruxsat text not null check (ruxsat not like 'control.global%'),
  berdi_actor_id bigint references public.t2_foydalanuvchi(id),
  yaratildi timestamptz not null default now(),
  unique (azolik_id, ruxsat)
);
create index if not exists t2_azolik_ruxsat_qoshimcha_azolik_idx
  on public.t2_azolik_ruxsat_qoshimcha (azolik_id);
alter table public.t2_azolik_ruxsat_qoshimcha enable row level security;

-- ═══ 1) Ro'yxat -- kompaniyaning barcha a'zolari + ularning qo'shimcha ruxsatlari ═══
create or replace function public.t2_azolik_ruxsat_qoshimcha_royxat_v1(p_actor_id bigint, p_kompaniya_id bigint)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare v_rol text;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss') then
    return jsonb_build_object('ok',false,'code','MANAGE_ROLE_REQUIRED');
  end if;
  return jsonb_build_object('ok',true,'azolar',coalesce((
    select jsonb_agg(jsonb_build_object(
      'azolik_id', a.id, 'foydalanuvchi_id', a.foydalanuvchi_id,
      'login', u.login, 'ism', u.ism, 'rol', a.rol,
      'qoshimcha_ruxsatlar', coalesce((
        select jsonb_agg(q.ruxsat order by q.ruxsat)
        from public.t2_azolik_ruxsat_qoshimcha q where q.azolik_id = a.id
      ), '[]'::jsonb)
    ) order by u.login)
    from public.t2_azolik a
    join public.t2_foydalanuvchi u on u.id = a.foydalanuvchi_id
    where a.kompaniya_id = p_kompaniya_id and a.holat = 'faol'
  ), '[]'::jsonb));
end $$;

-- ═══ 2) Berish ═══
create or replace function public.t2_azolik_ruxsat_qoshimcha_ber_v1(
  p_actor_id bigint, p_kompaniya_id bigint, p_azolik_id bigint, p_ruxsat text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text; v_prev jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss') then
    return jsonb_build_object('ok',false,'code','MANAGE_ROLE_REQUIRED');
  end if;
  if p_ruxsat is null or p_ruxsat like 'control.global%' or p_ruxsat not in (
    'company.read','company.profile.update','company.member.manage',
    'control.company.read','control.company.write',
    'project.read','project.write','object.read','object.write',
    'document.read','document.write','financial.read','financial.write'
  ) then
    return jsonb_build_object('ok',false,'code','RUXSAT_NOTOGRI');
  end if;
  if not exists (select 1 from public.t2_azolik where id = p_azolik_id and kompaniya_id = p_kompaniya_id and holat = 'faol') then
    return jsonb_build_object('ok',false,'code','AZOLIK_TOPILMADI');
  end if;

  insert into public.t2_azolik_ruxsat_qoshimcha (azolik_id, ruxsat, berdi_actor_id)
    values (p_azolik_id, p_ruxsat, p_actor_id)
    on conflict (azolik_id, ruxsat) do nothing;

  perform public.t2_audit_yoz(p_kompaniya_id,'azolik_ruxsat_ber','azolik',null,
    format('azolik_id=%s; ruxsat=%s; actor_id=%s',p_azolik_id,p_ruxsat,p_actor_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'azolik_id',p_azolik_id,'ruxsat',p_ruxsat);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'azolik_ruxsat_ber', v_prev);
  return v_prev;
end $$;

-- ═══ 3) Olib tashlash ═══
create or replace function public.t2_azolik_ruxsat_qoshimcha_olib_tashla_v1(
  p_actor_id bigint, p_kompaniya_id bigint, p_azolik_id bigint, p_ruxsat text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text; v_prev jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_onboarding_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);
  if v_rol not in ('admin','superadmin','boss') then
    return jsonb_build_object('ok',false,'code','MANAGE_ROLE_REQUIRED');
  end if;
  if not exists (select 1 from public.t2_azolik where id = p_azolik_id and kompaniya_id = p_kompaniya_id) then
    return jsonb_build_object('ok',false,'code','AZOLIK_TOPILMADI');
  end if;

  delete from public.t2_azolik_ruxsat_qoshimcha where azolik_id = p_azolik_id and ruxsat = p_ruxsat;

  perform public.t2_audit_yoz(p_kompaniya_id,'azolik_ruxsat_olib_tashla','azolik',null,
    format('azolik_id=%s; ruxsat=%s; actor_id=%s',p_azolik_id,p_ruxsat,p_actor_id),'actor:'||p_actor_id,null);

  v_prev := jsonb_build_object('ok',true,'azolik_id',p_azolik_id,'ruxsat',p_ruxsat);
  insert into public.t2_onboarding_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'azolik_ruxsat_olib_tashla', v_prev);
  return v_prev;
end $$;

revoke all on function public.t2_azolik_ruxsat_qoshimcha_royxat_v1(bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_azolik_ruxsat_qoshimcha_ber_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_azolik_ruxsat_qoshimcha_olib_tashla_v1(bigint,bigint,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.t2_azolik_ruxsat_qoshimcha_royxat_v1(bigint,bigint) to service_role;
grant execute on function public.t2_azolik_ruxsat_qoshimcha_ber_v1(bigint,bigint,bigint,text,uuid) to service_role;
grant execute on function public.t2_azolik_ruxsat_qoshimcha_olib_tashla_v1(bigint,bigint,bigint,text,uuid) to service_role;

-- ═══ 4) t2_effective_authorization_v1 -- endi qo'shimcha ruxsatlarni ham ═══
-- ═══    (base rol permissions bilan birga) hisobga oladi                ═══
create or replace function public.t2_effective_authorization_v1(p_actor_id bigint, p_kompaniya_id bigint DEFAULT NULL::bigint, p_loyiha_id bigint DEFAULT NULL::bigint, p_obyekt_id bigint DEFAULT NULL::bigint, p_permission text DEFAULT 'company.read'::text, p_capability_kod text DEFAULT NULL::text)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_platform text := 'none'; v_membership text := null; v_azolik_id bigint := null;
  v_permissions text[] := array[]::text[];
  v_project_ok boolean := true; v_object_ok boolean := true;
  v_project_scope text := 'none'; v_object_scope text := 'none';
  v_cap jsonb := '{}'::jsonb; v_needed integer := 0;
  v_allowed boolean := false; v_reason text := 'ALLOW';
begin
  -- p_actor_id client bodydan emas, verified sessiondan Cloudflare BFF kiritadi.
  if p_actor_id is null or p_actor_id <= 0 or not exists (
    select 1 from public.t2_foydalanuvchi u where u.id = p_actor_id and u.holat = 'faol'
  ) then
    return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'AUTH_REQUIRED');
  end if;
  if p_permission not in (
    'company.read','company.profile.update','company.member.manage',
    'control.company.read','control.company.write','control.global.read','control.global.write',
    'project.read','project.write','object.read','object.write',
    'document.read','document.write','financial.read','financial.write'
  ) then
    return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'UNKNOWN_PERMISSION');
  end if;

  -- Platform signal barcha active membershiplardan, target company roli esa alohida olinadi.
  select a.rol into v_platform from public.t2_azolik a
  where a.foydalanuvchi_id = p_actor_id and a.holat = 'faol'
    and a.rol in ('superadmin','admin')
  order by case a.rol when 'superadmin' then 0 else 1 end limit 1;
  v_platform := coalesce(v_platform, 'none');

  if p_kompaniya_id is null then
    v_permissions := case v_platform
      when 'superadmin' then array['control.global.read','control.global.write']
      when 'admin' then array['control.global.read'] else array[]::text[] end;
    if cardinality(v_permissions) = 0 or not p_permission = any(v_permissions) then
      return jsonb_build_object('ok', true, 'allowed', false,
        'reason', 'PLATFORM_ROLE_REQUIRED', 'platform_role', v_platform);
    end if;
  else
    if not exists (select 1 from public.t2_kompaniya k where k.id = p_kompaniya_id and k.faol = true) then
      return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'TARGET_SCOPE_INVALID');
    end if;
    select a.id, a.rol into v_azolik_id, v_membership from public.t2_azolik a
    where a.foydalanuvchi_id = p_actor_id and a.kompaniya_id = p_kompaniya_id and a.holat = 'faol' limit 1;
    -- Superadmin explicit p_kompaniya_id bilan synthetic membershipsiz ishlaydi.
    -- Domain command actor+targetni t2_audit_yoz orqali audit qiladi.
    if v_platform = 'superadmin' then
      v_permissions := array['company.read','company.profile.update','company.member.manage',
        'control.company.read','control.company.write','project.read','project.write',
        'object.read','object.write','document.read','document.write','financial.read','financial.write'];
    else
      if v_membership is null then
        return jsonb_build_object('ok', true, 'allowed', false,
          'reason', 'COMPANY_MEMBERSHIP_REQUIRED', 'platform_role', v_platform);
      end if;
      v_permissions := case v_membership
        when 'admin' then array['company.read','company.profile.update','company.member.manage','control.company.read','control.company.write','project.read','project.write','object.read','object.write','document.read','document.write','financial.read','financial.write']
        when 'boss' then array['company.read','company.profile.update','company.member.manage','control.company.read','control.company.write','project.read','project.write','object.read','object.write','document.read','document.write','financial.read','financial.write']
        when 'rahbar' then array['company.read','control.company.read','project.read','object.read','document.read','financial.read']
        when 'bugalter' then array['company.read','financial.read','financial.write','document.read']
        when 'pto' then array['company.read','project.read','project.write','object.read','object.write','document.read','document.write','financial.read','financial.write']
        when 'prorab' then array['company.read','project.read','project.write','object.read','object.write','document.read','document.write']
        when 'buyurtmachi' then array['company.read','project.read','object.read','document.read','financial.read']
        when 'pudratchi' then array['company.read','project.read','object.read','document.read']
        when 'kuzatuvchi' then array['company.read','project.read','object.read','document.read']
        else array[]::text[] end;
      if cardinality(v_permissions) = 0 then
        return jsonb_build_object('ok', true, 'allowed', false,
          'reason', 'UNKNOWN_ROLE', 'membership_role', v_membership);
      end if;
      -- T2-RUXSAT-QOSHIMCHA-001: rolning qattiq to'plamiga qo'shimcha
      -- ravishda, shu ANIQ a'zolikka (kompaniyaga xos) berilgan qo'shimcha
      -- ruxsatlar ham qo'shiladi.
      if v_azolik_id is not null then
        select v_permissions || coalesce(array_agg(q.ruxsat), array[]::text[])
          into v_permissions
        from public.t2_azolik_ruxsat_qoshimcha q where q.azolik_id = v_azolik_id;
      end if;
    end if;
  end if;

  if p_capability_kod is not null then
    v_cap := public.t2_capability_effective_v1(p_capability_kod, p_kompaniya_id, p_loyiha_id);
    if coalesce(v_cap ->> 'holat', 'off') <> 'on' or (v_cap ->> 'manba') = 'killswitch' then
      return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'CAPABILITY_DISABLED',
        'platform_role', v_platform, 'membership_role', v_membership, 'effective_capability', v_cap);
    end if;
  end if;

  if p_loyiha_id is not null then
    select exists (select 1 from public.t2_loyiha l where l.id = p_loyiha_id
      and l.kompaniya_id = p_kompaniya_id and l.holat = 'faol') into v_project_ok;
  end if;
  if p_obyekt_id is not null then
    select exists (select 1 from public.t2_obyekt o where o.id = p_obyekt_id
      and o.kompaniya_id = p_kompaniya_id and (p_loyiha_id is null or o.loyiha_id = p_loyiha_id)
      and o.holat = 'faol') into v_object_ok;
  end if;
  if not v_project_ok or not v_object_ok then
    return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'TARGET_SCOPE_INVALID');
  end if;
  v_allowed := p_permission = any(v_permissions);
  if not v_allowed then v_reason := 'PERMISSION_DENIED'; end if;

  -- Membershipning o‘zi barcha loyiha/obyektlarga ruxsat bermaydi.
  if v_allowed and p_permission in ('project.read','project.write','object.read','object.write')
     and v_platform <> 'superadmin' then
    if p_loyiha_id is null then
      return jsonb_build_object('ok', true, 'allowed', false, 'reason', 'TARGET_SCOPE_INVALID');
    end if;
    select coalesce(r.ruxsat, 'none') into v_project_scope
    from public.t2_loyiha_foydalanuvchi_ruxsat r
    where r.loyiha_id = p_loyiha_id and r.foydalanuvchi_id = p_actor_id and r.holat = 'faol';
    if p_obyekt_id is not null then
      select coalesce(r.ruxsat, 'none') into v_object_scope
      from public.t2_obyekt_foydalanuvchi_ruxsat r
      where r.obyekt_id = p_obyekt_id and r.foydalanuvchi_id = p_actor_id and r.holat = 'faol';
    end if;
    v_needed := case when p_permission like '%.write' then 2 else 1 end;
    if greatest(case v_project_scope when 'manage' then 3 when 'write' then 2 when 'read' then 1 else 0 end,
      case v_object_scope when 'manage' then 3 when 'write' then 2 when 'read' then 1 else 0 end) < v_needed then
      return jsonb_build_object('ok', true, 'allowed', false,
        'reason', case when p_obyekt_id is null then 'PROJECT_SCOPE_DENIED' else 'OBJECT_SCOPE_DENIED' end,
        'platform_role', v_platform, 'membership_role', v_membership);
    end if;
  end if;
  return jsonb_build_object('ok', true, 'allowed', v_allowed, 'reason', v_reason,
    'platform_role', v_platform, 'membership_role', v_membership,
    'permissions', to_jsonb(v_permissions), 'effective_capability', v_cap,
    'company_id', p_kompaniya_id, 'loyiha_id', p_loyiha_id, 'obyekt_id', p_obyekt_id);
end
$$;

commit;
