/********************************************************************
 * 40_Telegram.gs — TELEGRAM BOT
 * ==================================================================
 * Bot orqali butun tizimni nazorat qilish:
 *   - WebApp tugmalari: Admin panel / Rahbar dashboard (Telegram ichida ochiladi)
 *   - Native buyruqlar: tezkor ko'rsatkichlar, ob'ektlar holati
 *   - Ruxsat: faqat ro'yxatdagi user ID lar
 *
 * SOZLASH (bir marta):
 *   1. @BotFather → /newbot → TOKEN olish
 *   2. tgTokenSet('TOKEN') — Script Properties ga saqlaydi
 *   3. tgAdminSet('123456789,987654321') — ruxsat berilgan user ID lar
 *   4. Web App deploy (Anyone access)
 *   5. tgWebhookSet() — webhookni o'rnatadi
 *   6. tgMenuSet() — bot menyu tugmasini o'rnatadi (ixtiyoriy)
 *
 * Script Properties kalitlari:
 *   TG_TOKEN     — bot tokeni
 *   TG_ADMINS    — vergul bilan ajratilgan user ID lar (to'liq ruxsat)
 *   TG_VIEWERS   — vergul bilan ajratilgan user ID lar (faqat ko'rish)
 ********************************************************************/

var TG_API = 'https://api.telegram.org/bot';

/* ============ ⭐ BITTA TUGMA SOZLASH ⭐ ============
 * Apps Script editor → funksiya ro'yxatidan TIZIM_SOZLASH ni tanlab → Run.
 * Hamma narsa avtomat: Web App URL, Telegram token, webhook.
 * URL o'zgarsa — pastdagi qiymatni yangilab qayta Run qiling. */
function TIZIM_SOZLASH(){
  // ⚠️ XAVFSIZLIK: bot tokeni KODGA YOZILMAYDI (avval hardcode edi → sizib ketish xavfi).
  // Token Script Property'да (TG_TOKEN). Bir marta o'rnatish: editorда tgTokenSet('BOT_TOKEN').
  var TOKEN    = _tgToken();
  if(!TOKEN){ throw '❌ Token yo\'q. Avval editorда: tgTokenSet("BOT_TOKEN") ни RUN qiling, keyin TIZIM_SOZLASH.'; }
  var ADMIN_ID = _tgAdmins()[0] || '1290590501';  // birinchi admin (yoki propдан)

  // Har doim EXEC URL — Script Properties dan yoki hardcoded
  // ScriptApp.getService().getUrl() /dev qaytaradi — ishlatmaymiz
  var WEBAPP = 'https://script.google.com/macros/s/AKfycbx0tzNBlYPgaks51yZk6hU3d5UU32LjXvybSJWXekup7HxgjcCk86gVrCy_9X12dQIbTQ/exec';
  WEBAPP = WEBAPP.replace(/\?.*$/, '').replace(/\/dev$/, '/exec');

  var sp = PropertiesService.getScriptProperties();
  sp.setProperty('WEBAPP_URL', WEBAPP);
  sp.setProperty('TG_TOKEN', TOKEN.trim());
  sp.setProperty('TG_ADMINS', ADMIN_ID);
  // Diagnostika hisoblagichlarni tozalash
  sp.deleteProperty('TG_LAST_POST');
  sp.deleteProperty('TG_POST_COUNT');

  // Bot tekshirish
  var me = JSON.parse(UrlFetchApp.fetch(TG_API+TOKEN+'/getMe',{muteHttpExceptions:true}).getContentText());
  if(!me.ok) throw '❌ Token xato: '+JSON.stringify(me);

  // Oldin webhook o'chirish, keyin qayta o'rnatish
  UrlFetchApp.fetch(TG_API+TOKEN+'/deleteWebhook',{muteHttpExceptions:true});
  Utilities.sleep(1000);
  var whRes = UrlFetchApp.fetch(TG_API+TOKEN+'/setWebhook',{
    method:'post', contentType:'application/json',
    payload:JSON.stringify({url:WEBAPP, drop_pending_updates:true}),
    muteHttpExceptions:true
  });
  var wh = JSON.parse(whRes.getContentText());

  // Webhook tekshirish
  Utilities.sleep(500);
  var info = JSON.parse(UrlFetchApp.fetch(TG_API+TOKEN+'/getWebhookInfo',{muteHttpExceptions:true}).getContentText());

  // Menyu tugmasi
  try{ tgMenuSet(); }catch(e){}
  // Avtomatik triggerlar (har kuni dashboard/kesh yangilash)
  var trigMsg='';
  try{ trigMsg=triggerlarOrnat(); }catch(e){ trigMsg='⚠️ Trigger ALOHIDA o\'rnatiladi — quyidagi 4-qadamni baj.'; }

  var out = (wh.ok ? '✅' : '❌') + ' ТИЗИМ СОЗЛАНДИ\n\n'
    + '🤖 Bot: @'+me.result.username+'\n'
    + '🌐 URL: '+WEBAPP+'\n'
    + '🔗 Webhook: '+(wh.ok?'✅ O\'rnatildi':'❌ '+JSON.stringify(wh))+'\n'
    + '📍 Info URL: '+(info.result&&info.result.url||'❌ bo\'sh!')+'\n'
    + '👤 Admin: '+ADMIN_ID+'\n'
    + '⏰ '+trigMsg+'\n\n'
    + (wh.ok
      ? '📱 Endi /start yuboring!\n\n4️⃣ Trigger uchun: Editor da triggerlarOrnat() → Run → Allow'
      : '❌ XATO — URL ni tekshiring!');
  Logger.log(out);
  return out;
}

