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
mustNot('no object-name root lookup', /getFoldersByName\(name\)/);
console.log('  ✅ object-create static contract');
