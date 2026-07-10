/******************************************************************
 * 67_AI_Akt.js — CHUQUR AKT <-> SMETA AI KO'PRIGI
 * ==================================================================
 * Tizimda allaqachon DETERMINISTIK ko'prik bor (45_Hujjatlar.js):
 *   apiAktCoverage(obyekt)  — qoplash nazorati (yashirin ish / akt bor-yo'q)
 *   apiAktIshlar(obyekt)    — bajarilgan ishlar + aktBor bayrog'i
 *   apiAktSmetadan(o,v,q)   — smetadan akt maydonlari (work/material/progress/workKey)
 *   apiAktYoz(data)         — REYESTR ga akt yozadi (smetaRef bog'lanish bilan)
 *
 * Bu fayl ustiga AI QATLAMINI quradi — eng kuchli integratsiya:
 *   "FAKT bor, AKT yo'q" yashirin ishlarni topadi -> SMETADAN grounded
 *   ma'lumot bilan AI to'g'ri AOSR matnini yozadi -> inson tasdiqlaydi ->
 *   REYESTR ga yoziladi va smetaga avtomatik BOG'LANADI (workKey).
 *
 * AI raqam/materialni O'YLAB CHIQARMAYDI — hammasi smetadan keladi;
 * AI faqat AOSR formuliroqkasini (nom, material ro'yxati, izoh, sana) tozalaydi.
 *
 * Kirish nuqtalari (Panel.html / menyu):
 *   apiAiAktTahlil(obyekt)         -> qoplash tahlili (matn + raqamlar)
 *   apiAiAktDraft(obyekt, opt)     -> aktsiz yashirin ishlarga AI qoralama (preview)
 *   apiAiAktYoz(obyekt, drafts)    -> tasdiqlangan qoralamalarni REYESTR ga yozadi
 *
 * Model/AI yadrosi: 66_AI_Data.js (_aiGen, GEMINI_MODEL, _aiPul, _aiN).
 ******************************************************************/

/* ── Sozlama ── */
var AI_AKT_MAX_DRAFT = 12;   // bitta yugurishda nechta aktgacha qoralama (token nazorati)

/* ══════════════════════════════════════════════════════════════
 * 1) QOPLASH TAHLILI — qaysi bajarilgan ishlarda akt yo'q
 * ══════════════════════════════════════════════════════════════ */
