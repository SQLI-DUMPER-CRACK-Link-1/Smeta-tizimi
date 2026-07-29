/******************************************************************
 * AI GATEWAY — barcha Gemini chaqiruvlari uchun YAGONA mustahkam darvoza
 * ==================================================================
 * THROTTLE (interval+navbat) + BACKOFF (429 retryDelay) + MODEL FALLBACK
 * + RPD hisobi + KESH. Har AI funksiya shu darvozadan o'tadi -> ketma-ket
 * ko'p chaqirilsa ham API limitiga urilib ISHLAMAY qolmaydi.
 *
 * SOZLASH (tarifga ko'ra, bir marta):
 *   aiGwSozla({intervalMs:5000, rpd:1400, maxRetry:5})  // BEPUL
 *   aiGwSozla({intervalMs:400,  rpd:50000, maxRetry:6}) // PULLIK
 *   aiGwHolat()
 ******************************************************************/

function _aiCfg(key, def){
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if(v===null || v===undefined || v==='') return def;
  var n = parseInt(v,10); return isNaN(n) ? def : n;
}
function aiGwSozla(o){
  o=o||{}; var p=PropertiesService.getScriptProperties();
  if(o.intervalMs!=null) p.setProperty('AI_MIN_INTERVAL_MS', String(o.intervalMs));
  if(o.rpd!=null)        p.setProperty('AI_RPD_LIMIT', String(o.rpd));
  if(o.maxRetry!=null)   p.setProperty('AI_MAX_RETRY', String(o.maxRetry));
  if(o.fallback!=null)   p.setProperty('AI_MODEL_FALLBACK', String(o.fallback));
  return aiGwHolat();
}
function aiGwHolat(){
  var p=PropertiesService.getScriptProperties();
  var today=Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMdd');
  var msg='AI Gateway holati:\n'+
    '• interval: '+_aiCfg('AI_MIN_INTERVAL_MS',1500)+' ms\n'+
    '• max retry: '+_aiCfg('AI_MAX_RETRY',5)+'\n'+
    '• RPD limit: '+_aiCfg('AI_RPD_LIMIT',1400)+'\n'+
    '• bugungi so\'rov: '+(p.getProperty('AI_RPD_'+today)||'0')+'\n'+
    '• fallback model: '+(p.getProperty('AI_MODEL_FALLBACK')||'gemini-2.5-flash-lite');
  try{ Logger.log(msg); }catch(e){}
  return msg;
}

function _aiGwKey(){
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
      || PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}

function _aiThrottleKut(){
  var minMs=_aiCfg('AI_MIN_INTERVAL_MS',1500);
  if(minMs<=0) return;
  var lock=LockService.getScriptLock();
  var got=false; try{ got=lock.waitLock(45000); }catch(e){ got=false; }
  try{
    var p=PropertiesService.getScriptProperties();
    var last=parseInt(p.getProperty('AI_LAST_TS')||'0',10);
    var wait=minMs-(Date.now()-last);
    if(wait>0) Utilities.sleep(Math.min(wait, minMs+100));
    p.setProperty('AI_LAST_TS', String(Date.now()));
  } finally { if(got){ try{lock.releaseLock();}catch(e){} } }
}

function _aiRpdInc(){
  var p=PropertiesService.getScriptProperties();
  var today=Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMdd');
  var key='AI_RPD_'+today;
  var n=parseInt(p.getProperty(key)||'0',10)+1;
  p.setProperty(key, String(n));
  return { n:n, lim:_aiCfg('AI_RPD_LIMIT',1400) };
}

function _aiBackoff(json, attempt){
  try{
    var det=(json && json.error && json.error.details)||[];
    for(var i=0;i<det.length;i++){
      var rd=det[i] && det[i].retryDelay;
      if(rd){ var s=parseInt(String(rd).replace(/[^0-9]/g,''),10); if(!isNaN(s)&&s>0) return Math.min(s*1000+500, 60000); }
    }
  }catch(e){}
  var tbl=[5000, 12000, 25000, 40000, 55000];
  return tbl[Math.min(attempt, tbl.length-1)] + Math.floor(Math.random()*1500);
}

