/******************************************************************
 * AktAIChat.js — AKT GENERATOR: YAGONA AQLLI AI ORKESTRATOR
 * ==================================================================
 * Muammo (eski holat):
 *   - AI chat xotirasiz edi (har chaqiruv mustaqil -> suhbat yo'q).
 *   - AI faqat akt YARATARDI; "qaysi akt yo'q", "nechta yuborilmagan",
 *     "smetada bor-u akt yo'q" kabi ishlarni qilmasdi.
 *   - ENG KATTA NUQSON: AI yaratgan qatorda KOMISSIYA/TASHKILOT/PAPKA
 *     maydonlari bo'sh qolardi -> isRowReadyForCreate_ rad etardi ->
 *     o'sha obyektda oldin akt bo'lmasa, AKT FAYLI yaratilmasdi.
 *
 * Yechim (shu fayl):
 *   1) aktAiChat(req)  — bitta aqlli kirish: niyatni aniqlaydi va
 *      yaratish / savol-javob / kamchilik / komissiya sozlashga yo'naltiradi.
 *      Suhbat XOTIRASI (history) saqlanadi.
 *   2) KOMISSIYA SHABLONI (defaults) — obyekt bo'yicha bir marta
 *      o'rnatiladi (yoki mavjud aktdan o'rganiladi) va AI yaratgan yangi
 *      qatorlarga AVTOMAT to'ldiriladi -> qatorlar darhol "yaratishga tayyor".
 *
 * Bog'liq: GeminiAssistant.js (_aktAiGen, aktAiAsk), AktSmetaBridge.js
 *          (aktAiKamchilik), TitanAI.js (askTitanAiForAct), Code.js (REY/CONFIG).
 ******************************************************************/

/* Obyekt bo'yicha to'ldiriladigan KOMISSIYA/PAPKA maydonlari */
function _aktKritikMaydon(){
  var R = (typeof REY!=='undefined') ? REY : {};
  return [R.GEN_NAME||'GEN_NAME', R.GEN_FIO||'GEN_FIO', R.GEN_POS||'GEN_POS',
    R.SUB_NAME||'SUB_NAME', R.SUB_FIO||'SUB_FIO', R.SUB_POS||'SUB_POS',
    R.CUSTOMER_ORG||'CUSTOMER_ORG', R.TEX_FIO||'TEX_FIO', R.TEX_POS||'TEX_POS',
    R.PROJECT_ORG||'PROJECT_ORG', R.PROJ_FIO||'PROJ_FIO', R.PROJ_POS||'PROJ_POS',
    R.TARGET_FOLDER_ID||'TARGET_FOLDER_ID', R.TARGET_FOLDER_PATH||'TARGET_FOLDER_PATH',
    R.ACT_FOLDER_ID||'ACT_FOLDER_ID'];
}

// Backend Log functions
function aktLogStep(reqId, msg) {
  if(!reqId) return;
  try {
    var c = CacheService.getScriptCache();
    var k = 'log_' + reqId;
    var ex = c.get(k) || "";
    var lines = ex.split('\n').filter(function(x){return x;});
    // Add timestamp
    var timeStr = new Date().toLocaleTimeString('uz-UZ', {timeZone: 'Asia/Tashkent'});
    lines.push("[" + timeStr + "] ⏳ " + msg);
    // Don't limit to 5 lines anymore. Keep up to 100 lines.
    if (lines.length > 100) lines = lines.slice(-100);
    c.put(k, lines.join('\n') + '\n', 600);
  } catch(e){}
}

function abortRequest(reqId) {
  if(!reqId) return {success: false};
  try {
    CacheService.getScriptCache().put('abort_' + reqId, "1", 600);
    aktLogStep(reqId, "🔴 FOYDALANUVCHI TOMONIDAN BEKOR QILINDI!");
    return {success: true};
  } catch(e) {
    return {success: false};
  }
}

