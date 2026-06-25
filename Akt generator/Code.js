/***********************
 * AKT ULTRA v5.1 — STABLE PACK
 * - Uses TARGET_FOLDER_ID as truth (no path-based folder creation)
 * - Picker writes TARGET_FOLDER_ID + TARGET_FOLDER_PATH (display)
 * - Manual buttons: Create/Sync/Move for active row
 * - Bulk actions for visible rows
 * - Auto mode (onEdit) ON/OFF (simple)
 * - Monitor + Dashboard hooks
 ***********************/

/************* CONFIG *************/
const CONFIG = {
  MASTER_SPREADSHEET_ID: "1Co9bC9dEdJUG9wTEiQjUJ4KH-aCScQihkQ_9-MHQbP0",
  ROOT_FOLDER_ID: "1ySurglAgbADlj7CmyYEx9WsxVP88cFSh",

  REYESTR_SHEET: "REYESTR",
  META_SHEET: "__META",

  TEMPLATE_WITH_SUB: "TPL_WITH_SUB",
  TEMPLATE_NO_SUB: "TEMPLATE_NO_SUB_SHEET",

  ACT_TITLE_REGEX: /АКТ\s+ОСВИДЕТЕЛЬСТВОВАНИЯ\s+СКРЫТЫХ\s+РАБОТ/i,

  OBJECT_PREFIX: "\"Янги Навоий Шахарчаси\" МСГ \"Фаровон\" в городe Навоий Навоийск область янги Ўзбекистон боғи.",

  CELLS: {
    A6: "A6",
    A7: "A7",
    D9: "D9",
    F11: "F11",
    B31: "B31",
    A33: "A33",
    A38: "A38",
    A42: "A42",
    E45: "E45",
    E46: "E46",
    A50: "A50"
  },

  COMMISSION_NO_SUB: { GEN: "A13", TEX: "A17", PROJ: "A21", ORG: "A24" },
  COMMISSION_WITH_SUB: { SUB: "A13", GEN: "A16", TEX: "A19", PROJ: "A22", ORG: "A24" },

  SIGN_NO_SUB: { GEN: "F55", TEX: "F58", PROJ: "F61" },
  SIGN_WITH_SUB: { SUB: "F55", GEN: "F58", TEX: "F61", PROJ: "F64" },

  // toggles stored in DocumentProperties
  PROP_AUTO_ENABLED: "AKT_AUTO_ENABLED",
  PROP_MONITOR_ENABLED: "AKT_MONITOR_ENABLED",
};

/************* REYESTR COLUMNS *************/
const REY = {
  ACT_ID: "ACT_ID",
  STATUS: "STATUS",
  COMM_STATUS: "COMM_STATUS",

  ACT_NUMBER: "ACT_NUMBER",
  WORK_NAME: "WORK_NAME",
  OBJECT_NAME: "OBJECT_NAME",

  GEN_NAME: "GEN_NAME",
  SUB_NAME: "SUB_NAME",

  CUSTOMER_ORG: "CUSTOMER_ORG",
  PROJECT_ORG: "PROJECT_ORG",

  GEN_FIO: "GEN_FIO",
  GEN_POS: "GEN_POS",

  SUB_FIO: "SUB_FIO",
  SUB_POS: "SUB_POS",

  TEX_FIO: "TEX_FIO",
  TEX_POS: "TEX_POS",

  PROJ_FIO: "PROJ_FIO",
  PROJ_POS: "PROJ_POS",

  PROGRESS: "PROGRESS",
  PROJECT_DOC: "PROJECT_DOC",
  MATERIAL: "MATERIAL",
  DEVIATION: "DEVIATION",
  START_DATE: "START_DATE",
  END_DATE: "END_DATE",
  NEXT_WORK: "NEXT_WORK",

  ACT_FILE_URL: "ACT_FILE_URL",
  PDF_URL: "PDF_URL",

  // Smeta tizimi bilan bog'lanish — obyekt||varaq||qator (qaysi ish turiga akt)
  SMETA_REF: "SMETA_REF",

  // NEW stable folder model:
  TARGET_FOLDER_ID: "TARGET_FOLDER_ID",     // truth
  TARGET_FOLDER_PATH: "TARGET_FOLDER_PATH", // display
  ACT_FOLDER_ID: "ACT_FOLDER_ID",           // last known actual location

  FOUND_FOLDER: "FOUND_FOLDER",

  LAST_SYNC: "LAST_SYNC",
  ERROR: "ERROR",

  // monitor columns
  LAST_FILE_MODIFIED: "LAST_FILE_MODIFIED",
  MONITOR_STATUS: "MONITOR_STATUS"
};

