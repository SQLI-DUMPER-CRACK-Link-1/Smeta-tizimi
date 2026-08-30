/* Project storage provisioning: exact company workspace, no global fallback. */
const fs=require('fs'), path=require('path'), assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'..','..','Smeta tizimi','97_T2Storage.js'),'utf8');
const migration=fs.readFileSync(path.join(__dirname,'..','..','supabase','migrations','20260830052000_t2_company_storage_foundation_v1.sql'),'utf8');
const yes=(label,re,text=src)=>{assert(re.test(text),label);console.log('  ✅ '+label);};
const no=(label,re)=>{assert(!re.test(src),label);console.log('  ✅ '+label);};
yes('project provisioning entrypoint',/function\s+apiT2LoyihaStorageProvision\s*\(input\)/);
yes('explicit project operation contract',/input\.companyId[\s\S]*input\.projectId[\s\S]*input\.operationId/);
yes('canonical provisioning RPC',/t2_project_storage_provision_v1/);
yes('exact workspace root resolution',/workspace\.workspace\.root_folder_id/);
yes('idempotent verified retry',/provisioning_status==='verified'/);
yes('binding and failure RPCs',/t2_project_storage_bind_v1[\s\S]*t2_project_storage_failed_v1/);
no('no global Drive search',/DriveApp\.searchFiles/);
no('no ROOT fallback',/ROOT_FOLDER_ID|sozAsosiy\(\)\.rootId/);
yes('SQL project provisioning command',/create or replace function public\.t2_project_storage_provision_v1/,migration);
yes('SQL project binding lineage guard',/t2_project_storage_bind_v1[\s\S]*STORAGE_TENANT_MISMATCH/,migration);
yes('SQL project failed state',/t2_project_storage_failed_v1[\s\S]*provisioning_status='failed'/,migration);
