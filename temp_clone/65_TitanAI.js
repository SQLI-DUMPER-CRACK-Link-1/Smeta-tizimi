/*******************************************************
 * 65_TitanAI.js — JARVIS AI (to'liq tizim integratsiya)
 *
 * Arxitektura:
 *   apiTitanAi(req)       — yagona kirish, history + context + Gemini
 *   apiTitanAktYarat(req) — akt preview va yozish
 *   _titanCtx()           — smeta ma'lumotlarini yig'adi (intent asosida)
 *   _titanCall()          — Gemini API, history bilan, model-fetch YO'Q
 *
 * Intent'lar (keyword-based, qo'shimcha API call yo'q):
 *   TAHLIL    — holat/progress/xulosa
 *   NARX      — narx miss / qimmat resurslar
 *   QOLDIQ    — ostatka / qachon tugaydi
 *   F2        — oylik F2 / akt dinamikasi
 *   ANOMALIYA — muammo / xavf
 *   SHARTNOMA — dogovor / to'lov / moliya
 *   DASHBOARD — barcha ob'ektlar portfeli
 *   AKT       — akt yaratish
 *******************************************************/

/* ─── KONFIGURATSIYA ─────────────────────────────────── */
var TITAN_MODEL    = 'gemini-2.5-flash';
var TITAN_TEMP     = 0.35;
var TITAN_MAX_TOK  = 2048;
var TITAN_MAX_HIST = 6;

/* ─── TIZIM PROMPTI ──────────────────────────────────── */
var _TITAN_SYS =
  'Sen — "Navoiy Yangi O\'zbekiston bog\'i" qurilish loyihasining raqamli muhandis yordamchisisisan (Isming: Jarvis AI).\n'+
  'Tizim: LRV_PLUS smeta, FAKT (bajarilgan hajm), F2 (oylik akt), DASHBOARD, SHARTNOMA.\n'+
  'JAVOB QOIDALARI:\n'+
  '1. Faqat o\'zbek tilida (texnik atamalar ru aralash — ok).\n'+
  '2. Raqamlar: mln/mlrd so\'m ko\'rinishida.\n'+
  '3. Markdown: **qalin**, *kursiv*, - ro\'yxat, ## sarlavha, | jadval.\n'+
  '4. Qisqa va aniq — 350 so\'zdan oshma.\n'+
  '5. Xavf ⚠️, muammo ❌, yaxshi ✅ emoji qo\'y.\n'+
  '6. Ma\'lumot yo\'q bo\'lsa — o\'ylab chiqarma, ayt.\n';

/* ══════════════════════════════════════════════════════════
 * ASOSIY KIRISH NUQTASI
 * req = { obyekt, text, history:[{role,text}], mode }
 * ══════════════════════════════════════════════════════════ */