const COMM_STATUS_VALUES = [
  "Не отправлено",
  "Отправлено подрядчиком",
  "Подписано подрядчиком",
  "Подписано заказчиком",
  "Подписано обеими сторонами",
  "Возврат на доработку"
];

const STATUS_VALUES = [
  "DRAFT",
  "CREATED",
  "SYNCED",
  "MOVED",
  "IMPORTED_NEW",
  "IMPORTED_UPDATE",
  "ERROR"
];

/************* MENU *************/
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🧱 AKT ULTRA")
    .addItem("🎛 Boshqaruv Paneli", "openUnifiedApp_")
    .addToUi();
}

function openUnifiedApp_() {
  const tpl = HtmlService.createTemplateFromFile("UnifiedApp");
  const html = tpl.evaluate().setTitle("Akt Generator").setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

/************* SETUP *************/
function setupAll() {
  setupReyestr_();
  applyReyestrDesign_();
  installAutoTrigger_(); // create onEdit trigger (auto can still be OFF)
  return {message: "✅ Setup tugadi."};
}

function setupReyestr_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) sh = ss.insertSheet(CONFIG.REYESTR_SHEET);

  const headersNeeded = Object.values(REY);
  const lastCol = Math.max(1, sh.getLastColumn());
  const row1 = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  const existing = row1.map(v => String(v || "").trim());

  if (existing.filter(Boolean).length === 0) {
    sh.getRange(1, 1, 1, headersNeeded.length).setValues([headersNeeded]);
  } else {
    const missing = headersNeeded.filter(h => !existing.includes(h));
    if (missing.length) sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }

  sh.setFrozenRows(1);
}

function applyReyestrDesign_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  const map = headerMap_(sh);

  try { if (!sh.getFilter()) sh.getRange(1, 1, 1, sh.getLastColumn()).createFilter(); } catch(e){}

  if (map[REY.START_DATE]) sh.getRange(2, map[REY.START_DATE], sh.getMaxRows() - 1, 1).setNumberFormat("dd.MM.yyyy");
  if (map[REY.END_DATE]) sh.getRange(2, map[REY.END_DATE], sh.getMaxRows() - 1, 1).setNumberFormat("dd.MM.yyyy");
  if (map[REY.LAST_SYNC]) sh.getRange(2, map[REY.LAST_SYNC], sh.getMaxRows() - 1, 1).setNumberFormat("dd.MM.yyyy HH:mm");

  if (map[REY.COMM_STATUS]) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(COMM_STATUS_VALUES, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, map[REY.COMM_STATUS], sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
  if (map[REY.STATUS]) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(STATUS_VALUES, true)
      .setAllowInvalid(true)
      .build();
    sh.getRange(2, map[REY.STATUS], sh.getMaxRows() - 1, 1).setDataValidation(rule);
  }
}

/************* AUTO TOGGLE *************/
function autoEnable() {
  PropertiesService.getDocumentProperties().setProperty(CONFIG.PROP_AUTO_ENABLED, "1");
  return {message: "✅ Auto ON."};
}
function autoDisable() {
  PropertiesService.getDocumentProperties().setProperty(CONFIG.PROP_AUTO_ENABLED, "0");
  return {message: "🛑 Auto OFF."};
}

/************* AUTO TRIGGER *************/
function installAutoTrigger_() {
  deleteTriggersByHandler_("autoOnEdit");
  ScriptApp.newTrigger("autoOnEdit")
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
}

