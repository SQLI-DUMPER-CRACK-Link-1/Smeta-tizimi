/* TIZIM_02_BRIDGE — alohida Apps Script loyiha.
 *
 * Supabase = canonical business truth, R2 = canonical binary truth.
 * Bu loyiha faqat ro'yxatdan o'tgan Sheet proyeksiyalarini tortadi va
 * whitelisted o'zgarishlarni canonical command'ga uzatadi. Sheet qatori,
 * qator tartibi yoki nomi hech qachon identity emas.
 */
var T2B_TABS = ['SOZLAMALAR','SINXRON','NAVBAT','PROEKSIYALAR','HUJJATLAR','XATOLAR','CONFLICTLAR','AUDIT'];
var T2B_META = ['t2_entity_id','t2_entity_version','t2_projection_hash','t2_last_operation_id'];
var T2B_VISIBLE = ['kod','nom','birlik','fakt_hajm','f2_mumkin_hajm'];
var T2B_DERIVED = ['f2_mumkin_hajm','f2_hajm','f2_summa','qoldiq_hajm','qoldiq_summa','muzlagan_summa','xavf_ostidagi_summa'];
var T2B_HEADERS = {
  SOZLAMALAR: ['kalit','qiymat','izoh'],
  SINXRON: ['vaqt','operation_id','tur','obyekt_id','holat','izoh'],
  NAVBAT: ['vaqt','job_id','target','operation','holat','attempt','xato'],
  PROEKSIYALAR: ['obyekt_id','spreadsheet_id','tab','last_projection_hash','last_synced_at','holat'],
  HUJJATLAR: ['vaqt','document_id','operation','holat','izoh'],
  XATOLAR: ['vaqt','scope','entity_id','code','izoh'],
  CONFLICTLAR: ['vaqt','operation_id','obyekt_id','t2_entity_id','base_version','code','izoh'],
  AUDIT: ['vaqt','operation_id','entity_type','entity_id','action','holat','izoh']
};

function t2BridgeCfg_(){
  var p = PropertiesService.getScriptProperties();
  return { url:p.getProperty('T2_BRIDGE_API_URL'), secret:p.getProperty('T2_BRIDGE_SHARED_SECRET'), control:p.getProperty('T2_BRIDGE_CONTROL_SPREADSHEET_ID') };
}

function t2BridgeBootstrap(){
  var cfg=t2BridgeCfg_();
  var ss=cfg.control ? SpreadsheetApp.openById(cfg.control) : SpreadsheetApp.getActive();
  if(!ss) throw new Error('T2_BRIDGE_CONTROL_SPREADSHEET_ID sozlanmagan');
  T2B_TABS.forEach(function(n){
    var sh=ss.getSheetByName(n)||ss.insertSheet(n);
    t2BridgeEnsureHeader_(sh, T2B_HEADERS[n]);
    sh.setFrozenRows(1);
  });
  t2BridgeInstallTrigger_();
  return {ok:true, spreadsheet_id:ss.getId(), tabs:T2B_TABS};
}

function t2BridgeEnsureHeader_(sh, headers){
  if(sh.getLastRow()===0 || sh.getLastColumn()===0){ sh.getRange(1,1,1,headers.length).setValues([headers]); return; }
  var current=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];
  if(!current.some(function(v){return String(v||'').trim();})) sh.getRange(1,1,1,headers.length).setValues([headers]);
}

function t2BridgeInstallTrigger_(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='t2BridgeTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('t2BridgeTick').timeBased().everyMinutes(5).create();
}

