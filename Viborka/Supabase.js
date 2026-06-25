/********************************************************************
 * Supabase.gs — VIBORKA (material nazorati) → SUPABASE
 * ==================================================================
 * MUSTAQIL TIZIM. Viborka o'zining TO'LIQ Nazorat sahifasini
 * (План = kerak, Қабул = kelgan, Қолдиқ = deficit, Ҳолат) Supabase
 * `viborka_nazorat` jadvaliga push qiladi.
 *
 * ⚠️ Smeta bilan material nomlari BIR XIL EMAS (har tizim o'zicha
 *    yozadi/normallashtiradi) → ataylab ULAMAYMIZ. Viborka deficitni
 *    O'ZIDA hisoblaydi (План−Қабул) — Smeta'ga bog'liqsiz, to'liq mustaqil.
 *    material_key faqat Viborka ICHIDA dedup uchun (o'z AI_NormalizeName).
 *
 * Nazorat ustunlari: 1№ 2Материал 3Бирлик 4План 5Қабул 6Нарх 7Сумма
 *                    8Қолдиқ 9% 10Сана 11Етказувчи 12Изоҳ 13Ҳолат 14Замена
 *
 * Sozlash (bir marta, Apps Script editor → Run):
 *   vibSupabaseSozlash('https://xxx.supabase.co','service_role_key')
 *   vibSupabaseTest() → vibSupabasePush() → vibTriggerOrnat()
 ********************************************************************/

function vibSupabaseSozlash(url, serviceKey){
  if(!url || String(url).indexOf('https://')!==0) throw 'URL https:// bilan boshlanishi kerak';
  if(!serviceKey) throw 'service_role key kiriting';
  var p=PropertiesService.getScriptProperties();
  p.setProperty('SUPABASE_URL', String(url).trim().replace(/\/+$/,''));
  p.setProperty('SUPABASE_KEY', String(serviceKey).trim());
  return 'Viborka → Supabase sozlandi: '+url;
}
function _vibSbCfg(){
  var p=PropertiesService.getScriptProperties();
  var url=p.getProperty('SUPABASE_URL'), key=p.getProperty('SUPABASE_KEY');
  return (url&&key)?{url:url, key:key}:null;
}
function _vibSbYoz(table, rows, onConflict){
  var c=_vibSbCfg(); if(!c || !rows || !rows.length) return;
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
function _vibSbOchir(table){
  var c=_vibSbCfg(); if(!c) return;
  UrlFetchApp.fetch(c.url+'/rest/v1/'+table+'?material_key=neq.__yoq__', {method:'delete',
    headers:{'apikey':c.key,'Authorization':'Bearer '+c.key,'Prefer':'return=minimal'},
    muteHttpExceptions:true});
}
function _vibNum(v){
  if(typeof v==='number') return v;
  var n=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(n)?0:n;
}

/* ============ Nazorat → viborka_nazorat (TO'LIQ, mustaqil) ============ */
function vibSupabasePush(){
  if (tizimMuzlatilganMiSb()) {
    Logger.log('Tizim to\'xtatib turilgan (PAUSED). Viborka push bajarilmadi.');
    return {ok:false, sabab:'Tizim to\'xtatilgan (PAUSED)'};
  }
  if(!_vibSbCfg()) return {ok:false, sabab:'sozlanmagan'};
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('Nazorat');
  if(!sh || sh.getLastRow()<2) return {ok:false, sabab:'Nazorat bo\'sh'};
  var n=sh.getLastRow()-1;
  var v=sh.getRange(2,1,n,14).getValues();
  var disp=sh.getRange(2,1,n,14).getDisplayValues();   // sana/% matn ko'rinishi

  var seen={}, rows=[];
  for(var i=0;i<n;i++){
    var nom=String(v[i][1]||'').trim();                // 2 Материал
    if(!nom) continue;
    var bir=String(v[i][2]||'').trim();                // 3 Бирлик
    // Viborka O'Z normalizatsiyasi bilan (faqat ichki dedup uchun)
    var nrmNom=(typeof AI_NormalizeName==='function')?AI_NormalizeName(nom):nom;
    var nrmBir=(typeof normalizeUnit==='function')?normalizeUnit(bir):bir;
    var key=String(nrmNom).toUpperCase()+'||'+String(nrmBir).toUpperCase();
    if(seen[key]) continue; seen[key]=1;               // takror — birinchisi qoladi
    rows.push({
      material_key: key,
      nom: nom,
      birlik: bir,
      plan: _vibNum(v[i][3]),                           // 4 План (kerak)
      qabul: _vibNum(v[i][4]),                          // 5 Қабул (kelgan)
      narx: _vibNum(v[i][5]),                           // 6 Нарх
      summa: _vibNum(v[i][6]),                          // 7 Сумма
      qoldiq: _vibNum(v[i][7]),                         // 8 Қолдиқ (deficit)
      foiz: String(disp[i][8]||''),                    // 9 %
      sana: String(disp[i][9]||''),                    // 10 Сана
      postavshik: String(v[i][10]||'').trim(),         // 11 Етказувчи
      holat: String(v[i][12]||'').trim(),              // 13 Ҳолат
      zamena: String(v[i][13]||'').trim(),             // 14 Замена
      updated_at: new Date().toISOString()
    });
  }
  _vibSbOchir('viborka_nazorat');                      // eski holatni tozalab qayta yozamiz
  if(rows.length) _vibSbYoz('viborka_nazorat', rows, 'material_key');
  Logger.log('Viborka → Supabase: '+rows.length+' material (nazorat) push qilindi');
  return {ok:true, soni:rows.length};
}

/* ============ TRIGGER (soatlik) ============ */
function vibTriggerOrnat(){
  vibTriggerOchir();
  ScriptApp.newTrigger('vibSupabasePush').timeBased().everyHours(1).create();
  var msg='✅ Viborka → Supabase soatlik trigger o\'rnatildi (vibSupabasePush)';
  try{ SpreadsheetApp.getUi().alert(msg); }catch(e){}
  return msg;
}
function vibTriggerOchir(){
  ScriptApp.getProjectTriggers().forEach(function(t){
    if(t.getHandlerFunction()==='vibSupabasePush') ScriptApp.deleteTrigger(t);
  });
}

/* ============ ULANISH TESTI ============ */
function vibSupabaseTest(){
  var c=_vibSbCfg(); if(!c) throw 'Avval: vibSupabaseSozlash(url, key)';
  var resp=UrlFetchApp.fetch(c.url+'/rest/v1/viborka_nazorat?select=material_key&limit=1',
    {headers:{'apikey':c.key,'Authorization':'Bearer '+c.key}, muteHttpExceptions:true});
  var code=resp.getResponseCode();
  Logger.log('Supabase viborka_nazorat status: '+code+'  '+resp.getContentText());
  if(code>=300) throw 'Ulanish xato ('+code+'): '+resp.getContentText().slice(0,300);
  return 'OK ('+code+')';
}

/* Tizim to'xtatilganligini Supabase'dan tekshirish */
function tizimMuzlatilganMiSb() {
  var c = _vibSbCfg();
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
