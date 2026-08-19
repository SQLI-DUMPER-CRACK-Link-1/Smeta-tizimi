/**
 * T2_Yuklash.js — TIZIM_02: KOMPYUTERDAN FAYL YUKLASH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «kompyuterga yuklash degan narsa yo'qku bu yerda,
 * dropdown chiqayapdi. Uni bossa Tizim_01 lrv pluslari chiqayapdi».
 *
 * IKKALA E'TIROZ HAM TO'G'RI:
 *
 *  1) Yuklash yo'li YO'Q edi. Import faqat Drive'da ALLAQACHON turgan
 *     obyektdan ishlardi. Lekin Tizim_02 — MUSTAQIL va BO'SH tizim;
 *     unga yangi smeta kompyuterdan kelishi kerak.
 *
 *  2) Ro'yxat Tizim_01 skanidan kelardi — ya'ni eski tizimning
 *     obyektlari va ular bilan birga LRV_PLUS ishchi fayllari. Bu
 *     chalkash: Tizim_02 da ular umuman bo'lmasligi kerak.
 *
 * SHU MODUL: fayl brauzerdan base64 holida keladi, Drive'dagi
 * «Tizim_02 / _MANBA» papkasiga saqlanadi, varaqlari ro'yxati
 * qaytariladi. Keyin foydalanuvchi qaysi varaq LOKALKA, qaysi biri
 * SVODKA ekanini o'zi belgilaydi.
 *
 * ⚠️ TIZIM_01 GA MUTLAQO TEGILMAYDI. Fayl butunlay boshqa papkaga
 * tushadi, eski skan ham, LRV_PLUS ham o'zgarmaydi.
 */

/** Tizim_02 ning MANBA papkasi (yuklangan asl fayllar shu yerda). */
function _t2ManbaPapka(){
  var a = sozAsosiy();
  var ildiz = DriveApp.getFolderById(a.rootId);
  var t2 = null;
  var it = ildiz.getFoldersByName('Tizim_02');
  t2 = it.hasNext() ? it.next() : ildiz.createFolder('Tizim_02');

  var mit = t2.getFoldersByName('_MANBA');
  return mit.hasNext() ? mit.next() : t2.createFolder('_MANBA');
}

/**
 * Brauzerdan kelgan faylni Drive'ga saqlaydi va varaqlarini qaytaradi.
 *
 * @param {string} nom     fayl nomi (masalan «Smeta_Amfiteatr.xlsx»)
 * @param {string} b64     fayl mazmuni base64 holida
 * @param {string} mime    MIME turi (brauzer beradi)
 * @return {Object} {ok, fayl_id, nom, varaqlar:[...], konvert}
 */
