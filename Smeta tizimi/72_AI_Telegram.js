/******************************************************************
 * 72_AI_Telegram.js — SMETA: PROAKTIV AI (Telegram push + NL savol)
 * ==================================================================
 * AI endi faqat "so'rasang javob" emas — O'ZI XABAR BERADI:
 *   1) tgAiKunlik()  — har kuni 08:00 AI digest (portfel + anomaliya +
 *      akt kerak) barcha adminlarga yuboriladi.
 *   2) tgAiOgohlantirish() — KRITIK anomaliya bo'lsa darhol ogohlantirish.
 *   3) tgAiJavob(chatId, text) — botda tabiiy tilda grounded savol-javob
 *      (apiSmetaSavol). Bunga ulanish uchun 40_Telegram.js ga 2 qator (pastda).
 *
 * Yadro: 40_Telegram.js (_tgSend,_tgToken,_tgAdmins), 71_AI_Savol.js
 *   (apiSmetaSavol), 68_AI_Tahlil.js (_aiAnomOl), 45_Hujjatlar.js (apiAktCoverage).
 ******************************************************************/

/* ── Markdown -> Telegram HTML ── */
function _tgMd(s){
  s = String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/^#+\s*/gm,'').replace(/^- /gm,'• ');
}

/* ══════════════════════════════════════════════════════════════
 * 1) KUNLIK AI DIGEST (proaktiv)
 * ══════════════════════════════════════════════════════════════ */
function tgAiKunlik(){
  var admins = (typeof _tgAdmins==='function') ? _tgAdmins() : [];
  if(!admins.length){ Logger.log('tgAiKunlik: admin yo\'q'); return; }
  var matn = _aiKunlikMatn();
  admins.forEach(function(id){ try{ _tgSend(id, matn); }catch(e){ Logger.log('tgAiKunlik send: '+e); } });
  return 'yuborildi: '+admins.length+' admin';
}

function _aiKunlikMatn(){
  var sana = Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy');
  // 1) Grounded raqamlar (kod) yig'amiz
  var L = [], kritik = [], aktKerak = [];
  try{
    var d = apiBossData(), j = d.jami||{};
    L.push('JAMI: smeta '+_tgMln(j.smeta)+', fakt '+_tgMln(j.fakt)+' ('+(j.progress||0)+'%), Ф2 '+_tgMln(j.f2)+' ('+(j.f2pct||0)+'%)');
    (d.objects||[]).forEach(function(o){
      var line = o.nom+': '+(o.progress||0)+'% fakt, Ф2 '+(o.f2pct||0)+'%';
      // anomaliya + akt qoplash (grounded)
      try{ if(typeof _aiAnomOl==='function'){ var an=_aiAnomOl(o.nom);
        var kr=an.filter(function(a){return a.daraja==='kritik';});
        if(kr.length){ kritik.push(o.nom+': '+kr.map(function(a){return a.qoida;}).join(', ')); line+=' ⚠️'+an.length; }
      } }catch(e){}
      try{ if(typeof apiAktCoverage==='function'){ var c=apiAktCoverage(o.nom).stats||{};
        if(c.yashirinAktsiz>0){ aktKerak.push(o.nom+': '+c.yashirinAktsiz+' ta'); }
      } }catch(e){}
      L.push('• '+line);
    });
  }catch(e){ L.push('(dashboard xato: '+(e.message||e)+')'); }

  // 2) AI qisqa xulosa (grounded — faqat shu raqamlardan)
  var aiXulosa = '';
  try{
    if(typeof _aiGen==='function' && typeof _aiKey==='function' && _aiKey()){
      var sys='Sen qurilish loyiha tahlilchisisan. Quyidagi KUNLIK ko\'rsatkichlardan RAHBAR uchun '+
        '3-4 qatorli qisqa xulosa yoz (o\'zbekcha): asosiy holat, eng katta xavf, bugun nimaga e\'tibor. '+
        'Faqat berilgan raqamlardan foydalan, son o\'ylab chiqarma.';
      aiXulosa = _aiGen(sys, L.join('\n')+(kritik.length?('\nKRITIK: '+kritik.join('; ')):'')+(aktKerak.length?('\nAKT KERAK: '+aktKerak.join('; ')):''), {temp:0.3, maxTok:500});
    }
  }catch(e){}

  var t = '🗓 <b>KUNLIK AI HISOBOT</b> — '+sana+'\n\n';
  if(aiXulosa) t += '🤖 '+_tgMd(aiXulosa)+'\n\n';
  t += '<b>Ko\'rsatkichlar:</b>\n'+_tgMd(L.join('\n'))+'\n';
  if(kritik.length) t += '\n🚨 <b>KRITIK:</b>\n'+_tgMd(kritik.map(function(x){return '• '+x;}).join('\n'))+'\n';
  if(aktKerak.length) t += '\n📝 <b>Akt kerak (aktsiz yashirin ish):</b>\n'+_tgMd(aktKerak.map(function(x){return '• '+x;}).join('\n'))+'\n';
  t += '\n💬 Savol bering: shu chatga yozing (masalan: "M200 beton qancha ishlatilgan?")';
  return t;
}

