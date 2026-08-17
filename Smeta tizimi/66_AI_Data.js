/******************************************************************
 * 66_AI_Data.js — AI DATA QATLAMI (Gemini) — "har narsani so'ra"
 * ==================================================================
 * Maqsad: foydalanuvchi tabiiy tilda aniq savol bersa — tizim aniq
 * raqam bilan javob bersin. Masalan:
 *   • "Suniy ko'lda M200 beton qancha ishlatilgan?"
 *   • "Amfiteatrda armatura qancha narxdan kelgan?"
 *   • "Bu obyektda sement qancha kerak edi, qancha keldi?"
 *
 * Ishlash printsipi (RAG — retrieve then answer, NL->SQL EMAS -> xavfsiz):
 *   1) Savoldan obyekt + material qidiruv so'zlarini ajratadi.
 *   2) Supabase (hub) dan AYNAN shu materialga oid qatorlarni oladi
 *      (holat-material_kerak-prixod-viborka_nazorat-narxlar — ilike).
 *      Supabase sozlanmagan bo'lsa -> lokal apiHolatOl daraxtidan qidiradi.
 *   3) Topilgan ANIQ raqamlarni Gemini'ga beradi -> o'zbekcha javob.
 *      (Raqamni AI o'ylab chiqarmaydi — faqat bazadan kelgan son.)
 *
 * MODEL — BITTA YAGONA BARQAROR CONST (butun tizim shunga tayanadi):
 *      GEMINI_MODEL = 'gemini-2.5-flash'  (GA/barqaror, tez, arzon, vision)
 *      GEMINI_MODEL_PRO = 'gemini-2.5-pro' (og'ir tahlil uchun ixtiyoriy)
 *   Boshqa fayllar (65_TitanAI, 60_Maslahatchi) ham shu const'ga o'tkaziladi
 *   (AI_INTEGRATSIYA_GEMINI.md ga qarang). Modelni almashtirish = 1 qator.
 *
 * Kirish nuqtalari (Panel.html / menyu shularni chaqiradi):
 *   apiTitanData(req)   -> aniq material/resurs data savoli
 *   apiTitanSmart(req)  -> router: data savolmi yoki umumiy tahlilmi
 *
 * API kalit: 00_AI_Gateway.js → apiAiKalitSaqla / apiAiKalitHolat (markaziy).
 * SQL dvigatel: 66b_AI_SqlEngine.js (_aiDalilV2 — to'liq yig'indi, 60 limit yo'q).
 ******************************************************************/

/* --- YAGONA MODEL CONST ---------------------------------------- */
var GEMINI_MODEL     = 'gemini-2.5-flash';   // barqaror, butun tizim standarti
var GEMINI_MODEL_PRO = 'gemini-2.5-pro';     // og'ir tahlil uchun (ixtiyoriy)
var AI_DATA_TEMP     = 0.2;
/* ⚠️ 2026-08-17 (audit): `AI_DETAIL_MAX` shu yerda ham, `66b_AI_SqlEngine.js:17`
   da ham e'lon qilingan edi. GAS da hamma fayl BITTA global doirada — alifbo
   tartibida keyin yuklangan fayl (66b) birinchisini JIM O'CHIRADI.
   Hozir ikkalasi ham 45 bo'lgani uchun xulq farq qilmasdi, lekin biri
   o'zgartirilsa ikkinchisi sababsiz g'olib chiqib, «o'zgartirdim — ta'sir
   qilmadi» degan tuzoq yasardi.
   Yechim: konstanta FAQAT ishlatiladigan joyida (66b_AI_SqlEngine.js) qoldi. */
/* AI_MAX_ROWS — eski; endi _aiDalilV2 to'liq yig'indi ishlatadi */

