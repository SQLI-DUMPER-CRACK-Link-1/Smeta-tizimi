/******************************************************************
 * GeminiAssistant.js — AKT GENERATOR uchun umumiy AI savol-javob
 * ==================================================================
 * TitanAI.js akt YARATADI (matn/rasm -> AOSR). Bu fayl esa REYESTR
 * bo'yicha SAVOL-JAVOB qo'shadi — "umumiy holat" so'rovlari uchun:
 *   • "Nechta akt yaratilgan?" / "Suniy ko'l uchun nechta akt bor?"
 *   • "Qaysi aktlar hali yuborilmagan?" / "Statuslar bo'yicha holat?"
 *   • "Karkas bo'yicha qanday aktlar bor?"
 *
 * MODEL — butun tizimda yagona barqaror const (Smeta/Viborka bilan bir xil):
 *        GEMINI_MODEL = 'gemini-2.5-flash'
 *   Eslatma: TitanAI.js dagi qattiq yozilgan "gemini-2.5-flash" ni ham
 *   shu GEMINI_MODEL const'ga o'tkazish tavsiya etiladi (1 qator) —
 *   AI_INTEGRATSIYA_GEMINI.md ga qarang.
 *
 * Kirish:
 *   aktAiAsk(text)  -> {text}|{error}
 *   aktAiPanel()    -> chat sidebar
 ******************************************************************/

var GEMINI_MODEL = 'gemini-2.5-flash';   // yagona barqaror model
var AKT_AI_TEMP  = 0.25;

function _aktAiKey(){
  return PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')
      || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
}
function aktAiSetKey(key){
  var k=String(key||'').trim();
  if(k.length<15) return {success:false, error:"Noto'g'ri kalit"};
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', k);
  return {success:true, message:"Gemini API kaliti saqlandi!"};
}

function _aktAiGen(systemPrompt, userText, opts){
  opts = opts || {};
  var key=_aktAiKey();
  if(!key) throw new Error("Gemini API kaliti yo'q. Sozlamalardan kiriting.");
  var url='https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent?key='+key;
  var payload={ contents:[{role:'user',parts:[{text:userText}]}],
    generationConfig:{ temperature:(opts.temp!=null?opts.temp:AKT_AI_TEMP), maxOutputTokens:opts.maxTok||1400 } };
  if(systemPrompt) payload.system_instruction={parts:[{text:systemPrompt}]};
  var json=null;
  for(var i=0;i<3;i++){
    var resp=UrlFetchApp.fetch(url,{method:'post',contentType:'application/json',
      payload:JSON.stringify(payload),muteHttpExceptions:true});
    var code=resp.getResponseCode();
    try{json=JSON.parse(resp.getContentText());}catch(e){json=null;}
    if(code===200 && json && json.candidates && json.candidates.length)
      return json.candidates[0].content.parts[0].text.trim();
    var em=(json&&json.error&&json.error.message)?json.error.message:('HTTP '+code);
    if((code===503||code===429||/high demand|unavailable|overloaded|quota/i.test(em)) && i<2){
      Utilities.sleep(1500*(i+1)); continue;
    }
    throw new Error('Gemini ('+code+'): '+em);
  }
  return "(AI bo'sh javob qaytardi)";
}

var _AKT_AI_SYS =
  'Sen — qurilish AKTLAR (AOSR, yashirin ishlar) REYESTRi bo\'yicha aniq javob beruvchi yordamchisan.\n'+
  'Senga foydalanuvchi savoli va REYESTR statistikasi (jami akt, obyektlar bo\'yicha, status/yuborilish holati) + mos aktlar ro\'yxati beriladi.\n'+
  'QOIDALAR:\n'+
  '1. Faqat berilgan ma\'lumotga tayan — son o\'ylab chiqarma. Yo\'q bo\'lsa shuni ayt.\n'+
  '2. Faqat o\'zbek tilida (ish/obyekt nomlari ruscha qolishi mumkin).\n'+
  '3. Avval qisqa aniq javob (raqam), keyin kerak bo\'lsa ro\'yxat.\n'+
  '4. "yuborilmagan"/"не отправлено" aktlarni alohida ajrat (e\'tibor kerak).\n'+
  '5. Markdown: **qalin** raqamga, - ro\'yxat. Qisqa (250 so\'z).';

