/***********************
 * ImportRoot.gs — v5.1 compatible
 * Scans ROOT folder recursively, finds Act spreadsheets, imports into REYESTR.
 *
 * Requires Code.gs (v5.1) with CONFIG + REY + helpers:
 * - headerMap_, readRow_, writeRow_, extractSpreadsheetIdFromUrl_
 * - findActSheet_ (detects act by A6 regex)
 * - quote/unquote helpers + parseToDate/format
 ***********************/

function importRootToReyestr() {
  setupReyestr_();        // from Code.gs
  applyReyestrDesign_();  // from Code.gs

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reyestr = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!reyestr) throw new Error("REYESTR topilmadi.");

  const root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  const rootName = root.getName();

  const stats = { folders: 0, files: 0, acts: 0, updated: 0, added: 0, skipped: 0, errors: 0 };

  import_scanFolder_(root, "", rootName, reyestr, stats);

  SpreadsheetApp.getUi().alert(
    `✅ Import tugadi.\n` +
    `Folders: ${stats.folders}\nFiles: ${stats.files}\nActs: ${stats.acts}\n` +
    `Added: ${stats.added}\nUpdated: ${stats.updated}\nSkipped: ${stats.skipped}\nErrors: ${stats.errors}`
  );
}

function import_scanFolder_(folder, relPath, rootName, reyestrSheet, stats) {
  stats.folders++;

  // --- files ---
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    stats.files++;

    if (f.getMimeType() !== MimeType.GOOGLE_SHEETS) { stats.skipped++; continue; }

    let actSS;
    try {
      actSS = SpreadsheetApp.openById(f.getId());
    } catch (e) {
      stats.skipped++;
      continue;
    }

    const actInfo = findActSheet_(actSS); // from Code.gs
    if (!actInfo) { stats.skipped++; continue; }

    // Build folder identity
    const folderId = folder.getId();
    const displayPath = relPath; // already relative

    // Read data from act
    let data;
    try {
      data = import_readFromActV51_(actInfo.sheet);
    } catch (e) {
      stats.errors++;
      continue;
    }

    const actUrl = actSS.getUrl();

    // upsert row
    const existingRow = import_findRowByUrl_(reyestrSheet, actUrl);

    const folderHyper = makeFolderHyperlinkFormula_(folderId, folder.getName());

    const payload = {
      [REY.ACT_FILE_URL]: actUrl,
      [REY.TARGET_FOLDER_ID]: folderId,
      [REY.TARGET_FOLDER_PATH]: displayPath,
      [REY.ACT_FOLDER_ID]: folderId,
      [REY.FOUND_FOLDER]: folderHyper,
      [REY.STATUS]: existingRow ? "IMPORTED_UPDATE" : "IMPORTED_NEW",
      [REY.LAST_SYNC]: new Date(),
      [REY.ERROR]: "",
      ...data
    };

    if (existingRow) {
      writeRow_(reyestrSheet, existingRow, payload, { formulaKeys: [REY.FOUND_FOLDER] });
      stats.updated++;
    } else {
      const newRow = reyestrSheet.getLastRow() + 1;
      writeRow_(reyestrSheet, newRow, payload, { formulaKeys: [REY.FOUND_FOLDER] });
      stats.added++;
    }

    stats.acts++;
  }

  // --- subfolders ---
  const sub = folder.getFolders();
  while (sub.hasNext()) {
    const sf = sub.next();
    const nextPath = relPath ? `${relPath}/${sf.getName()}` : sf.getName();
    import_scanFolder_(sf, nextPath, rootName, reyestrSheet, stats);
  }
}

/**
 * Reads fields from ACT sheet using the same cells as v5.1 write.
 * Also parses commission lines: "FIO - POS «ORG»"
 */