/* --- GEMINI UMUMIY CHAQIRUV (retry + quota muloyim xabar) ------ */
function _aiGen(systemPrompt, userText, opts){
  opts = opts || {};
  if(typeof aiCall === 'function') {
    return aiCall({
      model: typeof GEMINI_MODEL!=='undefined' ? GEMINI_MODEL : 'gemini-2.5-flash',
      user: userText,
      system: systemPrompt,
      temp: opts.temp != null ? opts.temp : AI_DATA_TEMP,
      maxTok: opts.maxTok || 2048,
      json: opts.json,
      // ⚡ 2026-07-12: faqat CHAQIRUVCHI aniq belgilasa (interaktiv chat) kutish
      // byudjeti qo'llanadi — fon vazifalar (Telegram/kunlik AI) eski xatti-harakatni saqlaydi.
      maxWaitMs: opts.maxWaitMs
    });
  }

  // Eski tizim kodi (faqat aiCall topilmasa):
  var k = _aiKey(); if(!k) throw new Error("Gemini API kaliti yo'q");
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
            (typeof GEMINI_MODEL!=='undefined' ? GEMINI_MODEL : 'gemini-2.5-flash') +
            ':generateContent?key=' + k;
  var payload = {
    contents: [{ role:'user', parts:[{ text:userText }] }],
    generationConfig: {
      temperature: (opts.temp!=null ? opts.temp : AI_DATA_TEMP),
      maxOutputTokens: opts.maxTok || 2048
    }
  };
  if(systemPrompt) payload.system_instruction = { parts:[{ text:systemPrompt }] };
  if(opts.json) payload.generationConfig.responseMimeType = 'application/json';

  var tries = opts.tries || 3, json = null;
  for(var i=0;i<tries;i++){
    var resp = UrlFetchApp.fetch(url, {
      method:'post', contentType:'application/json',
      payload:JSON.stringify(payload), muteHttpExceptions:true
    });
    var code = resp.getResponseCode();
    try{ json = JSON.parse(resp.getContentText()); }catch(e){ json = null; }
    if(code===200 && json && json.candidates && json.candidates.length &&
       json.candidates[0].content && json.candidates[0].content.parts){
      return json.candidates[0].content.parts[0].text.trim();
    }
    var em = (json && json.error && json.error.message) ? json.error.message : ('HTTP '+code);
    // serverlar band / limit — kutib qayta urinish
    if((code===503 || code===429 || /high demand|unavailable|overloaded|quota/i.test(em)) && i<tries-1){
      Utilities.sleep(1500*(i+1));
      continue;
    }
    throw new Error('Gemini ('+code+'): '+em);
  }
  return "(AI bo'sh javob qaytardi)";
}

/* --- TIZIM PROMPTI (data javob qoidalari) --------------------- */
var _AI_DATA_SYS =
  'Sen — "Navoiy Yangi O\'zbekiston bog\'i" qurilish loyihasining ma\'lumotlar bo\'yicha aniq javob beruvchi muhandis yordamchisisan.\n'+
  'Senga foydalanuvchi savoli va BAZADAN SQL orqali hisoblangan YIG\'INDI (JAMI) va guruhlar beriladi.\n'+
  'QAT\'IY QOIDALAR:\n'+
  '1. **JAMI YIG\'INDI** blokidagi raqamlar — 100% aniq (SQL). Avval shu raqamni javob sifatida ayt.\n'+
  '2. Hech qanday sonni O\'YLAB CHIQARMA. "JAMI" da yo\'q bo\'lsa — "bazada topilmadi".\n'+
  '3. Ko\'p qator (100+) bo\'lsa — guruh yig\'indisini ayt, barcha qatorlarni sanab o\'tma.\n'+
  '4. Faqat o\'zbek tilida. Pul: mln/mlrd so\'m; hajm: birlik bilan.\n'+
  '5. "Ishlatilgan"=FAKT, "kerak/reja"=SMETA hajm, "qoldiq"=QOLDIQ.\n'+
  '6. Markdown: **qalin** muhim raqam. Qisqa (300 so\'zgacha).';

