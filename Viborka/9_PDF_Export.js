/**
 * ============================================================
 * FAYL: 9_PDF_Export.gs
 * VERSION: 1.0
 * VAZIFASI: Hisobot ni PDF qilish va email orqali yuborish.
 *           Snabjenets WhatsApp/Telegram ga yuborish uchun.
 * ============================================================
 */

/**
 * Hozirgi "Hisobot" varag'ini PDF ga aylantiradi.
 * Foydalanuvchiga yuklash havolasi beradi.
 */
function exportCurrentReportToPDF() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Hisobot');

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      '❌ Hisobot topilmadi',
      'Avval biron bir hisobotni tayyorlang:\n' +
      '• Snabjenets paneli\n' +
      '• Obyekt bo\'yicha\n' +
      '• Material qidirish\n' +
      '• Defitsit',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  if (sheet.getLastRow() < 4) {
    SpreadsheetApp.getUi().alert('Hisobot bo\'sh.');
    return;
  }

  try {
    var pdfBlob = _generatePDF(ss, sheet);
    var fileName = pdfBlob.getName();

    // Drive ga vaqtinchalik yuklash
    var folder = _ensureReportsFolder();
    var file = folder.createFile(pdfBlob);
    var url = file.getUrl();

    // Foydalanuvchiga havola
    var html = '<div style="font-family:Arial;padding:20px;text-align:center">' +
      '<div style="font-size:48px;margin-bottom:8px">📄</div>' +
      '<h2 style="margin:0 0 12px;color:#0d47a1">PDF tayyor!</h2>' +
      '<p style="color:#666;margin:0 0 20px">Quyidagi tugmalar orqali ochib oling:</p>' +
      '<a href="' + url + '" target="_blank" ' +
      'style="display:inline-block;padding:12px 24px;background:#1565c0;color:#fff;' +
      'text-decoration:none;border-radius:6px;font-weight:bold;margin:4px">' +
      '👁 PDF ni ko\'rish</a>' +
      '<a href="' + file.getDownloadUrl() + '" ' +
      'style="display:inline-block;padding:12px 24px;background:#2e7d32;color:#fff;' +
      'text-decoration:none;border-radius:6px;font-weight:bold;margin:4px">' +
      '⬇ Yuklab olish</a>' +
      '<p style="margin:20px 0 0;font-size:12px;color:#999">' +
      'Fayl: ' + fileName + '<br>' +
      'Drive papkasi: TITAN_Hisobotlar/</p>' +
      '<p style="margin:16px 0 0;font-size:13px;color:#444">' +
      '📱 Telefon orqali ochsangiz — WhatsApp/Telegram ga jo\'natishingiz mumkin</p>' +
      '</div>';

    var output = HtmlService.createHtmlOutput(html).setWidth(450).setHeight(340);
    SpreadsheetApp.getUi().showModalDialog(output, '✅ PDF yaratildi');

  } catch(e) {
    SpreadsheetApp.getUi().alert('❌ PDF yaratishda xato:\n' + e.message);
    Logger.log('PDF xato: ' + e.toString());
  }
}

/**
 * PDF ni email orqali yuborish
 */
function sendCurrentReportByEmail() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName('Hisobot');

  if (!sheet || sheet.getLastRow() < 4) {
    ui.alert('Avval hisobotni tayyorlang.');
    return;
  }

  // Saqlangan email yoki yangi so'rash
  var saved = PropertiesService.getDocumentProperties().getProperty('LAST_EMAIL') || '';

  var resp = ui.prompt(
    '📧 Email yuborish',
    'Email manzilini kiriting (vergul bilan ajratib bir nechta):\n\n' +
    (saved ? 'Oxirgi: ' + saved : ''),
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var emails = resp.getResponseText().trim();
  if (!emails) return;

  PropertiesService.getDocumentProperties().setProperty('LAST_EMAIL', emails);

  try {
    var pdfBlob = _generatePDF(ss, sheet);
    var subject = 'TITAN PRO — ' + sheet.getRange('A1').getValue();
    var body =
      'Assalomu alaykum!\n\n' +
      'TITAN PRO tizimidan tayyorlangan hisobot ilova qilindi.\n\n' +
      'Sana: ' + Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm') + '\n' +
      'Yuboruvchi: ' + Session.getActiveUser().getEmail() + '\n\n' +
      '— TITAN PRO avtomatik xizmat';

    MailApp.sendEmail({
      to: emails,
      subject: subject,
      body: body,
      attachments: [pdfBlob]
    });

    ui.alert(
      '✅ Email yuborildi!\n\n' +
      'Manzil: ' + emails + '\n' +
      'Mavzu: ' + subject + '\n' +
      'PDF hajmi: ' + Math.round(pdfBlob.getBytes().length / 1024) + ' KB'
    );
  } catch(e) {
    ui.alert('❌ Yuborishda xato:\n' + e.message);
    Logger.log('Email xato: ' + e.toString());
  }
}

