/******************************************************************
 * AktAIChat.js — AKT GENERATOR: AQLLI ORKESTRATOR (FINAL)
 * ==================================================================
 * Mavjud AktAIChat.js ICHINI shu fayl bilan almashtiring.
 * Saqlangan: log (aktLogStep), abort, komissiya defaults, savol/kamchilik.
 * QO'SHILDI: ⭐ "DAVOM" (continuation) — katta vazifani bo'lib yaratish:
 *   AI bir martada ~6 ta akt yaratadi; tizim vazifa konteksti va yaratilgan
 *   aktlarni eslab qoladi; foydalanuvchi "davom" desa — yaratilganlarni
 *   takrorlamay, KEYINGI aktlarni davom ettiradi (tugaguncha).
 ******************************************************************/

function _aktKritikMaydon(){
  var R = (typeof REY!=='undefined') ? REY : {};
  return [R.GEN_NAME||'GEN_NAME', R.GEN_FIO||'GEN_FIO', R.GEN_POS||'GEN_POS',
    R.SUB_NAME||'SUB_NAME', R.SUB_FIO||'SUB_FIO', R.SUB_POS||'SUB_POS',
    R.CUSTOMER_ORG||'CUSTOMER_ORG', R.TEX_FIO||'TEX_FIO', R.TEX_POS||'TEX_POS',
    R.PROJECT_ORG||'PROJECT_ORG', R.PROJ_FIO||'PROJ_FIO', R.PROJ_POS||'PROJ_POS',
    R.TARGET_FOLDER_ID||'TARGET_FOLDER_ID', R.TARGET_FOLDER_PATH||'TARGET_FOLDER_PATH',
    R.ACT_FOLDER_ID||'ACT_FOLDER_ID'];
}

/* ===== Backend log / abort ===== */
function aktLogStep(reqId, msg) {
  if(!reqId) return;
  try {
    var c = CacheService.getScriptCache(); var k = 'log_' + reqId;
    var lines = (c.get(k) || "").split('\n').filter(function(x){return x;});
    var timeStr = new Date().toLocaleTimeString('uz-UZ', {timeZone: 'Asia/Tashkent'});
    lines.push("[" + timeStr + "] ⏳ " + msg);
    if (lines.length > 100) lines = lines.slice(-100);
    c.put(k, lines.join('\n') + '\n', 600);
  } catch(e){}
}
function abortRequest(reqId) {
  if(!reqId) return {success: false};
  try { CacheService.getScriptCache().put('abort_' + reqId, "1", 600); aktLogStep(reqId, "🔴 BEKOR QILINDI!"); return {success: true}; }
  catch(e) { return {success: false}; }
}
function abortAllRequests() {
  try { CacheService.getScriptCache().put('abort_time', Date.now().toString(), 600);
    return {success: true, message: "Barcha orqa fondagi so'rovlar to'xtatildi!"}; }
  catch(e) { return {success: false, error: e.message}; }
}
function getReqLogs(reqId) {
  if(!reqId) return "";
  try { return CacheService.getScriptCache().get('log_' + reqId) || ""; } catch(e) { return ""; }
}

/* ===== VAZIFA XOTIRASI (continuation) ===== */
function _aktTaskKey(obyekt){ return 'AKT_TASK_'+(obyekt?String(obyekt).toUpperCase().slice(0,55):'_GLOBAL'); }
function _aktTaskOl(obyekt){
  try{
    var p=PropertiesService.getScriptProperties();
    var s=p.getProperty(_aktTaskKey(obyekt));
    if(!s) s=p.getProperty('AKT_TASK__GLOBAL');
    return s?JSON.parse(s):null;
  }catch(e){ return null; }
}
function _aktTaskSaqla(obyekt, task){
  try{
    if(task.created && task.created.length>80) task.created=task.created.slice(-80);
    if(task.context && task.context.length>6000) task.context=task.context.slice(0,6000);
    var json=JSON.stringify(task);
    var p=PropertiesService.getScriptProperties();
    p.setProperty(_aktTaskKey(obyekt), json);
    p.setProperty('AKT_TASK__GLOBAL', json); // obyektsiz "davom" ham ishlasin
  }catch(e){}
}