function autoOnEdit(e) {
  try {
    const enabled = PropertiesService.getDocumentProperties().getProperty(CONFIG.PROP_AUTO_ENABLED);
    if (enabled !== "1") return;

    const sh = e.range.getSheet();
    if (sh.getName() !== CONFIG.REYESTR_SHEET) return;

    const row = e.range.getRow();
    if (row <= 1) return;

    const changed = changedHeaders_(sh, e.range);

    // Service columns ignore
    const SERVICE = [
      REY.STATUS, REY.ERROR, REY.LAST_SYNC, REY.FOUND_FOLDER,
      REY.ACT_FILE_URL, REY.ACT_ID, REY.PDF_URL, REY.ACT_FOLDER_ID,
      REY.LAST_FILE_MODIFIED, REY.MONITOR_STATUS
    ];
    if (changed.some(h => SERVICE.includes(h))) return;

    const lock = LockService.getDocumentLock();
    if (!lock.tryLock(2000)) return;

    try {
      const rowObj = readRow_(sh, row);

      const hasAct = !!String(rowObj[REY.ACT_FILE_URL] || "").trim();
      const targetId = String(rowObj[REY.TARGET_FOLDER_ID] || "").trim();

      // auto create
      if (!hasAct && targetId && isRowReadyForCreate_(rowObj)) {
        createActFromRow_(sh, row, rowObj);
        return;
      }

      // auto move if folder id changed and act exists
      if (hasAct && changed.includes(REY.TARGET_FOLDER_ID)) {
        moveActToTarget_(sh, row, rowObj);
        return;
      }

      // auto sync on important changes
      if (hasAct) {
        const needsSync = changed.some(h => [
          REY.ACT_NUMBER, REY.WORK_NAME, REY.OBJECT_NAME,
          REY.GEN_NAME, REY.SUB_NAME,
          REY.CUSTOMER_ORG, REY.PROJECT_ORG,
          REY.GEN_FIO, REY.GEN_POS,
          REY.SUB_FIO, REY.SUB_POS,
          REY.TEX_FIO, REY.TEX_POS,
          REY.PROJ_FIO, REY.PROJ_POS,
          REY.PROGRESS, REY.PROJECT_DOC, REY.MATERIAL, REY.DEVIATION,
          REY.START_DATE, REY.END_DATE, REY.NEXT_WORK
        ].includes(h));

        if (needsSync) syncMasterToAct_(sh, row, readRow_(sh, row));
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    Logger.log("autoOnEdit error: " + err);
  }
}

/************* MANUAL (ACTIVE ROW) *************/
function _getActiveRow_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) throw new Error("REYESTR topilmadi.");
  const r = sh.getActiveRange();
  if (!r) throw new Error("Active cell tanlanmagan.");
  const row = r.getRow();
  if (row < 2) throw new Error("2-qatordan boshlab tanlang.");
  return { sh, row, rowObj: readRow_(sh, row) };
}

function createActForActiveRow() {
  const { sh, row, rowObj } = _getActiveRow_();
  if (String(rowObj[REY.ACT_FILE_URL] || "").trim()) throw new Error("ACT_FILE_URL bor — akt allaqachon yaratilgan.");
  if (!String(rowObj[REY.TARGET_FOLDER_ID] || "").trim()) throw new Error("TARGET_FOLDER_ID bo‘sh — folder tanlang.");
  if (!isRowReadyForCreate_(rowObj)) throw new Error("Qator tayyor emas — majburiy ustunlardan biri bo‘sh.");
  createActFromRow_(sh, row, rowObj);
  return {message: "✅ Akt yaratildi."};
}

function syncActForActiveRow() {
  const { sh, row, rowObj } = _getActiveRow_();
  if (!String(rowObj[REY.ACT_FILE_URL] || "").trim()) throw new Error("ACT_FILE_URL yo‘q.");
  syncMasterToAct_(sh, row, rowObj);
  return {message: "✅ Sync tugadi."};
}

function moveActForActiveRow() {
  const { sh, row, rowObj } = _getActiveRow_();
  if (!String(rowObj[REY.ACT_FILE_URL] || "").trim()) throw new Error("ACT_FILE_URL yo‘q.");
  if (!String(rowObj[REY.TARGET_FOLDER_ID] || "").trim()) throw new Error("TARGET_FOLDER_ID yo‘q — folder tanlang.");
  moveActToTarget_(sh, row, rowObj);
  return {message: "✅ Move tugadi."};
}

// _getVisibleRows_ removed as it's now integrated into getVisibleRowsForBulk

function bulkCreateVisible() {
  showBulkModal_('create');
}

function bulkSyncVisible() {
  showBulkModal_('sync');
}

function bulkMoveVisible() {
  showBulkModal_('move');
}

function showBulkModal_(mode) {
  const tpl = HtmlService.createTemplateFromFile("BulkModal");
  tpl.mode = mode;
  const html = tpl.evaluate().setWidth(450).setHeight(350);
  SpreadsheetApp.getUi().showModalDialog(html, "Bulk Operation");
}