function t2BridgeTick(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) return {ok:false,code:'BRIDGE_TICK_ALREADY_RUNNING'};
  try {
    var ss=t2BridgeControl_(), rows=t2BridgeRows_(ss.getSheetByName('PROEKSIYALAR'));
    var out={ok:true,pulled:0,pushed:0,conflicts:0,failed:0};
    rows.forEach(function(row){
      try {
        if(!/^[1-9][0-9]*$/.test(String(row.obyekt_id)) || !row.spreadsheet_id || !row.tab) throw new Error('PROJECTION_REGISTRATION_INVALID');
        var target=SpreadsheetApp.openById(String(row.spreadsheet_id));
        var push=t2BridgePushChanges_(target, String(row.tab), Number(row.obyekt_id));
        out.pushed+=push.pushed; out.conflicts+=push.conflicts;
        if(push.conflicts) return; // conflictni jim overwrite qilmaymiz
        var pull=t2BridgeCall_('projection.pull',{obyekt_id:Number(row.obyekt_id), projection_hash:String(row.last_projection_hash||'')});
        if(!pull.ok) throw new Error(pull.code||'PROJECTION_PULL_FAILED');
        if(pull.changed){
          t2BridgeApplyProjection_(target, String(row.tab), pull);
          t2BridgeProjectionSynced_(ss,row._rowNumber,pull.projection_hash);
          out.pulled++;
        }
      } catch(e){ out.failed++; t2BridgeLog_(ss,'XATOLAR',[new Date(),'projection',String(row.obyekt_id),String(e.code||'BRIDGE_FAILED'),String(e.message||e)]); }
    });
    return out;
  } finally { lock.releaseLock(); }
}

function t2BridgePushChanges_(ss, tab, obyektId){
  var sh=ss.getSheetByName(tab); if(!sh) throw new Error('PROJECTION_TAB_NOT_FOUND');
  var data=sh.getDataRange().getValues(), headers=data[0]||[];
  var idc=headers.indexOf('t2_entity_id'), vc=headers.indexOf('t2_entity_version'), fc=headers.indexOf('fakt_hajm'), oc=headers.indexOf('t2_last_operation_id');
  if(idc<0||vc<0||fc<0) throw new Error('METADATA_OR_FAKT_COLUMN_MISSING');
  var pushed=0,conflicts=0;
  for(var i=1;i<data.length;i++){
    var id=data[i][idc], version=data[i][vc];
    if(!/^[1-9][0-9]*$/.test(String(id)) || !/^[1-9][0-9]*$/.test(String(version))) continue;
    var cell=sh.getRange(i+1,fc+1), value=data[i][fc], state=t2BridgeNoteState_(cell.getNote());
    if(String(state.baseValue)===String(value)) continue;
    if(state.blocked && String(state.pendingValue)===String(value)) continue; // hot retry yo'q
    if(state.baseValue===undefined || state.baseValue===null || String(state.baseValue)===''){
      t2BridgeLog_(t2BridgeControl_(),'XATOLAR',[new Date(),'row',String(id),'BASE_VALUE_REQUIRED','Fakt write-back uchun canonical baseline note yo\'q']);
      continue;
    }
    // Conflictdan keyin qiymat o'zgargan bo'lsa yangi business operation;
    // ayni qiymat esa yuqoridagi blocked guard bilan qayta-qayta yuborilmaydi.
    var op=state.blocked ? Utilities.getUuid() : (state.operationId || (oc>=0 && data[i][oc] ? String(data[i][oc]) : Utilities.getUuid()));
    var r=t2BridgeCall_('fakt.write',{operation_id:op,obyekt_id:obyektId,qator_id:Number(id),base_fakt_hajm:Number(state.baseValue),fakt_hajm:Number(value),base_version:Number(version)});
    if(r && r.ok){
      cell.setNote(JSON.stringify({baseValue:value,pendingValue:null,operationId:op,blocked:false}));
      if(oc>=0) sh.getRange(i+1,oc+1).setValue(op);
      pushed++;
    } else if(r && ['CONFLICT','VERSION_CONFLICT','FAKT_CONFLICT','STALE_VERSION'].indexOf(String(r.code))>=0){
      cell.setNote(JSON.stringify({baseValue:state.baseValue,pendingValue:value,operationId:op,blocked:true}));
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),op,obyektId,id,version,r.code,r.message||'']);
      conflicts++;
    } else throw new Error((r&&r.code)||'BRIDGE_WRITE_FAILED');
  }
  return {pushed:pushed,conflicts:conflicts};
}