/* ==============================================================
 * ASOSIY: REYESTR bo'yicha savol-javob
 * ============================================================== */
function aktAiAsk(text){
  try{
    text=String(text||'').trim();
    if(!text) return {error:"Savol bo'sh"};
    if(/^setkey:/i.test(text)){
      var r=aktAiSetKey(text.replace(/^setkey:\s*/i,''));
      return r.success ? {text:'OK Gemini kaliti saqlandi!'} : {error:r.error};
    }
    if(!_aktAiKey()) return {text:'Gemini API kaliti kerak. Yozing: setkey:KALIT (aistudio.google.com)'};

    var ctx=_aktAiReyestr(text);
    if(ctx.total===0) return {text:'REYESTR jadvali bo\'sh yoki topilmadi.'};

    var prompt='SAVOL: '+text+'\n\n'+ctx.text+'\n\nShu ma\'lumotga tayanib javob ber.';
    var ans=_aktAiGen(_AKT_AI_SYS, prompt, {temp:AKT_AI_TEMP, maxTok:1300});
    return {text:ans, total:ctx.total};
  }catch(e){ return {error:String(e.message||e)}; }
}

/* --- REYESTR statistikasi + mos aktlar --- */
function _aktAiReyestr(savol){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var shName=(typeof CONFIG!=='undefined' && CONFIG.REYESTR_SHEET) ? CONFIG.REYESTR_SHEET : 'REYESTR';
  var sh=ss.getSheetByName(shName);
  if(!sh || sh.getLastRow()<2) return {total:0, text:''};
  var headers=(typeof headerMap_==='function') ? headerMap_(sh) : _aktHdr(sh);
  var hn=Object.keys(headers);

  function col(keyGuesses){
    for(var i=0;i<keyGuesses.length;i++){ if(headers[keyGuesses[i]]) return headers[keyGuesses[i]]; }
    return 0;
  }
  var cObj  = col([(typeof REY!=='undefined'&&REY.OBJECT_NAME)||'OBJECT_NAME','OBJECT_NAME','Объект']);
  var cWork = col([(typeof REY!=='undefined'&&REY.WORK_NAME)||'WORK_NAME','WORK_NAME','Наименование работ']);
  var cNum  = col([(typeof REY!=='undefined'&&REY.ACT_NUMBER)||'ACT_NUMBER','ACT_NUMBER']);
  var cStat = col([(typeof REY!=='undefined'&&REY.STATUS)||'STATUS','STATUS']);
  var cComm = col([(typeof REY!=='undefined'&&REY.COMM_STATUS)||'COMM_STATUS','COMM_STATUS']);

  var last=sh.getLastRow();
  var v=sh.getRange(2,1,last-1,sh.getLastColumn()).getDisplayValues();
  var total=0, byObj={}, byStat={}, byComm={};
  var terms=savol.toLowerCase().split(/[^a-zA-Zа-яА-ЯёЁ0-9]+/).filter(function(w){return w.length>=4;});
  var matches=[];

  v.forEach(function(row){
    var work=cWork?String(row[cWork-1]||'').trim():'';
    var obj =cObj ?String(row[cObj-1]||'').trim():'';
    if(!work && !obj) return;
    total++;
    if(obj) byObj[obj]=(byObj[obj]||0)+1;
    if(cStat){ var s=String(row[cStat-1]||'').trim()||'(bo\'sh)'; byStat[s]=(byStat[s]||0)+1; }
    if(cComm){ var c=String(row[cComm-1]||'').trim()||'(bo\'sh)'; byComm[c]=(byComm[c]||0)+1; }
    // savolga mos aktlar (work/obj matnida term bormi)
    var hay=(work+' '+obj).toLowerCase();
    if(terms.length && terms.some(function(t){return hay.indexOf(t)>=0;}) && matches.length<30){
      matches.push((cNum?('#'+row[cNum-1]+' '):'')+(obj?('['+obj+'] '):'')+work+
        (cComm?(' — '+String(row[cComm-1]||'')):''));
    }
  });

  var L=[];
  L.push('REYESTR JAMI: '+total+' ta akt.');
  L.push('\nObyektlar bo\'yicha:');
  Object.keys(byObj).sort(function(a,b){return byObj[b]-byObj[a];}).slice(0,20)
    .forEach(function(o){ L.push('- '+o+': '+byObj[o]); });
  if(Object.keys(byStat).length){ L.push('\nStatus bo\'yicha:');
    Object.keys(byStat).forEach(function(s){ L.push('- '+s+': '+byStat[s]); }); }
  if(Object.keys(byComm).length){ L.push('\nYuborilish (komissiya) holati:');
    Object.keys(byComm).forEach(function(c){ L.push('- '+c+': '+byComm[c]); }); }
  if(matches.length){ L.push('\nSavolga mos aktlar (top '+matches.length+'):');
    matches.forEach(function(m){ L.push('- '+m); }); }

  return {total:total, text:L.join('\n')};
}