function apiTitanAi(req) {
  try {
    req = req || {};
    var text    = String(req.text    || '').trim();
    var obyekt  = String(req.obyekt  || '').trim();
    var history = Array.isArray(req.history) ? req.history : [];
    var mode    = String(req.mode    || 'auto').toLowerCase();

    if (!text) return {error: 'Xabar bo\'sh'};

    // SETKEY → markaziy gateway
    if (/^setkey:/i.test(text)) {
      if (typeof apiAiKalitFromText === 'function') {
        var sk = apiAiKalitFromText(text);
        return {text: sk.xabar || '✅ Kalit saqlandi', intent:'system'};
      }
      return apiAiKalitSaqla(text.replace(/^setkey:\s*/i,'').trim());
    }

    if (/^\/testgroq/i.test(text)) {
      if(typeof _groqGwKey !== 'function' || !_groqGwKey()) return {text: "Groq kaliti ulanmagan!"};
      try {
        var tTest = groqCall({
          system: "Sen qisqa va londa javob beruvchi yordamchisan.",
          contents: [{ role: 'user', parts: [{ text: "Salom! Groq ishlayaptimi?" }] }]
        });
        return {text: "✅ Groq 100% ISHLAYAPTI!\nJavob: " + tTest, intent: "system"};
      } catch (ex) {
        return {text: "❌ Groq XATO BERDI:\n" + String(ex.message||ex), intent: "system"};
      }
    }

    /* ⚡⚡⚡ 2026-07-18 ONI (INSTANT) YO'L — LLM UMUMAN CHAQIRILMAYDI.
     * Foydalanuvchi «salom» yozganda ham tashqi AI'ga so'rov ketardi va 60 soniya
     * kutilardi. Salomlashish / «kimsan» / «nima qila olasan» kabi xabarlarga javob
     * TIZIMNING O'ZIDA bor — ularni DARHOL (0 soniya) qaytaramiz. Bu eng ko'p
     * uchraydigan xabar turi, shuning uchun sezilarli tezlik beradi. */
    var _t0=String(text).toLowerCase().replace(/[!.,?]+/g,' ').trim();
    if(/^(salom|assalom\w*|assalomu\s*alaykum|hayrli\s*(kun|tong|kech)|hi|hello|привет|салом)\b/.test(_t0) && _t0.length<40){
      return {intent:'system', text:
        '**Salom!** Men Jarvis — shu tizimning muhandis-yordamchisiman.\n\n'+
        'Menga shunday savollar bering (aniq raqam bilan javob beraman):\n'+
        '• *«Amfiteatrda bu oy qancha fakt bajarildi?»*\n'+
        '• *«Qaysi obyektda Ф2 orqada qolgan?»*\n'+
        '• *«Shebenni qancha ishlatdik, narxi qancha?»*\n'+
        '• *«Suniy ko\'lda qoldiq qancha?»*\n\n'+
        'Yoki pastdagi tugmalardan foydalaning: 📊 Tahlil · ⚠ Muammolar · 💰 Narxlar · 📄 F2 · 🧾 Akt yoz'};
    }
    if(/^(kimsan|kim\s*san|sen\s*kimsan|o'?zingni\s*tanit|nima\s*qila\s*olasan|nimalarni\s*bilasan|yordam|help)\b/.test(_t0)){
      return {intent:'system', text:
        '**Jarvis — qurilish smeta tizimining AI muhandisi.**\n\n'+
        '**Bilaman:** har obyektning smeta/fakt/Ф2/qoldiq raqamlarini, накрутка hisobini, '+
        'shartnoma va to\'lovlarni, sklad qoldig\'ini, resurs narxlarini.\n\n'+
        '**Qila olaman:**\n'+
        '• Aniq raqamli hisobot (manbasi bilan)\n'+
        '• Akt (далолатнома) qoralamasini tuzish\n'+
        '• ФАКТ yozishni taklif qilish (siz tasdiqlaysiz)\n'+
        '• Anomaliya va muammolarni ko\'rsatish\n\n'+
        '**Muhim:** men raqamni O\'YLAB TOPMAYMAN — faqat tizimdagi haqiqiy ma\'lumotni o\'qib beraman.'};
    }
    if(/^(rahmat|tashakkur|zo'?r|yaxshi|ok|okay|спасибо)\b/.test(_t0) && _t0.length<25){
      return {intent:'system', text:'Doim xizmatdaman! Yana savol bo\'lsa — yozing. 👷'};
    }

    var apiKey = (typeof _aiGwKey === 'function') ? _aiGwKey() : _titanKey();
    if (!apiKey) return {
      text: '⚙️ **Gemini API kaliti kerak**\n\n'+
            'Chat oynasiga yozing:\n`setkey:SIZNING_KALITINGIZ`\n\n'+
            'Kalit: aistudio.google.com → API Keys (bepul)',
      intent:'setup'
    };

    var intent = _titanIntent(text, mode);
    
    // FAKT YOZISH INTENT INTERCEPT 
    if (intent === 'FAKT_YOZISH') {
      return apiJarvisFaktDraft(req);
    }

    var ctx    = _titanCtx(obyekt, intent);

    // SQL/SUPABASE DALIL INJECTION
    if (typeof _aiDalil === 'function' && typeof _aiTerms === 'function') {
      try {
        var terms = _aiTerms(text);
        if (terms && terms.length > 0) {
          var dalil = _aiDalil(obyekt, terms, text);
          if (dalil && dalil.text) {
            ctx.text += '\n\n=== SUPABASE / SQL BAZADAN ANIQ DALIL (Jadval qidiruvi emas, aniq yig\'indi) ===\n' + dalil.text;
          }
        }
      } catch(ex) {
        // Fallback: Agar Supabase ulana olmasa, xato bermaydi, oddiy keshdan davom etadi
        Logger.log('AI Dalil xato: ' + ex);
      }
    }

    var answer = _titanCall(apiKey, _TITAN_SYS+'\n\n'+ctx.text, text, history.slice(-TITAN_MAX_HIST));

    return {text:answer, intent:intent, ctxLabel:ctx.label};
  } catch(e) {
    return {error: String(e.message||e)};
  }
}

/* ══════════════════════════════════════════════════════════
 * AKT YASASH — preview + tasdiqlash
 * ══════════════════════════════════════════════════════════ */
function apiTitanAktYarat(req) {
  try {
    req = req || {};
    var obyekt    = String(req.obyekt    || '').trim();
    var text      = String(req.text      || '').trim();
    var startDate = String(req.startDate || '').trim();
    var confirm   = !!req.confirm;

    var apiKey = _titanKey();
    if (!apiKey) return {error:'GEMINI_API_KEY topilmadi'};

    var smetaCtx = _titanAktCtx(obyekt);
    var base = Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy');
    if (startDate) { var p=startDate.split('-'); if(p.length===3) base=p[2]+'.'+p[1]+'.'+p[0]; }

    var sysPr =
      'Sen qurilish Bosh Muhandisi yordamchisisisan.\n'+
      'Vazifa: Matndan AOSR (yashirin ish akti) JSON Array yaratish.\n'+
      'QOIDALAR:\n'+
      '1. Murakkab ishni QMQ/SNiP bo\'yicha bir nechta aktga bo\'l.\n'+
      '2. Hajm/miqdor/GOST YOZMA — faqat material nomi.\n'+
      '3. OBJECT_NAME = "'+obyekt+'".\n'+
      '4. Boshlanish sanasi: '+base+'.\n'+
      '5. FAQAT JSON Array qaytar. Hech qanday markdown yo\'q.\n\n'+
      'Kalit: {"OBJECT_NAME":"","WORK_NAME":"","PROJECT_DOC":"","MATERIAL":"",'+
      '"NEXT_WORK":"","PROGRESS":"","START_DATE":"dd.MM.yyyy","END_DATE":"dd.MM.yyyy","DEVIATION":"Нет"}\n\n'+
      (smetaCtx ? 'Smetadagi FAKT>0 ishlar:\n'+smetaCtx : '');

    var resText = aiCall({
      system: sysPr,
      user: text,
      temp: 0.2,
      maxTok: 2048,
      model: TITAN_MODEL,
      json: true
    });
    var acts; try{acts=JSON.parse(resText);}
    catch(e){throw 'AI JSON formatini to\'g\'ri qaytarmadi. Qaytadan urining.';}
    if(!Array.isArray(acts)) acts=[acts];
    if(!acts.length) return {text:'Akt uchun ma\'lumot yetarli emas.',acts:[]};

    if(confirm){
      _titanActWrite(acts, obyekt);
      return {
        text:'✅ **'+acts.length+' ta akt REYESTR ga yozildi!**\n\n'+
             acts.map(function(a,i){return (i+1)+'. '+a.WORK_NAME;}).join('\n'),
        actsCreated:true, count:acts.length
      };
    }

    return {
      text:'📋 **'+acts.length+' ta akt tayyor:**\n\n'+
           acts.map(function(a,i){
             return '**'+(i+1)+'. '+a.WORK_NAME+'**\n'+
                    '  📅 '+a.START_DATE+' — '+a.END_DATE+'\n'+
                    '  🧱 '+a.MATERIAL+'\n'+
                    '  ➡️ '+a.NEXT_WORK;
           }).join('\n\n'),
      acts:acts, preview:true
    };
  } catch(e){ return {error:String(e.message||e)}; }
}

/* ── API KALIT ─────────────────────────────────────────── */
function _titanKey(){
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY')||
         PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')||'';
}

/* ── INTENT ANIQLASH (keyword-based, 0ms) ──────────────── */
function _titanIntent(text, mode){
  if(mode && mode!=='auto') return mode.toUpperCase();
  var t=text.toLowerCase();
  if(/akt\s+yoz|dalolatnoma|akt\s+yarat|akt\s+ber|aosr/i.test(t)) return 'AKT';
  if(/fakt\s+yoz|qildik|bajardik|foizini\s+yopdik|kiritdik/i.test(t)) return 'FAKT_YOZISH';
  if(/anomaliya|muammo|xavf|oshdi|smetadan/i.test(t)) return 'ANOMALIYA';
  if(/shartnoma|dogovor|to.lov|moliya|debitor|avans/i.test(t)) return 'SHARTNOMA';
  if(/narx|topilmagan|miss|qimmat|nol narx/i.test(t)) return 'NARX';
  if(/qoldiq|ostatka|qolgan|qachon tugay/i.test(t)) return 'QOLDIQ';
  if(/f2|oylik|bajarilgan.+oy|oy.+bajarilgan/i.test(t)) return 'F2';
  if(/barcha\s+obyekt|dashboard|portfel|hammasi/i.test(t)) return 'DASHBOARD';
  return 'TAHLIL';
}

/* ── KONTEKST YIG'ISH ──────────────────────────────────── */
function _titanCtx(obyekt, intent){
  var L=[], label='';

  // ⚡ 2026-07-12 TUZATILDI: avval `!obyekt` bo'lsagina ham (intentdan qat'iy nazar)
  // BUTUN PARK dashboardi (apiBossData — barcha shartnoma/buxgalteriya jamlanmasi)
  // yuklanardi. Natija: oddiy "salom" kabi obyektsiz umumiy xabarga ham keraksiz
  // og'ir ma'lumot ulanardi — javob SEKINLASHARDI va mavzudan chetga chiqardi
  // ("salom desam ham keraksiz narsalar tashlayapti" shikoyati). Endi DASHBOARD
  // faqat ANIQ shu niyat so'ralganda (_titanIntent'dagi kalit so'zlar) yuklanadi;
  // obyektsiz+DASHBOARD-emas holatda — LLM hech qanday og'ir kontekstsiz, oddiy
  // suhbat rejimida javob beradi (tezroq, aniqroq).
  if(intent==='DASHBOARD'){
    try{
      var d=apiBossData(), j=d.jami||{};
      L.push('## DASHBOARD');
      L.push('Smeta: '+_tQ(j.smeta)+' | Fakt: '+_tQ(j.fakt)+' ('+j.progress+'%) | F2: '+_tQ(j.f2)+' ('+j.f2pct+'%) | Qoldiq: '+_tQ(j.qoldiq));
      L.push('');
      (d.objects||[]).forEach(function(o){
        var bar=_tBar(o.progress,12);
        L.push('- **'+o.nom+'**: '+_tQ(o.smeta)+' '+bar+' '+o.progress+'% fakt | F2: '+o.f2pct+'%');
      });
      label='Dashboard';
    }catch(e){L.push('(Dashboard yuklanmadi: '+e.message+')');}
    return {text:L.join('\n'),label:label};
  }
  if(!obyekt){
    // Obyekt tanlanmagan va DASHBOARD ham so'ralmagan (masalan oddiy salomlashish) —
    // hech qanday og'ir ma'lumot yuklamaymiz, LLM tizim promptidagi umumiy bilim bilan javob beradi.
    return {text:'', label:''};
  }

  label=obyekt;

  // Base data — barcha intentlar uchun (keshdan, tez)
  try{
    var bd=apiBossObyekt(obyekt), t=bd.total||{};
    L.push('## '+obyekt);
    L.push('Smeta: '+_tQ(t.res)+' | Fakt: '+_tQ(t.fakt)+' ('+t.progress+'%) | F2: '+_tQ(t.f2)+' ('+t.f2pct+'% faktdan) | Qolgan: '+_tQ(t.ost));
    if(bd.locked) L.push('⚠️ Ob\'ekt QULFLANGAN.');
    L.push('');
    L.push('Kategoriya (smeta/fakt/F2/qoldiq):');
    (bd.catKeys||['ЧЕЛ','МАШ','МАТ','ОБ','М/К']).forEach(function(k){
      var c=bd.cats&&bd.cats[k]; if(!c||!c.res) return;
      L.push('  '+k+': '+_tQ(c.res)+'/'+_tQ(c.fakt)+'/'+_tQ(c.f2)+'/'+_tQ(c.ost));
    });
    if(bd.rzList&&bd.rzList.length){
      L.push('');
      L.push('Razdellar (top-20):');
      bd.rzList.slice(0,20).forEach(function(rz){
        if(!rz.res) return;
        var icon=rz.progress>=90?'✅':rz.progress>=50?'🟡':'🔴';
        L.push('  '+icon+' '+rz.nom+' — '+_tQ(rz.res)+' | '+rz.progress+'% | qoldiq: '+_tQ(rz.ost));
      });
    }
    if(bd.oylar&&bd.oylar.length){
      L.push('');
      L.push('Oylik F2:');
      bd.oylar.forEach(function(o){L.push('  '+o.oy+': '+_tQ(o.val));});
    }
    label+=' + KPI';
  }catch(e){L.push('(Boss data yuklanmadi: '+e.message+')');}

  // NARX/ANOMALIYA uchun — apiTashxis (LRV o'qiydi, sekin birinchi marta)
  if(intent==='NARX'||intent==='ANOMALIYA'){
    try{
      var tx=apiTashxis(obyekt);
      L.push('\n## NARX / ANOMALIYA');
      L.push('Jami: '+_tQ(tx.jamiSmeta)+' | Resurs: '+tx.leaf+' | Narxsiz: '+tx.nolSoni+' | Topilmagan: '+tx.missSoni);
      if(tx.missSoni>0){
        L.push('Topilmagan (top-15):');
        tx.miss.slice(0,15).forEach(function(m){L.push('  - '+m.nom+' ('+m.birlik+')');});
      }
      if(tx.top&&tx.top.length){
        L.push('Eng qimmat (top-8):');
        tx.top.slice(0,8).forEach(function(t,i){
          L.push('  '+(i+1)+'. '+t.nom+' — '+_tQ(t.smeta)+' ['+t.kat+']');
        });
      }
      label+=' + TASHXIS';
    }catch(e){L.push('\n(Tashxis yuklanmadi: '+e.message+')');}
  }

  // SHARTNOMA
  if(intent==='SHARTNOMA'){
    try{
      if(typeof apiShartnomaDashboard==='function'){
        var sh=apiShartnomaDashboard();
        if(sh&&sh.list&&sh.list.length){
          L.push('\n## SHARTNOMA');
          sh.list.forEach(function(s){
            L.push('  **'+s.nom+'**: summa '+_tQ(s.summa)+
                   ' | bajarilgan: '+_tQ(s.bajarilgan)+
                   ' | to\'langan: '+_tQ(s.tolangan)+
                   ' | debitor: '+_tQ(s.debitor));
          });
          label+=' + SHARTNOMA';
        }
      }
    }catch(e){}
  }

  return {text:L.join('\n'),label:label};
}

/* ── GEMINI API (model-fetch YO'Q, history bilan) ───────── */
function _titanCall(apiKey, sysPr, userText, history){
  var contents=[];
  (history||[]).forEach(function(h){
    contents.push({role:h.role==='model'?'model':'user', parts:[{text:String(h.text||'')}]});
  });
  contents.push({role:'user',parts:[{text:userText}]});

  // ⚡ 2026-07-12: bu — INTERAKTIV chat (foydalanuvchi jonli kutadi). maxWaitMs
  // qo'yilmasa, Groq+Gemini fallback zanjiri (429/limit holatida) 5-10 daqiqagacha
  // osilib qolishi mumkin edi ("salom" desa ham shuncha kutish shikoyati). Endi
  // ~25 soniyada aniq xato bilan qaytadi — foydalanuvchi qayta urinib ko'radi.
  var resText = aiCall({
    system: sysPr,
    contents: contents,
    temp: TITAN_TEMP,
    maxTok: TITAN_MAX_TOK,
    model: TITAN_MODEL,
    maxWaitMs: 25000
  });

  return resText || '(AI bo\'sh javob qaytardi)';
}

/* ── AKT YOZISH ─────────────────────────────────────────── */
function _titanActWrite(acts,obyekt){
  var ss=_hujOpen('akt'), sh=_aktSheet(ss);
  var headers={};
  sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].forEach(function(h,i){if(h)headers[String(h).trim()]=i+1;});
  var actNumCol=headers['ACT_NUMBER']||headers['Act_Number']||1;
  var lastNum=sh.getLastRow()>1?parseInt(sh.getRange(sh.getLastRow(),actNumCol).getValue())||0:0;
  acts.forEach(function(act){
    lastNum++;
    var len=Math.max(Object.keys(headers).length,20), row=new Array(len).fill('');
    function sv(k,v){var ci=headers[k]||headers[(k||'').toUpperCase()];if(ci)row[ci-1]=v;}
    sv('ACT_NUMBER',lastNum); sv('STATUS','IMPORTED_NEW'); sv('LAST_SYNC',new Date());
    for(var k in act) sv(k,act[k]);
    sh.appendRow(row);
  });
  SpreadsheetApp.flush();
}

/* ── AKT SMETA CONTEXT (FAKT>0 BL lar) ─────────────────── */
function _titanAktCtx(obyekt){
  if(!obyekt) return '';
  try{
    var plus=_plusTop(obyekt); if(!plus) return '';
    var a=sozAsosiy(),col=CFG.C,lines=[],cnt=0;
    plus.getSheets().forEach(function(sh){
      if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) return;
      var last=sh.getLastRow(),start=a.dataQator>0?a.dataQator:_autoData(sh);
      if(last<start) return;
      sh.getRange(start,1,last-start+1,col.FAKT).getValues().forEach(function(row){
        var mk=String(row[col.MARKER-1]||'').replace(/[+~]$/,'').toLowerCase();
        if(mk!=='bl'&&mk!=='mat') return;
        if(_toNum(row[col.FAKT-1])<=0) return;
        var nom=String(row[col.NOM-1]||'').trim();
        if(nom&&cnt<25){lines.push('- '+nom+' ('+String(row[col.BIRLIK-1]||'')+')');cnt++;}
      });
    });
    return lines.join('\n');
  }catch(e){return '';}
}