function aiFetchRaw(model, payload, opts){
  opts=opts||{};
  var key=_aiGwKey(); if(!key) throw new Error("GEMINI_API_KEY yo'q. Kalit ulang (setkey:).");
  model = model || (typeof GEMINI_MODEL!=='undefined' ? GEMINI_MODEL : 'gemini-2.5-flash');
  var maxRetry=_aiCfg('AI_MAX_RETRY',5);
  var fb=PropertiesService.getScriptProperties().getProperty('AI_MODEL_FALLBACK')||'gemini-2.5-flash-lite';
  var models=[model]; if(fb && fb!==model && opts.fallback!==false) models.push(fb);
  var lastErr='HTTP ?';

  for(var mi=0; mi<models.length; mi++){
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+models[mi]+':generateContent?key='+key;
    for(var i=0;i<maxRetry;i++){
      _aiThrottleKut();
      _aiRpdInc();
      var resp;
      try{
        resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
          payload:JSON.stringify(payload), muteHttpExceptions:true});
      }catch(netErr){
        lastErr='network: '+(netErr.message||netErr);
        if(i<maxRetry-1){ Utilities.sleep(_aiBackoff(null,i)); continue; }
        break;
      }
      var code=resp.getResponseCode();
      var json=null; try{ json=JSON.parse(resp.getContentText()); }catch(e){}
      if(code===200 && json && json.candidates && json.candidates.length &&
         json.candidates[0].content && json.candidates[0].content.parts){
        return { code:200, json:json, text:String(json.candidates[0].content.parts[0].text||'').trim() };
      }
      var em=(json && json.error && json.error.message) ? json.error.message : ('HTTP '+code);
      lastErr=em;
      var qaytarsa = (code===429 || code===500 || code===503 ||
                     /overload|unavailable|exhaust|rate limit|quota|try again|resource has been/i.test(em));
      if(qaytarsa){
        if(i<maxRetry-1){ Utilities.sleep(_aiBackoff(json,i)); continue; }
        break;
      }
      throw new Error('Gemini ('+code+'): '+em);
    }
  }
  throw new Error('Gemini band/limitda — qayta urinishlar tugadi. Keyinroq urining yoki intervalni oshiring (aiGwSozla). Oxirgi: '+lastErr);
}

function aiCall(o){
  o=o||{};
  var model=o.model||(typeof GEMINI_MODEL!=='undefined'?GEMINI_MODEL:'gemini-2.5-flash');
  var ck = o.cacheKey ? ('aigw_'+_aiHash(model+'|'+o.cacheKey)) : null;
  if(ck){ try{ var c=CacheService.getScriptCache().get(ck); if(c) return c; }catch(e){} }

  var parts = o.parts || [{ text:String(o.user||'') }];
  var payload = {
    contents:[{ role:'user', parts:parts }],
    generationConfig:{ temperature:(o.temp!=null?o.temp:0.25), maxOutputTokens:o.maxTok||2048 }
  };
  if(o.system) payload.system_instruction={ parts:[{ text:o.system }] };
  if(o.json)   payload.generationConfig.responseMimeType='application/json';

  var r=aiFetchRaw(model, payload, o);
  var text=r.text||'';
  if(ck && text){ try{ CacheService.getScriptCache().put(ck, text, o.cacheTtl||21600); }catch(e){} }
  return text;
}

function _aiHash(s){
  var b=Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s||''));
  var h=''; for(var i=0;i<b.length;i++){ var v=(b[i]&0xff).toString(16); h+=(v.length===1?'0':'')+v; }
  return h;
}

function aiGwTest(){
  Logger.log(aiGwHolat());
  Logger.log('Javob: '+aiCall({ system:'Sen yordamchisan', user:'Bitta so\'z bilan javob ber: ishlayapsanmi?', maxTok:20 }));
}

/** Smeta Panel → Созлама dan saqlangan kalitni sinxronlash */
var _SMETA_SS_AI = '18mixKyl59e7spYtTZEBdseRIeH5JnjWdHehoCIvJqos';
function vibAiKalitSmetaSync(){
  try{
    var sh = SpreadsheetApp.openById(_SMETA_SS_AI).getSheetByName('SOZLAMALAR');
    if(!sh) return 'SOZLAMALAR topilmadi';
    var v = sh.getDataRange().getValues(), key = '';
    for(var i=0;i<v.length;i++){
      if(String(v[i][0]).trim().toUpperCase()==='GEMINI_API_KEY'){ key=String(v[i][1]||'').trim(); break; }
    }
    if(key.length<15) return 'Smeta da kalit yo\'q — Panel → Созлама';
    PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
    if(typeof vibAiSetKey==='function') vibAiSetKey(key);
    return '✅ Kalit Smeta dan sinxronlandi';
  }catch(e){ return 'Xato: '+(e.message||e); }
}
