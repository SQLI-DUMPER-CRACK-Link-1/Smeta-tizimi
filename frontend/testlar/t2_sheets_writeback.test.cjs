/* SHEETS write-back REFERENCE implementation (FILE-TRUTH-001 §8).
   INVARIANTS: stable entity_id (never a row number) + base_version + operation_id.
   One real reusable path; legacy per-sheet write-backs stay DEFERRED-P1. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let ok = 0;
const must = (l, c) => { assert(c, l); console.log('  ✅ ' + l); ok++; };

const mig = R('supabase', 'migrations', '20260908120000_t2_sheets_writeback_reference_v1.sql');
const migN = mig.replace(/\s+/g, ' ');
const roll = R('supabase', 'migrations', '20260908120000_t2_sheets_writeback_reference_v1.rollback.sql');
const acc = R('supabase', 'migrations', '20260908120000_t2_sheets_writeback_reference_v1.acceptance.sql');
const worker = R('Smeta tizimi', '99_T2SheetsReplica.js');
const tasnif = R('tizim02', 'tasnif.json');

console.log('\n── Reference RPC: stable id + base_version + operation_id ──');
must('t2_document_sheets_writeback_v1 exists', /create or replace function public\.t2_document_sheets_writeback_v1/.test(migN));
must('operation_id required + idempotency ledger', /OPERATION_ID_REQUIRED/.test(mig) && /from public\.t2_sheets_writeback_log where operation_id ?= ?p_operation_id/.test(migN));
must('membership-checked', /perform public\.t2_actor_kompaniya_azo_tekshir\(p_kompaniya_id, ?p_actor_id\)/.test(migN));
must('a pure-numeric sheets_entity_id (row number) is REJECTED', /p_sheets_entity_id ~ '\^\\d\+\$'[\s\S]{0,80}SHEETS_ROW_NUMBER_REJECTED/.test(migN));
must('stable id mismatch is rejected (never overwrites wrong entity)', /SHEETS_ENTITY_MISMATCH/.test(mig));
must('base_version drift -> SHEETS_CONFLICT (no last-write-wins)', /d\.versiya ?<> ?p_base_version[\s\S]{0,80}SHEETS_CONFLICT/.test(migN));
must('only whitelisted fields are write-backable', /p_field not in \('original_filename','document_type'\)[\s\S]{0,60}SHEETS_FIELD_NOT_WRITEBACKABLE/.test(migN));
must('successful write-back bumps versiya + audits + logs operation_id', /versiya = versiya \+ 1/.test(migN) && /t2_audit_yoz\([^;]*'file_truth'/.test(migN) && /insert into public\.t2_sheets_writeback_log/.test(migN));
must('service_role only', /revoke all on function public\.t2_document_sheets_writeback_v1/.test(mig));
must('documented as the template for other Sheets entities', /template for all Sheets entity write-backs|template every other Sheets entity/i.test(mig));

console.log('\n── Reference worker (99_T2SheetsReplica.js) ──');
must('registered in tasnif.json', /"99_T2SheetsReplica\.js": ?"kopruk"/.test(tasnif));
must('entry point apiT2SheetsReplicaTick', /function apiT2SheetsReplicaTick\(\)/.test(worker));
must('iterates ONLY registered sheets replica jobs (no spreadsheet/Drive-wide scan)',
  /t2_replica_sync_job\?target=eq\.sheets/.test(worker) && !/DriveApp\.getFiles\(\)|getFilesByName\(/.test(worker));
must('locates rows by a hidden STABLE-id column, never by row index',
  /T2SH_ID_COL_HEADER = 't2_entity_id'/.test(worker) && /header\.indexOf\(T2SH_ID_COL_HEADER\)/.test(worker));
must('returns null (not a row fallback) when the stable id is absent',
  /if \(idCol < 0\) return null/.test(worker) && /NEVER falls back to a row index/.test(worker));
must('calls the canonical RPC with sheets_entity_id + base_version + operation_id',
  /p_sheets_entity_id: d\.sheets_entity_id/.test(worker) && /p_base_version: d\.versiya/.test(worker) && /p_operation_id: opId/.test(worker));
must('SHEETS_CONFLICT is surfaced, never last-write-wins', /r\.code === 'SHEETS_CONFLICT'/.test(worker));
must('identity law stated in the header', /ROW NUMBER is never an identity/i.test(worker));

console.log('\n── Hygiene + scope note ──');
must('rollback drops the function + ledger', /drop function if exists public\.t2_document_sheets_writeback_v1/.test(roll) && /drop table if exists public\.t2_sheets_writeback_log/.test(roll));
must('acceptance raises a PASS sentinel', /SHEETS_WRITEBACK_ACCEPTANCE_PASS/.test(acc));
must('acceptance covers row-number reject, base_version, happy path, idempotency, entity mismatch',
  /row-?number/i.test(acc) && /base_version/i.test(acc) && /idempoten/i.test(acc) && /SHEETS_ENTITY_MISMATCH/.test(acc));
must('legacy per-sheet write-backs explicitly marked DEFERRED-P1', /DEFERRED-P1/.test(mig) && /DEFERRED-P1/.test(worker));

console.log('\n' + ok + ' checks passed');
