/******************************************************************
 * 1b_TitanChat_AI.js — VIBORKA uchun Gemini SAVOL-JAVOB (chat)
 * ==================================================================
 * 1_CoreTitan_AI.js deterministik dvigatel (normalizatsiya/deficit)
 * edi — LLM yo'q edi. Bu fayl Viborka'ga HAQIQIY AI qo'shadi:
 * material ta'minoti bo'yicha tabiiy tilda savol-javob.
 *
 * Misollar:
 *   • "Qaysi materiallar yetishmayapti?" / "Eng katta deficit nima?"
 *   • "Sement qancha kerak edi, qancha keldi?"
 *   • "Armatura qancha narxdan kelgan?" / "M200 beton holati qanday?"
 *
 * Manba: 'Nazorat' sahifasi (Материал·Бирлик·План·Қабул·Нарх·Сумма·
 *        Қолдиқ·%·Ҳолат·Замена). Savolga mos qatorlar filtrlanadi ->
 *        Gemini'ga beriladi -> aniq raqamli o'zbekcha javob.
 *
 * MODEL — Smeta bilan bir xil yagona barqaror const:
 *        GEMINI_MODEL = 'gemini-2.5-flash'
 *
 * Kirish:
 *   vibAiSavol(text)  -> {text} | {error}   (sidebar/menyu chaqiradi)
 *   vibAiPanel()      -> chat sidebar ochadi
 * API kalit: Property 'GEMINI_API_KEY' (sidebar yoki vibAiSetKey()).
 ******************************************************************/

var GEMINI_MODEL = 'gemini-2.5-flash';   // butun tizimda yagona barqaror model
var VIB_AI_TEMP  = 0.25;

/* --- API KALIT --- */
function _vibAiKey(){
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')
      || PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY') || '';
}
function vibAiSetKey(key){
  var k=String(key||'').trim();
  if(k.length<15) return {success:false, error:"Noto'g'ri kalit"};
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', k);
  return {success:true, message:"Gemini API kaliti saqlandi!"};
}