function apiAiAktTahlil(obyekt){
  try{
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(typeof apiAktCoverage!=='function') return { error:'apiAktCoverage topilmadi (45_Hujjatlar.js kerak)' };
    if(!_aiKey()) return { text:'Gemini API kaliti kerak (chatda: setkey:KALIT).', intent:'setup' };

    var cov = apiAktCoverage(obyekt);
    var s = cov.stats || {};
    // aktsiz yashirin ishlar ro'yxati (eng muhim)
    var aktsiz = (cov.rows||[]).filter(function(r){ return r.yashirin && !r.aktBor; });
    var L = [];
    L.push('OBYEKT: '+obyekt);
    L.push('Bajarilgan ish (FAKT>0): '+(s.jami||0)+' | aktlangan: '+(s.qoplangan||0)+' ('+(s.foiz||0)+'%)');
    L.push('Yashirin ish: '+(s.yashirinJami||0)+' | AKTSIZ yashirin: '+(s.yashirinAktsiz||0)+' ⚠️');
    if(aktsiz.length){
      L.push('\nAKT KERAK BO\'LGAN YASHIRIN ISHLAR (top 25):');
      aktsiz.slice(0,25).forEach(function(r){
        L.push('- '+_aiNom(r.nom)+' ('+(r.birlik||'')+'): fakt '+_aiN(r.fakt)+(r.razdel?(' | razdel: '+r.razdel):''));
      });
    }
    var sys =
      'Sen — qurilish PTO hujjat nazoratchisisan. Senga obyektdagi bajarilgan ishlar va '+
      'AKT QOPLASHI statistikasi beriladi (yashirin ishlar uchun AOSR akti bo\'lishi shart).\n'+
      'QOIDALAR:\n1. Faqat o\'zbek tilida, qisqa (200 so\'z).\n'+
      '2. Avval umumiy holat (qoplash %), keyin XAVF: aktsiz yashirin ishlar nechta va nima uchun muhim (yuridik/moliyaviy).\n'+
      '3. 2-3 aniq tavsiya. Markdown: **qalin** raqamga, - ro\'yxat. Son o\'ylab chiqarma.';
    var ans = _aiGen(sys, L.join('\n'), { temp:0.25, maxTok:900 });
    return { text:ans, intent:'AKT_COVERAGE', stats:s, aktsizSoni:aktsiz.length };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* ══════════════════════════════════════════════════════════════
 * 2) AI QORALAMA — aktsiz yashirin ishlarga grounded AOSR (preview)
 * opt = { startDate?:'yyyy-mm-dd', faqatYashirin?:true, workKeys?:[...] }
 * ══════════════════════════════════════════════════════════════ */
function apiAiAktDraft(obyekt, opt){
  try{
    opt = opt || {};
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(typeof apiAktIshlar!=='function' || typeof apiAktSmetadan!=='function')
      return { error:'45_Hujjatlar.js funksiyalari topilmadi' };
    if(!_aiKey()) return { text:'Gemini API kaliti kerak (setkey:KALIT).', intent:'setup' };

    // 1) Nomzodlar: bajarilgan + akt yo'q (default — yashirin ishlar)
    var ishlar = (apiAktIshlar(obyekt).rows||[]).filter(function(r){ return !r.aktBor; });
    var faqatYashirin = (opt.faqatYashirin!==false);
    if(faqatYashirin) ishlar = ishlar.filter(function(r){ return r.yashirin; });
    if(opt.workKeys && opt.workKeys.length){
      var pick = {}; opt.workKeys.forEach(function(k){ pick[k]=1; });
      ishlar = ishlar.filter(function(r){ return pick[r.workKey]; });
    }
    if(!ishlar.length) return { text:'✅ Aktsiz '+(faqatYashirin?'yashirin ':'')+'ish topilmadi — hammasi qoplangan.', drafts:[], count:0 };
    ishlar = ishlar.slice(0, AI_AKT_MAX_DRAFT);

    // 2) Har ishga smetadan grounded ma'lumot (work/material/progress + workKey)
    var grounded = [];
    ishlar.forEach(function(r){
      try{
        var d = apiAktSmetadan(obyekt, r.varaq, r.qator);
        grounded.push({
          workKey: d.smetaRef || r.workKey,
          work: d.work || r.nom,
          material: d.material || '',
          progress: d.progress || (_aiN(r.fakt)+' '+(r.birlik||'')),
          razdel: r.razdel || ''
        });
      }catch(e){
        grounded.push({ workKey:r.workKey, work:r.nom, material:'', progress:(_aiN(r.fakt)+' '+(r.birlik||'')), razdel:r.razdel||'' });
      }
    });

    // 3) Boshlanish sanasi
    var base = Utilities.formatDate(new Date(),'Asia/Tashkent','dd.MM.yyyy');
    if(opt.startDate){ var p=String(opt.startDate).split('-'); if(p.length===3) base=p[2]+'.'+p[1]+'.'+p[0]; }

    // 4) AI: AOSR maydonlarini tozalaydi (raqam emas — matn/format)
    var sys =
      'Sen — qurilish Bosh muhandis yordamchisan. Senga SMETADAN olingan bajarilgan yashirin ishlar (work, material, hajm) beriladi.\n'+
      'Vazifa: har ish uchun AOSR (Акт освидетельствования скрытых работ) maydonlarini TOZA holatga keltir.\n'+
      'QAT\'IY QOIDALAR:\n'+
      '1. MATERIAL va ish nomini SMETADAN olingan ma\'lumotdan ol — yangi material O\'YLAB QO\'SHMA, hajm/GOST yozma.\n'+
      '2. Har ish uchun bitta obyekt: WORK_NAME (rus tilida toza расценка nomi), MATERIAL (smetadagi materiallar, hajmsiz), '+
      'PROGRESS (nimadan qilingani), NEXT_WORK (mantiqan keyingi ish), START_DATE/END_DATE (ketma-ket, '+base+' dan boshlab), DEVIATION:"Нет".\n'+
      '3. workKey ni O\'ZGARTIRMA — qaytaradigan har obyektda aynan kelgan workKey bo\'lsin (bog\'lanish uchun).\n'+
      '4. FAQAT JSON array qaytar, boshqa matn yo\'q. Til: nomlar ruscha (AOSR standarti).';
    var payload = JSON.stringify(grounded.map(function(g){
      return { workKey:g.workKey, work_in:g.work, material_in:g.material, hajm_in:g.progress, razdel:g.razdel };
    }));
    var raw = _aiGen(sys,
      'Ishlar (SMETADAN):\n'+payload+'\n\n'+
      'Har biri uchun JSON qaytar: '+
      '[{"workKey":"...","WORK_NAME":"...","MATERIAL":"...","PROGRESS":"...","NEXT_WORK":"...","START_DATE":"dd.MM.yyyy","END_DATE":"dd.MM.yyyy","DEVIATION":"Нет"}]',
      { temp:0.2, maxTok:2048, json:true });

    var arr;
    try{ arr = JSON.parse(raw); if(!Array.isArray(arr)) arr=[arr]; }
    catch(e){ return { error:'AI JSON formatini buzdi. Qayta urinib ko\'ring.' }; }

    // workKey -> grounded xarita (AI bermay qolsa to'ldirish uchun)
    var byKey={}; grounded.forEach(function(g){ byKey[g.workKey]=g; });
    var drafts = arr.map(function(a){
      var g = byKey[a.workKey] || {};
      return {
        workKey: a.workKey || g.workKey || '',
        work: a.WORK_NAME || g.work || '',
        material: a.MATERIAL || g.material || '',
        progress: a.PROGRESS || g.progress || '',
        nextWork: a.NEXT_WORK || '',
        start: a.START_DATE || base,
        end: a.END_DATE || base,
        deviation: a.DEVIATION || 'Нет'
      };
    }).filter(function(d){ return d.work && d.workKey; });

    var preview = '📝 **'+drafts.length+' ta akt qoralama tayyor** (tasdiqlasangiz REYESTR ga yoziladi va smetaga bog\'lanadi):\n\n'+
      drafts.map(function(d,i){
        return '**'+(i+1)+'. '+d.work+'**\n  📅 '+d.start+' — '+d.end+'\n  🧱 '+(d.material||'(material smetada yo\'q)')+'\n  ➡️ '+(d.nextWork||'-');
      }).join('\n\n');

    return { text:preview, drafts:drafts, count:drafts.length, preview:true, obyekt:obyekt };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* ══════════════════════════════════════════════════════════════
 * 3) YOZISH — tasdiqlangan qoralamalarni REYESTR ga (bog'lanish bilan)
 * drafts = apiAiAktDraft natijasidagi massiv
 * ══════════════════════════════════════════════════════════════ */
function apiAiAktYoz(obyekt, drafts){
  try{
    if(!obyekt) return { error:'Obyekt tanlanmagan' };
    if(!drafts || !drafts.length) return { error:'Qoralama yo\'q' };
    if(typeof apiAktYoz!=='function') return { error:'apiAktYoz topilmadi' };

    var num = _aiAktNextNum();
    var yozildi = [];
    drafts.forEach(function(d){
      num++;
      var res = apiAktYoz({
        num: num,
        work: d.work,
        obj: obyekt,
        material: d.material,
        progress: d.progress,
        start: d.start,
        end: d.end,
        status: 'IMPORTED_NEW',
        refs: d.workKey ? [d.workKey] : []   // <- smetaga BOG'LANISH (workKey)
      });
      if(res && res.ok) yozildi.push(num+'. '+d.work);
    });

    // Supabase'ga akt_ish bog'lanishini yangilash (bo'lsa)
    try{ if(typeof supabaseAktIshPush==='function') supabaseAktIshPush(); }catch(e){}
    try{ if(typeof _sbDirty==='function') _sbDirty(obyekt); }catch(e){}

    return {
      text:'✅ **'+yozildi.length+' ta akt REYESTR ga yozildi va smetaga bog\'landi!**\n\n'+yozildi.join('\n'),
      yozildi: yozildi.length
    };
  }catch(e){ return { error:String(e.message||e) }; }
}

/* ── Keyingi akt raqami (REYESTR dagi maksimaldan +1) ── */
function _aiAktNextNum(){
  try{
    if(typeof apiAktlarOl!=='function') return 0;
    var d = apiAktlarOl(0);
    var max = 0;
    (d.rows||[]).forEach(function(r){ var n=parseInt(r.num,10); if(!isNaN(n) && n>max) max=n; });
    return max;
  }catch(e){ return 0; }
}

/* ── Test ── */
function aiAktTest(){
  var obs = (typeof papkaSkan==='function') ? papkaSkan() : [];
  var ob = obs.length ? obs[0].obyekt : '';
  Logger.log('Test obyekt: '+ob);
  Logger.log(JSON.stringify(apiAiAktTahlil(ob), null, 2));
}
