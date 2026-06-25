/*******************************
 * PickerServer.gs — STABLE
 * Writes:
 * - TARGET_FOLDER_ID (truth)
 * - TARGET_FOLDER_PATH (display, relative)
 *******************************/

function picker_listSubfolders(folderId) {
  const f = DriveApp.getFolderById(folderId);
  const it = f.getFolders();
  const out = [];
  while (it.hasNext()) {
    const sf = it.next();
    out.push({ id: sf.getId(), name: sf.getName() });
  }
  out.sort((a,b)=>a.name.localeCompare(b.name, "ru"));
  return out;
}

function picker_getFolderName(folderId) {
  return DriveApp.getFolderById(folderId).getName();
}

function picker_confirmSelection(payload) {
  const ctx = payload && payload.context ? payload.context : {};
  const row = Number(ctx.row || 0);
  if (!row || row < 2) throw new Error("Picker: context.row noto‘g‘ri.");

  const folderId = String(payload && payload.folderId || "").trim();
  if (!folderId) throw new Error("Picker: folderId bo‘sh.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) throw new Error("REYESTR sheet topilmadi.");

  const map = headerMap_(sh);
  const colId = map[REY.TARGET_FOLDER_ID];
  const colPath = map[REY.TARGET_FOLDER_PATH];
  if (!colId || !colPath) throw new Error("REYESTR: TARGET_FOLDER_ID/TARGET_FOLDER_PATH ustunlari yo‘q.");

  // display path: remove root folder name prefix
  const rootName = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID).getName();
  let raw = String(payload && payload.folderPath || "");
  if (raw === rootName) raw = "";
  if (raw.startsWith(rootName + "/")) raw = raw.slice(rootName.length + 1);

  sh.getRange(row, colId).setValue(folderId);
  sh.getRange(row, colPath).setValue(raw);
}
