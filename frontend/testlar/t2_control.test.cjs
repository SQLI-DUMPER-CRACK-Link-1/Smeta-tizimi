/* CTRL-001 — System Control Center real backend + canonical transport.
   No /api/gas, no Drive/Sheets on the control path. Audited, actor-bound,
   optimistic-locked, idempotent commands. Deterministic precedence + kill-switch. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let ok = 0;
const must = (l, c) => { assert(c, l); console.log('  ✅ ' + l); ok++; };
const nocomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const mig = R('supabase', 'migrations', '20260904120000_t2_capability_registry_v1.sql');
const roll = R('supabase', 'migrations', '20260904120000_t2_capability_registry_v1.rollback.sql');
const acc = R('supabase', 'migrations', '20260904120000_t2_capability_registry_v1.acceptance.sql');
const migN = mig.replace(/\s+/g, ' ');
const fn = R('frontend', 'functions', 'api', 'system-control.ts');
const client = R('frontend', 'src', 'api', 't2-control.ts');
const page = R('frontend', 'src', 'admin', 'pages', 'SystemControlPage.tsx');

console.log('\n── No legacy transport on the control path ──');
for (const [n, s0] of [['system-control fn', fn], ['t2-control client', client], ['SystemControlPage', page]]) {
  const s = nocomment(s0);
  must(n + ': no GAS bridge call', !/fetch\(['"`]\/api\/gas|apiT2Control|apiBossData/.test(s));
  must(n + ': no DriveApp / SpreadsheetApp', !/DriveApp|SpreadsheetApp|drive\.google|sheets\.googleapis/i.test(s));
}
must('client talks to /api/system-control only', /fetch\('\/api\/system-control/.test(client));
must('page renders the real Codex SystemControlCenter (not demo)', /SystemControlCenter/.test(page) && /demo=\{false\}/.test(page));
must('page has NO hardcoded demo dataset', !/demoData|DEMO_DATA|makeDemo/.test(nocomment(page)));

console.log('\n── Transport: actor from session, never from body ──');
must('fn verifies session cookie', /tekshir\(ctx\.request\.headers\.get\('Cookie'\)/.test(fn));
must('fn injects actorId from session', /foydalanuvchi_id/.test(fn) && /p_actor_id: a\.actorId/.test(fn));
must('fn never reads actor from request body', !/bodyIn\.(actor|actor_id|actorId|p_actor_id)/.test(fn));
must('fn mints/forwards operation_id for idempotency', /crypto\.randomUUID\(\)/.test(fn) && /operation_id/.test(fn));
must('fn maps STALE_VERSION -> 409', /STALE_VERSION.*409|409.*STALE_VERSION/s.test(fn));
must('fn maps permission -> 403', /PERMISSION_DENIED/.test(fn) && /403/.test(fn));

console.log('\n── Capability registry (canonical entity, not per-JS-function) ──');
must('t2_capability table', /create table if not exists public\.t2_capability \(/.test(migN));
must('turi constrained to capability|command|job|integration', /turi text not null check \(turi in \('capability','command','job','integration'\)\)/.test(migN));
must('scoped override table with optimistic lock', /create table if not exists public\.t2_capability_override/.test(migN) && /versiya integer not null default 1/.test(migN));
must('override scope integrity constraint', /t2_capability_override_scope_id_chk/.test(migN));
must('one effective override per (capability, scope, target)', /create unique index if not exists t2_capability_override_uni/.test(migN));
must('idempotency ledger', /create table if not exists public\.t2_control_command_log/.test(migN));
must('deploy-state singleton id=1', /create table if not exists public\.t2_deploy_state/.test(migN) && /check \(id = 1\)/.test(migN));
must('seeds real business capabilities (storage.document_upload etc.)', /'storage\.document_upload'/.test(mig) && /'mindmap\.create'/.test(mig) && /'integration\.didox'/.test(mig));

console.log('\n── Deterministic precedence + kill-switch ──');
must('resolver function', /create or replace function public\.t2_capability_effective_v1/.test(migN));
must('precedence project > company > global', /order by case scope when 'project' then 1 when 'company' then 2 when 'global' then 3 end/.test(migN));
must('kill-switch hard stop: kill_switch + global off => off everywhere', /if v_cap\.kill_switch and v_global_off then/.test(migN) && /'manba','killswitch'/.test(migN));
must('narrower on cannot defeat active kill-switch', /KILLSWITCH_ACTIVE/.test(mig));

console.log('\n── Commands: audited, actor-bound, guarded ──');
for (const f of ['t2_capability_override_set_v1', 't2_capability_killswitch_v1', 't2_job_control_v1', 't2_deploy_state_set_v1']) {
  must(f + ' exists', new RegExp('create or replace function public\\.' + f).test(mig));
}
must('every command requires operation_id', (mig.match(/OPERATION_ID_REQUIRED/g) || []).length >= 4);
must('every command replays via the idempotency ledger', (migN.match(/from public\.t2_control_command_log where operation_id/g) || []).length >= 4);
must('override_set uses optimistic version (STALE_VERSION)', /STALE_VERSION/.test(mig) && /coalesce\(p_expected_version/.test(mig));
must('global scope / kill-switch restricted to boss|superadmin', /rol in \('boss','superadmin'\)/.test(mig));
must('non-global scope authorized via t2_actor_kompaniya_azo_tekshir', /t2_actor_kompaniya_azo_tekshir\(v_scope_company, ?p_actor_id\)/.test(migN));
must('commands write t2_audit_yoz with modul=control', /t2_audit_yoz\([^)]*'control'/.test(migN));
must('audit company is non-null (home-company helper)', /t2_control_actor_home_company/.test(mig));
must('job pausability guard (JOB_NOT_PAUSABLE)', /JOB_NOT_PAUSABLE/.test(mig));

console.log('\n── Read model: one bounded aggregate, service_role only ──');
must('t2_system_control_v1 aggregate', /create or replace function public\.t2_system_control_v1/.test(migN));
must('membership-checked read', /v_rol := public\.t2_actor_kompaniya_azo_tekshir\(p_kompaniya_id, ?p_actor_id\)/.test(migN));
must('incidents bounded (<= 25)', /from public\.t2_signal[\s\S]{0,400}limit 25/.test(migN));
must('audit bounded (<= 50)', /where a\.modul = 'control'[\s\S]{0,140}limit 50/.test(migN));
must('no N+1: no per-capability cursor loop in read model', !/for \w+ in select[\s\S]{0,200}t2_capability\b[\s\S]{0,200}loop/i.test((migN.split('t2_system_control_v1')[2] || migN.split('t2_system_control_v1')[1] || '')));
must('all control functions revoked from anon/authenticated', (mig.match(/revoke all on function public\.t2_(capability|job|deploy|system)/g) || []).length >= 5);
must('control tables RLS-enabled with no permissive policy', /alter table public\.t2_capability +enable row level security/.test(migN) && !/create policy/.test(mig));

console.log('\n── Migration hygiene ──');
must('rollback drops every table + function it introduced', /drop table if exists public\.t2_capability_override/.test(roll) && /drop function if exists public\.t2_system_control_v1/.test(roll));
must('acceptance raises a PASS sentinel', /CTRL_ACCEPTANCE_PASS/.test(acc));
must('acceptance covers precedence, idempotency, stale-version, kill-switch, permission', /company prec|company precedence/i.test(acc) && /idempotent/i.test(acc) && /STALE_VERSION/.test(acc) && /killswitch|kill-switch/i.test(acc));
must('migration is additive (no drop table / drop column of existing objects)', !/drop\s+table\s+(?!if exists public\.t2_(capability|job|deploy|integration|control))/i.test(mig) && !/alter table[\s\S]{0,60}drop column/i.test(mig));

console.log('\n' + ok + ' checks passed');