/* ==============================================================
 * ASOSIY: aniq material/resurs data savoli
 * req = { obyekt?, text, history? }
 * ============================================================== */
function apiTitanData(req){
  try{
    req = req || {};
    var text = String(req.text||'').trim();
    var obyekt = String(req.obyekt||'').trim();
    if(!text) return { error:"Savol bo'sh" };

    // setkey → markaziy gateway
    if(/^setkey:/i.test(text)){
      if(typeof apiAiKalitFromText==='function'){
        var sk = apiAiKalitFromText(text);
        return { text: sk.xabar || 'Kalit saqlandi', intent:'system' };
      }
      var kr = apiAiKalitSaqla(text.replace(/^setkey:\s*/i,'').trim());
      return { text: kr.xabar, intent:'system' };
    }
    if(typeof _aiKey==='function' && !_aiKey()) return {
      text:'⚙️ **Gemini API kaliti kerak**\n\nPanel → **Созлама** → 🤖 AI kalit\nyoki chatda: `setkey:KALITINGIZ`\n\nKalit: aistudio.google.com → API Keys',
      intent:'setup'
    };

    // 1) Obyekt aniqlash (UI tanlamasa — savol matnidan)
    var objs = _aiObyektlar();
    if(!obyekt) obyekt = _aiTextdaObyekt(text, objs);

    // 2) Material/resurs qidiruv so'zlari
    var terms = _aiTerms(text);

    // 3) Dalil — SQL dvigatel (to'liq yig'indi, 60 limit yo'q)
    var ev = (typeof _aiDalilV2==='function')
      ? _aiDalilV2(obyekt, terms, text)
      : _aiDalil(obyekt, terms);

    // Material savoli emas (umumiy holat) — TitanAI tahliliga yo'naltir
    if(!terms.length && ev.count===0 && typeof apiTitanAi==='function'){
      return apiTitanAi({ obyekt:obyekt, text:text, history:req.history||[], mode:'auto' });
    }

    // 4) Gemini javob
    var prompt =
      'SAVOL: '+text+'\n\n'+
      (obyekt ? ('OBYEKT: '+obyekt+'\n') : '(barcha obyektlar bo\'yicha)\n')+
      'SQL BAZA ('+ev.manba+', '+ev.totalRows+' xom qator, '+ev.count+' guruh):\n'+
      (ev.text || '(mos qator topilmadi)')+'\n\n'+
      'AVVALO **JAMI YIG\'INDI** dagi raqamni javob qilib ayt. Keyin qisqa izoh.';
    // ⚡ 2026-07-12: interaktiv chat — 25s'dan keyin aniq xato (osilib qolmasin)
    var ans = _aiGen(_AI_DATA_SYS, prompt, { temp:AI_DATA_TEMP, maxTok:1800,
      cacheKey: 'data|'+obyekt+'|'+terms.join(',')+'|'+text.slice(0,80), maxWaitMs:25000 });

    return { text:ans, intent:'DATA', obyekt:obyekt, terms:terms, topildi:ev.count,
      totalRows: ev.totalRows||0, jami: ev.jami, manba:ev.manba };
  }catch(e){
    return { error:String(e.message||e) };
  }
}

/* ==============================================================
 * ROUTER: data savolmi yoki umumiy tahlilmi -> mosini chaqiradi
 * Panel.html shu yagona funksiyani chaqirsa — ikkala rejim ishlaydi.
 * ============================================================== */
function apiTitanSmart(req){
  req = req || {};
  var text = String(req.text||'');
  if(/^setkey:/i.test(text)) return apiTitanData(req);
  if(_aiDataSavolmi(text)) return apiTitanData(req);
  if(typeof apiTitanAi==='function') return apiTitanAi(req);
  return apiTitanData(req);
}

