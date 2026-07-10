/******************************************************************
 * AI GATEWAY — barcha AI chaqiruvlari uchun YAGONA mustahkam darvoza
 * ==================================================================
 * Muammo: har AI funksiya o'z zaif retry siga ega edi -> ketma-ket ko'p
 * chaqirilsa Gemini API limiti (429/RPM/RPD) ga urilib ISHLAMAY qolardi.
 *
 * Yechim: HAMMA chaqiruv shu darvozadan o'tadi:
 *   • THROTTLE — chaqiruvlar orasida minimal interval (LockService bilan
 *     butun loyiha bo'ylab navbat: bir vaqtda bitta so'rov).
 *   • BACKOFF — 429/503 da Gemini bergan retryDelay ni HURMAT qilib kutadi,
 *     bo'lmasa eksponensial (jitter bilan), bir necha marta qayta uradi.
 *   • MODEL FALLBACK — model band bo'lsa arzon/yuqori limitli modelga o'tadi.
 *   • RPD HISOBI — kunlik so'rov chegarasini kuzatadi.
 *   • KESH — bir xil (idempotent) so'rovni qayta hisoblamaydi.
 *   • GROQ QATLAMI (2026-07) — GROQ_API_KEY ulangan bo'lsa, SOF MATNLI
 *     (vision/audio inlineData'siz) barcha `aiCall` so'rovlari AVVAL
 *     Groq'ga boradi (LPU — sezilarli tezroq, bepul limiti kengroq).
 *     Groq xato/limit bersa — AVTOMATIK Gemini'ga qaytadi (aiFetchRaw),
 *     hech qanday chaqiruvchi kod o'zgarishi shart emas.
 *
 * SOZLASH (o'z API tarifingizga ko'ra — bir marta):
 *   aiGwSozla({intervalMs:5000, rpd:1400, maxRetry:5})   // BEPUL tarif (sekin, ehtiyot)
 *   aiGwSozla({intervalMs:400,  rpd:50000, maxRetry:6})  // PULLIK tarif (tez)
 *   Groq kalit: apiGroqKalitSaqla('gsk_...') yoki chatda "setgroqkey:gsk_..."
 *   Holatni ko'rish: aiGwHolat()
 *
 * ISHLATISH (yadro funksiyalari shunga yo'naltiriladi):
 *   var text = aiCall({ system:..., user:..., temp:0.2, maxTok:1500, json:false, cacheKey:'...' });
 *   var r    = aiFetchRaw(model, payloadObj);   // vision/maxsus payload uchun (faqat Gemini)
 *   var txt  = groqTranscribeAudio(blob);       // audio -> matn (Whisper, faqat Groq)
 ******************************************************************/

/* --- Konfiguratsiya (Script Property orqali o'zgartiriladi) --- */
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
    '• fallback model: '+(p.getProperty('AI_MODEL_FALLBACK')||'gemini-2.5-flash-lite')+'\n'+
    '• Groq: '+(_groqGwKey() ? ('ULANGAN ('+GROQ_TEXT_MODEL+', matn+ovoz shu orqali)') : 'ulanmagan (faqat Gemini)');
  try{ Logger.log(msg); }catch(e){}
  return msg;
}

/* --- API kalit (BUTUN TIZIM — bitta nom, bitta manba) --- */
function _aiGwKey(){
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
      || PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}
/* Global alias — barcha AI modullar shuni ishlatadi */
function _aiKey(){ return _aiGwKey(); }

/* --- Groq API kalit (ixtiyoriy — bo'lsa matnli AI + ovoz shu orqali, tezroq) --- */
function _groqGwKey(){
  return PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY')
      || PropertiesService.getUserProperties().getProperty('GROQ_API_KEY') || '';
}

/**
 * Groq API kalit saqlash (console.groq.com → API Keys, "gsk_..." bilan boshlanadi).
 */
function apiGroqKalitSaqla(key){
  key = String(key||'').trim();
  if(key.length < 15) throw new Error("Noto'g'ri kalit (kamida 15 belgi)");
  PropertiesService.getScriptProperties().setProperty('GROQ_API_KEY', key);
  try{ PropertiesService.getUserProperties().setProperty('GROQ_API_KEY', key); }catch(e){}
  return {
    ok: true,
    mask: _aiKalitMask(key),
    xabar: '✅ Groq kaliti saqlandi. Matnli AI va ovozli xabarlar endi Groq orqali (tezroq) ishlaydi, Gemini zaxira sifatida qoladi.'
  };
}