function import_readFromActV51_(sheet) {
  const c = CONFIG.CELLS;
  const obj = {};

  // A6: title with №
  const title = sheet.getRange(c.A6).getDisplayValue() || "";
  obj[REY.ACT_NUMBER] = (title.match(/№\s*([^\s]+)/) || [])[1] || "";

  obj[REY.WORK_NAME] = sheet.getRange(c.A7).getDisplayValue() || "";

  // Object: remove prefix if present
  const fullObj = sheet.getRange(c.D9).getDisplayValue() || "";
  obj[REY.OBJECT_NAME] = import_stripPrefix_(fullObj);

  obj[REY.PROGRESS] = sheet.getRange(c.B31).getDisplayValue() || "";
  obj[REY.PROJECT_DOC] = sheet.getRange(c.A33).getDisplayValue() || "";
  obj[REY.MATERIAL] = sheet.getRange(c.A38).getDisplayValue() || "";
  obj[REY.DEVIATION] = sheet.getRange(c.A42).getDisplayValue() || "";
  obj[REY.START_DATE] = sheet.getRange(c.E45).getDisplayValue() || "";
  obj[REY.END_DATE] = sheet.getRange(c.E46).getDisplayValue() || "";
  obj[REY.NEXT_WORK] = sheet.getRange(c.A50).getDisplayValue() || "";

  const type = import_detectActType_(sheet); // WITH_SUB or NO_SUB

  if (type === "NO_SUB") {
    obj[REY.SUB_NAME] = "";
    obj[REY.GEN_NAME] = import_unquoteOrg_(sheet.getRange(CONFIG.COMMISSION_NO_SUB.ORG).getDisplayValue() || "");

    obj[REY.GEN_FIO] = sheet.getRange(CONFIG.SIGN_NO_SUB.GEN).getDisplayValue() || "";
    obj[REY.TEX_FIO] = sheet.getRange(CONFIG.SIGN_NO_SUB.TEX).getDisplayValue() || "";
    obj[REY.PROJ_FIO] = sheet.getRange(CONFIG.SIGN_NO_SUB.PROJ).getDisplayValue() || "";

    const genLine = sheet.getRange(CONFIG.COMMISSION_NO_SUB.GEN).getDisplayValue() || "";
    const texLine = sheet.getRange(CONFIG.COMMISSION_NO_SUB.TEX).getDisplayValue() || "";
    const projLine = sheet.getRange(CONFIG.COMMISSION_NO_SUB.PROJ).getDisplayValue() || "";

    const pGen = import_parseCommissionLine_(genLine);
    const pTex = import_parseCommissionLine_(texLine);
    const pProj = import_parseCommissionLine_(projLine);

    obj[REY.GEN_POS] = pGen.pos || "";
    obj[REY.CUSTOMER_ORG] = import_unquoteOrg_(pTex.org || "");
    obj[REY.TEX_POS] = pTex.pos || "";
    obj[REY.PROJECT_ORG] = import_unquoteOrg_(pProj.org || "");
    obj[REY.PROJ_POS] = pProj.pos || "";

  } else {
    // WITH_SUB: ORG cell stores SUB org
    obj[REY.GEN_NAME] = ""; // unknown from act
    obj[REY.SUB_NAME] = import_unquoteOrg_(sheet.getRange(CONFIG.COMMISSION_WITH_SUB.ORG).getDisplayValue() || "");

    obj[REY.SUB_FIO] = sheet.getRange(CONFIG.SIGN_WITH_SUB.SUB).getDisplayValue() || "";
    obj[REY.GEN_FIO] = sheet.getRange(CONFIG.SIGN_WITH_SUB.GEN).getDisplayValue() || "";
    obj[REY.TEX_FIO] = sheet.getRange(CONFIG.SIGN_WITH_SUB.TEX).getDisplayValue() || "";
    obj[REY.PROJ_FIO] = sheet.getRange(CONFIG.SIGN_WITH_SUB.PROJ).getDisplayValue() || "";

    const subLine = sheet.getRange(CONFIG.COMMISSION_WITH_SUB.SUB).getDisplayValue() || "";
    const genLine = sheet.getRange(CONFIG.COMMISSION_WITH_SUB.GEN).getDisplayValue() || "";
    const texLine = sheet.getRange(CONFIG.COMMISSION_WITH_SUB.TEX).getDisplayValue() || "";
    const projLine = sheet.getRange(CONFIG.COMMISSION_WITH_SUB.PROJ).getDisplayValue() || "";

    const pSub = import_parseCommissionLine_(subLine);
    const pGen = import_parseCommissionLine_(genLine);
    const pTex = import_parseCommissionLine_(texLine);
    const pProj = import_parseCommissionLine_(projLine);

    obj[REY.SUB_POS] = pSub.pos || "";
    obj[REY.GEN_POS] = pGen.pos || "";
    obj[REY.CUSTOMER_ORG] = import_unquoteOrg_(pTex.org || "");
    obj[REY.TEX_POS] = pTex.pos || "";
    obj[REY.PROJECT_ORG] = import_unquoteOrg_(pProj.org || "");
    obj[REY.PROJ_POS] = pProj.pos || "";
  }

  return obj;
}

function import_detectActType_(sheet) {
  // if F64 filled => WITH_SUB
  try {
    const f64 = String(sheet.getRange("F64").getDisplayValue() || "").trim();
    if (f64) return "WITH_SUB";
  } catch (e) {}
  return "NO_SUB";
}

function import_parseCommissionLine_(line) {
  const s = String(line || "").trim();
  const m = s.match(/^(.+?)\s*-\s*(.+?)\s*(«.+?»)?\s*$/);
  if (!m) {
    const org = (s.match(/«([^»]+)»/) || [])[1] || "";
    return { fio: "", pos: "", org: org ? `«${org}»` : "" };
  }
  return {
    fio: String(m[1] || "").trim(),
    pos: String(m[2] || "").trim(),
    org: String(m[3] || "").trim()
  };
}

function import_unquoteOrg_(val) {
  const s = String(val || "").trim();
  const m = s.match(/«([^»]+)»/);
  return m ? m[1].trim() : s.replace(/«|»/g, "").trim();
}

function import_stripPrefix_(fullText) {
  const t = String(fullText || "").trim();
  const p = String(CONFIG.OBJECT_PREFIX || "").trim();
  if (!t) return "";
  if (!p) return t;

  if (t.startsWith(p)) return t.slice(p.length).trim();

  const p2 = p.replace(/\s+/g, " ");
  const t2 = t.replace(/\s+/g, " ");
  if (t2.startsWith(p2)) return t2.slice(p2.length).trim();

  return t;
}

function import_findRowByUrl_(sheet, url) {
  const map = headerMap_(sheet);
  const col = map[REY.ACT_FILE_URL];
  if (!col) return null;

  const last = sheet.getLastRow();
  if (last <= 1) return null;

  const values = sheet.getRange(2, col, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === String(url || "").trim()) return i + 2;
  }
  return null;
}
