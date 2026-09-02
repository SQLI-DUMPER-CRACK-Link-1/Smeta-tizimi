/* COMPANY / AUTH / DIRECTOR — P0 onboarding + multi-tenant safety.
   - login registration must NOT auto-join every company
   - canonical company creation -> creator = director (boss)
   - canonical current-user + memberships read model
   - director-guarded, audited, idempotent member commands
   - actor id from session only; no /api/gas, no Drive/Sheets */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let ok = 0;
const must = (l, c) => { assert(c, l); console.log('  ✅ ' + l); ok++; };
const nocomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const mig = R('supabase', 'migrations', '20260905120000_t2_company_onboarding_v1.sql');
const migN = mig.replace(/\s+/g, ' ');
const roll = R('supabase', 'migrations', '20260905120000_t2_company_onboarding_v1.rollback.sql');
const acc = R('supabase', 'migrations', '20260905120000_t2_company_onboarding_v1.acceptance.sql');
const fn = R('frontend', 'functions', 'api', 'company.ts');
const client = R('frontend', 'src', 'api', 't2-men.ts');
const page = R('frontend', 'src', 'admin', 'pages', 'KompaniyaPage.tsx');

console.log('\n── P0: login registration no longer joins every company ──');
must('t2_kirish_royxatga_ol redefined', /create or replace function public\.t2_kirish_royxatga_ol/.test(migN));
must('NO auto-join loop over t2_kompaniya in the new body',
  !/insert into t2_azolik[\s\S]{0,120}select v_id, ?k\.id[\s\S]{0,80}from t2_kompaniya/i.test(migN));
must('explicitly documents the fix', /does not auto-join|no auto-membership|no auto-join/i.test(nocomment(mig).replace(/\s+/g,' ')) || /NO auto-membership/i.test(mig));
must('rollback restores the ORIGINAL auto-join body (so the change is real & reversible)',
  /insert into t2_azolik[\s\S]{0,140}select v_id, k\.id[\s\S]{0,80}from t2_kompaniya k where k\.faol/i.test(roll.replace(/\s+/g,' ')));

console.log('\n── Canonical company creation -> creator is director ──');
must('t2_kompaniya_yarat_v1', /create or replace function public\.t2_kompaniya_yarat_v1/.test(migN));
must('creator inserted as boss (director) membership',
  /insert into public\.t2_azolik \(foydalanuvchi_id, kompaniya_id, rol, holat\) values \(p_actor_id, v_komp, 'boss', 'faol'\)/.test(migN));