/* ══════════════════════════════════════════════════════════════
 * 2) KRITIK OGOHLANTIRISH (darhol) — istalgan paytda chaqirish mumkin
 * ══════════════════════════════════════════════════════════════ */
function tgAiOgohlantirish(){
  var admins=(typeof _tgAdmins==='function')?_tgAdmins():[]; if(!admins.length) return;
  var bor=[];
  try{
    var d=apiBossData();
    (d.objects||[]).forEach(function(o){
      try{ var an=(typeof _aiAnomOl==='function')?_aiAnomOl(o.nom):[];
        an.filter(function(a){return a.daraja==='kritik';}).forEach(function(a){ bor.push(o.nom+' — '+a.qoida+': '+a.tavsif); });
      }catch(e){}
    });
  }catch(e){}
  if(!bor.length) return 'kritik yo\'q';
  var t='🚨 <b>KRITIK ANOMALIYA</b>\n\n'+_tgMd(bor.slice(0,15).map(function(x){return '• '+x;}).join('\n'));
  admins.forEach(function(id){ try{ _tgSend(id,t); }catch(e){} });
  return 'yuborildi';
}

/* ══════════════════════════════════════════════════════════════
 * 3) BOTDA TABIIY TIL SAVOL-JAVOB (grounded)
 *    40_Telegram.js _tgOnMessage ga ulang (pastdagi 2 qator).
 * ══════════════════════════════════════════════════════════════ */
function tgAiJavob(chatId, text){
  try{
    var r = (typeof apiSmetaSavol==='function')
      ? apiSmetaSavol({text:text})
      : { text:'apiSmetaSavol (71_AI_Savol.js) yuklanmagan.' };
    _tgSend(chatId, '🤖 '+_tgMd(r.text||'(javob yo\'q)'));
  }catch(e){ try{ _tgSend(chatId, '❌ '+(e.message||e)); }catch(_){} }
}

/* ══════════════════════════════════════════════════════════════
 * TRIGGER — har kuni 08:00 AI digest
 * ══════════════════════════════════════════════════════════════ */
function tgAiTriggerOrnat(){
  tgAiTriggerOchir();
  ScriptApp.newTrigger('tgAiKunlik').timeBased().everyDays(1).inTimezone('Asia/Tashkent').atHour(8).create();
  var m='✅ Kunlik AI digest trigger o\'rnatildi (08:00, tgAiKunlik)';
  try{ SpreadsheetApp.getUi().alert(m); }catch(e){}
  return m;
}
function tgAiTriggerOchir(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if(t.getHandlerFunction()==='tgAiKunlik') ScriptApp.deleteTrigger(t); });
}

function tgAiTest(){ Logger.log(_aiKunlikMatn()); }
