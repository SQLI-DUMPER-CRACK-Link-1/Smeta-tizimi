/* TIZIM_02_BRIDGE — alohida Apps Script loyiha.
 * Bu yerda smeta/Fakt/F2 biznes hisoblari YO'Q: Supabase/Cloudflare haqiqat.
 * Qator raqami hech qachon identity emas; yashirin t2_entity_id + versiya ishlaydi.
 *
 * Ko'prikning Sheets tomoni faqat quyidagilarni qiladi:
 *   1) kanonik proyeksiyani ID bo'yicha yangilaydi;
 *   2) whitelisted `fakt_hajm` tahririni canonical commandga yuboradi;
 *   3) konflikt/noaniqlikni saqlaydi, jim o'chirmaydi yoki 0 ga aylantirmaydi.
 */
var T2B_TABS = ['SOZLAMALAR','SINXRON','NAVBAT','PROEKSIYALAR','HUJJATLAR','XATOLAR','CONFLICTLAR','AUDIT'];
var T2B_META = ['t2_entity_id','t2_entity_version','t2_projection_hash','t2_projection_state'];
var T2B_EDITABLE = ['fakt_hajm'];
var T2B_PROJECTION_FIELDS = [
  'tur','kod','nom','birlik','kat',
  'smeta_hajm','smeta_narx','smeta_summa',
  'fakt_hajm','fakt_summa','f2_hajm','f2_summa',
  'qoldiq_hajm','qoldiq_summa','f2_mumkin_hajm','f2_mumkin_summa',
  'f2_narx','fakt_narx','f2_narx_farq_foiz'
];

function t2BridgeCfg_(){
  var p = PropertiesService.getScriptProperties();
  return { url:p.getProperty('T2_BRIDGE_API_URL'), secret:p.getProperty('T2_BRIDGE_SHARED_SECRET'), control:p.getProperty('T2_BRIDGE_CONTROL_SPREADSHEET_ID') };
}

function t2BridgeNumber_(value){
  if(value === null || value === undefined || typeof value === 'boolean') return null;
  if(typeof value === 'number') return isFinite(value) ? value : null;
  var text=String(value).trim().replace(',', '.');
  if(!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  var n=Number(text);
  return isFinite(n) ? n : null;
}

function t2BridgeSameNumber_(a,b){
  return a !== null && b !== null && a === b;
}

/* Eski oddiy note (faqat baseline soni) ham o'qiladi; yangi note esa retry
   uzilib qolsa ayni operation_id bilan qayta davom etadi. */
function t2BridgeFactNoteRead_(note){
  var raw=String(note === null || note === undefined ? '' : note).trim();
  if(!raw) return {baseline:null,pendingValue:null,operationId:null};
  try{
    var parsed=JSON.parse(raw);
    if(parsed && typeof parsed === 'object') return {
      baseline:t2BridgeNumber_(parsed.baseline),
      pendingValue:t2BridgeNumber_(parsed.pending_value),
      operationId:parsed.operation_id ? String(parsed.operation_id) : null
    };
  }catch(e){ /* legacy numeric note */ }
  return {baseline:t2BridgeNumber_(raw),pendingValue:null,operationId:null};
}

function t2BridgeFactNoteWrite_(baseline,pendingValue,operationId){
  return JSON.stringify({baseline:baseline,pending_value:pendingValue,operation_id:operationId || null});
}

function t2BridgeStateSet_(sh,rowNumber,state){
  var headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  var column=headers.indexOf('t2_projection_state')+1;
  if(column>0) sh.getRange(rowNumber,column).setValue(state);
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
  /* Vaqt triggeri ustma-ust ishga tushsa, bir xil Sheet o‘zgarishi ikki marta
     yuborilmasin. Lock faqat ko‘prik ishini ketma-ketlashtiradi; kanonik
     idempotency va versiya tekshiruvi baribir Cloudflare/Supabase’da qoladi. */
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000)) return {ok:false,code:'BRIDGE_TICK_ALREADY_RUNNING'};
  try {
    var ss=t2BridgeControl_(), rows=t2BridgeRows_(ss.getSheetByName('PROEKSIYALAR'));
    var out={ok:true,pulled:0,pushed:0,conflicts:0,failed:0};
    rows.forEach(function(row){
      try {
        /* Avval foydalanuvchining faqat ruxsat etilgan Fakt tahririni yuboramiz.
           Aks holda pull uning kiritgan qiymatini ustidan yozib yuborishi mumkin. */
        var target=SpreadsheetApp.openById(row.spreadsheet_id);
        var push=t2BridgePushChanges_(target, row.tab, Number(row.obyekt_id));
        out.pushed+=push.pushed; out.conflicts+=push.conflicts;
        /* Ziddiyat/noaniqlikda Sheetdagi kiritma saqlanadi; canonical holat
           keyingi operator qarorisiz ustidan yozilmaydi. */
        if(push.conflicts) return;
        var pull=t2BridgeCall_('projection.pull',{obyekt_id:Number(row.obyekt_id), projection_hash:row.last_projection_hash||null});
        if(pull.ok && pull.changed){
          t2BridgeApplyProjection_(target, row.tab, pull);
          t2BridgeProjectionSynced_(ss,row._rowNumber,pull.projection_hash);
          out.pulled++;
        }else if(!pull.ok){
          t2BridgeLog_(ss,'XATOLAR',[new Date(),'',String(row.obyekt_id),pull.code||'BRIDGE_PULL_FAILED']);
          out.failed++;
        }
      } catch(e){ out.failed++; t2BridgeLog_(ss,'XATOLAR',[new Date(),'','tick',String(row.obyekt_id),String(e)]); }
    });
    return out;
  } finally {
    lock.releaseLock();
  }
}

