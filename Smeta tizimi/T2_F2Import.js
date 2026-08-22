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

/**
 * Faylni o'qiydi va DARAXT qaytaradi.
 *
 * ⚠️ NEGA BU O'RAM KERAK:
 *
 * `apiF2FaylOqi` `colConfig` berilmasa DOIM `mode:'config'` qaytaradi —
 * u ustunlarni topgan bo'lsa ham. Bu Tizim_01 uchun to'g'ri: u yerda
 * odam oynada ustunlarni ko'rib tasdiqlaydi.
 *
 * Lekin bu «ustunlar aniqlanmadi» degani EMAS. Aniqlangan ustunlar
 * `cols` da qaytadi. Men avval buni xato deb o'qib, foydalanuvchiga
 * «ustunlar sarlavhadan aniqlanmadi» degan noto'g'ri xabar
 * ko'rsatgandim — LRV_PLUS faylida ustunlar aslida TOPILGAN edi.
 *
 * Endi: aniqlangani AVTOMATIK qabul qilinadi va ikkinchi chaqiruvda
 * daraxt olinadi. Ustunlar javobda qaytadi — noto'g'ri bo'lsa odam
 * tuzatib qayta yuboradi.
 */
/**
 * KUCHLI ustun aniqlagich — `_f2UstunAniqla` topa olmagan holatlar uchun.
 *
 * ⚠️ NEGA ALOHIDA, TIZIM_01 NIKINI TUZATMASDAN:
 * `_f2UstunAniqla` 30_Panel.js da, ya'ni ISHLAB TURGAN produksiyada.
 * Uni o'zgartirish Tizim_01 ning F2 importiga ta'sir qiladi. Shuning
 * uchun bu yerda ZAXIRA sifatida turadi: asosiysi topsa — o'shaniki,
 * topmasa — bu ishlaydi.
 *
 * NIMANI QO'SHIMCHA HAL QILADI:
 *
 *  1. Sarlavhada QATOR UZILISHI: «ЕД.\nИЗМ.» — asosiy aniqlagich
 *     `ЕД.ИЗМ` ni qidiradi va `\n` uni buzadi. Bu yerda barcha
 *     bo'shliq va tinish belgilari olib tashlanadi.
 *  2. «КОЛ-ВО» qisqartmasi (faqat «КОЛИЧЕСТВО» emas).
 *  3. Ustun GURUHLARI: «на ед.» pastki sarlavhasi ham МИҚДОР, ham
 *     НАРХ guruhida uchraydi. Qaysi guruhga tegishli ekani asosiy
 *     sarlavhadagi ustun o'rniga qarab hal qilinadi — aks holda
 *     norma va narx chalkashadi.
 *
 * @param {Array} preview  `apiF2FaylOqi` qaytargan {r, cells[]} ro'yxati
 */
function _t2F2UstunKuchli(preview){
  if(!preview || !preview.length) return null;

  function toza(s){
    return String(s == null ? '' : s).toUpperCase()
      .replace(/[\s.,\-_()№]/g, '');       // bo'shliq, nuqta, tire, qavs
  }

  var hdr = -1, nom = -1, bir = -1, kod = -1, miqGuruh = -1, narxGuruh = -1;

  for(var i = 0; i < preview.length && hdr < 0; i++){
    var c = preview[i].cells || [];
    var n2 = -1, b2 = -1;
    for(var j = 0; j < c.length; j++){
      var t = toza(c[j]);
      if(!t) continue;
      if(n2 < 0 && t.indexOf('НАИМЕНОВАН') >= 0) n2 = j;
      if(b2 < 0 && (t.indexOf('ЕДИЗМ') >= 0 || t.indexOf('ЕДИНИЦ') >= 0 ||
                    t.indexOf('БИРЛИК') >= 0 || t.indexOf('ЎЛЧОВ') >= 0 ||
                    t.indexOf('УЛЧОВ') >= 0)) b2 = j;
    }
    if(n2 < 0 || b2 < 0) continue;

    hdr = i; nom = n2; bir = b2;
    for(var k = 0; k < c.length; k++){
      var t2 = toza(c[k]);
      if(!t2) continue;
      if(kod < 0 && k !== nom && (t2.indexOf('ШИФР') >= 0 ||
          t2.indexOf('ОБОСНОВ') >= 0 || t2 === 'КОД')) kod = k;
      if(miqGuruh < 0 && (t2.indexOf('КОЛИЧЕСТВ') >= 0 || t2.indexOf('КОЛВО') >= 0 ||
          t2.indexOf('ҲАЖМ') >= 0 || t2.indexOf('ХАЖМ') >= 0)) miqGuruh = k;
      if(narxGuruh < 0 && (t2.indexOf('ЦЕНА') >= 0 || t2.indexOf('СТОИМОСТ') >= 0 ||
          t2.indexOf('СУММА') >= 0 || t2.indexOf('НАРХ') >= 0)) narxGuruh = k;
    }
    if(kod < 0 && nom >= 1) kod = nom - 1;
  }
  if(hdr < 0) return null;

  /* ── Pastki sarlavhalar: qaysi GURUHGA tushgani ustun o'rni bilan
     hal qilinadi. «на ед.» ikkala guruhda ham bo'lishi mumkin. ── */
  var norma = -1, obyom = -1, narx = -1, sum = -1;
  for(var r2 = hdr; r2 < Math.min(hdr + 3, preview.length); r2++){
    var rc = preview[r2].cells || [];
    for(var m = 0; m < rc.length; m++){
      var t3 = toza(rc[m]);
      if(!t3) continue;
      var miqda  = (miqGuruh  >= 0 && m >= miqGuruh  && (narxGuruh < 0 || m < narxGuruh));
      var narxda = (narxGuruh >= 0 && m >= narxGuruh);

      if(miqda){
        if(norma < 0 && (t3.indexOf('НАЕД') >= 0 || t3.indexOf('НАЕДИНИЦУ') >= 0)) norma = m;
        if(obyom < 0 && (t3.indexOf('ПОПРОЕКТ') >= 0 || t3.indexOf('ЖАМИ') >= 0 ||
                         t3.indexOf('ОБЩ') >= 0)) obyom = m;
      }else if(narxda){
        if(narx < 0 && (t3.indexOf('НАЕД') >= 0 || t3.indexOf('ЗАЕД') >= 0)) narx = m;
        if(sum  < 0 && (t3.indexOf('ОБЩ') >= 0 || t3.indexOf('СУММА') >= 0)) sum = m;
      }
    }
  }

  /* Pastki sarlavha bo'lmasa — guruh ustunining o'zi */
  if(obyom < 0 && miqGuruh  >= 0) obyom = (norma >= 0 ? norma + 1 : miqGuruh);
  if(narx  < 0 && narxGuruh >= 0) narx  = narxGuruh;
  if(sum   < 0 && narx      >= 0) sum   = narx + 1;
  if(obyom < 0) obyom = bir + 1;
  if(norma < 0) norma = -1;              // yagona miqdor ustuni — norma yo'q

  return {kod: kod, nom: nom, bir: bir, norma: norma,
          obyom: obyom, narx: narx, sum: sum, hdrRow: preview[hdr].r - 1};
}