function getVisibleRowsForBulk(mode, scope) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  const rowsRaw = [];
  
  if (scope === 'selected') {
    const rangeList = sh.getActiveRangeList();
    const ranges = rangeList ? rangeList.getRanges() : [];
    if (!ranges.length && sh.getActiveRange()) ranges.push(sh.getActiveRange());
    
    for (const r of ranges) {
      const start = r.getRow();
      const num = r.getNumRows();
      for (let i = 0; i < num; i++) {
        const rowNum = start + i;
        if (rowNum >= 2 && !sh.isRowHiddenByFilter(rowNum) && !sh.isRowHiddenByUser(rowNum)) {
          rowsRaw.push(rowNum);
        }
      }
    }
  } else {
    const last = sh.getLastRow();
    for (let r = 2; r <= last; r++) {
      if (!sh.isRowHiddenByFilter(r) && !sh.isRowHiddenByUser(r)) rowsRaw.push(r);
    }
  }
  
  const rows = Array.from(new Set(rowsRaw)).sort((a,b) => a - b);
  const toProcess = [];
  
  for (const row of rows) {
    const o = readRow_(sh, row);
    const hasAct = !!String(o[REY.ACT_FILE_URL] || "").trim();
    
    if (mode === 'create') {
      const targetId = !!String(o[REY.TARGET_FOLDER_ID] || "").trim();
      if (!hasAct && targetId && isRowReadyForCreate_(o)) toProcess.push(row);
    } else if (mode === 'sync') {
      if (hasAct) toProcess.push(row);
    } else if (mode === 'move') {
      const targetId = !!String(o[REY.TARGET_FOLDER_ID] || "").trim();
      if (hasAct && targetId) toProcess.push(row);
    }
  }
  return toProcess;
}

function executeBulkRowAction(mode, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  const o = readRow_(sh, row);
  try {
    if (mode === 'create') createActFromRow_(sh, row, o);
    else if (mode === 'sync') syncMasterToAct_(sh, row, o);
    else if (mode === 'move') moveActToTarget_(sh, row, o);
    return { success: true };
  } catch (e) {
    return { error: String(e && e.message ? e.message : e) };
  }
}

/************* VALIDATION *************/
function isRowReadyForCreate_(o) {
  const must = [
    REY.ACT_NUMBER, REY.WORK_NAME, REY.OBJECT_NAME,
    REY.PROJECT_DOC, REY.END_DATE,
    REY.GEN_NAME, REY.GEN_FIO, REY.GEN_POS,
    REY.CUSTOMER_ORG, REY.TEX_FIO, REY.TEX_POS,
    REY.PROJECT_ORG, REY.PROJ_FIO, REY.PROJ_POS,
    REY.TARGET_FOLDER_ID
  ];
  for (const k of must) if (!String(o[k] || "").trim()) return false;

  const hasSub = !!String(o[REY.SUB_NAME] || "").trim();
  if (hasSub) {
    for (const k of [REY.SUB_FIO, REY.SUB_POS]) if (!String(o[k] || "").trim()) return false;
  }
  return true;
}

/************* CREATE *************/
function createActFromRow_(sh, row, rowObj) {
  try {
    if (!String(rowObj[REY.ACT_ID] || "").trim()) {
      rowObj[REY.ACT_ID] = generateActId_();
      writeRow_(sh, row, { [REY.ACT_ID]: rowObj[REY.ACT_ID] });
    }

    const hasSub = !!String(rowObj[REY.SUB_NAME] || "").trim();
    const tplName = hasSub ? CONFIG.TEMPLATE_WITH_SUB : CONFIG.TEMPLATE_NO_SUB;

    const folderId = String(rowObj[REY.TARGET_FOLDER_ID] || "").trim();
    const folder = DriveApp.getFolderById(folderId);

    const fname = buildUniqueFileName_(rowObj);

    const masterSS = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
    const masterFile = DriveApp.getFileById(masterSS.getId());
    const newFile = masterFile.makeCopy(fname, folder);

    const actSS = SpreadsheetApp.openById(newFile.getId());
    keepOnlyTemplateSheet_(actSS, tplName);

    ensureMeta_(actSS, {
      ACT_ID: rowObj[REY.ACT_ID],
      MASTER_ID: CONFIG.MASTER_SPREADSHEET_ID,
      MASTER_SHEET: CONFIG.REYESTR_SHEET,
      MASTER_ROW: row,
      SYNC_LOCK: ""
    });

    syncRowToAct_(actSS, readRow_(sh, row));

    const hyper = makeFolderHyperlinkFormula_(folder.getId(), folder.getName());
    writeRow_(sh, row, {
      [REY.ACT_FILE_URL]: actSS.getUrl(),
      [REY.ACT_FOLDER_ID]: folder.getId(),
      [REY.FOUND_FOLDER]: hyper,
      [REY.STATUS]: "CREATED",
      [REY.LAST_SYNC]: new Date(),
      [REY.ERROR]: ""
    }, { formulaKeys: [REY.FOUND_FOLDER] });

  } catch (e) {
    writeRow_(sh, row, {
      [REY.STATUS]: "ERROR",
      [REY.ERROR]: String(e && e.message ? e.message : e),
      [REY.LAST_SYNC]: new Date()
    });
    throw e;
  }
}