/* ============ SOZLASH FUNKSIYALARI (Apps Script editordan ishga tushiriladi) ============ */
function tgTokenSet(token){
  if(!token) throw 'Token kiriting: tgTokenSet("123:ABC...")';
  PropertiesService.getScriptProperties().setProperty('TG_TOKEN', String(token).trim());
  return 'Token saqlandi. Endi tgWebhookSet() ishga tushiring.';
}
function tgAdminSet(ids){
  // ⬇️ Bu yerga o'z Telegram ID ingizni yozing (vergul bilan bir nechta bo'lishi mumkin)
  // Misol: tgAdminSet('123456789')  yoki  tgAdminSet('123456789,987654321')
  PropertiesService.getScriptProperties().setProperty('TG_ADMINS', String(ids||'').trim());
  return 'Adminlar saqlandi: '+ids;
}
function tgViewerSet(ids){
  PropertiesService.getScriptProperties().setProperty('TG_VIEWERS', String(ids||'').trim());
  return 'Kuzatuvchilar: '+ids;
}
function tgWebhookSet(){
  var token=_tgToken(); if(!token) throw 'Avval tgTokenSet() bilan token saqlang.';
  var url=_webAppUrl();
  if(!url) throw 'Web App URL topilmadi. Avval deploy qiling.';
  var res=UrlFetchApp.fetch(TG_API+token+'/setWebhook?url='+encodeURIComponent(url),
    {muteHttpExceptions:true});
  return res.getContentText();
}
function tgWebhookDel(){
  var token=_tgToken(); if(!token) throw 'Token yo\'q';
  return UrlFetchApp.fetch(TG_API+token+'/deleteWebhook',{muteHttpExceptions:true}).getContentText();
}
function tgWebhookInfo(){
  var token=_tgToken(); if(!token) throw 'Token yo\'q';
  return UrlFetchApp.fetch(TG_API+token+'/getWebhookInfo',{muteHttpExceptions:true}).getContentText();
}

/* To'g'ridan xabar yuborish testi */
function tgTest(){
  var token=_tgToken();
  if(!token){ Logger.log('❌ TOKEN YO\'Q'); return; }
  // To'g'ridan Anvar ga xabar
  var chatId='1290590501';
  var res=UrlFetchApp.fetch(TG_API+token+'/sendMessage',{
    method:'post', contentType:'application/json',
    payload:JSON.stringify({
      chat_id:chatId,
      text:'✅ Bot ishlayapti! Bu test xabari.\n\nWebhook va token to\'g\'ri.'
    }),
    muteHttpExceptions:true
  });
  var r=res.getContentText();
  Logger.log('sendMessage natijasi: '+r);
  return r;
}

