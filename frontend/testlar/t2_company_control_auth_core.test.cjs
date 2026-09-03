/* T2-COMPANY-CONTROL-AUTH-CORE-002: source-only regression oracle.
 * `npm run tekshir`ga ataylab ulanmagan: Claude integratsiyasida u hammasi.cjs
 * ro'yxatiga qo'shiladi. Hozir `node testlar/t2_company_control_auth_core.test.cjs`.
 */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let bad = 0;
function must(label, value) { if (value) console.log('✅ ' + label); else { console.error('❌ ' + label); bad++; } }

const write = read('frontend/functions/api/sb-yoz.ts');
const migration = read('supabase/migrations/20260915120000_t2_effective_authorization_core_v1.sql');
const acceptance = read('supabase/migrations/20260915120000_t2_effective_authorization_core_v1.acceptance.sql');

console.log('\n── Legacy P0 yopilishi ──');
must('a’zolik gatewaylari faqat director-guarded _v1 RPCga boradi',
  /azolik_qosh:\s*\{ rpc: 't2_azolik_qosh_v1' \}/.test(write) &&
  /azolik_rol_ozgartir:\s*\{ rpc: 't2_azolik_rol_ozgartir_v1' \}/.test(write) &&
  /azolik_ochir:\s*\{ rpc: 't2_azolik_ochir_v1' \}/.test(write));
must('gateway a’zolik commandiga actorni verified sessiyadan yuboradi',
  /p_actor_id:\s*sess\.foydalanuvchi_id/.test(write));
must('company profil targeti sessiya membershipi bilan tekshiriladi',
  /kompaniya_yangila[\s\S]{0,1600}sess\.kompaniyalar\.some/.test(write));

console.log('\n── Effective authorization core ──');
must('platform signal t2_azolikdan, parallel platform jadvalisiz olinadi',
  /from public\.t2_azolik a/.test(migration) && /a\.rol in \('superadmin','admin'\)/.test(migration) && !/create table if not exists public\.t2_platforma_rol/.test(migration));
must('target company membership roli platform signalidan alohida olinadi',
  /a\.kompaniya_id = p_kompaniya_id/.test(migration) && /v_membership/.test(migration));
must('capability registry qayta ishlatiladi', /t2_capability_effective_v1/.test(migration));
must('project/object uchun natural access bridge bor', /t2_loyiha_foydalanuvchi_ruxsat/.test(migration) && /t2_obyekt_foydalanuvchi_ruxsat/.test(migration));
must('authorization read-model qulf ishlatmaydi', !/for\s+(update|share)/i.test(migration));
must('yangi jadvallarda RLS va public revoke bor', /enable row level security/.test(migration) && /from public, anon, authenticated/.test(migration));
must('effective RPC service_role only', /grant execute on function public\.t2_effective_authorization_v1[\s\S]{0,180}to service_role/.test(migration));
must('acceptance A-J ssenariylarini qamraydi',
  /normal_member/.test(acceptance) && /revoked_member/.test(acceptance) && /role_changed/.test(acceptance) &&
  /forged_company/.test(acceptance) && /platform_global/.test(acceptance) && /non_platform_global/.test(acceptance) &&
  /project_denied/.test(acceptance) && /object_denied/.test(acceptance) && /unknown_role/.test(acceptance) && /capability_disabled/.test(acceptance));
must('acceptance sentinel mavjud', /AUTH_CORE_ACCEPTANCE_PASS/.test(acceptance));

if (bad) { console.error(`\nAUTH CORE: ${bad} ta kontrakt buzildi`); process.exit(1); }
console.log('\nAUTH CORE: PASS');
