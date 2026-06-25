/*******************************
 * DashboardAnalyzer.gs
 * - ONLY analyzes REYESTR data:
 *   from code.gs: STATUS, COMM_STATUS, ERROR, LAST_SYNC, ACT_FILE_URL...
 *   from Monitoring.gs: LAST_FILE_MODIFIED, MONITOR_STATUS
 * - Creates/updates:
 *   - PANEL sheet (KPI + breakdowns)
 *   - ATTENTION sheet (problem rows list)
 *******************************/

const DA = {
  REYESTR_SHEET: (typeof CONFIG !== "undefined" && CONFIG.REYESTR_SHEET) ? CONFIG.REYESTR_SHEET : "REYESTR",
  PANEL_SHEET: "PANEL",
  ATTENTION_SHEET: "ATTENTION",

  H: {
    ACT_ID: (typeof REY !== "undefined" && REY.ACT_ID) ? REY.ACT_ID : "ACT_ID",
    STATUS: (typeof REY !== "undefined" && REY.STATUS) ? REY.STATUS : "STATUS",
    COMM_STATUS: (typeof REY !== "undefined" && REY.COMM_STATUS) ? REY.COMM_STATUS : "COMM_STATUS",
    ERROR: (typeof REY !== "undefined" && REY.ERROR) ? REY.ERROR : "ERROR",
    LAST_SYNC: (typeof REY !== "undefined" && REY.LAST_SYNC) ? REY.LAST_SYNC : "LAST_SYNC",
    ACT_FILE_URL: (typeof REY !== "undefined" && REY.ACT_FILE_URL) ? REY.ACT_FILE_URL : "ACT_FILE_URL",
    TARGET_FOLDER_PATH: (typeof REY !== "undefined" && REY.TARGET_FOLDER_PATH) ? REY.TARGET_FOLDER_PATH : "TARGET_FOLDER_PATH",

    LAST_FILE_MODIFIED: "LAST_FILE_MODIFIED",
    MONITOR_STATUS: "MONITOR_STATUS"
  }
};

function da_refreshAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reyestr = ss.getSheetByName(DA.REYESTR_SHEET);
  if (!reyestr) {
    return {message: `REYESTR sheet topilmadi: "${DA.REYESTR_SHEET}"`};
    return;
  }

  da_ensureHeaders_(reyestr, [DA.H.LAST_FILE_MODIFIED, DA.H.MONITOR_STATUS]);

  const data = da_readReyestr_(reyestr);

  da_buildPanel_(ss, data);
  da_buildAttention_(ss, data);

  return {message: "✅ PANEL va ATTENTION yangilandi."};
}

function da_headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(h => String(h || "").trim());
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}

function da_ensureHeaders_(sheet, headersNeeded) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const existing = row1.map(v => String(v || "").trim());

  const missing = headersNeeded.filter(h => !existing.includes(h));
  if (missing.length) sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
}

function da_readReyestr_(sheet) {
  const map = da_headerMap_(sheet);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow < 2) return { map, rows: [], sheetName: sheet.getName(), lastRow, lastCol };

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(h => String(h || "").trim());
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  const rows = values.map((r, idx) => {
    const obj = { __row: idx + 2 };
    headers.forEach((h, i) => { if (h) obj[h] = r[i]; });
    return obj;
  });

  return { map, rows, sheetName: sheet.getName(), lastRow, lastCol };
}

function da_buildPanel_(ss, data) {
  let sh = ss.getSheetByName(DA.PANEL_SHEET);
  if (!sh) sh = ss.insertSheet(DA.PANEL_SHEET);
  sh.clear();

  sh.getRange("A1").setValue("AKT REYESTR — DASHBOARD (AUTO)");
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");

  const rows = data.rows;
  const kpi = da_computeKpi_(rows);

  const kpiBlock = [
    ["KPI", "VALUE"],
    ["Jami aktlar", kpi.total],
    ["STATUS=ERROR", kpi.statusError],
    ["ERROR maydoni to‘ldirilgan", kpi.errorFilled],
    ["MONITOR_STATUS=MISSING", kpi.monitorMissing],
    ["MONITOR_STATUS=CHANGED", kpi.monitorChanged],
    ["ACT_FILE_URL yo‘q (yaratilmagan)", kpi.noActUrl],
    ["TARGET_FOLDER_PATH yo‘q", kpi.noTargetPath],
    ["Oxirgi yangilanish (LAST_SYNC max)", kpi.lastSyncMax || ""]
  ];

  sh.getRange(3, 1, kpiBlock.length, 2).setValues(kpiBlock);
  sh.getRange(3, 1, 1, 2).setFontWeight("bold");
  sh.autoResizeColumns(1, 2);

  const statusTable = [["STATUS", "COUNT"]].concat(
    Object.entries(kpi.statusCounts).sort((a,b)=>b[1]-a[1])
  );
  sh.getRange(3, 4, statusTable.length, 2).setValues(statusTable);
  sh.getRange(3, 4, 1, 2).setFontWeight("bold");

  const commTable = [["COMM_STATUS", "COUNT"]].concat(
    Object.entries(kpi.commCounts).sort((a,b)=>b[1]-a[1])
  );
  sh.getRange(3, 7, commTable.length, 2).setValues(commTable);
  sh.getRange(3, 7, 1, 2).setFontWeight("bold");

  const monTable = [["MONITOR_STATUS", "COUNT"]].concat(
    Object.entries(kpi.monitorCounts).sort((a,b)=>b[1]-a[1])
  );
  sh.getRange(3, 10, monTable.length, 2).setValues(monTable);
  sh.getRange(3, 10, 1, 2).setFontWeight("bold");

  sh.setFrozenRows(2);
  sh.getRange("A3:L3").setFontWeight("bold");
  sh.getRange("A3:L3").setBackground("#f3f4f6");
}

