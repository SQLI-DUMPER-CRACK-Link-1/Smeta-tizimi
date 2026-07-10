/******************************************************************
 * 71_AI_Savol.js — SMETA: HAR QANDAY SAVOLGA GROUNDED JAVOB + MENYU
 * ==================================================================
 * Maqsad (foydalanuvchi talabi): smetaga/obyektga doir HAR QANDAY
 * savolga ANIQ va TO'G'RI javob; AI hech qachon o'zidan TO'QIMAYDI.
 *
 * Usul: savol bo'yicha tizimning BARCHA tegishli ma'lumoti yig'iladi
 * (KPI, kategoriya, razdel, oylik Ф2, material, shartnoma, to'lov,
 *  anomaliya, akt qoplash, prognoz, narx, dashboard) -> Gemini'ga
 * "yagona haqiqat manbai" sifatida beriladi -> faqat shundan javob.
 * Ma'lumot bo'lmasa: "bazada yo'q" deydi, son o'ylab chiqarmaydi.
 *
 * Kirish:
 *   apiSmetaSavol(req)  — {text, obyekt?, history?} -> {text, manbalar}
 *   aiMenuQur()         — "🤖 СМЕТА AI" menyusini quradi (onOpen ga ulang)
 *   aiUi*()             — menyu uchun UI o'ramlari (faol obyekt bilan)
 *
 * Yadro: 66_AI_Data.js (_aiGen,_aiDalil,_aiObyektlar,_aiTextdaObyekt,
 *   _aiTerms,_aiPul,_aiN,_aiNum,_aiKey,GEMINI_MODEL), 68_AI_Tahlil.js
 *   (_aiAnomOl,_aiPrognozHisob).
 ******************************************************************/

var _SMETA_QA_SYS =
  'Sen — "Navoiy Yangi O\'zbekiston bog\'i" qurilish smetasi bo\'yicha ANIQ ma\'lumot beruvchi muhandis-tahlilchisan.\n'+
  'Pastda BAZA MA\'LUMOTI beriladi — bu YAGONA HAQIQAT MANBAI.\n'+
  'TEMIR QOIDALAR:\n'+
  '1. FAQAT shu ma\'lumotdan foydalan. Hech qanday son/fakt O\'YLAB CHIQARMA, taxmin qilma.\n'+
  '2. Agar javob ma\'lumotda yo\'q bo\'lsa, ROSTINI ayt: "Bu bazada yo\'q" va qaysi bo\'lim/qadam kerakligini ayt.\n'+
  '3. O\'zbek tilida (atamalar/material ruscha qolishi mumkin). Pul: mln/mlrd so\'m; hajm: birlik bilan.\n'+
  '4. Avval QISQA aniq javob (kerakli raqam), keyin kerak bo\'lsa izoh/taqsimot.\n'+
  '5. Bir nechta obyekt/qator bo\'lsa — ajratib ko\'rsat. Markdown: **qalin** raqamga, - ro\'yxat.\n'+
  '6. Hisob-kitob faqat berilgan raqamlar ustida (qo\'shish/foiz). Yangi qiymat ixtiro qilma.';

/* ══════════════════════════════════════════════════════════════
 * ASOSIY — grounded savol-javob
 * ══════════════════════════════════════════════════════════════ */
function apiSmetaSavol(req){
  try{
    req = req || {};
    var text = String(req.text||'').trim();
    var obyekt = String(req.obyekt||'').trim();
    if(!text) return { text:"Savol bo'sh" };
    if(/^setkey:/i.test(text) && typeof apiAiKalitFromText==='function'){
      var sk = apiAiKalitFromText(text);
      return { text: sk.xabar, manbalar:['kalit'] };
    }
    if(typeof _aiKey==='function' && !_aiKey())
      return { text:'⚙️ Gemini kaliti kerak.\n\nPanel → Созлама → 🤖 AI kalit\nyoki: setkey:KALIT (aistudio.google.com)' };

    var objs = (typeof _aiObyektlar==='function') ? _aiObyektlar() : [];
    if(!obyekt && typeof _aiTextdaObyekt==='function') obyekt = _aiTextdaObyekt(text, objs);

    var ctx = _smetaKontekst(obyekt, text);
    if(!ctx.text) ctx.text = '(tegishli ma\'lumot topilmadi)';

    var prompt = 'SAVOL: '+text+'\n\n'+
      (obyekt ? ('OBYEKT: '+obyekt+'\n') : '(obyekt aniqlanmadi — portfel/barcha bo\'yicha)\n')+
      'BAZA MA\'LUMOTI (yagona haqiqat manbai):\n'+ctx.text+'\n\n'+
      'Faqat shu ma\'lumotga tayanib aniq javob ber. Yo\'q bo\'lsa — "bazada yo\'q" de.';
    var ans = _aiGen(_SMETA_QA_SYS, prompt, { temp:0.15, maxTok:1600 });
    return { text:ans, obyekt:obyekt, manbalar:ctx.manbalar };
  }catch(e){ return { text:'❌ '+String(e.message||e), error:String(e.message||e) }; }
}

