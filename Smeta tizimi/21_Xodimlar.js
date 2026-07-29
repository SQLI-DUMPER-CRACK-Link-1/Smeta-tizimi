/********************************************************************
 * 21_Xodimlar.js — XODIMLAR VA ROLLAR BOSHQARUVI
 * ==================================================================
 * MAQSAD: Saytga kiruvchilarning ro'yxati va rollarini boshqarish
 *         Google Sheets orqali. Cloudflare endi 'RUXSAT' o'zgaruvchisiga
 *         emas, shu jadvalga qarab ruxsat beradi.
 ********************************************************************/

/**
 * Berilgan email uchun rolni qaytaradi.
 * Agar `_XODIMLAR` varag'i yo'q bo'lsa, yaratadi va faqat superadminni kiritib qo'yadi.
 */
function apiXodimRolOl(email, superadminFallback) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_XODIMLAR');
  
  if (!sheet) {
    sheet = ss.insertSheet('_XODIMLAR');
    sheet.appendRow(['Email', 'Rol']);
    sheet.getRange('A1:B1').setFontWeight('bold');
    if (superadminFallback) {
      sheet.appendRow([superadminFallback, 'superadmin']);
    }
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][0]).trim().toLowerCase();
    var rowRol = String(data[i][1]).trim().toLowerCase();
    if (rowEmail === String(email).trim().toLowerCase()) {
      return rowRol;
    }
  }
  
  return null;
}
