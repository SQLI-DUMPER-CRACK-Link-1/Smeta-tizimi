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
 * ── MOSLASHTIRISH HAM TIZIM_01 NIKI ──
 *
 *   `f2MoslashEngine` (35_F2Moslash.js) — 41 KB, har qoidasi HAQIQIY
 *   moliyaviy xatodan keyin qo'shilgan:
 *      • birlik qalqoni  → Т↔КГ = 1000 baravar xato
 *      • grade-farq      → ПК↔ПБ boshqa mahsulot
 *      • kod-kanon       → 105 ta ish topilmagan = 2.57 mlrd ko'rilmagan
 *      • qat'iy rejim    → generic resurs (000001) 153 joyda aralashardi
 *      • yetim qutqarish → ish topilmasa bolalari ham yo'qolardi
 *      • razdel doirasi  → BL kod global 11/54 unikal, razdel ichida
 *                          132/186 (71%)
 *
 * ⚠️ AVVAL BU YERDA MENING SODDA SQL MOSLASHTIRISHIM BOR EDI (nom +
 * birlik + ota blok). U yuqoridagi HAMMA qoidani tashlab yuborardi va
 * o'sha xatolarni qaytarardi. Olib tashlandi.
 *
 * Dvigatel SOF funksiya va `opts.lrvTree` orqali istalgan daraxtni
 * oladi — shuning uchun unga TEGMASDAN ishlatiladi. Tizim_02
 * qatorlari `_t2F2LrvDaraxt` bilan o'sha shaklga keltiriladi va
 * `row` maydoniga `t2_qator.id` beriladi.
 *
 * ⚠️ REESTR KAFOLATI: kirgan = hujjatga kirdi + topilmadi.
 * Topilmagan qator TASHLANMAYDI — dvigatel bergan SABABI bilan
 * qaytariladi.
 */

/**
 * Tizim_02 ma'lumotidan MOSLASHTIRISH DARAXTI quradi.
 *
 * ⚠️ NEGA AYNAN SHU SHAKL:
 * `f2MoslashEngine` (35_F2Moslash.js) LRV daraxtini kutadi:
 *     rz  → {type:'rz', nom, lokalka, children}
 *     ish → {type, nom, kod, birlik, narx, varaq, row, children}
 *
 * `row` dvigatel uchun shunchaki IDENTIFIKATOR — Tizim_01 da u
 * jadval qatori raqami. Bu yerda unga `t2_qator.id` beramiz, shunda
 * moslik natijasi to'g'ridan-to'g'ri smeta qatorining id sini
 * qaytaradi va dvigatelga TEGISH SHART EMAS.
 *
 * ⚠️ ASIMMETRIYA ATAYLAB: LRV tugunida `birlik`, akt tugunida `bir`
 * (35_F2Moslash.js:127). Buni "tuzatish" moslashtirishni buzadi.
 *
 * ⚠️ ENG YUQORI DARAJA 'rz' BO'LISHI SHART. Dvigatel indekslarni
 * `lrvTree.forEach(rz => { if(rz.type!=='rz') return; ...})` bilan
 * quradi (35_F2Moslash.js:163 va :194) — ya'ni razdel ILDIZDA
 * bo'lmasa ikkala indeks ham BO'SH qoladi va hech nima moslashmaydi.
 * Xato chiqmaydi, shunchaki 0 ta moslik — eng xavfli xato turi.
 * Shuning uchun razdellar QAYSI CHUQURLIKDA bo'lsa ham ildizga
 * ko'tariladi, umuman bo'lmasa esa sun'iy razdel yasaladi.
 *
 * `lokalka` — Tizim_02 da obyekt bo'yicha YAGONA daraxt bor (ko'p
 * fayl import paytida birlashtirilgan), shuning uchun bo'sh. Dvigatel
 * uni faqat `opts.lokalka` berilganda ishlatadi, biz bermaymiz.
 */
