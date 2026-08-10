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

  var limit = 20; // Har safar max 20 ta faylni ishlaymiz (Google 6 minutlik limitiga sig'ish uchun)
  var count = 0;
  
  var existingData = apiFakturalarOl().fakturalar || [];
  var existingMap = {};
  for(var e = 0; e < existingData.length; e++){
     var it = existingData[e];
     if(it.fakturaRaqami && it.postavshik){
         existingMap[it.fakturaRaqami + '@@' + it.postavshik] = true;
     }
  }

  var yangiKiritmalar = [];

  while (count < hammaFayllar.length && count < limit) {
    var file = hammaFayllar[count];
    count++;
    
    // 1. To'g'ridan-to'g'ri PDF faylni (blob) Gemini Vision ga beramiz. Matnga o'girmaymiz.
    try {
      var blob = file.getBlob();
      var parsed = _parseFakturaVision(blob, file);
      
      if(parsed.items.length === 0 || !parsed.items[0].nomi){
          // Agar jadval topilmasa
          file.moveTo(xatoPap);
          continue;
      }

      // Dublikat tekshirish
      var isDup = false;
      for(var i=0; i<parsed.items.length; i++){
         var it = parsed.items[i];
         if(it.fakturaRaqami && it.postavshik){
             if(existingMap[it.fakturaRaqami + '@@' + it.postavshik]){
                 isDup = true;
                 break;
             }
         }
      }

      if(isDup){
         file.moveTo(dubPap);
      } else {
         // Yaroqli tovarlarni qo'shish
         var fpos = "Noma_lum";
         if(parsed.items.length > 0) fpos = String(parsed.items[0].postavshik || "Noma'lum").replace(/[<>:"\/\\|?*]/g, '_').trim();
         if(!fpos) fpos = "Noma_lum";
         
         var posPap = getOrCreateFolder(arxivPap, fpos);
         
         for(var j=0; j<parsed.items.length; j++){
             var itm = parsed.items[j];
             itm.faylUrl = file.getUrl();
             yangiKiritmalar.push(itm);
             // cache for next files in the same batch
             existingMap[itm.fakturaRaqami + '@@' + itm.postavshik] = true; 
         }
         file.moveTo(posPap);
      }
    } catch(err) {
      var msg = err.toString().toLowerCase();
      if(msg.indexOf('429') > -1 || msg.indexOf('quota') > -1 || msg.indexOf('too many requests') > -1 || msg.indexOf('limit') > -1) {
          Logger.log("API limit tushdi, to'xtatamiz.");
          // Faylni xatoga o'tkazmaymiz, joyida qoladi, keyingi tsiklda yana urinib ko'riladi.
          break;
      }
      Logger.log("Xato: " + err.toString());
      try {
         xatoPap.createFile(file.getName() + "_CRASH.txt", "=== XATO ===\n" + err.toString());
      } catch(e){}
      file.moveTo(xatoPap);
    }
  }

  // Bazaga yozish
  var yozilganSoni = 0;
  if(yangiKiritmalar.length > 0){
      var res = apiFakturaYoz(yangiKiritmalar);
      if(res && res.ok) yozilganSoni = res.soni || yangiKiritmalar.length;
  }
  
  var qolgan = hammaFayllar.length - count;
  return { ok: true, ishlanganFayllar: count, yozilganQatorlar: yozilganSoni, qolganFayllar: qolgan > 0 ? qolgan : 0 };
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

function _parseFakturaVision(blob, fileObj) {
    var items = [];
    var supplier = '';
    
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
                      "7. KATEGORIYA: Armatura, Beton, Sement, G'isht/Blok, Inert (Qum, Sheben), Kabel/Elektrika, Santexnika, Mixanizm, Asbob/Uskuna, Xizmat, Boshqa.\n\n" +
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

            var res = aiFetchRaw('gemini-2.5-flash', payload);
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
                    
                    items = arr.map(function(m){
                        supplier = supplier || String(m.postavshik||'');
                        return {
                            fakturaRaqami: String(m.fakturaRaqami || "Noma'lum"),
                            kelganSana: String(m.kelganSana || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd.MM.yyyy")),
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
                            miqdori: Number(m.miqdori)||0,
                            narxi: Number(m.narxi)||0,
                            jamiNdsSiz: Number(m.jamiNdsSiz)||0,
                            ndsSummasi: Number(m.ndsSummasi)||0,
                            jamiNdsBilan: Number(m.jamiNdsBilan)||0,
                            kategoriya: String(m.kategoriya||'Boshqa')
                        };
                    });
                }
            }
        } catch(err) {
            Logger.log("AI Vision Xato: " + err.toString());
            if(fileObj) {
               try {
                   var xp = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next().getFoldersByName('Xato_Oqilganlar').next();
                   xp.createFile(fileObj.getName() + "_VISION_CRASH.txt", "=== XATO ===\n" + err.toString());
               } catch(e){}
            }
        }
    }
    
    return { items: items, supplier: supplier };
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturaAvtoSinx = apiFakturaAvtoSinx;
  globalThis.apiFakturaDriveHolat = apiFakturaDriveHolat;
  globalThis.fakturaSinxTriggerOrnat = fakturaSinxTriggerOrnat;
  globalThis.apiStartBackgroundSync = function() {
    apiFakturaSinxDavom();
    return {ok: true, xabar: "Orqa fonda sinxronizatsiya ishga tushdi. U barcha fayllar tugaguncha avtomatik ishlaydi."};
  };
}