/* ══════════════════════════════════════════════════════════════
 * ASOSIY ORKESTRATOR
 * req = { text, image/images, obyekt?, startDate?, history?, reqId? }
 * ══════════════════════════════════════════════════════════════ */
function aktAiChat(req){
  try{
    req = req || {};
    var text = String(req.text||'').trim();
    var obyekt = String(req.obyekt||'').trim();
    if(!text && !req.image && !(req.images&&req.images.length)) return { success:false, error:"Xabar bo'sh" };

    if(/^setkey:/i.test(text)){
      var r=(typeof aktAiSetKey==='function')?aktAiSetKey(text.replace(/^setkey:\s*/i,'')):{success:false,error:'aktAiSetKey yo\'q'};
      return { success:r.success, message:r.message||r.error };
    }
    if(typeof _aktAiKey==='function' && !_aktAiKey())
      return { success:true, message:'⚙️ Gemini kaliti kerak. "Gemini API ulash" yoki: setkey:KALIT' };

    var t = text.toLowerCase();

    // 0) ⭐ DAVOM ETTIRISH (katta vazifani bo'lib yaratish)
    if(/^\s*(davom|continue|prodolj)/.test(t) || /davom et|qolgan(ini)? (akt|yarat|davom)|keyingi(sini|larini)? (akt|yarat|davom)|qolganini yarat/.test(t)){
      return _aktDavomEt(obyekt, req);
    }

    // 1) KOMISSIYA SHABLONI
    if(/komissiya|kommissiya|shablon|rekvizit|sozla.*akt|akt.*sozla/.test(t)){
      if(!obyekt) return { success:true, message:'Qaysi obyekt uchun komissiya shablonini sozlayman? Obyektni tanlang.' };
      var lr = aktDefaultsLearn(obyekt);
      return { success:true, message: lr.ok
        ? ('✅ **'+obyekt+'** uchun komissiya shabloni mavjud aktdan o\'rganildi:\n'+lr.xulosa+'\n\nEndi yangi aktlar avtomat to\'ldiriladi.')
        : ('⚠️ '+obyekt+' uchun to\'liq tayyor akt topilmadi. Avval bitta aktni qo\'lda to\'liq (komissiya/papka bilan) yarating.') };
    }

    // 2) SMETADAN AKT KAMCHILIGI
    if(/kamchilik|akt yo|aktsiz|smetada.*akt|qoplan|yetishma/.test(t)){
      if(typeof aktAiKamchilik!=='function') return { success:true, message:'AktSmetaBridge.js yuklanmagan.' };
      if(!obyekt) return { success:true, message:'Qaysi obyekt bo\'yicha tekshiray? Obyektni tanlang.' };
      var k = aktAiKamchilik(obyekt);
      return { success:true, message: k.text || k.error };
    }

    // 3) SAVOL-JAVOB (yaratish emas)
    if(_aktSavolmi(t)){
      if(typeof aktAiAsk!=='function') return { success:true, message:'GeminiAssistant.js yuklanmagan.' };
      var a = aktAiAsk(text);
      return { success:true, message: a.text || a.error };
    }

    // 4) AKT YARATISH
    var res = _aktYarat(obyekt, text, req, /*davomKontekst*/null);

    // Katta vazifa — kontekstni saqlaymiz (keyin "davom" ishlasin)
    if(res && res.success && res.actsCreated){
      _aktTaskSaqla(obyekt, { context:text, obyekt:obyekt, startDate:req.startDate||'', created:(res.createdNames||[]) });
      res.message = (res.message||'') + '\n\n📋 Agar ishlar ko\'p bo\'lsa, qolganini yaratish uchun **"davom"** deb yozing.';
    }
    return res;

  }catch(e){ return { success:false, error:String(e.message||e) }; }
}