/* --- GEMINI CHAQIRUV (retry + quota muloyim) --- */
function _vibAiGen(systemPrompt, userText, opts){
  opts = opts || {};
  var key = _vibAiKey();
  if(!key) throw new Error("Gemini API kaliti yo'q. Sozlamalardan kiriting.");
  var url='https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_MODEL+':generateContent?key='+key;
  var payload={
    contents:[{role:'user',parts:[{text:userText}]}],
    generationConfig:{ temperature:(opts.temp!=null?opts.temp:VIB_AI_TEMP), maxOutputTokens:opts.maxTok||1500 }
  };
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

var _VIB_AI_SYS =
  'Sen — "Navoiy" qurilish loyihasi material TA\'MINOTI (viborka/zayavka) bo\'yicha aniq javob beruvchi yordamchisan.\n'+
  'Senga foydalanuvchi savoli va NAZORAT jadvalidan (План=kerak, Қабул=kelgan, Қолдиқ=deficit, Нарх, Ҳолат) qatorlar beriladi.\n'+
  'QOIDALAR:\n'+
  '1. Faqat berilgan raqamlarga tayan — son o\'YLAB CHIQARMA. Yo\'q bo\'lsa: "Nazoratda bu material topilmadi" deb ayt.\n'+
  '2. Faqat o\'zbek tilida (material nomi ruscha qolishi mumkin).\n'+
  '3. "qancha kerak" -> План; "qancha keldi" -> Қабул; "deficit/yetishmayapti" -> Қолдиқ; "narx" -> Нарх.\n'+
  '4. Avval qisqa aniq javob (raqam), keyin kerak bo\'lsa ro\'yxat. Pul: mln/mlrd so\'m.\n'+
  '5. Deficit (Қолдиқ>0) materiallarni alohida ajrat — bular zudlik bilan buyurtma kerak.\n'+
  '6. Markdown: **qalin** raqamga, - ro\'yxat. Qisqa (250 so\'z).';

/* ==============================================================
 * ASOSIY: Viborka savol-javob
 * ============================================================== */
function vibAiSavol(text, history){
  try{
    text=String(text||'').trim();
    if(!text) return {error:"Savol bo'sh"};
    if(/^setkey:/i.test(text)){
      var r=vibAiSetKey(text.replace(/^setkey:\s*/i,''));
      return r.success ? {text:'OK Gemini kaliti saqlandi!'} : {error:r.error};
    }
    if(!_vibAiKey()) return {text:'Gemini API kaliti kerak. Yozing: setkey:KALIT (aistudio.google.com)'};

    var terms=_vibAiTerms(text);
    var ev=_vibAiNazorat(terms);
    if(ev.count===0 && terms.length)
      return {text:'"'+terms.join(', ')+'" bo\'yicha Nazorat jadvalida material topilmadi. Boshqacha nom bilan urinib ko\'ring.'};

    var prompt='SAVOL: '+text+'\n\nNAZORAT MA\'LUMOTI ('+ev.count+' qator):\n'+ev.text+
      '\n\nJAMI: kerak(План) '+_vibPul(ev.totP)+', kelgan(Қабул) '+_vibPul(ev.totQ)+', deficit summa '+_vibPul(ev.totD)+'.\n\n'+
      'Shu aniq raqamlarga tayanib javob ber.';
    var ans=_vibAiGen(_VIB_AI_SYS, prompt, {temp:VIB_AI_TEMP, maxTok:1400});
    return {text:ans, topildi:ev.count};
  }catch(e){ return {error:String(e.message||e)}; }
}

/* --- Qidiruv so'zlari --- */
function _vibAiTerms(text){
  var t=String(text||'');
  var STOP={};
  ('qancha necha kerak keldi kelgan qoldi qoldiq deficit defitsit yetishmayapti yetishmas narx narxdan '+
   'narxi holat material qaysi eng katta bormi nima менга ayt qancha?').split(/\s+/).forEach(function(w){STOP[w]=1;});
  var terms=[], seen={};
  var marks=t.match(/([мm]\s?\d{2,3}|ø\s?\d{1,2}|ф\s?\d{1,2}|b\s?\d{2}|\d{2,3}\s?[хx]\s?\d{2,3})/ig)||[];
  marks.forEach(function(m){var s=m.replace(/\s+/g,'').toLowerCase(); if(!seen[s]){seen[s]=1;terms.push(s);}});
  t.split(/[^a-zA-Zа-яА-ЯёЁ]+/).forEach(function(w){
    var lw=w.toLowerCase(); if(lw.length>=4 && !STOP[lw] && !seen[lw]){seen[lw]=1;terms.push(lw);}
  });
  return terms.slice(0,6);
}

/* --- Lotin<->Kirill variantlari (qidiruv kengaytirish) --- */
function _vibAiVar(term){
  var L2C={a:'а',b:'б',v:'в',g:'г',d:'д',e:'е',z:'з',i:'и',k:'к',l:'л',m:'м',n:'н',
           o:'о',p:'р',r:'р',s:'с',t:'т',u:'у',f:'ф',h:'х',c:'с',y:'й'};
  var C2L={}; for(var k in L2C){ if(!C2L[L2C[k]]) C2L[L2C[k]]=k; }
  function mp(s,tb){return s.split('').map(function(ch){var l=ch.toLowerCase();return tb[l]!==undefined?tb[l]:ch;}).join('');}
  var out=[term.toLowerCase()], seen={}; seen[term.toLowerCase()]=1;
  [mp(term,L2C),mp(term,C2L)].forEach(function(v){v=v.toLowerCase(); if(v&&!seen[v]){seen[v]=1;out.push(v);}});
  return out;
}

/* --- 'Nazorat' jadvalidan mos qatorlarni o'qish --- */
function _vibAiNazorat(terms){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('Nazorat');
  if(!sh || sh.getLastRow()<2) return {text:'(Nazorat jadvali bo\'sh)', count:0, totP:0,totQ:0,totD:0};
  var n=sh.getLastRow()-1;
  var v=sh.getRange(2,1,n,14).getValues();
  var disp=sh.getRange(2,1,n,14).getDisplayValues();

  // qidiruv shablonlari (lotin/kirill)
  var pats=[]; terms.forEach(function(t){ _vibAiVar(t).forEach(function(p){pats.push(p);}); });

  var L=[], cnt=0, totP=0,totQ=0,totD=0, MAX=55;
  // deficit bo'yicha saralash uchun avval yig'amiz
  var rows=[];
  for(var i=0;i<n;i++){
    var nom=String(v[i][1]||'').trim(); if(!nom) continue;
    var low=nom.toLowerCase();
    var mos = !pats.length ? true : pats.some(function(p){return p && low.indexOf(p)>=0;});
    if(!mos) continue;
    rows.push({
      nom:nom, bir:String(v[i][2]||''),
      plan:_vibNumSafe(v[i][3]), qabul:_vibNumSafe(v[i][4]),
      narx:_vibNumSafe(v[i][5]), summa:_vibNumSafe(v[i][6]),
      qoldiq:_vibNumSafe(v[i][7]), foiz:String(disp[i][8]||''),
      holat:String(v[i][12]||''), zamena:String(v[i][13]||'')
    });
  }
  // deficit (qoldiq) kattaligi bo'yicha — eng muhimi tepada
  rows.sort(function(a,b){ return (b.qoldiq*b.narx)-(a.qoldiq*a.narx); });
  rows.slice(0,MAX).forEach(function(r){
    cnt++; totP+=r.plan; totQ+=r.qabul; totD+=Math.max(0,r.qoldiq)*r.narx;
    L.push('- '+(r.nom.length>60?r.nom.slice(0,60)+'…':r.nom)+' ('+r.bir+'): kerak '+_vibN(r.plan)+
      ' | kelgan '+_vibN(r.qabul)+' | deficit '+_vibN(r.qoldiq)+
      (r.narx?(' | narx '+_vibN(r.narx)+' so\'m'):'')+
      (r.foiz?(' | '+r.foiz):'')+(r.holat?(' | '+r.holat):'')+(r.zamena?(' | замена: '+r.zamena):''));
  });
  return {text:(L.length?L.join('\n'):'(mos qator yo\'q)'), count:cnt, totP:totP,totQ:totQ,totD:totD};
}

function _vibNumSafe(v){ if(typeof v==='number') return v; var x=parseFloat(String(v==null?'':v).replace(/[^0-9.\-]/g,'')); return isNaN(x)?0:x; }
function _vibN(n){ n=_vibNumSafe(n); return (Math.round(n*100)/100).toLocaleString(); }
function _vibPul(n){ n=_vibNumSafe(n); if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+' mlrd'; if(Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+' mln'; return Math.round(n).toLocaleString()+' so\'m'; }

/* ==============================================================
 * SIDEBAR CHAT (menyudan ochiladi)
 * ============================================================== */
function vibAiPanel(){
  var html = HtmlService.createHtmlOutput(_VIB_AI_HTML())
    .setTitle('🤖 Titan AI — Material yordamchi').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function _VIB_AI_HTML(){
  return ''+
  '<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8">'+
  '<style>'+
  'body{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:0;font-size:13px;color:#1a2233}'+
  '#log{padding:10px;height:calc(100vh - 110px);overflow-y:auto}'+
  '.m{margin:6px 0;padding:8px 10px;border-radius:10px;white-space:pre-wrap;line-height:1.4}'+
  '.u{background:#e3f0ff;text-align:right}.a{background:#f1f4f8}.e{background:#ffe6e6;color:#a30000}'+
  '#bar{position:fixed;bottom:0;left:0;right:0;background:#fff;border-top:1px solid #dde;padding:8px;display:flex;gap:6px}'+
  '#q{flex:1;padding:8px;border:1px solid #ccd;border-radius:8px;font-size:13px}'+
  'button{padding:8px 12px;border:0;border-radius:8px;background:#1565c0;color:#fff;cursor:pointer}'+
  'button:disabled{background:#9bb}'+
  '.hint{color:#789;font-size:11px;padding:8px 10px}'+
  'b{color:#0d47a1}'+
  '</style></head><body>'+
  '<div id="log"><div class="hint">Material ta\'minoti bo\'yicha savol bering. Masalan:<br>'+
  '• "Qaysi material yetishmayapti?"<br>• "Sement qancha kerak, qancha keldi?"<br>'+
  '• "Armatura qancha narxdan kelgan?"<br><br>Kalit yo\'q bo\'lsa: <i>setkey:KALIT</i></div></div>'+
  '<div id="bar"><input id="q" placeholder="Savol yozing..." onkeydown="if(event.key===\'Enter\')send()">'+
  '<button id="b" onclick="send()">Yubor</button></div>'+
  '<script>'+
  'function add(t,c){var d=document.createElement("div");d.className="m "+c;'+
  't=t.replace(/\\*\\*(.+?)\\*\\*/g,"<b>$1</b>");d.innerHTML=t;'+
  'document.getElementById("log").appendChild(d);d.scrollIntoView();}'+
  'function send(){var i=document.getElementById("q");var t=i.value.trim();if(!t)return;'+
  'add(t,"u");i.value="";var b=document.getElementById("b");b.disabled=true;b.textContent="...";'+
  'google.script.run.withSuccessHandler(function(r){b.disabled=false;b.textContent="Yubor";'+
  'if(r&&r.error)add(r.error,"e");else add((r&&r.text)||"(bo\'sh)","a");})'+
  '.withFailureHandler(function(e){b.disabled=false;b.textContent="Yubor";add(String(e),"e");})'+
  '.vibAiSavol(t);}'+
  '</script></body></html>';
}

/* Test: Apps Script editor -> Run */
function vibAiTest(){ Logger.log(JSON.stringify(vibAiSavol("Qaysi materiallar yetishmayapti?"),null,2)); }
