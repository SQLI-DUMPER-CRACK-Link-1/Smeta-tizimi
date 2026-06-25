/**
 * ============================================================
 * FAYL: 0_Master_Triggers.gs  V.34 (3 TUGMA)
 *
 * MENYU:
 *   📋 Nazorat     — sahifaga o'tish
 *   ♻ YANGILASH    — hammasini 1 tugmada
 *   🏠 Bosh sahifa — dashboard
 *   📊 Hisobotlar  — submenu
 *   🔧 Sozlamalar  — submenu
 * ============================================================
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ TITAN PRO')
    .addItem('📋 Nazorat sahifasi', 'goNazorat')
    .addItem('♻ YANGILASH (hammasini)', 'fullRefresh')
    .addItem('🏠 Bosh sahifa', 'goHome')
    .addSeparator()
    .addSubMenu(ui.createMenu('📊 Hisobotlar')
      .addItem('🎯 Snabjenets paneli', 'openSnabPanel')
      .addItem('📍 Obyekt bo\'yicha', 'reportByObject')
      .addItem('🔍 Material qidirish', 'reportByMaterial')
      .addItem('🏷  Kategoriya bo\'yicha', 'reportByCategory')
      .addItem('🆘 Defitsit hisoboti', 'reportDeficit')
      .addSeparator()
      .addItem('📄 PDF qilish', 'exportCurrentReportToPDF')
      .addItem('📧 Email yuborish', 'sendCurrentReportByEmail')
    )
    .addSubMenu(ui.createMenu('🔧 Sozlamalar')
      .addItem('📋 Nazorat yaratish/yangilash', 'buildNazorat')
      .addItem('🔄 Zamena tarixini ochish', 'buildZamenaSheet')
      .addItem('🔍 Diagnostika', 'diagnoseNazorat')
      .addSeparator()
      .addItem('🧹 Hisobotlarni tozalash', 'clearAllReports')
      .addItem('⏰ Tungi avtomatika', 'setupNightlyTrigger')
      .addItem('🗑 Triggerlarni o\'chirish', 'deleteAllTriggers')
    )
    .addToUi();
}

// ════════════════════════════════════════════════════════════
// ♻ YANGILASH — BITTA TUGMA HAMMASI
// ════════════════════════════════════════════════════════════
function fullRefresh() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var naz = ss.getSheetByName('Nazorat');
  if (!naz) {
    var resp = SpreadsheetApp.getUi().alert(
      'Nazorat topilmadi. Yaratilsinmi?', SpreadsheetApp.getUi().ButtonSet.YES_NO);
    if (resp === SpreadsheetApp.getUi().Button.YES) buildNazorat();
    return;
  }

  ss.toast('1/5 — Viborka J + zamena...', '♻', -1);
  try { refreshAllNazorat_silent(); } catch(e) { Logger.log('1: '+e); }

  ss.toast('2/5 — Viborka formatlash...', '♻', -1);
  try { setupViborkaFormatting(); } catch(e) { Logger.log('2: '+e); }

  ss.toast('3/5 — Z_Obyekt sahifalar...', '♻', -1);
  try { if (typeof runTitanAiPro === 'function') runTitanAiPro(); } catch(e) { Logger.log('3: '+e); }

  ss.toast('4/5 — Dashboard...', '♻', -1);
  try { if (typeof buildDashboard === 'function') buildDashboard(); } catch(e) { Logger.log('4: '+e); }

  ss.toast('5/5 — Bosh sahifa...', '♻', -1);
  try { buildHomePage(); } catch(e) { Logger.log('5: '+e); }

  ss.toast('✅ HAMMASI YANGILANDI!', '♻', 5);
}

// ════════════════════════════════════════════════════════════
// TRIGGER — onEdit
// ════════════════════════════════════════════════════════════
function masterOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var name = e.range.getSheet().getName();
    if (name === 'Nazorat' && typeof onNazoratEdit === 'function') {
      onNazoratEdit(e);
    }
  } catch(err) { Logger.log('masterOnEdit: '+err); }
}

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var name = e.range.getSheet().getName();
    if (name === 'Nazorat' && typeof onNazoratEdit === 'function') {
      onNazoratEdit(e);
    }
  } catch(err) { Logger.log('onEdit: '+err); }
}

// ════════════════════════════════════════════════════════════
// NAVIGATSIYA
// ════════════════════════════════════════════════════════════
function goHome() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var home = ss.getSheetByName('🏠 Bosh sahifa');
  if (!home) { buildHomePage(); home = ss.getSheetByName('🏠 Bosh sahifa'); }
  if (home) ss.setActiveSheet(home);
}

function goNazorat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var naz = ss.getSheetByName('Nazorat');
  if (!naz) {
    var resp = SpreadsheetApp.getUi().alert(
      'Nazorat mavjud emas. Yaratilsinmi?', SpreadsheetApp.getUi().ButtonSet.YES_NO);
    if (resp === SpreadsheetApp.getUi().Button.YES) buildNazorat();
    return;
  }
  ss.setActiveSheet(naz);
}

// ════════════════════════════════════════════════════════════
// VIBORKA FORMATLASH
// ════════════════════════════════════════════════════════════
function setupViborkaFormatting() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Viborka_Shablon');
  if (!sheet) return;
  var lastRow = Math.max(sheet.getLastRow(), 2);
  var range = sheet.getRange(2, 1, lastRow - 1, 16);
  sheet.clearConditionalFormatRules();
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2>0;FIND("🔄";$P2)>0)')
      .setBackground('#f3e5f5').setFontColor('#4a148c')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2>0;ISNUMBER($J2);$J2>$I2*1.05)')
      .setBackground('#e3f2fd').setFontColor('#0d47a1')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2>0;ISNUMBER($J2);$J2>=$I2*0.98)')
      .setBackground('#c8e6c9').setFontColor('#1b5e20')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2>0;ISNUMBER($J2);$J2>0;$J2<$I2*0.98)')
      .setBackground('#fff9c4').setFontColor('#f57f17')
      .setRanges([range]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($I2>0;OR(NOT(ISNUMBER($J2));$J2=0;$J2=""))')
      .setBackground('#ffcdd2').setFontColor('#b71c1c')
      .setRanges([range]).build()
  ]);
}

// ════════════════════════════════════════════════════════════
// YORDAMCHI
// ════════════════════════════════════════════════════════════
function clearAllReports() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var n = 0;
  ss.getSheets().forEach(function(sh) {
    var name = sh.getName();
    if (name.indexOf('Z_')===0||name==='Zayavka_Tizimi'||name==='Hisobot') {
      var last = sh.getLastRow();
      if (last>=2) sh.getRange(2,1,last-1,sh.getLastColumn()).clearContent().clearFormat();
      n++;
    }
  });
  ss.toast(n+' ta varaq tozalandi.','🧹',4);
}

function setupNightlyTrigger() {
  _removeTriggers('runNightlyTasks');
  ScriptApp.newTrigger('runNightlyTasks')
    .timeBased().everyDays(1).inTimezone('Asia/Tashkent').atHour(3).create();
  SpreadsheetApp.getUi().alert('✅ Tungi trigger (03:00)');
}

function deleteAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t){ScriptApp.deleteTrigger(t);});
  SpreadsheetApp.getActiveSpreadsheet().toast('Triggerlar o\'chirildi','🗑',3);
}

function _removeTriggers(name) {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction()===name) ScriptApp.deleteTrigger(t);
  });
}

function runNightlyTasks() {
  try { fullRefresh(); } catch(e) { Logger.log('Tungi: '+e); }
}