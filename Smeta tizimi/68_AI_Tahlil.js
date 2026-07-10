/******************************************************************
 * 68_AI_Tahlil.js — CHUQUR AI TAHLIL (anomaliya / prognoz / hisobot)
 * ==================================================================
 * ARXITEKTURA.md 5.1 tamoyili: RAQAM = kod/matematika (LLM EMAS),
 * IZOH/TAVSIYA = Gemini. Shu yerda aniq shunday:
 *   - Prognoz raqamlari (tugash sana, sur'at, byudjet) — KOD hisoblaydi.
 *   - Anomaliya invariantlari — kod/Supabase aniqlaydi.
 *   - Gemini faqat tushuntiradi, ustuvorlaydi, tavsiya beradi.
 *
 * Kirish nuqtalari:
 *   apiAiAnomaliya(obyekt)  -> nazorat buzilishlari + AI izoh/ustuvorlik
 *   apiAiPrognoz(obyekt)    -> tugash sana/byudjet (kod) + AI talqin
 *   apiAiHisobot(obyekt)    -> RAHBAR uchun to'liq AI hisobot (hammasi birga)
 *
 * Yadro: 66_AI_Data.js (_aiGen, _aiSbGet, _aiPul, _aiN, GEMINI_MODEL).
 * Ma'lumot: apiBossObyekt (KPI+oylar), apiAktCoverage, Supabase anomaliya.
 ******************************************************************/

/* ══════════════════════════════════════════════════════════════
 * 1) ANOMALIYA — nazorat invariantlari buzilishi + AI izoh
 * ══════════════════════════════════════════════════════════════ */
