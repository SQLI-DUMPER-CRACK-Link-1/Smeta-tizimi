-- T2-COMPANY-CONTROL-AUTH-CORE-001
-- Source-only, additive authorization core. Productionga ushbu taskda APPLY QILINMAYDI.
--
-- Truth qatlamlari qasddan ajratilgan:
--   t2_platforma_rol                  = platform role
--   t2_azolik                         = company membership role (mavjud truth)
--   t2_capability/_override            = capability truth (mavjud truth)
--   t2_loyiha_foydalanuvchi_ruxsat    = project access natural bridge
--   t2_obyekt_foydalanuvchi_ruxsat    = object access natural bridge
-- Universal edge/permission jadvali yaratilmaydi.

begin;

create table if not exists public.t2_platforma_rol (
  id bigint generated always as identity primary key,
  foydalanuvchi_id bigint not null references public.t2_foydalanuvchi(id),
  rol text not null check (rol in ('platform_superadmin','platform_operator')),
  holat text not null default 'faol' check (holat in ('faol','bekor')),
  berilgan_by bigint references public.t2_foydalanuvchi(id),
  operation_id uuid,
  versiya integer not null default 1 check (versiya >= 1),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (foydalanuvchi_id, rol)
);

create table if not exists public.t2_platforma_kompaniya_kontekst (
  id bigint generated always as identity primary key,
  foydalanuvchi_id bigint not null references public.t2_foydalanuvchi(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  holat text not null default 'faol' check (holat in ('faol','bekor')),
  berilgan_by bigint references public.t2_foydalanuvchi(id),
  operation_id uuid,
  versiya integer not null default 1 check (versiya >= 1),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (foydalanuvchi_id, kompaniya_id)
);

create table if not exists public.t2_loyiha_foydalanuvchi_ruxsat (
  id bigint generated always as identity primary key,
  loyiha_id bigint not null references public.t2_loyiha(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  foydalanuvchi_id bigint not null references public.t2_foydalanuvchi(id),
  ruxsat text not null check (ruxsat in ('read','write','manage')),
  holat text not null default 'faol' check (holat in ('faol','bekor')),
  berilgan_by bigint references public.t2_foydalanuvchi(id),
  operation_id uuid,
  versiya integer not null default 1 check (versiya >= 1),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (loyiha_id, foydalanuvchi_id)
);

create table if not exists public.t2_obyekt_foydalanuvchi_ruxsat (
  id bigint generated always as identity primary key,
  obyekt_id bigint not null references public.t2_obyekt(id),
  kompaniya_id bigint not null references public.t2_kompaniya(id),
  foydalanuvchi_id bigint not null references public.t2_foydalanuvchi(id),
  ruxsat text not null check (ruxsat in ('read','write','manage')),
  holat text not null default 'faol' check (holat in ('faol','bekor')),
  berilgan_by bigint references public.t2_foydalanuvchi(id),
  operation_id uuid,
  versiya integer not null default 1 check (versiya >= 1),
  yaratildi timestamptz not null default now(),
  yangilandi timestamptz not null default now(),
  unique (obyekt_id, foydalanuvchi_id)
);

create index if not exists t2_platforma_rol_actor_active_idx
  on public.t2_platforma_rol (foydalanuvchi_id, rol) where holat='faol';
create index if not exists t2_platforma_komp_kontekst_active_idx
  on public.t2_platforma_kompaniya_kontekst (foydalanuvchi_id, kompaniya_id) where holat='faol';
create index if not exists t2_loyiha_foydalanuvchi_ruxsat_active_idx
  on public.t2_loyiha_foydalanuvchi_ruxsat (foydalanuvchi_id, loyiha_id) where holat='faol';
create index if not exists t2_obyekt_foydalanuvchi_ruxsat_active_idx
  on public.t2_obyekt_foydalanuvchi_ruxsat (foydalanuvchi_id, obyekt_id) where holat='faol';

alter table public.t2_platforma_rol enable row level security;
alter table public.t2_platforma_kompaniya_kontekst enable row level security;
alter table public.t2_loyiha_foydalanuvchi_ruxsat enable row level security;
alter table public.t2_obyekt_foydalanuvchi_ruxsat enable row level security;
revoke all on public.t2_platforma_rol, public.t2_platforma_kompaniya_kontekst,
  public.t2_loyiha_foydalanuvchi_ruxsat, public.t2_obyekt_foydalanuvchi_ruxsat
  from public, anon, authenticated;

create or replace function public.t2_effective_authorization_v1(
  p_actor_id bigint,
  p_kompaniya_id bigint default null,
  p_loyiha_id bigint default null,
  p_obyekt_id bigint default null,
  p_permission text default 'company.read',
  p_capability_kod text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_platform text := 'none';
  v_membership text := null;
  v_permissions text[] := array[]::text[];
  v_platform_company boolean := false;
  v_project_ok boolean := true;
  v_object_ok boolean := true;
  v_project_scope text := 'none';
  v_object_scope text := 'none';
  v_cap jsonb := '{}'::jsonb;
  v_needed integer := 0;
  v_allowed boolean := false;
  v_reason text := 'ALLOW';
begin
  if p_actor_id is null or p_actor_id <= 0 or not exists(
    select 1 from public.t2_foydalanuvchi u where u.id=p_actor_id and u.holat='faol'
  ) then
    return jsonb_build_object('ok',true,'allowed',false,'reason','AUTH_REQUIRED');
  end if;

  if p_permission not in (
    'company.read','company.profile.update','company.member.manage',
    'control.company.read','control.company.write','control.global.read','control.global.write',
    'project.read','project.write','object.read','object.write',
    'document.read','document.write','financial.read','financial.write'
  ) then
    return jsonb_build_object('ok',true,'allowed',false,'reason','UNKNOWN_PERMISSION');
  end if;

  select r.rol into v_platform from public.t2_platforma_rol r
   where r.foydalanuvchi_id=p_actor_id and r.holat='faol'
   order by case r.rol when 'platform_superadmin' then 0 else 1 end limit 1;
  v_platform := coalesce(v_platform,'none');

  if p_kompaniya_id is null then
    if v_platform='platform_superadmin' then
      v_permissions := array['control.global.read','control.global.write'];
    elsif v_platform='platform_operator' then
      v_permissions := array['control.global.read'];
    else
      return jsonb_build_object('ok',true,'allowed',false,'reason','PLATFORM_ROLE_REQUIRED','platform_role',v_platform);
    end if;
  else
    if not exists(select 1 from public.t2_kompaniya k where k.id=p_kompaniya_id and k.faol=true) then
      return jsonb_build_object('ok',true,'allowed',false,'reason','TARGET_SCOPE_INVALID');
    end if;
    select a.rol into v_membership from public.t2_azolik a
     where a.foydalanuvchi_id=p_actor_id and a.kompaniya_id=p_kompaniya_id and a.holat='faol';
    select exists(select 1 from public.t2_platforma_kompaniya_kontekst c
      where c.foydalanuvchi_id=p_actor_id and c.kompaniya_id=p_kompaniya_id and c.holat='faol')
      into v_platform_company;

    if v_platform='platform_superadmin' and v_platform_company then
      v_permissions := array[
        'company.read','company.profile.update','company.member.manage',
        'control.company.read','control.company.write',
        'project.read','project.write','object.read','object.write',
        'document.read','document.write','financial.read','financial.write'
      ];
    else
      if v_membership is null then
        return jsonb_build_object('ok',true,'allowed',false,'reason','COMPANY_MEMBERSHIP_REQUIRED','platform_role',v_platform);
      end if;
      v_permissions := case v_membership
        when 'boss' then array['company.read','company.profile.update','company.member.manage','control.company.read','control.company.write','project.read','project.write','object.read','object.write','document.read','document.write','financial.read','financial.write']
        when 'rahbar' then array['company.read','control.company.read','project.read','object.read','document.read','financial.read']
        when 'bugalter' then array['company.read','financial.read','financial.write','document.read']
        when 'pto' then array['company.read','project.read','project.write','object.read','object.write','document.read','document.write','financial.read','financial.write']
        when 'prorab' then array['company.read','project.read','project.write','object.read','object.write','document.read','document.write']
        when 'buyurtmachi' then array['company.read','project.read','object.read','document.read','financial.read']
        when 'pudratchi' then array['company.read','project.read','object.read','document.read']
        when 'kuzatuvchi' then array['company.read','project.read','object.read','document.read']
        else array[]::text[]
      end;
      if cardinality(v_permissions)=0 then
        return jsonb_build_object('ok',true,'allowed',false,'reason','UNKNOWN_ROLE','membership_role',v_membership);
      end if;
    end if;
  end if;

  if p_capability_kod is not null then
    v_cap := public.t2_capability_effective_v1(p_capability_kod,p_kompaniya_id,p_loyiha_id);
    if coalesce(v_cap->>'holat','off') <> 'on' or (v_cap->>'manba')='killswitch' then
      return jsonb_build_object('ok',true,'allowed',false,'reason','CAPABILITY_DISABLED',
        'platform_role',v_platform,'membership_role',v_membership,'effective_capability',v_cap);
    end if;
  end if;

  if p_loyiha_id is not null then
    select exists(select 1 from public.t2_loyiha l where l.id=p_loyiha_id and l.kompaniya_id=p_kompaniya_id and l.holat='faol') into v_project_ok;
  end if;
  if p_obyekt_id is not null then
    select exists(select 1 from public.t2_obyekt o where o.id=p_obyekt_id and o.kompaniya_id=p_kompaniya_id
      and (p_loyiha_id is null or o.loyiha_id=p_loyiha_id) and o.holat='faol') into v_object_ok;
  end if;
  if not v_project_ok or not v_object_ok then
    return jsonb_build_object('ok',true,'allowed',false,'reason','TARGET_SCOPE_INVALID');
  end if;

  if p_permission = any(v_permissions) then v_allowed := true; else v_reason := 'PERMISSION_DENIED'; end if;

  if v_allowed and p_permission in ('project.read','project.write','object.read','object.write')
     and not (v_platform='platform_superadmin' and v_platform_company) then
    if p_loyiha_id is null then
      return jsonb_build_object('ok',true,'allowed',false,'reason','TARGET_SCOPE_INVALID');
    end if;
    select coalesce(r.ruxsat,'none') into v_project_scope from public.t2_loyiha_foydalanuvchi_ruxsat r
     where r.loyiha_id=p_loyiha_id and r.kompaniya_id=p_kompaniya_id and r.foydalanuvchi_id=p_actor_id and r.holat='faol';
    if p_obyekt_id is not null then
      select coalesce(r.ruxsat,'none') into v_object_scope from public.t2_obyekt_foydalanuvchi_ruxsat r
       where r.obyekt_id=p_obyekt_id and r.kompaniya_id=p_kompaniya_id and r.foydalanuvchi_id=p_actor_id and r.holat='faol';
    end if;
    v_needed := case when p_permission like '%.write' then 2 else 1 end;
    if greatest(case v_project_scope when 'manage' then 3 when 'write' then 2 when 'read' then 1 else 0 end,
                case v_object_scope when 'manage' then 3 when 'write' then 2 when 'read' then 1 else 0 end) < v_needed then
      return jsonb_build_object('ok',true,'allowed',false,
        'reason',case when p_obyekt_id is null then 'PROJECT_SCOPE_DENIED' else 'OBJECT_SCOPE_DENIED' end,
        'platform_role',v_platform,'membership_role',v_membership);
    end if;
  end if;

  return jsonb_build_object('ok',true,'allowed',v_allowed,'reason',v_reason,
    'platform_role',v_platform,'membership_role',v_membership,
    'permissions',to_jsonb(v_permissions),'effective_capability',v_cap,
    'company_id',p_kompaniya_id,'loyiha_id',p_loyiha_id,'obyekt_id',p_obyekt_id);
end
$function$;

revoke all on function public.t2_effective_authorization_v1(bigint,bigint,bigint,bigint,text,text)
  from public, anon, authenticated;
grant execute on function public.t2_effective_authorization_v1(bigint,bigint,bigint,bigint,text,text) to service_role;

comment on function public.t2_effective_authorization_v1(bigint,bigint,bigint,bigint,text,text) is
  'T2-COMPANY-CONTROL-AUTH-CORE: current DB truthdan effective authorization. Client role/contextiga ishonmaydi; service_role BFF only.';

commit;
