/* TIZIM_02_BRIDGE — alohida Apps Script loyiha.
 * Bu yerda smeta/Fakt/F2 biznes hisoblari YO'Q: Supabase/Cloudflare haqiqat.
 * Qator raqami hech qachon identity emas; yashirin t2_entity_id + versiya ishlaydi.
 */
var T2B_TABS = ['SOZLAMALAR','SINXRON','NAVBAT','PROEKSIYALAR','HUJJATLAR','XATOLAR','CONFLICTLAR','AUDIT'];
var T2B_META = ['t2_entity_id','t2_entity_version','t2_projection_hash'];

function t2BridgeCfg_(){
  var p = PropertiesService.getScriptProperties();
  return { url:p.getProperty('T2_BRIDGE_API_URL'), secret:p.getProperty('T2_BRIDGE_SHARED_SECRET'), control:p.getProperty('T2_BRIDGE_CONTROL_SPREADSHEET_ID') };
}
function t2BridgeBootstrap(){
  var cfg=t2BridgeCfg_();
  var ss=cfg.control ? SpreadsheetApp.openById(cfg.control) : SpreadsheetApp.getActive();
  if(!ss) throw new Error('T2_BRIDGE_CONTROL_SPREADSHEET_ID sozlanmagan');
  T2B_TABS.forEach(function(n){ if(!ss.getSheetByName(n)) ss.insertSheet(n); });
  var proj=ss.getSheetByName('PROEKSIYALAR');
  if(proj.getLastRow()===0) proj.appendRow(['obyekt_id','spreadsheet_id','tab','last_projection_hash','last_synced_at','holat']);
  var log=ss.getSheetByName('SINXRON');
  if(log.getLastRow()===0) log.appendRow(['vaqt','operation_id','tur','obyekt_id','holat','izoh']);
  var conflicts=ss.getSheetByName('CONFLICTLAR');
  if(conflicts.getLastRow()===0) conflicts.appendRow(['vaqt','operation_id','obyekt_id','t2_entity_id','base_version','code','izoh']);
  t2BridgeInstallTrigger_();
  return {ok:true, spreadsheet_id:ss.getId(), tabs:T2B_TABS};
}
function t2BridgeInstallTrigger_(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='t2BridgeTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('t2BridgeTick').timeBased().everyMinutes(5).create();
}
function t2BridgeTick(){
  var ss=t2BridgeControl_(), rows=t2BridgeRows_(ss.getSheetByName('PROEKSIYALAR'));
  var out={ok:true,pulled:0,pushed:0,conflicts:0,failed:0};
  rows.forEach(function(row){
    try {
      /* Avval foydalanuvchining ruxsat etilgan Fakt tahririni kanonik
         buyruqqa yuboramiz. Aks holda pull eski proyeksiya bilan uning
         kiritgan qiymatini ustidan yozib yuborishi mumkin edi. */
      var target=SpreadsheetApp.openById(row.spreadsheet_id);
      var push=t2BridgePushChanges_(target, row.tab, Number(row.obyekt_id));
      out.pushed+=push.pushed; out.conflicts+=push.conflicts;
      /* Ziddiyatda Sheetdagi kiritma saqlanadi; operator CONFLICTLAR
         jadvalidan hal qiladi. Uni jim turib qayta proyeksiya qilish mumkin emas. */
      if(push.conflicts) return;
      var pull=t2BridgeCall_('projection.pull',{obyekt_id:Number(row.obyekt_id), projection_hash:row.last_projection_hash||null});
      if(pull.ok && pull.changed){
        t2BridgeApplyProjection_(target, row.tab, pull);
        t2BridgeProjectionSynced_(ss,row._rowNumber,pull.projection_hash);
        out.pulled++;
      }
    } catch(e){ out.failed++; t2BridgeLog_(ss,'XATOLAR',['tick',String(row.obyekt_id),String(e)]); }
  });
  return out;
}
function t2BridgePushChanges_(ss, tab, obyektId){
  var sh=ss.getSheetByName(tab), data=sh.getDataRange().getValues(), headers=data[0]||[];
  var idc=headers.indexOf('t2_entity_id'), vc=headers.indexOf('t2_entity_version'), fc=headers.indexOf('fakt_hajm');
  if(idc<0||vc<0||fc<0) throw new Error('METADATA_OR_FAKT_COLUMN_MISSING');
  var pushed=0,conflicts=0;
  for(var i=1;i<data.length;i++){
    var id=data[i][idc], version=data[i][vc]; if(!id) continue;
    var baseline=sh.getRange(i+1,fc+1).getNote(); var value=data[i][fc];
    if(String(baseline)===String(value)) continue;
    var op=Utilities.getUuid();
    var r=t2BridgeCall_('fakt.write',{operation_id:op,obyekt_id:obyektId,qator_id:Number(id),base_fakt_hajm:Number(baseline),fakt_hajm:value});
    if(r.ok){ sh.getRange(i+1,fc+1).setNote(String(value)); pushed++; }
    else if(r.code==='CONFLICT'||r.code==='VERSION_CONFLICT'||r.code==='FAKT_CONFLICT'){ t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),op,obyektId,id,version,r.code,r.message||'']); conflicts++; }
    else throw new Error(r.code||'BRIDGE_WRITE_FAILED');
  }
  return {pushed:pushed,conflicts:conflicts};
}
function t2BridgeApplyProjection_(ss, tab, p){
  var sh=ss.getSheetByName(tab)||ss.insertSheet(tab), visible=p.headers||[], headers=visible.concat(T2B_META);
  sh.clearContents(); sh.getRange(1,1,1,headers.length).setValues([headers]);
  var rows=(p.rows||[]).map(function(r){ return visible.map(function(h){return r[h]===undefined?'':r[h];}).concat([r.t2_entity_id,r.t2_entity_version,p.projection_hash]); });
  if(rows.length) sh.getRange(2,1,rows.length,headers.length).setValues(rows);
  T2B_META.forEach(function(h){ sh.hideColumns(headers.indexOf(h)+1); });
  var fc=headers.indexOf('fakt_hajm'); if(fc>=0&&rows.length) sh.getRange(2,fc+1,rows.length,1).setNotes(rows.map(function(r){return [String(r[fc])];}));
}
function t2BridgeCall_(action,payload){
  var cfg=t2BridgeCfg_(); if(!cfg.url||!cfg.secret) throw new Error('T2_BRIDGE_API_URL / T2_BRIDGE_SHARED_SECRET sozlanmagan');
  var body=JSON.stringify({action:action,payload:payload});
  var r=UrlFetchApp.fetch(cfg.url,{method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{'X-T2-Bridge-Secret':cfg.secret},payload:body});
  try{return JSON.parse(r.getContentText());}catch(e){return {ok:false,code:'BRIDGE_JSON_INVALID'};}
}
function t2BridgeControl_(){ var c=t2BridgeCfg_(); return c.control?SpreadsheetApp.openById(c.control):SpreadsheetApp.getActive(); }
function t2BridgeRows_(sh){ var v=sh.getDataRange().getValues(), h=v.shift()||[]; return v.map(function(r,index){var o={_rowNumber:index+2};h.forEach(function(k,i){o[k]=r[i];});return o;}).filter(function(r){return r.obyekt_id;}); }
function t2BridgeProjectionSynced_(control,rowNumber,hash){
  var headers=control.getSheetByName('PROEKSIYALAR').getRange(1,1,1,control.getSheetByName('PROEKSIYALAR').getLastColumn()).getValues()[0];
  var hashColumn=headers.indexOf('last_projection_hash')+1, syncedColumn=headers.indexOf('last_synced_at')+1;
  if(hashColumn>0) control.getSheetByName('PROEKSIYALAR').getRange(rowNumber,hashColumn).setValue(hash);
  if(syncedColumn>0) control.getSheetByName('PROEKSIYALAR').getRange(rowNumber,syncedColumn).setValue(new Date());
}
function t2BridgeLog_(ss,tab,row){ ss.getSheetByName(tab).appendRow(row); }