/************* SYNC *************/
function syncMasterToAct_(sh, row, rowObj) {
  try {
    const actId = extractSpreadsheetIdFromUrl_(rowObj[REY.ACT_FILE_URL]);
    if (!actId) throw new Error("ACT_FILE_URL dan ID ajratilmadi.");

    const actSS = SpreadsheetApp.openById(actId);
    setMetaFlag_(actSS, "SYNC_LOCK", "1");
    syncRowToAct_(actSS, rowObj);
    setMetaFlag_(actSS, "SYNC_LOCK", "");

    writeRow_(sh, row, {
      [REY.STATUS]: "SYNCED",
      [REY.LAST_SYNC]: new Date(),
      [REY.ERROR]: ""
    });

  } catch (e) {
    writeRow_(sh, row, {
      [REY.STATUS]: "ERROR",
      [REY.ERROR]: String(e && e.message ? e.message : e),
      [REY.LAST_SYNC]: new Date()
    });
    throw e;
  }
}

/************* MOVE (BY FOLDER ID) *************/
function moveActToTarget_(sh, row, rowObj) {
  try {
    const actId = extractSpreadsheetIdFromUrl_(rowObj[REY.ACT_FILE_URL]);
    if (!actId) throw new Error("ACT_FILE_URL dan ID ajratilmadi.");

    const targetFolderId = String(rowObj[REY.TARGET_FOLDER_ID] || "").trim();
    if (!targetFolderId) throw new Error("TARGET_FOLDER_ID bo‘sh.");

    const folder = DriveApp.getFolderById(targetFolderId);
    DriveApp.getFileById(actId).moveTo(folder);

    const hyper = makeFolderHyperlinkFormula_(folder.getId(), folder.getName());
    writeRow_(sh, row, {
      [REY.ACT_FOLDER_ID]: folder.getId(),
      [REY.FOUND_FOLDER]: hyper,
      [REY.STATUS]: "MOVED",
      [REY.LAST_SYNC]: new Date(),
      [REY.ERROR]: ""
    }, { formulaKeys: [REY.FOUND_FOLDER] });

  } catch (e) {
    writeRow_(sh, row, {
      [REY.STATUS]: "ERROR",
      [REY.ERROR]: String(e && e.message ? e.message : e),
      [REY.LAST_SYNC]: new Date()
    });
    throw e;
  }
}