function abortAllRequests() {
  try {
    var now = Date.now().toString();
    CacheService.getScriptCache().put('abort_time', now, 600);
    return {success: true, message: "Barcha orqa fondagi so'rovlar majburiy to'xtatildi! Endi chatdan bemalol foydalanishingiz mumkin."};
  } catch(e) {
    return {success: false, error: e.message};
  }
}

function getReqLogs(reqId) {
  if(!reqId) return "";
  try {
    return CacheService.getScriptCache().get('log_' + reqId) || "";
  } catch(e) {
    return "";
  }
}

// ----------------------------------------------------

/* ══════════════════════════════════════════════════════════════
 * ASOSIY ORKESTRATOR — bitta aqlli kirish nuqtasi
 * req = { text, image(base64)?, obyekt?, startDate?, history?:[{role,text}] }
 * ══════════════════════════════════════════════════════════════ */
function aktAiChat(req){
  try{
    req = req || {};
    var text = String(req.text||'').trim();
    var obyekt = String(req.obyekt||'').trim();
    if(!text && !req.image) return { success:false, error:"Xabar bo'sh" };

    if(/^setkey:/i.test(text)){
      var r=(typeof aktAiSetKey==='function')?aktAiSetKey(text.replace(/^setkey:\s*/i,'')):{success:false,error:'aktAiSetKey yo\'q'};
      return { success:r.success, message:r.message||r.error };
    }
    if(typeof _aktAiKey==='function' && !_aktAiKey())
      return { success:true, message:'⚙️ Gemini kaliti kerak. Sozlamalar -> "Gemini API ulash" yoki yozing: setkey:KALIT' };

    var t = text.toLowerCase();

    // 1) KOMISSIYA SHABLONI buyrug'i
    if(/komissiya|kommissiya|shablon|default|sozla.*akt|akt.*sozla|rekvizit/.test(t)){
      if(!obyekt) return { success:true, message:'Qaysi obyekt uchun komissiya shablonini sozlayman? Yuqoridan obyektni tanlang.' };
      var lr = aktDefaultsLearn(obyekt);
      return { success:true, message: lr.ok
        ? ('✅ **'+obyekt+'** uchun komissiya shabloni mavjud aktdan o\'rganildi:\n'+lr.xulosa+'\n\nEndi shu obyektga AI yaratgan yangi aktlar avtomat to\'ldiriladi.')
        : ('⚠️ '+obyekt+' uchun to\'liq tayyor akt topilmadi. Avval bitta aktni qo\'lda to\'liq (komissiya/papka bilan) yarating — keyin qolganini AI avtomat to\'ldiriladi.') };
    }

    // 2) SMETADAN AKT KAMCHILIGI (Akt<->Smeta)
    // (O'chirilgan xato blok 3)
    if(/kamchilik|akt yo|aktsiz|smetada.*akt|qoplan|yetishma/.test(t)){
      if(typeof aktAiKamchilik!=='function') return { success:true, message:'AktSmetaBridge.js yuklanmagan.' };
      if(!obyekt) return { success:true, message:'Qaysi obyekt bo\'yicha tekshiray? Obyektni tanlang.' };
      var k = aktAiKamchilik(obyekt);
      return { success:true, message: k.text || k.error };
    }

    // 3) SAVOL-JAVOB (reyestr holati) — yaratish emas
    if(_aktSavolmi(t)){
      if(typeof aktAiAsk!=='function') return { success:true, message:'GeminiAssistant.js yuklanmagan.' };
      var a = aktAiAsk(text);
      return { success:true, message: a.text || a.error };
    }

    // 4) AKT YARATISH (matn/rasm) — xotira bilan + defaults avtomat
    var hist = (req.history||[]).slice(-6).map(function(h){
      return (h.role==='model'||h.role==='ai'?'AI':'Foydalanuvchi')+': '+String(h.text||'').replace(/\s+/g,' ').slice(0,300);
    }).join('\n');
    var contextTags = [];
    if (obyekt) contextTags.push(`[OBYEKT NOMINI FOYDALANUVCHI TANLADI: ${obyekt}]`);
    if (req.startDate) contextTags.push(`[SANA TANLANDI: ${req.startDate}]`);
    var tagsStr = contextTags.length > 0 ? contextTags.join('\n') + '\n\n' : '';
    
    var promptFull = (hist ? ('OLDINGI SUHBAT (kontekst):\n'+hist+'\n\nYANGI BUYRUQ:\n') : '') + tagsStr + text;

    if(typeof askTitanAiForAct!=='function') return { success:false, error:'askTitanAiForAct topilmadi (TitanAI.js)' };
    var base64Arr = req.images && req.images.length > 0 ? req.images : (req.image ? [req.image] : null);
    aktLogStep(req.reqId, "Fayllar tahlilga tayyorlanmoqda...");
    
    // reqId ni opts kabi askTitanAiForAct ga uzata olmaymiz, shuning uchun uni AIGateway ga global qilib o'tkazamiz
    // Yoki TitanAI ga parametr qilib qo'shishimiz kerak.
    // Funksiya imzosini o'zgartirmaslik uchun PropertiesService dan foydalanamiz
    if(req.reqId) {
      PropertiesService.getScriptProperties().setProperty('CURRENT_REQ_ID', req.reqId);
      PropertiesService.getScriptProperties().setProperty('REQ_START_TIME', Date.now().toString());
    }
    var res = askTitanAiForAct(promptFull, base64Arr, req.startDate||'', obyekt);
    
    if(req.reqId) PropertiesService.getScriptProperties().deleteProperty('CURRENT_REQ_ID');
    
    aktLogStep(req.reqId, "Javob olindi. Natijalar ishlanmoqda...");

    // Yaratilgan bo'lsa — komissiya defaults'ni avtomat to'ldiramiz
    if(res && res.success && res.actsCreated && obyekt){
      try{
        var ap = aktDefaultsApply(obyekt);
        if(ap.toldirildi>0)
          res.message = (res.message||'') + '\n\n🔧 Komissiya/papka ma\'lumoti '+ap.toldirildi+' qatorga to\'ldirildi.';
        if(ap.tayyor>0)
          res.message += '\n✅ '+ap.tayyor+' ta akt "yaratishga tayyor". Asosiy -> "⚡ Akt yaratish" bosing.';
        else if(ap.toldirildi===0 && ap.shablonYoq)
          res.message += '\n⚠️ Bu obyekt uchun komissiya shabloni yo\'q. Yozing: "komissiya sozla" (yoki bitta aktni qo\'lda to\'ldiring).';
      }catch(e){}
    }
    return res;
  }catch(e){ return { success:false, error:String(e.message||e) }; }
}

