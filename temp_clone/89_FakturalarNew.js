/********************************************************************
 * 88_Fakturalar.js - PDF dan yig'ilgan faktura ma'lumotlarini saqlash
 * ==================================================================
 ********************************************************************/

function apiFakturalarOl() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Fakturalar');
    if (!sh) return { ok: true, fakturalar: [] };

    var data = sh.getDataRange().getValues();
    if (data.length <= 1) return { ok: true, fakturalar: [] };

    var out = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      out.push({
        id: row[0] + '_' + i,
        fakturaRaqami: String(row[0] || ''),
        postavshik: String(row[1] || ''),
        kelganSana: String(row[2] || ''),
        shartnomaRaqami: String(row[3] || ''),
        shartnomaSanasi: String(row[4] || ''),
        nomi: String(row[5] || ''),
        birligi: String(row[6] || ''),
        miqdori: Number(row[7]) || 0,
        narxi: Number(row[8]) || 0,
        jamiNdsSiz: Number(row[9]) || 0,
        ndsSummasi: Number(row[10]) || 0,
        jamiNdsBilan: Number(row[11]) || 0,
        kategoriya: String(row[12] || 'Boshqa')
      });
    }
    return { ok: true, fakturalar: out };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}

function apiFakturaYoz(fakturalarArray) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Fakturalar');
    
    if (!sh) {
      sh = ss.insertSheet('Fakturalar');
      var sarlavhalar = [
        "Faktura raqami", "Postavshik", "Kelgan sana", "Shartnoma raqami", "Shartnoma sanasi",
        "Maxsulot nomi", "O'lchov birligi", "Miqdori", "Narxi (NDS siz)", 
        "Yetkazib berish qiymati", "NDS summasi", "NDS bilan umumiy summa", "Kategoriya"
      ];
      sh.appendRow(sarlavhalar);
      sh.getRange(1, 1, 1, sarlavhalar.length).setFontWeight("bold").setBackground("#e0e0e0");
    }

    if (!fakturalarArray || fakturalarArray.length === 0) {
      return { ok: true, xabar: "Yozish uchun ma'lumot yo'q" };
    }

    var qatorlar = [];
    for (var i = 0; i < fakturalarArray.length; i++) {
      var item = fakturalarArray[i];
      qatorlar.push([
        item.fakturaRaqami || "",
        item.postavshik || "",
        item.kelganSana || "",
        item.shartnomaRaqami || "",
        item.shartnomaSanasi || "",
        item.nomi || "",
        item.birligi || "",
        item.miqdori || 0,
        item.narxi || 0,
        item.jamiNdsSiz || 0,
        item.ndsSummasi || 0,
        item.jamiNdsBilan || 0,
        item.kategoriya || "Boshqa"
      ]);
    }

    var lastRow = sh.getLastRow();
    sh.getRange(lastRow + 1, 1, qatorlar.length, qatorlar[0].length).setValues(qatorlar);
    return { ok: true, soni: qatorlar.length };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}

function apiFakturaFaylYoz(payload) {
  try {
    var b64 = payload.base64;
    if (!b64) return { ok: false, xabar: 'Base64 data kiritilmadi' };
    
    if (b64.indexOf('base64,') !== -1) {
      b64 = b64.split('base64,')[1];
    }

    var fileName = payload.nomi || 'Faktura.pdf';
    var postavshik = payload.postavshik || 'Boshqalar';
    postavshik = postavshik.replace(/[<>:"\/\\|?*]/g, '_'); 
    
    var rootFolders = DriveApp.getRootFolder().getFoldersByName('Fakturalar');
    var fakturaFolder;
    if (rootFolders.hasNext()) {
      fakturaFolder = rootFolders.next();
    } else {
      fakturaFolder = DriveApp.getRootFolder().createFolder('Fakturalar');
    }
    
    var postFolders = fakturaFolder.getFoldersByName(postavshik);
    var postFolder;
    if (postFolders.hasNext()) {
      postFolder = postFolders.next();
    } else {
      postFolder = fakturaFolder.createFolder(postavshik);
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', fileName);
    var file = postFolder.createFile(blob);
    
    return { ok: true, url: file.getUrl(), fileName: fileName };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}

function apiFakturaOCR(payload) {
  try {
    var b64 = payload.base64;
    var mimeType = payload.mimeType || 'image/jpeg';
    var fileName = payload.nomi || 'OcrImage';

    if (b64.indexOf('base64,') !== -1) {
      b64 = b64.split('base64,')[1];
    }
    
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mimeType, fileName);
    
    var resource = {
      name: fileName,
      mimeType: MimeType.GOOGLE_DOCS
    };
    
    // Google Doc ga konvertatsiya orqali OCR qilinadi (Drive API v3)
    var file = Drive.Files.create(resource, blob);
    var docId = file.id;
    
    // Hujjatdan o'qilgan matnni olish
    var doc = DocumentApp.openById(docId);
    var text = doc.getBody().getText();
    
    // Vaqtinchalik faylni o'chirish
    DriveApp.getFileById(docId).setTrashed(true);
    
    return { ok: true, text: text };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiFakturalarOl = apiFakturalarOl;
  globalThis.apiFakturaYoz = apiFakturaYoz;
  globalThis.apiFakturaFaylYoz = apiFakturaFaylYoz;
  globalThis.apiFakturaOCR = apiFakturaOCR;
}
