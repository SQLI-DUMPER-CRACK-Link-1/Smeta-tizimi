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
    if (trs[i].getHandlerFunction() === 'apiFakturaAvtoSinx') {
      ScriptApp.deleteTrigger(trs[i]);
    }
  }
  // Har kuni kechasi soat 02:00 da ishlaydigan yangi trigger
  ScriptApp.newTrigger('apiFakturaAvtoSinx').timeBased().everyDays(1).atHour(2).create();
  return {ok: true, xabar: "Sinxronizatsiya har kuni soat 02:00 ga sozlandi."};
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
        // Fallback for buyer INN if exact match fails
        var allStirs = text.match(/\b\d{9}\b/g);
        if (allStirs && allStirs.length >= 2) {
            supplierInn = supplierInn || allStirs[0];
            buyerInn = allStirs[1];
        }
    }
    
    var items = [];
    var n = '(-?\\d+(?:\\s\\d{3})*(?:\\.\\d+)?)';
    var amtRegex = new RegExp(
        n + '\\s+' + 
        n + '\\s+' + 
        n + '\\s+' + 
        '(?:(?:Без\\s*акциз(?:а|сиз)|Акцизсиз|\\d+\\s*%)\\s+' + n + '\\s+)?' + 
        '(\\d+\\s*%|Без\\s*НДС|ҚҚСсиз|Без\\s*НДС\\s*\\(0\\)|ҚҚСсиз\\s*\\(0\\))\\s+' + 
        n + '\\s+' + 
        n + 
        '(?:\\s+(?:Олди-сотди|Ўз\\.иш\\.чиқ\\.|Импорт|Четдан келтирилган|Ўз эҳтиёжлари учун ишлаб чиқарилган))?',
        'gi'
    );
    
    var match;
    var lastEnd = 0;
    
    while ((match = amtRegex.exec(text)) !== null) {
        var precedingText = text.substring(lastEnd, match.index).trim();
        lastEnd = amtRegex.lastIndex;
        
        // Agar bu birinchi item bo'lsa, precedingText ichida butun header bo'ladi.
        // Header odatda "1 2 3 4 5 6 7 8 9 10" kabi raqamlar qatoridan keyin tugaydi.
        var colNumbersMatch = precedingText.match(/1\s+2\s+3\s+4\s+5\s+6\s+7\s+8\s+9\s+10\s+(.*)/);
        if (colNumbersMatch) {
            precedingText = colNumbersMatch[1];
        } else {
            // Yoki "Maxsulot nomi" yoki shunga o'xshash so'zdan keyingi qismini olamiz
            var headerKeywords = /(?:қиймати|Summa|Сумма|Нархи|Narxi|Миқдор|Miqdor|номи|nomi|Tovar)\s+(.*)/is;
            var hkMatch = precedingText.match(headerKeywords);
            if (hkMatch && hkMatch[1] && hkMatch[1].length < 200) {
                // Fagatgina ohirgi qismini olamiz (agar u juda uzun bo'lmasa)
                var segments = precedingText.split(/(?:қиймати|Summa|Сумма|Нархи|Narxi|Миқдор|Miqdor|номи|nomi|Tovar)\s+/i);
                precedingText = segments[segments.length - 1];
            }
        }
        
        // MXIK kodi (17 ta raqam) ni o'chirib tashlaymiz
        precedingText = precedingText.replace(/\b\d{17}\b/g, '').trim();

        var tokens = precedingText.split(/\s+/);
        var nomi = '';
        var birligi = '';
        if (tokens.length >= 2) {
            birligi = tokens.pop();
            var qoldi = tokens.join(' ');
            var nmMatch = qoldi.match(/\d+[\s.]*(.*)/);
            if (nmMatch && nmMatch[1]) {
                nomi = nmMatch[1].trim();
            } else {
                nomi = qoldi;
            }
        } else {
            nomi = precedingText;
            birligi = 'dona';
        }
        
        var nameStr = nomi.replace(/^[\d\s.]+/, '').trim();
        if (nameStr.indexOf('-') === 0) nameStr = nameStr.substring(1).trim();
        
        var parseNum = function(s) {
            if (!s) return 0;
            return parseFloat(s.replace(/\s+/g, '').replace(/,/g, '.'));
        };
        
        items.push({
            fakturaRaqami: docNo, 
            kelganSana: docDate,
            postavshik: supplier,
            shartnomaRaqami: contractNo,
            shartnomaSanasi: contractDate,
            postavshikInn: supplierInn,
            postavshikManzil: supplierManzil,
            sotibOluvchiInn: buyerInn,
            sotibOluvchiManzil: buyerManzil,
            nomi: nameStr,
            birligi: birligi,
            miqdori: parseNum(match[1]),
            narxi: parseNum(match[2]),
            jamiNdsSiz: parseNum(match[3]),
            ndsSummasi: parseNum(match[6]),
            jamiNdsBilan: parseNum(match[7]),
            kategoriya: 'Boshqa'
        });
    }
    
    // AI Fallback
    if (items.length === 0 && typeof llmCall === 'function') {
        try {
            var sys = "Sen faktura/akt/kvitansiya o'qiydigan AIsan. Bu hujjat ko'p varaqli (multi-page) yoki juda uzun bo'lishi mumkin. Hamma varaqlardagi barcha tovar va xizmatlarni bitta ham qoldirmay top!\n" + 
                      "Faqat JSON formatda Array qaytar, hech qanday markdown(```json) yozma!\n" + 
                      "Har bir obyektda: fakturaRaqami, kelganSana, postavshik, shartnomaRaqami, shartnomaSanasi, nomi, birligi, miqdori, narxi, jamiNdsSiz, ndsSummasi, jamiNdsBilan, kategoriya.\n" +
                      "Kategoriyalar: Armatura, Beton, Sement, G'isht/Blok, Inert (Qum, Sheben), Kabel/Elektrika, Santexnika, Mixanizm, Asbob/Uskuna, Xizmat, Boshqa.\n" +
                      "Raqamlar yozuvsiz toza son bo'lsin.";
            var res = llmCall({
                system: sys,
                contents: [{role: 'user', parts: [{text: text}]}]
            });
            if (res) {
                var jsonStr = res.replace(/```json/gi, '').replace(/```/g, '').trim();
                var arr = JSON.parse(jsonStr);
                if (Array.isArray(arr) && arr.length > 0) {
                    items = arr.map(function(m){
                        return {
                            fakturaRaqami: String(m.fakturaRaqami||docNo),
                            kelganSana: String(m.kelganSana||docDate),
                            postavshik: String(m.postavshik||supplier),
                            shartnomaRaqami: String(m.shartnomaRaqami||contractNo),
                            shartnomaSanasi: String(m.shartnomaSanasi||contractDate),
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
                }
            }
        } catch(e) {
            Logger.log('AI Parse Xato: ' + e);
        }
    } else {
        // Regex ishlagan bo'lsa, tezkor o'zimiz kategoriya beramiz
        for (var i = 0; i < items.length; i++) {
           var nm = items[i].nomi.toLowerCase();
           if(nm.indexOf('арматура')>-1) items[i].kategoriya='Armatura';
           else if(nm.indexOf('бетон')>-1) items[i].kategoriya='Beton';
           else if(nm.indexOf('цемент')>-1 || nm.indexOf('sement')>-1) items[i].kategoriya='Sement';
           else if(nm.indexOf('щебень')>-1 || nm.indexOf('песок')>-1 || nm.indexOf('qum')>-1) items[i].kategoriya='Inert (Qum, Sheben)';
           else items[i].kategoriya='Boshqa';
        }
    }
    
    return { items: items, supplier: supplier };
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturaAvtoSinx = apiFakturaAvtoSinx;
  globalThis.apiFakturaDriveHolat = apiFakturaDriveHolat;
  globalThis.fakturaSinxTriggerOrnat = fakturaSinxTriggerOrnat;
}
