/* T2 object-create vertical slice: contract and fail-closed source guard. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const file = path.join(__dirname, '..', '..', 'Smeta tizimi', '06_ObyektPapka.js');
const src = fs.readFileSync(file, 'utf8');
const must = (label, re) => { assert(re.test(src), label); console.log('  ✅ ' + label); };
const mustNot = (label, re) => { assert(!re.test(src), label); console.log('  ✅ ' + label); };

must('canonical object create entrypoint', /function\s+apiT2YangiObyektYarat\s*\(input\)/);
must('explicit company/project/name/operation fields', /input\.companyId[\s\S]*input\.projectId[\s\S]*input\.name[\s\S]*input\.operationId/);
must('project-scoped resolver before RPC', /_t2StorageProject\(companyId,projectId\)/);
must('idempotent create RPC', /t2_object_create_v1/);
must('object binding RPC', /t2_object_storage_bind_v1/);
must('failure state RPC', /t2_object_create_failed_v1/);
mustNot('no ROOT_FOLDER_ID fallback', /ROOT_FOLDER_ID/);
mustNot('no global root search', /DriveApp\.searchFiles/);
mustNot('no config-root or My-Drive-root folder lookup', /sozAsosiy\(\)|getRootFolder\(\)\s*\.\s*getFoldersByName/);
// Idempotent child-folder reuse is allowed ONLY within the DB-provided
// canonical parent (project_root_folder_id -> _t2StorageFolderId(...)).
must('existing-object storage provision entrypoint', /function\s+apiT2ObjectStorageProvision\s*\(input\)/);
must('provision resolves canonical parent from project_root_folder_id', /_t2StorageFolderId\(prov\.project_root_folder_id\)/);

// Behavioral boundary: run the real GAS entrypoint with a tenant-mismatched
// project resolver. A Drive folder must never be created after a failed
// canonical lineage lookup.
const vm = require('vm');
let folderCreates = 0;
const context = {
  _t2Get: () => [],
  resolveCompanyStorage: () => ({ok:true, workspace:{id:11}}),
  resolveProjectStorage: () => ({ok:true, binding:{kompaniya_id:2,workspace_id:11,project_root_folder_id:'p'}}),
  _t2Rpc: () => ({ok:true}),
  DriveApp: { getFolderById: () => ({isTrashed:() => false, createFolder:() => {folderCreates++;}}) },
  String, Number, Array, Object, RegExp
};
vm.createContext(context);
vm.runInContext(src, context);
const denied = context.apiT2YangiObyektYarat({companyId:1,actorId:9,projectId:4,name:'x',operationId:'11111111-1111-4111-8111-111111111111'});
assert.strictEqual(denied.ok, false, 'tenant mismatch must fail');
assert.strictEqual(denied.code, 'PROJECT_COMPANY_MISMATCH');
assert.strictEqual(folderCreates, 0, 'failed lineage must not create a Drive folder');
console.log('  ✅ behavioral tenant mismatch is fail-closed before Drive write');

/* ── apiT2ObjectStorageProvision: canonical-parent-scoped folder resolution ── */
const OP = '22222222-2222-4222-8222-222222222222';
function provCtx(childFoldersByName) {
  const state = { getFolderByIdCalls: [], searchedParentIds: [], created: 0 };
  const iter = (arr) => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const mkFolder = (id) => ({
    getId: () => id, getName: () => id, isTrashed: () => false,
    getFoldersByName: (n) => { state.searchedParentIds.push(id); return iter((childFoldersByName[n] || [])); },
    createFolder: (n) => { state.created++; return mkFolder('NEW__' + n); },
  });
  const ctx = {
    _t2Get: () => [{ nom: 'Fast food' }],
    DriveApp: { getFolderById: (id) => { state.getFolderByIdCalls.push(id); return mkFolder(String(id)); } },
    _t2Rpc: (fn) => {
      if (fn === 't2_object_storage_provision_v1') return { ok: true, loyiha_id: 4, workspace_id: 2, project_root_folder_id: 'CANON_ROOT', existing_folder_id: null, storage_status: 'pending', version: 1 };
      return { ok: true };
    },
    String, Number, Array, Object, RegExp,
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  return { ctx, state };
}

const child = (id) => ({ getId: () => id, getName: () => id, isTrashed: () => false });

// (a) 0 matches in the canonical parent -> creates exactly one folder there,
//     and the ONLY folder ever opened by id is the canonical project root.
let t = provCtx({});
let r = t.ctx.apiT2ObjectStorageProvision({ companyId: 1, actorId: 9, objectId: 5, operationId: OP });
assert.strictEqual(r.ok, true, '0-match: provision ok');
assert.strictEqual(t.state.created, 1, '0-match: exactly one folder created');
assert.deepStrictEqual([...new Set(t.state.searchedParentIds)], ['CANON_ROOT'], 'name lookup only inside the canonical project root');
assert.ok(t.state.getFolderByIdCalls.every((id) => id === 'CANON_ROOT'), 'no global/company/other folder opened by id');
console.log('  ✅ canonical-parent scoped lookup, 0 match -> one folder created in the canonical parent only');

// (b) exactly 1 match -> reuse, no new folder
const one = provCtx({ 'Fast food': [child('EXIST1')] });
r = one.ctx.apiT2ObjectStorageProvision({ companyId: 1, actorId: 9, objectId: 5, operationId: OP });
assert.strictEqual(r.ok, true, '1-match: ok');
assert.strictEqual(one.state.created, 0, '1-match: must reuse, not create');
assert.deepStrictEqual([...new Set(one.state.searchedParentIds)], ['CANON_ROOT'], '1-match: lookup only inside canonical parent');
console.log('  ✅ 1 match inside canonical parent -> reused for idempotency (no duplicate)');

// (c) >1 match -> FAIL CLOSED with OBJECT_STORAGE_AMBIGUOUS, no folder created
const many = provCtx({ 'Fast food': [child('DUP1'), child('DUP2')] });
r = many.ctx.apiT2ObjectStorageProvision({ companyId: 1, actorId: 9, objectId: 5, operationId: OP });
assert.strictEqual(r.ok, false, '>1-match: must fail');
assert.strictEqual(r.code, 'OBJECT_STORAGE_AMBIGUOUS', '>1-match: OBJECT_STORAGE_AMBIGUOUS');
assert.strictEqual(many.state.created, 0, '>1-match: must not create a duplicate folder');
console.log('  ✅ >1 match inside canonical parent -> FAIL CLOSED (OBJECT_STORAGE_AMBIGUOUS), no duplicate');

console.log('  ✅ object-create static contract');
