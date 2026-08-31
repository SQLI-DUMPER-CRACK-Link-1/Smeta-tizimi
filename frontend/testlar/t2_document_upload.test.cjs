const fs=require('fs'),path=require('path'),assert=require('assert');
const doc=fs.readFileSync(path.join(__dirname,'..','..','Smeta tizimi','95_ObyektHujjat.js'),'utf8');
const panel=fs.readFileSync(path.join(__dirname,'..','..','Smeta tizimi','30_Panel.js'),'utf8');
const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','migrations','20260830052000_t2_company_storage_foundation_v1.sql'),'utf8');
const upload=fs.readFileSync(path.join(__dirname,'..','..','Smeta tizimi','T2_Yuklash.js'),'utf8');
const yes=(l,r,t)=>{assert(r.test(t),l);console.log('  ✅ '+l);};
const body=doc.slice(doc.indexOf('function apiT2DocumentUpload'),doc.indexOf('function apiT2DocumentUpload')+2600);
yes('canonical document upload entrypoint',/function\s+apiT2DocumentUpload\s*\(input\)/,doc);
yes('explicit object lineage IDs',/input\.companyId[\s\S]*input\.projectId[\s\S]*input\.objectId[\s\S]*input\.operationId/,body);
yes('object storage resolver',/_t2StorageAssertLineage\(companyId,projectId,objectId\)/,body);
yes('exact bound folder',/lineage\.object\.folder_id/,body);
yes('operation-scoped file recovery',/operationId\+'__'/,body);
yes('registry write RPC',/t2_document_registry_upsert_v1/,body);
yes('T2 F2 adapter',/function\s+apiT2F2Upload\s*\(input\)/,panel);
yes('registry operation idempotency',/t2_document_registry_operation_uq/,sql);
yes('registry lineage guard',/t2_document_registry_upsert_v1[\s\S]*STORAGE_TENANT_MISMATCH/,sql);
assert(!/ROOT_FOLDER_ID|sozAsosiy\(\)\.rootId|DriveApp\.searchFiles/.test(body));
const facade=upload.match(/function\s+apiT2FaylYukla\s*\([^)]*\)\s*\{[^}]*\}/);
assert(facade && /LEGACY_WORKSPACE_FORBIDDEN/.test(facade[0]),'root-scoped upload facade must fail closed');
assert(/function\s+apiT2LegacyFaylYukla\s*\(/.test(upload),'legacy adapter must be explicit');
console.log('  ✅ new T2 upload facade rejects global-root fallback');
const vm=require('vm'); let wrote=false;
const context={
  _t2StorageAssertLineage:()=>({ok:false,code:'OBJECT_STORAGE_NOT_PROVISIONED'}),
  _t2StorageFolder:()=>{throw new Error('must not resolve folder');},
  DriveApp:{}, Utilities:{}, String,Number,Array,Object,RegExp
};
vm.createContext(context); vm.runInContext(doc,context);
const denied=context.apiT2DocumentUpload({companyId:1,actorId:3,projectId:2,objectId:8,operationId:'11111111-1111-4111-8111-111111111111',base64:'eA=='});
assert.strictEqual(denied.ok,false); assert.strictEqual(denied.code,'OBJECT_STORAGE_NOT_PROVISIONED'); assert.strictEqual(wrote,false);
console.log('  ✅ behavioral missing object binding fails before Drive write');
console.log('  ✅ document upload global fallback guard');
