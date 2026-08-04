function getLogsForDebug() {
  var sp = PropertiesService.getScriptProperties();
  var log = sp.getProperty('NAVBAT_LOG') || '[]';
  var tryMap = sp.getProperty('NAVBAT_TRY') || '{}';
  console.log("LOG:", log);
  console.log("TRY:", tryMap);
  return {log: log, tryMap: tryMap};
}

/**
 * Supabase ulanishini TEKSHIRADI (diagnostika).
 * ⚠️ XAVFSIZLIK: service_role kalit KODGA YOZILMAYDI (avval hardcode edi → sizib ketish xavfi).
 * Kalit faqat Script Property'да (SUPABASE_URL / SUPABASE_KEY) saqlanadi.
 * Yangi kalit o'rnatish (bir marta): editorда → supabaseSozlash('https://xxx.supabase.co','service_role_key')
 * Keyin shu funksiyani RUN qilib ulanishni tekshiring.
 */
function debugSupabaseUlash() {
  var cfg = (typeof _sbCfg === 'function') ? _sbCfg() : null;
  if (!cfg) {
    Logger.log("❌ Supabase sozlanmagan. Avval editorда RUN qiling:\n" +
               "   supabaseSozlash('https://SIZNING.supabase.co', 'SERVICE_ROLE_KEY')");
    return "Sozlanmagan — supabaseSozlash(url,key) ni ishga tushiring.";
  }
  Logger.log("URL: " + cfg.url + "  (kalit propда, uzunligi: " + String(cfg.key||'').length + ")");
  try {
    var testRes = supabaseTest();
    Logger.log("✓ TEST: " + testRes + "\nEndi supabaseToliqSinx() ni ishga tushirsangiz bo'ladi.");
    return testRes;
  } catch(e) {
    Logger.log("✗ Ulanishda xato: " + e);
    return "Xato: " + e;
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


/* ============ DIAGNOSTIKA: narx topilmayotgan material uchun ============ */
function diagNarxQidirish(){
  var logContent = [];
  function log(msg){ logContent.push(msg); }
  
  var QIDIRUV = '1ПП';  // <-- qisqartirib qidiramiz
  
  var obs = papkaSkan();
  log('=== AGGRESSIVE DIAGNOSTIKA: "1ПП" qatnashgan obyektlar ===');
  
  for(var oi=0; oi<obs.length; oi++){
    var ob = obs[oi];
    if(ob.obyekt.indexOf("Suniy ko'l") < 0 && ob.obyekt.indexOf("СКВАЖИНА") < 0) continue;
    
    log('\n────── OBYEKT: ' + ob.obyekt + ' ──────');
    
    if(ob.svodFile){
      var svodSS;
      try{ svodSS = _openAsSheet(ob.svodFile, ob.folderId); }catch(e){ continue; }
      log('  Svod fayl nomi: ' + svodSS.getName());
      
      var sheets = svodSS.getSheets();
      for(var s=0; s<sheets.length; s++){
        var sh = sheets[s];
        var shName = sh.getName();
        var last = sh.getLastRow();
        if(last < 1) continue;
        var maxc = sh.getLastColumn();
        if(maxc < 1) continue;
        var v = sh.getRange(1,1,last,maxc).getValues();
        
        for(var i=0; i<v.length; i++){
          for(var j=0; j<v[i].length; j++){
            var cellVal = String(v[i][j]||'').toUpperCase();
            if(cellVal.indexOf('1ПП') >= 0 || cellVal.indexOf('1PP') >= 0){
              log('    🔥 TOPIB OLINDI! Svodka fayli: ' + svodSS.getName() + ' | Varaq: "' + shName + '" | Qator: ' + (i+1) + ' | Ustun: ' + (j+1) + ' | QIYMAT: "' + String(v[i][j]) + '"');
            }
          }
        }
      }
      _cleanupTmp(svodSS);
    }
  }
  log('\n=== DIAGNOSTIKA TUGADI ===');
  
  var name = "diag_log_" + new Date().getTime() + ".txt";
  DriveApp.createFile(name, logContent.join('\n'));
}

function _diagCharCodes(s){
  var out = [];
  for(var i=0; i<Math.min(s.length,40); i++){
    out.push(s.charAt(i)+'('+s.charCodeAt(i)+')');
  }
  return out.join(' ');
}


function debugTestSuniyKol() {
  var folders = DriveApp.getFoldersByName("Suniy ko'l");
  if (!folders.hasNext()) return "Folder not found";
  var f = folders.next();
  var obs = _skanObyekt(f, {});
  var res = obs.map(function(o) { return o.obyekt + " | svod=" + (o.svodFile ? o.svodFile.getName() : "NULL"); });
  return JSON.stringify(res, null, 2);
}
