/**
 * 92_Kuzatuv.js
 * Tizimdagi xatoliklarni va sekin ishlash holatlarini (observability)
 * yozib borish uchun maxsus modul.
 */

function apiXatoYoz(manba, xabar, kim, qoshimcha) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('_XATOLAR');
    
    // Agar varaq yo'q bo'lsa, yaratamiz
    if (!sheet) {
      sheet = ss.insertSheet('_XATOLAR');
      sheet.appendRow(['Vaqt', 'Manba', 'Xabar', 'Foydalanuvchi', 'Qo\'shimcha ma\'lumot']);
      sheet.getRange('A1:E1').setFontWeight('bold').setBackground('#f4c7c3');
      sheet.setFrozenRows(1);
    }
    
    const vaqt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    const kimStr = kim || 'Noma\'lum';
    const qoshimchaStr = typeof qoshimcha === 'object' ? JSON.stringify(qoshimcha) : String(qoshimcha || '');
    
    sheet.appendRow([vaqt, manba, xabar, kimStr, qoshimchaStr]);
    
    return true;
  } catch (e) {
    console.error("Xatoni yozishda xatolik:", e);
    return false;
  }
}
