/********************************************************************
 * 89d_FakturaTashxis.js — FAKTURA AI TASHXISI
 * ==================================================================
 * ⚡⚡⚡ 2026-08-13 (foydalanuvchi: «fakturalarni o'qish ishlamayapdi,
 * xatolari ko'p»).
 *
 * MUAMMO NEGA KO'RINMAYDI: `_parseFakturaVision` barcha xatoni
 * `catch` bilan yutib, `{items:[]}` qaytaradi. UI «tovar topilmadi»
 * deb ko'rsatadi — LEKIN haqiqiy sabab (kalit yaroqsizmi, model
 * yo'qmi, kvota tugadimi) HECH QAYERDA ko'rinmaydi.
 *
 * Bu fayl — SABABNI ochiq ko'rsatadigan tashxis qatlami:
 *   apiAiTezSinov()        — Gemini kaliti ISHLAYAPTIMI (1 urinish,
 *                            retry YO'Q, HTTP kodi va xato matni bilan)
 *   apiFakturaXatoLoglar() — «Xato_Oqilganlar» papkasidagi loglarni o'qiydi
 *   apiFakturaBittaSinov() — bitta faylni o'qib, TO'LIQ tashxis qaytaradi
 ********************************************************************/

/** Gemini kalitini BITTA urinishda tekshiradi (retry yo'q — darhol javob).
 *  aiFetchRaw 5 urinish × 2 model × backoff bilan 4.5 daqiqagacha osilib
 *  qolishi mumkin; bu funksiya aynan shu «osilish»ni chetlab o'tadi. */
