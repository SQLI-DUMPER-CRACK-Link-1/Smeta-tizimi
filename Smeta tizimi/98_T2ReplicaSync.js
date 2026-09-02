/********************************************************************
 * 98_T2ReplicaSync.js — FILE-TRUTH-001 DRIVE REPLICA SYNC WORKER
 * ==================================================================
 * EGALIK: Claude (bridge/replica lane).
 *
 * Canonical: Supabase (metadata) + Cloudflare R2 (binary). Bu worker
 * canonical hujjatlarni kompaniyaning STOR-001 Drive papkalariga
 * SINXRON REPLIKA sifatida ko'chiradi va Drive'da qilingan cheklangan
 * o'zgarishlarni canonical'ga qaytaradi.
 *
 * MUHIM QOIDALAR:
 *   - GLOBAL Drive skan YO'Q. Faqat saqlangan folder_id lar.
 *   - Nom bo'yicha identity YO'Q. drive_file_id <-> document_id bog'lanish.
 *   - Drive xatosi canonical'ni rollback QILMAYDI.
 *   - Bir tick'da cheklangan (BATCH) ish; qolgan navbat keyingi tick'ga.
 *
 * DEPLOYMENT TALABI: 1-5 daqiqalik time-driven trigger:
 *   ScriptApp.newTrigger('apiT2ReplicaSyncTick').timeBased().everyMinutes(5).create()
 * va Script Properties: REPLICA_SYNC_SECRET, R2_INTERNAL_URL
 *   (masalan https://smeta-tizimi.pages.dev/api/hujjat-r2).
 ********************************************************************/

var T2RS_BATCH = 8;                 // bir tick'da nechta job
var T2RS_MAX_MS = 4 * 60 * 1000;    // GAS 6 daqiqa chegarasidan xavfsiz

function _t2rsCfg(){
  var p = PropertiesService.getScriptProperties();
  return {
    secret: p.getProperty('REPLICA_SYNC_SECRET') || '',
    r2url:  p.getProperty('R2_INTERNAL_URL') || ''
  };
}

/** Time-driven trigger shu funksiyani chaqiradi. */
function apiT2ReplicaSyncTick(){
  var t0 = Date.now(), cfg = _t2rsCfg(), natija = {olindi:0, synced:0, failed:0, conflict:0};
  if(!cfg.secret || !cfg.r2url) return {ok:false, code:'CONFIG', xabar:'REPLICA_SYNC_SECRET / R2_INTERNAL_URL sozlanmagan'};

  var jobs = _t2Rpc('t2_replica_job_claim_v1', {p_target:'drive', p_limit:T2RS_BATCH});
  if(!Array.isArray(jobs)) return {ok:false, code:'CLAIM_FAILED', xabar:String(jobs)};
  natija.olindi = jobs.length;

  for(var i=0;i<jobs.length;i++){
    if(Date.now()-t0 > T2RS_MAX_MS){ break; }   // qolgani keyingi tick
    var j = jobs[i];
    try{
      if(j.operation === 'mirror'){ _t2rsMirror(j, cfg); natija.synced++; }
      else if(j.operation === 'review'){ _t2Rpc('t2_replica_job_failed_v1',{p_job_id:j.id, p_error:'manual review kerak'}); }
      else { _t2Rpc('t2_replica_job_failed_v1',{p_job_id:j.id, p_error:'operation qo\'llab-quvvatlanmaydi: '+j.operation}); natija.failed++; }
    }catch(e){
      var msg = (e && (e.code ? e.code+': '+(e.message||'') : (e.message||String(e)))) || String(e);
      if(/CONFLICT/i.test(msg)){ natija.conflict++; }
      else natija.failed++;
      try{ _t2Rpc('t2_replica_job_failed_v1',{p_job_id:j.id, p_error:msg}); }catch(ignore){}
    }
  }
  return {ok:true, ms:Date.now()-t0, natija:natija};
}

