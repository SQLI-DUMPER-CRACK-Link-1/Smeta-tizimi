/******************************************************************
 * AIGateway.js — Gemini darvoza (FINAL: kvota-aqlli)
 * ==================================================================
 * Mavjud AIGateway.js / 00_AI_Gateway.js ICHINI shu bilan almashtiring
 * (uchala loyihada ham). So'ng yordamchi faylni o'chiring.
 *
 * YANGI (kvota muammosi uchun):
 *  • MODEL ZANJIRI: bir model kvota=0 (free_tier limit:0) bersa — KUTMAY
 *    darhol KEYINGI modelga o'tadi (oldin 58s behuda kutardi).
 *  • KVOTA xatosini (limit:0 / quota / billing) RATE-limit (429 retry) dan
 *    ajratadi: rate -> retryDelay kutib qayta uradi; kvota -> model almashtiradi.
 *  • Hammasi tugasa — ANIQ yo'l-yo'riq: billing yoqing / yangi kalit / ertaga.
 *  • Dead-model ni qisqa keshlaydi (behuda urinmaslik).
 *
 * SOZLASH:
 *   aiGwSozla({ intervalMs:4000, rpd:200, maxRetry:4,
 *               chain:'gemini-2.5-flash,gemini-2.5-flash-lite,gemini-1.5-flash' });
 *   aiGwHolat();
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
  if(o.chain!=null)      p.setProperty('AI_MODEL_CHAIN', String(o.chain));
  return aiGwHolat();
}
function aiGwHolat(){
  var p=PropertiesService.getScriptProperties();
  var today=Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMdd');
  var msg='AI Gateway:\n'+
    '• interval: '+_aiCfg('AI_MIN_INTERVAL_MS',4000)+' ms\n'+
    '• max retry: '+_aiCfg('AI_MAX_RETRY',4)+'\n'+
    '• RPD limit: '+_aiCfg('AI_RPD_LIMIT',200)+'\n'+
    '• bugungi so\'rov: '+(p.getProperty('AI_RPD_'+today)||'0')+'\n'+
    '• model zanjiri: '+(p.getProperty('AI_MODEL_CHAIN')||'(standart) gemini-2.5-flash, -flash-lite, gemini-1.5-flash');
  try{ Logger.log(msg); }catch(e){}
  return msg;
}
function _aiGwKey(){
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
      || PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}

/* Model zanjiri (kvota tugasa keyingisiga o'tadi) */
function _aiModelChain(primary){
  var custom=PropertiesService.getScriptProperties().getProperty('AI_MODEL_CHAIN');
  var chain = custom ? custom.split(',') : [primary, 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-1.5-flash'];
  var seen={}, out=[];
  chain.forEach(function(m){ m=String(m||'').trim(); if(m && !seen[m]){ seen[m]=1; out.push(m); } });
  return out;
}
function _aiQuotaXato(em){ return /limit:\s*0|free_tier|exceeded your current quota|quota exceeded|billing|resource_exhausted|resource has been exhausted/i.test(em); }
function _aiRateXato(code, em){ return code===429 || code===500 || code===503 || /overload|unavailable|try again|rate limit|too many|deadline/i.test(em); }

function _aiThrottleKut(){
  var minMs=_aiCfg('AI_MIN_INTERVAL_MS',4000);
  if(minMs<=0) return;
  var lock=LockService.getScriptLock(); var got=false;
  try{ got=lock.waitLock(45000); }catch(e){ got=false; }
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
  var key='AI_RPD_'+Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMdd');
  var n=parseInt(p.getProperty(key)||'0',10)+1; p.setProperty(key, String(n));
  return n;
}
function _aiBackoff(json, attempt){
  try{
    var det=(json && json.error && json.error.details)||[];
    for(var i=0;i<det.length;i++){ var rd=det[i] && det[i].retryDelay;
      if(rd){ var s=parseInt(String(rd).replace(/[^0-9]/g,''),10); if(!isNaN(s)&&s>0) return Math.min(s*1000+500, 60000); } }
  }catch(e){}
  var tbl=[4000, 10000, 20000, 35000, 50000];
  return tbl[Math.min(attempt, tbl.length-1)] + Math.floor(Math.random()*1500);
}
function _aiDead(model, set){
  var c=CacheService.getScriptCache(); var k='aidead_'+model;
  if(set){ try{ c.put(k,'1',120); }catch(e){} return true; }
  try{ return !!c.get(k); }catch(e){ return false; }
}

/* ==============================================================
 * PAST DARAJA — {code, json, text}
 * ============================================================== */
function aiFetchRaw(model, payload, opts){
  opts=opts||{};
  var key=_aiGwKey(); if(!key) throw new Error("GEMINI_API_KEY yo'q. Kalit ulang (setkey:).");
  model = model || (typeof GEMINI_MODEL!=='undefined' ? GEMINI_MODEL : 'gemini-2.5-flash');
  var models=_aiModelChain(model);
  var maxRetry=_aiCfg('AI_MAX_RETRY',4);
  var quotaModels=[], lastErr='HTTP ?';

  for(var mi=0; mi<models.length; mi++){
    var m=models[mi];
    if(_aiDead(m)){ quotaModels.push(m); continue; } // yaqinda kvota tugagan — o'tkazamiz
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+m+':generateContent?key='+key;

    for(var i=0;i<maxRetry;i++){
      _aiThrottleKut(); _aiRpdInc();
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
        return { code:200, json:json, text:String(json.candidates[0].content.parts[0].text||'').trim(), model:m };
      }
      var em=(json && json.error && json.error.message) ? json.error.message : ('HTTP '+code);
      lastErr=em;

      // KVOTA = 0 / billing -> kutMA, shu modelni o'lik deb belgilab, KEYINGI modelga
      if(_aiQuotaXato(em)){ _aiDead(m,true); quotaModels.push(m); break; }
      // RATE (429/503) -> retryDelay kutib qayta uramiz
      if(_aiRateXato(code, em)){ if(i<maxRetry-1){ Utilities.sleep(_aiBackoff(json,i)); continue; } break; }
      // qaytarib bo'lmaydigan (kalit/payload/model nomi xato)
      throw new Error('Gemini ('+code+'): '+em);
    }
  }

  // Hammasi tugadi
  if(quotaModels.length){
    throw new Error(
      "Bepul tarif kvotasi tugagan/0 (modellar: "+quotaModels.join(', ')+").\n"+
      "Yechim:\n"+
      "1) Google Cloud'da BILLING yoqing — gemini-2.5-flash juda arzon, limit yo'qoladi (tavsiya).\n"+
      "2) aistudio.google.com'da boshqa akkauntdan yangi API kalit -> setkey:KALIT.\n"+
      "3) Ertaga kuting — kunlik kvota tiklanadi.\n"+
      "Model zanjirini o'zgartirish: aiGwSozla({chain:'gemini-2.5-flash,gemini-1.5-flash'})"
    );
  }
  throw new Error('Gemini band — qayta urinishlar tugadi. Oxirgi: '+lastErr);
}

/* ==============================================================
 * YUQORI DARAJA
 * ============================================================== */
function aiCall(o){
  o=o||{};
  var model=o.model||(typeof GEMINI_MODEL!=='undefined'?GEMINI_MODEL:'gemini-2.5-flash');
  var ck = o.cacheKey ? ('aigw_'+_aiHash(model+'|'+o.cacheKey)) : null;
  if(ck){ try{ var c=CacheService.getScriptCache().get(ck); if(c) return c; }catch(e){} }
  var parts = o.parts || [{ text:String(o.user||'') }];
  var payload = { contents:[{ role:'user', parts:parts }],
    generationConfig:{ temperature:(o.temp!=null?o.temp:0.25), maxOutputTokens:o.maxTok||2048 } };
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
  try{ Logger.log('Javob: '+aiCall({ system:'Sen yordamchisan', user:'bitta so\'z: ishladingmi?', maxTok:20 })); }
  catch(e){ Logger.log('XATO: '+e.message); }
}
