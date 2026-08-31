/********************************************************************
 * 95_ObyektHujjat.js — OBYEKT HUJJATLARI: R2 → DRIVE DUAL-STORAGE
 * ==================================================================
 * ⚠️ EGALIK: CLAUDE (arxitektura/ko'prik qatlami). Antigravity tegmaydi.
 *
 * NIMA UCHUN BOR: foydalanuvchi ko'rsatmasi — Tizim_02 dagi "Obyekt
 * hujjatlari" (t2_obyekt_hujjat) fayllari faqat Cloudflare R2 ga
 * yuklanardi. Endi HAR BIR FAYL Drive'dagi tegishli obyekt papkasi
 * ichiga ham (asl nomi bilan) nusxa sifatida saqlanadi — R2 tezkor
 * so'rov uchun, Drive esa foydalanuvchi allaqachon ishlatib kelayotgan
 * "haqiqiy" fayl tizimi bo'lib qoladi.
 *
 * BU FUNKSIYA "BEST-EFFORT": chaqiruvchi (Cloudflare Pages Function
 * /api/gas orqali) R2 yozuvidan KEYIN, alohida so'rov bilan chaqiradi.
 * Bu yerda xato bo'lsa ham t2_obyekt_hujjat yozuvi (R2 asosiy nusxa)
 * allaqachon saqlangan bo'ladi — Drive faqat QO'SHIMCHA nusxa.
 ********************************************************************/

/**
 * @param {string} obyektNomi  — Tizim_01 dagi obyekt/papka nomi (Tizim_02
 *                                obyekt nomi bilan bir xil bo'lishi kerak).
 * @param {string} hujjatTuri  — 'loyiha' | 'hujjat'
 * @param {string} faylNomi    — asl fayl nomi (kengaytma bilan)
 * @param {string} mimeType    — fayl MIME turi
 * @param {string} base64      — fayl mazmuni base64 kodlangan holda
 * @return {{ok:boolean, fileId?:string, url?:string, error?:string}}
 */
function apiObyektHujjatDriveSaqla(obyektNomi, hujjatTuri, faylNomi, mimeType, base64) {
  obyektNomi = String(obyektNomi || '').trim();
  faylNomi = String(faylNomi || 'fayl').trim();
  if (!obyektNomi) return { ok: false, error: 'obyekt nomi bo\'sh' };
  if (!base64) return { ok: false, error: 'fayl mazmuni bo\'sh' };

  var a = sozAsosiy(), root;
  try { root = DriveApp.getFolderById(a.rootId); }
  catch (e) { return { ok: false, error: 'ROOT papka xatosi: ' + e }; }

  /* Bo'lingan (split) obyektlar "Papka - Lokalka" ko'rinishida bo'ladi
     (05_Papka.js dagi _cfgKalit mantiqi bilan bir xil) — Drive papkasi
     esa doim PAPKA nomi bilan. */
  var papkaNomi = obyektNomi.split(' - ')[0].trim();
  var target = null, subs = root.getFolders();
  while (subs.hasNext()) {
    var f = subs.next();
    if (f.getName().trim() === papkaNomi) { target = f; break; }
  }
  if (!target) return { ok: false, error: '"' + papkaNomi + '" nomli obyekt papkasi Drive\'da topilmadi' };

  try {
    var hujjatlarFolder = _ohNamedSubfolder(target, 'Hujjatlar');
    var turFolder = _ohNamedSubfolder(hujjatlarFolder,
      hujjatTuri === 'loyiha' ? 'Loyiha chizmalari' : 'Boshqa hujjatlar');

    var blob = Utilities.newBlob(Utilities.base64Decode(base64),
      mimeType || 'application/octet-stream', faylNomi);
    var file = turFolder.createFile(blob);
    return { ok: true, fileId: file.getId(), url: file.getUrl() };
  } catch (e) {
    return { ok: false, error: 'Drive yozish xatosi: ' + (e.message || e) };
  }
}

function _ohNamedSubfolder(parent, nomi) {
  var it = parent.getFoldersByName(nomi);
  if (it.hasNext()) return it.next();
  return parent.createFolder(nomi);
}

/** Canonical T2 document/F2 upload: storage is resolved only from DB lineage. */
function apiT2DocumentUpload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {ok:false,code:'DOCUMENT_CONTEXT_REQUIRED'};
  var companyId=Number(input.companyId), actorId=Number(input.actorId), projectId=Number(input.projectId), objectId=Number(input.objectId);
  var operationId=String(input.operationId||'').trim(), documentType=String(input.documentType||'document').trim();
  if(!companyId||!actorId||!projectId||!objectId||!input.base64||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationId)) return {ok:false,code:'DOCUMENT_CONTEXT_REQUIRED'};
  try{
    var lineage=_t2StorageAssertLineage(companyId,projectId,objectId); if(!lineage.ok) return lineage;
    var folder=_t2StorageFolder(lineage.object.folder_id), fileName=String(input.fileName||'document').trim()||'document';
    var safeName=operationId+'__'+fileName, existing=folder.getFilesByName(safeName), file=null;
    if(existing.hasNext()){file=existing.next(); if(existing.hasNext()) return {ok:false,code:'DOCUMENT_STORAGE_AMBIGUOUS'};}
    if(!file){file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(input.base64),input.mimeType||'application/octet-stream',safeName));}
    var row=_t2Rpc('t2_document_registry_upsert_v1',{p_kompaniya_id:companyId,p_actor_id:actorId,p_loyiha_id:projectId,p_obyekt_id:objectId,p_provider:'google_drive',p_external_file_id:file.getId(),p_external_parent_id:folder.getId(),p_document_type:documentType,p_revision:input.revision==null?null:String(input.revision),p_operation_id:operationId,p_created_by:String(input.createdBy||'t2')});
    if(!row||!row.ok) return {ok:false,code:(row&&row.code)||'DOCUMENT_REGISTRY_FAILED',external_file_id:file.getId()};
    return {ok:true,document_id:row.document_id,external_file_id:row.external_file_id,external_parent_id:folder.getId(),status:row.status,operationId:operationId};
  }catch(e){return {ok:false,code:e.code||'DOCUMENT_UPLOAD_FAILED',xabar:e.message||String(e)};}
}