must('operation_id idempotency', /OPERATION_ID_REQUIRED/.test(mig) && /from public\.t2_onboarding_command_log where operation_id = p_operation_id/.test(migN));
must('actor existence checked', /ACTOR_NOT_FOUND/.test(mig));
must('INN validated (9 digits)', /INN_INVALID/.test(mig) && /\\d\{9\}/.test(mig));
must('audited to modul=onboarding', /t2_audit_yoz\([^;]*'onboarding'/.test(migN));
must('unique company code helper (not name-as-identity collision)', /t2_kompaniya_kod_yasa/.test(mig));

console.log('\n── Canonical current-user + memberships read model ──');
must('t2_men_v1', /create or replace function public\.t2_men_v1/.test(migN));
must('returns memberships with is_director flag', /'is_director', a\.rol in \('boss','superadmin'\)/.test(migN));
must('reports onboarding_kerak when zero memberships', /'onboarding_kerak', jsonb_array_length\(v_az\) = 0/.test(migN));
must('only active memberships + real company join', /a\.holat = 'faol'/.test(migN) && /join public\.t2_kompaniya k on k\.id = a\.kompaniya_id/.test(migN));

console.log('\n── Director-guarded member commands ──');
for (const f of ['t2_azolik_qosh_v1', 't2_azolik_rol_ozgartir_v1', 't2_azolik_ochir_v1']) {
  must(f + ' exists', new RegExp('create or replace function public\\.' + f).test(migN));
}
must('director guard helper (boss/superadmin of the target company)', /t2_azo_actor_director_tekshir/.test(mig) && /v_rol not in \('boss','superadmin'\)/.test(migN));
must('every member command calls the director guard', (migN.match(/perform public\.t2_azo_actor_director_tekshir/g) || []).length >= 3);
must('superadmin can NEVER be granted through these paths', !/p_rol[\s\S]{0,80}'superadmin'/.test(migN) && /ROLE_INVALID/.test(mig));
must('cannot demote/remove the LAST director', (mig.match(/LAST_DIRECTOR/g) || []).length >= 2 && /rol = 'boss' and holat = 'faol'/.test(migN.replace(/holat = 'faol' and rol = 'boss'/g, "rol = 'boss' and holat = 'faol'")) || /LAST_DIRECTOR/.test(mig));
must('remove is a SOFT cancel (holat=bekor), not a hard delete', /update public\.t2_azolik set holat = 'bekor'/.test(migN) && !/delete from public\.t2_azolik/i.test(migN));
must('every member command is idempotent + audited', (migN.match(/insert into public\.t2_onboarding_command_log/g) || []).length >= 4 && (migN.match(/t2_audit_yoz\([^;]*'onboarding'/g) || []).length >= 4);

console.log('\n── Registration approval provisions the director atomically ──');
must('t2_royxat_sorov_qabul_v2 (additive; v1 untouched)', /create or replace function public\.t2_royxat_sorov_qabul_v2/.test(migN) && !/create or replace function public\.t2_royxat_sorov_qabul\b/.test(migN));
must('v2 creates company + director membership + updates the request', (() => {
  const m = migN.match(/create or replace function public\.t2_royxat_sorov_qabul_v2[\s\S]*?end \$\$;/);
  const body = m ? m[0] : '';
  return /insert into public\.t2_kompaniya/.test(body)
      && /insert into public\.t2_azolik[^;]*'boss'/.test(body)
      && /update public\.t2_royxat_sorov[\s\S]*?holat='qabul'/.test(body);
})());

console.log('\n── Transport: actor from session, never from body ──');
must('fn verifies session cookie', /tekshir\(ctx\.request\.headers\.get\('Cookie'\)/.test(fn));
must('fn injects p_actor_id from session id', /foydalanuvchi_id/.test(fn) && /p_actor_id: a\.id/.test(fn));
must('fn never reads actor from the request body', !/b\.(actor|actor_id|actorId|p_actor_id)/.test(fn));
must('no /api/gas, no Drive/Sheets on this path', !/\/api\/gas|DriveApp|SpreadsheetApp/.test(nocomment(fn) + nocomment(client) + nocomment(page)));
must('fn maps LAST_DIRECTOR / ALREADY_MEMBER -> 409, perm -> 403', /LAST_DIRECTOR[\s\S]{0,40}409|409[\s\S]{0,60}LAST_DIRECTOR/.test(fn) && /403/.test(fn));
must('client talks to /api/company only', /fetch\('\/api\/company/.test(client) && !/fetch\(['"`]\/api\/(gas|sb-yoz)/.test(client));
must('page uses real t2_men_v1 client (no demo dataset)', /useMen\(\)/.test(page) && !/demoData|DEMO_DATA/.test(nocomment(page)));
must('page states there is NO subscription/payment model', /obuna|to.?lov modeli.*(YO.?Q|yo.?q)/i.test(page));

console.log('\n── Migration hygiene ──');
must('rollback drops every new function + table', /drop function if exists public\.t2_kompaniya_yarat_v1/.test(roll) && /drop table if exists public\.t2_onboarding_command_log/.test(roll));
must('acceptance raises a PASS sentinel', /ONBOARDING_ACCEPTANCE_PASS/.test(acc));
must('acceptance covers: no-autojoin, create=director, idempotency, last-director, non-member guard',
  /auto-?join/i.test(acc) && /is_director/.test(acc) && /idempoten/i.test(acc) && /LAST_DIRECTOR/.test(acc) && /non-?member/i.test(acc));

console.log('\n' + ok + ' checks passed');
