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

/* --- API kalitlar (Universal Jarvis AI) --- */
function _uniKey(prov){
  var nm = prov.toUpperCase() + '_API_KEY';
  return PropertiesService.getScriptProperties().getProperty(nm)
      || PropertiesService.getUserProperties().getProperty(nm) || '';
}
function _aiGwKey(){ return _uniKey('GEMINI'); }
function _groqGwKey(){ return _uniKey('GROQ'); }

function apiAiKalitSaqlaBase(prov, key){
  key = String(key||'').trim();
  if(key.length < 15) throw new Error("Noto'g'ri kalit (kamida 15 belgi)");
  var nm = prov.toUpperCase() + '_API_KEY';
  PropertiesService.getScriptProperties().setProperty(nm, key);
  try{ PropertiesService.getUserProperties().setProperty(nm, key); }catch(e){}
  if(prov.toUpperCase()==='GEMINI') _aiKalitSheetYoz(key);
  return { ok: true, mask: _aiKalitMask(key), xabar: '✅ ' + prov + ' kaliti saqlandi.' };
}
function apiAiKalitSaqla(key){ return apiAiKalitSaqlaBase('GEMINI', key); }
function apiGroqKalitSaqla(key){ return apiAiKalitSaqlaBase('GROQ', key); }
function apiOpenaiKalitSaqla(key){ return apiAiKalitSaqlaBase('OPENAI', key); }
function apiAnthropicKalitSaqla(key){ return apiAiKalitSaqlaBase('ANTHROPIC', key); }
function apiDeepseekKalitSaqla(key){ return apiAiKalitSaqlaBase('DEEPSEEK', key); }

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

