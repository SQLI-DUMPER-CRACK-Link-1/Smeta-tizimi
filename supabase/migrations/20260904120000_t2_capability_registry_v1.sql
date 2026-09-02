-- CTRL-001 — System Control Center real backend (capability registry + control plane)
-- SOURCE ONLY — NOT applied to production by this task (production_write_allowed=false).
--
-- Law: Supabase = truth/config. Control Center = an audited view + a small set of
-- audited commands. Control unit = a BUSINESS CAPABILITY / COMMAND / JOB / INTEGRATION,
-- never a toggle per internal JS function.
--
-- Contract: docs/architecture/SYSTEM_CONTROL_CENTER_V1.md
-- Precedence: project override > company override > global override > capability.default_holat
-- kill_switch + global 'off' = hard stop at every scope.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Capability registry (canonical entity)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_capability (
  kod            text primary key,
  nom            text not null,
  izoh           text,
  turi           text not null check (turi in ('capability','command','job','integration')),
  default_holat  text not null default 'on' check (default_holat in ('on','off')),
  owner_domain   text not null,
  kill_switch    boolean not null default false,
  versiya        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on table public.t2_capability is
  'CTRL-001 canonical registry: one row per controllable business capability/command/job/integration.';

create table if not exists public.t2_capability_override (
  id             bigint generated always as identity primary key,
  capability_kod text not null references public.t2_capability(kod) on delete cascade,
  scope          text not null check (scope in ('global','company','project')),
  scope_id       bigint,   -- null for global; kompaniya_id for company; loyiha_id for project
  holat          text not null check (holat in ('on','off')),
  sabab          text,
  actor_id       bigint,
  operation_id   uuid,
  versiya        integer not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- scope integrity: global has no scope_id, company/project require one
  constraint t2_capability_override_scope_id_chk check (
    (scope = 'global' and scope_id is null) or
    (scope in ('company','project') and scope_id is not null)
  )
);
-- one effective override per (capability, scope, scope target)
create unique index if not exists t2_capability_override_uni
  on public.t2_capability_override (capability_kod, scope, coalesce(scope_id, 0));
create index if not exists t2_capability_override_cap on public.t2_capability_override (capability_kod);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Command idempotency ledger (operation_id replay-safe)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_control_command_log (
  operation_id uuid primary key,
  actor_id     bigint not null,
  command      text   not null,
  natija       jsonb  not null,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Jobs
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_job (
  kod            text primary key,
  nom            text not null,
  owner_domain   text not null,
  holat          text not null default 'idle' check (holat in ('idle','running','paused','failed')),
  progress       numeric,
  last_success_at timestamptz,
  last_error     text,
  last_actor_id  bigint,
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Integration health
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_integration_health (
  kod            text primary key,
  nom            text not null,
  configured     boolean not null default false,
  holat          text not null default 'not_configured'
                 check (holat in ('healthy','warning','failed','disabled','configured','not_configured')),
  last_check_at  timestamptz,
  versiya        text,
  xato           text,
  updated_at     timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Deploy-state singleton (id=1) — "what is actually live"
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.t2_deploy_state (
  id                 integer primary key default 1 check (id = 1),
  main_sha           text,
  frontend_deploy_id text,
  gas_deploy_version text,
  db_migration_head  text,
  updated_at         timestamptz not null default now(),
  updated_by         bigint
);
insert into public.t2_deploy_state (id) values (1) on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Seed the real known control units (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.t2_capability (kod, nom, izoh, turi, default_holat, owner_domain, kill_switch) values
  ('storage.company_workspace','Kompaniya storage workspace','Multi-company canonical papka fondi','capability','on','storage',true),
  ('storage.document_upload','Hujjat yuklash','Kanonik hujjat yuklash oqimi','capability','on','storage',true),
  ('storage.canonical_r2','Kanonik R2 fayl haqiqati','Private Cloudflare R2 binary truth (FILE-TRUTH-001)','capability','off','storage',true),
  ('file.drive_replica','Google Drive replika','Ikkilamchi sinxron nusxa + write-back','capability','off','storage',false),
  ('file.sheets_replica','Google Sheets replika','Ikkilamchi sinxron nusxa + write-back','capability','off','storage',false),
  ('boss.dashboard','Rahbar paneli','Kanonik direktor dashboard read model','capability','on','finance',false),
  ('mindmap.create','Mindmap yaratish','Mindmap command RPC v2','capability','on','smeta',false),
  ('participants.network','Loyiha ishtirokchilari','Kanonik qatnashchilar tarmog''i','capability','on','projects',false),
  ('job.signal_bulk_import','Signal bulk import','Signallarni ommaviy import','job','on','signals',false),
  ('job.replica_sync','Replika sinxron','Drive/Sheets replica sync worker','job','off','storage',false),
  ('job.document_canonical_reconcile','Hujjat reconcile','Two-phase reserve/finalize reconcile','job','off','storage',false),
  ('integration.google_drive','Google Drive','Drive replica bridge (GAS)','integration','on','storage',false),
  ('integration.google_sheets','Google Sheets','Sheets replica bridge (GAS)','integration','on','storage',false),
  ('integration.gas_bridge','GAS ko''prik','Apps Script legacy/replica bridge','integration','on','platform',false),
  ('integration.didox','Didox EDI','Elektron hujjat almashinuvi','integration','off','finance',false),
  ('integration.supabase','Supabase','Biznes haqiqat DB','integration','on','platform',true),
  ('integration.cloudflare_r2','Cloudflare R2','Kanonik fayl saqlash','integration','off','storage',true)
on conflict (kod) do update set nom=excluded.nom, izoh=excluded.izoh, turi=excluded.turi,
  owner_domain=excluded.owner_domain, updated_at=now();

insert into public.t2_job (kod, nom, owner_domain) values
  ('signal_bulk_import','Signal bulk import','signals'),
  ('replica_sync','Replika sinxron worker','storage'),
  ('document_canonical_reconcile','Hujjat kanonik reconcile','storage')
on conflict (kod) do nothing;

insert into public.t2_integration_health (kod, nom, configured, holat) values
  ('supabase','Supabase',true,'healthy'),
  ('cloudflare_r2','Cloudflare R2 (kanonik)',false,'not_configured'),
  ('google_drive','Google Drive',true,'configured'),
  ('google_sheets','Google Sheets',true,'configured'),
  ('gas_bridge','GAS ko''prik',true,'configured'),
  ('didox','Didox EDI',false,'not_configured')
on conflict (kod) do nothing;

-- audit rows require a non-null company; a system/global change is attributed to
-- the acting user's home (oldest active) company.
create or replace function public.t2_control_actor_home_company(p_actor_id bigint)
returns bigint language sql stable security definer set search_path=public,pg_temp as $$
  select kompaniya_id from public.t2_azolik
   where foydalanuvchi_id = p_actor_id and holat='faol' order by id limit 1
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Precedence resolver
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_capability_effective_v1(
  p_kod text, p_kompaniya_id bigint default null, p_loyiha_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_cap public.t2_capability%rowtype;
  v_holat text;
  v_manba text;
  v_versiya integer;
  v_global_off boolean;
  r record;
begin
  select * into v_cap from public.t2_capability where kod = p_kod;
  if not found then return jsonb_build_object('ok',false,'code','CAPABILITY_NOT_FOUND'); end if;

  -- kill-switch: capability marked kill_switch AND a global 'off' override => hard stop
  select exists(
    select 1 from public.t2_capability_override
     where capability_kod = p_kod and scope = 'global' and holat = 'off'
  ) into v_global_off;
  if v_cap.kill_switch and v_global_off then
    return jsonb_build_object('ok',true,'kod',p_kod,'holat','off','manba','killswitch','versiya',v_cap.versiya);
  end if;

  v_holat := v_cap.default_holat;
  v_manba := 'default';
  v_versiya := v_cap.versiya;

  for r in
    select scope, scope_id, holat, versiya from public.t2_capability_override
     where capability_kod = p_kod
       and (
         (scope = 'global') or
         (scope = 'company' and scope_id = p_kompaniya_id) or
         (scope = 'project' and scope_id = p_loyiha_id)
       )
     order by case scope when 'project' then 1 when 'company' then 2 when 'global' then 3 end
  loop
    -- first row wins (most specific due to ORDER BY)
    v_holat := r.holat; v_manba := r.scope; v_versiya := r.versiya;
    exit;
  end loop;

  return jsonb_build_object('ok',true,'kod',p_kod,'holat',v_holat,'manba',v_manba,'versiya',v_versiya);
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Command: set a scoped override (audited, actor-bound, idempotent, optimistic-lock)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_capability_override_set_v1(
  p_actor_id bigint, p_kod text, p_scope text, p_scope_id bigint,
  p_holat text, p_sabab text, p_expected_version integer, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_rol text;
  v_cap public.t2_capability%rowtype;
  v_row public.t2_capability_override%rowtype;
  v_new_version integer;
  v_scope_company bigint;
  v_prev jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  -- idempotency replay
  select natija into v_prev from public.t2_control_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  if p_scope not in ('global','company','project') then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID');
  end if;
  if p_holat not in ('on','off') then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','holat on|off bo''lishi kerak');
  end if;
  if p_scope = 'global' and p_scope_id is not null then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','global scope scope_id qabul qilmaydi');
  end if;
  if p_scope in ('company','project') and p_scope_id is null then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','company/project scope scope_id talab qiladi');
  end if;

  select * into v_cap from public.t2_capability where kod = p_kod;
  if not found then return jsonb_build_object('ok',false,'code','CAPABILITY_NOT_FOUND'); end if;

  -- actor authorization. company scope authorizes against that company; project scope
  -- resolves the owning company; global requires boss/superadmin on ANY active membership.
  if p_scope = 'company' then
    v_scope_company := p_scope_id;
  elsif p_scope = 'project' then
    select kompaniya_id into v_scope_company from public.t2_loyiha where id = p_scope_id;
    if v_scope_company is null then return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','loyiha topilmadi'); end if;
  else
    v_scope_company := null;
  end if;

  if p_scope = 'global' then
    select rol into v_rol from public.t2_azolik
      where foydalanuvchi_id = p_actor_id and holat='faol' and rol in ('boss','superadmin')
      order by case rol when 'superadmin' then 0 else 1 end limit 1;
    if v_rol is null then return jsonb_build_object('ok',false,'code','CONTROL_PERMISSION_DENIED','xato','global scope faqat boss/superadmin'); end if;
    -- audit rows require a company; attribute a global change to the actor's home company
    select kompaniya_id into v_scope_company from public.t2_azolik
      where foydalanuvchi_id = p_actor_id and holat='faol' order by id limit 1;
  else
    -- raises 42501 if not an active member of the scope company
    v_rol := public.t2_actor_kompaniya_azo_tekshir(v_scope_company, p_actor_id);
    if v_rol not in ('boss','superadmin') then
      return jsonb_build_object('ok',false,'code','CONTROL_PERMISSION_DENIED','xato','control write faqat boss/superadmin (v1)');
    end if;
  end if;

  -- kill-switched capability cannot be turned back 'on' at a narrower scope while a
  -- global kill 'off' is active
  if v_cap.kill_switch and p_holat = 'on' and p_scope <> 'global'
     and exists(select 1 from public.t2_capability_override where capability_kod=p_kod and scope='global' and holat='off') then
    return jsonb_build_object('ok',false,'code','KILLSWITCH_ACTIVE');
  end if;

  select * into v_row from public.t2_capability_override
    where capability_kod = p_kod and scope = p_scope and coalesce(scope_id,0) = coalesce(p_scope_id,0)
    for update;

  if found then
    if coalesce(p_expected_version, v_row.versiya) <> v_row.versiya then
      return jsonb_build_object('ok',false,'code','STALE_VERSION','versiya',v_row.versiya);
    end if;
    v_new_version := v_row.versiya + 1;
    update public.t2_capability_override
       set holat = p_holat, sabab = p_sabab, actor_id = p_actor_id,
           operation_id = p_operation_id, versiya = v_new_version, updated_at = now()
     where id = v_row.id;
  else
    if coalesce(p_expected_version, 0) <> 0 then
      return jsonb_build_object('ok',false,'code','STALE_VERSION','versiya',0);
    end if;
    insert into public.t2_capability_override (capability_kod, scope, scope_id, holat, sabab, actor_id, operation_id, versiya)
      values (p_kod, p_scope, p_scope_id, p_holat, p_sabab, p_actor_id, p_operation_id, 1)
      returning versiya into v_new_version;
  end if;

  perform public.t2_audit_yoz(
    v_scope_company, 'capability_override_set', 'control', null,
    format('kod=%s scope=%s scope_id=%s -> %s (%s)', p_kod, p_scope, coalesce(p_scope_id::text,'-'), p_holat, coalesce(p_sabab,'')),
    'actor:'||p_actor_id, null);

  v_prev := jsonb_build_object('ok',true,'kod',p_kod,'scope',p_scope,'scope_id',p_scope_id,
              'holat',p_holat,'versiya',v_new_version,
              'effective', public.t2_capability_effective_v1(p_kod, v_scope_company, case when p_scope='project' then p_scope_id end));
  insert into public.t2_control_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'capability_override_set', v_prev);
  return v_prev;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Command: kill-switch (global hard stop / release)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_capability_killswitch_v1(
  p_actor_id bigint, p_kod text, p_on boolean, p_sabab text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text; v_cap public.t2_capability%rowtype; v_prev jsonb; v_res jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_control_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  select * into v_cap from public.t2_capability where kod = p_kod;
  if not found then return jsonb_build_object('ok',false,'code','CAPABILITY_NOT_FOUND'); end if;
  if not v_cap.kill_switch then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','bu capability kill-switch qo''llab-quvvatlamaydi');
  end if;

  select rol into v_rol from public.t2_azolik
    where foydalanuvchi_id = p_actor_id and holat='faol' and rol in ('boss','superadmin') limit 1;
  if v_rol is null then return jsonb_build_object('ok',false,'code','CONTROL_PERMISSION_DENIED'); end if;

  if p_on then
    -- hard stop = a global 'off' override
    insert into public.t2_capability_override (capability_kod, scope, scope_id, holat, sabab, actor_id, operation_id, versiya)
      values (p_kod, 'global', null, 'off', coalesce(p_sabab,'kill-switch'), p_actor_id, p_operation_id, 1)
    on conflict (capability_kod, scope, coalesce(scope_id,0))
      do update set holat='off', sabab=coalesce(p_sabab,'kill-switch'), actor_id=p_actor_id,
                    operation_id=p_operation_id, versiya=public.t2_capability_override.versiya+1, updated_at=now();
  else
    delete from public.t2_capability_override where capability_kod=p_kod and scope='global';
  end if;

  perform public.t2_audit_yoz(public.t2_control_actor_home_company(p_actor_id),
    case when p_on then 'killswitch_on' else 'killswitch_off' end,
    'control', null, format('kod=%s (%s)', p_kod, coalesce(p_sabab,'')), 'actor:'||p_actor_id, null);

  v_res := jsonb_build_object('ok',true,'kod',p_kod,'kill_switch_active',p_on,
             'effective', public.t2_capability_effective_v1(p_kod));
  insert into public.t2_control_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'capability_killswitch', v_res);
  return v_res;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Job commands
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_job_control_v1(
  p_actor_id bigint, p_job_kod text, p_action text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text; v_job public.t2_job%rowtype; v_new text; v_prev jsonb; v_res jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_control_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;
  if p_action not in ('pause','resume','retry') then
    return jsonb_build_object('ok',false,'code','CONTROL_SCOPE_INVALID','xato','action pause|resume|retry');
  end if;

  select rol into v_rol from public.t2_azolik
    where foydalanuvchi_id = p_actor_id and holat='faol' and rol in ('boss','superadmin') limit 1;
  if v_rol is null then return jsonb_build_object('ok',false,'code','CONTROL_PERMISSION_DENIED'); end if;

  select * into v_job from public.t2_job where kod = p_job_kod for update;
  if not found then return jsonb_build_object('ok',false,'code','CAPABILITY_NOT_FOUND','xato','job topilmadi'); end if;

  if p_action = 'pause' then
    if v_job.holat not in ('idle','running') then return jsonb_build_object('ok',false,'code','JOB_NOT_PAUSABLE','holat',v_job.holat); end if;
    v_new := 'paused';
  elsif p_action = 'resume' then
    if v_job.holat <> 'paused' then return jsonb_build_object('ok',false,'code','JOB_NOT_PAUSABLE','holat',v_job.holat); end if;
    v_new := 'idle';
  else -- retry
    if v_job.holat not in ('failed','paused') then return jsonb_build_object('ok',false,'code','JOB_NOT_PAUSABLE','holat',v_job.holat); end if;
    v_new := 'idle';
  end if;

  update public.t2_job set holat = v_new, last_actor_id = p_actor_id,
         last_error = case when p_action='retry' then null else last_error end, updated_at = now()
   where kod = p_job_kod;

  perform public.t2_audit_yoz(public.t2_control_actor_home_company(p_actor_id), 'job_'||p_action, 'control', null,
    format('job=%s %s->%s', p_job_kod, v_job.holat, v_new), 'actor:'||p_actor_id, null);

  v_res := jsonb_build_object('ok',true,'job',p_job_kod,'holat',v_new);
  insert into public.t2_control_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'job_'||p_action, v_res);
  return v_res;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Command: set deploy-state singleton (release tooling / owner)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_deploy_state_set_v1(
  p_actor_id bigint, p_main_sha text, p_frontend_deploy_id text,
  p_gas_deploy_version text, p_db_migration_head text, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_rol text; v_prev jsonb; v_res jsonb;
begin
  if p_operation_id is null then return jsonb_build_object('ok',false,'code','OPERATION_ID_REQUIRED'); end if;
  select natija into v_prev from public.t2_control_command_log where operation_id = p_operation_id;
  if found then return v_prev; end if;

  select rol into v_rol from public.t2_azolik
    where foydalanuvchi_id = p_actor_id and holat='faol' and rol in ('boss','superadmin') limit 1;
  if v_rol is null then return jsonb_build_object('ok',false,'code','CONTROL_PERMISSION_DENIED'); end if;

  update public.t2_deploy_state
     set main_sha = coalesce(p_main_sha, main_sha),
         frontend_deploy_id = coalesce(p_frontend_deploy_id, frontend_deploy_id),
         gas_deploy_version = coalesce(p_gas_deploy_version, gas_deploy_version),
         db_migration_head  = coalesce(p_db_migration_head, db_migration_head),
         updated_at = now(), updated_by = p_actor_id
   where id = 1;

  perform public.t2_audit_yoz(public.t2_control_actor_home_company(p_actor_id), 'deploy_state_set', 'control', null,
    format('main_sha=%s fe=%s gas=%s db=%s', coalesce(p_main_sha,'-'), coalesce(p_frontend_deploy_id,'-'),
           coalesce(p_gas_deploy_version,'-'), coalesce(p_db_migration_head,'-')), 'actor:'||p_actor_id, null);

  v_res := jsonb_build_object('ok',true);
  insert into public.t2_control_command_log (operation_id, actor_id, command, natija)
    values (p_operation_id, p_actor_id, 'deploy_state_set', v_res);
  return v_res;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Aggregate read model — one bounded call producing SystemControlData
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.t2_system_control_v1(
  p_kompaniya_id bigint, p_actor_id bigint, p_loyiha_id bigint default null)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  v_rol text;
  v_capabilities jsonb;
  v_integrations jsonb;
  v_jobs jsonb;
  v_incidents jsonb;
  v_audit jsonb;
  v_health jsonb;
  v_version jsonb;
  v_ds public.t2_deploy_state%rowtype;
  v_last_err timestamptz;
begin
  v_rol := public.t2_actor_kompaniya_azo_tekshir(p_kompaniya_id, p_actor_id);  -- raises 42501 if not a member

  -- capabilities + effective state for this company/project scope
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.kod, 'module', c.owner_domain, 'capability', c.nom,
           'status', case when (eff->>'manba')='killswitch' then 'failed'
                          when (eff->>'holat')='on' then 'healthy' else 'disabled' end,
           'enabled', case when (eff->>'manba')='killswitch' then 'off' else (eff->>'holat') end,
           'scope', case when (eff->>'manba') in ('global','company','project') then (eff->>'manba') else 'global' end,
           'source', (eff->>'manba'),
           'version', c.versiya::text,
           'killSwitch', c.kill_switch,
           'turi', c.turi,
           'lastChange', lc.ts, 'lastChangeActor', lc.kim
         ) order by c.owner_domain, c.kod), '[]'::jsonb)
    into v_capabilities
  from public.t2_capability c
  cross join lateral public.t2_capability_effective_v1(c.kod, p_kompaniya_id, p_loyiha_id) eff
  left join lateral (
     select a.yaratilgan_vaqt as ts, a.kim
     from public.t2_audit_log a
     where a.modul='control' and a.tafsilot like 'kod='||c.kod||'%'
     order by a.yaratilgan_vaqt desc limit 1
  ) lc on true;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.kod, 'name', i.nom, 'configured', i.configured, 'status', i.holat,
           'lastCheck', i.last_check_at, 'version', i.versiya, 'error', i.xato
         ) order by i.kod), '[]'::jsonb)
    into v_integrations from public.t2_integration_health i;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', j.kod, 'type', j.nom, 'module', j.owner_domain,
           'status', case j.holat when 'idle' then 'queued' when 'running' then 'running'
                                  when 'paused' then 'paused' else 'failed' end,
           'progress', j.progress, 'startedAt', j.last_success_at,
           'lastError', j.last_error
         ) order by j.kod), '[]'::jsonb)
    into v_jobs from public.t2_job j;

  -- incidents = open signals for this company (bounded)
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_incidents from (
    select jsonb_build_object(
      'id', g.id::text, 'severity', case g.severity when 'critical' then 'critical'
              when 'high' then 'error' when 'medium' then 'warning' else 'info' end,
      'module', coalesce(g.entity_type,'-'), 'code', g.signal_type, 'message', g.title,
      'count', 1, 'firstSeen', g.detected_at, 'lastSeen', g.detected_at,
      'status', case g.state when 'open' then 'open' when 'acknowledged' then 'acknowledged' else 'resolved' end
    ) x
    from public.t2_signal g
    where g.kompaniya_id = p_kompaniya_id and g.state = 'open'
    order by g.severity desc, g.detected_at desc limit 25
  ) s;

  -- control audit trail (bounded)
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_audit from (
    select jsonb_build_object(
      'id', a.id::text, 'timestamp', a.yaratilgan_vaqt, 'actor', a.kim,
      'action', a.amal_turi, 'entity', 'control', 'newValue', a.tafsilot,
      'source', 'supabase'
    ) x
    from public.t2_audit_log a
    where a.modul = 'control'
    order by a.yaratilgan_vaqt desc limit 50
  ) s;

  select max(yaratilgan_vaqt) into v_last_err from public.t2_audit_log
   where (amal_turi like '%_failed' or amal_turi like '%xato%')
     and yaratilgan_vaqt > now() - interval '7 days';

  select * into v_ds from public.t2_deploy_state where id = 1;

  v_health := jsonb_build_array(
    jsonb_build_object('id','core','name','Core (Supabase biznes haqiqat)','status','healthy','lastCheck',now()),
    jsonb_build_object('id','canonical_files','name','Kanonik fayl tizimi (R2)',
       'status', case when (select configured from public.t2_integration_health where kod='cloudflare_r2') then 'healthy' else 'not_configured' end,
       'message','R2 DOWN = kanonik fayl degraded, core UP'),
    jsonb_build_object('id','replica','name','Replika (Drive/Sheets)',
       'status', case when exists(select 1 from public.t2_job where kod='replica_sync' and holat='failed') then 'warning' else 'healthy' end,
       'message','Drive/Sheets DOWN = faqat replika degraded'),
    jsonb_build_object('id','bridge','name','GAS ko''prik',
       'status', (select holat from public.t2_integration_health where kod='gas_bridge'),
       'message','GAS DOWN = faqat legacy/replica ko''prik degraded'),
    jsonb_build_object('id','last_error','name','Oxirgi xatolik (7 kun)',
       'status', case when v_last_err is null then 'healthy' else 'warning' end,
       'lastCheck', v_last_err)
  );

  v_version := jsonb_build_object(
    'frontendCommit', v_ds.frontend_deploy_id,
    'backendSchemaVersion', v_ds.db_migration_head,
    'gasDeploymentVersion', v_ds.gas_deploy_version,
    'mainSha', v_ds.main_sha,
    'deployStateUpdatedAt', v_ds.updated_at,
    'environment', 'production'
  );

  return jsonb_build_object(
    'ok', true, 'generated_at', now(), 'rol', v_rol,
    'health', v_health,
    'capabilities', v_capabilities,
    'integrations', v_integrations,
    'jobs', v_jobs,
    'incidents', v_incidents,
    'auditEvents', v_audit,
    'version', v_version
  );
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Lock down: service_role only (Cloudflare function is the sole caller)
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.t2_capability_effective_v1(text,bigint,bigint) from public, anon, authenticated;
revoke all on function public.t2_capability_override_set_v1(bigint,text,text,bigint,text,text,integer,uuid) from public, anon, authenticated;
revoke all on function public.t2_capability_killswitch_v1(bigint,text,boolean,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_job_control_v1(bigint,text,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_deploy_state_set_v1(bigint,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.t2_system_control_v1(bigint,bigint,bigint) from public, anon, authenticated;

alter table public.t2_capability            enable row level security;
alter table public.t2_capability_override   enable row level security;
alter table public.t2_control_command_log   enable row level security;
alter table public.t2_job                   enable row level security;
alter table public.t2_integration_health    enable row level security;
alter table public.t2_deploy_state          enable row level security;
-- no permissive policies: only service_role (bypasses RLS) and SECURITY DEFINER functions reach these.

comment on function public.t2_system_control_v1(bigint,bigint,bigint) is
  'CTRL-001: one bounded aggregate read model for the System Control Center. Membership-checked; service_role only.';

commit;
