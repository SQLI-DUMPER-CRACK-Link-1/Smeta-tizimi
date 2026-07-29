/******************************************************************
 * 3b_Viborka_AI_Pro.js — VIBORKA: AI TA'MINOT REJASI + ANTI-FRAUD
 * ==================================================================
 * 1b_TitanChat_AI.js savol-javob qo'shgan edi. Bu fayl Viborka'ni
 * KUCHAYTIRADI — ikkita amaliy AI vazifa:
 *   1) vibAiZayavka() — DEFITSITNI qiymat bo'yicha ustuvorlab, zudlik
 *      bilan nima buyurtma qilish kerakligi (ta'minot/zayavka rejasi).
 *   2) vibAiFirib()   — ANTI-FRAUD: kelgan > kerak, manfiy qoldiq,
 *      shubhali zamena, narx/summa nomuvofiqligi -> AI izohlaydi.
 *
 * Manba: 'Nazorat' (Материал·Бирлик·План·Қабул·Нарх·Сумма·Қолдиқ·...).
 * Yadro: 1b_TitanChat_AI.js (_vibAiGen, _vibNumSafe, GEMINI_MODEL).
 ******************************************************************/

function _vibNazoratOqi(){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var sh=ss.getSheetByName('Nazorat');
  if(!sh || sh.getLastRow()<2) return [];
  var n=sh.getLastRow()-1;
  var v=sh.getRange(2,1,n,14).getValues();
  var rows=[];
  for(var i=0;i<n;i++){
    var nom=String(v[i][1]||'').trim(); if(!nom) continue;
    rows.push({
      nom:nom, bir:String(v[i][2]||''),
      plan:_vibNumSafe(v[i][3]), qabul:_vibNumSafe(v[i][4]),
      narx:_vibNumSafe(v[i][5]), summa:_vibNumSafe(v[i][6]),
      qoldiq:_vibNumSafe(v[i][7]),
      sana:String(v[i][9]||''), postavshik:String(v[i][10]||'').trim(),
      holat:String(v[i][12]||'').trim(), zamena:String(v[i][13]||'').trim()
    });
  }
  return rows;
}
function _vibPul2(n){ n=_vibNumSafe(n); if(Math.abs(n)>=1e9)return (n/1e9).toFixed(2)+' mlrd'; if(Math.abs(n)>=1e6)return (n/1e6).toFixed(1)+' mln'; return Math.round(n).toLocaleString()+' so\'m'; }
function _vibN2(n){ n=_vibNumSafe(n); return (Math.round(n*100)/100).toLocaleString(); }

/* ══════════════════════════════════════════════════════════════
 * 1) TA'MINOT REJASI (zayavka) — defitsitni ustuvorlab
 * ══════════════════════════════════════════════════════════════ */
function vibAiZayavka(){
  try{
    if(typeof _vibAiKey==='function' && !_vibAiKey()) return {text:'Gemini kaliti kerak (setkey:KALIT).'};
    var rows=_vibNazoratOqi();
    if(!rows.length) return {text:'Nazorat jadvali bo\'sh.'};
    // defitsit (qoldiq>0) — qiymat bo'yicha (deficit*narx) saralash
    var def=rows.filter(function(r){ return r.qoldiq>0; })
      .map(function(r){ r._qiymat=r.qoldiq*(r.narx||0); return r; })
      .sort(function(a,b){ return b._qiymat-a._qiymat; });
    if(!def.length) return {text:'✅ Defitsit yo\'q — barcha material yetarli.', soni:0};

    var jamiQiymat=def.reduce(function(s,r){return s+r._qiymat;},0);
    var L=['DEFITSIT MATERIALLAR ('+def.length+' xil, taxminiy qiymat '+_vibPul2(jamiQiymat)+'):'];
    def.slice(0,45).forEach(function(r){
      L.push('• '+(r.nom.length>55?r.nom.slice(0,55)+'…':r.nom)+' ('+r.bir+'): kerak '+_vibN2(r.plan)+
        ', kelgan '+_vibN2(r.qabul)+', YETISHMAYDI '+_vibN2(r.qoldiq)+
        (r.narx?(' (~'+_vibPul2(r._qiymat)+')'):'')+(r.postavshik?(' | '+r.postavshik):''));
    });
    var sys='Sen — qurilish ta\'minot menejerisan. Senga defitsit materiallar (kerak/kelgan/yetishmaydi/qiymat) beriladi.\n'+
      'O\'zbek tilida AMALIY ta\'minot (zayavka) rejasini tuz:\n'+
      '1. ZUDLIK bilan buyurtma qilinadiganlar (eng katta qiymat/kritik) — birinchi.\n'+
      '2. Imkon bo\'lsa o\'xshash materiallarni guruhla (bitta postavshikdan).\n'+
      '3. Har pozitsiya: nomi, qancha kerak, taxminiy summa. Markdown jadval/ro\'yxat.\n'+
      'Faqat berilgan raqamlardan foydalan, son o\'ylab chiqarma. Qisqa (300 so\'z).';
    var ans=_vibAiGen(sys, L.join('\n'), {temp:0.25, maxTok:1600});
    return {text:ans, soni:def.length, qiymat:jamiQiymat};
  }catch(e){ return {text:'❌ '+(e.message||e), error:String(e.message||e)}; }
}

