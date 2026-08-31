/********************************************************************
 * 96_T2Papka.js — DRIVE PAPKA TUZILMASI (tashkilot → loyiha → obyekt → tur)
 * ==================================================================
 * EGALIK: Claude (ko'prik qatlami). Mavjud fayllarga TEGILMAGAN.
 *
 * FOYDALANUVCHI: «har bir tashkilot, uni ichida obyekt, ichida turiga
 * ko'ra hujjat ochilganida drive da va mindmapda o'zini tartibidagi
 * folderlar va mindmap yasashi kerak — hozir hammasi pala-partish
 * tashlanaveradi».
 *
 * AVVALGI HOLAT (95_ObyektHujjat.js): bitta umumiy rootId dan boshlanardi,
 * kompaniya/loyiha darajasi yo'q, hujjat turi ikkita ('Loyiha chizmalari'
 * yoki 'Boshqa hujjatlar') — qolgan hamma narsa ikkinchisiga tushardi.
 * Papka ID saqlanmasdi, har yozishda butun Drive skanlanardi.
 *
 * QURILADIGAN TUZILMA:
 *     [Kompaniya]
 *       └── [Loyiha]            (loyihasiz obyektda bu daraja tushib qoladi)
 *             └── [Obyekt]
 *                   ├── 01_Smeta
 *                   ├── 02_Shartnoma
 *                   ├── 03_Loyiha chizmalari
 *                   ├── 04_F2 va aktlar
 *                   ├── 05_Ijroiy hujjatlar (AOSR)
 *                   ├── 06_Fakturalar
 *                   ├── 07_Sklad hujjatlari
 *                   └── 08_Boshqa
 *
 * Papka nomlari va tartibi BAZADAN keladi (`t2_hujjat_turi`) — Drive va
 * mindmap AYNI ro'yxatdan o'qiydi, shuning uchun ular hech qachon
 * ajralib ketmaydi.
 *
 * ⚠️ MAVJUD OBYEKT PAPKALARI KO'CHIRILMAYDI. Tizim_01 dagi obyektlarning
 * Drive papkasi allaqachon bor va u yerda odamlar ishlaydi. Ularni
 * kompaniya papkasi ichiga ko'chirish havolalarni uzib, ishni to'xtatib
 * qo'yardi. Shuning uchun: papka QAYERDA bo'lsa o'sha yerda qoladi,
 * faqat ICHIGA tur papkalari qo'shiladi. Yangi obyektlar esa to'liq
 * zanjir bilan yaratiladi.
 ********************************************************************/

/**
 * Obyekt uchun papka zanjirini tayyorlaydi (idempotent).
 * Bor papkaga tegmaydi, yo'g'ini yaratadi va bazaga qayd etadi.
 *
 * @param {number} obyektId  t2_obyekt.id
 * @return {{ok:boolean, yaratildi?:number, papkalar?:Object, xabar?:string}}
 */
