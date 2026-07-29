/*******************************************************
 * ReverseSync.js - Yig'ma Exceldan orqaga asliga qaytarish
 *******************************************************/

/**
 * Oxirgi yaratilgan "Pechat_Kitobi_" Excel fayllarni ro'yxatini qaytaradi.
 */
function getRecentPrintFiles() {
  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const files = root.searchFiles("title contains 'Pechat_Kitobi_' and mimeType = 'application/vnd.google-apps.spreadsheet'");
  const list = [];
  
  while (files.hasNext()) {
    const file = files.next();
    list.push({
      name: file.getName(),
      url: file.getUrl(),
      date: file.getDateCreated().getTime()
    });
  }
  
  // Eng yangilari birinchi turishi uchun saralaymiz
  list.sort((a, b) => b.date - a.date);
  
  // Faqat oxirgi 15 tasini qaytaramiz
  return list.slice(0, 15);
}

/**
 * Yig'ilgan Excel faylining URL manzilini qabul qilib, barcha varaqlardagi o'zgarishlarni 
 * original fayllarga va REYESTRga yozadi.
 */
function reverseSyncFromMerged(mergedUrl) {
  let finalUrl = mergedUrl;
  if (!finalUrl) {
    finalUrl = PropertiesService.getDocumentProperties().getProperty('LAST_MERGED_EXCEL_URL');
  }

  if (!finalUrl) {
    return { success: false, error: "URL manzil kiritilmadi va oxirgi yaratilgan yig'ma fayl ham topilmadi." };
  }

  let mergedSS;
  try {
    mergedSS = SpreadsheetApp.openByUrl(finalUrl);
  } catch (e) {
    return { success: false, error: "Faylni ochib bo'lmadi. URL manzil to'g'riligiga ishonch hosil qiling." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reyestr = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  const reyMap = headerMap_(reyestr);
  const urlCol = reyMap[REY.ACT_FILE_URL];

  if (!reyestr || !urlCol) {
    return { success: false, error: "REYESTR yoki fayl manzili ustuni topilmadi." };
  }

  const sheets = mergedSS.getSheets();
  let successCount = 0;
  let errors = [];

  for (const sheet of sheets) {
    const name = sheet.getName();
    // Varaq nomi 'Akt_{number}_{row}' formatida bo'lishi kerak
    if (!name.startsWith('Akt_')) continue;

    const parts = name.split('_');
    if (parts.length < 3) continue;

    const row = parseInt(parts[2], 10);
    if (isNaN(row) || row < 2) continue;

    try {
      // Original fayl manzilini REYESTRdan olish
      const origUrl = reyestr.getRange(row, urlCol).getValue();
      if (!origUrl) throw new Error("REYESTR da original fayl URL si topilmadi.");

      const origSS = SpreadsheetApp.openByUrl(origUrl);
      const origSheetInfo = findActSheet_(origSS); // Use the helper
      if (!origSheetInfo || !origSheetInfo.sheet) throw new Error("Original faylda 'АКТ' varag'i topilmadi.");

      const origSheet = origSheetInfo.sheet;

      // 1. Ma'lumotlarni yig'madan o'qib, originalga yozish
      // Odatda akt formati A1:I72 bo'ladi
      const rangeStr = 'A1:I72';
      const mergedData = sheet.getRange(rangeStr).getValues();
      const mergedFormulas = sheet.getRange(rangeStr).getFormulas();
      const mergedBackgrounds = sheet.getRange(rangeStr).getBackgrounds();
      const mergedFontColors = sheet.getRange(rangeStr).getFontColors();
      
      const targetRange = origSheet.getRange(rangeStr);

      // Formulas vs Values aralash yozish kerak
      const finalValues = [];
      for (let i = 0; i < mergedData.length; i++) {
        const rowData = [];
        for (let j = 0; j < mergedData[i].length; j++) {
          if (mergedFormulas[i][j]) {
            rowData.push(mergedFormulas[i][j]);
          } else {
            rowData.push(mergedData[i][j]);
          }
        }
        finalValues.push(rowData);
      }

      targetRange.setValues(finalValues);
      
      // Kosmetik o'zgarishlarni ham saqlaymiz (agar foydalanuvchi qizartirgan bo'lsa)
      targetRange.setBackgrounds(mergedBackgrounds);
      targetRange.setFontColors(mergedFontColors);

      // 2. Yangilangan ma'lumotlarni REYESTRga yozish
      // "import_readFromActV51_" ImportRoot.js ichida mavjud
      const updatedData = import_readFromActV51_(origSheet);
      
      // REYESTR ga faqat bazaviy maydonlarni yozamiz (STATUS va ERROR ni ezib yubormaymiz)
      writeRow_(reyestr, row, updatedData);

      successCount++;
    } catch (err) {
      errors.push(`${name} qatorida xato: ${err.message}`);
    }
  }

  if (successCount === 0 && errors.length === 0) {
    return { success: false, error: "Yig'ma faylda 'Akt_...' nomli varaqlar topilmadi." };
  }

  let msg = `✅ ${successCount} ta akt original fayllarga va Reyestrga muvaffaqiyatli qayta yozildi.`;
  if (errors.length > 0) {
    msg += `\n⚠️ Xatolar (${errors.length} ta):\n` + errors.slice(0, 5).join('\n');
  }

  return { success: true, message: msg };
}
