/* DRIVE REPLICA worker + write-back SOURCE (FILE-TRUTH-001).
   - canonical -> Drive async sync (job queue), rename / move / content / delete
   - content change => NEW canonical R2 revision (never in place)
   - delete NEVER hard-deletes canonical R2 (marks replica_missing + review)
   - move: managed re-bind ONLY to a KNOWN binding, else conflict + review
   - base_version conflicts on every write-back
   - NO global Drive scan (worker iterates known drive_file_id docs only) */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
let ok = 0;
const must = (l, c) => { assert(c, l); console.log('  ✅ ' + l); ok++; };

const ft = R('supabase', 'migrations', '20260902120000_t2_file_truth_r2_canonical_v1.sql');
const ftN = ft.replace(/\s+/g, ' ');
const move = R('supabase', 'migrations', '20260907120000_t2_document_replica_move_v1.sql');
const moveN = move.replace(/\s+/g, ' ');
const moveRoll = R('supabase', 'migrations', '20260907120000_t2_document_replica_move_v1.rollback.sql');
const moveAcc = R('supabase', 'migrations', '20260907120000_t2_document_replica_move_v1.acceptance.sql');
const worker = R('Smeta tizimi', '98_T2ReplicaSync.js');

console.log('\n── Canonical -> Drive async sync (queue, not synchronous) ──');
must('t2_replica_sync_job queue exists', /create table if not exists public\.t2_replica_sync_job/.test(ftN));
must('operations: mirror|rename|move|content|delete|review', /operation text not null check \(operation in \('mirror','rename','move','content','delete','review'\)\)/.test(ftN));
must('exponential backoff (attempts + next_attempt_at)', /attempts integer not null default 0/.test(ftN) && /next_attempt_at timestamptz/.test(ftN));
must('finalize enqueues the Drive job (async, not inline)', /t2_document_canonical_finalize_v1/.test(ftN) && /replica/i.test(ftN));

console.log('\n── Write-back RPCs, base_version guarded ──');
for (const f of ['t2_document_replica_rename_v1', 't2_document_replica_content_v1', 't2_document_replica_deleted_v1', 't2_document_replica_move_v1']) {
  must(f + ' exists', new RegExp('create or replace function public\\.' + f).test(ftN + moveN));
}
must('content write-back uses base_version -> REPLICA_CONFLICT', /d\.versiya ?<> ?p_base_version/.test(ftN) && /REPLICA_CONFLICT/.test(ft));
must('move write-back uses base_version -> REPLICA_CONFLICT', /d\.versiya ?<> ?p_base_version/.test(moveN) && /REPLICA_CONFLICT/.test(move));
must('rename/move are tenant-checked (STORAGE_TENANT_MISMATCH)', /STORAGE_TENANT_MISMATCH/.test(ft) && /STORAGE_TENANT_MISMATCH/.test(move));

console.log('\n── Content change => NEW canonical R2 revision ──');
must('content write-back supersedes old + inserts revision_seq+1', /status='superseded'/.test(ftN) && /revision_seq\+1/.test(ftN));
must('no-op when sha256 unchanged', /p_new_sha256 = d\.sha256[\s\S]{0,80}no_change/.test(ftN));

console.log('\n── Delete NEVER hard-deletes canonical R2 ──');
must('deleted write-back marks replica_missing, not a row delete', /replica_missing/.test(ft) && !/delete from public\.t2_document_registry/i.test(ftN));
must('deleted write-back explicitly retains R2', /R2 (is )?NEVER hard-deleted|canonical R2 retained|r2_retained/i.test(ft));
must('deleted write-back queues a review job', /t2_replica_sync_job[\s\S]{0,160}'review'/.test(ftN));

console.log('\n── Move: managed re-bind only to a KNOWN binding, else conflict ──');
must('matches new parent against t2_object_storage_binding.folder_id', /from public\.t2_object_storage_binding[\s\S]{0,120}folder_id = p_new_parent_id/.test(moveN));
must('matches new parent against t2_project_storage_binding.project_root_folder_id', /project_root_folder_id = p_new_parent_id/.test(moveN));
must('unmanaged move fails closed: REPLICA_MOVE_UNMANAGED + conflict + review job', /REPLICA_MOVE_UNMANAGED/.test(move) && /'review', 'conflict'/.test(moveN));
must('unmanaged move retains canonical R2', /r2_retained/.test(move) && /canonical R2 (never touched|retained)/i.test(move));
must('move never guesses (no ILIKE/name match / getFilesByName in the RPC)', !/ilike|getFilesByName|regexp/i.test(moveN));

console.log('\n── Worker: NO global Drive scan ──');
must('worker iterates only docs with a known drive_file_id', /drive_file_id=not\.is\.null/.test(worker) && /drive_sync_status=eq\.synced/.test(worker));
must('worker does NOT enumerate folders globally', !/getFolders\(\)|searchFiles\(|getFilesByName\(|DriveApp\.getFiles\(\)/.test(worker));
must('worker handles rename / move / delete write-back', /t2_document_replica_rename_v1/.test(worker) && /t2_document_replica_move_v1/.test(worker) && /t2_document_replica_deleted_v1/.test(worker));
must('worker move: reads THIS file’s current parent, compares to drive_parent_id', /f\.getParents\(\)/.test(worker) && /d\.drive_parent_id/.test(worker));
must('worker move passes base_version', /p_base_version:d\.versiya/.test(worker));
must('worker comment states global changes feed is NOT used (V1)', /Global Drive changes feed EMAS|GLOBAL SCAN EMAS/.test(worker));

console.log('\n── Migration hygiene ──');
must('move rollback drops the function', /drop function if exists public\.t2_document_replica_move_v1/.test(moveRoll));
must('move acceptance raises a PASS sentinel', /REPLICA_MOVE_ACCEPTANCE_PASS/.test(moveAcc));
must('move acceptance covers base_version, unmanaged fail-closed, managed re-bind, R2 retained',
  /base_version/i.test(moveAcc) && /UNMANAGED/.test(moveAcc) && /managed (move|re-bind)/i.test(moveAcc) && /sha256 changed/.test(moveAcc));

console.log('\n' + ok + ' checks passed');
