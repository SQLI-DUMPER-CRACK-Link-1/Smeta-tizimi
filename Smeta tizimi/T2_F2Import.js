/**
 * T2_F2Import.js — TIZIM_02: TASHQI F2/AKT FAYLINI IMPORT QILISH
 * ═══════════════════════════════════════════════════════════════════
 *
 * Tizim_02 da F2/Fakt hujjatini QO'LDA yaratish bor edi (panelda
 * qatorlarni belgilash). Lekin haqiqiy ish oqimida hujjat tashqaridan
 * keladi — pudratchi Excel'da F2 yuboradi. Bu modul o'sha faylni
 * o'qib, smeta qatorlariga bog'laydi va hujjat yasaydi.
 *
 * ── BORINI QAYTA YOZMAYMIZ ──
 *
 * Faylni o'qish Tizim_01 da uzoq sozlangan va u yerda qoladi:
 *   `apiF2FaylOqi`   (30_Panel.js) — MIME xavfsizligi (Sheets bo'lmagan
 *                     faylni `openById` ga berish V8 ni qulatadi),
 *                     `.xlsx` ni FAQAT QIYMAT bilan ochish (#REF! dan
 *                     himoya), 3 xil shablon uchun ustun avtoaniqlash
 *                     (`_f2UstunAniqla`), F-yoki-E hajm qoidasi,
 *                     ИТОГО/ustun-raqamlash qatorlarini tashlash.
 *
 * Bu yerda faqat KO'PRIK: o'sha daraxtni tekis ro'yxatga aylantirib,
 * ota blok belgilari bilan birga bazaga uzatamiz.
 *
 * ── MOSLASHTIRISH BAZADA ──
 *
 * `t2_f2_moslash` / `t2_f2_import` (Postgres) qiladi. Sabab: Fast food
 * obyektida 1 262 resurs qatori bor, lekin unikal (nom, birlik)
 * juftligi atigi 404 ta — ya'ni bir resurs o'rtacha 3 marta uchraydi.
 * Faqat nom bo'yicha moslashtirish F2 hajmini BOSHQA blokka yozib
 * yuborishi mumkin. Shuning uchun moslashtirish IERARXIK: avval ota
 * blok, keyin resurs o'sha blok ichida.
 *
 * ⚠️ NOANIQLIK JIM HAL QILINMAYDI. Bir nechta nomzod chiqsa qator
 * «ikkilamchi» deb qaytariladi va hujjatga KIRMAYDI. Sinovda ota
 * ma'lumotisiz bitta nom 106 ta nomzod bergan — tavakkaliga tanlash
 * pulni boshqa joyga yozish demak.
 *
 * ⚠️ REESTR KAFOLATI: nechta qator kirdi = hujjatga kirdi + ikkilamchi
 * + topilmadi. Bu tenglik javobda tekshiriladi.
 */

/** Daraxtni tekis ro'yxatga — ota blok belgilari bilan. */
function _t2F2Tekisla(daraxt){
  var chiqish = [];

  function yur(tugun, otaKod, otaNom){
    if(!tugun) return;
    var bolalar = tugun.children || [];

    if(tugun.type === 'rs' || tugun.type === 'mat' || tugun.type === 'ob'){
      /* ⚠️ Hajmi bo'lmagan qator yuborilmaydi — u F2 da ish emas.
         Lekin MANFIY hajm yuboriladi: ПЕРЕРАСЧЁТ haqiqiy hujjat. */
      var h = Number(tugun.hajm);
      if(isFinite(h) && h !== 0){
        chiqish.push({
          nom: tugun.nom || '',
          birlik: tugun.bir || '',
          hajm: h,
          /* ⚠️ NARX FAYLDAN OLINADI — hujjat nima desa shu.
             Bo'lmasa qo'shilmaydi va baza smetadagi narxni ishlatadi.
             Hech qayerda bo'lmasa summa BO'SH qoladi, 0 EMAS. */
          narx: (Number(tugun.narx) > 0) ? Number(tugun.narx) : undefined,
          kod: tugun.kod || undefined,
          ota_kod: otaKod || undefined,
          ota_nom: otaNom || undefined
        });
      }
    }

    /* Blok bo'lsa — bolalar uchun ota belgisi shu blok */
    var yangiKod = (tugun.type === 'bl') ? (tugun.kod || otaKod) : otaKod;
    var yangiNom = (tugun.type === 'bl') ? (tugun.nom || otaNom) : otaNom;
    for(var i = 0; i < bolalar.length; i++) yur(bolalar[i], yangiKod, yangiNom);
  }

  for(var r = 0; r < (daraxt || []).length; r++) yur(daraxt[r], null, null);
  return chiqish;
}

