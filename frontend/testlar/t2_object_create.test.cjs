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
console.log('  ✅ object-create static contract');