function _aiKalitMask(k){
  k = String(k||'');
  if(k.length < 12) return '***';
  return k.slice(0, 8) + '…' + k.slice(-4);
}

/* SOZLAMALAR varag'iga yozish — Akt/Viborka loyihalari shu yerdan o'qishi mumkin */
function _aiKalitSheetYoz(key){
  try{
    var sh = SpreadsheetApp.getActive().getSheetByName('SOZLAMALAR');
    if(!sh) return;
    var v = sh.getDataRange().getValues(), rowIdx = -1;
    for(var i=0; i<v.length; i++){
      if(String(v[i][0]).trim().toUpperCase() === 'GEMINI_API_KEY'){ rowIdx = i + 1; break; }
    }
    if(rowIdx > 0) sh.getRange(rowIdx, 2).setValue(key);
    else sh.appendRow(['GEMINI_API_KEY', key, 'AI kalit (Smeta+Akt+Viborka) — Panel Созлама dan']);
  }catch(e){ try{ Logger.log('GEMINI sheet: '+e); }catch(x){} }
}

function _aiKalitSheetOqi(){
  try{
    var sh = SpreadsheetApp.getActive().getSheetByName('SOZLAMALAR');
    if(!sh) return '';
    var v = sh.getDataRange().getValues();
    for(var i=0; i<v.length; i++){
      if(String(v[i][0]).trim().toUpperCase() === 'GEMINI_API_KEY')
        return String(v[i][1]||'').trim();
    }
  }catch(e){}
  return '';
}

/**
 * Markaziy API kalit saqlash — Panel, SmetaAI, chat setkey: hammasi shu yerda.
 * Script Property + User Property + SOZLAMALAR varaq.
 */
