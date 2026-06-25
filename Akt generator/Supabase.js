/********************************************************************
 * Supabase.gs — AKT GENERATOR → SUPABASE (bir tomonlama push)
 * ==================================================================
 * REYESTR (yashirin ishlar aktlari) → Supabase `akt` jadvali.
 * Umumiy hub: Smeta tizimi bilan BIR XIL Supabase loyiha (URL+key).
 *
 * Sozlash (bir marta, Apps Script editor → Run):
 *   aktSupabaseSozlash('https://xxx.supabase.co','service_role_key')
 *   aktSupabaseTest()
 *   aktSupabasePush()        // birinchi to'liq yuklash
 *   aktTriggerOrnat()        // soatlik avtomatik
 *
 * MUHIM: sozlanmagan bo'lsa hamma narsa JIM (no-op) — tizimga ta'sirsiz.
 ********************************************************************/

function aktSupabaseSozlash(url, serviceKey){
  if(!url || String(url).indexOf('https://')!==0) throw 'URL https:// bilan boshlanishi kerak';
  if(!serviceKey) throw 'service_role key kiriting';
  var p=PropertiesService.getScriptProperties();
  p.setProperty('SUPABASE_URL', String(url).trim().replace(/\/+$/,''));
  p.setProperty('SUPABASE_KEY', String(serviceKey).trim());
  return 'Akt → Supabase sozlandi: '+url;
}
function _aktSbCfg(){
  var p=PropertiesService.getScriptProperties();
  var url=p.getProperty('SUPABASE_URL'), key=p.getProperty('SUPABASE_KEY');
  return (url&&key)?{url:url, key:key}:null;
}
function _aktSbYoz(table, rows, onConflict){
  var c=_aktSbCfg(); if(!c || !rows || !rows.length) return;
  var base=c.url+'/rest/v1/'+table+(onConflict?('?on_conflict='+encodeURIComponent(onConflict)):'');
  var headers={'apikey':c.key,'Authorization':'Bearer '+c.key,'Content-Type':'application/json',
    'Prefer': onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'};
  for(var i=0;i<rows.length;i+=1000){
    var chunk=rows.slice(i,i+1000);
    var resp=UrlFetchApp.fetch(base,{method:'post',headers:headers,
      payload:JSON.stringify(chunk), muteHttpExceptions:true});
    if(resp.getResponseCode()>=300)
      throw 'Supabase '+table+' xato ('+resp.getResponseCode()+'): '+resp.getContentText().slice(0,300);
  }
}

/* ============ REYESTR → akt ============ */
function aktSupabasePush(){
  if (tizimMuzlatilganMiSb()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Akt push bajarilmadi.');
    return {ok:false, sabab:'Tizim to\'xtatilgan (PAUSED)'};
  }
  if(!_aktSbCfg()) return {ok:false, sabab:'sozlanmagan'};
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if(!sh || sh.getLastRow()<2) return {ok:false, sabab:'REYESTR bo\'sh'};
  var map=headerMap_(sh);                              // {HEADER: 1-based col}
  function col(key){ return map[key]||0; }
  var lastCol=sh.getLastColumn();
  var data=sh.getRange(2,1,sh.getLastRow()-1,lastCol).getValues();
  function g(row, key){ var c=col(key); return c? String(row[c-1]==null?'':row[c-1]).trim() : ''; }

  var rows=[];
  for(var i=0;i<data.length;i++){
    var url=g(data[i], REY.ACT_FILE_URL);
    if(!url) continue;                                 // akt yaratilmagan qator — o'tkazib
    var smetaRef = g(data[i], REY.SMETA_REF);
    var wCount = 0;
    if(smetaRef) {
      var parts = smetaRef.split(';');
      for(var k=0;k<parts.length;k++) if(parts[k].trim()) wCount++;
    }

    rows.push({
      act_id: url,
      obyekt: g(data[i], REY.OBJECT_NAME),
      work_name: g(data[i], REY.WORK_NAME),
      act_number: g(data[i], REY.ACT_NUMBER),
      start_date: g(data[i], REY.START_DATE),
      end_date: g(data[i], REY.END_DATE),
      status: g(data[i], REY.STATUS),
      customer: g(data[i], REY.CUSTOMER_ORG),
      sub_name: g(data[i], REY.SUB_NAME),
      act_url: url,
      smeta_ref: smetaRef,
      work_count: wCount,
      updated_at: new Date().toISOString()
    });
  }
  if(rows.length) _aktSbYoz('akt', rows, 'act_id');
  Logger.log('Akt → Supabase: '+rows.length+' akt push qilindi');
  return {ok:true, soni:rows.length};
}

/* ============ TRIGGER (soatlik) ============ */
function aktTriggerOrnat(){
  aktTriggerOchir();
  ScriptApp.newTrigger('aktSupabasePush').timeBased().everyHours(1).create();
  var msg='✅ Akt → Supabase soatlik trigger o\'rnatildi (aktSupabasePush)';
  try{ return {message: msg}; }catch(e){}
  return msg;
}
function aktTriggerOchir(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='aktSupabasePush') ScriptApp.deleteTrigger(t);
  });
}

/* ============ ULANISH TESTI ============ */
function aktSupabaseTest(){
  var c=_aktSbCfg(); if(!c) throw 'Avval: aktSupabaseSozlash(url, key)';
  var resp=UrlFetchApp.fetch(c.url+'/rest/v1/akt?select=act_id&limit=1',
    {headers:{'apikey':c.key,'Authorization':'Bearer '+c.key}, muteHttpExceptions:true});
  var code=resp.getResponseCode();
  Logger.log('Supabase akt status: '+code+'  '+resp.getContentText());
  if(code>=300) throw 'Ulanish xato ('+code+'): '+resp.getContentText().slice(0,300);
  return 'OK ('+code+')';
}

/* Tizim to'xtatilganligini Supabase'dan tekshirish */
function tizimMuzlatilganMiSb() {
  var c = _aktSbCfg();
  if (!c) return false;
  var url = c.url + '/rest/v1/system_config?key=eq.SYSTEM_PAUSED&select=value';
  var headers = {'apikey': c.key, 'Authorization': 'Bearer ' + c.key};
  try {
    var resp = UrlFetchApp.fetch(url, {method: 'get', headers: headers, muteHttpExceptions: true});
    if (resp.getResponseCode() === 200) {
      var res = JSON.parse(resp.getContentText());
      if (res && res.length > 0 && res[0].value === 'true') return true;
    }
  } catch(e) {
    Logger.log('tizimMuzlatilganMiSb xato: ' + e);
  }
  return false;
}
