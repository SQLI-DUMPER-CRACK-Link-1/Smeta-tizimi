/********************************************************************
 * 95_ObyektHujjat.js — OBYEKT HUJJATLARI: R2 → DRIVE DUAL-STORAGE
 * ==================================================================
 * ⚠️ EGALIK: CLAUDE (arxitektura/ko'prik qatlami). Antigravity tegmaydi.
 *
 * NIMA UCHUN BOR: foydalanuvchi ko'rsatmasi — Tizim_02 dagi "Obyekt
 * hujjatlari" (t2_obyekt_hujjat) fayllari faqat Cloudflare R2 ga
 * yuklanardi. Endi HAR BIR FAYL Drive'dagi tegishli obyekt papkasi
 * ichiga ham (asl nomi bilan) nusxa sifatida saqlanadi — R2 tezkor
 * so'rov uchun, Drive esa foydalanuvchi allaqachon ishlatib kelayotgan
 * "haqiqiy" fayl tizimi bo'lib qoladi.
 *
 * BU FUNKSIYA "BEST-EFFORT": chaqiruvchi (Cloudflare Pages Function
 * /api/gas orqali) R2 yozuvidan KEYIN, alohida so'rov bilan chaqiradi.
 * Bu yerda xato bo'lsa ham t2_obyekt_hujjat yozuvi (R2 asosiy nusxa)
 * allaqachon saqlangan bo'ladi — Drive faqat QO'SHIMCHA nusxa.
 ********************************************************************/

/**
 * @param {string} obyektNomi  — Tizim_01 dagi obyekt/papka nomi (Tizim_02
 *                                obyekt nomi bilan bir xil bo'lishi kerak).
 * @param {string} hujjatTuri  — 'loyiha' | 'hujjat'
 * @param {string} faylNomi    — asl fayl nomi (kengaytma bilan)
 * @param {string} mimeType    — fayl MIME turi
 * @param {string} base64      — fayl mazmuni base64 kodlangan holda
 * @return {{ok:boolean, fileId?:string, url?:string, error?:string}}
 */
function apiObyektHujjatDriveSaqla(obyektNomi, hujjatTuri, faylNomi, mimeType, base64) {
  obyektNomi = String(obyektNomi || '').trim();
  faylNomi = String(faylNomi || 'fayl').trim();
  if (!obyektNomi) return { ok: false, error: 'obyekt nomi bo\'sh' };
  if (!base64) return { ok: false, error: 'fayl mazmuni bo\'sh' };

  var a = sozAsosiy(), root;
  try { root = DriveApp.getFolderById(a.rootId); }
  catch (e) { return { ok: false, error: 'ROOT papka xatosi: ' + e }; }

  /* Bo'lingan (split) obyektlar "Papka - Lokalka" ko'rinishida bo'ladi
     (05_Papka.js dagi _cfgKalit mantiqi bilan bir xil) — Drive papkasi
     esa doim PAPKA nomi bilan. */
  var papkaNomi = obyektNomi.split(' - ')[0].trim();
  var target = null, subs = root.getFolders();
  while (subs.hasNext()) {
    var f = subs.next();
    if (f.getName().trim() === papkaNomi) { target = f; break; }
  }
  if (!target) return { ok: false, error: '"' + papkaNomi + '" nomli obyekt papkasi Drive\'da topilmadi' };

  try {
    var hujjatlarFolder = _ohNamedSubfolder(target, 'Hujjatlar');
    var turFolder = _ohNamedSubfolder(hujjatlarFolder,
      hujjatTuri === 'loyiha' ? 'Loyiha chizmalari' : 'Boshqa hujjatlar');

    var blob = Utilities.newBlob(Utilities.base64Decode(base64),
      mimeType || 'application/octet-stream', faylNomi);
    var file = turFolder.createFile(blob);
    return { ok: true, fileId: file.getId(), url: file.getUrl() };
  } catch (e) {
    return { ok: false, error: 'Drive yozish xatosi: ' + (e.message || e) };
  }
}

function _ohNamedSubfolder(parent, nomi) {
  var it = parent.getFoldersByName(nomi);
  if (it.hasNext()) return it.next();
  return parent.createFolder(nomi);
}