/************* WRITE TO ACT *************/
function syncRowToAct_(actSS, rowObj) {
  const info = findActSheet_(actSS);
  if (!info) throw new Error("Akt sheet topilmadi.");

  const sheet = info.sheet;
  const hasSub = !!String(rowObj[REY.SUB_NAME] || "").trim();

  const genOrg = String(rowObj[REY.GEN_NAME] || "").trim();
  const subOrg = String(rowObj[REY.SUB_NAME] || "").trim();
  const customerOrg = String(rowObj[REY.CUSTOMER_ORG] || "").trim();
  const projectOrg = String(rowObj[REY.PROJECT_ORG] || "").trim();

  sheet.getRange(CONFIG.CELLS.A6).setValue(`АКТ ОСВИДЕТЕЛЬСТВОВАНИЯ СКРЫТЫХ РАБОТ № ${rowObj[REY.ACT_NUMBER] || ""}`.trim());
  sheet.getRange(CONFIG.CELLS.A7).setValue(rowObj[REY.WORK_NAME] || "");

  const suffix = String(rowObj[REY.OBJECT_NAME] || "").trim();
  const fullObj = suffix ? `${CONFIG.OBJECT_PREFIX} ${suffix}` : CONFIG.OBJECT_PREFIX;
  sheet.getRange(CONFIG.CELLS.D9).setValue(fullObj);

  sheet.getRange(CONFIG.CELLS.B31).setValue(rowObj[REY.PROGRESS] || "");
  sheet.getRange(CONFIG.CELLS.A33).setValue(rowObj[REY.PROJECT_DOC] || "");
  sheet.getRange(CONFIG.CELLS.A38).setValue(rowObj[REY.MATERIAL] || "");
  sheet.getRange(CONFIG.CELLS.A42).setValue(String(rowObj[REY.DEVIATION] || "").trim() ? rowObj[REY.DEVIATION] : "Нет");
  sheet.getRange(CONFIG.CELLS.A50).setValue(rowObj[REY.NEXT_WORK] || "");

  sheet.getRange(CONFIG.CELLS.F11).setValue(formatRuMonthDate_(rowObj[REY.END_DATE]) || "");
  sheet.getRange(CONFIG.CELLS.E45).setValue(formatRuMonthDate_(rowObj[REY.START_DATE]) || "");
  sheet.getRange(CONFIG.CELLS.E46).setValue(formatRuMonthDate_(rowObj[REY.END_DATE]) || "");

  if (!hasSub) {
    sheet.getRange(CONFIG.COMMISSION_NO_SUB.GEN).setValue(buildCommissionLine_(rowObj[REY.GEN_FIO], rowObj[REY.GEN_POS], quoteOrg_(genOrg)));
    sheet.getRange(CONFIG.COMMISSION_NO_SUB.TEX).setValue(buildCommissionLine_(rowObj[REY.TEX_FIO], rowObj[REY.TEX_POS], quoteOrg_(customerOrg)));
    sheet.getRange(CONFIG.COMMISSION_NO_SUB.PROJ).setValue(buildCommissionLine_(rowObj[REY.PROJ_FIO], rowObj[REY.PROJ_POS], quoteOrg_(projectOrg)));
    sheet.getRange(CONFIG.COMMISSION_NO_SUB.ORG).setValue(quoteOrg_(genOrg));

    sheet.getRange(CONFIG.SIGN_NO_SUB.GEN).setValue(rowObj[REY.GEN_FIO] || "");
    sheet.getRange(CONFIG.SIGN_NO_SUB.TEX).setValue(rowObj[REY.TEX_FIO] || "");
    sheet.getRange(CONFIG.SIGN_NO_SUB.PROJ).setValue(rowObj[REY.PROJ_FIO] || "");
  } else {
    sheet.getRange(CONFIG.COMMISSION_WITH_SUB.SUB).setValue(buildCommissionLine_(rowObj[REY.SUB_FIO], rowObj[REY.SUB_POS], quoteOrg_(subOrg)));
    sheet.getRange(CONFIG.COMMISSION_WITH_SUB.GEN).setValue(buildCommissionLine_(rowObj[REY.GEN_FIO], rowObj[REY.GEN_POS], quoteOrg_(genOrg)));
    sheet.getRange(CONFIG.COMMISSION_WITH_SUB.TEX).setValue(buildCommissionLine_(rowObj[REY.TEX_FIO], rowObj[REY.TEX_POS], quoteOrg_(customerOrg)));
    sheet.getRange(CONFIG.COMMISSION_WITH_SUB.PROJ).setValue(buildCommissionLine_(rowObj[REY.PROJ_FIO], rowObj[REY.PROJ_POS], quoteOrg_(projectOrg)));
    sheet.getRange(CONFIG.COMMISSION_WITH_SUB.ORG).setValue(quoteOrg_(subOrg));

    sheet.getRange(CONFIG.SIGN_WITH_SUB.SUB).setValue(rowObj[REY.SUB_FIO] || "");
    sheet.getRange(CONFIG.SIGN_WITH_SUB.GEN).setValue(rowObj[REY.GEN_FIO] || "");
    sheet.getRange(CONFIG.SIGN_WITH_SUB.TEX).setValue(rowObj[REY.TEX_FIO] || "");
    sheet.getRange(CONFIG.SIGN_WITH_SUB.PROJ).setValue(rowObj[REY.PROJ_FIO] || "");
  }

  SpreadsheetApp.flush();
}

/************* PICKER OPEN *************/
function openFolderPickerForActiveRow() {
  const { sh, row } = _getActiveRow_();

  const tpl = HtmlService.createTemplateFromFile("Picker1");
  tpl.rootFolderId = CONFIG.ROOT_FOLDER_ID;
  tpl.context = JSON.stringify({ row });

  SpreadsheetApp.getUi().showModalDialog(
    tpl.evaluate().setWidth(920).setHeight(580),
    "Folder tanlash"
  );
}

/************* TEMPLATE FIND *************/
function findActSheet_(ss) {
  for (const sh of ss.getSheets()) {
    try {
      const a6 = sh.getRange("A6").getDisplayValue() || "";
      if (CONFIG.ACT_TITLE_REGEX.test(a6)) return { sheet: sh };
    } catch (e) {}
  }
  return null;
}

