/***********************
 * Monitoring.gs — STABLE
 * Writes:
 * - LAST_FILE_MODIFIED
 * - MONITOR_STATUS
 * Does NOT touch STATUS workflow.
 ***********************/

const MONITOR = {
  EVERY_MINUTES: 15,
  MAX_ROWS_PER_RUN: 250,
  TIME_BUDGET_MS: 240000
};

function monitorEnable() {
  PropertiesService.getDocumentProperties().setProperty(CONFIG.PROP_MONITOR_ENABLED, "1");
  monitor_installTrigger();
  return {message: "✅ Monitor ON."};
}

function monitorDisable() {
  PropertiesService.getDocumentProperties().setProperty(CONFIG.PROP_MONITOR_ENABLED, "0");
  monitor_removeTrigger();
  return {message: "🛑 Monitor OFF."};
}

function monitor_installTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "monitor_run") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("monitor_run")
    .timeBased()
    .everyMinutes(MONITOR.EVERY_MINUTES)
    .create();
}

function monitor_removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "monitor_run") ScriptApp.deleteTrigger(t);
  });
}

function monitor_run() {
  const enabled = PropertiesService.getDocumentProperties().getProperty(CONFIG.PROP_MONITOR_ENABLED);
  if (enabled !== "1") return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) return;

  // ensure headers
  const need = [REY.LAST_FILE_MODIFIED, REY.MONITOR_STATUS];
  _ensureHeaders_(sh, need);

  const map = headerMap_(sh);
  const colUrl = map[REY.ACT_FILE_URL];
  const colLastMod = map[REY.LAST_FILE_MODIFIED];
  const colMon = map[REY.MONITOR_STATUS];
  const colLastSync = map[REY.LAST_SYNC];
  const colErr = map[REY.ERROR];

  if (!colUrl || !colLastMod || !colMon) return;

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const startTime = Date.now();
  let processed = 0;

  for (let r = 2; r <= lastRow; r++) {
    if (processed >= MONITOR.MAX_ROWS_PER_RUN) break;
    if ((Date.now() - startTime) > MONITOR.TIME_BUDGET_MS) break;

    const url = String(sh.getRange(r, colUrl).getValue() || "").trim();
    if (!url) continue;

    const id = extractSpreadsheetIdFromUrl_(url);
    if (!id) {
      sh.getRange(r, colMon).setValue("BAD_URL");
      if (colErr) sh.getRange(r, colErr).setValue("Bad ACT_FILE_URL (cannot extract ID)");
      if (colLastSync) sh.getRange(r, colLastSync).setValue(new Date());
      processed++;
      continue;
    }

    try {
      const file = DriveApp.getFileById(id);
      const updated = file.getLastUpdated();
      const updatedStr = Utilities.formatDate(updated, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      const prev = String(sh.getRange(r, colLastMod).getValue() || "").trim();
      sh.getRange(r, colLastMod).setValue(updatedStr);

      if (!prev) sh.getRange(r, colMon).setValue("OK");
      else if (prev !== updatedStr) sh.getRange(r, colMon).setValue("CHANGED");
      else sh.getRange(r, colMon).setValue("OK");

      if (colLastSync) sh.getRange(r, colLastSync).setValue(new Date());
      if (colErr) sh.getRange(r, colErr).setValue("");

    } catch (e) {
      sh.getRange(r, colMon).setValue("MISSING");
      if (colErr) sh.getRange(r, colErr).setValue("File not found or no access");
      if (colLastSync) sh.getRange(r, colLastSync).setValue(new Date());
    }

    processed++;
  }
}

function _ensureHeaders_(sheet, headersNeeded) {
  const lastCol = Math.max(1, sheet.getLastColumn());
  const row1 = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const existing = row1.map(v => String(v || "").trim());

  const missing = headersNeeded.filter(h => !existing.includes(h));
  if (missing.length) sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
}
