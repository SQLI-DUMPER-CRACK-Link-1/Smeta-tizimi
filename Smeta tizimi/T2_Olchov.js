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

    /* 1) Obyektni topamiz.
     *
     * ⚠️ 2026-08-17 TUZATISH: avval papka nomini obyekt nomiga TENGLASHTIRIB
     * qidirgandim va «Papka topilmadi» xatosi chiqdi. Sabab — ko'p smetali
     * obyektlar: «Amfiteatr - 109983_ALL_01-02_АРХИТЕКТУРНАЯ ЧАСТЬ» bu
     * PAPKA EMAS, u «Amfiteatr» papkasi ichidagi bitta smeta fayli.
     * Papka nomi — faqat « - » gacha bo'lgan qism (`_cfgKalit`).
     *
     * Buni o'zim qayta yozish xato bo'lardi: tizimda buning uchun
     * `skanBitta()` bor va u kesh, zaxira to'liq skan, bog'lash
     * sozlamalarini ham hisobga oladi. O'shani ishlatamiz. */
    var tPapka = Date.now();
    var ob = skanBitta(obyekt);
    if(!ob) return {ok:false, xabar:'Obyekt topilmadi: '+obyekt+
                    '  (papka nomi «'+_cfgKalit(obyekt)+'» bo\'lishi kerak edi)'};
    var msPapka = Date.now() - tPapka;

    /* 2) Manba fayllar ro'yxati.
     *    `skanBitta` allaqachon LOKALKA/СВОДКА ni ajratib bergan —
     *    biz NATIJANI (LRV_PLUS) emas, MANBAni o'qiymiz. */
    var tRoyxat = Date.now();
    /* `skanBitta` FAYL OBYEKTLARINI qaytaradi (`lokFile`, `svodFile`),
       ID emas — shuning uchun ularni to'g'ridan-to'g'ri olamiz.
       `lokFiles` — ko'p lokalkali obyektda hammasi. */
    var fayllar = [], korilgan = {};
    function faylQosh(f){
      if(!f) return;
      try{
        var id = f.getId();
        if(korilgan[id]) return;
        korilgan[id] = 1;
        fayllar.push(f);
      }catch(e){}
    }
    if(ob.lokFiles && ob.lokFiles.length){
      for(var li=0; li<ob.lokFiles.length; li++) faylQosh(ob.lokFiles[li]);
    }
    faylQosh(ob.lokFile);
    faylQosh(ob.svodFile);          // svodka — narxlash uchun manba
    var msRoyxat = Date.now() - tRoyxat;

    if(!fayllar.length){
      return {ok:false,
        xabar:'Manba fayl topilmadi. Skan yozuvidagi kalitlar: '
            + Object.keys(ob).join(', ')};
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
