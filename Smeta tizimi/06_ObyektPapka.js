/********************************************************************
 * 06_ObyektPapka.js — YANGI OBYEKT PAPKA TUZILMASI
 * ------------------------------------------------------------------
 * Foydalanuvchi (2026-08-25): «obyekt papkalari ideal va kuchli
 * tuzilmada bo'lishi kerak — ichida smeta+F2 yig'ilgan joy, chizma/PDF
 * uchun alohida papka, birinchi qavatda ishchi smeta va viborka».
 *
 * MUAMMO (eski holat):
 *   • ИШЧИ СМЕТА (ko'zgu) BUTUN tizim uchun BITTA umumiy "Tizim_02"
 *     papkasida edi — obyektning o'zidan tashqarida.
 *   • Viborka BUTUN tizim uchun BITTA umumiy jadval edi (obyektga
 *     bog'lanmagan — [[material-mustaqil-tizimlar]]).
 *   • Smeta fayllari va F2 papkasi obyekt ILDIZIDA aralash yotardi.
 *
 * YANGI TUZILMA (faqat YANGI obyektlar uchun — mavjud 4 taga
 * TEGILMAYDI, foydalanuvchi ATAYLAB shunday so'radi):
 *
 *   📁 [OBYEKT NOMI]/                      ← obyekt ildiz papkasi
 *   ├── 📊 [OBYEKT NOMI] — ИШЧИ СМЕТА       ← T2_Kozgu.js shu yerga yozadi
 *   ├── 📁 Смета/                           ← lokalka/svodka fayllari shu yerda
 *   │   └── 📁 F2/                          ← F2 hujjatlari shu yerda
 *   ├── 📁 Лойиҳа ҳужжатлари/               ← chizmalar, PDF
 *   ├── 📁 Виборка/                         ← t2_viborka bilan bog'liq fayllar
 *   └── ⚙️ Tizim Fayllari/                  ← mavjud tizim papkasi (o'zgarmadi)
 *
 * ⚠️ ORQAGA MOSLIK: `_t2ObyektYangiTuzilmaMi(folder)` — "Смета"
 * quyi papkasi bor-yo'qligiga qarab eski/yangi holatni farqlaydi.
 * Kozgu joylashuvi va F2 yuklash funksiyalari shuni tekshirib, ESKI
 * obyektlarda ESKI joyga (o'zgarishsiz), YANGI obyektlarda YANGI
 * joyga yozadi. Hech qanday mavjud fayl ko'chirilmaydi/o'zgartirilmaydi.
 ********************************************************************/

var T2_STRUKTURA = {
  SMETA:     'SMETA',
  F2:        'F2',
  LOYIHA:    'Loyihalar va Chizmalar',
  VIBORKA:   'Viborka'
};

/** Papka ichida shu nomdagi quyi papkani topadi yoki yaratadi. */
function _papkaOlYokiYarat(ota, nom){
  var it = ota.getFoldersByName(nom);
  if(it.hasNext()) return it.next();
  return ota.createFolder(nom);
}

/**
 * Obyekt papkasi YANGI tuzilmadami — "Смета" quyi papkasi borligiga
 * qarab aniqlaydi. Bu ORQAGA MOSLIK kaliti: eski 4 obyektda bu papka
 * yo'q, shuning uchun ular avvalgidek ishlayveradi.
 */
function _t2ObyektYangiTuzilmaMi(folder){
  try{ return folder.getFoldersByName(T2_STRUKTURA.SMETA).hasNext(); }
  catch(e){ return false; }
}

/**
 * Obyekt papkasi ICHIDA to'liq tuzilmani quradi — IDEMPOTENT
 * (mavjud papkalarga tegmaydi, faqat yetishmayotganini qo'shadi).
 *
 * @return {{smeta, f2, loyiha, viborka, tizim}} papka obyektlari
 */
function _t2ObyektPapkaTuzilmaYarat(folder){
  var smeta = _papkaOlYokiYarat(folder, T2_STRUKTURA.SMETA);
  var f2 = _papkaOlYokiYarat(smeta, T2_STRUKTURA.F2);
  var loyiha = _papkaOlYokiYarat(folder, T2_STRUKTURA.LOYIHA);
  var viborka = _papkaOlYokiYarat(folder, T2_STRUKTURA.VIBORKA);
  var tizim = _getSysFolder(folder);   // 05_Papka.js dagi mavjud funksiya
  return {smeta: smeta, f2: f2, loyiha: loyiha, viborka: viborka, tizim: tizim};
}

/**
 * YANGI obyekt yaratadi — Drive papka tuzilmasi + Tizim_02 bazadagi
 * `t2_obyekt` qatori BIR AMALDA.
 *
 * ⚠️ Bu funksiya faqat YANGI obyektlar uchun. Mavjud obyektlarni
 * import qilish uchun ishlatilmaydi — ular o'z eski joylashuvida
 * qoladi (foydalanuvchi ataylab shunday so'ragan, 2026-08-25).
 *
 * @param {string} nom      Obyekt nomi (papka nomi ham shu bo'ladi)
 * @param {string=} rootTanlov Drive ROOT IDsi yoki papka havolasi
 * @return {{ok, folderId, folderUrl, obyekt_id, tuzilma}}
 */
function _t2DrivePapkaId(raw){
  raw = String(raw || '').trim();
  if(!raw) return '';
  var m = raw.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if(m) return m[1];
  return /^[A-Za-z0-9_-]{10,}$/.test(raw) ? raw : '';
}