/* Savol (yaratish emas) belgilarimi? */
function _aktSavolmi(t){
  if(t.indexOf('?')>=0) return true;
  if(/(nechta|qancha|qaysi|necha ta|status|holat|yuborilmagan|topshdoh|imzolan|bo.lmagan|qancha akt|ro.yxat)/.test(t)) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════
 * KOMISSIYA SHABLONI (obyekt bo'yicha defaults)
 * ══════════════════════════════════════════════════════════════ */
function _aktDefKey(obyekt){ return 'AKT_DEF_'+String(obyekt).trim().toUpperCase().slice(0,80); }

/* Saqlangan shablonni olish */
function aktDefaultsGet(obyekt){
  try{ var s=PropertiesService.getScriptProperties().getProperty(_aktDefKey(obyekt));
    return s ? JSON.parse(s) : null; }catch(e){ return null; }
}

/* Qo'lda o'rnatish (UI formadan) */
function aktDefaultsSet(obyekt, data){
  if(!obyekt) return {ok:false, error:'Obyekt yo\'q'};
  PropertiesService.getScriptProperties().setProperty(_aktDefKey(obyekt), JSON.stringify(data||{}));
  return {ok:true, message:'Shablon saqlandi: '+obyekt};
}

/* Mavjud aktdan O'RGANISH — o'sha obyektning eng to'liq qatori shablon bo'ladi */
function aktDefaultsLearn(obyekt){
  try{
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var shName=(typeof CONFIG!=='undefined'&&CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR';
    var sh=ss.getSheetByName(shName);
    if(!sh||sh.getLastRow()<2) return {ok:false};
    var map=headerMap_(sh);
    var cObj=map[(typeof REY!=='undefined'&&REY.OBJECT_NAME)||'OBJECT_NAME'];
    if(!cObj) return {ok:false};
    var fields=_aktKritikMaydon().filter(function(f){return map[f];});
    var v=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    var on=String(obyekt).trim().toUpperCase();
    var best=null, bestScore=-1;
    v.forEach(function(row){
      if(String(row[cObj-1]||'').trim().toUpperCase()!==on) return;
      var score=0, data={};
      fields.forEach(function(f){ var val=String(row[map[f]-1]||'').trim(); if(val){ score++; data[f]=row[map[f]-1]; } });
      if(score>bestScore){ bestScore=score; best=data; }
    });
    if(!best || bestScore<3) return {ok:false};
    PropertiesService.getScriptProperties().setProperty(_aktDefKey(obyekt), JSON.stringify(best));
    var xulosa=Object.keys(best).slice(0,6).map(function(k){return '• '+k;}).join('\n');
    return {ok:true, soni:bestScore, xulosa:xulosa};
  }catch(e){ return {ok:false, error:String(e.message||e)}; }
}

/* Shablonni o'sha obyektning BO'SH maydonli qatorlariga to'ldirish */
function aktDefaultsApply(obyekt){
  var def=aktDefaultsGet(obyekt);
  if(!def){
    // avtomat o'rganishga urinish
    var lr=aktDefaultsLearn(obyekt);
    def = lr.ok ? aktDefaultsGet(obyekt) : null;
  }
  if(!def) return {toldirildi:0, tayyor:0, shablonYoq:true};

  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var shName=(typeof CONFIG!=='undefined'&&CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR';
  var sh=ss.getSheetByName(shName);
  var map=headerMap_(sh);
  var cObj=map[(typeof REY!=='undefined'&&REY.OBJECT_NAME)||'OBJECT_NAME'];
  var cUrl=map[(typeof REY!=='undefined'&&REY.ACT_FILE_URL)||'ACT_FILE_URL'];
  if(!cObj) return {toldirildi:0, tayyor:0};
  var on=String(obyekt).trim().toUpperCase();
  var last=sh.getLastRow();
  var data=sh.getRange(2,1,last-1,sh.getLastColumn()).getValues();
  var toldirildi=0, tayyor=0;

  for(var i=0;i<data.length;i++){
    var row=data[i];
    if(String(row[cObj-1]||'').trim().toUpperCase()!==on) continue;
    if(cUrl && String(row[cUrl-1]||'').trim()) continue; // akt fayli bor — tegmaymiz
    var yozildi=false;
    for(var f in def){
      var col=map[f]; if(!col) continue;
      var cur=String(row[map[f]-1]||'').trim();
      if(!cur && def[f]!=='' && def[f]!=null){
        sh.getRange(i+2, col).setValue(def[f]);
        row[map[f]-1]=def[f];
        yozildi=true;
      }
    }
    if(yozildi) toldirildi++;
    // tayyormi?
    try{
      var obj={}; sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].forEach(function(h,idx){ if(h) obj[String(h).trim()]=row[idx]; });
      if(typeof isRowReadyForCreate_==='function' && isRowReadyForCreate_(obj)) tayyor++;
    }catch(e){}
  }
  if(toldirildi>0) SpreadsheetApp.flush();
  return {toldirildi:toldirildi, tayyor:tayyor};
}

/* ── Panel ochish ── */
function aktAIShow(){
  var html=HtmlService.createHtmlOutputFromFile('AktAI').setTitle('🤖 Akt AI — Aqlli yordamchi').setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

function aktAiChatTest(){
  Logger.log(JSON.stringify(aktAiChat({text:'Nechta akt bor?'}),null,2));
}