/** Kalit holati (masklangan) — UI uchun */
function apiAiKalitHolat(){
  var k = _aiGwKey();
  if(!k) k = _aiKalitSheetOqi();
  if(k && !_aiGwKey()){
    try{ PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', k); }catch(e){}
  }
  return {
    bor: !!k,
    mask: k ? _aiKalitMask(k) : '',
    supabase: (typeof _sbBor === 'function') ? !!_sbBor() : false,
    gateway: true,
    groqBor: !!_uniKey('GROQ'), groqMask: _uniKey('GROQ') ? _aiKalitMask(_uniKey('GROQ')) : '',
    openaiBor: !!_uniKey('OPENAI'), openaiMask: _uniKey('OPENAI') ? _aiKalitMask(_uniKey('OPENAI')) : '',
    anthropicBor: !!_uniKey('ANTHROPIC'), anthropicMask: _uniKey('ANTHROPIC') ? _aiKalitMask(_uniKey('ANTHROPIC')) : '',
    deepseekBor: !!_uniKey('DEEPSEEK'), deepseekMask: _uniKey('DEEPSEEK') ? _aiKalitMask(_uniKey('DEEPSEEK')) : '',
    primary: PropertiesService.getScriptProperties().getProperty('AI_PRIMARY_PROV') || 'GEMINI'
  };
}

function apiSetPrimaryProv(prov){
  PropertiesService.getScriptProperties().setProperty('AI_PRIMARY_PROV', String(prov).toUpperCase());
  return {ok:true, xabar: 'Asosiy AI provayderi ' + prov + ' etib belgilandi.'};
}

/** Chat: setkey:KALIT va hk */
function apiAiKalitFromText(text){
  var t = String(text||'');
  if(/^setgroqkey:/i.test(t)) return apiGroqKalitSaqla(t.replace(/^setgroqkey:\s*/i,'').trim());
  if(/^setopenaikey:/i.test(t)) return apiOpenaiKalitSaqla(t.replace(/^setopenaikey:\s*/i,'').trim());
  if(/^setclaude:/i.test(t)) return apiAnthropicKalitSaqla(t.replace(/^setclaude:\s*/i,'').trim());
  if(/^setdeepseek:/i.test(t)) return apiDeepseekKalitSaqla(t.replace(/^setdeepseek:\s*/i,'').trim());
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
  // ⚡ 2026-07-12: INTERAKTIV chat (Panel/SmetaAI chatida foydalanuvchi jonli kutadi)
  // uchun umumiy KUTISH BYUDJETI. Fon vazifalari (Telegram/kunlik AI) uchun standart
  // backoff jadvali (5s→55s ×5 urinish ×2 model = ~4.5 daqiqagacha) to'g'ri, lekin
  // interaktiv chatda bu «5-10 daqiqa osilib qolish» shikoyatining aynan sababi edi
  // (Groq ham muvaffaqiyatsiz bo'lsa, Gemini ustiga yana shuncha vaqt qo'shiladi).
  // opts.maxWaitMs berilsa — shu vaqt tugagach DARHOL aniq xato bilan to'xtaydi.
  var t0=Date.now(), maxWait=opts.maxWaitMs>0?opts.maxWaitMs:0;
  function vaqtTugadimi(){ return maxWait>0 && (Date.now()-t0)>=maxWait; }

  for(var mi=0; mi<models.length; mi++){
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+models[mi]+':generateContent?key='+key;
    for(var i=0;i<maxRetry;i++){
      if(vaqtTugadimi()) throw new Error('AI javob bermayapti (кутиш вақти тугади, '+(maxWait/1000)+' сония). Кейинроқ уриниб кўринг.');
      _aiThrottleKut();
      _aiRpdInc();
      var resp;
      try{
        resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
          payload:JSON.stringify(payload), muteHttpExceptions:true});
      }catch(netErr){
        lastErr='network: '+(netErr.message||netErr);
        if(i<maxRetry-1 && !vaqtTugadimi()){ Utilities.sleep(_aiBackoff(null,i)); continue; }
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
        var isQuota = code===429 || /quota|exhaust|resource has been/i.test(em);
        if (isQuota && _groqGwKey() && opts.fallback !== false) break; // Uzoq kutmasdan Groq ga o'tish
        if(i<maxRetry-1 && !vaqtTugadimi()){ Utilities.sleep(_aiBackoff(json,i)); continue; }
        break;
      }
      break; // Throw qilib to'xtatmaymiz, fallback ishlashi uchun break
    }
    if(vaqtTugadimi()) break;
  }
  
  // ⚡ Universal Fallback: Agar Gemini xato bersa va Groq ulangan bo'lsa (Faktura/Vision uchun ham)
  var groqKey = _groqGwKey();
  if (opts.fallback !== false && groqKey && !vaqtTugadimi()) {
    try {
      var messages = [];
      if (payload.system_instruction && payload.system_instruction.parts) {
        messages.push({ role: 'system', content: payload.system_instruction.parts.map(function(p){return p.text}).join('\n') });
      }
      if (payload.contents) {
        payload.contents.forEach(function(c) {
          var role = (c.role === 'model') ? 'assistant' : 'user';
          var partsArr = [];
          var hasImg = false;
          (c.parts||[]).forEach(function(p) {
            if (p.text) partsArr.push({ type: 'text', text: p.text });
            var d = p.inlineData || p.inline_data;
            if (d) {
               hasImg = true;
               partsArr.push({ type: 'image_url', image_url: { url: 'data:' + d.mimeType + ';base64,' + d.data } });
            }
          });
          if (hasImg) messages.push({ role: role, content: partsArr });
          else messages.push({ role: role, content: partsArr.map(function(x){return x.text}).join('\n') });
        });
      }
      
      var r = groqFetchRaw('llama-3.2-90b-vision-preview', messages, opts);
      if (r && r.text) return { code: 200, text: r.text, json: r.json };
    } catch (gErr) {
      lastErr += ' | Groq fallback: ' + (gErr.message || gErr);
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
var GROQ_VISION_MODEL = 'llama-3.2-90b-vision-preview'; // rasm o'qish (Faktura, smeta PDF)
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
  // ⚡ 2026-07-12: interaktiv chat uchun umumiy kutish byudjeti (aiFetchRaw bilan bir xil)
  var t0=Date.now(), maxWait=opts.maxWaitMs>0?opts.maxWaitMs:0;
  function vaqtTugadimi(){ return maxWait>0 && (Date.now()-t0)>=maxWait; }

  for(var i=0;i<maxRetry;i++){
    if(vaqtTugadimi()) throw new Error('Groq javob bermayapti (кутиш вақти тугади).');
    var resp;
    try{
      resp=UrlFetchApp.fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:'post', contentType:'application/json',
        headers:{ Authorization:'Bearer '+key },
        payload: JSON.stringify(body), muteHttpExceptions:true
      });
    }catch(netErr){
      lastErr='network: '+(netErr.message||netErr);
      if(i<maxRetry-1 && !vaqtTugadimi()){ Utilities.sleep(1500*(i+1)); continue; }
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
      if(i<maxRetry-1 && !vaqtTugadimi()){ Utilities.sleep(Math.min(waitMs,20000)); continue; }
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
  if (o.contents && o.contents.length) {
    o.contents.forEach(function(c) {
      var role = (c.role === 'model') ? 'assistant' : 'user';
      var txt = '';
      if (c.parts && c.parts.length) {
        txt = c.parts.filter(function(p){return p && p.text!=null;}).map(function(p){return p.text;}).join('\n');
      }
      messages.push({ role: role, content: txt });
    });
  } else {
    var userText;
    if(o.parts && o.parts.length){
      userText=o.parts.filter(function(p){return p && p.text!=null;}).map(function(p){return p.text;}).join('\n');
    } else {
      userText=String(o.user||'');
    }
    messages.push({ role:'user', content:userText });
  }
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
 * UNIVERSAL API GATEWAY (OpenAI, DeepSeek, Anthropic)
 * ============================================================== */
function openaiCompatibleFetch(url, key, model, messages, opts) {
  opts=opts||{};
  var body = { model: model, messages: messages, temperature: (opts.temp!=null?opts.temp:0.25), max_tokens: opts.maxTok||2048 };
  if(opts.json && url.indexOf('anthropic')===-1) body.response_format={ type:'json_object' };
  var t0=Date.now(), maxWait=opts.maxWaitMs>0?opts.maxWaitMs:0;
  function vaqtTugadimi(){ return maxWait>0 && (Date.now()-t0)>=maxWait; }
  for(var i=0;i<3;i++){
    if(vaqtTugadimi()) throw new Error('API Timeout');
    var resp;
    try{
      resp=UrlFetchApp.fetch(url, { method:'post', contentType:'application/json', headers:{ Authorization:'Bearer '+key }, payload: JSON.stringify(body), muteHttpExceptions:true });
    }catch(e){ if(i<2 && !vaqtTugadimi()){ Utilities.sleep(1500*(i+1)); continue; } break; }
    var code=resp.getResponseCode();
    var json=null; try{ json=JSON.parse(resp.getContentText()); }catch(e){}
    if(code===200 && json && json.choices && json.choices.length){
      return { code:200, json:json, text:String(json.choices[0].message.content||'').trim() };
    }
    if(i<2 && !vaqtTugadimi()){ Utilities.sleep(3000*(i+1)); continue; }
    var em=(json&&json.error&&json.error.message)?json.error.message:('HTTP '+code);
    throw new Error('API Error ('+code+'): '+em);
  }
  throw new Error('API band/limitda');
}

function anthropicFetch(key, model, systemText, messages, opts) {
  opts=opts||{};
  var body = { model: model, max_tokens: opts.maxTok||2048, temperature: (opts.temp!=null?opts.temp:0.25), messages: messages };
  if(systemText) body.system = systemText;
  var t0=Date.now(), maxWait=opts.maxWaitMs>0?opts.maxWaitMs:0;
  function vaqtTugadimi(){ return maxWait>0 && (Date.now()-t0)>=maxWait; }
  for(var i=0;i<3;i++){
    if(vaqtTugadimi()) throw new Error('Anthropic Timeout');
    var resp;
    try{
      resp=UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
        method:'post', contentType:'application/json',
        headers:{ 'x-api-key':key, 'anthropic-version':'2023-06-01' },
        payload: JSON.stringify(body), muteHttpExceptions:true
      });
    }catch(e){ if(i<2 && !vaqtTugadimi()){ Utilities.sleep(1500*(i+1)); continue; } break; }
    var code=resp.getResponseCode();
    var json=null; try{ json=JSON.parse(resp.getContentText()); }catch(e){}
    if(code===200 && json && json.content && json.content.length){
      return { code:200, json:json, text:String(json.content[0].text||'').trim() };
    }
    if(i<2 && !vaqtTugadimi()){ Utilities.sleep(3000*(i+1)); continue; }
    var em=(json&&json.error&&json.error.message)?json.error.message:('HTTP '+code);
    throw new Error('Anthropic Error ('+code+'): '+em);
  }
  throw new Error('Anthropic band/limitda');
}