function _aktHdr(sh){
  var h={}; sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].forEach(function(x,i){ if(x) h[String(x).trim()]=i+1; });
  return h;
}

/* ==============================================================
 * SIDEBAR CHAT
 * ============================================================== */
function aktAiPanel(){
  var html=HtmlService.createHtmlOutput(_AKT_AI_HTML())
    .setTitle('🤖 Akt AI — Reyestr yordamchi').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}
function _AKT_AI_HTML(){
  return ''+
  '<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8"><style>'+
  'body{font-family:Segoe UI,Arial,sans-serif;margin:0;font-size:13px;color:#1a2233}'+
  '#log{padding:10px;height:calc(100vh - 110px);overflow-y:auto}'+
  '.m{margin:6px 0;padding:8px 10px;border-radius:10px;white-space:pre-wrap;line-height:1.4}'+
  '.u{background:#e3f0ff;text-align:right}.a{background:#f1f4f8}.e{background:#ffe6e6;color:#a30000}'+
  '#bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #dde;padding:8px;display:flex;gap:6px}'+
  '#q{flex:1;padding:8px;border:1px solid #ccd;border-radius:8px;font-size:13px}'+
  'button{padding:8px 12px;border:0;border-radius:8px;background:#1565c0;color:#fff;cursor:pointer}'+
  '.hint{color:#789;font-size:11px;padding:8px 10px} b{color:#0d47a1}</style></head><body>'+
  '<div id="log"><div class="hint">REYESTR bo\'yicha savol bering:<br>'+
  '• "Nechta akt bor?"<br>• "Qaysi aktlar yuborilmagan?"<br>• "Suniy ko\'l uchun nechta akt?"<br><br>'+
  'Kalit yo\'q bo\'lsa: <i>setkey:KALIT</i></div></div>'+
  '<div id="bar"><input id="q" placeholder="Savol yozing..." onkeydown="if(event.key===\'Enter\')send()">'+
  '<button id="b" onclick="send()">Yubor</button></div><script>'+
  'function add(t,c){var d=document.createElement("div");d.className="m "+c;'+
  't=t.replace(/\\*\\*(.+?)\\*\\*/g,"<b>$1</b>");d.innerHTML=t;'+
  'document.getElementById("log").appendChild(d);d.scrollIntoView();}'+
  'function send(){var i=document.getElementById("q");var t=i.value.trim();if(!t)return;add(t,"u");i.value="";'+
  'var b=document.getElementById("b");b.disabled=true;b.textContent="...";'+
  'google.script.run.withSuccessHandler(function(r){b.disabled=false;b.textContent="Yubor";'+
  'if(r&&r.error)add(r.error,"e");else add((r&&r.text)||"(bo\'sh)","a");})'+
  '.withFailureHandler(function(e){b.disabled=false;b.textContent="Yubor";add(String(e),"e");}).aktAiAsk(t);}'+
  '</script></body></html>';
}

function aktAiTest(){ Logger.log(JSON.stringify(aktAiAsk("Nechta akt bor va qaysilari yuborilmagan?"),null,2)); }