function t2BridgePushChanges_(ss, tab, obyektId){
  var sh=ss.getSheetByName(tab);
  if(!sh || sh.getLastRow()<1) throw new Error('SHEET_NOT_FOUND');
  var data=sh.getDataRange().getValues(), headers=data[0]||[];
  var idc=headers.indexOf('t2_entity_id'), vc=headers.indexOf('t2_entity_version'), fc=headers.indexOf('fakt_hajm'), sc=headers.indexOf('t2_projection_state');
  if(idc<0||vc<0||fc<0) throw new Error('METADATA_OR_FAKT_COLUMN_MISSING');
  var pushed=0,conflicts=0,seen={};
  for(var i=1;i<data.length;i++){
    var id=t2BridgeNumber_(data[i][idc]); if(id===null) continue;
    var idKey=String(id);
    if(seen[idKey]){
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),'',''+obyektId,id,'','DUPLICATE_CANONICAL_ID','']);
      conflicts++; continue;
    }
    seen[idKey]=true;
    var projectionState=sc>=0 ? String(data[i][sc] || '') : '';
    if(projectionState==='STALE_CANONICAL_ROW') continue;
    var version=t2BridgeNumber_(data[i][vc]);
    if(version===null){
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),'',''+obyektId,id,'','ENTITY_VERSION_MISSING','']);
      t2BridgeStateSet_(sh,i+1,'REVIEW_REQUIRED');
      conflicts++; continue;
    }
    var cell=sh.getRange(i+1,fc+1), state=t2BridgeFactNoteRead_(cell.getNote());
    var baseline=state.baseline, value=t2BridgeNumber_(data[i][fc]);
    /* Ziddiyat qatori keyingi triggerlarda qayta-qayta yozilmaydi. Operator
       ayni kiritmani o'zgartirgandagina bu qator yangi urinishga ochiladi. */
    if(projectionState==='CONFLICT' || projectionState==='REVIEW_REQUIRED'){
      if(state.pendingValue===null || t2BridgeSameNumber_(state.pendingValue,value)) continue;
      t2BridgeStateSet_(sh,i+1,'ACTIVE');
    }
    if(baseline===null){
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),'',''+obyektId,id,version,'BASELINE_MISSING','']);
      t2BridgeStateSet_(sh,i+1,'REVIEW_REQUIRED');
      conflicts++; continue;
    }
    if(value===null){
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),'',''+obyektId,id,version,'FAKT_VALUE_INVALID','Bo\'sh yoki son bo\'lmagan qiymat qabul qilinmadi']);
      t2BridgeStateSet_(sh,i+1,'REVIEW_REQUIRED');
      conflicts++; continue;
    }
    if(t2BridgeSameNumber_(baseline,value)) continue;

    /* Timeoutdan keyingi retry ayni target qiymat uchun ayni operation_idni
       ishlatadi. Qiymat o'zgargan bo'lsa yangi operation_id yaratiladi. */
    var op=(state.operationId && t2BridgeSameNumber_(state.pendingValue,value)) ? state.operationId : Utilities.getUuid();
    cell.setNote(t2BridgeFactNoteWrite_(baseline,value,op));
    var r=t2BridgeCall_('fakt.write',{operation_id:op,obyekt_id:obyektId,qator_id:id,base_entity_version:version,base_fakt_hajm:baseline,fakt_hajm:value});
    if(r.ok){ cell.setNote(t2BridgeFactNoteWrite_(value,null,null)); pushed++; }
    else if(r.code==='CONFLICT'||r.code==='VERSION_CONFLICT'||r.code==='FAKT_CONFLICT'||r.code==='ENTITY_VERSION_CONFLICT'){
      t2BridgeLog_(t2BridgeControl_(),'CONFLICTLAR',[new Date(),op,obyektId,id,version,r.code,"Canonical qiymat o'zgargan; Sheet qiymati saqlandi"]);
      t2BridgeStateSet_(sh,i+1,'CONFLICT');
      conflicts++;
    }else{
      t2BridgeLog_(t2BridgeControl_(),'XATOLAR',[new Date(),op,obyektId,id,r.code||'BRIDGE_WRITE_FAILED']);
      t2BridgeStateSet_(sh,i+1,'REVIEW_REQUIRED');
      conflicts++;
    }
  }
  return {pushed:pushed,conflicts:conflicts};
}