function uniCallText(o, url, key, defaultModel, isAnthropic) {
  var model = o.model || defaultModel;
  var messages = [];
  var sys = '';
  if(o.system) {
    if(isAnthropic) sys = String(o.system);
    else messages.push({ role:'system', content:String(o.system) });
  }
  if (o.contents && o.contents.length) {
    o.contents.forEach(function(c) {
      var role = (c.role === 'model') ? 'assistant' : 'user';
      var partsArr = [];
      var hasImg = false;
      if (c.parts && c.parts.length) {
        c.parts.forEach(function(p) {
          if (p.text != null) partsArr.push({ type: 'text', text: String(p.text) });
          var d = p.inlineData || p.inline_data;
          if (d && !isAnthropic) {
            hasImg = true;
            partsArr.push({ type: 'image_url', image_url: { url: 'data:' + d.mimeType + ';base64,' + d.data } });
          }
        });
      }
      if (hasImg) {
        messages.push({ role: role, content: partsArr });
      } else if (partsArr.length) {
        messages.push({ role: role, content: partsArr.map(function(x){return x.text}).join('\n') });
      }
    });
  } else {
    var userText;
    if(o.parts && o.parts.length){
      userText=o.parts.filter(function(p){return p && p.text!=null;}).map(function(p){return p.text;}).join('\n');
    } else {
      userText=String(o.user||'');
    }
    if(userText) messages.push({ role:'user', content:userText });
  }
  if(isAnthropic) return anthropicFetch(key, model, sys, messages, o).text||'';
  return openaiCompatibleFetch(url, key, model, messages, o).text||'';
}