function t2BridgeNoteState_(note){
  if(!note) return {};
  try { var s=JSON.parse(note); if(s && typeof s==='object') return s; } catch(e){}
  // Old bridge notes only contained the baseline value. Preserve compatibility.
  return {baseValue:note};
}

function t2BridgeApplyProjection_(ss, tab, p){
  var sh=ss.getSheetByName(tab)||ss.insertSheet(tab), visible=(p.headers||T2B_VISIBLE).filter(function(h){ return T2B_META.indexOf(h)<0; });
  var headers=visible.concat(T2B_META);
  t2BridgeEnsureCapacity_(sh, Math.max(1,(p.rows||[]).length+1), headers.length);
  sh.getRange(1,1,sh.getMaxRows(),Math.max(sh.getLastColumn(),headers.length)).clearContent();
  sh.getRange(1,1,1,headers.length).setValues([headers]);
  var rows=(p.rows||[]).map(function(r){ return visible.map(function(h){return r[h]===undefined?'':r[h];}).concat([String(r.t2_entity_id),String(r.t2_entity_version),String(p.projection_hash),'']); });
  if(rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
  T2B_META.forEach(function(h){ var c=headers.indexOf(h)+1; if(c>0) sh.hideColumns(c); });
  var fc=headers.indexOf('fakt_hajm')+1;
  if(fc>0 && rows.length) sh.getRange(2,fc,rows.length,1).setNotes(rows.map(function(r){ return [JSON.stringify({baseValue:r[fc-1],pendingValue:null,operationId:'',blocked:false})]; }));
  sh.setFrozenRows(1);
}

function t2BridgeEnsureCapacity_(sh, rowCount, colCount){
  if(sh.getMaxRows()<rowCount) sh.insertRowsAfter(sh.getMaxRows(),rowCount-sh.getMaxRows());
  if(sh.getMaxColumns()<colCount) sh.insertColumnsAfter(sh.getMaxColumns(),colCount-sh.getMaxColumns());
}

function t2BridgeCall_(action,payload){
  var cfg=t2BridgeCfg_(); if(!cfg.url||!cfg.secret) throw new Error('T2_BRIDGE_API_URL / T2_BRIDGE_SHARED_SECRET sozlanmagan');
  var r=UrlFetchApp.fetch(cfg.url,{method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{'X-T2-Bridge-Secret':cfg.secret},payload:JSON.stringify({action:action,payload:payload})});
  try{return JSON.parse(r.getContentText());}catch(e){return {ok:false,code:'BRIDGE_JSON_INVALID'};}
}

function t2BridgeControl_(){ var c=t2BridgeCfg_(); return c.control?SpreadsheetApp.openById(c.control):SpreadsheetApp.getActive(); }
function t2BridgeRows_(sh){
  if(!sh) return [];
  var v=sh.getDataRange().getValues(), h=v.shift()||[];
  return v.map(function(r,index){var o={_rowNumber:index+2};h.forEach(function(k,i){o[k]=r[i];});return o;}).filter(function(r){return r.obyekt_id;});
}
function t2BridgeProjectionSynced_(control,rowNumber,hash){
  var sh=control.getSheetByName('PROEKSIYALAR'), headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var hashColumn=headers.indexOf('last_projection_hash')+1, syncedColumn=headers.indexOf('last_synced_at')+1;
  if(hashColumn>0) sh.getRange(rowNumber,hashColumn).setValue(hash);
  if(syncedColumn>0) sh.getRange(rowNumber,syncedColumn).setValue(new Date());
}
function t2BridgeLog_(ss,tab,row){ var sh=ss.getSheetByName(tab)||ss.insertSheet(tab); if(sh.getLastRow()===0 && T2B_HEADERS[tab]) t2BridgeEnsureHeader_(sh,T2B_HEADERS[tab]); sh.appendRow(row); }