function t2BridgeEnsureHeaders_(sh, required){
  var lastColumn=sh.getLastColumn(), headers=[];
  if(sh.getLastRow()>0 && lastColumn>0) headers=sh.getRange(1,1,1,lastColumn).getValues()[0].map(String);
  if(!headers.length){
    sh.getRange(1,1,1,required.length).setValues([required]);
    return required.slice();
  }
  required.forEach(function(h){
    if(headers.indexOf(h)<0){ sh.getRange(1,headers.length+1).setValue(h); headers.push(h); }
  });
  return headers;
}

function t2BridgeApplyProjection_(ss, tab, p){
  var sh=ss.getSheetByName(tab)||ss.insertSheet(tab), incoming=Array.isArray(p.headers) ? p.headers.map(String) : [];
  var visible=T2B_PROJECTION_FIELDS.filter(function(h){ return incoming.indexOf(h)>=0; });
  if(!visible.length) throw new Error('PROJECTION_HEADERS_INVALID');
  var headers=t2BridgeEnsureHeaders_(sh,visible.concat(T2B_META));
  var idc=headers.indexOf('t2_entity_id'), vc=headers.indexOf('t2_entity_version'), hc=headers.indexOf('t2_projection_hash'), sc=headers.indexOf('t2_projection_state');
  if(idc<0||vc<0||hc<0||sc<0) throw new Error('METADATA_COLUMNS_UNAVAILABLE');
  var oldLastRow=Math.max(sh.getLastRow(),1), oldLastColumn=headers.length;
  var matrix=sh.getRange(1,1,oldLastRow,oldLastColumn).getValues();
  var rowById={}, duplicate={};
  for(var i=1;i<matrix.length;i++){
    var existing=t2BridgeNumber_(matrix[i][idc]);
    if(existing===null) continue;
    if(rowById[String(existing)]) duplicate[String(existing)]=true;
    else rowById[String(existing)]=i+1;
  }
  Object.keys(duplicate).forEach(function(id){ throw new Error('DUPLICATE_CANONICAL_ID_'+id); });

  var updates={}, activeIds={};
  (p.rows||[]).forEach(function(r){
    var id=t2BridgeNumber_(r.t2_entity_id), version=t2BridgeNumber_(r.t2_entity_version);
    if(id===null || version===null || !isFinite(id) || !isFinite(version)) throw new Error('PROJECTION_ID_VERSION_INVALID');
    var key=String(id); if(activeIds[key]) throw new Error('DUPLICATE_PROJECTION_ID_'+key); activeIds[key]=true;
    var rowNumber=rowById[key];
    if(!rowNumber){
      matrix.push(new Array(headers.length).fill(''));
      rowNumber=matrix.length; rowById[key]=rowNumber;
    }
    updates[rowNumber]={};
    visible.forEach(function(h){ updates[rowNumber][h]=r[h]===undefined ? '' : r[h]; });
    updates[rowNumber].t2_entity_id=id;
    updates[rowNumber].t2_entity_version=version;
    updates[rowNumber].t2_projection_hash=String(p.projection_hash||'');
    updates[rowNumber].t2_projection_state='ACTIVE';
  });

  /* Hozirgi canonical payloadda yo'q qatorni o'chirmaymiz: u operatorga
     ko'rinadigan holda qoladi, lekin keyingi write'dan himoyalanadi. */
  for(var rowNumber=2;rowNumber<=matrix.length;rowNumber++){
    var existingId=t2BridgeNumber_(matrix[rowNumber-1][idc]);
    if(existingId!==null && !activeIds[String(existingId)]){
      if(!updates[rowNumber]) updates[rowNumber]={};
      updates[rowNumber].t2_projection_state='STALE_CANONICAL_ROW';
    }
  }

  var neededRows=matrix.length;
  if(neededRows>sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(),neededRows-sh.getMaxRows());
  for(var col=0;col<headers.length;col++){
    var header=headers[col];
    var managed=visible.indexOf(header)>=0 || T2B_META.indexOf(header)>=0;
    if(!managed || neededRows<2) continue;
    var values=[];
    for(var dataRow=2;dataRow<=neededRows;dataRow++){
      var baseValue=matrix[dataRow-1] && matrix[dataRow-1][col] !== undefined ? matrix[dataRow-1][col] : '';
      values.push([updates[dataRow] && updates[dataRow][header] !== undefined ? updates[dataRow][header] : baseValue]);
    }
    sh.getRange(2,col+1,values.length,1).setValues(values);
  }

  var factCol=headers.indexOf('fakt_hajm');
  if(factCol>=0 && neededRows>=2){
    var notes=sh.getRange(2,factCol+1,neededRows-1,1).getNotes();
    for(var n=2;n<=neededRows;n++){
      var update=updates[n];
      if(update && update.t2_projection_state==='ACTIVE') notes[n-2][0]=t2BridgeFactNoteWrite_(t2BridgeNumber_(update.fakt_hajm),null,null);
    }
    sh.getRange(2,factCol+1,notes.length,1).setNotes(notes);
  }
  T2B_META.forEach(function(h){ var c=headers.indexOf(h); if(c>=0) sh.hideColumns(c+1); });
}

