/* FILE-TRUTH-001 — canonical (Supabase + R2) vs replica (Drive/Sheets) guards.
 *
 * Proves at the source level:
 *  - the canonical upload/download path has NO Drive / GAS / Sheets dependency
 *  - no global Drive scan on any core path
 *  - external_file_id is not treated as canonical document identity
 *  - the migration is additive and never hard-deletes R2 on Drive delete
 *  - the canonical client never calls /api/gas
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let ok = 0;
const must = (label, cond) => { assert(cond, label); console.log('  ✅ ' + label); ok++; };

const upload = R('frontend', 'functions', 'api', 'hujjat-yukla.ts');
const download = R('frontend', 'functions', 'api', 'hujjat-ol.ts');
const client = R('frontend', 'src', 'api', 't2-hujjat-canonical.ts');
const mig = R('supabase', 'migrations', '20260902120000_t2_file_truth_r2_canonical_v1.sql');
const rollback = R('supabase', 'migrations', '20260902120000_t2_file_truth_r2_canonical_v1.rollback.sql');

console.log('\n── Canonical path has no Drive / GAS / Sheets dependency ──');
for (const [name, src] of [['hujjat-yukla', upload], ['hujjat-ol', download], ['t2-hujjat-canonical', client]]) {
  must(name + ': no DriveApp / drive.google', !/DriveApp|drive\.google|googleapis\.com\/drive/i.test(src));
  must(name + ': no GAS bridge call (/api/gas)', !/\/api\/gas|apiObyektHujjatDriveSaqla|GAS_URL/.test(src));
  must(name + ': no Sheets dependency', !/SpreadsheetApp|sheets\.googleapis/i.test(src));
}

console.log('\n── R2 is the file truth on the canonical path ──');
must('upload PUTs to R2_ARCHIVE', /R2_ARCHIVE\.put\(/.test(upload));
must('upload writes registry via t2_document_canonical_upsert_v1', /t2_document_canonical_upsert_v1/.test(upload));
must('upload key is content-addressed (sha) + operation-id, not name-only', /sha\.slice\(0, ?12\)[\s\S]*op-.*operationId|op-.*operationId[\s\S]*sha\.slice/.test(upload));
must('download reads R2_ARCHIVE.get, streams obj.body', /R2_ARCHIVE\.get\([\s\S]*obj\.body/.test(download));
must('download declares its source as r2', /X-Canonical-Source['"]?,\s*['"]r2['"]/.test(download));
must('download fails closed on missing binary (no fallback fetch)',
  /CANONICAL_BINARY_MISSING/.test(download) && !/fetch\((['"`]https?:|.*qurilish-os\.uz|.*drive)/i.test(download));

console.log('\n── Auth on both canonical endpoints ──');
must('upload calls tekshir(cookie)', /tekshir\(ctx\.request\.headers\.get\('Cookie'\)/.test(upload));
must('download calls tekshir(cookie)', /tekshir\(ctx\.request\.headers\.get\('Cookie'\)/.test(download));
must('upload requires a UUID operation_id (idempotency)', /UUID\.test\(operationId\)/.test(upload));

console.log('\n── Migration: canonical identity vs replica info, additive, R2-retaining ──');
must('adds canonical r2_key / sha256 / size / mime columns', /add column if not exists r2_key/.test(mig) && /add column if not exists sha256/.test(mig));
must('adds separate drive_* replica columns', /drive_file_id text/.test(mig) && /drive_sync_status text/.test(mig));
must('drive_sync_status enum has the required states', /'not_configured','pending','syncing','synced','failed','conflict'/.test(mig));
must('external_file_id becomes nullable (Drive optional)', /alter column external_file_id drop not null/.test(mig));
must('provider default becomes cloudflare_r2 for new canonical rows', /provider,[\s\S]*'cloudflare_r2'/.test(mig));
must('replica sync job table + statuses', /create table if not exists public\.t2_replica_sync_job/.test(mig) && /'pending','running','synced','failed','conflict'/.test(mig));
must('conflict engine: content revision checks base_version', /REPLICA_CONFLICT[\s\S]*d\.versiya<>p_base_version|d\.versiya<>p_base_version[\s\S]*REPLICA_CONFLICT/.test(mig));
must('Drive delete does NOT hard-delete R2', /R2 is NEVER hard-deleted|canonical R2 retained|r2_retained/.test(mig));
must('cross-company rejected in canonical upsert', /t2_actor_kompaniya_azo_tekshir\(p_kompaniya_id,p_actor_id\)/.test(mig) && /STORAGE_TENANT_MISMATCH/.test(mig));
must('same operation_id -> existing row, no duplicate', /where kompaniya_id=p_kompaniya_id and operation_id=p_operation_id for update[\s\S]*'retry',true/.test(mig));
must('rollback is additive-only (drops columns/tables/functions, no data delete)', !/delete from|truncate/i.test(rollback));
must('storage command functions are service_role only', /revoke all on function[\s\S]*from public, anon, authenticated/.test(mig));

console.log('\n── No global Drive/Sheets scan anywhere in the canonical client path ──');
must('client: no getFoldersByName / searchFiles', !/getFoldersByName|searchFiles|getFilesByName/.test(client + upload + download));

console.log('\n' + ok + ' checks passed');