function apiAiKalitSaqla(key){
  key = String(key||'').trim();
  if(key.length < 15) throw new Error("Noto'g'ri kalit (kamida 15 belgi)");
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', key);
  try{ PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', key); }catch(e){}
  _aiKalitSheetYoz(key);
  return {
    ok: true,
    mask: _aiKalitMask(key),
    xabar: '✅ Gemini kaliti saqlandi. AI chat, Telegram, tahlil — hammasi ishlaydi.'
  };
}

/** Kalit holati (masklangan) — UI uchun */
function apiAiKalitHolat(){
  var k = _aiGwKey();
  if(!k) k = _aiKalitSheetOqi();
  if(k && !_aiGwKey()){
    try{ PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', k); }catch(e){}
  }
  var gk = _groqGwKey();
  return {
    bor: !!k,
    mask: k ? _aiKalitMask(k) : '',
    supabase: (typeof _sbBor === 'function') ? !!_sbBor() : false,
    gateway: true,
    groqBor: !!gk,
    groqMask: gk ? _aiKalitMask(gk) : ''
  };
}

/** Chat: setkey:KALIT (Gemini) yoki setgroqkey:KALIT (Groq) */
function apiAiKalitFromText(text){
  var t = String(text||'');
  if(/^setgroqkey:/i.test(t)) return apiGroqKalitSaqla(t.replace(/^setgroqkey:\s*/i,'').trim());
  if(/^setkey:/i.test(t)) return apiAiKalitSaqla(t.replace(/^setkey:\s*/i,'').trim());
  return null;
}

/** Sheet dan kalitni tiklash (boshqa kompyuter / yangi deploy) */
function apiAiKalitSheetdanTikla(){
  var k = _aiKalitSheetOqi();
  if(!k || k.length < 15) return { ok:false, xabar:'SOZLAMALAR da GEMINI_API_KEY yo\'q' };
  return apiAiKalitSaqla(k);
}

/* --- THROTTLE: butun loyiha bo'ylab chaqiruvlar orasida minimal interval ---
 * LockService bilan navbat; oxirgi chaqiruv vaqti Script Property da
 * (triggerlar orasida ham ishlaydi). */
function _aiThrottleKut(){
  var minMs=_aiCfg('AI_MIN_INTERVAL_MS',800);
  if(minMs<=0) return;
  var lock=LockService.getScriptLock();
  var got=false; try{ got=lock.waitLock(15000); }catch(e){ got=false; }
  try{
    var p=PropertiesService.getScriptProperties();
    var last=parseInt(p.getProperty('AI_LAST_TS')||'0',10);
    var wait=minMs-(Date.now()-last);
    if(wait>0) Utilities.sleep(Math.min(wait, minMs+100));
    p.setProperty('AI_LAST_TS', String(Date.now()));
  } finally { if(got){ try{lock.releaseLock();}catch(e){} } }
}

/* --- RPD (kunlik so'rov) hisobi --- */
function _aiRpdInc(){
  var p=PropertiesService.getScriptProperties();
  var today=Utilities.formatDate(new Date(),'Asia/Tashkent','yyyyMMdd');
  var key='AI_RPD_'+today;
  var n=parseInt(p.getProperty(key)||'0',10)+1;
  p.setProperty(key, String(n));
  return { n:n, lim:_aiCfg('AI_RPD_LIMIT',1400) };
}

/* --- 429/503 kutish vaqti: avval Gemini retryDelay, bo'lmasa eksponensial --- */
function _aiBackoff(json, attempt){
  try{
    var det=(json && json.error && json.error.details)||[];
    for(var i=0;i<det.length;i++){
      var rd=det[i] && det[i].retryDelay;
      if(rd){ var s=parseInt(String(rd).replace(/[^0-9]/g,''),10); if(!isNaN(s)&&s>0) return Math.min(s*1000+500, 60000); }
    }
  }catch(e){}
  var tbl=[5000, 12000, 25000, 40000, 55000];
  var base=tbl[Math.min(attempt, tbl.length-1)];
  return base + Math.floor(Math.random()*1500);
}

/* ==============================================================
 * PAST DARAJA — maxsus payload (vision/JSON) bilan; qaytaradi {code,json,text}
 * ============================================================== */
function aiFetchRaw(model, payload, opts){
  opts=opts||{};
  var key=_aiGwKey(); if(!key) throw new Error("GEMINI_API_KEY yo'q. Kalit ulang (setkey:).");
  model = model || (typeof GEMINI_MODEL!=='undefined' ? GEMINI_MODEL : 'gemini-2.5-flash');
  var maxRetry=_aiCfg('AI_MAX_RETRY',5);
  var fb=PropertiesService.getScriptProperties().getProperty('AI_MODEL_FALLBACK')||'gemini-2.0-flash';
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

/* ==============================================================
 * GROQ QATLAMI — LPU asosida tez inference, sof matn (vision/audio inline
 * YO'Q — audio uchun alohida groqTranscribeAudio/Whisper ishlatiladi).
 * OpenAI-mos chat/completions endpoint.
 * ============================================================== */
var GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile'; // sifat — tahlil/chat/akt
var GROQ_FAST_MODEL  = 'llama-3.1-8b-instant';    // tez/ko'p so'rovli (kunlik vazifa va h.k.)
var GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

function groqFetchRaw(model, messages, opts){
  opts=opts||{};
  var key=_groqGwKey(); if(!key) throw new Error("GROQ_API_KEY yo'q.");
  model = model || GROQ_TEXT_MODEL;
  var maxRetry=_aiCfg('GROQ_MAX_RETRY',3);
  var body={
    model: model,
    messages: messages,
    temperature: (opts.temp!=null?opts.temp:0.25),
    max_tokens: opts.maxTok||2048
  };
  if(opts.json) body.response_format={ type:'json_object' };
  var lastErr='HTTP ?';

  for(var i=0;i<maxRetry;i++){
    var resp;
    try{
      resp=UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'post', contentType:'application/json',
        headers:{ Authorization:'Bearer '+key },
        payload: JSON.stringify(body), muteHttpExceptions:true
      });
    }catch(netErr){
      lastErr='network: '+(netErr.message||netErr);
      if(i<maxRetry-1){ Utilities.sleep(1500*(i+1)); continue; }
      break;
    }
    var code=resp.getResponseCode();
    var json=null; try{ json=JSON.parse(resp.getContentText()); }catch(e){}
    if(code===200 && json && json.choices && json.choices.length){
      return { code:200, json:json, text:String(json.choices[0].message.content||'').trim() };
    }
    var em=(json&&json.error&&json.error.message)?json.error.message:('HTTP '+code);
    lastErr=em;
    if(code===429 || code===500 || code===502 || code===503){
      var waitMs=3000*(i+1);
      try{ var ra=resp.getHeaders()['Retry-After']||resp.getHeaders()['retry-after'];
           if(ra){ var s=parseInt(ra,10); if(!isNaN(s)) waitMs=Math.max(waitMs, s*1000+300); } }catch(e){}
      if(i<maxRetry-1){ Utilities.sleep(Math.min(waitMs,20000)); continue; }
      break;
    }
    throw new Error('Groq ('+code+'): '+em);
  }
  throw new Error('Groq band/limitda: '+lastErr);
}

/** Sof matn chaqiruv — aiCall() bilan bir xil `o` shaklini qabul qiladi. */
function groqCall(o){
  o=o||{};
  var model=o.groqModel||GROQ_TEXT_MODEL;
  var messages=[];
  if(o.system) messages.push({ role:'system', content:String(o.system) });
  var userText;
  if(o.parts && o.parts.length){
    userText=o.parts.filter(function(p){return p && p.text!=null;}).map(function(p){return p.text;}).join('\n');
  } else {
    userText=String(o.user||'');
  }
  messages.push({ role:'user', content:userText });
  var r=groqFetchRaw(model, messages, o);
  return r.text||'';
}

/** Audio -> matn (Whisper). blob: Telegram/Drive dan olingan audio Blob. */
function groqTranscribeAudio(blob, opts){
  opts=opts||{};
  var key=_groqGwKey(); if(!key) throw new Error("GROQ_API_KEY yo'q.");
  var resp=UrlFetchApp.fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method:'post',
    headers:{ Authorization:'Bearer '+key },
    payload:{ file: blob, model: opts.model||GROQ_WHISPER_MODEL, response_format:'json' },
    muteHttpExceptions:true
  });
  var code=resp.getResponseCode();
  var json=null; try{ json=JSON.parse(resp.getContentText()); }catch(e){}
  if(code===200 && json && typeof json.text==='string') return json.text.trim();
  var em=(json&&json.error&&json.error.message)?json.error.message:('HTTP '+code);
  throw new Error('Groq Whisper ('+code+'): '+em);
}

