/* RES V2: hujjat satrini PTO tanlaydi; server hech qachon pozitsiya yoki
 * taxminiy o'xshashlik bilan narx yozmaydi. Bu source-level qo'riqchi DB
 * acceptance o'rnini bosmaydi, lekin gateway/migration siljishini ushlaydi. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const oqi = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let xato = 0;
function t(nom, shart) { if (shart) console.log('  ✅ ' + nom); else { xato++; console.log('  ❌ ' + nom); } }

const gateway = oqi('functions/api/sb-yoz.ts');
const api = oqi('src/api/t2-smeta-narxlash.ts');
const sql = oqi('../supabase/migrations/20261011140000_t2_smeta_narxla_res_v2.sql');

t('Gateway faqat V2 named RPCni chaqiradi', gateway.includes("smeta_narxla_res_v2: { rpc: 't2_smeta_narxla_res_v2' }") && api.includes("amal: 'smeta_narxla_res_v2'"));
t('Manba satri IDsi majburiy va takrorlanmas', gateway.includes('source_ref') && gateway.includes('RES manba satri IDlari takrorlangan'));
t('Qo\'lda bog\'lash qator IDsi bo\'yicha takrorlanmaydi', gateway.includes('qoldaMoslash.some') && gateway.includes('qoldaMoslash.map'));
t('RPC qo\'lda tanlangan manba aynan importda borligini tekshiradi', sql.includes('join source_raw s on s.source_ref = m.source_ref'));
t('RPC boshqa tenant/obyektdagi qatorga yo\'l bermaydi', sql.includes('q.kompaniya_id = p_kompaniya_id') && sql.includes('q.obyekt_id = p_obyekt_id'));
t('Qo\'lda bog\'lash avtomatik aniq moslikni almashtirmaydi', sql.includes('left join auto_unique a on a.id = m.qator_id') && sql.includes('where a.id is null'));
t('Normalizatsiyada bo\'sh qolgan kalit avtomatik moslashmaydi', (sql.match(/where nom_key <> '' and birlik_key <> ''/g) || []).length >= 3);
t('Mavjud narx qayta yozilmaydi', (sql.match(/q\.narx is null or q\.narx = 0/g) || []).length >= 2);
t('F2 yoki nom mutatsiyasi yo\'q', !/update public\.t2_akt\b/i.test(sql) && !/set\s+nom\s*=/i.test(sql));
t('Idempotentlik va audit saqlangan', sql.includes('t2_onboarding_command_log') && sql.includes('t2_audit_yoz'));

console.log(`\n═══ ${10 - xato} o'tdi, ${xato} yiqildi ═══`);
process.exit(xato ? 1 : 0);