/* ══════════════════════════════════════════════════════════════
 * KONTEKST YIG'ISH — savolga qarab BARCHA tegishli grounded ma'lumot
 * ══════════════════════════════════════════════════════════════ */
function _smetaKontekst(obyekt, text){
  var t = String(text||'').toLowerCase();
  var L = [], src = [];
  var pul = /pul|moliya|shartnoma|dogovor|to.lov|tolov|debitor|kreditor|avans|qarz|summa|narx/.test(t);
  var vaqt = /qachon|tuga|sur.at|prognoz|oy|muddat|kech|deadline|bashorat/.test(t);
  var nazorat = /anomaliya|nazorat|xato|muammo|firib|fraud|qo.shib|akt|qoplash|yashirin/.test(t);
  var portfel = !obyekt || /barcha|hamma|portfel|obyektlar|qaysi obyekt|taqqos|solishtir|eng/.test(t);
  var material = /beton|armatur|sement|cement|material|resurs|[мm]\d{2,3}|qancha ishlatil|qancha kel|sarf|qoldiq/.test(t) ||
                 (typeof _aiTerms==='function' && _aiTerms(text).length>0);

  // 1) OBYEKT KPI (har doim, obyekt bo'lsa) — eng asosiy grounded asos
  if(obyekt){
    try{
      var b = apiBossObyekt(obyekt), tt = b.total||{};
      L.push('### OBYEKT KPI: '+obyekt+(b.locked?' (QULF)':''));
      L.push('Smeta: '+_aiPul(tt.res)+' | Bajarilgan(fakt): '+_aiPul(tt.fakt)+' ('+_aiNum(tt.progress)+'%) | Ф2(akt): '+_aiPul(tt.f2)+' ('+_aiNum(tt.f2pct)+'%) | Qolgan: '+_aiPul(tt.ost));
      if(b.cats && b.catKeys){
        L.push('Kategoriya (smeta/fakt/Ф2/qoldiq):');
        b.catKeys.forEach(function(k){ var c=b.cats[k]; if(c&&c.res) L.push('  '+k+': '+_aiPul(c.res)+' / '+_aiPul(c.fakt)+' / '+_aiPul(c.f2)+' / '+_aiPul(c.ost)); });
      }
      if(b.rzList && b.rzList.length){
        L.push('Razdellar (smeta | progress% | qoldiq) — top 25:');
        b.rzList.slice(0,25).forEach(function(rz){ if(rz.res) L.push('  - '+rz.nom+': '+_aiPul(rz.res)+' | '+_aiNum(rz.progress)+'% | '+_aiPul(rz.ost)); });
      }
      if(b.oylar && b.oylar.length){
        L.push('Oylik Ф2: '+b.oylar.map(function(o){return o.oy+'='+_aiPul(o.val);}).join(', '));
      }
      src.push('KPI');
    }catch(e){ L.push('(KPI yuklanmadi: '+(e.message||e)+')'); }
  }

  // 2) MATERIAL / RESURS (aniq qator) — _aiDalil (holat/prixod/viborka/narx)
  if(material && typeof _aiDalil==='function'){
    try{
      var terms = (typeof _aiTerms==='function') ? _aiTerms(text) : [];
      var ev = _aiDalil(obyekt, terms, text);
      if(ev.count>0 || ev.jami){
        L.push('\n### MATERIAL/RESURS (SQL yig\'indi, '+ev.totalRows+' qator, manba: '+ev.manba+'):');
        L.push(ev.text);
        src.push('sql_material');
      }
    }catch(e){}
  }

  // 3) MOLIYA — shartnoma + to'lov
  if(pul){
    try{
      if(typeof apiShartnomaDashboard==='function'){
        var sh=apiShartnomaDashboard();
        var list=sh.list||sh.shartnomalar||[];
        if(list.length){
          L.push('\n### SHARTNOMA / MOLIYA:');
          list.slice(0,15).forEach(function(s){
            L.push('  - '+(s.nom||s.no||'')+': summa '+_aiPul(s.summa||s.jami||s.dog_summa)+
              ' | bajarilgan(Ф2) '+_aiPul(s.bajarilgan||s.jamiF2||s.f2)+
              ' | to\'langan '+_aiPul(s.tolangan)+' | debitor '+_aiPul(s.debitor));
          });
          src.push('shartnoma');
        }
      }
    }catch(e){}
    try{
      if(typeof apiTolovOl==='function'){
        var tl=apiTolovOl()||[];
        if(tl.length){
          L.push('\n### TO\'LOVLAR (oxirgi 12):');
          tl.slice(-12).forEach(function(r){ L.push('  - '+(r.sana||'')+' | '+(r.obyekt||r.shNo||'')+' | '+_aiPul(r.summa)+' | '+(r.tur||'')); });
          src.push('tolov');
        }
      }
    }catch(e){}
  }

  // 4) NAZORAT — anomaliya + akt qoplash
  if(nazorat && obyekt){
    try{
      if(typeof _aiAnomOl==='function'){
        var an=_aiAnomOl(obyekt);
        if(an.length){ L.push('\n### ANOMALIYA (nazorat buzilishi):'); an.slice(0,15).forEach(function(a){ L.push('  - ['+(a.daraja||'')+'] '+a.qoida+': '+a.tavsif); }); src.push('anomaliya'); }
        else L.push('\n### ANOMALIYA: yo\'q ✅');
      }
    }catch(e){}
    try{
      if(typeof apiAktCoverage==='function'){
        var c=apiAktCoverage(obyekt).stats||{};
        L.push('### AKT QOPLASH: '+(c.foiz||0)+'% ('+(c.qoplangan||0)+'/'+(c.jami||0)+'), AKTSIZ yashirin: '+(c.yashirinAktsiz||0));
        src.push('akt_coverage');
      }
    }catch(e){}
  }

  // 5) PROGNOZ — vaqt/sur'at
  if(vaqt && obyekt && typeof _aiPrognozHisob==='function'){
    try{
      var p=_aiPrognozHisob(obyekt);
      if(!p.error){
        L.push('\n### PROGNOZ (kod hisobi): oylik sur\'at '+_aiPul(p.velocity)+', qolgan ~'+p.oyQoldi+' oy, taxminiy tugash '+(p.tugashSana||'?')+(p.f2Orqada?' | ⚠️ Ф2 faktdan orqada':''));
        src.push('prognoz');
      }
    }catch(e){}
  }

  // 6) PORTFEL / TAQQOSLASH — barcha obyektlar
  if(portfel){
    try{
      var d=apiBossData(), j=d.jami||{};
      L.push('\n### PORTFEL (barcha obyektlar):');
      L.push('JAMI: smeta '+_aiPul(j.smeta)+', fakt '+_aiPul(j.fakt)+' ('+_aiNum(j.progress)+'%), Ф2 '+_aiPul(j.f2)+' ('+_aiNum(j.f2pct)+'%), qolgan '+_aiPul(j.qoldiq));
      (d.objects||[]).forEach(function(o){ L.push('  - '+o.nom+': smeta '+_aiPul(o.smeta)+' | fakt '+_aiNum(o.progress)+'% | Ф2 '+_aiNum(o.f2pct)+'%'); });
      src.push('dashboard');
    }catch(e){}
  }

  return { text:L.join('\n'), manbalar:src };
}