/* ══════════════════════════════════════════════════════════════
 * 2) ANTI-FRAUD — shubhali holatlar
 * ══════════════════════════════════════════════════════════════ */
function vibAiFirib(){
  try{
    if(typeof _vibAiKey==='function' && !_vibAiKey()) return {text:'Gemini kaliti kerak (setkey:KALIT).'};
    var rows=_vibNazoratOqi();
    if(!rows.length) return {text:'Nazorat jadvali bo\'sh.'};
    var flags=[];
    rows.forEach(function(r){
      // 1) kelgan kerakdan sezilarli ko'p (ortiqcha qabul)
      if(r.plan>0 && r.qabul > r.plan*1.05)
        flags.push({d:'kritik', t:'KELGAN > KERAK: '+r.nom+' — kerak '+_vibN2(r.plan)+', kelgan '+_vibN2(r.qabul)+' ('+_vibN2(r.qabul-r.plan)+' ortiqcha)'});
      // 2) manfiy qoldiq (xato/qo'shib yozish)
      if(r.qoldiq < -0.01)
        flags.push({d:'xato', t:'MANFIY QOLDIQ: '+r.nom+' — qoldiq '+_vibN2(r.qoldiq)});
      // 3) summa nomuvofiqligi (summa != qabul*narx)
      if(r.qabul>0 && r.narx>0){
        var kutilgan=r.qabul*r.narx;
        if(kutilgan>0 && Math.abs(r.summa-kutilgan) > kutilgan*0.1 && r.summa>0)
          flags.push({d:'ogohlantirish', t:'SUMMA NOMUVOFIQ: '+r.nom+' — yozilgan '+_vibPul2(r.summa)+', hisob (qabul×narx) '+_vibPul2(kutilgan)});
      }
      // 4) kelgan bor, narx yo'q (nazoratsiz kirim)
      if(r.qabul>0 && r.narx<=0)
        flags.push({d:'ogohlantirish', t:'NARXSIZ KIRIM: '+r.nom+' — kelgan '+_vibN2(r.qabul)+', narx kiritilmagan'});
      // 5) zamena (almashtirish) — ko'rib chiqish
      if(r.zamena)
        flags.push({d:'ogohlantirish', t:'ZAMENA: '+r.nom+' -> '+r.zamena+' (sababini tekshiring)'});
    });
    if(!flags.length) return {text:'✅ Shubhali holat topilmadi — material nazorati toza.', soni:0};
    var rank={kritik:0,xato:1,ogohlantirish:2};
    flags.sort(function(a,b){return (rank[a.d]||9)-(rank[b.d]||9);});
    var L=['SHUBHALI HOLATLAR ('+flags.length+'):'];
    flags.slice(0,40).forEach(function(f){ L.push('• ['+f.d.toUpperCase()+'] '+f.t); });
    var sys='Sen — qurilish material AUDITORI (anti-fraud)san. Senga material nazoratidagi shubhali holatlar beriladi.\n'+
      'O\'zbek tilida QISQA (220 so\'z): eng XAVFLISINI (kritik) birinchi ayt, nega xavfli (o\'g\'irlik/isrof/xato), '+
      'har biriga 1 qator tekshiruv/yechim. Markdown: **qalin**, - ro\'yxat. Son o\'ylab chiqarma.';
    var ans=_vibAiGen(sys, L.join('\n'), {temp:0.25, maxTok:1100});
    return {text:ans, soni:flags.length, kritik:flags.filter(function(x){return x.d==='kritik';}).length};
  }catch(e){ return {text:'❌ '+(e.message||e), error:String(e.message||e)}; }
}

/* Menyu/alert o'ramlari */
function vibAiZayavkaUI(){ var r=vibAiZayavka(); SpreadsheetApp.getUi().alert('📦 Ta\'minot rejasi', _vibClean(r.text), SpreadsheetApp.getUi().ButtonSet.OK); }
function vibAiFiribUI(){ var r=vibAiFirib(); SpreadsheetApp.getUi().alert('🕵️ Anti-fraud', _vibClean(r.text), SpreadsheetApp.getUi().ButtonSet.OK); }
function _vibClean(s){ return String(s||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^- /gm,'• ').replace(/^#+\s*/gm,''); }

function vibAiProTest(){ Logger.log(JSON.stringify({zayavka:vibAiZayavka(),firib:vibAiFirib()},null,2)); }