function apiT2FaylYukla(nom, b64, mime){
  var t0 = Date.now();
  try{
    nom = String(nom || '').trim();
    if(!nom) return {ok:false, xabar:'Fayl nomi kerak'};
    if(!b64) return {ok:false, xabar:'Fayl mazmuni bo\'sh'};

    var papka = _t2ManbaPapka();

    /* Bir xil nomli fayl qayta yuklansa — eskisini arxivga surmaymiz,
       yangisini vaqt belgisi bilan saqlaymiz. Sabab: qaysi fayldan
       qaysi import kelganini keyin aniqlash mumkin bo'lsin. */
    var belgi = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyyMMdd_HHmmss');
    var saqlanadigan = belgi + '__' + nom;

    var baytlar = Utilities.base64Decode(b64);
    var blob = Utilities.newBlob(baytlar, mime || 'application/octet-stream', saqlanadigan);
    var fayl = papka.createFile(blob);

    /* Excel bo'lsa varaqlarni o'qish uchun Google Sheets ga konvert
       qilish kerak. Konvert nusxasi ham SHU papkada qoladi — asl fayl
       o'zgarmaydi va qaysi biridan o'qilgani ko'rinib turadi. */
    var konvert = false, oqiladiganId = fayl.getId(), varaqlar = [];

    if(fayl.getMimeType() !== MimeType.GOOGLE_SHEETS){
      try{
        var res = Drive.Files.copy(
          {title: '(GS) ' + saqlanadigan, mimeType: MimeType.GOOGLE_SHEETS,
           parents: [{id: papka.getId()}]},
          fayl.getId());
        oqiladiganId = res.id;
        konvert = true;
      }catch(e){
        return {ok:false,
          xabar:'Faylni Google Sheets ga o\'girib bo\'lmadi: ' +
                ((e && e.message) || e) +
                '  (Excel emasmi yoki Drive API yoqilmaganmi?)',
          fayl_id: fayl.getId()};
      }
    }

    var ss = SpreadsheetApp.openById(oqiladiganId);
    var shlar = ss.getSheets();
    for(var i=0;i<shlar.length;i++){
      var sh = shlar[i];
      var nomSh = sh.getName();
      if(nomSh.charAt(0) === '_') continue;              // xizmat varag'i
      varaqlar.push({
        nom: nomSh,
        qator: sh.getLastRow(),
        ustun: sh.getLastColumn(),
        /* Taklif: nomida «СВОД» bo'lsa svodka deb taxmin qilamiz.
           Bu FAQAT taklif — oxirgi qarorni foydalanuvchi qiladi. */
        taklif: /СВОД|SVOD|СМЕТНАЯ|РЕСУРС/i.test(nomSh) ? 'svodka' : 'lokalka'
      });
    }

    if(!varaqlar.length){
      return {ok:false, xabar:'Faylda o\'qiladigan varaq topilmadi',
              fayl_id: oqiladiganId};
    }

    return {ok:true, fayl_id: oqiladiganId, asl_id: fayl.getId(),
            nom: saqlanadigan, konvert: konvert, varaqlar: varaqlar,
            papka: papka.getName(), papka_url: papka.getUrl(),
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2FaylYukla: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/**
 * Yuklangan fayldan TIZIM_02 ga obyekt yaratadi va hisoblaydi.
 *
 * Tizim_01 dan MUTLAQO mustaqil: obyekt nomini foydalanuvchi beradi,
 * qaysi varaq lokalka/svodka ekanini ham o'zi belgilaydi.
 *
 * @param {string} obyektNom  yangi obyekt nomi
 * @param {string} faylId     `apiT2FaylYukla` qaytargan id
 * @param {Array}  varaqlar   [{nom, rol}] — rol: 'lokalka' | 'svodka' | ''
 */
function apiT2YuklanganImport(obyektNom, faylId, varaqlar){
  var t0 = Date.now();
  try{
    obyektNom = String(obyektNom || '').trim();
    if(!obyektNom) return {ok:false, xabar:'Obyekt nomi kerak'};
    if(!faylId)    return {ok:false, xabar:'Fayl tanlanmagan'};
    if(!varaqlar || !varaqlar.length)
      return {ok:false, xabar:'Kamida bitta varaq belgilanishi kerak'};

    var tanlangan = varaqlar.filter(function(v){
      return v && v.rol && (v.rol === 'lokalka' || v.rol === 'svodka');
    });
    if(!tanlangan.length)
      return {ok:false, xabar:'Hech bo\'lmasa bitta varaqni LOKALKA deb belgilang'};

    var natijalar = [], xatolar = [];
    for(var i=0;i<tanlangan.length;i++){
      var v = tanlangan[i];
      try{
        var r = apiT2FaylImport(obyektNom, faylId, v.nom, v.rol);
        natijalar.push(r);
        if(!r.ok) xatolar.push('«' + v.nom + '» (' + v.rol + '): ' + r.xabar);
      }catch(e){
        xatolar.push('«' + v.nom + '»: ' + ((e && e.message) || e));
      }
    }

    var hisob = null;
    if(natijalar.some(function(r){ return r.ok; })) hisob = apiT2Ishla(obyektNom);

    return {ok: !!(hisob && hisob.ok), obyekt: obyektNom,
            import: natijalar, hisob: hisob, xatolar: xatolar,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2YuklanganImport: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/** Tizim_02 ga yuklangan manba fayllar ro'yxati. */
function apiT2ManbaFayllar(){
  try{
    var papka = _t2ManbaPapka(), out = [];
    var it = papka.getFiles();
    while(it.hasNext()){
      var f = it.next();
      /* Konvert nusxalari «(GS) » bilan boshlanadi — ro'yxatda ular
         ko'rsatiladi, chunki aynan ulardan o'qiladi. */
      out.push({id: f.getId(), nom: f.getName(),
                sana: Utilities.formatDate(f.getLastUpdated(),
                        'Asia/Tashkent', 'dd.MM.yyyy HH:mm'),
                ts: f.getLastUpdated().getTime(),
                sheets: f.getMimeType() === MimeType.GOOGLE_SHEETS});
    }
    out.sort(function(a,b){ return b.ts - a.ts; });
    return {ok:true, papka_url: papka.getUrl(), fayllar: out};
  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}
