/* TIZIM_02 object provisioning boundary. Business identity is DB IDs only. */
function _t2StorageFolderId(id){
  if(!id) throw {code:'STORAGE_PERMISSION_DENIED',message:'storage folder id bo\'sh'};
  try{ var f=DriveApp.getFolderById(String(id)); if(f.isTrashed()) throw 'trashed'; return f; }
  catch(e){ throw {code:'STORAGE_PERMISSION_DENIED',message:'project storage folder ochilmadi'}; }
}
function _t2StorageProject(companyId,projectId){
  var p=_t2Get('t2_loyiha?id=eq.'+Number(projectId)+'&kompaniya_id=eq.'+Number(companyId)+'&select=id,kompaniya_id&limit=1');
  if(p.length!==1) throw {code:'PROJECT_COMPANY_MISMATCH',message:'project companyga tegishli emas'};
  var w=resolveCompanyStorage(companyId); if(!w.ok) throw w;
  var b=resolveProjectStorage(projectId); if(!b.ok) throw b;
  if(Number(b.binding.kompaniya_id)!==Number(companyId)||Number(b.binding.workspace_id)!==Number(w.workspace.id)) throw {code:'STORAGE_TENANT_MISMATCH',message:'storage lineage mos emas'};
  return {workspace:w.workspace,binding:b.binding};
}
/** Canonical T2 create. Name-only calls are invalid. */
function apiT2YangiObyektYarat(input){
  if(!input||Array.isArray(input)||typeof input!=='object') return {ok:false,code:'PROJECT_CONTEXT_REQUIRED',xabar:'companyId, projectId, name va operationId majburiy'};
  var companyId=Number(input.companyId),projectId=Number(input.projectId),name=String(input.name||'').trim(),operationId=String(input.operationId||'').trim();
  if(!companyId||!projectId||!name||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return {ok:false,code:'PROJECT_CONTEXT_REQUIRED',xabar:'companyId, projectId, name va UUID operationId majburiy'};
  try{
    var storage=_t2StorageProject(companyId,projectId);
    var existing=_t2Rpc('t2_object_create_v1',{p_kompaniya_id:companyId,p_loyiha_id:projectId,p_nom:name,p_operation_id:operationId,p_expected_version:input.expectedVersion==null?null:Number(input.expectedVersion)});
    if(!existing||!existing.ok) return existing||{ok:false,code:'OBJECT_CREATE_FAILED'};
    if(existing.storage_status==='ready') return existing;
    var parent=_t2StorageFolderId(storage.binding.project_root_folder_id),folder=parent.createFolder(name);
    var bound=_t2Rpc('t2_object_storage_bind_v1',{p_obyekt_id:existing.obyekt_id,p_kompaniya_id:companyId,p_loyiha_id:projectId,p_workspace_id:storage.workspace.id,p_folder_id:folder.getId(),p_parent_folder_id:parent.getId(),p_operation_id:operationId});
    if(!bound||!bound.ok) throw {code:'OBJECT_STORAGE_NOT_PROVISIONED',message:'object storage binding yozilmadi'};
    _t2Rpc('t2_object_create_ready_v1',{p_obyekt_id:existing.obyekt_id,p_operation_id:operationId});
    return {ok:true,obyekt_id:existing.obyekt_id,folderId:folder.getId(),storage_status:'ready',operationId:operationId};
  }catch(e){
    if(typeof existing!=='undefined'&&existing&&existing.obyekt_id){
      try{_t2Rpc('t2_object_create_failed_v1',{p_obyekt_id:existing.obyekt_id,p_operation_id:operationId,p_error:e.message||String(e)});}catch(ignore){}
    }
    return {ok:false,code:e.code||'OBJECT_CREATE_FAILED',obyekt_id:(typeof existing!=='undefined'&&existing&&existing.obyekt_id)||e.obyekt_id||null,storage_status:'failed',xabar:e.message||String(e)};
  }
}
function apiT2ObyektYarat(input){return apiT2YangiObyektYarat(input);}
function _papkaOlYokiYarat(ota,nom){var it=ota.getFoldersByName(nom);return it.hasNext()?it.next():ota.createFolder(nom);}
function _t2ObyektYangiTuzilmaMi(folder){try{return folder.getFoldersByName('SMETA').hasNext();}catch(e){return false;}}
function _t2ObyektPapkaTuzilmaYarat(folder){var s=_papkaOlYokiYarat(folder,'SMETA');return{smeta:s,f2:_papkaOlYokiYarat(s,'F2'),loyiha:_papkaOlYokiYarat(folder,'Loyihalar va Chizmalar'),viborka:_papkaOlYokiYarat(folder,'Viborka'),tizim:_papkaOlYokiYarat(folder,'Tizim Fayllari')};}