/* ── FORMATLOVCHILAR ─────────────────────────────────────── */
function _tQ(n){
  n=Math.round(Number(n)||0);
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+' mlrd';
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+' mln';
  return String(n);
}
function _tBar(pct,len){
  var f=Math.max(0,Math.min(len,Math.round((pct||0)/100*len)));
  return '['+'█'.repeat(f)+'░'.repeat(len-f)+']';
}

/* ── ORQAGA MOSLIK (eski apiSmetaSuperAi) ────────────────── */
function apiSmetaSuperAi(obyekt,text,checkedWorks,startDate){
  if(!text && checkedWorks && checkedWorks.length) 
    return apiTitanAktYarat({obyekt:obyekt,text:text+' Tanlangan: '+checkedWorks.join(', '),startDate:startDate,confirm:false});

  var res=apiTitanAi({obyekt:obyekt,text:text,history:[],mode:'auto'});
  return res.text||'';
}

/* ══════════════════════════════════════════════════════════
 * FAKT YOZISH - CONVERSATIONAL DATA ENTRY
 * ══════════════════════════════════════════════════════════ */
function apiJarvisFaktDraft(req) {
  var obyekt = String(req.obyekt||'').trim();
  var text = String(req.text||'').trim();
  if (!obyekt) return {text: "Fakt yozish uchun obyekt tanlanishi shart."};

  // 1) Obyektdagi hamma qatorlarni tortib olamiz (API)
  var bd = null;
  try { bd = apiBossObyekt(obyekt); } catch(e) { return {text: "Baza o'qishda xatolik: " + e}; }
  if(!bd || !bd.rzList) return {text: "Obyekt ma'lumotlari topilmadi."};

  var L = [];
  L.push('Obyekt: ' + obyekt);
  L.push('Smetadagi joriy qatorlar (faqat to\'liq bajarilmagan ishlar ko\'rsatilmoqda):');
  L.push('ID | RAZDEL | ISH NOMI | SMETA | FAKT | QOLDIQ');
  
  // Faqat ost>0 bo'lgan qatorlarni jo'natamiz (tokens tejash uchun)
  // BossObyekt da rows yo'q, faqat rzList. Shuning uchun Smeta Excel ni to'g'ridan to'g'ri o'qiymiz
  var smetaData = [];
  try {
     var ss = null;
     var p = PropertiesService.getScriptProperties();
     var parkStr = p.getProperty('SMETA_PARK');
     if(parkStr){
       var park = JSON.parse(parkStr);
       var fid = park[obyekt];
       if(fid) {
         ss = SpreadsheetApp.openById(fid);
         var sh = ss.getSheetByName('Смета');
         if(sh) {
            var v = sh.getDataRange().getValues();
            var h = v[3]||v[2]||[];
            var colId = h.indexOf('№/№'), colNom = h.indexOf('Обоснование, наименование'), colRz = h.indexOf('РАЗДЕЛ');
            var colSm = h.indexOf('ВСЕГО'), colFk = h.indexOf('ФАКТ');
            if(colId>-1 && colNom>-1 && colSm>-1) {
               for(var i=4; i<v.length; i++) {
                 var r=v[i];
                 var id = String(r[colId]||'').trim();
                 if(!id) continue;
                 var sm = Number(r[colSm])||0;
                 var fk = colFk>-1 ? (Number(r[colFk])||0) : 0;
                 var qoldiq = sm - fk;
                 if(qoldiq > 0) {
                   smetaData.push({ id: id, razdel: r[colRz]||'', nom: String(r[colNom]).substring(0,100), smeta: sm, qoldiq: qoldiq, rowIdx: i+1 });
                   L.push(id + ' | ' + (r[colRz]||'') + ' | ' + String(r[colNom]).substring(0,50) + ' | ' + sm + ' | ' + fk + ' | ' + qoldiq);
                 }
               }
            }
         }
       }
     }
  } catch(e) { L.push("Baza xatosi: "+e.message); }

  if(smetaData.length===0) {
    return {text: "Barcha ishlar 100% qilingan yoki smeta o'qilmadi."};
  }

  // LLM dan JSON so'rash
  var sysPr = 'Sen Jarvis AI san. Foydalanuvchi qaysi ishlarni bajarganini aytadi.\n'+
              'Pastdagi ro\'yxatdan u aytgan ishlarni topib, JSON Array qaytar.\n'+
              'Agar "hamma", "barchasi" desa, ushbu razdeldagi (yoki umuman) barcha ishlarning faktiga uning qoldig\'ini (QOLDIQ) yoz.\n'+
              'Agar foiz aytsa, smetaning shu foizini hisobla.\n'+
              'JSON Format:\n'+
              '[\n  { "id": "1", "nom": "Beton...", "faktYangi": 15.5 },\n  ...\n]\n'+
              'Faqat JSON, matn yozma!';
              
  var reqText = _TITAN_SYS + '\n\n' + sysPr + '\n\nMA\'LUMOT:\n' + L.join('\n');

  var resText = aiCall({
      system: sysPr,
      user: text,
      temp: 0.1,
      maxTok: 2048,
      model: TITAN_MODEL,
      json: true,
      contents: [{ role:'user', parts:[{text: reqText + '\n\nBUYRUQ:\n' + text}] }]
  });

  var drafts = [];
  try { drafts = JSON.parse(resText); } catch(e) { return {text: "Tushunib bo'lmadi. Boshqa so'z bilan tushuntiring."}; }
  if(!Array.isArray(drafts)) drafts=[drafts];

  if(drafts.length === 0) return {text: "Siz aytgan ishlarga mos qator topilmadi."};

  // Faqat ID orqali validatsiya
  var finalDrafts = [];
  drafts.forEach(function(d){
     var orig = smetaData.filter(function(s){ return String(s.id) === String(d.id); })[0];
     if(orig) {
        finalDrafts.push({
           id: orig.id,
           rowIdx: orig.rowIdx,
           nom: orig.nom,
           qoldiq: orig.qoldiq,
           faktYangi: d.faktYangi
        });
     }
  });

  if(finalDrafts.length === 0) return {text: "Javob validatsiyadan o'tmadi. ID lar mos kelmadi."};

  return {
    intent: 'FAKT_YOZISH',
    text: "Quyidagi ishlarni bazaga yozish uchun qoralama tayyorlandi. Iltimos, tekshirib chiqing:",
    faktDrafts: finalDrafts,
    preview: true
  };
}

