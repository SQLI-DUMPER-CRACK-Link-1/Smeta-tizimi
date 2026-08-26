/**
 * 09_KorzinkaDrive.js - Obyektlarni Google Drive'da boshqarish (Korzinka / Tahrirlash)
 */

function apiT2DriveTrash(args) {
  var type = args.type;
  var id = args.id;
  var nomi = args.nomi;
  
  if(type !== 'obyekt' && type !== 't2_obyekt') return {ok: true, skipped: true};
  
  var papka = _t2KozguPapka(nomi);
  if(!papka) return {ok: false, error: 'Papka topilmadi'};
  
  try {
    papka.setName('🗑️ ' + nomi); // Nomi o'zgartiriladi
    papka.setTrashed(true);      // Drive korzinkasiga o'tkaziladi
    return {ok: true, xabar: 'Papkaga 🗑️ qoshildi va Korzinkaga otkazildi'};
  } catch(e) {
    return {ok: false, error: e.toString()};
  }
}

function apiT2DriveRestore(args) {
  var type = args.type;
  var id = args.id;
  var nomi = args.nomi;
  
  if(type !== 'obyekt' && type !== 't2_obyekt') return {ok: true, skipped: true};
  
  // Trash dagi fayllarni izlash (nomida 🗑️ bo'lishi mumkin)
  var q = "title contains '" + nomi + "' and trashed = true and mimeType = 'application/vnd.google-apps.folder'";
  var folders = DriveApp.searchFolders(q);
  
  if(!folders.hasNext()) {
    // Agar trashda topilmasa, ehtimol ismi axlatsiz qolgan yoki axlatga o'tmagan
    return {ok: false, error: 'Drive korzinkasidan papka topilmadi'};
  }
  
  var papka = folders.next();
  try {
    papka.setTrashed(false);
    var eskiNom = papka.getName().replace('🗑️ ', '');
    papka.setName(eskiNom);
    return {ok: true, xabar: 'Drive korzinkasidan tiklandi'};
  } catch(e) {
    return {ok: false, error: e.toString()};
  }
}

function apiT2DriveHardDelete(args) {
  var type = args.type;
  var id = args.id;
  var nomi = args.nomi;
  
  if(type !== 'obyekt' && type !== 't2_obyekt') return {ok: true, skipped: true};
  
  var q = "title contains '" + nomi + "' and trashed = true and mimeType = 'application/vnd.google-apps.folder'";
  var folders = DriveApp.searchFolders(q);
  
  if(!folders.hasNext()) return {ok: true, xabar: 'Allaqachon ochirilgan yoki topilmadi'};
  
  var papka = folders.next();
  // Apps Script da file.setTrashed(true) qilish mumkin, lekin butunlay o'chirish (Hard Delete)
  // Drive API v3 (Advanced Service) orqali qilinadi.
  try {
    Drive.Files.remove(papka.getId());
    return {ok: true, xabar: 'Drive dan butunlay ochirib tashlandi'};
  } catch(e) {
    return {ok: false, error: e.toString()};
  }
}

function apiT2DriveRename(args) {
  var type = args.type;
  var id = args.id;
  var eskiNom = args.eskiNom; // frontend hali yubormadi, izlash nomi orqali
  var nomi = args.yangiNom;
  // TODO: Agar obyekt nomi o'zgarsa, eskisini topish kerak.
  // Frontend faqat id va yangiNom yubormoqda!
  return {ok: true, xabar: 'Kutib turadi, eski nom zarur'};
}
