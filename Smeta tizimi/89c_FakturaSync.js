/********************************************************************
 * 89c_FakturaSync.js - Fakturalarni Google Drive dan avto-sinxronizatsiya
 * ==================================================================
 * Bu tizim Fakturalar/Yangi papkasiga tushgan PDF/rasmlarni o'qiydi,
 * dublikatlarni tekshiradi va bazaga yozib o'z papkasiga uzatadi.
 ********************************************************************/

function fakturaSinxTriggerOrnat() {
  // Eski triggerlarni o'chirish
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    var handler = trs[i].getHandlerFunction();
    if (handler === 'apiFakturaAvtoSinx' || handler === 'apiFakturaSinxAsosiy' || handler === 'apiFakturaSinxDavom') {
      ScriptApp.deleteTrigger(trs[i]);
    }
  }
  // Har kuni kechasi soat 02:00 da ishlaydigan yangi trigger
  ScriptApp.newTrigger('apiFakturaSinxAsosiy').timeBased().everyDays(1).atHour(2).create();
  return {ok: true, xabar: "Sinxronizatsiya har kuni soat 02:00 ga sozlandi."};
}

/** ⚡⚡⚡ 2026-08-13: 340 ta faktura o'qilmay turgani ANIQLANDI. Sabab:
 *  o'rnatilgan trigger `apiFakturaAvtoSinx` (BAZA funksiya) edi — u bir
 *  ijroda 20 ta fayl ishlab TO'XTAYDI va o'zini davom ettirmaydi. Zanjirli
 *  `apiFakturaSinxAsosiy` → `apiFakturaSinxDavom` esa umuman ishlatilmagan.
 *  340 fayl kunlik trigger bilan ≈17 KUN olardi.
 *  Bu funksiya eski triggerni almashtirib, zanjirni DARHOL ishga tushiradi. */
function apiFakturaSinxTuzat(){
  try{
    var ochirildi = [];
    var trs = ScriptApp.getProjectTriggers();
    for (var i = 0; i < trs.length; i++) {
      var h = trs[i].getHandlerFunction();
      if (h === 'apiFakturaAvtoSinx' || h === 'apiFakturaSinxAsosiy' || h === 'apiFakturaSinxDavom') {
        ScriptApp.deleteTrigger(trs[i]); ochirildi.push(h);
      }
    }
    // Kunlik zanjirli trigger
    ScriptApp.newTrigger('apiFakturaSinxAsosiy').timeBased().everyDays(1).atHour(2).create();
    // Va darhol boshlaymiz (1 daqiqadan keyin, zanjir o'zi davom etadi)
    ScriptApp.newTrigger('apiFakturaSinxDavom').timeBased().after(60 * 1000).create();
    return {ok:true, ochirilgan: ochirildi,
      xabar: "Trigger tuzatildi: zanjirli sinxronizatsiya o'rnatildi va 1 daqiqada boshlanadi. "
           + "Har ijroda ~20 fayl, tugaguncha o'zi davom etadi."};
  }catch(e){ return {ok:false, xabar:String((e&&e.message)||e)}; }
}

function apiFakturaSinxAsosiy() {
  var res = apiFakturaAvtoSinx();
  if (res && res.ok && res.qolganFayllar > 0) {
    ScriptApp.newTrigger('apiFakturaSinxDavom').timeBased().after(1 * 60 * 1000).create();
  }
}

function apiFakturaSinxDavom() {
  // Eski bir martalik triggerlarni tozalash
  var trs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trs.length; i++) {
    if (trs[i].getHandlerFunction() === 'apiFakturaSinxDavom') {
      ScriptApp.deleteTrigger(trs[i]);
    }
  }

  var res = apiFakturaAvtoSinx();
  if (res && res.ok && res.qolganFayllar > 0) {
    ScriptApp.newTrigger('apiFakturaSinxDavom').timeBased().after(1 * 60 * 1000).create();
  }
}