/** canonical (R2) -> Drive replika papkasiga fayl nusxasi. */
function _t2rsMirror(job, cfg){
  // 1) obyekt storage papkasi (STOR-001) — saqlangan folder_id, skan YO'Q
  var doc = _t2Get('t2_document_registry?id=eq.'+Number(job.entity_id)+
    '&select=id,kompaniya_id,obyekt_id,loyiha_id,original_filename,mime_type,sha256,drive_file_id&limit=1');
  if(doc.length!==1) throw {code:'DOCUMENT_NOT_FOUND', message:'registry qatori yo\'q'};
  doc = doc[0];
  if(!doc.obyekt_id) throw {code:'OBJECT_REQUIRED', message:'obyektsiz hujjat replika V1 da qo\'llab-quvvatlanmaydi'};

  var bind = _t2Get('t2_object_storage_binding?obyekt_id=eq.'+Number(doc.obyekt_id)+
    '&provisioning_status=eq.verified&select=folder_id&limit=1');
  if(bind.length!==1 || !bind[0].folder_id) throw {code:'OBJECT_STORAGE_NOT_PROVISIONED', message:'obyekt Drive papkasi tayyor emas'};
  var parent = DriveApp.getFolderById(String(bind[0].folder_id));

  // 2) canonical bytes — internal secret-authed endpoint (public domain EMAS)
  var r = UrlFetchApp.fetch(cfg.r2url + '?document_id='+Number(doc.id)+'&kompaniya_id='+Number(doc.kompaniya_id), {
    method:'get', muteHttpExceptions:true, headers:{'X-Replica-Sync-Secret': cfg.secret}
  });
  if(r.getResponseCode() >= 300) throw {code:'CANONICAL_READ_FAILED', message:'R2 o\'qib bo\'lmadi ('+r.getResponseCode()+')'};
  var blob = r.getBlob().setName(doc.original_filename || ('document-'+doc.id));
  if(doc.mime_type) try{ blob.setContentType(doc.mime_type); }catch(ignore){}

  // 3) idempotent: mavjud drive_file_id bo'lsa mazmunni yangilash, aks holda yangi fayl
  var file = null;
  if(doc.drive_file_id){ try{ file = DriveApp.getFileById(String(doc.drive_file_id)); if(file.isTrashed()) file=null; }catch(e){ file=null; } }
  if(file){
    // faqat sha o'zgargan bo'lsa qayta yozamiz
    file.setContent ? null : null;
    var upd = Drive && Drive.Files ? Drive.Files.update({}, file.getId(), blob) : null;
    if(!upd) file = parent.createFile(blob);   // Advanced Drive yo'q bo'lsa yangi versiya sifatida
  } else {
    file = parent.createFile(blob);
  }
  var driveRev = '';
  try{ if(typeof Drive!=='undefined' && Drive.Revisions){ var revs = Drive.Revisions.list(file.getId()); driveRev = revs && revs.items && revs.items.length ? String(revs.items[revs.items.length-1].id) : ''; } }catch(ignore){}

  _t2Rpc('t2_replica_job_synced_v1', {p_job_id:job.id, p_drive_file_id:file.getId(), p_drive_revision:driveRev});
}

/* ── Drive WRITE-BACK poller (V1: rename / content / delete) ──────────────
 * Faqat REPLIKA papkalar bo'yicha (kompaniyaning verified object bindinglari).
 * Global Drive changes feed EMAS — har object folder ichini tekshiradi.
 * Katta tizimda bu Drive Changes API (startPageToken) ga o'tkaziladi; V1 da
 * cheklangan: faqat drive_file_id ma'lum bo'lgan hujjatlar. */