function da_computeKpi_(rows) {
  const H = DA.H;

  const statusCounts = {};
  const commCounts = {};
  const monitorCounts = {};

  let total = 0, statusError = 0, errorFilled = 0, monitorMissing = 0, monitorChanged = 0, noActUrl = 0, noTargetPath = 0;
  let lastSyncMax = null;

  for (const r of rows) {
    total++;

    const status = String(r[H.STATUS] || "").trim();
    const comm = String(r[H.COMM_STATUS] || "").trim();
    const mon = String(r[H.MONITOR_STATUS] || "").trim();
    const err = String(r[H.ERROR] || "").trim();
    const actUrl = String(r[H.ACT_FILE_URL] || "").trim();
    const path = String(r[H.TARGET_FOLDER_PATH] || "").trim();

    statusCounts[status || "(empty)"] = (statusCounts[status || "(empty)"] || 0) + 1;
    commCounts[comm || "(empty)"] = (commCounts[comm || "(empty)"] || 0) + 1;
    monitorCounts[mon || "(empty)"] = (monitorCounts[mon || "(empty)"] || 0) + 1;

    if (status === "ERROR") statusError++;
    if (err) errorFilled++;
    if (mon === "MISSING") monitorMissing++;
    if (mon === "CHANGED") monitorChanged++;
    if (!actUrl) noActUrl++;
    if (!path) noTargetPath++;

    const dt = da_tryDate_(r[H.LAST_SYNC]);
    if (dt && (!lastSyncMax || dt.getTime() > lastSyncMax.getTime())) lastSyncMax = dt;
  }

  return {
    total,
    statusError,
    errorFilled,
    monitorMissing,
    monitorChanged,
    noActUrl,
    noTargetPath,
    lastSyncMax: lastSyncMax ? Utilities.formatDate(lastSyncMax, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm") : "",
    statusCounts,
    commCounts,
    monitorCounts
  };
}

function da_tryDate_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === "[object Date]" && !isNaN(v)) return v;
  const d = new Date(String(v).trim());
  if (!isNaN(d.getTime())) return d;
  return null;
}

function da_buildAttention_(ss, data) {
  let sh = ss.getSheetByName(DA.ATTENTION_SHEET);
  if (!sh) sh = ss.insertSheet(DA.ATTENTION_SHEET);
  sh.clear();

  sh.getRange("A1").setValue("ATTENTION — muammo bo‘lgan aktlar (AUTO)");
  sh.getRange("A1").setFontSize(14).setFontWeight("bold");

  const H = DA.H;
  const issues = [];

  for (const r of data.rows) {
    const status = String(r[H.STATUS] || "").trim();
    const err = String(r[H.ERROR] || "").trim();
    const mon = String(r[H.MONITOR_STATUS] || "").trim();
    const actUrl = String(r[H.ACT_FILE_URL] || "").trim();
    const actId = String(r[H.ACT_ID] || "").trim();

    const isIssue = status === "ERROR" || !!err || ["MISSING", "CHANGED", "BAD_URL"].includes(mon);
    if (!isIssue) continue;

    issues.push({ row: r.__row, actId, status, mon, err, actUrl });
  }

  const header = [["ROW", "ACT_ID", "STATUS", "MONITOR_STATUS", "ERROR", "ACT_FILE_URL"]];
  sh.getRange(3, 1, 1, header[0].length).setValues(header);
  sh.getRange(3, 1, 1, header[0].length).setFontWeight("bold").setBackground("#fef3c7");

  if (issues.length === 0) {
    sh.getRange("A5").setValue("✅ Muammo topilmadi (ERROR/MISSING/CHANGED yo‘q).");
    return;
  }

  const values = issues.map(it => [
    it.row,
    it.actId,
    it.status,
    it.mon,
    it.err,
    it.actUrl ? `=HYPERLINK("${it.actUrl}","Open act")` : ""
  ]);

  sh.getRange(4, 1, values.length, header[0].length).setValues(values);

  // set formula for URL column
  for (let i = 0; i < issues.length; i++) {
    const formula = values[i][5];
    if (String(formula).startsWith("=HYPERLINK(")) sh.getRange(4 + i, 6).setFormula(formula);
  }

  sh.autoResizeColumns(1, header[0].length);
  sh.setFrozenRows(3);
}
