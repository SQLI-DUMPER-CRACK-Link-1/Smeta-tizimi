function apiDiagnostikaOcr(fileName) {
  try {
    var folder = DriveApp.getRootFolder().getFoldersByName('Fakturalar').next().getFoldersByName('Xato_Oqilganlar').next();
    var files = folder.getFilesByName(fileName);
    if (!files.hasNext()) return { ok: false, xabar: "Fayl topilmadi" };
    var file = files.next();
    
    var resource = { name: file.getName(), mimeType: MimeType.GOOGLE_DOCS };
    var t0 = Date.now();
    var converted = Drive.Files.create(resource, file.getBlob()); // Or Drive.Files.insert for v2
    var doc = DocumentApp.openById(converted.id);
    var text = doc.getBody().getText();
    DriveApp.getFileById(converted.id).setTrashed(true);
    
    // var parsed = typeof _parseFakturaText === 'function' ? _parseFakturaText(text) : null;
    var parsed = null;
    
    return { ok: true, ocrTimeMs: Date.now() - t0, textLength: text.length, textSnippet: text.substring(0, 500), parsed: parsed };
  } catch(e) {
    return { ok: false, error: String(e), stack: e.stack };
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiDiagnostikaOcr = apiDiagnostikaOcr;
}
