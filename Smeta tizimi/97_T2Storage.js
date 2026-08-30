/* TIZIM_02 storage resolver. This is deliberately fail-closed: no config
 * ROOT, Drive root search, or object-name search is allowed in this layer. */
var T2_STORAGE_ERROR = {
  WORKSPACE:'STORAGE_WORKSPACE_NOT_CONFIGURED', PROJECT:'PROJECT_STORAGE_NOT_BOUND',
  OBJECT:'OBJECT_STORAGE_NOT_PROVISIONED', PERMISSION:'STORAGE_PERMISSION_DENIED',
  TENANT:'STORAGE_TENANT_MISMATCH'
};
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
function _t2StorageAssertLineage(companyId, projectId, objectId){
  var c=resolveCompanyStorage(companyId), p=resolveProjectStorage(projectId), o=resolveObjectStorage(objectId);
  if(!c.ok) return c; if(!p.ok) return p; if(!o.ok) return o;
  if(p.binding.kompaniya_id!==Number(companyId)||o.binding.kompaniya_id!==Number(companyId)||o.binding.loyiha_id!==Number(projectId)||p.binding.workspace_id!==o.binding.workspace_id) return _t2StorageFail(T2_STORAGE_ERROR.TENANT,'Storage tenant/project lineage mos emas');
  return {ok:true,workspace:c.workspace,project:p.binding,object:o.binding};
}