/* --- Data savol heuristikasi (aniq raqam so'ralyaptimi?) ------- */
function _aiDataSavolmi(text){
  var t = String(text||'').toLowerCase();
  // marka/o'lcham (M200, М300, O12, B25), yoki miqdor/narx so'rovi
  if(/\b[мm]\s?\d{2,3}\b/i.test(t)) return true;
  if(/ø\d|ф\s?\d{1,2}\b|d\s?=\s?\d/i.test(t)) return true;
  if(/(qancha|necha|qanch|nech)\s+(ishlatil|sarf|kerak|keldi|kelgan|qoldi|qoldiq|narx)/.test(t)) return true;
  if(/(qaysi|eng ko.p|eng kam|taqqos|solishtir)/.test(t)) return true;
  if(/(qancha\s+narx|narxdan|qiymati|qancha\s+pul)/.test(t)) return true;
  if(/(ishlatil|sarflan|kelgan\s+material|qancha\s+keldi|deficit|defitsit|yetishma)/.test(t)) return true;
  return false;
}

/* --- Obyektlar ro'yxati (dashboard yoki Supabase) ------------- */
function _aiObyektlar(){
  try{
    var d = apiBossData();
    return (d.objects||[]).map(function(o){ return String(o.nom||''); }).filter(String);
  }catch(e){
    try{
      var rows = _aiSbGet('obyektlar', 'select=nom');
      return (rows||[]).map(function(r){ return String(r.nom||''); }).filter(String);
    }catch(e2){ return []; }
  }
}

/* --- Savol matnida obyekt nomini topish ----------------------- */
function _aiTextdaObyekt(text, objs){
  if(!objs || !objs.length) return '';
  var t = _aiLower(text);
  var best = '', bestLen = 0;
  objs.forEach(function(nom){
    var n = _aiLower(nom);
    if(!n) return;
    var asos = n.split(/[\s\-]+/)[0];
    if((n.length>=4 && t.indexOf(n)>=0) || (asos.length>=4 && t.indexOf(asos)>=0)){
      if(nom.length>bestLen){ best=nom; bestLen=nom.length; }
    }
  });
  return best;
}

