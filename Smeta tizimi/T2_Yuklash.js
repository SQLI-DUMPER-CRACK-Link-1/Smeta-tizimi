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

        /* ⚠️ 2026-08-19: nomni ALOHIDA qo'yamiz.
         *
         * Yuqoridagi `title` maydoni Drive API v2 niki. Loyihada v3
         * yoqilgan bo'lsa u JIM e'tiborsiz qoldiriladi va konvert
         * nusxasi asl nom bilan (kengaytmasi kesilgan holda) qoladi.
         * Foydalanuvchi papkada «…_RES» va «…_RES.xlsx» ni yonma-yon
         * ko'rib qaysi biri o'qilishini bilmaydi.
         *
         * DriveApp orqali nomlash Drive API versiyasiga bog'liq emas. */
        try{ DriveApp.getFileById(oqiladiganId).setName('(GS) ' + saqlanadigan); }
        catch(e3){}
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

    /* ⚠️ HUJJAT ROLINI TAXMIN QILAMIZ — fayl NOMIGA qarab.
     *
     * RES/LRV alohida hujjat bo'lgani uchun rol asosan fayl nomidan
     * bilinadi: «…RES…», «…СВОД…», «…РЕСУРС…» → svodka.
     * Bu FAQAT taklif — oxirgi qarorni foydalanuvchi qiladi, chunki
     * nom qoidasi har tashkilotda har xil bo'lishi mumkin. */
    var nomU = String(nom).toUpperCase();
    var rolTaklif = /(^|[^A-Z])RES([^A-Z]|$)|СВОД|РЕСУРС|SVOD|ВЕДОМОСТ/.test(nomU)
      ? 'svodka' : 'lokalka';

    return {ok:true, fayl_id: oqiladiganId, asl_id: fayl.getId(),
            nom: saqlanadigan, asl_nom: nom,
            konvert: konvert, varaqlar: varaqlar, rol_taklif: rolTaklif,
            papka: papka.getName(), papka_url: papka.getUrl(),
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2FaylYukla: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/**
 * Yuklangan HUJJATLARDAN Tizim_02 ga obyekt yaratadi va hisoblaydi.
 *
 * ⚠️ 2026-08-19 QAYTA QURILDI — MODEL XATO EDI.
 *
 * Foydalanuvchi: «res va lrv alohida-alohida hujjat bo'ladiku, sani bu
 * koding faqat hujjat ichidagi sahifani o'qiyapdi».
 *
 * To'g'ri e'tiroz. Avvalgi versiya BITTA fayl ichidagi varaqlar bilan
 * ishlardi. Haqiqatda esa:
 *     LRV (lokalka)  — alohida fayl
 *     RES (svodka)   — alohida fayl
 * va har birining ICHIDA bir nechta varaq bo'lishi mumkin (masalan
 * lokalkada bir necha bo'lim, svodkada bir necha bo'lak).
 *
 * ENDI IKKI DARAJALI:
 *   HUJJAT darajasi — har fayl o'z ROLI bilan (lokalka / svodka)
 *   VARAQ darajasi  — har fayl ichida qaysi varaqlar olinishi
 *
 * @param {string} obyektNom  yangi obyekt nomi
 * @param {Array}  hujjatlar  [{fayl_id, rol, varaqlar:[{nom, olinsin}]}]
 */
function apiT2YuklanganImport(obyektNom, hujjatlar){
  var t0 = Date.now();
  try{
    obyektNom = String(obyektNom || '').trim();
    if(!obyektNom) return {ok:false, xabar:'Obyekt nomi kerak'};
    if(!hujjatlar || !hujjatlar.length)
      return {ok:false, xabar:'Hech bo\'lmasa bitta hujjat yuklang'};

    /* Faqat roli belgilangan hujjatlar olinadi */
    var faol = [];
    for(var h=0; h<hujjatlar.length; h++){
      var d = hujjatlar[h];
      if(!d || !d.fayl_id) continue;
      if(d.rol !== 'lokalka' && d.rol !== 'svodka') continue;
      faol.push(d);
    }
    if(!faol.length)
      return {ok:false, xabar:'Hech bo\'lmasa bitta hujjatni LOKALKA yoki SVODKA deb belgilang'};

    var lokalkaBor = faol.some(function(d){ return d.rol === 'lokalka'; });
    if(!lokalkaBor)
      return {ok:false, xabar:'LOKALKA hujjati belgilanmagan — ishlar ro\'yxati bo\'lmasa hisob yo\'q'};

    var natijalar = [], xatolar = [], varaqSoni = 0;

    for(var i=0; i<faol.length; i++){
      var hj = faol[i];
      /* Varaqlar ko'rsatilmagan bo'lsa — faylning HAMMA varag'i olinadi.
         Ko'rsatilgan bo'lsa faqat `olinsin` belgilanganlari. */
      var varaqlar = (hj.varaqlar && hj.varaqlar.length)
        ? hj.varaqlar.filter(function(v){ return v && v.olinsin !== false; })
        : [{nom: ''}];                       // bo'sh nom = birinchi mos varaq

      if(!varaqlar.length){
        xatolar.push('«' + (hj.nom || hj.fayl_id) + '»: bironta varaq belgilanmagan');
        continue;
      }

      for(var v2=0; v2<varaqlar.length; v2++){
        var vnom = varaqlar[v2].nom || '';
        try{
          var r = apiT2FaylImport(obyektNom, hj.fayl_id, vnom, hj.rol);
          r.hujjat = hj.nom || '';
          natijalar.push(r);
          varaqSoni++;
          if(!r.ok){
            xatolar.push('«' + (hj.nom || 'hujjat') + '» / «' + (vnom || '(birinchi)') +
                         '» (' + hj.rol + '): ' + r.xabar);
          }
        }catch(e){
          xatolar.push('«' + (hj.nom || 'hujjat') + '» / «' + vnom + '»: ' +
                       ((e && e.message) || e));
        }
      }
    }

    var hisob = null;
    if(natijalar.some(function(r){ return r.ok; })) hisob = apiT2Ishla(obyektNom);

    /* ⚠️ SABABNI YO'QOTMAYMIZ.
     *
     * Avval bu yer faqat `ok:false` qaytarardi va sabab `hisob.xabar`
     * ichida qolib ketardi — ekranda esa quruq «Tugallanmadi» chiqardi.
     * Foydalanuvchi ikkala varaq ✓ o'qilganini ko'rib turib, nega
     * yiqilganini bilolmasdi. Haqiqiy sabab Postgres xatosi edi:
     *     42P10: no unique constraint matching the ON CONFLICT
     * Uni topish uchun bazani qo'lda kovlashga to'g'ri keldi. */
    var xabar = '';
    if(!hisob)                 xabar = 'Hech bir varaq o\'qilmadi — hisob boshlanmadi';
    else if(!hisob.ok)         xabar = 'Hisob yiqildi: ' + (hisob.xabar || 'sabab noma\'lum');
    if(xabar) xatolar.push(xabar);

    return {ok: !!(hisob && hisob.ok), obyekt: obyektNom, xabar: xabar,
            hujjat_soni: faol.length, varaq_soni: varaqSoni,
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
    var papka = _t2ManbaPapka();

    /* ⚠️ HAR YUKLASH IKKITA FAYL QOLDIRADI:
     *      20260819_160939__RES.xlsx          — asl (o'qib bo'lmaydi)
     *      (GS) 20260819_160939__RES.xlsx     — konvert (o'qiladi)
     *
     * Foydalanuvchiga ikkalasini ko'rsatish — chalkashlik: qaysi birini
     * tanlashini bilmaydi va .xlsx ni tanlasa import yiqiladi. Shuning
     * uchun BITTA HUJJAT = BITTA QATOR, `fayl_id` esa doim o'qiladigan
     * (Sheets) nusxaniki.
     *
     * Kalit: «(GS) » prefiksi va kengaytma olib tashlangan nom. */
    var xarita = {}, it = papka.getFiles();
    while(it.hasNext()){
      var f = it.next();
      var nom = f.getName();
      var sheetsmi = f.getMimeType() === MimeType.GOOGLE_SHEETS;

      var kalit = nom.replace(/^\(GS\)\s*/, '').replace(/\.(xlsx|xlsm|xls)$/i, '');

      /* Ko'rsatiladigan nom — vaqt belgisisiz, chunki u xizmat ma'lumoti */
      var korinish = kalit.replace(/^\d{8}_\d{6}__/, '');
      var vaqtBelgi = (kalit.match(/^(\d{8}_\d{6})__/) || [])[1] || '';

      var bor = xarita[kalit];
      if(!bor){
        bor = xarita[kalit] = {
          nom: korinish, belgi: vaqtBelgi,
          fayl_id: '', asl_id: '', oqiladi: false,
          sana: Utilities.formatDate(f.getLastUpdated(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm'),
          ts: f.getLastUpdated().getTime()
        };
      }
      if(sheetsmi){ bor.fayl_id = f.getId(); bor.oqiladi = true; }
      else        { bor.asl_id  = f.getId(); }
      if(f.getLastUpdated().getTime() > bor.ts) bor.ts = f.getLastUpdated().getTime();
    }

    var out = [];
    for(var k in xarita){
      var h = xarita[k];
      /* Sheets nusxasi yo'q bo'lsa (eski yuklash yoki konvert yiqilgan)
         o'qish uchun aslining id si beriladi va ROSTINI aytamiz —
         import urinsa aniq xato chiqadi, jim yiqilmaydi. */
      if(!h.fayl_id) h.fayl_id = h.asl_id;

      var nomU = String(h.nom).toUpperCase();
      h.rol_taklif = /(^|[^A-Z])RES([^A-Z]|$)|СВОД|РЕСУРС|SVOD|ВЕДОМОСТ/.test(nomU)
        ? 'svodka' : 'lokalka';
      out.push(h);
    }
    out.sort(function(a,b){ return b.ts - a.ts; });

    return {ok:true, papka_url: papka.getUrl(), fayllar: out};
  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * OBYEKT-MARKAZLI ISH TARTIBI
 * ══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «SHU BU OBYEKTNI RES QISMI, BU LRV QISMI DEB HAR BIR
 * OBYEKTNI YARATIB ICHINI TO'LDIRISH IMKONI BERILISHI KERAK».
 *
 * Ya'ni tartib fayldan emas, OBYEKTDAN boshlanadi:
 *      1) obyekt yaratiladi (bo'sh)
 *      2) ichiga LRV qismi solinadi
 *      3) ichiga RES qismi solinadi
 *      4) hisoblanadi
 *
 * Avvalgi tartib teskari edi (fayl → obyekt) va shuning uchun bir
 * obyektga ikkinchi hujjat qo'shish yo'li ko'rinmasdi.
 * ══════════════════════════════════════════════════════════════════ */

/** Bo'sh obyekt yaratadi (yoki bori qaytariladi). */
function apiT2ObyektYarat(nom){
  try{
    var ob = apiT2ObyektTayyorla(nom);
    return {ok:true, id: ob.id, nom: String(nom).trim(), tur: ob.tur};
  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}

/**
 * Obyekt ichidagi HUJJATLAR — `t2_manba` dan fayl bo'yicha guruhlangan.
 *
 * Bitta hujjatning bir necha varag'i alohida qator bo'lib yotadi;
 * foydalanuvchi esa HUJJATNI ko'rishi kerak, varaqlar uning ichida.
 */
function apiT2ObyektHujjatlar(nom){
  try{
    nom = String(nom || '').trim();
    if(!nom) return {ok:false, xabar:'Obyekt nomi kerak'};

    var komp = _t2KompaniyaId();
    var ob = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(nom) +
                    '&kompaniya_id=eq.' + komp + '&select=id');
    if(!ob.length) return {ok:true, obyekt_id:null, hujjatlar:[]};

    var qat = _t2Get('t2_manba?obyekt_id=eq.' + ob[0].id +
                     '&select=id,rol,fayl_id,fayl_nom,varaq,format,qator_soni,' +
                     'holat,xato,import_vaqt&order=import_vaqt.asc');

    var xarita = {}, tartib = [];
    for(var i=0;i<qat.length;i++){
      var q = qat[i];
      if(!xarita[q.fayl_id]){
        xarita[q.fayl_id] = {
          fayl_id: q.fayl_id, fayl_nom: q.fayl_nom, rol: q.rol,
          import_vaqt: q.import_vaqt, varaqlar: [], jami_qator: 0
        };
        tartib.push(q.fayl_id);
      }
      var h = xarita[q.fayl_id];
      h.varaqlar.push({nom: q.varaq, format: q.format,
                       qator: q.qator_soni, holat: q.holat, xato: q.xato});
      h.jami_qator += Number(q.qator_soni) || 0;
      /* Bir hujjat ichida ikki xil rol bo'lsa — bu chalkashlik.
         Belgilab qo'yamiz, jim yutmaymiz. */
      if(h.rol !== q.rol) h.rol_ziddiyat = true;
    }

    var out = [];
    for(var t=0;t<tartib.length;t++) out.push(xarita[tartib[t]]);
    return {ok:true, obyekt_id: ob[0].id, hujjatlar: out};

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}

/**
 * Obyektdan bitta HUJJATNI (barcha varaqlari bilan) olib tashlaydi.
 *
 * ⚠️ Faqat SHU obyektdagi yozuv o'chadi. Drive'dagi fayl JOYIDA QOLADI —
 * asl hujjatni o'chirish import bekor qilish bilan bir narsa emas.
 */
function apiT2HujjatOchir(obyektNom, faylId){
  try{
    obyektNom = String(obyektNom || '').trim();
    if(!obyektNom || !faylId) return {ok:false, xabar:'Obyekt va fayl kerak'};

    var komp = _t2KompaniyaId();
    var ob = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(obyektNom) +
                    '&kompaniya_id=eq.' + komp + '&select=id');
    if(!ob.length) return {ok:false, xabar:'Obyekt topilmadi: ' + obyektNom};

    _t2Ochir('t2_manba', 'obyekt_id=eq.' + ob[0].id +
             '&fayl_id=eq.' + encodeURIComponent(faylId));

    /* Hujjat ketgach hisob eskiradi — qayta hisoblanadi. */
    var hisob = null;
    try{ hisob = apiT2Ishla(obyektNom); }catch(e2){}
    return {ok:true, hisob: hisob};

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}

/**
 * Drive'dagi hujjatning BARCHA varaqlari.
 *
 * NEGA KERAK: `apiT2ObyektHujjatlar` varaqlarni `t2_manba` dan oladi,
 * ya'ni faqat AVVAL IMPORT QILINGANLARINI. Shu sababli obyektga
 * qaytib kelgan foydalanuvchi o'tgan safar belgilamagan varaqni
 * umuman ko'rmasdi — «sahifalarni nazorat qilish» esa faqat olib
 * tashlash emas, QO'SHISH ham demak.
 *
 * Shu funksiya asl fayldan to'liq ro'yxatni beradi; UI ikkalasini
 * birlashtiradi: import qilinganlari belgilangan, qolganlari bo'sh.
 */
function apiT2HujjatVaraqlar(faylId){
  try{
    if(!faylId) return {ok:false, xabar:'Fayl kerak'};

    /* ⚠️ Google Sheets bo'lmagan faylni `openById` ga berish V8 ni
       BUTUNLAY qulatadi — try/catch ham ushlamaydi (00_BOSH_QONUN 6.6).
       Shuning uchun MIME avval tekshiriladi. */
    var fayl = DriveApp.getFileById(faylId);
    if(fayl.getMimeType() !== MimeType.GOOGLE_SHEETS){
      return {ok:false, xabar:'Bu Google Sheets emas — varaqlari o\'qilmaydi'};
    }

    var ss = SpreadsheetApp.openById(faylId);
    var shlar = ss.getSheets(), out = [];
    for(var i=0;i<shlar.length;i++){
      var sh = shlar[i], nomSh = sh.getName();
      if(nomSh.charAt(0) === '_') continue;
      out.push({nom: nomSh, qator: sh.getLastRow(), ustun: sh.getLastColumn()});
    }
    return {ok:true, fayl_nom: fayl.getName(), varaqlar: out};

  }catch(e){
    return {ok:false, xabar: String((e && e.message) || e)};
  }
}