function apiFakturaAvtoSinx() {
  var root = DriveApp.getRootFolder();
  var paps = root.getFoldersByName('Fakturalar');
  if (!paps.hasNext()) return; // Fakturalar papkasi yo'q
  var fakturalarPap = paps.next();

  var getOrCreateFolder = function(parent, name) {
    var f = parent.getFoldersByName(name);
    return f.hasNext() ? f.next() : parent.createFolder(name);
  };

  var yangiPap = getOrCreateFolder(fakturalarPap, 'Yangi');
  var arxivPap = getOrCreateFolder(fakturalarPap, 'Arxiv');
  var dubPap = getOrCreateFolder(fakturalarPap, 'Dublikatlar');
  var xatoPap = getOrCreateFolder(fakturalarPap, 'Xato_Oqilganlar');

  // Ierarxik qidiruv (chuqur izlash)
  var hammaFayllar = [];
  function _deepScan(folder) {
    if (hammaFayllar.length > 5000) return; // limit to prevent memory issue
    var iter = folder.getFiles();
    while (iter.hasNext()) hammaFayllar.push(iter.next());
    var sub = folder.getFolders();
    while (sub.hasNext()) _deepScan(sub.next());
  }
  _deepScan(yangiPap);

  /* ⚡⚡⚡ 2026-08-13 VAQT BYUDJETI (foydalanuvchi: «fakturalar ishlamayapdi»).
   * Hisob: har fayl ≈14.5s AI + 6s kutish = ~20.5s. 20 fayl = 410s, GAS
   * limiti esa 360s → ijro HAR DOIM yarmida o'lardi. Endi 4.5 daqiqada
   * toza to'xtaymiz va qolganini keyingi ijroga qoldiramiz. */
  var _t0 = Date.now();
  var VAQT_BYUDJET = 4.5 * 60 * 1000;
  function _vaqtTugadi(){ return (Date.now() - _t0) > VAQT_BYUDJET; }

  var limit = 20; // Har safar max 20 ta faylni ishlaymiz
  var count = 0;
  var vaqtBilanToxtadi = false;
  
  var existingData = apiFakturalarOl().fakturalar || [];
  var existingMap = {};
  for(var e = 0; e < existingData.length; e++){
     var it = existingData[e];
     if(it.fakturaRaqami && it.postavshik){
         existingMap[it.fakturaRaqami + '@@' + it.postavshik] = true;
     }
  }

  var yangiKiritmalar = [];
  var vaqtinchalikXato = 0;   // ⚡ AI bandligi sabab qoldirilgan fayllar
  var kochiriladi = [];   // ⚡ bazaga yozilgandan KEYIN ko'chiriladigan fayllar
  var batchSize = 5; // Fayllarni 5 tadan jamlab yuboramiz (API limitni tejash uchun)

  while (count < hammaFayllar.length && count < limit) {
    if (_vaqtTugadi()) { vaqtBilanToxtadi = true; break; }
    var batch = [];
    while (batch.length < batchSize && count < hammaFayllar.length && count < limit) {
      batch.push({
         id: "F" + count,
         file: hammaFayllar[count],
         blob: hammaFayllar[count].getBlob()
      });
      count++;
    }
    if (batch.length === 0) break;

    try {
      var _pb = _parseFakturaVisionBatch(batch);
      var parsedBatch = _pb.items || _pb;          // eski shakl bilan mos
      var parsedXato  = _pb.xatolar || {};         // {docId: xato matni}
      
      // Endi har bir faylni o'ziga tegishli papkaga jildiramiz
      for (var b = 0; b < batch.length; b++) {
         var fb = batch[b];
         var fileItems = parsedBatch.filter(function(x) { return x.docId === fb.id; });
         
         /* ⚡⚡⚡ 2026-08-13: avval o'qilmagan fayl DARHOL «Xato_Oqilganlar» ga
          * ko'chirilardi. Lekin sabab ko'pincha VAQTINCHALIK bo'ladi (Gemini
          * bandligi/429, model o'chirilgani) — bunday fayl aslida SOG'LOM.
          * U xato papkasiga ketsa boshqa QAYTA URINILMAYDI va abadiy yo'qoladi.
          * Jonli hodisa: zaxira model o'chirilgani sababli 10 ta sog'lom faktura
          * xato papkasiga tushdi. ENDI: vaqtinchalik xatoda fayl JOYIDA qoladi. */
         if (fileItems.length === 0 || !fileItems[0].nomi) {
             var sabab = (parsedXato[fb.id] || '').toLowerCase();
             var vaqtinchalik = !sabab || /band|limit|quota|429|no longer available|not found|timeout|kutish|deadline|500|503|unavailable/.test(sabab);
             if (vaqtinchalik) {
                 vaqtinchalikXato++;
                 continue;   // «Yangi» da qoladi — keyingi ijroda qayta urinadi
             }
             fb.file.moveTo(xatoPap);
             continue;
         }

         var isDup = false;
         for(var i=0; i<fileItems.length; i++){
            var it = fileItems[i];
            if(it.fakturaRaqami && it.postavshik){
                if(existingMap[it.fakturaRaqami + '@@' + it.postavshik]){
                    isDup = true;
                    break;
                }
            }
         }

         if (isDup) {
             fb.file.moveTo(dubPap);
         } else {
             var fpos = "Noma_lum";
             if(fileItems.length > 0) fpos = String(fileItems[0].postavshik || "Noma'lum").replace(/[<>:"\/\\|?*]/g, '_').trim();
             if(!fpos) fpos = "Noma_lum";

             for(var j=0; j<fileItems.length; j++){
                 var itm = fileItems[j];
                 itm.faylUrl = fb.file.getUrl();
                 delete itm.docId; // o'chiramiz
                 yangiKiritmalar.push(itm);
                 existingMap[itm.fakturaRaqami + '@@' + itm.postavshik] = true;
             }
             /* ⚡⚡⚡ 2026-08-13 MA'LUMOT YO'QOLISHI TUZATILDI: fayl SHU YERDA
              * darhol Arxivga ko'chirilardi, bazaga yozish esa BUTUN sikldan
              * KEYIN (pastda) edi. Ijro vaqt limitida o'lsa — fayl «Yangi»
              * papkasidan chiqib ketgan, lekin bazada YOZUV YO'Q → faktura
              * butunlay yo'qolardi va buni hech kim sezmasdi.
              * ENDI: ko'chirish bazaga yozilgandan KEYIN bajariladi. */
             kochiriladi.push({ file: fb.file, papka: fpos });
         }
      }
    } catch(err) {
      var msg = err.toString().toLowerCase();
      if(msg.indexOf('429') > -1 || msg.indexOf('quota') > -1 || msg.indexOf('too many requests') > -1 || msg.indexOf('limit') > -1) {
          Logger.log("API limit tushdi, to'xtatamiz.");
          break; // Keyingi triggerda davom etadi
      }
      Logger.log("Xato: " + err.toString());
      for (var k = 0; k < batch.length; k++) {
         try {
           xatoPap.createFile(batch[k].file.getName() + "_CRASH.txt", "=== XATO ===\n" + err.toString());
         } catch(e){}
         batch[k].file.moveTo(xatoPap);
      }
    }
  }

  /* ⚡ 1) AVVAL BAZAGA YOZAMIZ — fayllar hali «Yangi» papkasida turibdi.
   *    Yozish muvaffaqiyatsiz bo'lsa fayl JOYIDA qoladi va keyingi ijroda
   *    qayta urinib ko'riladi (yo'qolmaydi). */
  var yozilganSoni = 0, yozishXatosi = '';
  if(yangiKiritmalar.length > 0){
    try{
      var res = apiFakturaYoz(yangiKiritmalar);
      if(res && res.ok) yozilganSoni = res.soni || yangiKiritmalar.length;
      else yozishXatosi = (res && res.xabar) || 'apiFakturaYoz ok qaytarmadi';
    }catch(ey){ yozishXatosi = String((ey&&ey.message)||ey); }
  }

  /* ⚡ 2) FAQAT yozish muvaffaqiyatli bo'lgandagina fayllarni Arxivga surish
   *
   * ⚠️ 2026-08-17 (audit): bu tsiklda `catch(ek){}` — MUTLAQO JIM edi.
   * Ko'chirish yiqilsa (Drive ruxsati, papka o'chirilgan, kvota) fayl
   * «Янги» papkasida QOLADI. Pul ikki marta sanalmaydi — `existingMap`
   * dedupi ushlaydi — LEKIN fayl HAR IJRODA qaytadan o'qiladi va qaytadan
   * AI/OCR ga yuboriladi: bir marta ko'chmagan fayl umrbod har tsiklda
   * bekorga pul va vaqt sarflaydi, natijada esa 0 yangi qator qo'shadi.
   * Bunday «osilib qolgan» fayllar to'planib borsa sinx sekinlashadi va
   * sababi ko'rinmaydi (aynan shu «фактура ўқилмай туради» alomati).
   *
   * ENDI: xato logga yoziladi, sanaladi va NATIJAGA chiqadi — UI
   * «N файл архивга кўчмади» deb ko'rsata oladi. */
  var kochirildi = 0, kochmadi = 0, kochmaganlar = [];
  if(!yozishXatosi){
    for(var kc=0; kc<kochiriladi.length; kc++){
      var t = kochiriladi[kc];
      try{
        t.file.moveTo(getOrCreateFolder(arxivPap, t.papka));
        kochirildi++;
      }catch(ek){
        kochmadi++;
        var nm = ''; try{ nm = t.file.getName(); }catch(e2){}
        if(kochmaganlar.length < 10) kochmaganlar.push(nm);
        Logger.log('⚠️ Арxивга ко\'чмади: ' + nm + ' → ' + (ek && ek.message ? ek.message : ek));
      }
    }
  }

  var qolgan = hammaFayllar.length - count;
  var natija = { ok: !yozishXatosi, ishlanganFayllar: count,
                 yozilganQatorlar: yozilganSoni, kochirilganFayllar: kochirildi,
                 qolganFayllar: qolgan > 0 ? qolgan : 0,
                 vaqtBilanToxtadi: vaqtBilanToxtadi,
                 vaqtinchalikXato: vaqtinchalikXato,
                 davomiylikMs: Date.now() - _t0 };
  if(yozishXatosi){
    natija.xabar = 'Bazaga yozib bo\'lmadi — fayllar «Yangi» papkasida QOLDIRILDI '
                 + '(yo\'qolmadi, keyingi ijroda qayta urinadi): ' + yozishXatosi;
  }
  /* ⚠️ 2026-08-17 (audit): arxivga ko'chmagan fayllar NATIJAGA chiqariladi —
     ular «Янги» da qolib har ijroda bekorga qayta o'qiladi, shuning uchun
     bu jim o'tib ketmasligi kerak. */
  if(kochmadi > 0){
    natija.kochmaganFayllar = kochmadi;
    natija.kochmaganRoyxat  = kochmaganlar;
    natija.xabar = (natija.xabar ? natija.xabar + ' | ' : '') +
      '⚠️ ' + kochmadi + ' файл архивга кўчмади — улар «Янги» папкасида қолди ва ' +
      'ҳар ижрода қайта ўқилади. Drive рухсати/папкани текширинг: ' +
      kochmaganlar.slice(0, 5).join(', ');
  }
  /* ⚡ Oxirgi ijro natijasini saqlaymiz — UI «nega ishlamadi» ni ko'rsata olsin.
     ⚠️ 2026-08-17: bu yozuvning O'ZI jim edi — ya'ni «nega ishlamadi» ni
     ko'rsatish uchun saqlanayotgan ma'lumot ham jim yo'qolishi mumkin edi.
     Endi kamida logga tushadi. */
  try{
    PropertiesService.getScriptProperties()
      .setProperty('FAKTURA_OXIRGI_IJRO', JSON.stringify({
        sana: new Date().toISOString(), natija: natija }));
  }catch(e){
    Logger.log('⚠️ FAKTURA_OXIRGI_IJRO saqlanmadi — UI oxirgi ijro holatini ' +
               'ko\'rsatmaydi: ' + (e && e.message ? e.message : e));
  }
  return natija;
}

/** Oxirgi sinxronizatsiya ijrosi natijasi — UI'da ko'rsatish uchun. */
function apiFakturaOxirgiIjro(){
  try{
    var raw = PropertiesService.getScriptProperties().getProperty('FAKTURA_OXIRGI_IJRO');
    if(!raw) return {ok:true, bor:false, xabar:'Hali sinxronizatsiya ishlamagan'};
    return {ok:true, bor:true, malumot: JSON.parse(raw)};
  }catch(e){ return {ok:false, xabar:String((e&&e.message)||e)}; }
}

function apiFakturaDriveHolat() {
  try {
    var root = DriveApp.getRootFolder();
    var paps = root.getFoldersByName('Fakturalar');
    if (!paps.hasNext()) return { ok: false, xabar: "Fakturalar papkasi yo'q" };
    var fakturalarPap = paps.next();

    var getF = function(parent, name) {
      var f = parent.getFoldersByName(name);
      return f.hasNext() ? f.next() : parent.createFolder(name);
    };

    var pap1 = getF(fakturalarPap, 'Yangi');
    var pap2 = getF(fakturalarPap, 'Arxiv');
    var pap3 = getF(fakturalarPap, 'Dublikatlar');
    var pap4 = getF(fakturalarPap, 'Xato_Oqilganlar');

    var getCount = function(folder) {
      var count = 0;
      var files = folder.getFiles();
      while(files.hasNext()){ files.next(); count++; }
      return count;
    };

    return {
      ok: true,
      yangi: { count: getCount(pap1), url: pap1.getUrl() },
      arxiv: { count: getCount(pap2), url: pap2.getUrl() },
      dublikat: { count: getCount(pap3), url: pap3.getUrl() },
      xato: { count: getCount(pap4), url: pap4.getUrl() }
    };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}

/* @param {Object} opts {maxWaitMs} — INTERAKTIV chaqiruvda (foydalanuvchi
 * saytda kutib turibdi) MAJBURIY: Cloudflare so'rovni ~100s da uzadi, GAS
 * esa aiFetchRaw ichida 5 urinish × 2 model bilan 4.5 daqiqagacha osilib
 * qolishi mumkin → foydalanuvchi «error code: 524» ko'radi (jonli tasdiq).
 * Fon (trigger) chaqiruvlarida bo'sh qoldiriladi — u yerda 6 daqiqa bor. */
function _parseFakturaVision(blob, fileObj, opts) {
    opts = opts || {};
    var items = [];
    var supplier = '';
    var oxirgiXato = '';   // ⚡ sabab yutilmasin — chaqiruvchiga qaytariladi

    if (typeof aiFetchRaw === 'function') {
        try {
            var sys = "Sen qat'iy va bexato ishlaydigan Buxgalteriya AIsan. Berilgan hujjat PDF yoki Rasm ko'rinishidagi hisob-faktura / akt. Hujjat ko'p varaqli bo'lishi ham mumkin. Hamma varaqlardagi barcha ma'lumotlarni o'qi!\n\n" + 
                      "QAT'IY QOIDALAR:\n" +
                      "1. Hujjatdagi BARCHA tovar va xizmatlarni top. Bittasini ham o'tkazib yuborma!\n" +
                      "2. NOMI: Kirill va lotin harflarini xuddi hujjatdagidek yoz. DIQQAT JIDDIY QOIDA 1: Ba'zan PDF o'qiyotganda bir nechta mahsulot nomlari ketma-ket bitta blok/matn qilib yig'ilib qoladi (masalan: '17 Truba... 18 Tройник... 19...'), lekin ularning miqdori va narxi pastdagi qatorlarda alohida-alohida keladi. Bunday holatda O'SHA YIG'ILIB QOLGAN NOMLARNI bittalab ajratib, pastdagi raqamli qatorlarga (miqdor/narx) ketma-ket to'g'ri moslab ber! DIQQAT JIDDIY QOIDA 2: 'Oldi sotdi', 'O'z.ish.chiq.', 'Import', 'Chetdan keltirilgan' kabi so'zlar MAHSULOT NOMI EMAS! Ularni aslo nomi sifatida yozma! DIQQAT JIDDIY QOIDA 3: Hisob-fakturada ko'pincha 2 xil nom ustuni bo'ladi: 1) 'Махсулот номи (хизматлар)' va 2) '... миллий каталоги буйича...'. Sen 'nomi' maydoniga ALBATTA 1-ustundagi 'Махсулот номи' ni yozishing SHART, u eng asosiysi! 'katalogNomi' maydoniga esa 2-ustundagi katalog kodini yoki nomini yoz! Hech qachon ikkalasini bitta maydonga aralashtirma!\n" +
                      "3. BIRLIGI: 'metr', 'dona', 'kg', 'tonna', 'sht', 'komplekt', 'litr', 'm3', 'kub. m.' kabi so'zlar FAQAT Birlik! Ularni 'nomi' sifatida yozma!\n" +
                      "4. RAQAMLAR: Narx, miqdor va summalarni probelsiz, faqat toza son ko'rinishida yoz (masalan: 1250000.50).\n" +
                      "5. Barcha tovarlar bitta umumlashgan obyektga joylanishi shart. Har bir element quyidagi maydonlarga ega bo'lsin:\n" +
                      "   fakturaRaqami, kelganSana (dd.mm.yyyy formatida), postavshik (Sotuvchi nomi), postavshikInn (Sotuvchi STIR), postavshikManzil, sotibOluvchiInn (Xaridor STIR), sotibOluvchiManzil, shartnomaRaqami, shartnomaSanasi (dd.mm.yyyy), nomi, katalogNomi, birligi, miqdori, narxi, jamiNdsSiz, ndsSummasi, jamiNdsBilan, kategoriya.\n" +
                      "6. MUHIM QO'SHIMCHA: Agar foydalanuvchi hujjatni to'liq emas, faqat jadval qismini rasmga olgan bo'lsa (ya'ni Faktura raqami va Postavshik aniq ko'rinmasa), ularni bo'sh qoldirmasdan 'Noma\\'lum' deb yozib qo'y. Shunda tizim jadvalni xatosiz qabul qiladi.\n" +
                      "7. KATEGORIYA: Armatura, Beton, Sement, G'isht/Blok, Inert (Qum, Sheben), Kabel/Elektrika, Santexnika, Mixanizm, Asbob/Uskuna, Xizmat, Boshqa.\n" +
                      /* ⚡⚡⚡ 2026-08-13: quyidagi 4 qoida jonli sinovda topilgan
                       * xatolar asosida qo'shildi (Claude haqiqiy fakturalarni o'qib chiqdi). */
                      "8. SUMMA MANTIG'I (JUDA MUHIM — yuridik hujjat!): har bir qatorda\n" +
                      "   miqdori × narxi = jamiNdsSiz bo'lishi SHART. Agar hujjatdan o'qigan\n" +
                      "   raqamlaring bu tenglikni buzsa — QAYTA tekshirib chiq, chunki\n" +
                      "   ustunlarni chalkashtirgan bo'lasan. HECH QACHON raqamni o'zingdan\n" +
                      "   TO'QIB chiqarma; hujjatda ko'rinmasa 0 qoldir.\n" +
                      "9. NDS: jamiNdsBilan = jamiNdsSiz + ndsSummasi. O'zbekistonda NDS odatda\n" +
                      "   12%. Agar hujjatda NDS ko'rsatilmagan bo'lsa (НДСсиз/aktsiz faktura)\n" +
                      "   ndsSummasi=0 va jamiNdsBilan=jamiNdsSiz qilib qo'y — 12% ni O'ZING QO'SHMA.\n" +
                      "10. MIQDOR: kasr son bo'lishi mumkin (0.5 tonna, 12.75 m3). Kirill/lotin\n" +
                      "   vergulini (1 234,56) nuqtaga aylantir (1234.56). Ming ajratgichni\n" +
                      "   (probel yoki apostrof) OLIB TASHLA.\n" +
                      "11. SANA: hujjatdagi sanani dd.mm.yyyy ga keltir. '08.05.2026' -> shundayligicha.\n" +
                      "   '8 май 2026' -> '08.05.2026'. Sana topilmasa BO'SH qoldir, bugungi sanani QO'YMA.\n\n" +
                      "QAYTARISH FORMATI: Sening javobing qat'iy ravishda quyidagi JSON sxemasida bo'lishi shart:\n" +
                      "{\n" +
                      "  \"items\": [\n" +
                      "    { \"nomi\": \"...\", \"katalogNomi\": \"...\", \"birligi\": \"...\", \"miqdori\": 1.0, \"narxi\": 1000 ... }\n" +
                      "  ]\n" +
                      "}\n" +
                      "Boshqa hech qanday izoh yozma!";

            var base64 = Utilities.base64Encode(blob.getBytes());
            var mime = blob.getContentType() || 'application/pdf';
            var payload = {
                contents: [{
                    parts: [
                        { text: sys + "\n\nUshbu hujjatni tahlil qilib, tovarlarni JSON formatida qaytar." },
                        { inlineData: { mimeType: mime, data: base64 } }
                    ]
                }],
                generationConfig: {
                    responseMimeType: "application/json",
                    temperature: 0.1
                }
            };

            var aiOpts = {};
            if (opts.maxWaitMs > 0) aiOpts.maxWaitMs = opts.maxWaitMs;
            var res = aiFetchRaw('gemini-2.5-flash', payload, aiOpts);
            if (res && res.text) {
                var jsonStr = res.text.trim();
                if(jsonStr.indexOf('```') !== -1) {
                    jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                var rawObj = JSON.parse(jsonStr);
                var arr = Array.isArray(rawObj) ? rawObj : (rawObj.items || rawObj.tovarlar || []);
                
                if (Array.isArray(arr) && arr.length > 0) {
                    var xatoBormi = false;
                    for(var k=0; k<arr.length; k++){
                        var nomiTest = String(arr[k].nomi||'').toLowerCase().trim();
                        if(nomiTest === 'metr' || nomiTest === 'dona' || nomiTest === 'sht' || nomiTest === 'kg') {
                            xatoBormi = true; break;
                        }
                    }
                    if(xatoBormi && fileObj) {
                        try {
                           var xp = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next().getFoldersByName('Xato_Oqilganlar').next();
                           xp.createFile(fileObj.getName() + "_AI_XatoLog.txt", "=== AI VISION JAVOBI ===\n" + jsonStr);
                        } catch(e){}
                    }
                    
                    /* ⚡ Raqamni xavfsiz o'qish: "1 234,56" / "1'234.56" → 1234.56 */
                    function _fNum(v){
                        if(v === null || v === undefined || v === '') return 0;
                        if(typeof v === 'number') return isFinite(v) ? v : 0;
                        var s = String(v).replace(/[\s ']/g,'').replace(',', '.');
                        var n = parseFloat(s);
                        return isFinite(n) ? n : 0;
                    }

                    items = arr.map(function(m){
                        supplier = supplier || String(m.postavshik||'');
                        /* ⚡⚡⚡ 2026-08-13 SOXTA SANA TUZATILDI: sana topilmasa
                         * BUGUNGI sana qo'yilardi — hujjatda bo'lmagan sana
                         * haqiqiydek bazaga tushardi (yuridik hujjatda xavfli).
                         * Endi bo'sh qoladi va UI'da ko'rinadi. */
                        return {
                            fakturaRaqami: String(m.fakturaRaqami || "Noma'lum"),
                            kelganSana: String(m.kelganSana || ''),
                            postavshik: String(m.postavshik || "Noma'lum"),
                            shartnomaRaqami: String(m.shartnomaRaqami||''),
                            shartnomaSanasi: String(m.shartnomaSanasi||''),
                            postavshikInn: String(m.postavshikInn||''),
                            postavshikManzil: String(m.postavshikManzil||''),
                            sotibOluvchiInn: String(m.sotibOluvchiInn||''),
                            sotibOluvchiManzil: String(m.sotibOluvchiManzil||''),
                            nomi: String(m.nomi||''),
                            katalogNomi: String(m.katalogNomi||''),
                            birligi: String(m.birligi||'dona'),
                            miqdori: _fNum(m.miqdori),
                            narxi: _fNum(m.narxi),
                            jamiNdsSiz: _fNum(m.jamiNdsSiz),
                            ndsSummasi: _fNum(m.ndsSummasi),
                            jamiNdsBilan: _fNum(m.jamiNdsBilan),
                            kategoriya: String(m.kategoriya||'Boshqa')
                        };
                    });

                    /* ⚡⚡⚡ 2026-08-13 SUMMA NAZORATI (yuridik hujjat — nazoratsiz
                     * qoldirib bo'lmaydi). FAQAT arifmetik to'ldirish qilamiz:
                     * yetishmagan maydonni boshqalaridan HISOBLAYMIZ. Hech narsa
                     * to'qib chiqarilmaydi; mos kelmasa `summaOgoh` bilan
                     * BELGILANADI va UI'da ko'rinadi (jimgina tuzatilmaydi). */
                    items.forEach(function(it){
                        var hisob = it.miqdori * it.narxi;
                        if(!it.jamiNdsSiz && hisob > 0) it.jamiNdsSiz = Math.round(hisob*100)/100;
                        if(!it.narxi && it.miqdori > 0 && it.jamiNdsSiz > 0)
                            it.narxi = Math.round((it.jamiNdsSiz/it.miqdori)*100)/100;
                        if(!it.jamiNdsBilan) it.jamiNdsBilan = Math.round((it.jamiNdsSiz + it.ndsSummasi)*100)/100;

                        it.summaOgoh = '';
                        if(hisob > 0 && it.jamiNdsSiz > 0 && Math.abs(hisob - it.jamiNdsSiz)/hisob > 0.01)
                            it.summaOgoh = 'miqdor×narx=' + Math.round(hisob) + ' ≠ jami=' + Math.round(it.jamiNdsSiz);
                        var kutNds = it.jamiNdsSiz + it.ndsSummasi;
                        if(kutNds > 0 && it.jamiNdsBilan > 0 && Math.abs(kutNds - it.jamiNdsBilan)/kutNds > 0.01)
                            it.summaOgoh = (it.summaOgoh ? it.summaOgoh+'; ' : '')
                                         + 'NDSsiz+NDS=' + Math.round(kutNds) + ' ≠ NDSbilan=' + Math.round(it.jamiNdsBilan);
                    });
                }
            }
        } catch(err) {
            /* ⚡⚡⚡ 2026-08-13: bu yerda xato butunlay YUTILARDI va {items:[]}
             * qaytarilardi — UI «tovar topilmadi» deb ko'rsatib, HAQIQIY sabab
             * (kalit yaroqsiz / kvota / JSON buzuq) hech qayerda ko'rinmasdi.
             * Foydalanuvchi shikoyati «ishlamayapti, xatolari ko'p» aynan shundan. */
            oxirgiXato = String((err && err.message) || err);
            Logger.log("AI Vision Xato: " + oxirgiXato);
            if(fileObj) {
               try {
                   var xp = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next().getFoldersByName('Xato_Oqilganlar').next();
                   xp.createFile(fileObj.getName() + "_VISION_CRASH.txt", "=== XATO ===\n" + oxirgiXato);
               } catch(e){}
            }
        }
    } else {
        oxirgiXato = 'aiFetchRaw funksiyasi mavjud emas (00_AI_Gateway.js yuklanmadi)';
    }

    if(!items.length && !oxirgiXato) oxirgiXato = 'AI javob qaytardi, lekin tovar topilmadi (hujjat jadvali tanilmadi)';
    return { items: items, supplier: supplier, xato: oxirgiXato };
}

/** @return {{items:Array, xatolar:Object}} — xatolar: {docId: sabab}
 *  ⚡ 2026-08-13: avval faqat massiv qaytarardi va XATO SABABI yo'qolardi;
 *  chaqiruvchi «o'qilmadi» ni vaqtinchalik xatodan ajrata olmasdi. */
function _parseFakturaVisionBatch(batch) {
    var result = [], xatolar = {};
    for (var i = 0; i < batch.length; i++) {
        var b = batch[i];
        var parsed = _parseFakturaVision(b.blob, b.file);
        if (parsed && parsed.xato) xatolar[b.id] = parsed.xato;
        var pit = (parsed && parsed.items) || [];
        for (var j = 0; j < pit.length; j++) {
            var itm = pit[j];
            itm.docId = b.id;
            result.push(itm);
        }
        // Free plan API limitiga urilmaslik (429) uchun har so'rovdan keyin kutamiz.
        if (i < batch.length - 1) {
            Utilities.sleep(6000);
        }
    }
    return { items: result, xatolar: xatolar };
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturaAvtoSinx = apiFakturaAvtoSinx;
  globalThis.apiFakturaDriveHolat = apiFakturaDriveHolat;
  globalThis.fakturaSinxTriggerOrnat = fakturaSinxTriggerOrnat;
  globalThis.apiFakturaSinxTuzat = apiFakturaSinxTuzat;
  globalThis.apiFakturaOxirgiIjro = apiFakturaOxirgiIjro;
  globalThis.apiFakturaSinxAsosiy = apiFakturaSinxAsosiy;
  globalThis.apiFakturaSinxDavom = apiFakturaSinxDavom;
  globalThis.apiStartBackgroundSync = function() {
    apiFakturaSinxDavom();
    return {ok: true, xabar: "Orqa fonda sinxronizatsiya ishga tushdi. U barcha fayllar tugaguncha avtomatik ishlaydi."};
  };
}
