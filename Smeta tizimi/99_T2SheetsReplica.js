/* ═══════════════════════════════════════════════════════════════════════════
 * 99_T2SheetsReplica.js — SHEETS write-back REFERENCE worker (FILE-TRUTH-001 §8)
 * ───────────────────────────────────────────────────────────────────────────
 * ONE real reusable path. Legacy per-sheet write-backs stay DEFERRED-P1.
 *
 * IDENTITY LAW: a Google Sheets ROW NUMBER is never an identity. Every
 * replica-tracked sheet carries a hidden `t2_entity_id` column holding the
 * STABLE canonical id (e.g. a document's `sheets_entity_id`). Rows may be
 * sorted, filtered, or re-inserted — the id travels with the row.
 *
 * Flow: read the tracked column -> for each changed row look up its stable id ->
 * call the canonical RPC with { sheets_entity_id, base_version, operation_id }.
 * A conflict (SHEETS_CONFLICT) is surfaced, never last-write-wins.
 *
 * DEPLOYMENT: 5–10 min time-driven trigger on apiT2SheetsReplicaTick.
 * Script Properties: REPLICA_SYNC_SECRET (shared w/ Cloudflare), SB_URL, SB_KEY.
 * ═══════════════════════════════════════════════════════════════════════════ */

var T2SH_MAX_MS = 4 * 60 * 1000;
var T2SH_ID_COL_HEADER = 't2_entity_id';   // hidden stable-id column, per sheet

function _t2shCfg(){
  var p = PropertiesService.getScriptProperties();
  return { sbUrl: p.getProperty('SB_URL'), sbKey: p.getProperty('SB_KEY'),
           secret: p.getProperty('REPLICA_SYNC_SECRET') };
}

/** Entry point. Iterates ONLY the sheets registered for replica sync — never a
 *  spreadsheet-wide or Drive-wide scan. */
function apiT2SheetsReplicaTick(){
  var t0 = Date.now(), cfg = _t2shCfg(), out = { scanned:0, synced:0, conflict:0, failed:0 };
  var jobs = _t2shGet(cfg, "t2_replica_sync_job?target=eq.sheets&holat=in.(pending,failed)&order=next_attempt_at.asc&limit=50");
  for (var i = 0; i < jobs.length; i++){
    if (Date.now() - t0 > T2SH_MAX_MS) break;
    var j = jobs[i];
    try {
      var res = _t2shApplyOne(cfg, j);
      if (res && res.code === 'SHEETS_CONFLICT') out.conflict++;
      else if (res && res.ok) out.synced++;
      else out.failed++;
    } catch (e){ out.failed++; }
    out.scanned++;
  }
  return { ok:true, ms: Date.now() - t0, out: out };
}

/** Apply one queued write-back. `j.entity_id` is the canonical document id;
 *  the row is located in its sheet by the STABLE id column, not by position. */
function _t2shApplyOne(cfg, j){
  var doc = _t2shGet(cfg, "t2_document_registry?id=eq." + encodeURIComponent(j.entity_id) +
    "&select=id,kompaniya_id,sheets_entity_id,original_filename,document_type,versiya");
  if (!doc.length) return { ok:false, code:'DOCUMENT_NOT_FOUND' };
  var d = doc[0];
  if (!d.sheets_entity_id) return { ok:false, code:'SHEETS_ENTITY_ID_REQUIRED' };

  // read the current sheet value by locating the row via the stable id column
  var sv = _t2shReadByStableId(j, d.sheets_entity_id);
  if (!sv || sv.value == null) return { ok:false, code:'SHEETS_ROW_NOT_FOUND' };

  var actorId = _t2shActor(cfg, d.kompaniya_id);
  var opId = j.operation_id || Utilities.getUuid();
  var body = {
    p_kompaniya_id: d.kompaniya_id, p_actor_id: actorId, p_document_id: d.id,
    p_sheets_entity_id: d.sheets_entity_id, p_field: sv.field, p_new_value: String(sv.value),
    p_base_version: d.versiya, p_operation_id: opId
  };
  var r = _t2shRpc(cfg, 't2_document_sheets_writeback_v1', body);
  if (r && r.code === 'SHEETS_CONFLICT'){
    _t2shRpc(cfg, 't2_replica_job_failed_v1', { p_job_id: j.id, p_error: 'SHEETS_CONFLICT v' + r.version });
  } else if (r && r.ok){
    _t2shRpc(cfg, 't2_replica_job_synced_v1', { p_job_id: j.id, p_drive_file_id: null, p_drive_revision: null });
  }
  return r;
}

/** Locate a row by its hidden stable-id column and return the writeback field.
 *  Returns null if the id is absent — NEVER falls back to a row index. */
function _t2shReadByStableId(job, stableId){
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SHEETS_' + job.kompaniya_id + '_SSID');
  var tab  = props.getProperty('SHEETS_' + job.kompaniya_id + '_TAB') || 'Hujjatlar';
  if (!ssId) return null;
  var sh = SpreadsheetApp.openById(ssId).getSheetByName(tab);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  var header = values[0], idCol = header.indexOf(T2SH_ID_COL_HEADER);
  var nameCol = header.indexOf('nom'); if (nameCol < 0) nameCol = header.indexOf('filename');
  if (idCol < 0) return null;
  for (var r = 1; r < values.length; r++){
    if (String(values[r][idCol]) === String(stableId)){
      return { field: 'original_filename', value: nameCol >= 0 ? values[r][nameCol] : null, row: r + 1 };
    }
  }
  return null;
}

var _t2shActorId = {};
function _t2shActor(cfg, kompaniyaId){
  if (_t2shActorId[kompaniyaId]) return _t2shActorId[kompaniyaId];
  var a = _t2shGet(cfg, "t2_azolik?kompaniya_id=eq." + kompaniyaId + "&holat=eq.faol&select=foydalanuvchi_id,rol");
  for (var i = 0; i < a.length; i++){ if (a[i].rol !== 'boss' && a[i].rol !== 'rahbar'){ _t2shActorId[kompaniyaId] = a[i].foydalanuvchi_id; return _t2shActorId[kompaniyaId]; } }
  if (a.length) _t2shActorId[kompaniyaId] = a[0].foydalanuvchi_id;
  return _t2shActorId[kompaniyaId];
}

function _t2shGet(cfg, q){
  var r = UrlFetchApp.fetch(cfg.sbUrl.replace(/\/+$/, '') + '/rest/v1/' + q, {
    method: 'get', muteHttpExceptions: true,
    headers: { apikey: cfg.sbKey, Authorization: 'Bearer ' + cfg.sbKey }
  });
  try { return JSON.parse(r.getContentText()) || []; } catch (e){ return []; }
}
function _t2shRpc(cfg, fn, body){
  var r = UrlFetchApp.fetch(cfg.sbUrl.replace(/\/+$/, '') + '/rest/v1/rpc/' + fn, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: cfg.sbKey, Authorization: 'Bearer ' + cfg.sbKey },
    payload: JSON.stringify(body)
  });
  try { return JSON.parse(r.getContentText()); } catch (e){ return { ok:false, code:'RPC_PARSE' }; }
}