/**
 * F2/Fakt faylini o'qib KO'RSATADI — hech nima yozmaydi.
 *
 * Odam import qilishdan OLDIN nima bo'lishini ko'rishi kerak: nechta
 * qator moslandi, nechtasi ikkilamchi, nechtasi topilmadi.
 *
 * @param {string} obyektNom  Tizim_02 obyekti
 * @param {string} faylId     Drive fayl ID
 * @param {string} varaq      varaq nomi (bo'sh — birinchisi)
 * @param {Object} colConfig  ustun xaritasi (bo'sh — avtoaniqlash)
 */
function apiT2F2Korish(obyektNom, faylId, varaq, colConfig){
  var t0 = Date.now();
  try{
    var ob = _t2ObyektOl(obyektNom);
    if(!ob) return {ok:false, xabar:'Obyekt bazada topilmadi: ' + obyektNom};

    /* Tizim_01 ning tasdiqlangan o'qish mantig'i */
    var oqish = apiF2FaylOqi(faylId, varaq, colConfig);
    if(!oqish || !oqish.ok) return oqish || {ok:false, xabar:'Fayl o\'qilmadi'};

    /* Ustun sozlash rejimi — foydalanuvchi tasdiqlashi kerak */
    if(oqish.mode === 'config') return oqish;

    var qatorlar = _t2F2Tekisla(oqish.tree || []);
    if(!qatorlar.length){
      return {ok:false, xabar:'Faylda hajmi bor bironta qator topilmadi. ' +
                              'Ustunlar to\'g\'ri tanlanganmi?'};
    }

    var mos = _t2Rpc('t2_f2_moslash', {
      p_obyekt_id: ob.id, p_qatorlar: qatorlar
    });

    return {ok:true, obyekt: obyektNom, obyekt_id: ob.id,
            fayl_qator: qatorlar.length, moslash: mos,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2F2Korish: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/**
 * F2/Fakt faylini import qiladi — hujjat yaratadi.
 *
 * @param {string} obyektNom
 * @param {string} faylId
 * @param {string} varaq
 * @param {string} oy          'YYYY-MM-DD'
 * @param {string} tur         'f2' | 'fakt'
 * @param {string} raqam       hujjat raqami
 * @param {string} operationId UUID — TAKRORIY so'rovda O'ZGARMASIN
 * @param {Object} colConfig
 */
function apiT2F2Import(obyektNom, faylId, varaq, oy, tur, raqam, operationId, colConfig){
  var t0 = Date.now();
  try{
    var ob = _t2ObyektOl(obyektNom);
    if(!ob) return {ok:false, xabar:'Obyekt bazada topilmadi: ' + obyektNom};

    if(!operationId){
      /* ⚠️ Idempotentliksiz import: tarmoq uzilib qayta yuborilsa
         IKKINCHI hujjat yaraladi va nakopitelniy ikkalasini qo'shadi.
         Chaqiruvchi UUID berishi SHART — bu yerda yasab bersak,
         qayta urinish yangi UUID bilan ketardi va himoya ishlamasdi. */
      return {ok:false, xabar:'operationId majburiy — usiz takroriy so\'rov ' +
                              'ikkinchi hujjat yaratadi'};
    }

    var oqish = apiF2FaylOqi(faylId, varaq, colConfig);
    if(!oqish || !oqish.ok) return oqish || {ok:false, xabar:'Fayl o\'qilmadi'};
    if(oqish.mode === 'config'){
      return {ok:false, xabar:'Ustunlar aniqlanmadi — avval «Ko\'rish» bilan ' +
                              'ustunlarni tasdiqlang', config: oqish};
    }

    var qatorlar = _t2F2Tekisla(oqish.tree || []);
    if(!qatorlar.length){
      return {ok:false, xabar:'Faylda hajmi bor bironta qator topilmadi'};
    }

    var natija = _t2Rpc('t2_f2_import', {
      p_obyekt_id: ob.id,
      p_oy: oy,
      p_qatorlar: qatorlar,
      p_raqam: raqam || null,
      p_operation_id: operationId,
      p_tur: (tur === 'fakt') ? 'fakt' : 'f2',
      p_manba: 'import',
      p_kim: null
    });

    return {ok: !!(natija && natija.ok), obyekt: obyektNom,
            fayl_qator: qatorlar.length, natija: natija,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2F2Import: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/** Fayldagi varaqlar ro'yxati — Tizim_01 dagini qayta ishlatamiz. */
function apiT2F2Varaqlar(faylId){
  return apiF2VaraklarOl(faylId);
}
