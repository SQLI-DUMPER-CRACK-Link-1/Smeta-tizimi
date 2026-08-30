/* TIZIM_02 storage resolver. This is deliberately fail-closed: no config
 * ROOT, Drive root search, or object-name search is allowed in this layer. */
var T2_STORAGE_ERROR = {
  WORKSPACE:'STORAGE_WORKSPACE_NOT_CONFIGURED', PROJECT:'PROJECT_STORAGE_NOT_BOUND',
  OBJECT:'OBJECT_STORAGE_NOT_PROVISIONED', PERMISSION:'STORAGE_PERMISSION_DENIED',
  TENANT:'STORAGE_TENANT_MISMATCH'
};
function _t2StorageFolderIdFromInput(value){
  var s=String(value||'').trim(), m=s.match(/(?:folders\/|id=)([A-Za-z0-9_-]{10,})/);
  return m?m[1]:(/^[A-Za-z0-9_-]{10,}$/.test(s)?s:null);
}
function _t2StorageFail(code, xabar){ return {ok:false, code:code, xabar:xabar}; }
function _t2StorageOne(path, code){
  var r=_t2Get(path+'&limit=2');
  if(r.length!==1) throw {code:code, message:code};
  return r[0];
}
function resolveCompanyStorage(companyId){
  try{return {ok:true, workspace:_t2StorageOne('t2_company_storage_workspace?kompaniya_id=eq.'+Number(companyId)+'&primary_workspace=is.true&status=in.(verified,legacy)&select=id,kompaniya_id,provider,mode,drive_id,root_folder_id,root_folder_name,status,legacy',T2_STORAGE_ERROR.WORKSPACE)};}
  catch(e){return _t2StorageFail(e.code||T2_STORAGE_ERROR.WORKSPACE,'Company storage workspace verified emas');}
}
function resolveProjectStorage(projectId){
  try{return {ok:true, binding:_t2StorageOne('t2_project_storage_binding?loyiha_id=eq.'+Number(projectId)+'&provisioning_status=eq.verified&select=loyiha_id,kompaniya_id,workspace_id,project_root_folder_id,provisioning_status',T2_STORAGE_ERROR.PROJECT)};}
  catch(e){return _t2StorageFail(e.code||T2_STORAGE_ERROR.PROJECT,'Project storage binding verified emas');}
}
function resolveObjectStorage(objectId){
  try{return {ok:true, binding:_t2StorageOne('t2_object_storage_binding?obyekt_id=eq.'+Number(objectId)+'&provisioning_status=eq.verified&select=obyekt_id,kompaniya_id,loyiha_id,workspace_id,folder_id,parent_folder_id,provisioning_status',T2_STORAGE_ERROR.OBJECT)};}
  catch(e){return _t2StorageFail(e.code||T2_STORAGE_ERROR.OBJECT,'Object storage binding verified emas');}
}
function resolveDocumentStorage(obyektId, tur){
  var o=resolveObjectStorage(obyektId); if(!o.ok) return o;
  return {ok:true, kompaniya_id:o.binding.kompaniya_id, loyiha_id:o.binding.loyiha_id,
          obyekt_id:o.binding.obyekt_id, folder_id:o.binding.folder_id, tur:tur};
}
function _t2StorageFolder(id){
  try{ var f=DriveApp.getFolderById(id); if(f.isTrashed()) throw 'trashed'; return f; }
  catch(e){ throw {code:T2_STORAGE_ERROR.PERMISSION,message:'Drive folder ochilmadi'}; }
}
function _t2StorageVerifyRoot(input){
  var folderId=_t2StorageFolderIdFromInput(input.rootFolderId||input.rootUrl);
  if(!folderId) throw {code:'STORAGE_ROOT_INVALID',message:'Drive root folder ID/URL noto\'g\'ri'};
  var folder=_t2StorageFolder(folderId), driveId=null, detected='my_drive';
  try{
    if(typeof Drive!=='undefined'&&Drive.Files&&Drive.Files.get){
      var meta=Drive.Files.get(folderId,{supportsAllDrives:true,fields:'id,mimeType,trashed,driveId,capabilities(canAddChildren)'});
      if(!meta||meta.mimeType!=='application/vnd.google-apps.folder'||meta.trashed) throw {code:'STORAGE_ROOT_INVALID',message:'Drive root folder emas yoki o\'chirilgan'};
      driveId=meta.driveId||null; detected=driveId?'shared_drive':'my_drive';
      if(meta.capabilities&&meta.capabilities.canAddChildren===false) throw {code:'STORAGE_ROOT_NOT_WRITABLE',message:'Drive root yozilmaydi'};
    }
    var probe=folder.createFolder('.t2-storage-verify-'+String(input.operationId).slice(0,8));
    try{probe.setTrashed(true);}catch(ignore){}
  }catch(e){ if(e.code) throw e; throw {code:'STORAGE_PERMISSION_DENIED',message:'Drive root o\'qish/yozish taqiqlandi'}; }
  if(input.mode&&input.mode!==detected) throw {code:'STORAGE_MODE_MISMATCH',message:'Drive mode mos emas'};
  return {folderId:folderId,folderName:folder.getName(),driveId:driveId,mode:detected};
}
function apiT2CompanyStorageBind(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) return {ok:false,code:'STORAGE_ROOT_INVALID'};
  var companyId=Number(input.companyId),operationId=String(input.operationId||'').trim();
  if(!companyId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return {ok:false,code:'STORAGE_ROOT_INVALID'};
  try{
    var verified=_t2StorageVerifyRoot({rootFolderId:input.folderId,rootUrl:input.rootUrl,mode:input.mode,operationId:operationId});
    var result=_t2Rpc('t2_company_storage_bind_v1',{p_kompaniya_id:companyId,p_root_folder_id:verified.folderId,p_root_folder_name:verified.folderName,p_provider:'google_drive',p_mode:verified.mode,p_drive_id:verified.driveId,p_operation_id:operationId,p_expected_version:input.expectedVersion==null?null:Number(input.expectedVersion),p_legacy:input.legacy===true});
    return result||{ok:false,code:'STORAGE_ROOT_INVALID'};
  }catch(e){return {ok:false,code:e.code||'STORAGE_PERMISSION_DENIED',xabar:e.message||String(e)};}
}
/** Provision a project's root folder under its verified company workspace. */
function apiT2LoyihaStorageProvision(input){
  if(!input||typeof input!=='object'||Array.isArray(input)) return {ok:false,code:'PROJECT_CONTEXT_REQUIRED'};
  var companyId=Number(input.companyId),projectId=Number(input.projectId),operationId=String(input.operationId||'').trim();
  if(!companyId||!projectId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return {ok:false,code:'PROJECT_CONTEXT_REQUIRED'};
  var binding=null;
  try{
    var r=_t2Rpc('t2_project_storage_provision_v1',{p_kompaniya_id:companyId,p_loyiha_id:projectId,p_operation_id:operationId,p_expected_version:input.expectedVersion==null?null:Number(input.expectedVersion)});
    if(!r||!r.ok) return r||{ok:false,code:'PROJECT_STORAGE_PROVISION_FAILED'};
    binding=r;
    if(r.provisioning_status==='verified'&&r.project_root_folder_id) return {ok:true,project_id:projectId,workspace_id:r.workspace_id,project_root_folder_id:r.project_root_folder_id,provisioning_status:'verified',operationId:operationId,retry:true};
    var workspace=resolveCompanyStorage(companyId); if(!workspace.ok) throw workspace;
    var parent=_t2StorageFolder(workspace.workspace.root_folder_id);
    var project=_t2Get('t2_loyiha?id=eq.'+projectId+'&kompaniya_id=eq.'+companyId+'&select=id,nom&limit=1');
    if(project.length!==1) throw {code:'PROJECT_COMPANY_MISMATCH',message:'project companyga tegishli emas'};
    var canonical='T2-PROJECT-'+projectId+' — '+String(project[0].nom||'Project').trim();
    var it=parent.getFoldersByName(canonical), folder;
    if(it.hasNext()){ folder=it.next(); if(it.hasNext()) throw {code:'PROJECT_STORAGE_AMBIGUOUS',message:'project folder duplicate'}; }
    else folder=parent.createFolder(canonical);
    var done=_t2Rpc('t2_project_storage_bind_v1',{p_kompaniya_id:companyId,p_loyiha_id:projectId,p_workspace_id:workspace.workspace.id,p_project_root_folder_id:folder.getId(),p_operation_id:operationId});
    if(!done||!done.ok) throw {code:(done&&done.code)||'PROJECT_STORAGE_NOT_BOUND',message:'project storage binding yozilmadi'};
    return {ok:true,project_id:projectId,workspace_id:workspace.workspace.id,project_root_folder_id:folder.getId(),provisioning_status:'verified',operationId:operationId};
  }catch(e){
    if(binding&&binding.project_id){try{_t2Rpc('t2_project_storage_failed_v1',{p_loyiha_id:projectId,p_operation_id:operationId,p_error:e.message||String(e)});}catch(ignore){}}
    return {ok:false,code:e.code||'PROJECT_STORAGE_PROVISION_FAILED',project_id:projectId,provisioning_status:'failed',xabar:e.message||String(e)};
  }
}
function _t2StorageAssertLineage(companyId, projectId, objectId){
  var c=resolveCompanyStorage(companyId), p=resolveProjectStorage(projectId), o=resolveObjectStorage(objectId);
  if(!c.ok) return c; if(!p.ok) return p; if(!o.ok) return o;
  if(p.binding.kompaniya_id!==Number(companyId)||o.binding.kompaniya_id!==Number(companyId)||o.binding.loyiha_id!==Number(projectId)||p.binding.workspace_id!==o.binding.workspace_id) return _t2StorageFail(T2_STORAGE_ERROR.TENANT,'Storage tenant/project lineage mos emas');
  return {ok:true,workspace:c.workspace,project:p.binding,object:o.binding};
}