/* ══════════════════════════════════════════════════════════════
 * MENYU — har bir kuchli menyuda AI (onOpen ga ulang: aiMenuQur())
 * ══════════════════════════════════════════════════════════════ */
function aiMenuQur(){
  SpreadsheetApp.getUi().createMenu('🤖 СМЕТА AI')
    .addItem('💬 AI yordamchi (panel)', 'aiUiPanel')
    .addItem('❓ Tez savol berish', 'aiUiSavol')
    .addSeparator()
    .addItem('📋 Rahbar hisoboti (obyekt)', 'aiUiHisobot')
    .addItem('🚨 Anomaliya / nazorat', 'aiUiAnomaliya')
    .addItem('🔮 Prognoz (tugash/sur\'at)', 'aiUiPrognoz')
    .addSeparator()
    .addItem('📝 Aktsiz ishlarga akt qorala', 'aiUiAktQorala')
    .addItem('✅ Akt qoplash tahlili', 'aiUiAktTahlil')
    .addSeparator()
    .addItem('🔑 Gemini kalit ulash', 'aiUiKalit')
    .addItem('⚡ Groq kalit ulash (tezroq, ixtiyoriy)', 'aiUiGroqKalit')
    .addToUi();
}

function aiUiPanel(){ if(typeof smetaAIShow==='function') smetaAIShow(); else SpreadsheetApp.getUi().alert('SmetaAI paneli yuklanmagan.'); }

