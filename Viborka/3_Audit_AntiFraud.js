/**
 * ============================================================
 * FAYL: 4_Audit_AntiFraud.gs
 * VERSION: 24.0 (CLEAN ARCHITECTURE)
 * VAZIFASI: Har bir qatorni tekshiradi: xatoliklar (qizil),
 *           fraud risklari (sariq), yopilgan (yashil).
 *           Natijani Status va Izoh ustunlariga yozadi.
 * ============================================================
 *
 * QOIDALAR:
 *   🔴 XATO    : Birlik yo'q YOKI Narx yo'q (Hajm > 0 bo'lsa)
 *   🟠 XAVF    : Fakt hajmi Rejadan 25% oshiq
 *              : Fakt narxi Smeta narxidan 40% oshiq
 *   🟢 YOPILDI : Fakt >= Reja * 98%
 *   🔵 Qisman  : 0 < Fakt < Reja * 98%
 *   ⬜ Kutilmoqda: Fakt = 0
 */

function runAuditCheck() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Viborka_Shablon');

  if (!sheet) {
    SpreadsheetApp.getUi().alert("❌ 'Viborka_Shablon' topilmadi!");
    return;
  }

  ss.toast('Audit tekshiruvi boshlanmoqda...', '🛡 AUDIT', -1);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var numRows = lastRow - 1;
  var range   = sheet.getRange(2, 1, numRows, 16);
  var data    = range.getValues();

  // Natijalar uchun massivlar (bir marta yozish uchun)
  var backgrounds  = [];
  var fontColors   = [];
  var statusVals   = [];
  var remarkVals   = [];

  // Dropdown uchun ro'yxat
  var STATUS_LIST = ['Кутилмоқда', 'Жараёнда', 'Қисман', 'ЁПИЛДИ', 'ПЕPPАСХОД', 'ХАТО!'];

  for (var i = 0; i < numRows; i++) {
    var row = data[i];

    var matName  = String(row[5]).trim();   // F — Nomi
    var unit     = String(row[7]).trim();   // H — Birlik
    var plan     = round2(row[8]);          // I — Reja
    var fakt     = round2(row[9]);          // J — Fakt
    var cSmeta   = round2(row[10]);         // K — Narx smeta
    var cFakt    = round2(row[11]);         // L — Narx fakt
    var sSmeta   = round2(row[12]);         // M — Summa smeta
    var curStatus = String(row[14]).trim(); // O — Joriy status
    var curNote   = String(row[15]).trim(); // P — Joriy izoh

    // Bo'sh qatorlar — tegmasdan o'tamiz
    if (!matName || matName === '0' || matName === '-') {
      backgrounds.push(new Array(16).fill(null));
      fontColors.push(new Array(16).fill(null));
      statusVals.push([curStatus]);
      remarkVals.push([curNote]);
      continue;
    }

    // ── Summani hisoblash ──
    if (sSmeta === 0 && plan > 0 && cSmeta > 0) sSmeta = round2(plan * cSmeta);

    // ── Tekshiruvlar ──
    var errors  = [];
    var risks   = [];

    // Xatolik: Birlik yo'q
    if (!unit || unit === '0') errors.push('Birlik ko\'rsatilmagan');
    // Xatolik: Narx yo'q (lekin hajm bor)
    if (plan > 0 && cSmeta === 0 && sSmeta === 0) errors.push('Narx ko\'rsatilmagan');

    // Risk: Fakt hajmi Rejadan 25% oshiq
    if (plan > 0 && fakt > plan * 1.25) risks.push('Hajm > 125% rejadan');
    // Risk: Fakt narxi Smeta narxidan 40% oshiq
    if (cSmeta > 0 && cFakt > cSmeta * 1.40) risks.push('Narx > 140% smetadan');

    // ── Holat aniqlash ──
    var completion = plan > 0 ? fakt / plan : 0;
    var bg   = new Array(16).fill(null);
    var font = new Array(16).fill(null);
    var newStatus, newNote;

    if (errors.length > 0) {
      bg.fill('#f4cccc');
      font.fill('#990000');
      newStatus = 'ХАТО!';
      newNote   = '🆘 XATO: ' + errors.join('; ');

    } else if (risks.length > 0) {
      bg.fill('#fff2cc');
      font.fill('#7f4f00');
      newStatus = 'ПЕPPАСХОД';
      newNote   = '⚠ RISK: ' + risks.join('; ');

    } else if (plan > 0 && completion >= 0.98) {
      bg.fill('#d9ead3');
      font.fill('#274e13');
      newStatus = 'ЁПИЛДИ';
      newNote   = curNote; // Oldingi izohni saqlaymiz

    } else if (fakt > 0) {
      // Qisman kelgan — fon o'zgarmaydi, faqat status
      newStatus = 'Қисман';
      newNote   = curNote;

    } else {
      // Hech nima kelmagan
      newStatus = 'Кутилмоқда';
      newNote   = curNote;
    }

    backgrounds.push(bg);
    fontColors.push(font);
    statusVals.push([newStatus]);
    remarkVals.push([newNote]);
  }

  // ── NATIJALARNI YOZISH (bir marta — tezkor) ──
  range.setBackgrounds(backgrounds);
  range.setFontColors(fontColors);
  sheet.getRange(2, 15, numRows, 1).setValues(statusVals);
  sheet.getRange(2, 16, numRows, 1).setValues(remarkVals);

  // ── DROPDOWN o'rnatish (xato bermaydi, boshqa so'z ham yozsa bo'ladi) ──
  var dv = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_LIST)
    .setAllowInvalid(true)
    .setHelpText('Ro\'yxatdan tanlang yoki o\'z qiymatini kiriting')
    .build();
  sheet.getRange(2, 15, numRows, 1).setDataValidation(dv);

  // ── Hisobot ──
  var errorCount = statusVals.filter(function(s) { return s[0] === 'ХАТО!'; }).length;
  var riskCount  = statusVals.filter(function(s) { return s[0] === 'ПЕPPАСХОД'; }).length;
  var doneCount  = statusVals.filter(function(s) { return s[0] === 'ЁПИЛДИ'; }).length;

  ss.toast(
    '✅ Audit yakunlandi | Xato: ' + errorCount + ' | Risk: ' + riskCount + ' | Yopildi: ' + doneCount,
    '🛡 AUDIT', 6
  );
}