function apiT2PapkaTayyorla(obyektId){
  try{
    obyektId = Number(obyektId);
    if(!obyektId) return {ok:false, xabar:'obyekt_id kerak'};

    var reja = _t2Rpc('t2_papka_reja', {p_obyekt_id: obyektId});
    if(!reja || !reja.ok) return {ok:false, xabar:(reja && reja.xabar) || 'Reja olinmadi'};

    var yaratildi = 0, natija = {};

    /* ── 1) KOMPANIYA papkasi — KANONIK STORAGE WORKSPACE ILDIZIDAN ──
       STOR-001B / STORAGE_FOUNDATION_CONTRACT_V1 §7: global config root
       ISHLATILMAYDI. Ildiz — kompaniyaning tekshirilgan (verified/legacy)
       storage workspace root_folder_id (resolveCompanyStorage). Workspace
       yo'q va kompaniya papkasi ham bazada qayd etilmagan -> fail-closed. */
    var komp = reja.kompaniya, kompFolder, root = null;
    var ws = (typeof resolveCompanyStorage === 'function')
      ? resolveCompanyStorage(komp.id) : {ok:false};
    if(ws.ok){
      try{ root = DriveApp.getFolderById(ws.workspace.root_folder_id); }
      catch(e){ return {ok:false, code:'STORAGE_PERMISSION_DENIED',
        xabar:'Kompaniya storage workspace ildizi ochilmadi: ' + e}; }
    } else if(!komp.drive_id){
      return {ok:false, code:'STORAGE_WORKSPACE_NOT_CONFIGURED',
        xabar:'Kompaniya uchun tekshirilgan Drive storage workspace sozlanmagan'};
    }

    if(komp.drive_id){
      kompFolder = _t2PapkaOch(komp.drive_id);
    }
    if(!kompFolder){
      if(!root) return {ok:false, code:'STORAGE_WORKSPACE_NOT_CONFIGURED',
        xabar:'Kompaniya papka drive_id yaroqsiz va storage workspace yo\'q'};
      kompFolder = _t2PapkaTop(root, komp.nom);
      if(!kompFolder){ kompFolder = root.createFolder(komp.nom); yaratildi++; }
      _t2Rpc('t2_papka_qayd', {
        p_kompaniya_id: komp.id, p_daraja: 'kompaniya', p_nom: komp.nom,
        p_drive_id: kompFolder.getId(), p_ota_drive_id: root.getId(),
        p_yol: komp.nom});
    }
    natija.kompaniya = kompFolder.getId();

    /* ── 2) LOYIHA papkasi (bo'lsa) ──────────────────────────────── */
    var ota = kompFolder, yol = komp.nom;
    if(reja.loyiha){
      var loy = reja.loyiha, loyFolder;
      if(loy.drive_id) loyFolder = _t2PapkaOch(loy.drive_id);
      if(!loyFolder){
        loyFolder = _t2PapkaTop(kompFolder, loy.nom);
        if(!loyFolder){ loyFolder = kompFolder.createFolder(loy.nom); yaratildi++; }
        _t2Rpc('t2_papka_qayd', {
          p_kompaniya_id: komp.id, p_loyiha_id: loy.id, p_daraja: 'loyiha',
          p_nom: loy.nom, p_drive_id: loyFolder.getId(),
          p_ota_drive_id: kompFolder.getId(), p_yol: yol + '/' + loy.nom});
      }
      ota = loyFolder; yol = yol + '/' + loy.nom;
      natija.loyiha = loyFolder.getId();
    }

    /* ── 3) OBYEKT papkasi ───────────────────────────────────────────
       ⚠️ Tartib MUHIM: avval bazadagi qayd, keyin Tizim_01 dagi mavjud
       papka (`t2_obyekt.drive_id`), keyin nom bo'yicha qidiruv, oxirida
       yaratish. Mavjud papka TOPILSA — u KO'CHIRILMAYDI (yuqoridagi
       izohga qara), o'z joyida ishlatiladi. */
    var obNom = reja.obyekt_nom, obFolder = null;
    if(reja.obyekt_papka.drive_id) obFolder = _t2PapkaOch(reja.obyekt_papka.drive_id);
    if(!obFolder && reja.obyekt_papka.mavjud_drive_id){
      obFolder = _t2PapkaOch(reja.obyekt_papka.mavjud_drive_id);
    }
    if(!obFolder){
      /* Tizim_01 papkasi «Papka - Lokalka» emas, faqat PAPKA nomi bilan */
      var papkaNomi = String(obNom).split(' - ')[0].trim();
      obFolder = _t2PapkaTop(ota, papkaNomi) || _t2PapkaTop(root, papkaNomi);
      if(!obFolder){ obFolder = ota.createFolder(papkaNomi); yaratildi++; }
      _t2Rpc('t2_papka_qayd', {
        p_kompaniya_id: komp.id,
        p_loyiha_id: reja.loyiha ? reja.loyiha.id : null,
        p_obyekt_id: obyektId, p_daraja: 'obyekt', p_nom: papkaNomi,
        p_drive_id: obFolder.getId(), p_ota_drive_id: ota.getId(),
        p_yol: yol + '/' + papkaNomi});
    }
    natija.obyekt = obFolder.getId();
    natija.turlar = {};

    /* ── 4) HUJJAT TURI papkalari ────────────────────────────────── */
    for(var i = 0; i < reja.turlar.length; i++){
      var t = reja.turlar[i], tf = null;
      if(t.drive_id) tf = _t2PapkaOch(t.drive_id);
      if(!tf){
        tf = _t2PapkaTop(obFolder, t.papka);
        if(!tf){ tf = obFolder.createFolder(t.papka); yaratildi++; }
        _t2Rpc('t2_papka_qayd', {
          p_kompaniya_id: komp.id,
          p_loyiha_id: reja.loyiha ? reja.loyiha.id : null,
          p_obyekt_id: obyektId, p_daraja: 'tur', p_tur_kod: t.kod,
          p_nom: t.papka, p_drive_id: tf.getId(),
          p_ota_drive_id: obFolder.getId(),
          p_yol: yol + '/' + obNom + '/' + t.papka});
      }
      natija.turlar[t.kod] = tf.getId();
    }

    return {ok:true, yaratildi:yaratildi, papkalar:natija,
            izoh: yaratildi === 0 ? 'Hamma papka allaqachon bor edi'
                                  : yaratildi + ' ta papka yaratildi'};
  }catch(e){
    return {ok:false, xabar:'apiT2PapkaTayyorla: ' + ((e && e.message) || e)};
  }
}

