function getLogsForDebug() {
  var sp = PropertiesService.getScriptProperties();
  var log = sp.getProperty('NAVBAT_LOG') || '[]';
  var tryMap = sp.getProperty('NAVBAT_TRY') || '{}';
  console.log("LOG:", log);
  console.log("TRY:", tryMap);
  return {log: log, tryMap: tryMap};
}

/**
 * Supabase loyihasini ulash va tekshirish uchun yordamchi funksiya.
 * Supabase-dan olingan URL va Service Role kalitlarini quyiga yozib,
 * ushbu funksiyani Apps Script muharririda tanlab RUN tugmasini bosing.
 */
function debugSupabaseUlash() {
  var url = "https://tuoyrzadkgoltpqkdiyx.supabase.co"; // masalan: https://xyz.supabase.co (buni ham almashtiring)
  var serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1b3lyemFka2dvbHRwcWtkaXl4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDU5NzY5NSwiZXhwIjoyMDk2MTczNjk1fQ.tzmDyce0aYtFNlOT1FrV5L6eyDITgp3Y5hAh1AFBmwY"; // service_role kaliti (secret API key)
  
  if (url === "YOUR_SUPABASE_PROJECT_URL") {
    Logger.log("Iltimos, avval haqiqiy Supabase URL va service_role kalitlarini yozing!");
    return;
  }
  
  var res = supabaseSozlash(url, serviceKey);
  Logger.log(res);
  
  try {
    var testRes = supabaseTest();
    Logger.log("TEST NATIJASI: " + testRes);
    Logger.log("✓ Muvaffaqiyatli ulandi! Endi 'supabaseToliqSinx()' funksiyasini ishga tushirsangiz bo'ladi.");
  } catch(e) {
    Logger.log("✗ Ulanishda xato yuz berdi: " + e);
  }
}

/**
 * Ushbu funksiya belgilangan fayldagi keraksiz (bo'sh) qator va ustunlarni o'chirib,
 * faylni optimallashtiradi. Bu orqali "Service Spreadsheets timed out" xatolarini bartaraf etish mumkin.
 * 
 * Ishga tushirish uchun: Apps Script muharririda ushbu funksiyani tanlang va RUN tugmasini bosing.
 */
function debugOptimallashtirFayl() {
  var fileId = "1cv9yuEJsvuXUmGazwfh6DO-QeTGzzPIV5L4kZCOP-jM"; // Xatolik bergan fayl IDsi
  
  Logger.log("Fayl ochilmoqda: " + fileId);
  var ss;
  try {
    ss = SpreadsheetApp.openById(fileId);
  } catch(e) {
    Logger.log("✗ Xato: Faylni ochib bo'lmadi (Google servislari yuklangan yoki fayl haddan tashqari og'ir): " + e);
    return;
  }
  
  Logger.log("✓ Fayl muvaffaqiyatli ochildi: " + ss.getName());
  var sheets = ss.getSheets();
  
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var sheetName = sh.getName();
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    var maxRows = sh.getMaxRows();
    var maxCols = sh.getMaxColumns();
    
    Logger.log("Varaq: '" + sheetName + "' (Ishlatilgan: " + lastRow + "x" + lastCol + " | Maksimal: " + maxRows + "x" + maxCols + ")");
    
    var deletedRows = 0;
    var deletedCols = 0;
    
    // Bo'sh ustunlarni o'chirish
    if (maxCols > lastCol + 2 && maxCols > 26) {
      var colsToDelete = maxCols - Math.max(lastCol + 2, 26);
      if (colsToDelete > 0) {
        try {
          sh.deleteColumns(maxCols - colsToDelete + 1, colsToDelete);
          deletedCols = colsToDelete;
        } catch(e) {
          Logger.log("  [!] Ustunlarni o'chirishda xato: " + e);
        }
      }
    }
    
    // Bo'sh qatorlarni o'chirish
    if (maxRows > lastRow + 5) {
      var rowsToDelete = maxRows - (lastRow + 5);
      if (rowsToDelete > 0) {
        try {
          sh.deleteRows(lastRow + 6, rowsToDelete);
          deletedRows = rowsToDelete;
        } catch(e) {
          Logger.log("  [!] Qatorlarni o'chirishda xato: " + e);
        }
      }
    }
    
    if (deletedRows > 0 || deletedCols > 0) {
      Logger.log("  -> " + deletedRows + " ta ortiqcha qator va " + deletedCols + " ta ortiqcha ustun o'chirildi.");
    } else {
      Logger.log("  -> Optimallashtirish talab etilmadi.");
    }
  }
  
  SpreadsheetApp.flush();
  Logger.log("✓ Faylni optimallashtirish yakunlandi.");
}