/************* TEMPLATE KEEP *************/
function keepOnlyTemplateSheet_(ss, templateSheetName) {
  let tpl = ss.getSheetByName(templateSheetName);
  if (!tpl) {
    const wanted = String(templateSheetName).trim().toLowerCase();
    tpl = ss.getSheets().find(s => String(s.getName()).trim().toLowerCase() === wanted) || null;
  }
  if (!tpl) {
    const names = ss.getSheets().map(s => `"${s.getName()}"`).join(", ");
    throw new Error(`Template sheet topilmadi: ${templateSheetName}\nMavjud sheetlar: ${names}`);
  }

  const copied = tpl.copyTo(ss);
  copied.setName("АКТ");

  ss.getSheets().forEach(sh => {
    const n = sh.getName();
    if (n === "АКТ") return;
    if (n === CONFIG.META_SHEET) return;
    ss.deleteSheet(sh);
  });

  ss.setActiveSheet(copied);
}

/************* META *************/
function ensureMeta_(ss, metaObj) {
  let meta = ss.getSheetByName(CONFIG.META_SHEET);
  if (!meta) meta = ss.insertSheet(CONFIG.META_SHEET);
  meta.hideSheet();

  meta.clear();
  const keys = Object.keys(metaObj);
  const rows = keys.map(k => [k, String(metaObj[k] ?? "")]);
  meta.getRange(1, 1, rows.length, 2).setValues(rows);
}

function setMetaFlag_(ss, key, value) {
  let meta = ss.getSheetByName(CONFIG.META_SHEET);
  if (!meta) { meta = ss.insertSheet(CONFIG.META_SHEET); meta.hideSheet(); }

  const last = meta.getLastRow();
  if (last < 1) {
    meta.getRange(1, 1, 1, 2).setValues([[key, value]]);
    return;
  }

  const vals = meta.getRange(1, 1, last, 2).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === key) {
      meta.getRange(i + 1, 2).setValue(String(value ?? ""));
      return;
    }
  }
  meta.getRange(last + 1, 1, 1, 2).setValues([[key, String(value ?? "")]]);
}

/************* HELPERS *************/
function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  const map = {};
  headers.forEach((h, i) => { if (h) map[h] = i + 1; });
  return map;
}

function readRow_(sheet, row) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h || "").trim());
  const values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
  const obj = {};
  headers.forEach((h, i) => { if (h) obj[h] = values[i]; });
  return obj;
}

function writeRow_(sheet, row, kv, opts) {
  const map = headerMap_(sheet);
  const formulaKeys = (opts && opts.formulaKeys) ? opts.formulaKeys : [];
  Object.keys(kv).forEach(k => {
    const col = map[k];
    if (!col) return;
    const cell = sheet.getRange(row, col);
    if (formulaKeys.includes(k)) cell.setFormula(kv[k]);
    else cell.setValue(kv[k]);
  });
}

function changedHeaders_(sheet, range) {
  const startCol = range.getColumn();
  const numCols = range.getNumColumns();
  return sheet.getRange(1, startCol, 1, numCols).getValues()[0].map(h => String(h || "").trim()).filter(Boolean);
}

function buildCommissionLine_(fio, pos, orgQuoted) {
  const f = String(fio || "").trim();
  const p = String(pos || "").trim();
  const o = String(orgQuoted || "").trim();
  if (f && p && o) return `${f} - ${p} ${o}`;
  if (f && p) return `${f} - ${p}`;
  if (f && o) return `${f} ${o}`;
  return f || "";
}

function quoteOrg_(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  if (s.startsWith("«") && s.endsWith("»")) return s;
  return `«${s}»`;
}

/************* DATES *************/
function formatRuMonthDate_(val) {
  const d = parseToDate_(val);
  const str = String(val || "").trim();
  if (!d) {
    if (str.indexOf('_') !== -1 || str === '') {
       return "«___» ____________ 202_ г.";
    }
    return str;
  }

  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()] || "";
  const year = d.getFullYear();
  return `«${day}» ${month} ${year} г.`;
}

function parseToDate_(val) {
  if (!val) return null;
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val)) return val;

  const s = String(val).trim();
  if (s.indexOf('_') !== -1) return null; // placeholder!

  const ru = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ru) return new Date(Number(ru[3]), Number(ru[2]) - 1, Number(ru[1]));

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/************* URL *************/
function extractSpreadsheetIdFromUrl_(url) {
  const s = String(url || "");
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : "";
}