/** Joriy Drive ildizidagi papkalar — UI tanlovi uchun, yozmaydi. */
function apiT2DriveRootlarOl(){
  try{
    var a = sozAsosiy(), out = [], seen = {};
    var tanlangan = DriveApp.getFolderById(a.rootId);
    out.push({id:tanlangan.getId(), nom:tanlangan.getName(), url:tanlangan.getUrl(), sozlangan:true});
    seen[tanlangan.getId()] = true;
    var it = DriveApp.getRootFolder().getFolders(), n = 0;
    while(it.hasNext() && n < 100){
      var f = it.next(); n++;
      if(seen[f.getId()]) continue;
      seen[f.getId()] = true;
      out.push({id:f.getId(), nom:f.getName(), url:f.getUrl(), sozlangan:false});
    }
    out.sort(function(x,y){ return x.sozlangan ? -1 : (y.sozlangan ? 1 : x.nom.localeCompare(y.nom)); });
    return {ok:true, default_root_id:a.rootId, papkalar:out};
  }catch(e){ return {ok:false, xabar:'Drive ROOT ro\'yxati o\'qilmadi: ' + ((e && e.message) || e)}; }
}

function apiT2YangiObyektYarat(nom, rootTanlov){
  nom = String(nom || '').trim();
  if(!nom) return {ok:false, xabar:'Obyekt nomi bo\'sh'};

  var a;
  try{ a = sozAsosiy(); }
  catch(e){ return {ok:false, xabar:'Sozlamalar xatosi: ' + ((e && e.message) || e)}; }

  var rootId = _t2DrivePapkaId(rootTanlov) || a.rootId;
  var root;
  try{ root = DriveApp.getFolderById(rootId); }
  catch(e){ return {ok:false, xabar:'Tanlangan Drive ROOT papka ochilmadi. Havola yoki ID ni tekshiring.'}; }

  /* Bir xil nomli papka ikki marta yaratilmasin. Oldingi urinishda
     Drive papka yaralib, Supabase qatori yozilmagan bo'lsa, uni faqat
     joriy tenant uchun idempotent tiklaymiz. */
  var mavjud = root.getFoldersByName(nom);
  if(mavjud.hasNext()){
    var mavjudFolder = mavjud.next();
    try{
      var komp = _t2KompaniyaId();
      var boshqaTenant = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(nom) +
        '&kompaniya_id=neq.' + komp + '&select=id,kompaniya_id&limit=1');
      if(boshqaTenant.length){
        return {ok:false, sabab:'boshqa_tenant', folderId:mavjudFolder.getId(),
          xabar:'"' + nom + '" nomli papka boshqa kompaniyaga tegishli. Yangi obyekt uchun boshqa nom bering.'};
      }
      var borObyekt = apiT2ObyektTayyorla(nom, mavjudFolder.getId());
      var borTuzilma = _t2ObyektPapkaTuzilmaYarat(mavjudFolder);
      return {
        ok:true, qayta_tiklandi:true, obyekt_id:borObyekt.id, tur:borObyekt.tur,
        folderId:mavjudFolder.getId(), folderUrl:mavjudFolder.getUrl(),
        tuzilma:{
          smeta:borTuzilma.smeta.getUrl(), f2:borTuzilma.f2.getUrl(),
          loyiha:borTuzilma.loyiha.getUrl(), viborka:borTuzilma.viborka.getUrl()
        },
        xabar:'"' + nom + '" uchun mavjud Drive papkasi bazaga bog\'landi.'
      };
    }catch(e){
      return {ok:false, sabab:'tiklash_xatosi', folderId:mavjudFolder.getId(),
        xabar:'Mavjud papkani obyektga bog\'lashda xato: ' + ((e && e.message) || e)};
    }
  }

  var folder = root.createFolder(nom);
  var tuzilma;
  try{
    tuzilma = _t2ObyektPapkaTuzilmaYarat(folder);
  }catch(e){
    return {ok:false, xabar:'Papka tuzilmasini qurishda xato: ' + ((e && e.message) || e),
            folderId: folder.getId()};
  }

  /* Baza qatori — mavjud bo'lsa xato bermaydi (apiT2ObyektTayyorla
     idempotent, T2_Import.js:121). */
  var obyektId = null, obyektTur = null;
  try{
    var ob = apiT2ObyektTayyorla(nom, folder.getId());
    obyektId = ob.id; obyektTur = ob.tur;
  }catch(e){
    /* Drive papkasi allaqachon yaratildi — buni yashirmaymiz, lekin
       baza xatosini ham JIM yutmaymiz. */
    return {ok:false, xabar:'Papka yaratildi, lekin baza qatorini yozishda xato: ' +
                             ((e && e.message) || e),
            folderId: folder.getId(), folderUrl: folder.getUrl()};
  }

  return {
    ok: true, obyekt_id: obyektId, tur: obyektTur,
    folderId: folder.getId(), folderUrl: folder.getUrl(),
    tuzilma: {
      smeta: tuzilma.smeta.getUrl(), f2: tuzilma.f2.getUrl(),
      loyiha: tuzilma.loyiha.getUrl(), viborka: tuzilma.viborka.getUrl(),
    },
    xabar: '"' + nom + '" yaratildi: SMETA, F2, Loyihalar va Viborka papkalari bilan.'
  };
}