/* ==============================================================
 * YUQORI DARAJA — oddiy matn/JSON so'rov (kesh ixtiyoriy)
 * UNIVERSAL ROUTER (Jarvis AI Gateway)
 * ============================================================== */
function aiCall(o){
  o=o||{};
  var ck = o.cacheKey ? ('aigw_'+_aiHash((o.model||'auto')+'|'+o.cacheKey)) : null;
  if(ck){ try{ var c=CacheService.getScriptCache().get(ck); if(c) return c; }catch(e){} }

  var hasInline = false;
  if (o.contents) {
    hasInline = o.contents.some(function(c) {
      return (c.parts || []).some(function(p) { return p && (p.inlineData || p.inline_data); });
    });
  } else {
    hasInline = (o.parts||[]).some(function(p){ return p && (p.inlineData||p.inline_data); });
  }

  var text=null;
  var primary = String(PropertiesService.getScriptProperties().getProperty('AI_PRIMARY_PROV') || 'GEMINI').toUpperCase();

  // Try models in this order (Primary first, then fallbacks)
  var order = [primary];
  var all = ['GROQ', 'DEEPSEEK', 'OPENAI', 'ANTHROPIC', 'GEMINI'];
  for(var i=0; i<all.length; i++) { if(all[i]!==primary) order.push(all[i]); }

  // ⚡⚡⚡ 2026-07-18 TEZLIK INQILOBI (foydalanuvchi: «жавоб 60 сониядан кейин келяпти»).
  // ILDIZ SABAB: primary=GEMINI birinchi sinalardi; u sekinlashsa/xato bersa, faqat
  // SHUNDAN KEYIN GROQ'ga o'tardi — kutish vaqtlari QO'SHILARDI (~60s).
  // YECHIM: SOF MATNLI chat uchun GROQ (LPU — o'nlab marta tez) BIRINCHI bo'ladi,
  // Gemini esa zaxira sifatida qoladi. Rasm/ovoz (inlineData) baribir Gemini'ga
  // boradi (quyidagi shart). Foydalanuvchi «Асосий AI» tanlovi rasm/ovoz va
  // GROQ ulanmagan holatlar uchun kuchda qoladi.
  // Diqqat: chat `model:TITAN_MODEL` (gemini-...) uzatadi — bu ANIQ provayder tanlovi
  // emas, shunchaki default. Shuning uchun gemini-* modellar ham GROQ'ga yo'naltiriladi.
  var _modelGemini = !o.model || /gemini/i.test(String(o.model));
  if(!hasInline && !o.forceGemini && _modelGemini && _uniKey('GROQ')){
     order = ['GROQ'];
     for(var i2=0;i2<all.length;i2++){ if(all[i2]!=='GROQ') order.push(all[i2]); }
  }

  if(hasInline || o.forceGemini) {
     order = ['GEMINI'];
     if (_uniKey('GROQ')) order.push('GROQ'); // Fallback to Groq Vision
  }

  for(var i=0; i<order.length; i++){
     var prov = order[i];
     var key = _uniKey(prov);
     if(!key) continue;

     try {
       if(prov === 'GROQ') {
         var gModel = hasInline ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;
         text = uniCallText(o, 'https://api.groq.com/openai/v1/chat/completions', key, gModel, false);
       }
       else if(prov === 'DEEPSEEK') text = uniCallText(o, 'https://api.deepseek.com/chat/completions', key, 'deepseek-chat', false);
       else if(prov === 'OPENAI') text = uniCallText(o, 'https://api.openai.com/v1/chat/completions', key, 'gpt-4o', false);
       else if(prov === 'ANTHROPIC') text = uniCallText(o, null, key, 'claude-3-5-sonnet-20241022', true);
       else if(prov === 'GEMINI') {
          var model = o.model || (typeof GEMINI_MODEL!=='undefined'?GEMINI_MODEL:'gemini-2.5-flash');
          var contents = o.contents || [{ role:'user', parts:(o.parts || [{ text:String(o.user||'') }]) }];
          var payload = {
            contents: contents,
            generationConfig:{ temperature:(o.temp!=null?o.temp:0.25), maxOutputTokens:o.maxTok||2048 }
          };
          if(o.system) payload.system_instruction={ parts:[{ text:o.system }] };
          if(o.json)   payload.generationConfig.responseMimeType='application/json';
          var r = aiFetchRaw(model, payload, o);
          text = r.text||'';
       }
       if(text) break; // success
     } catch (err) {
       try{ Logger.log('Provider ' + prov + ' failed: ' + err); }catch(e){}
       // continue to next fallback
     }
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