function makeFolderHyperlinkFormula_(folderId, folderName) {
  const name = String(folderName || "folder").replace(/"/g, '""');
  const url = `https://drive.google.com/drive/folders/${folderId}`;
  return `=HYPERLINK("${url}","${name}")`;
}

/************* UNIQUE FILE NAME *************/
function buildUniqueFileName_(rowObj) {
  const num = String(rowObj[REY.ACT_NUMBER] || "").trim();
  const work = String(rowObj[REY.WORK_NAME] || "").trim();
  const end = String(rowObj[REY.END_DATE] || "").trim();
  const actId = String(rowObj[REY.ACT_ID] || "").trim();
  const suffix = actId ? actId.slice(-6) : Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HHmmss");
  return (`Акт №${num} — ${work} — ${end} — ${suffix}`).slice(0, 180);
}

function generateActId_() {
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  return `ACT-${ts}-${Math.floor(Math.random() * 1000)}`;
}

/************* TRIGGERS *************/
function deleteTriggersByHandler_(handlerName) {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === handlerName) ScriptApp.deleteTrigger(t);
  });
}

/************* HEALTH CHECK *************/
function healthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const re = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  const t1 = ss.getSheetByName(CONFIG.TEMPLATE_WITH_SUB);
  const t2 = ss.getSheetByName(CONFIG.TEMPLATE_NO_SUB);

  const props = PropertiesService.getDocumentProperties();
  const auto = props.getProperty(CONFIG.PROP_AUTO_ENABLED) === "1" ? "ON" : "OFF";
  const mon = props.getProperty(CONFIG.PROP_MONITOR_ENABLED) === "1" ? "ON" : "OFF";

  let msg = "";
  msg += `REYESTR: ${re ? "OK" : "NO"}\n`;
  msg += `TPL_WITH_SUB: ${t1 ? "OK" : "NO"}\n`;
  msg += `TPL_NO_SUB: ${t2 ? "OK" : "NO"}\n`;
  msg += `AUTO: ${auto}\n`;
  msg += `MONITOR: ${mon}\n`;

  return {message: msg};
}
/**
 * Repair: TARGET_FOLDER_ID bo‘yicha TARGET_FOLDER_PATH ni qayta tiklaydi.
 * - ROOT foldergacha parent chain yurib, relative path yasaydi.
 * - Hech qaysi fayl/folderni ko‘chirmaydi, yaratmaydi.
 */
function akt_repairFolderPathDisplay() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) throw new Error("REYESTR topilmadi.");

  const map = headerMap_(sh);
  const colId = map[REY.TARGET_FOLDER_ID];
  const colPath = map[REY.TARGET_FOLDER_PATH];

  if (!colId) throw new Error("TARGET_FOLDER_ID ustuni topilmadi.");
  if (!colPath) throw new Error("TARGET_FOLDER_PATH ustuni topilmadi.");

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    return {message: "REYESTR bo‘sh."};
    return;
  }

  let fixed = 0;
  let skipped = 0;
  let errors = 0;

  const rootId = CONFIG.ROOT_FOLDER_ID;

  for (let r = 2; r <= lastRow; r++) {
    const folderId = String(sh.getRange(r, colId).getValue() || "").trim();
    if (!folderId) { skipped++; continue; }

    try {
      const relPath = _buildRelativePathToRoot_(folderId, rootId);
      // relPath bo‘sh bo‘lishi ham mumkin (agar rootning o‘zi tanlangan bo‘lsa)
      sh.getRange(r, colPath).setValue(relPath);
      fixed++;
    } catch (e) {
      // folder o‘chirilgan / access yo‘q bo‘lishi mumkin
      errors++;
    }
  }

  SpreadsheetApp.getUi().alert(
    `✅ Repair tugadi.\nFixed: ${fixed}\nSkipped: ${skipped}\nErrors: ${errors}`
  );
}

/**
 * FolderId dan ROOTgacha parent zanjirini yurib,
 * ROOT ga nisbatan path qaytaradi: "A/B/C"
 *
 * Agar ROOT topilmasa (folder ROOT ichida bo‘lmasa) — faqat folder nomini qaytaradi.
 */
function _buildRelativePathToRoot_(folderId, rootId) {
  if (folderId === rootId) return "";

  let current = DriveApp.getFolderById(folderId);
  const names = [];

  // Xavfsizlik: cheksiz loop bo‘lmasin
  for (let i = 0; i < 40; i++) {
    const id = current.getId();
    if (id === rootId) break;

    names.unshift(current.getName());

    const parents = current.getParents();
    if (!parents.hasNext()) break;
    current = parents.next();
  }

  // Agar ROOT ga yetib bormagan bo‘lsa ham, hech bo‘lmasa nomlar chiqadi
  return names.join("/");
}