function _t2F2LrvDaraxt(obyektId){
  var qatorlar = _t2QatorlarOl(obyektId);
  var tugun = {}, ildiz = [];

  for(var i = 0; i < qatorlar.length; i++){
    var q = qatorlar[i];
    tugun[q.id] = {
      type: q.tur,
      nom: q.nom || '',
      kod: q.kod || '',
      birlik: q.birlik || '',          // ⚠️ LRV tomonda 'birlik'
      narx: Number(q.narx) || 0,
      varaq: 'T2',
      row: q.id,                        // ⚠️ dvigatel shuni qaytaradi
      lokalka: '',
      children: []
    };
  }
  for(var j = 0; j < qatorlar.length; j++){
    var q2 = qatorlar[j], n2 = tugun[q2.id];
    var ota = (q2.ota_id != null) ? tugun[q2.ota_id] : null;
    if(ota) ota.children.push(n2); else ildiz.push(n2);
  }

  /* Razdellarni istalgan chuqurlikdan ildizga ko'taramiz */
  var rzlar = [];
  (function yig(nodes){
    for(var k = 0; k < nodes.length; k++){
      var n = nodes[k];
      if(n.type === 'rz') rzlar.push(n);
      if(n.children.length) yig(n.children);
    }
  })(ildiz);
  if(rzlar.length) return rzlar;

  /* Razdelsiz smeta — dvigatel baribir ishlashi kerak.
     Sun'iy razdel = global doira (dvigatelning o'z zaxira yo'li). */
  if(!ildiz.length) return [];
  return [{type:'rz', nom:'', lokalka:'', children: ildiz}];
}

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

/**
 * MOSLASHTIRISH — Tizim_01 ning dvigateli bilan.
 *
 * ⚠️ AVVAL BU YERDA O'ZIMNING SODDA SQL MOSLASHTIRISHIM BOR EDI.
 * U nom+birlik bo'yicha ishlardi va `35_F2Moslash.js` dagi HAMMA
 * qoidani tashlab yuborardi. Har qoida haqiqiy moliyaviy xatodan
 * keyin qo'shilgan (o'sha fayl sarlavhasidan):
 *
 *   • birlik qalqoni  → Т↔КГ = 1000 baravar xato
 *   • grade-farq      → ПК↔ПБ boshqa mahsulot
 *   • kod-kanon       → 105 ta ish topilmagan = 2.57 mlrd ko'rilmagan
 *   • qat'iy rejim    → generic resurs (000001) 153 joyda aralashardi
 *   • yetim qutqarish → ish topilmasa bolalari ham yo'qolardi
 *   • qoldiq-evristika→ 2.2 mlrd → 3.3 mlrd xato (shu sabab OLIB
 *                       TASHLANGAN — qayta qo'shmang)
 *
 * Dvigatel SOF funksiya va `opts.lrvTree` orqali istalgan daraxtni
 * qabul qiladi — shuning uchun unga TEGMASDAN ishlatamiz.
 *
 * Natijadagi `row` — biz bergan `t2_qator.id`.
 */
