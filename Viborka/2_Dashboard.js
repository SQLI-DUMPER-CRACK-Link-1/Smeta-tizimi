/**
 * ============================================================
 * FAYL: 3_Dashboard.gs
 * VERSION: 24.0 (CLEAN ARCHITECTURE)
 * VAZIFASI: Loyihaning moliyaviy tahlilini ko'rsatuvchi
 *           "Analitika" varag'ini yaratadi.
 * ============================================================
 */

function buildDashboard() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var src         = ss.getSheetByName('Viborka_Shablon');

  if (!src) {
    SpreadsheetApp.getUi().alert("❌ 'Viborka_Shablon' topilmadi!");
    return;
  }

  ss.toast('Dashboard tayyorlanmoqda...', '📊 ANALITIKA', -1);

  var lastRow = src.getLastRow();
  if (lastRow < 2) return;

  var data = src.getRange(2, 1, lastRow - 1, 16).getValues();

  // ── Ma'lumotlarni yig'ish ──
  var byRazdel    = {};   // { razdel: { smeta, fakt, categories: { kat: { smeta, fakt } } } }
  var totalSmeta  = 0;
  var totalFakt   = 0;
  var totalPlan   = 0;   // jismoniy hajm (birlikda)
  var totalFakt_v = 0;

  for (var i = 0; i < data.length; i++) {
    var row    = data[i];
    var rawMat = String(row[5]).trim();
    if (!rawMat || rawMat === '0') continue;

    var razdel = String(row[3]).trim() || 'Boshqa';
    var edIzm  = normalizeUnit(String(row[7]).trim());
    var plan   = round2(row[8]);
    var fakt   = round2(row[9]);
    var cSmeta = round2(row[10]);
    var cFakt  = round2(row[11]);
    var sSmeta = round2(row[12]);
    var sFakt  = round2(row[13]);

    if (sSmeta === 0 && plan > 0 && cSmeta > 0) sSmeta = round2(plan * cSmeta);
    if (sFakt  === 0 && fakt > 0 && cFakt  > 0) sFakt  = round2(fakt * cFakt);

    var cleanName = AI_NormalizeName(rawMat);
    var category  = AI_Categorize(cleanName, edIzm, razdel);

    if (!byRazdel[razdel]) {
      byRazdel[razdel] = { smeta: 0, fakt: 0, planV: 0, faktV: 0, categories: {} };
    }
    if (!byRazdel[razdel].categories[category]) {
      byRazdel[razdel].categories[category] = { smeta: 0, fakt: 0 };
    }

    byRazdel[razdel].smeta  += sSmeta;
    byRazdel[razdel].fakt   += sFakt;
    byRazdel[razdel].planV  += plan;
    byRazdel[razdel].faktV  += fakt;
    byRazdel[razdel].categories[category].smeta += sSmeta;
    byRazdel[razdel].categories[category].fakt  += sFakt;

    totalSmeta  += sSmeta;
    totalFakt   += sFakt;
    totalPlan   += plan;
    totalFakt_v += fakt;
  }

  totalSmeta  = round2(totalSmeta);
  totalFakt   = round2(totalFakt);
  var farq    = round2(totalSmeta - totalFakt);
  var pct     = totalSmeta > 0 ? totalFakt / totalSmeta : 0;
  var volPct  = totalPlan  > 0 ? totalFakt_v / totalPlan : 0;
  var today   = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm');

  // ── Analitika varag'i ──
  var dash = ss.getSheetByName('Analitika') || ss.insertSheet('Analitika');
  dash.clear();
  dash.clearConditionalFormatRules();

  // ─────────────────────────────────────────────────────────
  // KPI BLOKI (1–7 qator)
  // ─────────────────────────────────────────────────────────
  var COLS = 5;

  // Sarlavha
  dash.getRange(1, 1, 1, COLS).merge()
    .setValue('YANGI O\'ZBEKISTON — LOYIHA MONITORINGI  |  ' + today)
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontSize(13).setFontWeight('bold').setHorizontalAlignment('center');
  dash.setRowHeight(1, 40);

  // KPI qatorlari
  var kpiData = [
    ['💰 Umumiy smeta (so\'m):',    totalSmeta,  '', '📊 Moliyaviy bajarilish (%):', pct],
    ['💳 Haqiqiy xarajat (so\'m):', totalFakt,   '', '📦 Jismoniy hajm (%):', volPct],
    ['⚖ Farq (tejam/oshim):',      farq,         '', farq >= 0 ? '✅ TEJAM' : '🚨 PERERASXOD', ''],
  ];

  dash.getRange(3, 1, 3, COLS).setValues(kpiData);

  // KPI formatlash
  dash.getRange('B3:B5').setNumberFormat('#,##0').setFontSize(12).setFontWeight('bold');
  dash.getRange('E3').setNumberFormat('0.0%').setFontSize(12).setFontWeight('bold');
  dash.getRange('E4').setNumberFormat('0.0%').setFontSize(12).setFontWeight('bold');
  dash.getRange('B5').setNumberFormat('#,##0');
  if (farq >= 0) {
    dash.getRange('B5').setFontColor('#1b5e20').setFontWeight('bold');
    dash.getRange('D5').setFontColor('#1b5e20').setFontWeight('bold');
  } else {
    dash.getRange('B5').setFontColor('#b71c1c').setFontWeight('bold');
    dash.getRange('D5').setFontColor('#b71c1c').setFontWeight('bold');
  }

  // Bo'linuvchi chiziq
  dash.getRange(6, 1, 1, COLS).merge()
    .setValue('')
    .setBackground('#e8eaf6');
  dash.setRowHeight(6, 6);

  // ─────────────────────────────────────────────────────────
  // JADVAL SARLAVHASI (7-qator)
  // ─────────────────────────────────────────────────────────
  dash.getRange(7, 1, 1, COLS)
    .setValues([['📁 Bo\'lim (Раздел)', '🛠 Kategoriya', '💎 Smeta (so\'m)', '🚛 Fakt (so\'m)', '📈 Farq (tejam)']])
    .setBackground('#37474f').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // ─────────────────────────────────────────────────────────
  // MA'LUMOTLAR QATORLARI (8-qatordan)
  // ─────────────────────────────────────────────────────────
  var output = [];
  Object.keys(byRazdel).sort().forEach(function(r) {
    var rd = byRazdel[r];
    var rSm = round2(rd.smeta), rFk = round2(rd.fakt);
    var rFarq = round2(rSm - rFk);
    var rPct  = rSm > 0 ? (rFk / rSm * 100).toFixed(1) + '%' : '—';

    // Razdel total qatori
    output.push([r + ' [' + rPct + ']', '◈ JAMI', rSm, rFk, rFarq]);

    // Kategoriyalar
    Object.keys(rd.categories).sort().forEach(function(kat) {
      var c = rd.categories[kat];
      var kSm = round2(c.smeta), kFk = round2(c.fakt);
      output.push(['', kat, kSm, kFk, round2(kSm - kFk)]);
    });
  });

  if (output.length > 0) {
    var startRow = 8;
    dash.getRange(startRow, 1, output.length, COLS).setValues(output);
    dash.getRange(startRow, 3, output.length, 3).setNumberFormat('#,##0');

    // Razdel satrlarini qalinroq qilish
    var vals = dash.getRange(startRow, 2, output.length, 1).getValues();
    for (var j = 0; j < vals.length; j++) {
      if (String(vals[j][0]).indexOf('◈') !== -1) {
        dash.getRange(startRow + j, 1, 1, COLS)
          .setBackground('#eceff1')
          .setFontWeight('bold');
      }
    }

    // Farq ustuni (yashil/qizil)
    var diffRange = dash.getRange(startRow, 5, output.length, 1);
    dash.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0).setBackground('#e8f5e9').setFontColor('#1b5e20')
        .setRanges([diffRange]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(0).setBackground('#ffebee').setFontColor('#b71c1c')
        .setRanges([diffRange]).build()
    ]);
  }

  // ─────────────────────────────────────────────────────────
  // UI SOZLAMALARI
  // ─────────────────────────────────────────────────────────
  dash.setFrozenRows(7);
  dash.setColumnWidth(1, 200);
  dash.setColumnWidth(2, 300);
  dash.setColumnWidth(3, 150);
  dash.setColumnWidth(4, 150);
  dash.setColumnWidth(5, 150);
  dash.getRange(1, 1, (output.length || 1) + 8, COLS)
    .setVerticalAlignment('middle').setFontFamily('Arial');

  ss.toast('✅ Analitika Dashboard yangilandi!', '📊 ANALITIKA', 5);
}