function apiAiAnomaliya(obyekt){
  try{
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(!_aiKey()) return { text:'Gemini API kaliti kerak (setkey:KALIT).', intent:'setup' };

    var an = _aiAnomOl(obyekt);  // [{qoida,tavsif,qiymat,daraja}]
    if(!an.length) return { text:'✅ **'+obyekt+'**: nazorat invariantlari bo\'yicha anomaliya topilmadi.', soni:0 };

    // daraja bo'yicha tartiblash (kritik birinchi)
    var rank={kritik:0,xato:1,ogohlantirish:2};
    an.sort(function(a,b){ return (rank[a.daraja]||9)-(rank[b.daraja]||9); });

    var L=['OBYEKT: '+obyekt, 'Aniqlangan anomaliyalar ('+an.length+'):'];
    an.forEach(function(a){
      L.push('- ['+(a.daraja||'').toUpperCase()+'] '+a.qoida+': '+a.tavsif+(a.qiymat?(' (≈'+_aiPul(a.qiymat)+')'):''));
    });
    var sys =
      'Sen — qurilish moliyaviy nazoratchisisan. Senga obyektdagi NAZORAT INVARIANTLARI buzilishi (anomaliya) ro\'yxati beriladi.\n'+
      'Invariant ma\'nolari: F2>SMETA/FAKT>SMETA = smetadan oshib ketgan; F2>FAKT = bajarilmagan ishga akt; '+
      'OSTATKA<0 = qo\'shib yozish; KS2>DOGOVOR/TOLOV>DOGOVOR = overbilling/ortiqcha to\'lov; '+
      'YASHIRIN_AKT_YOQ = yashirin ishga akt yo\'q; NARX_TOPILMAGAN = narx kiritilmagan.\n'+
      'QOIDALAR:\n1. O\'zbek tilida, qisqa (220 so\'z).\n2. Avval ENG XAVFLISINI ayt (kritik), nima va nega xavfli.\n'+
      '3. Har biriga 1 qator amaliy yechim.\n4. Markdown: **qalin**, - ro\'yxat. Son o\'ylab chiqarma.';
    var ans=_aiGen(sys, L.join('\n'), { temp:0.25, maxTok:1100 });
    return { text:ans, intent:'ANOMALIYA', soni:an.length, kritik:an.filter(function(x){return x.daraja==='kritik';}).length };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* Anomaliyani olish: avval Supabase (tayyor skaner natijasi), bo'lmasa lokal qayta hisob */
function _aiAnomOl(obyekt){
  // A) Supabase anomaliya jadvali (supabaseAnomaliyaPush yozgan)
  if(typeof _sbBor==='function' && _sbBor()){
    var rows=_aiSbGet('anomaliya','obyekt=eq.'+encodeURIComponent(obyekt)+'&select=qoida,tavsif,qiymat,daraja&limit=50');
    if(rows && rows.length) return rows;
  }
  // B) Lokal minimal qayta hisob (apiBossObyekt + apiAktCoverage)
  var out=[];
  try{
    var t=(apiBossObyekt(obyekt).total)||{};
    var sm=_aiNum(t.res), fk=_aiNum(t.fakt), f2=_aiNum(t.f2), ost=_aiNum(t.ost);
    if(sm>0 && f2>sm*1.001) out.push({qoida:'F2>SMETA',tavsif:'Ф2 smetadan oshgan',qiymat:f2-sm,daraja:'kritik'});
    if(sm>0 && fk>sm*1.001) out.push({qoida:'FAKT>SMETA',tavsif:'ФАКТ smetadan oshgan',qiymat:fk-sm,daraja:'xato'});
    if(f2>fk*1.001) out.push({qoida:'F2>FAKT',tavsif:'Olinmagan ishga Ф2',qiymat:f2-fk,daraja:'xato'});
    if(ost<-1) out.push({qoida:'OSTATKA<0',tavsif:'Qoldiq manfiy',qiymat:ost,daraja:'xato'});
  }catch(e){}
  try{
    if(typeof apiAktCoverage==='function'){
      var c=apiAktCoverage(obyekt).stats||{};
      if(c.yashirinAktsiz>0) out.push({qoida:'YASHIRIN_AKT_YOQ',tavsif:c.yashirinAktsiz+' ta yashirin ishda akt yo\'q',qiymat:c.yashirinAktsiz,daraja:'ogohlantirish'});
    }
  }catch(e){}
  return out;
}

/* ══════════════════════════════════════════════════════════════
 * 2) PROGNOZ — RAQAM koddan, talqin AI'dan
 * ══════════════════════════════════════════════════════════════ */
function apiAiPrognoz(obyekt){
  try{
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(!_aiKey()) return { text:'Gemini API kaliti kerak (setkey:KALIT).', intent:'setup' };

    var p = _aiPrognozHisob(obyekt);   // sof matematik prognoz
    if(p.error) return { text:'Prognoz uchun yetarli ma\'lumot yo\'q: '+p.error };

    var L=[];
    L.push('OBYEKT: '+obyekt);
    L.push('Smeta: '+_aiPul(p.smeta)+' | Bajarilgan(fakt): '+_aiPul(p.fakt)+' ('+p.progress+'%) | Ф2: '+_aiPul(p.f2)+' ('+p.f2pct+'%) | Qolgan: '+_aiPul(p.ost));
    L.push('Oxirgi oylar Ф2 sur\'ati (oylik): '+(p.oylarText||'-'));
    L.push('Hisoblangan o\'rtacha oylik sur\'at: '+_aiPul(p.velocity)+'/oy');
    L.push('Matematik prognoz: qolgan ish ~'+p.oyQoldi+' oyda tugaydi -> taxminiy tugash: '+(p.tugashSana||'aniqlanmadi'));
    if(p.f2Orqada) L.push('⚠️ Ф2 olish FAKTdan ancha orqada (hujjatlashtirish kechikyapti).');

    var sys =
      'Sen — qurilish loyiha tahlilchisisan. Senga KOD HISOBLAGAN aniq prognoz raqamlari beriladi.\n'+
      'QOIDALAR:\n1. Raqamlarni O\'ZGARTIRMA, yangi son O\'YLAB CHIQARMA — faqat berilganini talqin qil.\n'+
      '2. O\'zbek tilida, qisqa (200 so\'z): tugash muddati real-mi, sur\'at yetarli-mi, qanday xavf bor.\n'+
      '3. Ф2 fakt orqada bo\'lsa — hujjat/pul oqimiga ta\'sirini ayt.\n4. 2-3 tavsiya. Markdown: **qalin**, - ro\'yxat.';
    var ans=_aiGen(sys, L.join('\n'), { temp:0.3, maxTok:900 });
    return { text:ans, intent:'PROGNOZ', prognoz:p };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* Sof matematik prognoz (LLM yo'q) */
function _aiPrognozHisob(obyekt){
  var b;
  try{ b=apiBossObyekt(obyekt); }catch(e){ return {error:String(e.message||e)}; }
  var t=b.total||{};
  var smeta=_aiNum(t.res), fakt=_aiNum(t.fakt), f2=_aiNum(t.f2), ost=_aiNum(t.ost);
  var progress=_aiNum(t.progress), f2pct=_aiNum(t.f2pct);
  if(smeta<=0) return {error:'smeta 0'};

  // oylik F2 sur'ati — oxirgi 3 ta noldan katta oy o'rtachasi
  var oylar=(b.oylar||[]).map(function(o){ return {oy:o.oy, val:_aiNum(o.val)}; });
  var pos=oylar.filter(function(o){ return o.val>0; });
  var son=pos.length;
  var oxirgi=pos.slice(-3);
  var velocity = oxirgi.length ? Math.round(oxirgi.reduce(function(s,o){return s+o.val;},0)/oxirgi.length) : 0;
  var oyText = oylar.slice(-4).map(function(o){ return o.oy+':'+_aiPul(o.val); }).join(', ');

  // qolgan ishni necha oyda tugatadi (sur'at orqali)
  var oyQoldi = velocity>0 ? Math.ceil(ost/velocity) : 0;
  var tugashSana='';
  if(oyQoldi>0 && oyQoldi<240){
    var dt=new Date(); dt.setMonth(dt.getMonth()+oyQoldi);
    tugashSana=Utilities.formatDate(dt,'Asia/Tashkent','yyyy-MM (MMMM)');
  }
  // Ф2 faktdan ancha orqadami (10%+ farq)
  var f2Orqada = (fakt>0 && f2 < fakt*0.9);

  return {
    smeta:smeta, fakt:fakt, f2:f2, ost:ost, progress:progress, f2pct:f2pct,
    velocity:velocity, oyQoldi:oyQoldi, tugashSana:tugashSana,
    oylarText:oyText, oySoni:son, f2Orqada:f2Orqada
  };
}

/* ══════════════════════════════════════════════════════════════
 * 3) RAHBAR HISOBOTI — KPI + qoplash + anomaliya + prognoz birga
 * ══════════════════════════════════════════════════════════════ */
function apiAiHisobot(obyekt){
  try{
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(!_aiKey()) return { text:'Gemini API kaliti kerak (setkey:KALIT).', intent:'setup' };

    var L=['OBYEKT: '+obyekt];
    // KPI
    try{ var t=(apiBossObyekt(obyekt).total)||{};
      L.push('KPI: smeta '+_aiPul(t.res)+', fakt '+_aiPul(t.fakt)+' ('+_aiNum(t.progress)+'%), Ф2 '+_aiPul(t.f2)+' ('+_aiNum(t.f2pct)+'%), qolgan '+_aiPul(t.ost));
    }catch(e){}
    // Akt qoplash
    try{ if(typeof apiAktCoverage==='function'){ var c=apiAktCoverage(obyekt).stats||{};
      L.push('Akt qoplash: '+(c.foiz||0)+'% ('+(c.qoplangan||0)+'/'+(c.jami||0)+'), AKTSIZ yashirin: '+(c.yashirinAktsiz||0));
    }}catch(e){}
    // Prognoz
    var p=_aiPrognozHisob(obyekt);
    if(!p.error){ L.push('Prognoz: sur\'at '+_aiPul(p.velocity)+'/oy, ~'+p.oyQoldi+' oy, tugash '+(p.tugashSana||'?')); }
    // Anomaliya
    var an=_aiAnomOl(obyekt);
    if(an.length){ L.push('Anomaliyalar ('+an.length+'): '+an.slice(0,8).map(function(a){return a.qoida;}).join(', ')); }
    else L.push('Anomaliya: yo\'q ✅');

    var sys =
      'Sen — qurilish loyiha RAHBARI uchun ishonchli hisobot tayyorlovchi tahlilchisisan.\n'+
      'Senga bitta obyektning KPI, akt qoplash, prognoz va anomaliya ma\'lumoti beriladi.\n'+
      'QOIDALAR:\n1. O\'zbek tilida, RAHBARGA mos: qisqa, aniq, harakatga chorlovchi (250 so\'z).\n'+
      '2. Tuzilma: **Holat** (1-2 gap) -> **Xavflar** (- ro\'yxat) -> **Tavsiyalar** (- 3 ta).\n'+
      '3. Berilgan raqamlardan foydalaning, yangi son o\'ylab chiqarmang. Eng muhim raqam **qalin**.';
    var ans=_aiGen(sys, L.join('\n'), { temp:0.3, maxTok:1200, model:GEMINI_MODEL });
    return { text:ans, intent:'HISOBOT' };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* ── Test ── */
function aiTahlilTest(){
  var obs=(typeof papkaSkan==='function')?papkaSkan():[];
  var ob=obs.length?obs[0].obyekt:'';
  Logger.log(JSON.stringify(apiAiHisobot(ob),null,2));
}