/* AKT YARATISH yadrosi (askTitanAiForAct ni chaqiradi) */
function _aktYarat(obyekt, text, req, davomKontekst){
  var hist = (req.history||[]).slice(-6).map(function(h){
    return (h.role==='model'||h.role==='ai'?'AI':'Foydalanuvchi')+': '+String(h.text||'').replace(/\s+/g,' ').slice(0,300);
  }).join('\n');
  var tags = [];
  if (obyekt) tags.push('[OBYEKT: '+obyekt+']');
  if (req.startDate) tags.push('[SANA: '+req.startDate+']');
  var tagsStr = tags.length ? tags.join('\n')+'\n\n' : '';

  var promptFull;
  if(davomKontekst){
    promptFull = tagsStr + davomKontekst;
  } else {
    promptFull = (hist ? ('OLDINGI SUHBAT (kontekst):\n'+hist+'\n\nYANGI BUYRUQ:\n') : '') + tagsStr + text;
  }

  if(typeof askTitanAiForAct!=='function') return { success:false, error:'askTitanAiForAct topilmadi (TitanAI.js)' };
  var base64Arr = req.images && req.images.length>0 ? req.images : (req.image ? [req.image] : null);
  aktLogStep(req.reqId, "Fayllar tahlilga tayyorlanmoqda...");

  if(req.reqId){
    PropertiesService.getScriptProperties().setProperty('CURRENT_REQ_ID', req.reqId);
    PropertiesService.getScriptProperties().setProperty('REQ_START_TIME', Date.now().toString());
  }
  var res = askTitanAiForAct(promptFull, base64Arr, req.startDate||'', obyekt);
  if(req.reqId) PropertiesService.getScriptProperties().deleteProperty('CURRENT_REQ_ID');
  aktLogStep(req.reqId, "Javob olindi. Natijalar ishlanmoqda...");

  // komissiya defaults avtomat (askTitanAiForAct ham qiladi, bu xavfsiz takror)
  if(res && res.success && res.actsCreated && obyekt){
    try{
      var ap = aktDefaultsApply(obyekt);
      if(ap.toldirildi>0) res.message=(res.message||'')+'\n🔧 Komissiya/papka '+ap.toldirildi+' qatorga to\'ldirildi.';
      if(ap.tayyor>0) res.message+='\n✅ '+ap.tayyor+' ta akt yaratishga tayyor.';
      else if(ap.shablonYoq) res.message+='\n⚠️ Komissiya shabloni yo\'q — "komissiya sozla" deng.';
    }catch(e){}
  }
  return res;
}

/* ⭐ DAVOM ETTIRISH — saqlangan kontekstdan keyingi aktlar */
function _aktDavomEt(obyekt, req){
  var task = _aktTaskOl(obyekt);
  if(!task || !task.context)
    return { success:true, message:'Davom ettirish uchun avval katta vazifa bering (ketma-ket ishlarni yozing) — keyin "davom" deysiz.' };

  var ob = obyekt || task.obyekt || '';
  var created = task.created || [];
  var davomKontekst =
    'QUYIDAGI KATTA VAZIFANI DAVOM ETTIRAMIZ. Asl topshiriq:\n"""\n'+task.context+'\n"""\n\n'+
    'ALLAQACHON YARATILGAN AKTLAR (bularni QAYTA YARATMA):\n'+
    (created.length ? created.map(function(n){return '- '+n;}).join('\n') : '(hali yo\'q)')+
    '\n\nShu ketma-ketlikda KEYINGI mantiqiy aktlarni davom ettir (ko\'pi bilan 6 ta). '+
    'Hammasi tugagan bo\'lsa: [{"chat_message":"✅ Barcha aktlar yaratildi."}].';

  req = req || {};
  var fakeReq = { reqId:req.reqId, startDate:task.startDate||req.startDate||'', history:[] };
  var res = _aktYarat(ob, '', fakeReq, davomKontekst);

  if(res && res.success){
    if(res.createdNames && res.createdNames.length){
      task.created = created.concat(res.createdNames);
      _aktTaskSaqla(obyekt, task);
      res.message = (res.message||'') +
        '\n\n📋 Jami yaratilgan: '+task.created.length+' ta. Yana qolgan bo\'lsa **"davom"** deng.';
    } else if(!res.actsCreated){
      // chat_message (tugadi yoki savol) — vazifa tugagan deb belgilaymiz
      res.message = (res.message||'') + '\n\n(Agar yana ish qolgan bo\'lsa, qisqacha eslatib yozing.)';
    }
  }
  return res;
}