function t2BridgeCall_(action,payload){
  var cfg=t2BridgeCfg_(); if(!cfg.url||!cfg.secret) throw new Error('T2_BRIDGE_API_URL / T2_BRIDGE_SHARED_SECRET sozlanmagan');
  var body=JSON.stringify({action:action,payload:payload});
  var r=UrlFetchApp.fetch(cfg.url,{method:'post',contentType:'application/json',muteHttpExceptions:true,headers:{'X-T2-Bridge-Secret':cfg.secret},payload:body});
  var parsed;
  try{ parsed=JSON.parse(r.getContentText()); }catch(e){ return {ok:false,code:'BRIDGE_JSON_INVALID'}; }
  if(r.getResponseCode()<200 || r.getResponseCode()>=300) return parsed && typeof parsed==='object' ? parsed : {ok:false,code:'BRIDGE_HTTP_ERROR'};
  return parsed && typeof parsed==='object' ? parsed : {ok:false,code:'BRIDGE_JSON_INVALID'};
}

function t2BridgeControl_(){ var c=t2BridgeCfg_(); return c.control?SpreadsheetApp.openById(c.control):SpreadsheetApp.getActive(); }
function t2BridgeRows_(sh){ var v=sh.getDataRange().getValues(), h=v.shift()||[]; return v.map(function(r,index){var o={_rowNumber:index+2};h.forEach(function(k,i){o[k]=r[i];});return o;}).filter(function(r){return t2BridgeNumber_(r.obyekt_id)!==null;}); }
function t2BridgeProjectionSynced_(control,rowNumber,hash){
  var sh=control.getSheetByName('PROEKSIYALAR'), headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var hashColumn=headers.indexOf('last_projection_hash')+1, syncedColumn=headers.indexOf('last_synced_at')+1;
  if(hashColumn>0) sh.getRange(rowNumber,hashColumn).setValue(hash);
  if(syncedColumn>0) sh.getRange(rowNumber,syncedColumn).setValue(new Date());
}
function t2BridgeLog_(ss,tab,row){ ss.getSheetByName(tab).appendRow(row); }