function aiUiSavol(){
  var ui=SpreadsheetApp.getUi();
  var res=ui.prompt('🤖 AI ga savol','Smetaga/obyektga doir savol yozing.\nMasalan: "Suniy ko\'lda M200 beton qancha ishlatilgan?"', ui.ButtonSet.OK_CANCEL);
  if(res.getSelectedButton()!==ui.Button.OK) return;
  var q=String(res.getResponseText()||'').trim(); if(!q) return;
  var r=apiSmetaSavol({text:q});
  ui.alert('🤖 Javob', _aiAlertText(r.text)+(r.manbalar&&r.manbalar.length?('\n\n— manba: '+r.manbalar.join(', ')):''), ui.ButtonSet.OK);
}

function aiUiHisobot(){ _aiUiAna(apiAiHisobot, 'Rahbar hisoboti'); }
function aiUiAnomaliya(){ _aiUiAna(apiAiAnomaliya, 'Anomaliya / nazorat'); }
function aiUiPrognoz(){ _aiUiAna(apiAiPrognoz, 'Prognoz'); }
function aiUiAktTahlil(){ _aiUiAna(apiAiAktTahlil, 'Akt qoplash'); }

function aiUiAktQorala(){
  var ui=SpreadsheetApp.getUi();
  var ob=(typeof _pick==='function')?_pick():''; if(!ob) return;
  if(typeof apiAiAktDraft!=='function'){ ui.alert('67_AI_Akt.js yuklanmagan.'); return; }
  var r=apiAiAktDraft(ob,{});
  if(r.error){ ui.alert('Xato: '+r.error); return; }
  if(!r.drafts||!r.drafts.length){ ui.alert(_aiAlertText(r.text)); return; }
  var resp=ui.alert('🤖 '+r.drafts.length+' ta akt qoralama tayyor', _aiAlertText(r.text)+'\n\nREYESTR ga yozaymi?', ui.ButtonSet.YES_NO);
  if(resp===ui.Button.YES){
    var w=apiAiAktYoz(ob, r.drafts);
    ui.alert(_aiAlertText(w.text||w.error));
  }
}

function _aiUiAna(fn, nom){
  var ui=SpreadsheetApp.getUi();
  if(typeof fn!=='function'){ ui.alert(nom+': modul yuklanmagan (67/68_AI_*.js).'); return; }
  var ob=(typeof _pick==='function')?_pick():''; if(!ob) return;
  var r=fn(ob);
  ui.alert('🤖 '+nom+' — '+ob, _aiAlertText(r.text||r.error), ui.ButtonSet.OK);
}

function aiUiKalit(){
  var ui=SpreadsheetApp.getUi();
  var res=ui.prompt('🔑 Gemini API kalit (markaziy)','aistudio.google.com → API Keys.\nBir marta kiritsangiz — AI chat, Telegram, tahlil hammasi ishlaydi.', ui.ButtonSet.OK_CANCEL);
  if(res.getSelectedButton()!==ui.Button.OK) return;
  var k=String(res.getResponseText()||'').trim();
  if(k.length<15){ ui.alert('Noto\'g\'ri kalit.'); return; }
  try{
    var r = (typeof apiAiKalitSaqla==='function') ? apiAiKalitSaqla(k) : {xabar:'OK'};
    ui.alert('✅ '+r.xabar);
  }catch(e){ ui.alert('Xato: '+e.message); }
}

function aiUiGroqKalit(){
  var ui=SpreadsheetApp.getUi();
  var res=ui.prompt('⚡ Groq API kalit (ixtiyoriy, tezroq)','console.groq.com → API Keys ("gsk_..." bilan boshlanadi).\nUlansa — matnli AI javoblar va ovozli xabar tahlili tezlashadi, Gemini zaxira bo\'lib qoladi.', ui.ButtonSet.OK_CANCEL);
  if(res.getSelectedButton()!==ui.Button.OK) return;
  var k=String(res.getResponseText()||'').trim();
  if(k.length<15){ ui.alert('Noto\'g\'ri kalit.'); return; }
  try{
    var r = (typeof apiGroqKalitSaqla==='function') ? apiGroqKalitSaqla(k) : {xabar:'OK'};
    ui.alert('✅ '+r.xabar);
  }catch(e){ ui.alert('Xato: '+e.message); }
}

/* alert uchun markdownni soddalashtirish */
function _aiAlertText(s){
  return String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#+\s*/gm,'').replace(/^- /gm,'• ');
}

function smetaSavolTest(){
  Logger.log(JSON.stringify(apiSmetaSavol({text:'Umumiy holat qanday, qaysi obyekt orqada?'}),null,2));
}