function _aktSavolmi(t){
  if(t.indexOf('?')>=0) return true;
  if(/(nechta|qancha|qaysi|necha ta|status|holat|yuborilmagan|imzolan|bo.lmagan|qancha akt|ro.yxat)/.test(t)) return true;
  return false;
}

/* ══════════════════════════════════════════════════════════════
 * KOMISSIYA SHABLONI (defaults)
 * ══════════════════════════════════════════════════════════════ */
function _aktDefKey(obyekt){ return 'AKT_DEF_'+String(obyekt).trim().toUpperCase().slice(0,80); }
function aktDefaultsGet(obyekt){
  try{ var s=PropertiesService.getScriptProperties().getProperty(_aktDefKey(obyekt)); return s?JSON.parse(s):null; }catch(e){ return null; }
}
function aktDefaultsSet(obyekt, data){
  if(!obyekt) return {ok:false, error:'Obyekt yo\'q'};
  PropertiesService.getScriptProperties().setProperty(_aktDefKey(obyekt), JSON.stringify(data||{}));
  return {ok:true, message:'Shablon saqlandi: '+obyekt};
}
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
    return {ok:true, soni:bestScore, xulosa:Object.keys(best).slice(0,6).map(function(k){return '• '+k;}).join('\n')};
  }catch(e){ return {ok:false, error:String(e.message||e)}; }
}
function aktDefaultsApply(obyekt){
  var def=aktDefaultsGet(obyekt);
  if(!def){ var lr=aktDefaultsLearn(obyekt); def = lr.ok ? aktDefaultsGet(obyekt) : null; }
  if(!def) return {toldirildi:0, tayyor:0, shablonYoq:true};
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var shName=(typeof CONFIG!=='undefined'&&CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR';
  var sh=ss.getSheetByName(shName);
  var map=headerMap_(sh);
  var cObj=map[(typeof REY!=='undefined'&&REY.OBJECT_NAME)||'OBJECT_NAME'];
  var cUrl=map[(typeof REY!=='undefined'&&REY.ACT_FILE_URL)||'ACT_FILE_URL'];
  if(!cObj) return {toldirildi:0, tayyor:0};
  var on=String(obyekt).trim().toUpperCase();
  var data=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
  var toldirildi=0, tayyor=0;
  var hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  for(var i=0;i<data.length;i++){
    var row=data[i];
    if(String(row[cObj-1]||'').trim().toUpperCase()!==on) continue;
    if(cUrl && String(row[cUrl-1]||'').trim()) continue;
    var yozildi=false;
    for(var f in def){
      var col=map[f]; if(!col) continue;
      if(!String(row[map[f]-1]||'').trim() && def[f]!=='' && def[f]!=null){
        sh.getRange(i+2, col).setValue(def[f]); row[map[f]-1]=def[f]; yozildi=true;
      }
    }
    if(yozildi) toldirildi++;
    try{ var obj={}; hdr.forEach(function(h,idx){ if(h) obj[String(h).trim()]=row[idx]; });
      if(typeof isRowReadyForCreate_==='function' && isRowReadyForCreate_(obj)) tayyor++; }catch(e){}
  }
  if(toldirildi>0) SpreadsheetApp.flush();
  return {toldirildi:toldirildi, tayyor:tayyor};
}

function aktAIShow(){
  var html=HtmlService.createHtmlOutputFromFile('AktAI').setTitle('🤖 Akt AI — Aqlli yordamchi').setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}
function aktAiChatTest(){ Logger.log(JSON.stringify(aktAiChat({text:'Nechta akt bor?'}),null,2)); }