function apiJarvisFaktSaqla(req) {
  var obyekt = req.obyekt;
  var drafts = req.drafts || [];
  if(!obyekt || !drafts.length) return {error: "Ma'lumot to'liq emas."};

  try {
     var ss = null;
     var p = PropertiesService.getScriptProperties();
     var parkStr = p.getProperty('SMETA_PARK');
     var park = JSON.parse(parkStr);
     var fid = park[obyekt];
     if(!fid) return {error: "Obyekt fayli topilmadi."};
     ss = SpreadsheetApp.openById(fid);
     var sh = ss.getSheetByName('Смета');
     if(!sh) return {error: "Smeta varag'i topilmadi."};

     var v = sh.getDataRange().getValues();
     var h = v[3]||v[2]||[];
     var colFk = h.indexOf('ФАКТ');
     if(colFk === -1) return {error: "Smetada FAKT ustuni topilmadi."};

     var count = 0;
     drafts.forEach(function(d){
        if(d.rowIdx && d.faktYangi > 0) {
           var joriy = Number(sh.getRange(d.rowIdx, colFk+1).getValue()) || 0;
           sh.getRange(d.rowIdx, colFk+1).setValue(joriy + d.faktYangi);
           count++;
        }
     });
     
     // Svod va Holat invalidatsiyasi
     if(typeof _holatInvalidate === 'function') _holatInvalidate(obyekt);
     
     return {text: "✅ " + count + " ta qator bo'yicha fakt ma'lumotlari muvaffaqiyatli saqlandi!"};

  } catch(e) { return {error: String(e.message||e)}; }
}
