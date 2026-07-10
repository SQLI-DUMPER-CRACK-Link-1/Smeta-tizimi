/******************************************************************
 * 73_AI_Vision.js — 📸 FOTO -> AI KO'Z (Gemini vision) — sayt oqimi
 * ==================================================================
 * Sayt muhandisi Telegramga RASM tashlaydi -> Gemini rasmni KO'RADI va:
 *   • qaysi ish bajarilgan (smeta bilan taqqoslab),
 *   • taxminiy bajarilish % (ko'rinishidan),
 *   • bu YASHIRIN ishmi (AOSR akt kerakmi?),
 *   • qanday material ko'rinadi, keyingi qadam —
 * o'zbekcha qisqa hisobot qaytaradi. (Raqamni o'ylab chiqarmaydi —
 * vizual baho "ko'rinishidan" deb belgilanadi.)
 *
 * Gateway orqali ishlaydi (aiFetchRaw) -> API limitga chidamli.
 * Telegram: 40_Telegram.js doPost ga rasm hook (pastdagi ulanish).
 *
 * Kirish:
 *   tgFotoTahlil(fileId, caption, obyekt)  — Telegram rasmni yuklab tahlil
 *   aiFotoTahlilB64(b64, caption, obyekt)  — to'g'ridan base64 rasm tahlili
 *   tgVisionOnPhoto(msg)                   — doPost message.photo hook
 ******************************************************************/

var VISION_MODEL = (typeof GEMINI_MODEL!=='undefined') ? GEMINI_MODEL : 'gemini-2.5-flash';

/* ── Smeta konteksti (rasmni mavjud ishlarga bog'lash uchun) ── */
function _visionSmetaCtx(obyekt){
  if(!obyekt) return '';
  try{
    if(typeof apiAktIshlar==='function'){
      var rows=(apiAktIshlar(obyekt).rows||[]).slice(0,30);
      if(rows.length) return 'Shu obyektdagi bajarilayotgan ishlar (smetadan):\n'+
        rows.map(function(r){return '- '+r.nom+(r.yashirin?' [yashirin]':'')+(r.aktBor?' (akt bor)':' (akt yo\'q)');}).join('\n');
    }
    if(typeof apiBossObyekt==='function'){
      var b=apiBossObyekt(obyekt);
      if(b.rzList&&b.rzList.length) return 'Razdellar: '+b.rzList.slice(0,15).map(function(rz){return rz.nom;}).join(', ');
    }
  }catch(e){}
  return '';
}

function _visionSys(){
  return 'Sen — qurilish saytidagi rasmlarni tahlil qiluvchi tajribali PTO muhandisisan.\n'+
    'Senga qurilish FOTOSI va (bo\'lsa) smetadagi ishlar ro\'yxati beriladi.\n'+
    'VAZIFA — rasmdan ANIQ ko\'ringanini ayt:\n'+
    '1. Qanday ish bajarilgan (iloji bo\'lsa smetadagi ish nomiga moslab).\n'+
    '2. Taxminiy bajarilish % — faqat "ko\'rinishidan ~X%" deб (aniq son emas, vizual baho).\n'+
    '3. Bu YASHIRIN ishmi (armatura/beton/gidroizol/zamin...)? Ha bo\'lsa: "⚠️ AOSR akt kerak".\n'+
    '4. Ko\'rinadigan materiallar.\n'+
    '5. Keyingi mantiqiy qadam.\n'+
    'QOIDA: rasmda ko\'rinmagan narsani O\'YLAB CHIQARMA ("aniq ko\'rinmadi" de). O\'zbekcha, qisqa (180 so\'z), markdown.';
}

/* ── To'g'ridan base64 rasm tahlili ── */
function aiFotoTahlilB64(b64, caption, obyekt){
  if(!b64) return {error:'Rasm yo\'q'};
  var mime='image/jpeg', data=b64;
  var m=String(b64).match(/^data:([^;]+);base64,(.*)$/);
  if(m){ mime=m[1]; data=m[2]; }
  var ctx=_visionSmetaCtx(obyekt);
  var prompt='SAYT FOTOSI tahlili.'+(obyekt?(' Obyekt: '+obyekt+'.'):'')+(caption?(' Izoh: '+caption):'')+
    (ctx?('\n\n'+ctx):'')+'\n\nRasmni tahlil qil.';
  var payload={
    system_instruction:{parts:[{text:_visionSys()}]},
    contents:[{role:'user', parts:[ {text:prompt}, {inline_data:{mime_type:mime, data:data}} ]}],
    generationConfig:{temperature:0.25, maxOutputTokens:900}
  };
  try{
    var r=aiFetchRaw(VISION_MODEL, payload); // Gateway: throttle+backoff+fallback
    return {text:r.text||'(bo\'sh javob)', obyekt:obyekt};
  }catch(e){ return {error:String(e.message||e)}; }
}

/* ── Telegram fayl (file_id) ni yuklab tahlil ── */
function tgFotoTahlil(fileId, caption, obyekt){
  try{
    var token=(typeof _tgToken==='function')?_tgToken():'';
    if(!token) return {error:'Telegram token yo\'q'};
    var gf=JSON.parse(UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/getFile?file_id='+encodeURIComponent(fileId),{muteHttpExceptions:true}).getContentText());
    if(!gf.ok) return {error:'getFile xato'};
    var path=gf.result.file_path;
    var blob=UrlFetchApp.fetch('https://api.telegram.org/file/bot'+token+'/'+path,{muteHttpExceptions:true}).getBlob();
    var mime=blob.getContentType()||'image/jpeg';
    var b64=Utilities.base64Encode(blob.getBytes());
    return aiFotoTahlilB64('data:'+mime+';base64,'+b64, caption, obyekt);
  }catch(e){ return {error:String(e.message||e)}; }
}

/* ── doPost hook: message.photo bo'lsa shuni chaqiring (40_Telegram.js) ──
 * _tgOnMessage ichiga (boshiga) qo'shing:
 *   if(msg.photo && msg.photo.length){ tgVisionOnPhoto(msg); return; }
 */
function tgVisionOnPhoto(msg){
  try{
    var chatId=msg.chat.id;
    var photos=msg.photo||[];
    if(!photos.length){ return; }
    var fileId=photos[photos.length-1].file_id; // eng katta o'lcham
    var caption=String(msg.caption||'').trim();
    // captiondagi obyektni aniqlash (ixtiyoriy)
    var obyekt='';
    try{ if(typeof _aiObyektlar==='function' && typeof _aiTextdaObyekt==='function') obyekt=_aiTextdaObyekt(caption, _aiObyektlar()); }catch(e){}
    if(typeof _tgSend==='function') _tgSend(chatId, '📸 Rasm tahlil qilinmoqda...');
    var r=tgFotoTahlil(fileId, caption, obyekt);
    var out = r.error ? ('❌ '+r.error) : ('📸 <b>Foto tahlili</b>'+(obyekt?(' — '+obyekt):'')+'\n\n'+_visMd(r.text));
    if(typeof _tgSend==='function') _tgSend(chatId, out);
  }catch(e){ try{ if(typeof _tgSend==='function') _tgSend(msg.chat.id, '❌ '+(e.message||e)); }catch(_){} }
}

function _visMd(s){
  s=String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*/gm,'').replace(/^- /gm,'• ');
}

function aiVisionTest(){ Logger.log('Vision model: '+VISION_MODEL+' — rasm bilan aiFotoTahlilB64(b64) ni sinab ko\'ring.'); }
