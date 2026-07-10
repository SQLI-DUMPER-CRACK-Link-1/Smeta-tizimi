/******************************************************************
 * 69_AI_Orchestrator.js — SMETA: YAGONA AQLLI AI KIRISH (hammasi birga)
 * ==================================================================
 * Bitta funksiya — butun AI quvvati. Niyatni aniqlab, mos modulga
 * yo'naltiradi (suhbat XOTIRASI bilan):
 *   - data savol (M200 beton qancha...)     -> apiTitanData   (66_AI_Data.js)
 *   - umumiy chat/tahlil                     -> apiTitanAi     (65_TitanAI.js)
 *   - akt qoplash tahlili                    -> apiAiAktTahlil (67_AI_Akt.js)
 *   - aktsiz ishlarga AI qoralama            -> apiAiAktDraft  (67_AI_Akt.js)
 *   - qoralamani yozish (tasdiq)             -> apiAiAktYoz    (67_AI_Akt.js)
 *   - anomaliya / nazorat                    -> apiAiAnomaliya (68_AI_Tahlil.js)
 *   - prognoz (tugash/sur'at)                -> apiAiPrognoz   (68_AI_Tahlil.js)
 *   - rahbar hisoboti                        -> apiAiHisobot   (68_AI_Tahlil.js)
 *
 * Panel.html (yoki yangi SmetaAI.html) shuni chaqirsa — bitta oynada
 * hamma ish bajariladi. Natija {text, drafts?, kind} — drafts bo'lsa
 * UI "✅ Yozish" tugmasini ko'rsatadi (apiSmetaAi confirm bilan yozadi).
 ******************************************************************/

function apiSmetaAi(req){
  try{
    req = req || {};
    var text = String(req.text||'').trim();
    var obyekt = String(req.obyekt||'').trim();
    var t = text.toLowerCase();

    // 0) Akt qoralamani tasdiqlab yozish
    if(req.confirm && req.drafts && req.drafts.length){
      if(typeof apiAiAktYoz!=='function') return {text:'67_AI_Akt.js yuklanmagan.'};
      return _ozb(apiAiAktYoz(obyekt, req.drafts));
    }
    if(!text) return {text:"Savol bo'sh"};

    // setkey → markaziy kalit
    if(/^setkey:/i.test(text)){
      if(typeof apiAiKalitFromText==='function'){
        var sk = apiAiKalitFromText(text);
        return _ozb({ text: (sk && sk.xabar) || 'Kalit saqlandi' }, 'system');
      }
      var kr = apiAiKalitSaqla(text.replace(/^setkey:\s*/i,''));
      return _ozb({ text: kr.xabar }, 'system');
    }
    if(typeof _aiKey==='function' && !_aiKey() && !/^setkey:/i.test(text))
      return {text:'⚙️ Gemini kaliti kerak.\n\nPanel → **Созлама** → 🤖 AI kalit\nyoki: `setkey:KALIT`', kind:'setup'};

    // 1) AKT — aktsiz ishlarga qoralama (preview + drafts)
    if(/akt.*(qorala|tayyorla|yarat|yoz|kerak)|aktsiz|akt yo.q/.test(t)){
      if(!obyekt) return {text:'Qaysi obyekt uchun? Obyektni tanlang.'};
      if(typeof apiAiAktDraft!=='function') return {text:'67_AI_Akt.js yuklanmagan.'};
      var dr = apiAiAktDraft(obyekt, { startDate:req.startDate||'' });
      return { text:dr.text||dr.error, drafts:dr.drafts||[], obyekt:obyekt, kind:'akt_draft' };
    }
    // 2) AKT qoplash tahlili
    if(/akt.*(qoplash|tahlil|holat|coverage)|qoplash/.test(t)){
      if(!obyekt) return {text:'Obyektni tanlang.'};
      if(typeof apiAiAktTahlil==='function') return _ozb(apiAiAktTahlil(obyekt), 'akt_coverage');
    }
    // 3) Anomaliya / nazorat
    if(/anomaliya|nazorat|firib|fraud|qo.shib yoz|invariant|xato|muammo/.test(t)){
      if(!obyekt) return {text:'Obyektni tanlang.'};
      if(typeof apiAiAnomaliya==='function') return _ozb(apiAiAnomaliya(obyekt), 'anomaliya');
    }
    // 4) Prognoz
    if(/prognoz|qachon tuga|tugash|sur.at|bashorat|necha oy|byudjet osh/.test(t)){
      if(!obyekt) return {text:'Obyektni tanlang.'};
      if(typeof apiAiPrognoz==='function') return _ozb(apiAiPrognoz(obyekt), 'prognoz');
    }
    // 5) Rahbar hisoboti / umumiy xulosa
    if(/hisobot|rahbar|umumiy holat|to.liq xulosa|umumiy xulosa|report/.test(t)){
      if(!obyekt) return {text:'Obyektni tanlang (yoki "dashboard" deb so\'rang).'};
      if(typeof apiAiHisobot==='function') return _ozb(apiAiHisobot(obyekt), 'hisobot');
    }
    // 6) Aniq savol va ma'lumot qidirish (Yangi apiSmetaSavol moduliga yo'naltirish)
    if(/f2.*(yasab|qilib|ajratib|generatsiya|avtomat|summa|million|mln|ming)/.test(t)){
      if(!obyekt) return {text:'Obyektni tanlang.'};
      if(typeof apiAiSmartF2==='function') return _ozb(apiAiSmartF2(obyekt, text), 'smart_f2');
    }
    // 7) Aniq savol — SQL + grounded javob (barcha raqamli savollar)
    if(/\?|qancha|necha|nima|qanday|qaysi|bormi|narx|eng ko.p|eng kam|taqqos|jami|summa/.test(t) ||
       (typeof _aiDataSavolmi==='function' && _aiDataSavolmi(text))){
      if(typeof apiTitanData==='function')
        return _ozb(apiTitanData({obyekt:obyekt, text:text, history:req.history||[]}), 'data_sql');
      if(typeof apiSmetaSavol==='function')
        return _ozb(apiSmetaSavol({obyekt:obyekt, text:text, history:req.history||[]}), 'qa');
    }
    // 7) Aks holda — umumiy AI suhbat/tahlil (xotira bilan)
    if(typeof apiTitanAi==='function')
      return _ozb(apiTitanAi({obyekt:obyekt, text:text, history:req.history||[], mode:'auto'}), 'chat');
    return {text:'AI modullari yuklanmagan.'};
  }catch(e){ return {text:'❌ '+String(e.message||e), error:String(e.message||e)}; }
}

/* Natijani yagona shaklga keltirish */
function _ozb(res, kind){
  res = res || {};
  return {
    text: res.text || res.error || res.xabar || '(bo\'sh javob)',
    drafts: res.drafts || null,
    obyekt: res.obyekt || '',
    kind: kind || res.intent || '',
    manba: res.manba || '',
    totalRows: res.totalRows || 0
  };
}

/* Panel ochish (menyudan) */
function smetaAIShow(){
  var html = HtmlService.createHtmlOutputFromFile('SmetaAI').setTitle('🤖 Smeta AI — Aqlli yordamchi').setWidth(390);
  SpreadsheetApp.getUi().showSidebar(html);
}

function smetaAiTest(){
  var obs=(typeof papkaSkan==='function')?papkaSkan():[];
  var ob=obs.length?obs[0].obyekt:'';
  Logger.log(JSON.stringify(apiSmetaAi({text:'aktsiz ishlarga akt qorala', obyekt:ob}),null,2));
}
