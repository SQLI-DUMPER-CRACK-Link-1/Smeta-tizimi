-- T2-COMPANY-CONTROL-FOUNDATION-001 -- System Control global/company split.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
-- Depends on 20260915120000_t2_effective_authorization_core_v1 +
-- 20260915130000_t2_platforma_rol_backfill_v1.
--
-- routeScope.ts (reconciled from fix/company-context-p0) already flags
-- /admin/system-control as GLOBAL-target with a "SPLIT -- REMAINING"
-- comment: the existing t2_system_control_v1(p_kompaniya_id, p_actor_id,
-- p_loyiha_id) REQUIRES a company anchor (raises via
-- t2_actor_kompaniya_azo_tekshir if null/invalid), so a company boss could
-- reach it too, and there was no true company-less global view. Per the
-- owner's law: "Company boss: platform-wide kill switch boshqara OLMASIN."
--
-- t2_system_control_v1 is UNCHANGED (stays the company-scoped view, still
-- callable by a company boss for their own company's capabilities/
-- integrations/jobs/incidents). This adds a separate, platform-role-gated
-- global view and a scope-checked command wrapper.

begin;

create or replace function public.t2_system_control_global_v1(p_actor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_auth jsonb;
  v_capabilities jsonb;
  v_integrations jsonb;
  v_jobs jsonb;
  v_incidents jsonb;
  v_audit jsonb;
  v_ds public.t2_deploy_state%rowtype;
  v_version jsonb;
begin
  v_auth := public.t2_effective_authorization_v1(p_actor_id, null, null, null, 'control.global.read', null);
  if coalesce((v_auth->>'allowed')::boolean, false) is distinct from true then
    return jsonb_build_object('ok', false, 'code', 'AUTHORIZATION_DENIED', 'reason', v_auth->>'reason');
  end if;

  -- global capability view: default/global-scope effective state only, not
  -- filtered to any one company (mirrors t2_system_control_v1's shape).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.kod, 'module', c.owner_domain, 'capability', c.nom,
           'status', case when exists(select 1 from public.t2_capability_override o
                            where o.capability_kod=c.kod and o.scope='global' and o.holat='off')
                          then (case when c.kill_switch then 'failed' else 'disabled' end)
                          when c.default_holat='on' then 'healthy' else 'disabled' end,
           'enabled', c.default_holat, 'scope', 'global', 'version', c.versiya::text,
           'killSwitch', c.kill_switch, 'turi', c.turi
         ) order by c.owner_domain, c.kod), '[]'::jsonb)
    into v_capabilities from public.t2_capability c;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.kod, 'name', i.nom, 'configured', i.configured, 'status', i.holat,
           'lastCheck', i.last_check_at, 'version', i.versiya, 'error', i.xato
         ) order by i.kod), '[]'::jsonb)
    into v_integrations from public.t2_integration_health i;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', j.kod, 'type', j.nom, 'module', j.owner_domain,
           'status', case j.holat when 'idle' then 'queued' when 'running' then 'running'
                                  when 'paused' then 'paused' else 'failed' end,
           'progress', j.progress, 'startedAt', j.last_success_at, 'lastError', j.last_error
         ) order by j.kod), '[]'::jsonb)
    into v_jobs from public.t2_job j;

  -- platform-wide incidents: bounded, across ALL companies (unlike the
  -- company-scoped t2_system_control_v1 which filters to one kompaniya_id).
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_incidents from (
    select jsonb_build_object(
      'id', g.id::text, 'severity', case g.severity when 'critical' then 'critical'
              when 'high' then 'error' when 'medium' then 'warning' else 'info' end,
      'module', coalesce(g.entity_type,'-'), 'code', g.signal_type, 'message', g.title,
      'kompaniya_id', g.kompaniya_id, 'firstSeen', g.detected_at, 'lastSeen', g.detected_at,
      'status', case g.state when 'open' then 'open' when 'acknowledged' then 'acknowledged' else 'resolved' end
    ) x
    from public.t2_signal g where g.state = 'open'
    order by g.severity desc, g.detected_at desc limit 50
  ) s;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_audit from (
    select jsonb_build_object('id', a.id::text, 'timestamp', a.yaratilgan_vaqt, 'actor', a.kim,
      'action', a.amal_turi, 'entity', 'control', 'newValue', a.tafsilot, 'source', 'supabase') x
    from public.t2_audit_log a where a.modul = 'control' order by a.yaratilgan_vaqt desc limit 50
  ) s;

  select * into v_ds from public.t2_deploy_state where id = 1;
  v_version := jsonb_build_object(
    'frontendCommit', v_ds.frontend_deploy_id, 'backendSchemaVersion', v_ds.db_migration_head,
    'gasDeploymentVersion', v_ds.gas_deploy_version, 'mainSha', v_ds.main_sha,
    'deployStateUpdatedAt', v_ds.updated_at, 'environment', 'production');

  return jsonb_build_object('ok', true, 'scope', 'global', 'generated_at', now(),
    'capabilities', v_capabilities, 'integrations', v_integrations, 'jobs', v_jobs,
    'incidents', v_incidents, 'auditEvents', v_audit, 'version', v_version);
end
$function$;

revoke all on function public.t2_system_control_global_v1(bigint) from public, anon, authenticated;
grant execute on function public.t2_system_control_global_v1(bigint) to service_role;

-- Global command wrapper: same command RPCs (capability_override_set /
-- capability_killswitch / job_control / deploy_state_set) already exist
-- and already self-check actor role for scope='global' writes internally
-- (t2_capability_override_set_v1 requires boss/superadmin on ANY active
-- membership for global scope -- see t2_capability_registry_v1). This
-- function is additive: it re-checks via the SAME shared authorization
-- core used everywhere else in this task, so a company boss with no
-- platform role is denied before even reaching the existing command, not
-- just relying on that older, separate check.
create or replace function public.t2_control_global_write_guard_v1(p_actor_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_auth jsonb;
begin
  v_auth := public.t2_effective_authorization_v1(p_actor_id, null, null, null, 'control.global.write', null);
  return jsonb_build_object('ok', true, 'allowed', coalesce((v_auth->>'allowed')::boolean,false), 'reason', v_auth->>'reason');
end
$function$;

revoke all on function public.t2_control_global_write_guard_v1(bigint) from public, anon, authenticated;
grant execute on function public.t2_control_global_write_guard_v1(bigint) to service_role;

comment on function public.t2_system_control_global_v1(bigint) is
  'T2-COMPANY-CONTROL-FOUNDATION-001: platform-wide System Control read model. Requires control.global.read via t2_effective_authorization_v1 (platform_superadmin/platform_operator only) -- a company boss without a platform role is denied. t2_system_control_v1 (company-scoped) is unchanged.';
comment on function public.t2_control_global_write_guard_v1(bigint) is
  'Pre-check for global-scope control writes: control.global.write via the shared authorization core, ahead of the existing capability_override_set_v1/killswitch/job_control/deploy_state_set global-scope checks (defense in depth, one shared authorization truth).';

commit;