/**
 * PDF blob yaratish (Hisobot varag'idan)
 */
function _generatePDF(ss, sheet) {
  var ssId = ss.getId();
  var sheetId = sheet.getSheetId();

  var url = 'https://docs.google.com/spreadsheets/d/' + ssId + '/export?' + [
    'exportFormat=pdf', 'format=pdf',
    'gid=' + sheetId,
    'size=A4',
    'portrait=false',           // landscape (yotgan)
    'fitw=true',                // ekranga sig'sin
    'sheetnames=false',
    'printtitle=false',
    'pagenumbers=true',
    'gridlines=false',
    'fzr=true',                 // muzlatilgan qatorlar saqlansin
    'top_margin=0.4',
    'bottom_margin=0.4',
    'left_margin=0.4',
    'right_margin=0.4'
  ].join('&');

  var token = ScriptApp.getOAuthToken();
  var response = UrlFetchApp.fetch(url, {
    headers: { 'Authorization': 'Bearer ' + token }
  });

  // Fayl nomi
  var title = String(sheet.getRange('A1').getValue() || 'Hisobot')
    .replace(/[^\w\sа-яА-Я]/g, '').substring(0, 60).trim();
  var ts = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd_HHmm');
  var fileName = 'TITAN_' + title + '_' + ts + '.pdf';

  return response.getBlob().setName(fileName);
}

/**
 * Drive da hisobotlar papkasi
 */
function _ensureReportsFolder() {
  var folders = DriveApp.getFoldersByName('TITAN_Hisobotlar');
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder('TITAN_Hisobotlar');
}

// ════════════════════════════════════════════════════════════
// KUNLIK EMAIL XULOSASI (avtomatik)
// ════════════════════════════════════════════════════════════

function sendDailyEmailReport() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getDocumentProperties();
  var email = props.getProperty('DAILY_EMAIL');
  if (!email) return;

  try {
    // Avval defitsit hisobotini yangilab, keyin yuboramiz
    if (typeof reportDeficit === 'function') {
      reportDeficit();
    }

    var sheet = ss.getSheetByName('Hisobot');
    if (!sheet) return;

    var pdfBlob = _generatePDF(ss, sheet);
    var stats = _quickStats(ss);

    var subject = '📊 TITAN — Кунлик ҳисобот: ' +
                  Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');

    var body =
      'Хайрли тонг!\n\n' +
      'Лойиҳа ҳолати:\n' +
      '─────────────────────\n' +
      '📦 Жами материал: ' + stats.totalMaterials + '\n' +
      '🆘 Дефицит: ' + stats.deficitCount + ' хил\n' +
      '✅ Ёпилган: ' + stats.closedCount + ' хил\n' +
      '⚠ Перерасход: ' + stats.fraudCount + ' хил\n\n' +
      '💰 Бажарилиш: ' +
      (stats.totalSmeta > 0 ? Math.round(stats.totalFakt/stats.totalSmeta*100) : 0) + '%\n' +
      '   Сметa: ' + Math.round(stats.totalSmeta).toLocaleString() + ' сум\n' +
      '   Факт:  ' + Math.round(stats.totalFakt).toLocaleString() + ' сум\n\n' +
      'Тўлиқ дефицит рўйхати илова қилинди.\n\n' +
      '— TITAN PRO автоматик хизмат';

    MailApp.sendEmail({
      to: email, subject: subject, body: body,
      attachments: [pdfBlob]
    });
    Logger.log('✅ Kunlik email yuborildi: ' + email);
  } catch(e) {
    Logger.log('❌ Kunlik email xato: ' + e.toString());
  }
}

function _quickStats(ss) {
  if (typeof _calculateStats === 'function') return _calculateStats(ss);
  return { totalMaterials: 0, deficitCount: 0, closedCount: 0, fraudCount: 0, totalSmeta: 0, totalFakt: 0 };
}