function apiAiTezSinov(model){
  var natija = { model: model || 'gemini-2.5-flash' };
  try{
    var key = (typeof _aiGwKey === 'function') ? _aiGwKey() : '';
    if(!key) return { ok:false, sabab:'KALIT_YOQ',
      xabar:"GEMINI_API_KEY o'rnatilmagan. AI chatga «setkey: <kalit>» deb yuboring." };

    natija.kalitUzunligi = String(key).length;
    natija.kalitBoshi = String(key).slice(0,4);
    // Google Generative Language kalitlari odatda "AIza" bilan boshlanadi
    natija.kalitFormatiOdatiy = /^AIza/.test(String(key));

    var url = 'https://generativelanguage.googleapis.com/v1beta/models/'
              + natija.model + ':generateContent?key=' + key;
    var payload = { contents:[{ parts:[{ text:'Javob: OK' }] }],
                    generationConfig:{ temperature:0, maxOutputTokens:16 } };
    var t0 = Date.now();
    var resp = UrlFetchApp.fetch(url, { method:'post', contentType:'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions:true });
    natija.ms = Date.now() - t0;
    natija.httpKod = resp.getResponseCode();
    var tan = resp.getContentText() || '';

    if(natija.httpKod === 200){
      var j = {}; try{ j = JSON.parse(tan); }catch(e){}
      var t = '';
      try{ t = j.candidates[0].content.parts[0].text; }catch(e){}
      natija.ok = true;
      natija.javob = String(t||'').slice(0,120);
      natija.xabar = 'Gemini ISHLAYAPTI ('+natija.ms+' ms)';
      return natija;
    }

    natija.ok = false;
    natija.xatoTanasi = tan.slice(0, 500);
    if(natija.httpKod === 400 && /API key not valid|API_KEY_INVALID/i.test(tan)){
      natija.sabab = 'KALIT_YAROQSIZ';
      natija.xabar = "Gemini kaliti YAROQSIZ. Yangi kalit: aistudio.google.com/apikey "
                   + "→ AI chatga «setkey: AIza...» deb yuboring.";
    } else if(natija.httpKod === 403){
      natija.sabab = 'RUXSAT_YOQ';
      natija.xabar = 'Kalit mavjud, lekin Generative Language API yoqilmagan yoki '
                   + 'kalit boshqa loyihaga tegishli (HTTP 403).';
    } else if(natija.httpKod === 404){
      natija.sabab = 'MODEL_YOQ';
      natija.xabar = '«'+natija.model+'» modeli bu kalit uchun mavjud emas (HTTP 404). '
                   + 'Boshqa model nomini sinang.';
    } else if(natija.httpKod === 429){
      natija.sabab = 'KVOTA';
      natija.xabar = 'Kunlik/daqiqalik kvota tugagan (HTTP 429). Keyinroq urinib ko\'ring.';
    } else {
      natija.sabab = 'HTTP_'+natija.httpKod;
      natija.xabar = 'Gemini HTTP '+natija.httpKod+' qaytardi.';
    }
    return natija;
  }catch(e){
    natija.ok = false; natija.sabab = 'ISTISNO';
    natija.xabar = 'Tekshiruv xatosi: ' + String((e&&e.message)||e);
    return natija;
  }
}

/** «Xato_Oqilganlar» papkasidagi log fayllarni o'qiydi — AI aynan nima
 *  qaytarganini ko'rish uchun (nomi 'metr' bo'lib qolgan holatlar va crashlar). */
function apiFakturaXatoLoglar(limit){
  try{
    limit = parseInt(limit,10) || 10;
    var fp = null;
    try{ fp = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next()
                      .getFoldersByName('Xato_Oqilganlar').next(); }
    catch(e){ return {ok:false, xabar:'«Fakturalar/Xato_Oqilganlar» papkasi topilmadi'}; }

    var it = fp.getFiles(), out = [], n = 0;
    while(it.hasNext() && n < limit){
      var f = it.next();
      var nom = f.getName();
      var yozuv = { nom: nom, sana: Utilities.formatDate(f.getLastUpdated(),
                    Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'),
                    hajm: f.getSize(), tur: f.getMimeType() };
      // Faqat matn loglarini o'qiymiz (PDF/rasmlarni emas)
      if(/\.txt$/i.test(nom) || f.getMimeType() === 'text/plain'){
        try{ yozuv.matn = f.getBlob().getDataAsString('UTF-8').slice(0, 1500); }catch(e){}
      }
      out.push(yozuv); n++;
    }
    return {ok:true, soni: out.length, loglar: out};
  }catch(e){
    return {ok:false, xabar:'Loglarni o\'qish xatosi: '+String((e&&e.message)||e)};
  }
}

/** Yangi fakturalar papkasidan BITTA faylni olib, to'liq tashxis bilan o'qiydi.
 *  Xatoni YUTMAYDI — nima bo'lgani aniq qaytariladi.
 *  @param {string} faylNomi bo'sh bo'lsa — birinchi fayl olinadi */
function apiFakturaBittaSinov(faylNomi){
  var d = { qadamlar: [] };
  function q(nom, holat, izoh){ d.qadamlar.push({qadam:nom, ok:holat, izoh:izoh||''}); }
  try{
    // 1) Papka
    var yangi = null;
    try{
      var root = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next();
      yangi = root.getFoldersByName('Yangi').next();
      q('Papka topildi', true, 'Fakturalar/Yangi');
    }catch(e){
      q('Papka topildi', false, 'Fakturalar/Yangi topilmadi');
      return Object.assign(d, {ok:false, xabar:'«Fakturalar/Yangi» papkasi topilmadi'});
    }

    // 2) Fayl
    var f = null;
    if(faylNomi){
      var fi = yangi.getFilesByName(faylNomi);
      if(fi.hasNext()) f = fi.next();
    } else {
      var it = yangi.getFiles();
      if(it.hasNext()) f = it.next();
    }
    if(!f){ q('Fayl topildi', false, faylNomi||'(birinchi)');
            return Object.assign(d, {ok:false, xabar:'Fayl topilmadi'}); }
    d.fayl = { nom: f.getName(), tur: f.getMimeType(),
               hajmKb: Math.round(f.getSize()/1024) };
    q('Fayl topildi', true, d.fayl.nom+' ('+d.fayl.hajmKb+' KB, '+d.fayl.tur+')');

    // 3) AI kaliti — AVVAL tez tekshiramiz (osilib qolmaslik uchun)
    var sinov = apiAiTezSinov('gemini-2.5-flash');
    d.aiSinov = sinov;
    q('AI kaliti ishlaydi', !!sinov.ok, sinov.xabar);
    if(!sinov.ok) return Object.assign(d, {ok:false, xabar:'AI ishlamayapti: '+sinov.xabar});

    // 4) Vision bilan o'qish — xato YUTILMAYDI
    if(typeof _parseFakturaVision !== 'function'){
      q('Vision parser mavjud', false, '_parseFakturaVision topilmadi');
      return Object.assign(d, {ok:false, xabar:'_parseFakturaVision funksiyasi yo\'q'});
    }
    var t0 = Date.now();
    /* ⚡ INTERAKTIV: Cloudflare ~100s da uzadi, shuning uchun AI ga 70s
     * chegara qo'yamiz — «error code: 524» o'rniga aniq xabar chiqadi. */
    var r = _parseFakturaVision(f.getBlob(), f, { maxWaitMs: 70000 });
    d.oqishMs = Date.now() - t0;
    var items = (r && r.items) || [];
    d.aiXato = (r && r.xato) || '';
    q('Vision o\'qidi', items.length > 0,
      items.length ? (items.length + ' tovar topildi (' + d.oqishMs + ' ms)')
                   : ('tovar topilmadi (' + d.oqishMs + ' ms) — ' + (d.aiXato || 'sabab noma\'lum')));

    d.postavshik = (r && r.supplier) || '';
    d.tovarSoni = items.length;
    d.tovarlar = items.slice(0, 5);   // namuna

    // 5) Sifat tekshiruvi — AI tipik xatolari
    var ogohlar = [];
    var BIRLIKLAR = ['metr','dona','sht','kg','tonna','komplekt','litr','m3','kub. m.','м','шт','кг'];
    items.forEach(function(m, i){
      var nm = String(m.nomi||'').toLowerCase().trim();
      if(!nm) ogohlar.push((i+1)+'-qator: nomi BO\'SH');
      else if(BIRLIKLAR.indexOf(nm) >= 0) ogohlar.push((i+1)+'-qator: nomi o\'rniga BIRLIK yozilgan («'+m.nomi+'»)');
      if(!(Number(m.miqdori)>0)) ogohlar.push((i+1)+'-qator: miqdor 0 yoki yo\'q');
      if(!(Number(m.narxi)>0))   ogohlar.push((i+1)+'-qator: narx 0 yoki yo\'q');
      // Summa mosligi (tiyingacha emas — 1% dopusk)
      var kutilgan = (Number(m.miqdori)||0) * (Number(m.narxi)||0);
      var berilgan = Number(m.jamiNdsSiz)||0;
      if(kutilgan>0 && berilgan>0 && Math.abs(kutilgan-berilgan)/kutilgan > 0.01)
        ogohlar.push((i+1)+'-qator: miqdor×narx='+Math.round(kutilgan)+' lekin jamiNdsSiz='+Math.round(berilgan));
    });
    d.ogohlantirishlar = ogohlar.slice(0, 20);
    d.ogohSoni = ogohlar.length;
    q('Sifat tekshiruvi', ogohlar.length === 0,
      ogohlar.length ? (ogohlar.length+' ta muammo topildi') : 'muammo yo\'q');

    d.ok = items.length > 0;
    d.xabar = d.ok ? ('✓ '+items.length+' tovar o\'qildi'
                      + (ogohlar.length ? (', lekin '+ogohlar.length+' ta ogohlantirish bor') : ''))
                   : ('✗ Tovar o\'qilmadi — ' + (d.aiXato || 'AI javobi bo\'sh yoki formatga tushmadi'));
    return d;
  }catch(e){
    q('Kutilmagan xato', false, String((e&&e.message)||e));
    return Object.assign(d, {ok:false, xabar:'Tashxis xatosi: '+String((e&&e.message)||e),
                             stack: String((e&&e.stack)||'').slice(0,600)});
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiAiTezSinov = apiAiTezSinov;
  globalThis.apiFakturaXatoLoglar = apiFakturaXatoLoglar;
  globalThis.apiFakturaBittaSinov = apiFakturaBittaSinov;
}

/* ══════════════════════════════════════════════════════════════════
 * TIKLASH: «Xato_Oqilganlar» dagi fakturalarni «Yangi» ga qaytarish
 * ==================================================================
 * ⚡⚡⚡ 2026-08-13 HODISA: sinxronizatsiya ishga tushirilganda ~330 ta
 * SOG'LOM faktura xato papkasiga tushib qoldi. Sabab: Google zaxira
 * model `gemini-2.0-flash` ni o'chirgan + batch darajasidagi `catch`
 * bitta xatoda BUTUN 5 talik to'plamni xato papkasiga surardi.
 * Fayllar YO'QOLMAGAN — Drive'da turibdi. Bu funksiya ularni qaytaradi.
 *
 * @param {number} limit  bir chaqiruvda nechta fayl (default 200)
 * @param {boolean} loglarniOchir  _CRASH.txt / _AI_XatoLog.txt larni o'chirish
 * ══════════════════════════════════════════════════════════════════ */
function apiFakturaXatodanTikla(limit, loglarniOchir){
  try{
    limit = parseInt(limit,10) || 200;
    var root = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next();
    var xatoPap = root.getFoldersByName('Xato_Oqilganlar').next();
    var yangiPap = root.getFoldersByName('Yangi').next();

    var it = xatoPap.getFiles();
    var qaytarildi = 0, logOchirildi = 0, qoldi = 0;
    var t0 = Date.now();

    while(it.hasNext()){
      /* ⚡⚡⚡ 2026-08-16 CHEKSIZ TSIKL TUZATILDI (audit C11 — TASDIQLANDI).
       * Eski kod: `if(limit yetdi){ qoldi++; continue; }`
       * `continue` iteratorni SURMAYDI (`it.next()` chaqirilmaydi) —
       * `it.hasNext()` abadiy `true` qaytaradi va sikl cheksiz aylanadi.
       * `qoldi` ham millionlab oshib ketardi. Jarayon GAS ning 6 daqiqalik
       * limitida o'ldirilardi va foydalanuvchi «tiklash qotib qoldi» degan
       * holatga tushardi.
       * ENDI: limit yetganda sikldan CHIQAMIZ va qolganini SANAB qaytaramiz. */
      if(qaytarildi >= limit || (Date.now()-t0) > 4*60*1000){
        while(it.hasNext()){ it.next(); qoldi++; }   // qolganini sanaymiz
        break;
      }
      var f = it.next();
      var nom = f.getName();
      // Log fayllar — faktura emas
      if(/_CRASH\.txt$|_AI_XatoLog\.txt$|\.txt$/i.test(nom)){
        if(loglarniOchir){ try{ f.setTrashed(true); logOchirildi++; }catch(e){} }
        continue;
      }
      try{ f.moveTo(yangiPap); qaytarildi++; }catch(e){}
    }

    return {ok:true, qaytarildi:qaytarildi, logOchirildi:logOchirildi,
      xabar: qaytarildi + ' ta faktura «Yangi» papkasiga qaytarildi'
           + (logOchirildi ? (', ' + logOchirildi + ' ta log o\'chirildi') : '')
           + '. Qayta o\'qish uchun apiFakturaSinxTuzat() ni chaqiring.'};
  }catch(e){
    return {ok:false, xabar:'Tiklash xatosi: '+String((e&&e.message)||e)};
  }
}

/** Sinxronizatsiyani TO'XTATISH — barcha faktura triggerlarini o'chiradi. */
function apiFakturaSinxToxtat(){
  try{
    var n = 0, trs = ScriptApp.getProjectTriggers();
    for (var i = 0; i < trs.length; i++) {
      var h = trs[i].getHandlerFunction();
      if (h === 'apiFakturaAvtoSinx' || h === 'apiFakturaSinxAsosiy' || h === 'apiFakturaSinxDavom') {
        ScriptApp.deleteTrigger(trs[i]); n++;
      }
    }
    return {ok:true, ochirildi:n, xabar: n + ' ta faktura trigger o\'chirildi — sinxronizatsiya to\'xtadi'};
  }catch(e){ return {ok:false, xabar:String((e&&e.message)||e)}; }
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturaXatodanTikla = apiFakturaXatodanTikla;
  globalThis.apiFakturaSinxToxtat = apiFakturaSinxToxtat;
}
