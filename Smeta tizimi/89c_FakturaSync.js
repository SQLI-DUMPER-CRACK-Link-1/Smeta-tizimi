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

  var limit = 8; // Har safar max 8 ta faylni ishlaymiz, timeout bo'lmasligi uchun
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
    
    // Matnni OCR orqali o'qish (Drive API v3)
    var resource = { name: file.getName(), mimeType: MimeType.GOOGLE_DOCS };
    try {
      var converted = Drive.Files.create(resource, file.getBlob());
      
      var url = "https://docs.google.com/document/export?format=txt&id=" + converted.id;
      var options = { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
      var text = UrlFetchApp.fetch(url, options).getContentText();
      
      DriveApp.getFileById(converted.id).setTrashed(true); // vaqtinchalik faylni o'chirish
      text = text.replace(/\s+/g, ' ');

      // Matnni parchalash (Frontend dagi logic)
      var parsed = _parseFakturaText(text);
      if(parsed.items.length === 0 || !parsed.items[0].fakturaRaqami || !parsed.items[0].postavshik){
          // Agar jadval topilmasa Yoki header (Raqam/Postavshik) yo'q bo'lsa
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
         for(var j=0; j<parsed.items.length; j++){
             yangiKiritmalar.push(parsed.items[j]);
             // cache for next files in the same batch
             existingMap[parsed.items[j].fakturaRaqami + '@@' + parsed.items[j].postavshik] = true; 
         }
         file.moveTo(arxivPap);
      }
    } catch(err) {
      Logger.log("Xato: " + err.toString());
      try {
         xatoPap.createFile(file.getName() + "_CRASH.txt", "=== XATO ===\n" + err.toString() + "\n\n=== MATN ===\n" + (typeof text !== 'undefined' ? text : ''));
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

function _parseFakturaText(text) {
    var docNo = '';
    var docDate = '';
    var contractNo = '';
    var contractDate = '';
    var supplier = '';
    
    var supplierInn = '';
    var supplierManzil = '';
    var buyerInn = '';
    var buyerManzil = '';
    
    var shartMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*([^\s]+)-сонли\s*шартномага/i);
    if (shartMatch) {
      contractDate = shartMatch[1];
      contractNo = shartMatch[2];
    }
    
    var fakMatch = text.match(/(\d{2}\.\d{2}\.\d{4})\s*даги\s*([^\s]+)-сонли(?:\s*Ҳисобварақ-фактура)?/i);
    if (fakMatch) {
      docDate = fakMatch[1];
      docNo = fakMatch[2];
    }
    
    var supplierMatch = text.match(/(?:Етказиб\s*берувчи|Воситачи|Ижрочи|Буюртмачи|Sotuvchi):(.*?)(?:Манзил:|Етказиб\s*берувчининг|Воситачининг|Ижрочининг|Буюртмачининг|СТИР)/i);
    if (supplierMatch) {
      supplier = supplierMatch[1].trim();
    }
    
    var manzilSupMatch = text.match(/(?:Етказиб\s*берувчи|Воситачи|Ижрочи|Буюртмачи|Sotuvchi)[\s\S]*?Манзил:\s*(.*?)(?:Сотиб\s*олувчи|Етказиб\s*берувчининг|СТИР|МХИК)/i);
    if (manzilSupMatch) {
        supplierManzil = manzilSupMatch[1].trim();
    }

    var buyerManzilMatch = text.match(/(?:Сотиб\s*олувчи|Харидор)[\s\S]*?Манзил:\s*(.*?)(?:Етказиб\s*берувчининг|Сотиб\s*олувчининг|СТИР|МХИК)/i);
    if (buyerManzilMatch) {
        buyerManzil = buyerManzilMatch[1].trim();
    }

    var stirSupMatch = text.match(/(?:Етказиб\s*берувчининг\s*СТИР\s*рақами|СТИР).*?(\d{9})/i);
    if (stirSupMatch) {
        supplierInn = stirSupMatch[1];
    }
    var stirBuyMatch = text.match(/(?:Сотиб\s*олувчининг\s*СТИР\s*рақами).*?(\d{9})/i);
    if (stirBuyMatch) {
        buyerInn = stirBuyMatch[1];
    } else {
        var allStirs = text.match(/\b\d{9}\b/g);
        if (allStirs && allStirs.length >= 2) {
            supplierInn = supplierInn || allStirs[0];
            buyerInn = allStirs[1];
        }
    }
    
    var items = [];
    var aiSuccess = false;

    // AI orqali 100% aniq o'qishga harakat qilamiz (Primary)
    if (typeof aiCall === 'function') {
        try {
            var sys = "Sen faktura va aktlarni o'qiydigan mutlaqo bexato va professional AIsan. Matn OCR dan o'tgani sababli, ustunlar joylashuvi buzilgan, raqamlar boshqa qatorga tushib qolgan bo'lishi mumkin.\n\n" + 
                      "QAT'IY QOIDALAR:\n" +
                      "1. Hujjatdagi BARCHA tovar va xizmatlarni top. Bittasini ham o'tkazib yuborma!\n" +
                      "2. NOMI: Mahsulot nomi ba'zan 2-3 qatorga uzilib ketadi, ularni mantiqan yig'ib bitta ism qil.\n" +
                      "3. BIRLIGI: 'metr', 'dona', 'kg', 'tonna', 'sht', 'komplekt', 'litr', 'm3', 'kub. m.' kabi so'zlar FAQAT Birlik! Hech qachon ularni 'Nomi' sifatida yozma!\n" +
                      "4. RAQAMLAR: Narx, miqdor va summalarni (jamiNdsSiz, ndsSummasi, jamiNdsBilan) topishda mantiqan qara. Odatda ular ketma-ket keladi (Miqdor, Narx, NDSsiz summa, NDS summa, Jami summa). Probelsiz toza son ko'rinishida yoz (masalan: 1250000).\n" +
                      "5. Har bir obyekt ushbu maydonlarga ega bo'lishi shart:\n" +
                      "   fakturaRaqami, kelganSana, postavshik, shartnomaRaqami, shartnomaSanasi, nomi, birligi, miqdori, narxi, jamiNdsSiz, ndsSummasi, jamiNdsBilan, kategoriya.\n" +
                      "6. KATEGORIYA: Armatura, Beton, Sement, G'isht/Blok, Inert (Qum, Sheben), Kabel/Elektrika, Santexnika, Mixanizm, Asbob/Uskuna, Xizmat, Boshqa.\n\n" +
                      "MISOL (OCR matn buzilgan holatda):\n" +
                      "1 Бетон М-200 kub. m. \n 117.7 \n 402051.22 47321428.59 5678571.43 53000000\n\n" +
                      "KUTILGAN NATIJA:\n" +
                      "{\"items\": [{\"nomi\": \"Бетон М-200\", \"birligi\": \"kub. m.\", \"miqdori\": 117.7, \"narxi\": 402051.22, \"jamiNdsSiz\": 47321428.59, \"ndsSummasi\": 5678571.43, \"jamiNdsBilan\": 53000000, \"kategoriya\": \"Beton\"}]}\n\n" +
                      "QAYTARISH FORMATI: Sening javobing qat'iy ravishda `{\"items\": [...]}` ko'rinishidagi bitta JSON obyekti bo'lishi shart. Boshqa hech qanday izoh yozma!";
            var res = aiCall({
                system: sys,
                user: "Matnni diqqat bilan tahlil qil. Ustunlar siljigan bo'lishi mumkin, birlik va narxlarni to'g'ri nomlarga bog'la:\n\n" + text,
                json: true,
                maxTok: 8192,
                temp: 0.1
            });
            
            // Yordamchi log - xatoni topish uchun
            var debugText = "=== OCR MATN ===\n" + text + "\n\n=== AI JAVOBI ===\n" + (res || "AI JAVOB BERMADI");
            
            if (res) {
                var jsonStr = res;
                if(jsonStr.indexOf('```') !== -1) {
                    jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
                }
                var rawObj = JSON.parse(jsonStr);
                var arr = Array.isArray(rawObj) ? rawObj : (rawObj.items || rawObj.tovarlar || []);
                if (Array.isArray(arr) && arr.length > 0) {
                    // Agar AI umuman noto'g'ri topgan bo'lsa (masalan nomi 'metr') - buni xatoga chiqarish kerak
                    var xatoBormi = false;
                    for(var k=0; k<arr.length; k++){
                        var nomiTest = String(arr[k].nomi||'').toLowerCase().trim();
                        if(nomiTest === 'metr' || nomiTest === 'dona' || nomiTest === 'sht' || nomiTest === 'kg') {
                            xatoBormi = true; break;
                        }
                    }
                    if(xatoBormi) {
                        xatoPap.createFile(file.getName() + "_AI_XatoLog.txt", debugText);
                    }
                    
                    items = arr.map(function(m){
                        return {
                            fakturaRaqami: String(m.fakturaRaqami||docNo),
                            kelganSana: String(m.kelganSana||docDate),
                            postavshik: String(m.postavshik||supplier),
                            shartnomaRaqami: String(m.shartnomaRaqami||contractNo),
                            shartnomaSanasi: String(m.shartnomaSanasi||contractDate),
                            postavshikInn: supplierInn,
                            postavshikManzil: supplierManzil,
                            sotibOluvchiInn: buyerInn,
                            sotibOluvchiManzil: buyerManzil,
                            nomi: String(m.nomi||''),
                            birligi: String(m.birligi||'dona'),
                            miqdori: Number(m.miqdori)||0,
                            narxi: Number(m.narxi)||0,
                            jamiNdsSiz: Number(m.jamiNdsSiz)||0,
                            ndsSummasi: Number(m.ndsSummasi)||0,
                            jamiNdsBilan: Number(m.jamiNdsBilan)||0,
                            kategoriya: String(m.kategoriya||'Boshqa')
                        };
                    });
                    aiSuccess = true;
                }
            }
        } catch(e) {
            Logger.log('AI Parse Xato: ' + e);
        }
    }

    if (!aiSuccess) {
        Logger.log('AI orqali o\'qish muvaffaqiyatsiz bo\'ldi. (Ehtimol matn juda uzun yoki AI xatosi)');
        // Regex eskirgan va xato ishlaganligi sababli olib tashlandi.
        // Hujjatni qo'lda tekshirish uchun bo'sh array qaytaramiz.
    }
    
    return { items: items, supplier: supplier };
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturaAvtoSinx = apiFakturaAvtoSinx;
  globalThis.apiFakturaDriveHolat = apiFakturaDriveHolat;
  globalThis.fakturaSinxTriggerOrnat = fakturaSinxTriggerOrnat;
}