/* ==============================================================
 * YUQORI DARAJA — oddiy matn/JSON so'rov (kesh ixtiyoriy)
 * o = { system, user, parts?, model?, temp?, maxTok?, json?, cacheKey?, cacheTtl?, forceGemini? }
 * Sof matnli (parts ichida inlineData/inline_data yo'q) so'rovlar, Groq kaliti
 * ulangan bo'lsa, AVVAL Groq'ga boradi (tezroq, bepul limiti kengroq); xato/limit
 * bo'lsa jimgina Gemini'ga (aiFetchRaw) qaytadi — chaqiruvchi kod bilmaydi ham.
 * ============================================================== */
function aiCall(o){
  o=o||{};
  var model=o.model||(typeof GEMINI_MODEL!=='undefined'?GEMINI_MODEL:'gemini-2.5-flash');
  var ck = o.cacheKey ? ('aigw_'+_aiHash(model+'|'+o.cacheKey)) : null;
  if(ck){ try{ var c=CacheService.getScriptCache().get(ck); if(c) return c; }catch(e){} }

  var hasInline=(o.parts||[]).some(function(p){ return p && (p.inlineData||p.inline_data); });
  var text=null;

  if(!hasInline && !o.forceGemini && _groqGwKey()){
    try{ text=groqCall(o); }
    catch(gErr){ try{ Logger.log('Groq xato — Gemini\'ga qaytildi: '+gErr); }catch(e){} text=null; }
  }

  if(!text){
    var contents = o.contents || [{ role:'user', parts:(o.parts || [{ text:String(o.user||'') }]) }];
    var payload = {
      contents: contents,
      generationConfig:{ temperature:(o.temp!=null?o.temp:0.25), maxOutputTokens:o.maxTok||2048 }
    };
    if(o.system) payload.system_instruction={ parts:[{ text:o.system }] };
    if(o.json)   payload.generationConfig.responseMimeType='application/json';
    var r=aiFetchRaw(model, payload, o);
    text=r.text||'';
  }

  if(ck && text){ try{ CacheService.getScriptCache().put(ck, text, o.cacheTtl||21600); }catch(e){} }
  return text;
}

/* kichik hash (kesh kaliti uchun) */
function _aiHash(s){
  var b=Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(s||''));
  var h=''; for(var i=0;i<b.length;i++){ var v=(b[i]&0xff).toString(16); h+=(v.length===1?'0':'')+v; }
  return h;
}

function aiGwTest(){
  Logger.log(aiGwHolat());
  Logger.log('Javob: '+aiCall({ system:'Sen yordamchisan', user:'Bitta so\'z bilan javob ber: ishlayapsanmi?', maxTok:20 }));
}
