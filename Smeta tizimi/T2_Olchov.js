/**
 * T2_Olchov.js — TIZIM_02: «GAS faqat O'QISA qancha vaqt oladi?»
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN BOR. Foydalanuvchi haqli e'tiroz bildirdi:
 * «katta smetalarda gas juda sekin va ko'p time limitiga urar edida —
 * shuning uchun ikkilanib qoldim».
 *
 * To'g'ri e'tiroz. Lekin savol shu: GAS nimaga sekin — FAYLNI O'QIGANIGA
 * yoki NATIJANI SHEETS'GA QURGANIGA?
 *
 * Dvigatel kodini sanadim (10_Engine.js):
 *     getValues (o'qish) ........ 39 ta   — yengil, ommaviy
 *     merge (katak birlashtirish) 21 ta   — JUDA qimmat
 *     formula yozish ............ 51 ta   — qimmat + qayta hisoblash
 *     varaq yaratish/o'chirish .. 11 ta   — qimmat
 *
 * Ya'ni vaqtning katta qismi LRV_PLUS VARAG'INI QURISHGA ketadi.
 * Tizim_02 da esa GAS Sheets qurmaydi — u faqat o'qib, JSON yuboradi.
 * Demak eng og'ir qism butunlay tushib qolishi KERAK.
 *
 * LEKIN BUNI TAXMIN QILMAYMIZ — O'LCHAYMIZ. Shu fayl aynan shuning
 * uchun: haqiqiy obyektni ochadi, qatorlarni o'qiydi va sanaydi,
 * HECH NARSA YOZMAYDI. Natijada aniq raqam chiqadi va qaror shunga
 * qarab qabul qilinadi.
 *
 * ⚠️ BU FAYL HECH NARSANI O'ZGARTIRMAYDI. Na Drive'da, na Sheets'da,
 * na Supabase'da. Faqat o'qiydi va vaqt qaytaradi. Tizim_01 ga mutlaqo
 * xavfsiz.
 */

/**
 * Bitta obyektning manba fayllarini o'qib, vaqtni bosqichlarga bo'ladi.
 *
 * @param {string} obyekt  obyekt nomi (papka nomi)
 * @return {Object} {ok, obyekt, fayllar:[...], jami:{...}}
 */
function apiT2OqishOlchov(obyekt){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Obyekt nomi kerak'};

    /* 1) Papkani topamiz — mavjud skan mantig'idan foydalanamiz */
    var tPapka = Date.now();
    var a = sozAsosiy();
    var root = DriveApp.getFolderById(a.rootId);
    var papka = null;
    var it = root.getFolders();
    while(it.hasNext()){
      var f = it.next();
      if(f.getName().trim() === String(obyekt).trim()){ papka = f; break; }
    }
    if(!papka) return {ok:false, xabar:'Papka topilmadi: '+obyekt};
    var msPapka = Date.now() - tPapka;

    /* 2) Fayllarni ro'yxatlaymiz (LRV_PLUS va xizmat fayllarisiz —
          ular NATIJA, biz esa MANBAni o'qiymiz) */
    var tRoyxat = Date.now();
    var fayllar = [];
    var fit = papka.getFiles();
    while(fit.hasNext()){
      var fi = fit.next(), nom = fi.getName();
      if(nom.toUpperCase().indexOf('_LRV_PLUS') >= 0) continue;
      if(nom.indexOf('_TMP_') === 0 || nom.indexOf('_NAT_') === 0) continue;
      var mt = fi.getMimeType();
      /* Faqat jadval fayllari */
      if(mt !== MimeType.GOOGLE_SHEETS &&
         String(mt).indexOf('spreadsheet') < 0 &&
         String(mt).indexOf('ms-excel') < 0) continue;
      fayllar.push(fi);
    }
    var msRoyxat = Date.now() - tRoyxat;

    if(!fayllar.length){
      return {ok:false, xabar:'Manba fayl topilmadi (papkada faqat LRV_PLUS bormi?)'};
    }

    /* 3) Har faylni OCHIB, qatorlarni O'QIYMIZ — yozish YO'Q */
    var natija = [], jamiQator = 0, jamiKatak = 0;
    var msOchish = 0, msOqish = 0;

    for(var i=0; i<fayllar.length; i++){
      var fayl = fayllar[i];
      var fNom = fayl.getName();
      var fNat = {nom:fNom, varaqlar:0, qatorlar:0, kataklar:0, xato:''};

      try{
        var tOch = Date.now();
        /* Excel bo'lsa ochish uchun konvert kerak — bu ham o'lchansin.
           Google Sheets bo'lsa to'g'ridan-to'g'ri ochiladi. */
        var ss = null;
        if(fayl.getMimeType() === MimeType.GOOGLE_SHEETS){
          ss = SpreadsheetApp.openById(fayl.getId());
        } else {
          /* Excel: konvertsiz o'qib bo'lmaydi. Bu Tizim_02 da ham
             kerak bo'ladi, shuning uchun vaqtga KIRADI — yashirmaymiz. */
          fNat.xato = 'Excel — konvert kerak (bu o\'lchovda o\'tkazib yuborildi)';
          natija.push(fNat);
          continue;
        }
        msOchish += Date.now() - tOch;

        var tOq = Date.now();
        var shlar = ss.getSheets();
        for(var s=0; s<shlar.length; s++){
          var sh = shlar[s];
          var nomSh = sh.getName();
          if(nomSh.charAt(0) === '_') continue;          // xizmat varag'i
          var lastR = sh.getLastRow(), lastC = sh.getLastColumn();
          if(lastR < 2 || lastC < 1) continue;
          /* BITTA ommaviy o'qish — aynan Tizim_02 da qilinadigan amal */
          var v = sh.getRange(1, 1, lastR, lastC).getValues();
          fNat.varaqlar++;
          fNat.qatorlar += v.length;
          fNat.kataklar += v.length * lastC;
        }
        msOqish += Date.now() - tOq;

      }catch(e){
        fNat.xato = String((e && e.message) || e);
      }

      jamiQator += fNat.qatorlar;
      jamiKatak += fNat.kataklar;
      natija.push(fNat);
    }

    return {
      ok: true,
      obyekt: obyekt,
      fayllar: natija,
      jami: {
        fayl: fayllar.length,
        qator: jamiQator,
        katak: jamiKatak,
        msPapkaTopish: msPapka,
        msRoyxat: msRoyxat,
        msFaylOchish: msOchish,
        msQatorOqish: msOqish,
        msJami: Date.now() - t0
      },
      izoh: 'Bu o\'lchovda HECH NARSA YOZILMADI — faqat o\'qildi. '
          + 'Tizim_01 dagi to\'liq ishlash bunga qo\'shimcha ravishda '
          + 'LRV_PLUS varag\'ini quradi (merge, formula, varaq yaratish) — '
          + 'vaqtning katta qismi o\'shanga ketadi.'
    };

  }catch(e){
    return {ok:false, xabar:'apiT2OqishOlchov: '+((e && e.message) || e),
            msJami: Date.now() - t0};
  }
}