function _t2F2Oqi(faylId, varaq, colConfig){
  var birinchi = apiF2FaylOqi(faylId, varaq, colConfig || null);
  if(!birinchi || !birinchi.ok){
    return birinchi || {ok:false, xabar:'Fayl o\'qilmadi'};
  }

  /* Daraxt darhol kelgan bo'lsa (colConfig berilgan edi) */
  if(birinchi.mode !== 'config'){
    return {ok:true, tree: birinchi.tree || [], cols: colConfig || null,
            avto: false};
  }

  var c = birinchi.cols || {};
  var usul = 'tizim_01';

  /* Asosiy aniqlagich sarlavhani TOPMAGAN bo'lsa (hdrQator=0) —
     kuchli zaxira aniqlagich sinaladi. */
  if(!birinchi.hdrQator){
    var kuchli = _t2F2UstunKuchli(birinchi.preview);
    if(kuchli){ c = kuchli; usul = 'kuchli'; }
  }

  /* Nom va birlik topilmasa — haqiqatan aniqlab bo'lmadi */
  if(!(Number(c.nom) >= 0) || !(Number(c.bir) >= 0)){
    return {ok:false, sozlash:true, cols:c, preview: birinchi.preview,
            hdrQator: birinchi.hdrQator,
            xabar:'Faylda «НАИМЕНОВАНИЕ» va «ЕД.ИЗМ» sarlavhalari topilmadi. ' +
                  'Ustunlarni qo\'lda ko\'rsating.'};
  }

  var ikkinchi = apiF2FaylOqi(faylId, varaq, c);
  if(!ikkinchi || !ikkinchi.ok){
    return ikkinchi || {ok:false, xabar:'Fayl ikkinchi o\'qishda yiqildi'};
  }
  return {ok:true, tree: ikkinchi.tree || [], cols: c, avto: true, usul: usul,
          hdrQator: birinchi.hdrQator, preview: birinchi.preview};
}

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

    var oq = _t2F2Oqi(faylId, varaq, colConfig);
    if(!oq.ok) return oq;

    var qatorlar = _t2F2Tekisla(oq.tree || []);
    if(!qatorlar.length){
      return {ok:false, xabar:'Faylda hajmi bor bironta qator topilmadi. ' +
                              'Ustunlar to\'g\'ri tanlanganmi?'};
    }

    var mos = _t2Rpc('t2_f2_moslash', {
      p_obyekt_id: ob.id, p_qatorlar: qatorlar
    });

    return {ok:true, obyekt: obyektNom, obyekt_id: ob.id,
            fayl_qator: qatorlar.length, moslash: mos,
            /* Ustunlar KO'RINIB tursin — noto'g'ri aniqlangan bo'lsa
               odam tuzatib qayta yuborishi mumkin */
            cols: oq.cols, avto: oq.avto, hdrQator: oq.hdrQator,
            preview: oq.preview,
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

    var oq = _t2F2Oqi(faylId, varaq, colConfig);
    if(!oq.ok) return oq;

    var qatorlar = _t2F2Tekisla(oq.tree || []);
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
