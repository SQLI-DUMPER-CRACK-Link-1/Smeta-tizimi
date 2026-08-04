/********************************************************************
 * 21_Xodimlar.js — XODIMLAR VA ROLLAR BOSHQARUVI
 * ==================================================================
 * MAQSAD: Saytga kiruvchilarning login, parol va rollarini boshqarish
 *         Google Sheets orqali. Cloudflare kirish vaqtida shu orqali tekshiradi.
 ********************************************************************/

/**
 * Berilgan login va parol to'g'riligini tekshirib, rolni qaytaradi.
 * Agar `_XODIMLAR` varag'i yo'q bo'lsa, yaratadi va faqat superadminni kiritib qo'yadi.
 */
function apiKirishTekshir(login, parol) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_XODIMLAR');
  
  if (!sheet) {
    sheet = ss.insertSheet('_XODIMLAR');
    sheet.appendRow(['Login', 'Parol', 'Rol']);
    sheet.getRange('A1:C1').setFontWeight('bold');
    sheet.setColumnWidth(1, 150);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 100);
    // Boshlang'ich super admin
    sheet.appendRow(['admin', '570632', 'superadmin']);
  }

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowLogin = String(data[i][0]).trim().toLowerCase();
    var rowParol = String(data[i][1]).trim();
    var rowRol = String(data[i][2]).trim().toLowerCase();
    
    if (rowLogin === String(login).trim().toLowerCase() && rowParol === String(parol).trim()) {
      return rowRol; // Rolni qaytaradi
    }
  }
  
  return null; // Topilmadi yoki parol noto'g'ri
}
