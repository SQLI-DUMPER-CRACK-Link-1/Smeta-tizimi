/********************************************************************
 * 88_Fakturalar.js — PDF dan yig'ilgan faktura ma'lumotlarini saqlash
 * ==================================================================
 ********************************************************************/

function apiFakturalarOl() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName('Fakturalar');
    if (!sh) return { ok: true, fakturalar: [] }; // Varaq yo'q bo'lsa bo'sh qaytamiz

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
        jamiNdsBilan: Number(row[11]) || 0
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
    
    // Varaq yo'q bo'lsa, yaratamiz va sarlavhalarni yozamiz
    if (!sh) {
      sh = ss.insertSheet('Fakturalar');
      var sarlavhalar = [
        "Faktura raqami", "Postavshik", "Kelgan sana", "Shartnoma raqami", "Shartnoma sanasi",
        "Maxsulot nomi", "O'lchov birligi", "Miqdori", "Narxi (NDS siz)", 
        "Yetkazib berish qiymati", "NDS summasi", "NDS bilan umumiy summa"
      ];
      sh.appendRow(sarlavhalar);
      sh.getRange(1, 1, 1, sarlavhalar.length).setFontWeight("bold").setBackground("#e0e0e0");
    }

    if (!fakturalarArray || fakturalarArray.length === 0) {
      return { ok: true, xabar: "Yozish uchun ma'lumot yo'q" };
    }

    var rows = [];
    for (var i = 0; i < fakturalarArray.length; i++) {
      var item = fakturalarArray[i];
      rows.push([
        item.fakturaRaqami || '',
        item.postavshik || '',
        item.kelganSana || '',
        item.shartnomaRaqami || '',
        item.shartnomaSanasi || '',
        item.nomi || '',
        item.birligi || '',
        item.miqdori || 0,
        item.narxi || 0,
        item.jamiNdsSiz || 0,
        item.ndsSummasi || 0,
        item.jamiNdsBilan || 0
      ]);
    }

    var lastRow = sh.getLastRow();
    sh.getRange(lastRow + 1, 1, rows.length, rows[0].length).setValues(rows);

    return { ok: true, soni: rows.length };
  } catch(e) {
    return { ok: false, xabar: String(e) };
  }
}