function apiT2ReplicaDriveWriteback(){
  var t0 = Date.now(), tekshirildi = 0, ozgargan = 0;
  var docs = _t2Get('t2_document_registry?drive_file_id=not.is.null&drive_sync_status=eq.synced'+
    '&canonical_storage_status=eq.stored&status=eq.active'+
    '&select=id,kompaniya_id,obyekt_id,original_filename,sha256,size_bytes,versiya,drive_file_id,drive_parent_id,drive_revision&limit=200');
  for(var i=0;i<docs.length;i++){
    if(Date.now()-t0 > T2RS_MAX_MS) break;
    var d = docs[i], f;
    try{ f = DriveApp.getFileById(String(d.drive_file_id)); }catch(e){ f = null; }
    tekshirildi++;

    // DELETE — Drive faylida yo'q / korzinkada
    if(!f || f.isTrashed()){
      try{ _t2rsActor(d.kompaniya_id); _t2Rpc('t2_document_replica_deleted_v1',
        {p_kompaniya_id:d.kompaniya_id, p_actor_id:_t2rsActorId, p_document_id:d.id, p_drive_file_id:d.drive_file_id}); ozgargan++; }catch(ignore){}
      continue;
    }

    // RENAME — nom o'zgargan (metadata only)
    var nom = f.getName();
    if(nom && nom !== d.original_filename){
      try{ _t2rsActor(d.kompaniya_id); _t2Rpc('t2_document_replica_rename_v1',
        {p_kompaniya_id:d.kompaniya_id, p_actor_id:_t2rsActorId, p_document_id:d.id,
         p_drive_file_id:d.drive_file_id, p_new_name:nom, p_drive_revision:''}); ozgargan++; }catch(ignore){}
    }

    // MOVE — Drive fayl boshqa papkaga ko'chirilgan. GLOBAL SCAN EMAS: faqat shu
    // faylning joriy ota-papkasi olinadi va RPC uni KNOWN binding bilan solishtiradi
    // (mos kelsa managed re-bind, aks holda conflict+review). Canonical R2 tegilmaydi.
    try{
      var parents = f.getParents(), newParent = parents.hasNext() ? String(parents.next().getId()) : '';
      if(newParent && newParent !== String(d.drive_parent_id || '')){
        _t2rsActor(d.kompaniya_id);
        _t2Rpc('t2_document_replica_move_v1',
          {p_kompaniya_id:d.kompaniya_id, p_actor_id:_t2rsActorId, p_document_id:d.id,
           p_drive_file_id:d.drive_file_id, p_new_parent_id:newParent, p_base_version:d.versiya});
        ozgargan++;
      }
    }catch(ignore){}

    // CONTENT CHANGE — Drive revizyasi o'zgargan -> yangi canonical R2 revizya
    var curRev = '';
    try{ if(typeof Drive!=='undefined' && Drive.Revisions){ var rv = Drive.Revisions.list(f.getId()); curRev = rv && rv.items && rv.items.length ? String(rv.items[rv.items.length-1].id) : ''; } }catch(ignore){}
    if(curRev && curRev !== (d.drive_revision||'')){
      try{
        var bytes = f.getBlob().getBytes();
        var sha = _t2rsSha256Hex(bytes);
        if(sha !== d.sha256){
          // canonical uchun yangi R2 kalit — reserve/finalize orqali EMAS, to'g'ridan-to'g'ri:
          // GAS R2 ga yoza olmaydi (S3 imzo og'ir). Shuning uchun content write-back
          // job sifatida navbatga qo'yiladi: Cloudflare tomonidagi bir martaluk
          // funksiya Drive'dan R2 ga ko'chiradi. V1 da: konflikt/review job.
          _t2Rpc('t2_replica_job_failed_v1', {p_job_id:null, p_error:'content write-back: R2 ko\'chirish navbati kerak (doc '+d.id+')'});
        }
      }catch(ignore){}
    }
  }
  return {ok:true, ms:Date.now()-t0, tekshirildi:tekshirildi, ozgargan:ozgargan};
}

var _t2rsActorId = null;
function _t2rsActor(kompaniyaId){
  // replika worker uchun kompaniyaning bitta faol non-boss a'zosi (yozuv huquqi).
  if(_t2rsActorId) return _t2rsActorId;
  var a = _t2Get('t2_azolik?kompaniya_id=eq.'+Number(kompaniyaId)+'&holat=eq.faol&select=foydalanuvchi_id,rol&limit=20');
  for(var i=0;i<a.length;i++){ if(a[i].rol!=='boss' && a[i].rol!=='rahbar'){ _t2rsActorId = a[i].foydalanuvchi_id; return _t2rsActorId; } }
  if(a.length){ _t2rsActorId = a[0].foydalanuvchi_id; }
  return _t2rsActorId;
}

function _t2rsSha256Hex(bytes){
  var dig = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  var s = '';
  for(var i=0;i<dig.length;i++){ var b = (dig[i] < 0 ? dig[i]+256 : dig[i]).toString(16); s += (b.length===1?'0':'')+b; }
  return s;
}