/* Diagnostika — bot holati tekshirish */
function tgDiag(){
  var token=_tgToken();
  var url=_webAppUrl();
  var admins=_tgAdmins();
  var log=[];
  log.push('TOKEN: '+(token?'✅ bor ('+token.slice(0,10)+'...)':'❌ YO\'Q'));
  log.push('WEBAPP_URL: '+(url?'✅ '+url:'❌ YO\'Q — webAppUrlSet() chaqiring'));
  log.push('TG_ADMINS: '+(admins.length?'✅ '+admins.join(','):'⚠️ bo\'sh (hamma admin)'));
  if(token){
    try{
      var me=JSON.parse(UrlFetchApp.fetch(TG_API+token+'/getMe',{muteHttpExceptions:true}).getContentText());
      log.push('BOT: '+(me.ok?'✅ @'+me.result.username:'❌ XATO: '+JSON.stringify(me)));
      var wh=JSON.parse(UrlFetchApp.fetch(TG_API+token+'/getWebhookInfo',{muteHttpExceptions:true}).getContentText());
      log.push('WEBHOOK: '+(wh.result&&wh.result.url?'✅ '+wh.result.url:'❌ O\'RNATILMAGAN'));
      if(wh.result&&wh.result.last_error_message) log.push('WEBHOOK XATO: ❌ '+wh.result.last_error_message);
    }catch(e){log.push('API tekshirishda xato: '+e);}
  }
  var result=log.join('\n');
  Logger.log(result);
  return result;
}
/* Bot menyu tugmasi — chatda doimiy "Boshqaruv" tugmasi (WebApp ochadi) */
function tgMenuSet(){
  var token=_tgToken(); if(!token) throw 'Token yo\'q';
  var url=_webAppUrl();
  var payload={menu_button:{type:'web_app',text:'🏗️ Очиш',web_app:{url:url}}};
  var res=UrlFetchApp.fetch(TG_API+token+'/setChatMenuButton',{
    method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  return res.getContentText();
}

/* ============ YORDAMCHILAR ============ */
function _tgToken(){ return PropertiesService.getScriptProperties().getProperty('TG_TOKEN')||''; }
function _tgAdmins(){ return (PropertiesService.getScriptProperties().getProperty('TG_ADMINS')||'')
  .split(',').map(function(s){return s.trim();}).filter(String); }
function _tgViewers(){ return (PropertiesService.getScriptProperties().getProperty('TG_VIEWERS')||'')
  .split(',').map(function(s){return s.trim();}).filter(String); }
function _tgRole(userId){
  var id=String(userId);
  if(_tgAdmins().indexOf(id)>=0) return 'admin';
  if(_tgViewers().indexOf(id)>=0) return 'viewer';
  // Hech kim ro'yxatda bo'lmasa — birinchi foydalanuvchi admin bo'ladi (setup yengillik)
  if(_tgAdmins().length===0 && _tgViewers().length===0) return 'admin';
  return 'none';
}

function _tgSend(chatId, text, keyboard){
  var token=_tgToken(); if(!token){ Logger.log('TG: token yo\'q'); return; }
  var payload={chat_id:chatId, text:text, parse_mode:'HTML', disable_web_page_preview:true};
  if(keyboard) payload.reply_markup=JSON.stringify(keyboard);
  var res=UrlFetchApp.fetch(TG_API+token+'/sendMessage',{
    method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
  var r=JSON.parse(res.getContentText());
  if(!r.ok){ Logger.log('TG sendMessage xato: '+JSON.stringify(r)); }
  return r;
}
function _tgEdit(chatId, msgId, text, keyboard){
  var token=_tgToken(); if(!token) return;
  var payload={chat_id:chatId, message_id:msgId, text:text, parse_mode:'HTML', disable_web_page_preview:true};
  if(keyboard) payload.reply_markup=JSON.stringify(keyboard);
  UrlFetchApp.fetch(TG_API+token+'/editMessageText',{
    method:'post',contentType:'application/json',payload:JSON.stringify(payload),muteHttpExceptions:true});
}
function _tgAnswerCb(cbId, text){
  var token=_tgToken(); if(!token) return;
  UrlFetchApp.fetch(TG_API+token+'/answerCallbackQuery',{
    method:'post',contentType:'application/json',
    payload:JSON.stringify({callback_query_id:cbId, text:text||''}),muteHttpExceptions:true});
}

/* ============ WEBHOOK HANDLER (doPost) ============ */
function doPost(e){
  // Diagnostika: har chaqiruvda vaqtni saqlaymiz
  try{
    var sp=PropertiesService.getScriptProperties();
    sp.setProperty('TG_LAST_POST', new Date().toISOString());
    sp.setProperty('TG_POST_COUNT', String((parseInt(sp.getProperty('TG_POST_COUNT')||'0')+1)));
  }catch(ex){}

  try{
    if(!e||!e.postData||!e.postData.contents){
      Logger.log('doPost: postData yo\'q');
      return _ok();
    }
    var raw=e.postData.contents;

    // [WEB API v2] — sayt chaqiruvi. Logdan OLDIN, chunki body ichida token bor.
    if(raw.indexOf('"__api"') > -1){
      try{ return webApiIshlov(JSON.parse(raw)); }
      catch(exApi){
        return ContentService.createTextOutput(JSON.stringify({ok:false,error:'JSON parse: '+exApi}))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    Logger.log('doPost kirdi: '+raw.slice(0,200));
    var upd=JSON.parse(raw);

    // [Webhook: Akt -> Smeta ReverseSync]
    if(upd.action === 'reverse_sync_fakt' && upd.obyekt && upd.rows){
      var ans = {ok: false};
      try {
        if(typeof apiFaktSinxron === 'function'){
          ans = apiFaktSinxron(upd.obyekt, upd.rows);
        } else {
          ans.error = 'apiFaktSinxron topilmadi';
        }
      } catch(ex){ ans.error = String(ex.message||ex); }
      return ContentService.createTextOutput(JSON.stringify(ans)).setMimeType(ContentService.MimeType.JSON);
    }

    // ⚠️ DEDUP: Telegram javob kechiksa BIR XIL update ni QAYTA yuboradi →
    // menyu ketma-ket spam bo'lardi. update_id ni keshda belgilaymiz: takror → e'tibor yo'q.
    if(upd.update_id!==undefined){
      var dKey='tg_u_'+upd.update_id, c=CacheService.getScriptCache();
      if(c.get(dKey)){ Logger.log('doPost dedup skip: '+upd.update_id); return _ok(); }
      c.put(dKey,'1',3600);
    }
    if(upd.message)         _tgOnMessage(upd.message);
    else if(upd.callback_query) _tgOnCallback(upd.callback_query);
    else Logger.log('Noma\'lum update turi: '+JSON.stringify(Object.keys(upd)));
  }catch(err){
    Logger.log('doPost xato: '+err+'\n'+err.stack);
    // Xato bo'lsa ham Telegram ga 200 qaytarish kerak
  }
  return _ok();
}
function _ok(){ return ContentService.createTextOutput('ok'); }

/* ⭐ SPAM TO'XTATISH — navbatdagi barcha eski xabarlarni tashlaydi.
 * 512 marta menyu spam bo'lsa shuni Run qiling. */
function tgSpamTuxtat(){
  var token=_tgToken(); if(!token) return 'Token yo\'q';
  // Webhook o'chirib, barcha pending updates ni drop qilamiz
  var r1=UrlFetchApp.fetch(TG_API+token+'/deleteWebhook?drop_pending_updates=true',
    {muteHttpExceptions:true}).getContentText();
  Utilities.sleep(1500);
  // Qayta o'rnatamiz
  var url=_webAppUrl();
  var r2=UrlFetchApp.fetch(TG_API+token+'/setWebhook',{
    method:'post',contentType:'application/json',
    payload:JSON.stringify({url:url, drop_pending_updates:true}),
    muteHttpExceptions:true}).getContentText();
  var out='✅ Spam to\'xtatildi.\nDelete: '+r1+'\nSet: '+r2;
  Logger.log(out);
  return out;
}

/* doPost chaqirilganmi tekshirish */
function tgPostHolat(){
  var sp=PropertiesService.getScriptProperties();
  var last=sp.getProperty('TG_LAST_POST')||'hech qachon';
  var cnt =sp.getProperty('TG_POST_COUNT')||'0';
  var msg='doPost holati:\n  Oxirgi chaqiruv: '+last+'\n  Jami: '+cnt+' marta';
  Logger.log(msg);
  return msg;
}

/* ============ XABAR ISHLOVI ============ */
function _tgOnMessage(msg){
  var chatId=msg.chat.id, userId=msg.from.id, text=String(msg.text||'').trim();
  var role=_tgRole(userId);
  if(role==='none'){
    _tgSend(chatId, '⛔ Кечирасиз, сизда рухсат йўқ.\n\nСизнинг ID: <code>'+userId+'</code>\nАдминга шу ID ни юборинг.');
    return;
  }
  if(text==='/start' || text==='/menu'){
    _tgMainMenu(chatId, role);
    return;
  } else if(text==='/id'){
    _tgSend(chatId, 'Сизнинг ID: <code>'+userId+'</code>\nРол: <b>'+role+'</b>');
  } else if(text==='/dashboard' || text==='/jami'){
    _tgDashboard(chatId);
  } else if(text==='/objects' || text==='/obyektlar'){
    _tgObjectsList(chatId);
  } else {
    // ⚡ HAMMA OG'IR ISH FONГА (trigger) — webhook darrov ok qaytaradi (bloklanmaydi).
    // Avval sklad (ovoz→AI) va AI-javob sinxron edi → 30-300 sek webhook bloklanardi →
    // Telegram qayta yuboradi → sekin/javob yo'q. Endi navbatga qo'yamiz, fon-ijro javob beradi.
    if (msg.voice || msg.audio) {
      _tgSend(chatId, '🎤 Овозли хабар қабул қилинди, ишланмоқда...');
      _tgFonQosh({kind:'sklad', chatId:String(chatId), msg:_tgSlimMsg(msg)});
    } else if (text) {
      var matnLow = text.toLowerCase();
      var isSklad = (matnLow.includes('prixod') || matnLow.includes('rasxod') || matnLow.includes('keldi') || matnLow.includes('ketdi'));
      if (isSklad) {
        _tgSend(chatId, '📦 Склад хабари қабул қилинди, ишланмоқда...');
        _tgFonQosh({kind:'sklad', chatId:String(chatId), msg:_tgSlimMsg(msg)});
      } else {
        _tgSend(chatId, '⏳ Таҳлил қилинмоқда, бир зумда жавоб бераман...');
        _tgFonQosh({kind:'ai', chatId:String(chatId), text:text});
      }
    }
  }
  // Boshqa xabarlarga JAVOB YO'Q — spam/loop oldini oladi.
}

/* ============ CALLBACK ISHLOVI (inline tugmalar) ============ */
function _tgOnCallback(cb){
  var chatId=cb.message.chat.id, msgId=cb.message.message_id, userId=cb.from.id;
  var data=String(cb.data||''), role=_tgRole(userId);
  _tgAnswerCb(cb.id);
  if(role==='none'){ return; }

  if(data==='menu'){ _tgMainMenuEdit(chatId, msgId, role); }
  else if(data==='dashboard'){ _tgDashboardEdit(chatId, msgId); }
  else if(data==='shart'){ _tgShartEdit(chatId, msgId); }
  else if(data==='objects'){ _tgObjectsListEdit(chatId, msgId); }
  else if(data.indexOf('ob:')===0){ _tgObjectDetail(chatId, msgId, data.substring(3)); }
  else if(data==='akt'){ _tgAktEdit(chatId, msgId); }
  else if(data==='prixod'){ _tgPrixodEdit(chatId, msgId); }
  else if(data==='ai_tab'){ _tgAiTabEdit(chatId, msgId); }
}

/* ============ AKT (Telegram) ============ */
function _tgAktText(){
  var t='📋 <b>АКТЛАР</b> (охирги 10 та)\n\n';
  try{
    var d=apiAktlarOl(10,'');
    if(!d.rows.length) return t+'Акт топилмади.';
    var st=[]; for(var k in (d.statlar||{})) st.push(k+': '+d.statlar[k]);
    t+='<i>'+st.join(' · ')+'</i>\nЖами: <b>'+d.jami+'</b>\n\n';
    d.rows.forEach(function(a){
      t+='№<b>'+_tgEsc(a.num)+'</b> — '+_tgEsc(a.work.slice(0,60))+'\n';
      t+='   🏗 '+_tgEsc(a.obj)+' · '+_tgEsc(a.comm||a.status)+'\n';
      if(a.start||a.end) t+='   📅 '+_tgEsc(a.start)+' → '+_tgEsc(a.end)+'\n';
      t+='\n';
    });
    t+='✍️ Тўлиқ кўриш/ёзиш — <b>Бошқарув панели</b> да.';
  }catch(e){ t+='❌ '+(e.message||e); }
  return t;
}
function _tgAktEdit(chatId, msgId){
  _tgEdit(chatId, msgId, _tgAktText(), {inline_keyboard:[
    [{text:'📦 Приход', callback_data:'prixod'},{text:'« Меню', callback_data:'menu'}]
  ]});
}

/* ============ PRIXOD (Telegram) ============ */
function _tgPrixodText(){
  var t='📦 <b>ПРИХОД</b> (охирги 12 та)\n\n';
  try{
    var d=apiPrixodOl(12,'');
    if(!d.rows.length) return t+'Материал топилмади.';
    t+='Жами ёзув: <b>'+d.jami+'</b>\n\n';
    d.rows.forEach(function(p){
      t+='• <b>'+_tgEsc(p.nom.slice(0,50))+'</b>\n';
      t+='   '+_tgEsc(p.razdel)+' · '+p.hajm+' '+_tgEsc(p.birlik)
        +(p.narx?' · '+_tgMln(p.narx):'')+'\n';
      t+='   📅 '+_tgEsc(p.sana)+(p.postavshik?' · '+_tgEsc(p.postavshik):'')+'\n\n';
    });
    t+='✍️ Тўлиқ кўриш/ёзиш — <b>Бошқарув панели</b> да.';
  }catch(e){ t+='❌ '+(e.message||e); }
  return t;
}
function _tgPrixodEdit(chatId, msgId){
  _tgEdit(chatId, msgId, _tgPrixodText(), {inline_keyboard:[
    [{text:'📋 Актлар', callback_data:'akt'},{text:'« Меню', callback_data:'menu'}]
  ]});
}

function _tgAiTabEdit(chatId, msgId){
  var t = "🤖 <b>AI YORDAMCHI (QO'LLANMA)</b>\n\n"
    + "Men bilan shunchaki chatda gaplashishingiz mumkin! Savolingiz bo'lsa beravering, men Smetaga oid masalalarda yordam beraman.\n\n"
    + "📦 <b>OMBOR (SKLAD) UCHUN QO'LLANMA:</b>\n"
    + "Botga ovozli xabar yoki yozma tarzda 'Prixod...' yoki 'Rasxod...' deb yuborsangiz, men uni to'g'ridan to'g'ri Sklad exceliga yozib qo'yaman.\n\n"
    + '✅ <b>Prixod namunasi:</b>\n'
    + '<i>"Prixod, bugun beton zavodidan 20 kub m250 beton keldi"</i>\n'
    + '(Sana, turi, nomi, hajmi va postavshik avtomatik yoziladi)\n\n'
    + '✅ <b>Rasxod namunasi:</b>\n'
    + '<i>"Rasxod qildik, Otabekka 50 ta shifer berdik, va subpudratchiga 2 tonna sement"</i>\n'
    + '(Bitta xabardan ikkita narsani farqlab, alohida qator qilib yozadi)';
    
  _tgEdit(chatId, msgId, t, {inline_keyboard:[
    [{text:'« Меню', callback_data:'menu'}]
  ]});
}

/* ============ ASOSIY MENYU ============ */
function _tgMenuKeyboard(role){
  var url=_webAppUrl();
  var rows=[];
  // WebApp tugmalari — faqat URL to'g'ri bo'lsa qo'shamiz
  // (URL bo'sh bo'lsa Telegram butun xabarnoma yuborishdan bosh tortadi)
  var hasUrl = url && url.indexOf('https://')===0;
  if(hasUrl){
    if(role==='admin'){
      rows.push([{text:'⚙️ Бошқарув панели (Admin)', web_app:{url:url+'?p=admin'}}]);
    }
    rows.push([{text:'📊 Раҳбар дашборди', web_app:{url:url+'?p=boss'}}]);
  }
  // Native tezkor ko'rish — har doim mavjud (URL siz ham ishlaydi)
  rows.push([
    {text:'📈 Жами кўрсаткичлар', callback_data:'dashboard'},
    {text:'🏗️ Объектлар', callback_data:'objects'}
  ]);
  rows.push([
    {text:'📜 Шартномалар', callback_data:'shart'},
    {text:'📋 Актлар', callback_data:'akt'}
  ]);
  rows.push([
    {text:'📦 Приход/Расход', callback_data:'prixod'},
    {text:'🤖 AI Ёрдамчи', callback_data:'ai_tab'}
  ]);
  if(!hasUrl){
    rows.push([{text:'⚙️ URL sozlanmagan — tgDiag() ishga tushiring', callback_data:'menu'}]);
  }
  return {inline_keyboard:rows};
}
function _tgMainMenu(chatId, role){
  var txt='🏗️ <b>QURILISH SMETA</b>\n\n'
    +'Хуш келибсиз! Қуйидаги имкониятлардан фойдаланинг:\n\n'
    +'• <b>Бошқарув панели</b> — тўлиқ тизим (Telegram ичида)\n'
    +'• <b>Раҳбар дашборди</b> — диаграмма ва ҳисоботлар\n'
    +'• <b>Тезкор кўриш</b> — шу ерда, чатда\n\n'
    +'Рол: <b>'+(role==='admin'?'Админ':'Кузатувчи')+'</b>';
  _tgSend(chatId, txt, _tgMenuKeyboard(role));
}
function _tgMainMenuEdit(chatId, msgId, role){
  var txt='🏗️ <b>QURILISH SMETA</b>\n\nАсосий меню. Танланг:';
  _tgEdit(chatId, msgId, txt, _tgMenuKeyboard(role));
}

/* ============ JAMI DASHBOARD (native) ============ */
function _tgDashboardText(){
  var d;
  try{ d=apiBossData(); }catch(e){ return '❌ Маълумот олишда хато: '+(e.message||e); }
  if(!d||!d.jami||!d.objects.length) return '📊 Маълумот йўқ. Аввал объектларни ишланг.';
  var j=d.jami;
  var t='📊 <b>УМУМИЙ КЎРСАТКИЧЛАР</b>\n';
  t+='<i>'+(d.sana||'')+'</i>\n\n';
  t+='💰 Смета: <b>'+_tgMln(j.smeta)+'</b>\n';
  t+='✅ Факт: <b>'+_tgMln(j.fakt)+'</b> ('+j.progress+'%)\n';
  t+='📤 Ф-2: <b>'+_tgMln(j.f2)+'</b> ('+j.f2pct+'%)\n';
  t+='⏳ Қолган: <b>'+_tgMln(j.smeta-j.fakt)+'</b>\n\n';
  t+='<b>Категория бўйича:</b>\n';
  t+='• ЧЕЛ: '+_tgMln(j.chel)+'\n';
  t+='• МАШ: '+_tgMln(j.mash)+'\n';
  t+='• МАТ: '+_tgMln(j.mat)+'\n';
  t+='• ОБ: '+_tgMln(j.ob)+'\n';
  t+='\n🏗️ Объектлар сони: <b>'+d.objects.length+'</b>';
  return t;
}
function _tgDashboard(chatId){
  _tgSend(chatId, _tgDashboardText(), {inline_keyboard:[
    [{text:'🏗️ Объектлар', callback_data:'objects'}],
    [{text:'« Меню', callback_data:'menu'}]
  ]});
}
/* ============ ШАРТНОМАЛАР (native) ============ */
function _tgShartText(){
  var d;
  try{ d=apiShartnomaDashboard(); }catch(e){ return '❌ Хато: '+(e.message||e); }
  var list=(d&&d.shartnomalar)||[];
  if(!list.length) return '📜 Шартнома йўқ. Панел → 📜 Шартнома табидан қўшинг.';
  var t='📜 <b>ШАРТНОМАЛАР</b>\n\n';
  for(var i=0;i<list.length;i++){
    var S=list[i], meta=S.meta||{}, nk=S.nakrutka||{};
    t+=(S.no==='—'?'⚠ <b>Бириктирилмаган</b>':'📜 <b>'+S.no+'</b>'+(meta.nomi?' — '+meta.nomi:''))+'\n';
    t+='  Смета(прямые): '+_tgMln(S.smeta+S.qoshSmeta)
      +' | ВСЕГО: '+_tgMln((nk.vsego||0)+S.qoshSmeta)+'\n';
    t+='  Факт: '+_tgMln(S.jamiFakt)+' | Ф2: '+_tgMln(S.jamiF2)+'\n';
    t+='  Объект: '+S.obyektlar.length+' та'
      +(S.qoshlar.length?(' | Қўшимча иш: '+S.qoshlar.length+' та'):'')+'\n\n';
  }
  return t;
}
function _tgShartEdit(chatId, msgId){
  _tgEdit(chatId, msgId, _tgShartText(), {inline_keyboard:[
    [{text:'📈 Жами', callback_data:'dashboard'},{text:'« Меню', callback_data:'menu'}]
  ]});
}

function _tgDashboardEdit(chatId, msgId){
  _tgEdit(chatId, msgId, _tgDashboardText(), {inline_keyboard:[
    [{text:'🏗️ Объектлар', callback_data:'objects'}],
    [{text:'« Меню', callback_data:'menu'}]
  ]});
}

/* ============ OB'EKTLAR RO'YXATI ============ */
function _tgObjectsKeyboard(){
  var d;
  try{ d=apiBossData(); }catch(e){ return {inline_keyboard:[[{text:'« Меню',callback_data:'menu'}]]}; }
  var rows=[];
  (d.objects||[]).forEach(function(o){
    rows.push([{text:o.nom+' — '+o.progress+'%', callback_data:'ob:'+o.nom}]);
  });
  rows.push([{text:'📈 Жами', callback_data:'dashboard'},{text:'« Меню', callback_data:'menu'}]);
  return {inline_keyboard:rows};
}
function _tgObjectsList(chatId){
  _tgSend(chatId, '🏗️ <b>Объектлар</b>\n\nБатафсил кўриш учун танланг:', _tgObjectsKeyboard());
}
function _tgObjectsListEdit(chatId, msgId){
  _tgEdit(chatId, msgId, '🏗️ <b>Объектлар</b>\n\nБатафсил кўриш учун танланг:', _tgObjectsKeyboard());
}

/* ============ BITTA OB'EKT DETAIL ============ */
function _tgObjectDetail(chatId, msgId, nom){
  var t;
  try{
    var d=apiBossObyekt(nom);
    var tt=d.total, cats=d.cats, ck=d.catKeys;
    t='🏗️ <b>'+nom+'</b>'+(d.locked?' 🔒':'')+'\n\n';
    t+='💰 Смета: <b>'+_tgMln(tt.res)+'</b>\n';
    t+='✅ Факт: <b>'+_tgMln(tt.fakt)+'</b> ('+tt.progress+'%)\n';
    t+='📤 Ф-2: <b>'+_tgMln(tt.f2)+'</b> ('+tt.f2pct+'%)\n';
    t+='⏳ Қолган: <b>'+_tgMln(tt.ost)+'</b>\n\n';
    t+='<b>Категория:</b>\n';
    ck.forEach(function(k){
      if(cats[k]&&cats[k].res>0){
        var p=tt.res>0?Math.round(cats[k].res/tt.res*100):0;
        t+='• '+k+': '+_tgMln(cats[k].res)+' ('+p+'%)\n';
      }
    });
    if(d.rzList&&d.rzList.length){
      t+='\n<b>Разделлар ('+d.rzList.length+'):</b>\n';
      d.rzList.slice(0,8).forEach(function(rz){
        t+='• '+_tgEsc(rz.nom)+' — '+rz.progress+'%\n';
      });
      if(d.rzList.length>8) t+='... ва яна '+(d.rzList.length-8)+' та\n';
    }
  }catch(e){ t='❌ Хато: '+(e.message||e); }
  _tgEdit(chatId, msgId, t, {inline_keyboard:[
    [{text:'« Объектлар', callback_data:'objects'},{text:'« Меню', callback_data:'menu'}]
  ]});
}

/* ============ ⚡ FON-NAVBAT (webhook bloklanmasin) — AI javob + Sklad ============
 * doPost darrov ok qaytaradi; og'ir ish (AI javob / sklad ovoz-tahlil) alohida
 * trigger-ijroda (6 daqiqa) bajariladi. Navbat Script Property (TG_FON_Q) da. */
function _tgSlimMsg(msg){
  // Trigger'ga uzatish uchun msg'ning FAQAT kerakli qismini olamiz (JSON kичик bo'lsin).
  return {
    text: String(msg.text||''), caption: String(msg.caption||''),
    voice: msg.voice ? {file_id:msg.voice.file_id, mime_type:msg.voice.mime_type||''} : null,
    audio: msg.audio ? {file_id:msg.audio.file_id, mime_type:msg.audio.mime_type||''} : null
  };
}
function _tgFonQosh(item){
  var lock=LockService.getScriptLock();
  try{ lock.waitLock(5000); }catch(e){}
  try{
    var sp=PropertiesService.getScriptProperties();
    var q=[]; try{ q=JSON.parse(sp.getProperty('TG_FON_Q')||'[]'); }catch(e){}
    item.ts=Date.now();
    q.push(item);
    if(q.length>30) q=q.slice(q.length-30);           // himoya
    sp.setProperty('TG_FON_Q', JSON.stringify(q));
  } finally { try{ lock.releaseLock(); }catch(e){} }
  // Trigger allaqachon bo'lsa yangi yaratmaymiz (kvota tejash)
  var bor=false, trs=ScriptApp.getProjectTriggers();
  for(var i=0;i<trs.length;i++) if(trs[i].getHandlerFunction()==='_tgFonQadam'){ bor=true; break; }
  if(!bor){ try{ ScriptApp.newTrigger('_tgFonQadam').timeBased().after(1000).create(); }catch(e){ Logger.log('_tgFonQosh trigger: '+e); } }
}
function _tgFonQadam(){
  try{ ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='_tgFonQadam') ScriptApp.deleteTrigger(t); }); }catch(e){}
  var sp=PropertiesService.getScriptProperties();
  var take=[];
  var lock=LockService.getScriptLock();
  try{ lock.waitLock(5000); }catch(e){}
  try{
    var q=[]; try{ q=JSON.parse(sp.getProperty('TG_FON_Q')||'[]'); }catch(e){}
    take=q;
    sp.deleteProperty('TG_FON_Q');
  } finally { try{ lock.releaseLock(); }catch(e){} }
  for(var i=0;i<take.length;i++){
    var it=take[i];
    try{
      if(it.kind==='sklad'){ if(typeof apiSkladTelegramQabul==='function') apiSkladTelegramQabul(it.msg||{}, it.chatId); }
      else { if(typeof tgAiJavob==='function') tgAiJavob(it.chatId, it.text); }
    }catch(e){ try{ _tgSend(it.chatId, '❌ '+(e.message||e)); }catch(_){} }
  }
}

/* ============ FORMAT ============ */
function _tgMln(n){
  n=Math.round(n||0);
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+' млрд';
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+' млн';
  if(Math.abs(n)>=1e3) return Math.round(n/1e3)+' минг';
  return String(n);
}
function _tgEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