/* --- Qidiruv so'zlari (materiallar/markalar) ------------------ */
function _aiTerms(text){
  var t = String(text||'');
  var stop = {};
  var STOP = ('qancha necha qanch nech ishlatilgan ishlatildi sarflandi kerak keldi kelgan qoldi qoldiq narx narxdan '+
    'narxi qiymati pul bor bormi nima qaysi obyekt obyektda uchun yoki bu shu menga ayt aytib ber '+
    'hisobla jami umumiy holat smeta smetani smetada berilgan organib rganib chiq qarab korib topib bopdi ketgan ketdi qilingan lrv сколько').split(/\s+/);
  STOP.forEach(function(w){ stop[w]=1; });

  try {
    if (typeof _aiObyektlar === 'function') {
      _aiObyektlar().forEach(function(o){
        String(o).split(/[\s\-]+/).forEach(function(p){ stop[_aiLower(p)] = 1; });
      });
    }
  } catch(e){}

  var terms = [], seen = {};
  // 1) marka/o'lcham tokenlari (M200, М300, O12, B25, 100x100) — eng muhim
  var marks = t.match(/([мm]\s?\d{2,3}|ø\s?\d{1,2}|ф\s?\d{1,2}|b\s?\d{2}|\d{2,3}\s?[хx]\s?\d{2,3})/ig) || [];
  marks.forEach(function(m){ var s=m.replace(/\s+/g,''); if(!seen[s.toLowerCase()]){ seen[s.toLowerCase()]=1; terms.push(s); } });

  // 2) so'zlar (uz/ru), >=4 harf, stop-so'z emas
  var words = t.split(/[^a-zA-Zа-яА-ЯёЁʻʼ'`]+/);
  words.forEach(function(w){
    var lw = _aiLower(w);
    if(lw.length>=4 && !stop[lw] && !seen[lw]){ seen[lw]=1; terms.push(w); }
  });
  return terms.slice(0,6);
}

function _aiLower(s){
  return String(s||'').toLowerCase()
    .replace(/[ʻʼ'`]/g,'').replace(/ё/g,'е').trim();
}

/* --- Lotin<->Kirill qidiruv variantlari (M200<->М200, beton<->бетон) - */
function _aiVariants(term){
  var out = [term], seen = {}; seen[term.toLowerCase()]=1;
  var L2C = {a:'а',b:'б',v:'в',g:'г',d:'д',e:'е',z:'з',i:'и',k:'к',l:'л',
             m:'м',n:'н',o:'о',p:'р',r:'р',s:'с',t:'т',u:'у',f:'ф',h:'х',c:'с',y:'й'};
  var C2L = {};
  for(var k in L2C){ if(!C2L[L2C[k]]) C2L[L2C[k]]=k; }
  function map(str, tbl){
    return str.split('').map(function(ch){
      var low=ch.toLowerCase(); return tbl[low]!==undefined ? tbl[low] : ch;
    }).join('');
  }
  var cyr = map(term, L2C), lat = map(term, C2L);
  [cyr, lat].forEach(function(v){ if(v && !seen[v.toLowerCase()]){ seen[v.toLowerCase()]=1; out.push(v); } });
  return out.slice(0,3);
}

/* --- Supabase GET (PostgREST, read-only) ---------------------- */
function _aiSbGet(table, qs){
  var c = (typeof _sbCfg==='function') ? _sbCfg() : null;
  if(!c) return null; // sozlanmagan -> lokalga tushadi
  var resp = UrlFetchApp.fetch(c.url+'/rest/v1/'+table+'?'+qs, {
    headers:{ 'apikey':c.key, 'Authorization':'Bearer '+c.key },
    muteHttpExceptions:true
  });
  if(resp.getResponseCode()>=300) return [];
  try{ return JSON.parse(resp.getContentText()); }catch(e){ return []; }
}

/* --- PostgREST AND(OR(...)) filtri (nom bo'yicha, variantlar bilan) - */
function _aiOrFilter(terms){
  if(!terms || !terms.length) return '';
  var andParts = [];
  terms.forEach(function(term){
    var orParts = [];
    _aiVariants(term).forEach(function(v){
      orParts.push('nom.ilike.*'+encodeURIComponent(v)+'*');
    });
    if(orParts.length) andParts.push('or(' + orParts.join(',') + ')');
  });
  if(andParts.length === 0) return '';
  return 'and=(' + andParts.join(',') + ')';
}

/* --- DALIL — SqlEngine ga yo'naltirish (zaxira yo'q) ------------- */
function _aiDalil(obyekt, terms, text){
  if(typeof _aiDalilV2==='function') return _aiDalilV2(obyekt, terms, text||'');
  return { text:'', count:0, manba:'SqlEngine yuklanmagan (66b_AI_SqlEngine.js)' };
}

function _aiDalilLokal(obyekt, terms){
  if(typeof _aiDalilLokalV2==='function') return _aiDalilLokalV2(obyekt, terms, '', _aiSqlNiyat('', obyekt));
  return { text:'', count:0, manba:'lokal' };
}

/* --- Format yordamchilari ------------------------------------- */
function _aiNum(n){ return Number(String(n).replace(/[^\d.\-]/g,''))||0; }
function _aiN(n){
  n = _aiNum(n);
  if(Math.abs(n)>=1e6) return (Math.round(n/1e3)/1e3).toLocaleString()+'';
  return (Math.round(n*100)/100).toLocaleString();
}
function _aiPul(n){
  n = _aiNum(n);
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+' mlrd';
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+' mln';
  return Math.round(n).toLocaleString()+' so\'m';
}
function _aiNom(s){ s=String(s||''); return s.length>70 ? s.slice(0,70)+'…' : s; }

/* --- TEST (Apps Script editor -> Run) ------------------------- */
function aiDataTest(){
  var r = apiTitanData({ text:"M200 beton qancha ishlatilgan?" });
  Logger.log(JSON.stringify(r, null, 2));
  return r;
}