/** Drive papkasini ID bo'yicha ochadi; o'chirilgan bo'lsa null. */
function _t2PapkaOch(id){
  if(!id) return null;
  try{
    var f = DriveApp.getFolderById(id);
    /* Korzinkaga tashlangan papkani «bor» deb hisoblash xato bo'lardi —
       fayl unga yozilsa odam uni ko'rmaydi. */
    if(f.isTrashed()) return null;
    return f;
  }catch(e){ return null; }
}

/** Ota ichidan nom bo'yicha papka topadi (birinchi mos kelgani). */
function _t2PapkaTop(ota, nom){
  if(!ota || !nom) return null;
  try{
    var it = ota.getFoldersByName(String(nom).trim());
    while(it.hasNext()){
      var f = it.next();
      if(!f.isTrashed()) return f;
    }
  }catch(e){}
  return null;
}

/**
 * Hujjatni TO'G'RI papkaga yozadi (turiga ko'ra).
 * `95_ObyektHujjat.js` dagi eskisining o'rniga — u faqat 2 ta turni
 * bilardi va kompaniya/loyiha darajasini umuman hisobga olmasdi.
 *
 * @param {number} obyektId
 * @param {string} turKod    t2_hujjat_turi.kod (smeta|shartnoma|loyiha|
 *                           akt|aosr|faktura|sklad|boshqa)
 * @param {string} faylNomi
 * @param {string} mimeType
 * @param {string} base64
 */
function apiT2HujjatDriveSaqla(obyektId, turKod, faylNomi, mimeType, base64){
  try{
    faylNomi = String(faylNomi || 'fayl').trim();
    if(!base64) return {ok:false, xabar:'Fayl mazmuni bo\'sh'};

    var p = apiT2PapkaTayyorla(obyektId);
    if(!p.ok) return p;

    /* Noma'lum tur «boshqa» ga tushadi — lekin JIM emas, javobda aytiladi */
    var kod = String(turKod || '').trim();
    var papkaId = p.papkalar.turlar[kod];
    var ogoh = null;
    if(!papkaId){
      papkaId = p.papkalar.turlar['boshqa'];
      ogoh = 'Noma\'lum hujjat turi «' + kod + '» — «Boshqa» papkasiga yozildi';
    }

    var folder = _t2PapkaOch(papkaId);
    if(!folder) return {ok:false, xabar:'Papka ochilmadi: ' + papkaId};

    var blob = Utilities.newBlob(Utilities.base64Decode(base64),
                 mimeType || 'application/octet-stream', faylNomi);
    var file = folder.createFile(blob);

    return {ok:true, fileId:file.getId(), url:file.getUrl(),
            papka:papkaId, tur:kod, ogohlantirish:ogoh};
  }catch(e){
    return {ok:false, xabar:'apiT2HujjatDriveSaqla: ' + ((e && e.message) || e)};
  }
}

/**
 * Barcha faol obyektlar uchun papka zanjirini tayyorlaydi.
 * Bir yurishda cheklangan miqdorda — GAS 6 daqiqa chegarasi uchun.
 */
function apiT2PapkaHammasi(){
  var natija = {korildi:0, tayyor:0, yaratildi:0, xato:0, tafsilot:[]};
  var boshlandi = Date.now();
  try{
    var obs = _t2Get('t2_obyekt?holat=eq.faol&select=id,nom&order=id');
    for(var i = 0; i < obs.length; i++){
      if(Date.now() - boshlandi > 4 * 60 * 1000){
        natija.tafsilot.push('vaqt tugadi — qolgani keyingi yurishda');
        break;
      }
      natija.korildi++;
      var r = apiT2PapkaTayyorla(obs[i].id);
      if(r.ok){
        natija.tayyor++; natija.yaratildi += (r.yaratildi || 0);
        if(r.yaratildi) natija.tafsilot.push(obs[i].nom + ': ' + r.yaratildi + ' papka');
      }else{
        natija.xato++;
        natija.tafsilot.push(obs[i].nom + ' XATO: ' + r.xabar);
      }
    }
  }catch(e){
    natija.xato++;
    natija.tafsilot.push('apiT2PapkaHammasi: ' + ((e && e.message) || e));
  }
  return natija;
}