function _t2F2Moslashtir(obyektId, aktTree){
  var lrvTree = _t2F2LrvDaraxt(obyektId);
  if(!lrvTree.length){
    return {ok:false, xabar:'Bu obyektda smeta qatorlari yo\'q — avval import qiling'};
  }

  /* Dvigatel nechta smeta tugunini KO'RGANINI sanaymiz.
     0 ta moslik chiqsa, sabab shu raqamdan darrov ko'rinadi:
     indeks bo'sh (daraxt shakli xato) mi yoki nomlar mos kelmadimi. */
  var lrvTugun = 0;
  (function sana(nodes){
    for(var k = 0; k < nodes.length; k++){
      if(nodes[k].type !== 'rz') lrvTugun++;
      if(nodes[k].children && nodes[k].children.length) sana(nodes[k].children);
    }
  })(lrvTree);

  var r = apiF2AvtoMoslash(aktTree, null, {lrvTree: lrvTree});
  var st = (r && r.stat) || {};
  var mosliklar = (r && r.mosliklar) || [];

  /* Akt daraxtidagi HAMMA hajmli tugun — reestr kafolati uchun */
  var hammasi = _t2F2Tekisla(aktTree);
  var mosXarita = {};
  for(var i = 0; i < mosliklar.length; i++) mosXarita[mosliklar[i].uid] = mosliklar[i];

  var qatorlar = [], moslandi = 0, topilmadi = 0;
  for(var j = 0; j < hammasi.length; j++){
    var h = hammasi[j];
    var m = mosXarita[h.uid];
    if(m){
      moslandi++;
      qatorlar.push({holat:'moslandi', uid: h.uid, nom: h.nom, birlik: h.birlik,
                     hajm: h.hajm, narx: h.narx, summa: h.summa, qator_id: m.row});
    }else{
      topilmadi++;
      qatorlar.push({holat:'topilmadi', uid: h.uid, nom: h.nom, birlik: h.birlik,
                     hajm: h.hajm, narx: h.narx, summa: h.summa, qator_id: null,
                     /* Dvigatel NEGA topmaganini aytadi — jim qoldirmaymiz */
                     sabab: (r.sabablar && r.sabablar[h.uid]) || ''});
    }
  }

  return {ok:true, kirgan: hammasi.length, moslandi: moslandi,
          topilmadi: topilmadi,
          /* ⚠️ REESTR KAFOLATI: kirgan = moslandi + topilmadi */
          kafolat: hammasi.length === moslandi + topilmadi,
          qatorlar: qatorlar,
          /* Dvigatel diagnostikasi — qaysi qoida ishlagani ko'rinsin */
          stat: st, rzDiag: (r && r.rzDiag) || [],
          lrv: {razdel: lrvTree.length, tugun: lrvTugun}};
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
          uid: tugun.uid || undefined,
          nom: tugun.nom || '',
          birlik: tugun.bir || '',
          hajm: h,
          /* ⚠️ NARX FAYLDAN OLINADI — hujjat nima desa shu.
             Faylda bo'lmasa BO'SH qoladi va shu holicha hujjatga
             tushadi (`narx_yoq`) — smetadan TO'LDIRILMAYDI.
             0 ham yozilmaydi: 0 «bepul» degani, bo'sh esa «noma'lum». */
          narx: (Number(tugun.narx) > 0) ? Number(tugun.narx) : undefined,
          /* ⚡ T2-REAL-PARK-LRV-CLOSURE-005: SUMMA HAM faylning o'zidan —
             `apiF2FaylOqi` (30_Panel.js) H/СУММА ustunini alohida o'qiydi
             ("TAYYOR summa, statik ko'chiriladi"), lekin bu funksiya avval
             uni TASHLAB YUBORARDI, faqat hajm+narx forward qilardi — ya'ni
             `t2_akt_yarat`ning GENERATED summa (hajm*narx) ustuniga
             tayanardi, hujjatning HAQIQIY summasiga emas. Endi
             saqlanadi va apiT2F2Import orqali t2_akt_yarat_v2ga boradi. */
          summa: (Number(tugun.summa) > 0) ? Number(tugun.summa) : undefined,
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
 * T2-REAL-PARK-LRV-CLOSURE-005: `t2_akt_yarat_v2` uchun actor_id
 * (bigint) kerak — `t2_akt_yarat` (legacy)ga farqli o'laroq, u
 * `t2_actor_kompaniya_azo_tekshir` bilan HAQIQIY vakolatni tekshiradi.
 * GAS session Google email beradi — shuni `t2_foydalanuvchi.email`
 * bilan moslaymiz. Topilmasa YOZILMAYDI (fail-closed), sinab ko'rilgan
 * `Session.getActiveUser()` naqshi (30_Panel.js) bilan bir xil.
 */
function _t2ActorIdOl(){
  var email = '';
  try{ email = Session.getActiveUser().getEmail(); }catch(e){}
  if(!email){
    return {ok:false, xabar:'GAS session email aniqlanmadi -- actor_id kerak (t2_akt_yarat_v2 authorization uchun)'};
  }
  var qatorlar;
  try{
    qatorlar = _t2Get('t2_foydalanuvchi?email=eq.' + encodeURIComponent(email) + '&holat=eq.faol&select=id&limit=1');
  }catch(e){
    return {ok:false, xabar:'Foydalanuvchi qidirishda xato: ' + String((e && e.message) || e)};
  }
  if(!qatorlar || !qatorlar.length){
    return {ok:false, xabar:'«' + email + '» uchun faol t2_foydalanuvchi topilmadi -- avval tizimga to\'g\'ri kirganingizni tekshiring'};
  }
  return {ok:true, actorId: qatorlar[0].id};
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

    var mos = _t2F2Moslashtir(ob.id, oq.tree || []);
    if(!mos.ok) return mos;

    return {ok:true, obyekt: obyektNom, obyekt_id: ob.id,
            fayl_qator: mos.kirgan, moslash: mos,
            /* ⚠️ DARAXT SHART: chap panel shu daraxtdan chiziladi.
               Buni tushirib qoldirsa ekran bo'm-bo'sh chiqadi. */
            tree: oq.tree,
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

    /* ⚠️ AYNAN «Ko'rish» dagi moslashtirish — Tizim_01 dvigateli.
       Ikki xil yo'l bo'lsa ekranda bir narsa ko'rinib, hujjatga
       boshqasi tushardi. */
    var mos = _t2F2Moslashtir(ob.id, oq.tree || []);
    if(!mos.ok) return mos;
    if(!mos.moslandi){
      return {ok:false, xabar:'Bironta qator smetaga bog\'lanmadi — hujjat yaratilmadi',
              moslash: mos};
    }

    /* ⚡ T2-REAL-PARK-LRV-CLOSURE-005: F2 (tur='f2') endi EXACT-SOURCE
       t2_akt_yarat_v2 orqali yoziladi — hujjatning o'z SUMMASI (endi
       _t2F2Tekisla/_t2F2Moslashtir orqali saqlanadi, yuqoriga qarang)
       certified_amount sifatida boradi, hajm*narxdan HECH QACHON
       hisoblanmaydi. FAKT (tur='fakt') — o'zgarishsiz, legacy
       t2_akt_yarat (fakt "certified" tushunchasiga kirmaydi — draft). */
    if(tur === 'fakt'){
      var yukFakt = [], narxsizFakt = 0;
      for(var fi = 0; fi < mos.qatorlar.length; fi++){
        var qf = mos.qatorlar[fi];
        if(qf.holat !== 'moslandi') continue;
        var qatorF = {qator_id: qf.qator_id, hajm: qf.hajm};
        if(qf.narx != null){ qatorF.narx = qf.narx; }
        else { qatorF.narx_yoq = true; narxsizFakt++; }
        yukFakt.push(qatorF);
      }
      var aktFakt = _t2Rpc('t2_akt_yarat', {
        p_obyekt_id: ob.id, p_tur: 'fakt', p_oy: oy, p_qatorlar: yukFakt,
        p_raqam: raqam || null, p_operation_id: operationId,
        p_manba: 'import', p_kim: null
      });
      var hujjatgaFakt = (aktFakt && aktFakt.ok) ? (Number(aktFakt.qator_soni) || 0) : 0;
      return {ok: !!(aktFakt && aktFakt.ok), obyekt: obyektNom,
              fayl_qator: mos.kirgan, akt: aktFakt, moslash: mos,
              kafolat: {kirgan: mos.kirgan, hujjatga_kirdi: hujjatgaFakt,
                        topilmadi: mos.topilmadi,
                        togri: mos.kirgan === hujjatgaFakt + mos.topilmadi},
              narxsiz: narxsizFakt, ms: Date.now() - t0};
    }

    /* Aggregatsiya qator_id bo'yicha — t2_akt_yarat_v2 bitta partiyada
       BIR XIL qator_id ni ikki marta ko'rsa DUPLICATE_F2_SOURCE_LINE
       bilan rad etadi (legacy yo'l esa buni jim qabul qilardi). Bir
       nechta F2 manba qatori bitta smeta qatoriga bog'langan bo'lsa,
       hajm VA summa QO'SHILADI (F2 faylning o'zidan), narx birinchi
       topilgan qiymatdan olinadi. */
    var guruh = {}, tartib = [], narxsiz = 0;
    for(var i = 0; i < mos.qatorlar.length; i++){
      var q = mos.qatorlar[i];
      if(q.holat !== 'moslandi') continue;
      var kalit = String(q.qator_id);
      if(!guruh[kalit]){
        guruh[kalit] = {qator_id: q.qator_id, hajm: 0, narx: undefined, summa: 0, summaBor: false};
        tartib.push(kalit);
      }
      var g = guruh[kalit];
      g.hajm += Number(q.hajm) || 0;
      if(g.narx == null && q.narx != null) g.narx = q.narx;
      if(q.summa != null){ g.summa += Number(q.summa) || 0; g.summaBor = true; }
    }

    /* Narxi bor-yu summasi yo'q qator — AMBIGUOUS (Section 3,
       NEEDS_REVIEW). qty*narx bilan TO'QILMAYDI — hujjat rad etiladi,
       odam faylni tekshirsin. */
    var noaniq = [];
    for(var ti = 0; ti < tartib.length; ti++){
      var gg = guruh[tartib[ti]];
      if(gg.narx != null && !gg.summaBor) noaniq.push(gg.qator_id);
    }
    if(noaniq.length){
      return {ok:false, xabar:'NEEDS_REVIEW: ' + noaniq.length + ' ta qatorda narx bor, ' +
                              'lekin faylning o\'z summasi (SUMMA ustuni) yo\'q -- qty*narx ' +
                              'bilan summa to\'qilmaydi. Faylni tekshiring.',
              qatorlar: noaniq, moslash: mos, ms: Date.now() - t0};
    }

    var actorRes = _t2ActorIdOl();
    if(!actorRes.ok){
      return {ok:false, xabar: actorRes.xabar, moslash: mos, ms: Date.now() - t0};
    }

    var yukV2 = [];
    for(var ti2 = 0; ti2 < tartib.length; ti2++){
      var g2 = guruh[tartib[ti2]];
      if(g2.narx == null){ narxsiz++; }
      yukV2.push({
        qator_id: g2.qator_id,
        certified_quantity: g2.hajm,
        certified_unit_price: g2.narx,
        certified_amount: g2.summaBor ? g2.summa : null,
        price_intentionally_absent: g2.narx == null
      });
    }

    var akt = _t2Rpc('t2_akt_yarat_v2', {
      p_obyekt_id: ob.id,
      p_oy: oy,
      p_qatorlar: yukV2,
      p_actor_id: actorRes.actorId,
      p_raqam: raqam || null,
      p_operation_id: operationId,
      p_manba: 'import_v2'
    });

    var hujjatga = (akt && akt.ok) ? (Number(akt.qator_soni) || 0) : 0;
    return {ok: !!(akt && akt.ok), obyekt: obyektNom,
            fayl_qator: mos.kirgan, akt: akt, moslash: mos,
            /* ⚠️ REESTR: kirgan = hujjatga kirdi + topilmadi */
            kafolat: {kirgan: mos.kirgan, hujjatga_kirdi: hujjatga,
                      topilmadi: mos.topilmadi,
                      togri: mos.kirgan === hujjatga + mos.topilmadi},
            /* Faylda narxi bo'lmagan qatorlar — hujjat jami TO'LIQ EMAS */
            narxsiz: narxsiz,
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
