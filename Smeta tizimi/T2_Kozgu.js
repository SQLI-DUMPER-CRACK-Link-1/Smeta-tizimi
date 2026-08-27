/**
 * T2_Kozgu.js — TIZIM_02: «ИШЧИ СМЕТА» VARAG'I
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ATAMA: bu hujjat avval «ko'zgu» deb atalgan. Endi ATALMAYDI —
 * foydalanuvchi: «tayyor mahsulot nomi ustida nima uchun ko'zgu deysan,
 * bir ilmiyroq nom topsangchi». Nom ham noto'g'ri edi: hujjat bir
 * tomonlama aks emas, u TAHRIRLANADI va o'zgarishlar bazaga qaytadi.
 * Foydalanuvchi ko'radigan nom — «ИШЧИ СМЕТА» (Tizim_01 dagi LRV_PLUS
 * ning o'rnini bosadi). Fayl nomi va `t2_kozgu` jadval nomi ichki
 * atamalar bo'lib qoldi — ularni o'zgartirish faqat churn beradi.
 *
 * YO'NALISH — IKKI TOMONLAMA VA AVTOMATIK:
 *
 *   apiT2VaraqYarat  — baza → Sheets. Bazadagi ma'lumotdan LRV_PLUS
 *                      shaklidagi hujjat chizadi.
 *   apiT2VaraqQaytar — Sheets → baza. Odam tahrirlagan NОМ/БИРЛИК/
 *                      ХАЖМ/НАРХ ni bazaga qaytaradi.
 *
 * Foydalanuvchi: «bu sheets oynasida ishlangan ishlar supabase ga ham
 * o'ta olishi kerak edi, lekin u oynaga o'zgartirish kiritma keyingi
 * yangilanishda o'chib ketadi deyapdiku».
 *
 * Haqiqat manbai baribir BAZA. Sheets — teng huquqli mijoz, lekin
 * yagona hakam emas: qaytarish `versiya` bilan tekshiriladi va bazada
 * kimdir o'zgartirgan qator JIM YOZILMAYDI, ziddiyat deb qaytariladi.
 *
 * ⚠️ HISOB USTUNLARI (СУММА, ЧЕЛ/МАШ/МАТ/ОБ, ТИП) qaytarilmaydi — ular
 * hisobdan keladi. Ularni Sheets'dan olish hisobni buzardi.
 *
 * ⚠️ TEZLIK: butun jadval BITTA `setValues` bilan yoziladi. Qatorma-qator
 * yozish aynan Tizim_01 ni sekinlashtirgan narsa (51 ta formula yozish,
 * 21 ta merge). Bu yerda formula umuman yozilmaydi — raqamlar bazada
 * allaqachon hisoblangan.
 */

/* ═══════════════════ BAZADAN O'QISH ═══════════════════════════════════ */

/** Obyektning bazadagi yozuvi. */
function _t2ObyektOl(nom){
  var r = _t2Get('t2_obyekt?nom=eq.' + encodeURIComponent(nom) + '&select=id,nom,tur,izoh');
  return r.length ? r[0] : null;
}

/**
 * ⚠️ QATORLAR HAMMASI BITTA O'QILADI.
 * Har bir tugun uchun API ga borish limitni (~50 ta chaqiruv) tezda
 * tugatib yuboradi va "Too many requests" xatosiga olib keladi.
 * Yoki undan ham yomoni: chala chizib jim yiqiladi va Sheets da
 * ko'zgu yarim chiziladi — bu eng xavfli xato turi (xato chiqmaydi,
 * lekin hujjat noto'g'ri).
 */
function _t2HolatlarOl(obyektId){
  var hammasi = [], offset = 0, SAHIFA = 1000;
  for(var qadam = 0; qadam < 100; qadam++){
    var bolak = _t2Get('t2_qator_holat?obyekt_id=eq.' + obyektId + '&limit=' + SAHIFA + '&offset=' + offset);
    if(!bolak.length) break;
    hammasi = hammasi.concat(bolak);
    if(bolak.length < SAHIFA) break;
    offset += bolak.length;
  }
  return hammasi;
}

/**
 * Daraxt qatorlari — tartib bo'yicha.
 * PostgREST server tomonda «Max rows» chegarasiga ega, shuning uchun
 * SAHIFALAB o'qiymiz. Aks holda katta obyektda javob JIM KESILADI va
 * ko'zgu yarim chiziladi — bu eng xavfli xato turi (xato chiqmaydi,
 * lekin hujjat noto'g'ri).
 */
function _t2QatorlarOl(obyektId){
  var hammasi = [], offset = 0, SAHIFA = 1000;
  for(var qadam = 0; qadam < 100; qadam++){          // xavfsizlik chegarasi
    var bolak = _t2Get('t2_daraxt?obyekt_id=eq.' + obyektId +
                       '&order=tartib.asc&limit=' + SAHIFA + '&offset=' + offset);
    if(!bolak.length) break;
    hammasi = hammasi.concat(bolak);
    if(bolak.length < SAHIFA) break;
    offset += bolak.length;
  }
  return hammasi;
}


/* ═══════════════════ KO'ZGU PAPKASI ═══════════════════════════════════ */

/**
 * `Tizim_02` papkasini topadi yoki yaratadi (ildiz papka ostida).
 * Tizim_01 ning papkalariga TEGMAYDI — ko'zgu fayllari butunlay alohida
 * joyda turadi, aks holda dvigatel ularni smeta deb o'qib yuborishi mumkin.
 */
function _t2KozguPapka(){
  var a = sozAsosiy();
  var ildiz = DriveApp.getFolderById(a.rootId);
  var it = ildiz.getFoldersByName('Tizim_02');
  if(it.hasNext()) return it.next();
  return ildiz.createFolder('Tizim_02');
}


/* ═══════════════════ KO'ZGUNI CHIZISH ═════════════════════════════════ */

/**
 * Obyektning ko'zgu hujjatini yasaydi (yoki yangilaydi).
 *
 * @param {string} obyekt obyekt nomi
 * @return {Object} {ok, fayl_id, url, qator, jami, toliq}
 */
function apiT2VaraqYarat(obyekt){
  var t0 = Date.now();
  try{
    var ob = _t2ObyektOl(obyekt);
    if(!ob) return {ok:false, xabar:'Obyekt bazada topilmadi: ' + obyekt};

    var qatorlar = _t2QatorlarOl(ob.id);
    if(!qatorlar.length){
      return {ok:false, xabar:'Bazada bu obyekt uchun qator yo\'q. ' +
                              'Avval «Bazaga ko\'chirish va hisoblash» ni bajaring.'};
    }

    /* ── Iyerarxiyani tiklaymiz (chuqurlikni bilish uchun) ── */
    var xarita = {}, i;
    var holatlar = _t2HolatlarOl(ob.id);
    var holatXarita = {};
    for(var hi = 0; hi < holatlar.length; hi++) holatXarita[holatlar[hi].qator_id] = holatlar[hi];
    
    for(i = 0; i < qatorlar.length; i++) {
      var h = holatXarita[qatorlar[i].id];
      if(h) {
        qatorlar[i].fakt_hajm = h.fakt_hajm; qatorlar[i].fakt_summa = h.fakt_summa;
        qatorlar[i].qoldiq_hajm = h.qoldiq_hajm; qatorlar[i].qoldiq_summa = h.qoldiq_summa;
      }
      xarita[qatorlar[i].id] = qatorlar[i];
    }
    function chuqurlik(q){
      var d = 0, kor = {};
      while(q && q.ota_id != null && !kor[q.id]){
        kor[q.id] = 1; q = xarita[q.ota_id]; d++;
        if(d > 20) break;                        // buzuq halqadan himoya
      }
      return d;
    }

    /* ── Jamlanma (bazadan, qayta hisoblamaymiz) ── */
    var jami = 0, narxsiz = 0;
    for(i = 0; i < qatorlar.length; i++){
      var q = qatorlar[i];
      if(q.tur === 'rz' && q.ota_id == null) jami += Number(q.summa) || 0;
      if((q.tur === 'rs' || q.tur === 'mat' || q.tur === 'ob') && q.narx === null) narxsiz++;
    }
    var toliq = (narxsiz === 0);

    /* ── Fayl ── */
    var papka = _t2KozguPapka();
    /* ⚠️ NOM: «ko'zgu» emas.
     * Foydalanuvchi: «tayyor mahsulot nomi ustida nima uchun ko'zgu
     * deysan, bir ilmiyroq nom topsangchi».
     * To'g'ri — «ko'zgu» ichki atama edi va endi noto'g'ri ham: hujjat
     * bir tomonlama aks emas, u TAHRIRLANADI va bazaga qaytadi.
     * Sohaning o'z atamasi — ИШЧИ СМЕТА (Tizim_01 dagi LRV_PLUS ning
     * o'rnini bosadi). */
    var faylNomi = obyekt + ' — ИШЧИ СМЕТА';
    var kozgu = _t2Get('t2_kozgu?obyekt_id=eq.' + ob.id + '&select=fayl_id');
    var ss = null;

    if(kozgu.length && kozgu[0].fayl_id){
      try{ ss = SpreadsheetApp.openById(kozgu[0].fayl_id); }catch(e){ ss = null; }
    }
    if(!ss){
      ss = SpreadsheetApp.create(faylNomi);
      var f = DriveApp.getFileById(ss.getId());
      papka.addFile(f);
      try{ DriveApp.getRootFolder().removeFile(f); }catch(e){}
    }

    /* ⚡ Chizish boshlandi — endi `onEdit` bizning yozuvlarimizni
       odam tahriri deb qabul qilmaydi (sinx halqasi himoyasi). */
    _t2ChizishBoshlandi();

    var sh = ss.getSheets()[0];
    sh.clear();
    try{ sh.clearConditionalFormatRules(); }catch(e){}
    sh.setName('СМЕТА');

    /* ⚠️ FORMULA ARGUMENT AJRATGICHI HUJJAT TILIGA BOG'LIQ.
     *
     * Ba'zi tillarda (polyak, rus, nemis…) o'nlik kasr VERGUL bilan
     * yoziladi, shuning uchun funksiya argumentlari NUQTALI VERGUL
     * bilan ajratiladi. `setValues` formulani hujjat tilida talqin
     * qiladi — vergulli formula o'sha yerda «Formula parse error»
     * beradi va BUTUN jadval #ERROR! bo'lib qoladi (aynan shunday
     * bo'ldi: hujjat polyak tilida, `zł` valyutasi bilan).
     *
     * Tilni nom bo'yicha taxmin qilmaymiz — SINAB ko'ramiz. Bu har
     * qanday tilda to'g'ri ishlaydi va kelajakda ham buzilmaydi. */
    var AJR = _t2Ajratgich(sh);

    /* ══ USTUN JOYLASHUVI — LRV_PLUS BILAN BIR XIL ══
     *
     * Foydalanuvchi: «lrv plus fayllarni o'qib chiq va hozirgi oyna
     * jadvalimiz ham shunaqa bo'lishini … taminlashing kerakda.
     * Resurslarni turiga qarab alohida ustunlarga ham ajratishi kerak,
     * chunki shundan nakrutka hisoblanadi».
     *
     * 00_Config.js dagi LRV_PLUS xaritasi (CFG.C):
     *     A=№ B=КОД C=НОМ D=БИРЛИК E F  G=НАРХ H=СМЕТА I=МАРКЕР
     *     J=ЧЕЛ K=МАШ L=МАТ M=ОБ
     *
     * Avvalgi ko'zguda YETISHMAGAN narsalar:
     *   • НОРМА (E) — faqat bitta «Кол-во» ustuni bor edi
     *   • ТИП (I)   — rz/bl/rs/mat/ob markeri umuman yo'q edi
     *   • ЧЕЛ/МАШ/МАТ/ОБ — kategoriya faqat matn sifatida turardi,
     *     summa kategoriya ustunlariga ajratilmasdi (накрутка uchun shart)
     *   • № — oddiy qator sanog'i edi, smetaning asl raqami emas
     */
    /* ⚠️ OXIRGI IKKI USTUN YASHIRIN — QAYTISH YO'LI UCHUN.
     *
     * Foydalanuvchi: «bu sheets oynasida ishlangan ishlar supabase ga
     * ham o'ta olishi kerak edi, lekin u oynaga o'zgartirish kiritma
     * keyingi yangilanishda o'chib ketadi deyapdiku».
     *
     * Tahrirni bazaga qaytarish uchun HAR QATORNI ANIQLASH kerak.
     * Qator raqami yaramaydi: qator qo'shilsa/o'chsa hammasi suriladi
     * va tahrir BOSHQA resursga tushib ketadi. Shuning uchun `id`
     * (o'zgarmas kalit) va `versiya` (ziddiyatni aniqlash uchun)
     * yashirin ustunlarda yuriydi. Ular odamga ko'rinmaydi.
     */
    /* ⚠️ 2026-08-28: ФАКТ ustunlari QO'SHILDI.
     *
     * Avval varaqda faqat Ф2 bor edi — odam «qancha bajarildi» ni ko'zguda
     * NA KO'RA olardi, NA KIRITA olardi. Foydalanuvchi esa aynan shu
     * varaqda ishlaydi. Endi ФАКТ ХАЖМ tahrirlanadigan ustun: unga yozilsa
     * teskari sinx `t2_fakt_belgila` ni chaqiradi (jami beriladi — tizim
     * FARQNI hujjat qilib yozadi).
     *
     * Tartib mantiqiy: smeta → ФАКТ (bajarildi) → Ф2 (hisob) → qoldiq. */
    var USTUNLAR = ['№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.',
                    'ХАЖМ (ед)', 'ХАЖМ (жами)', 'НАРХ (1 ед)', 'СУММА', 'ТИП',
                    'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ',
                    'ФАКТ ХАЖМ', 'ФАКТ СУММА',
                    'F2 HAJM', 'F2 SUMMA', 'QOLDIQ HAJM', 'QOLDIQ SUMMA', '_id', '_v'];
    var NU = USTUNLAR.length;                // 21
    var KO_RINADI = 19;                      // 20-21 (_id/_v) yashirin
    var C_NORMA = 5, C_HAJM = 6, C_NARX = 7, C_SUMMA = 8, C_KAT1 = 10;
    var C_FAKT_HAJM = 14, C_FAKT_SUM = 15;
    var C_F2_HAJM = 16, C_F2_SUM = 17, C_QOLD_HAJM = 18, C_QOLD_SUM = 19, C_ID = 20, C_VER = 21;
    var bosh = function(){ return new Array(NU).join('.').split('.'); };

    /* Kategoriya bo'yicha jamlanma — sarlavhada ko'rsatiladi */
    var katJami = {'ЧЕЛ':0, 'МАШ':0, 'МАТ':0, 'ОБ':0};
    for(i = 0; i < qatorlar.length; i++){
      var qk = qatorlar[i];
      if(qk.tur !== 'rs' && qk.tur !== 'mat' && qk.tur !== 'ob') continue;
      if(katJami[qk.kat] === undefined) continue;
      katJami[qk.kat] += Number(qk.summa) || 0;
    }

    var jadval = [];
    var q1 = bosh();
    q1[0] = '✏️ ИШЧИ СМЕТА. Таҳрирланг: НОМ, БИРЛИК, ХАЖМ, НАРХ — ' +
            'ўзгаришлар базага ЎЗИ ЁЗИЛАДИ (~1 дақиқа ичида). ' +
            'СУММА, ЖАМИ ва ЧЕЛ/МАШ/МАТ/ОБ — формула, улар ўзи ҳисобланади. ' +
            'Блок ҳажмини ўзгартирсангиз ичидаги ресурслар ҳам қайта ҳисобланади.';
    jadval.push(q1);

    var q2 = bosh(); q2[0] = obyekt; jadval.push(q2);

    var q3 = bosh();
    q3[0] = 'Чизилди: ' + Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd HH:mm');
    q3[C_NARX - 1] = 'ЖАМИ:';
    q3[C_SUMMA - 1] = jami;
    q3[C_KAT1 - 1] = katJami['ЧЕЛ'];
    q3[C_KAT1]     = katJami['МАШ'];
    q3[C_KAT1 + 1] = katJami['МАТ'];
    q3[C_KAT1 + 2] = katJami['ОБ'];
    jadval.push(q3);

    var q4 = bosh();
    q4[0] = toliq
      ? 'Барча қатор нархланган — жами ишончли.'
      : '⚠️ ' + narxsiz + ' қаторда нарх топилмади — ЖАМИ ТЎЛИҚ ЭМАС. ' +
        'Бу рақам устида молиявий қарор қабул қилманг.';
    jadval.push(q4);

    jadval.push(bosh());
    jadval.push(USTUNLAR);

    var SARLAVHA_QATOR = jadval.length;          // ma'lumot shundan keyin

    /* ══ QATOR RAQAMLARI OLDINDAN ══
     *
     * Foydalanuvchi: «shu sheetsda sheets formulalarini ham qo'ya
     * olmaysanmi? Yani man buni exell qilib olsam obyomlarni
     * o'zgartirsam formulalar avtomat ishlar edida».
     *
     * Formulalar bir-biriga havola qiladi (resurs → o'z blokiga, blok →
     * o'z resurslariga, razdel → o'z bloklariga), shuning uchun jadval
     * qurishdan OLDIN har qatorning varaqdagi o'rni ma'lum bo'lishi
     * kerak. Shu sababli ikki bosqich. */
    var BOSH_QATOR = jadval.length + 1;
    var satr = {};                               // id → varaqdagi qator
    for(i = 0; i < qatorlar.length; i++) satr[qatorlar[i].id] = BOSH_QATOR + i;

    /* Blokning bolalari qaysi qatorlar oralig'ida — СУММА yig'indisi uchun */
    var bola = {};
    for(i = 0; i < qatorlar.length; i++){
      var rb = qatorlar[i];
      if(rb.ota_id == null) continue;
      var sb = satr[rb.id], bb0 = bola[rb.ota_id];
      if(!bb0) bola[rb.ota_id] = {ilk: sb, oxir: sb};
      else { if(sb < bb0.ilk) bb0.ilk = sb; if(sb > bb0.oxir) bb0.oxir = sb; }
    }

    /* Razdel qamrovi — SUMIFS oralig'i uchun. Razdellar tekis (ichma-ich
       emas), shuning uchun har biri keyingisigacha davom etadi. */
    var rzOxir = {}, oxirgiRz = null;
    for(i = 0; i < qatorlar.length; i++){
      if(qatorlar[i].tur !== 'rz') continue;
      if(oxirgiRz != null) rzOxir[oxirgiRz] = BOSH_QATOR + i - 1;
      oxirgiRz = qatorlar[i].id;
    }
    if(oxirgiRz != null) rzOxir[oxirgiRz] = BOSH_QATOR + qatorlar.length - 1;

    /* ── Ma'lumot qatorlari ── */
    var uslub = [];                              // {qator, tur, narxsiz}
    for(i = 0; i < qatorlar.length; i++){
      var r = qatorlar[i];
      var qn = BOSH_QATOR + i;
      var resursmi = (r.tur === 'rs' || r.tur === 'mat' || r.tur === 'ob');

      var qator = bosh();
      /* № — smetaning ASL raqami (1, 1.1, 1.2, 2 …). Bu odam izlaydigan
         belgi; oddiy sanoq uning o'rnini bosa olmaydi. */
      qator[0] = r.raqam || '';
      qator[1] = r.kod || '';
      /* ⚠️ NOM OLDIDA BO'SHLIQ YO'Q.
         Avval daraja bo'shliq bilan ko'rsatilardi («    ГИЛЬЗЫ…») va bu
         nomni IFLOSLANTIRARDI: qidiruv, saralash, nusxa olish va bazaga
         qaytarishda o'sha bo'shliqlar birga ketardi. Daraja endi RANG,
         ТИП ustuni va № (1 / 1.1 / 1.2) orqali ko'rinadi. */
      qator[2] = r.nom || '';
      qator[3] = r.birlik || '';
      /* НОРМА faqat resursda bo'ladi: blokda 5-ustun uning o'z hajmi */
      qator[C_NORMA - 1] = (r.norma == null) ? '' : Number(r.norma);

      /* ── ХАЖМ (жами) ──
         Resursda FORMULA: blok hajmi × norma. Blok hajmini o'zgartirsa
         uning barcha resurslari o'z-o'zidan qayta hisoblanadi — bu
         Tizim_01 dagi `F = bl.obyom × E` qoidasining aynan o'zi. */
      var otaSatr = (r.ota_id != null) ? satr[r.ota_id] : null;
      var otaTur  = (r.ota_id != null && xarita[r.ota_id]) ? xarita[r.ota_id].tur : null;
      if(r.tur === 'rs' && r.norma != null && otaSatr && otaTur === 'bl'){
        qator[C_HAJM - 1] = '=IF(N($F' + otaSatr + ')*N($E' + qn + ')=0' + AJR +
                            '""' + AJR + '$F' + otaSatr + '*$E' + qn + ')';
      }else{
        qator[C_HAJM - 1] = (r.hajm == null) ? '' : Number(r.hajm);
      }

      /* ⚠️ Narx topilmagan bo'lsa 0 YOZILMAYDI — «нарх йўқ» deb yoziladi.
         0 yozilsa hujjat «bepul» deb ko'rsatardi va bu yolg'on bo'lardi. */
      qator[C_NARX - 1] = (r.narx == null)
        ? ((r.tur === 'rz' || r.tur === 'bl') ? '' : 'нарх йўқ') : Number(r.narx);

      /* ── СУММА — HAMMA JOYDA FORMULA ──
         Resurs:  hajm × narx  (ISNUMBER «нарх йўқ» matnini to'sadi)
         Blok:    o'z resurslarining yig'indisi
         Razdel:  o'z bloklari/materiallarining yig'indisi. Faqat
                  1-daraja turlari qo'shiladi — hammasini qo'shsak
                  blok ham, uning resurslari ham sanalib IKKI BARAVAR
                  bo'lardi. */
      if(resursmi){
        qator[C_SUMMA - 1] = '=IF(ISNUMBER($F' + qn + ')*ISNUMBER($G' + qn + ')' + AJR +
                             '$F' + qn + '*$G' + qn + AJR + '"")';
      }else if(r.tur === 'bl'){
        var bb = bola[r.id];
        qator[C_SUMMA - 1] = bb ? ('=SUM($H' + bb.ilk + ':$H' + bb.oxir + ')') : '';
      }else{
        var rzE = rzOxir[r.id];
        if(rzE && rzE > qn){
          var oraliqH = '$H' + (qn + 1) + ':$H' + rzE;
          var oraliqI = '$I' + (qn + 1) + ':$I' + rzE;
          var sumifs = function(tur){
            return 'SUMIFS(' + oraliqH + AJR + oraliqI + AJR + '"' + tur + '")';
          };
          qator[C_SUMMA - 1] = '=' + sumifs('bl') + '+' + sumifs('mat') + '+' + sumifs('ob');
        }else{
          qator[C_SUMMA - 1] = '';
        }
      }

      qator[8] = r.tur || '';

      /* ── KATEGORIYA USTUNLARI ──
         Накрутка har kategoriya bo'yicha alohida hisoblanadi. Bu ham
         FORMULA — summa o'zgarsa kategoriya ham o'zgaradi.
         Faqat RESURS qatorlari: blok/razdel summasi bolalarining
         yig'indisi, uni ham qo'shsak ikki marta sanalardi. */
      if(resursmi){
        var kUst = (r.kat === 'ЧЕЛ') ? C_KAT1
                 : (r.kat === 'МАШ') ? C_KAT1 + 1
                 : (r.kat === 'ОБ')  ? C_KAT1 + 3
                 : C_KAT1 + 2;                    // МАТ — qolgani
        qator[kUst - 1] = '=IF($H' + qn + '=""' + AJR + '""' + AJR + '$H' + qn + ')';
      }

      /* ФАКТ — bajarilgan ish. Bu ustun TAHRIRLANADI (qolganlaridan farqli):
         odam bu yerga yozsa `t2_fakt_belgila` chaqiriladi. */
      qator[C_FAKT_HAJM - 1] = (r.fakt_hajm != null) ? Number(r.fakt_hajm) : '';
      qator[C_FAKT_SUM - 1]  = (r.fakt_summa != null) ? Number(r.fakt_summa) : '';

      /* ⚠️ 2026-08-27: `r.fakt_hajm`/`r.fakt_summa` EMAS — ustun nomi
       * "F2 HAJM"/"F2 SUMMA", lekin FAKT summasi yozilardi (t2_qator_holat
       * `f2_hajm`/`f2_summa` deb ALOHIDA ustunga ega, aynan shu kerak). */
      qator[C_F2_HAJM - 1] = (r.f2_hajm != null) ? Number(r.f2_hajm) : '';
      qator[C_F2_SUM - 1]  = (r.f2_summa != null) ? Number(r.f2_summa) : '';
      qator[C_QOLD_HAJM - 1] = (r.qoldiq_hajm != null) ? Number(r.qoldiq_hajm) : '';
      qator[C_QOLD_SUM - 1] = (r.qoldiq_summa != null) ? Number(r.qoldiq_summa) : '';

      qator[C_ID - 1]  = r.id;
      qator[C_VER - 1] = (r.versiya == null) ? '' : r.versiya;

      jadval.push(qator);
      uslub.push({qator: jadval.length, tur: r.tur, narxsiz: (r.narx === null && resursmi)});
    }

    /* ── 3-QATOR JAMLANMASI HAM FORMULA ──
     * `q3` massiv havolasi bo'lgani uchun uni shu yerda to'ldirsak ham
     * bo'ladi — `setValues` hali chaqirilmagan. Formulaga o'tkazishning
     * sababi bitta: odam hajmni o'zgartirsa JAMI ham o'zgarsin, aks
     * holda sarlavhadagi raqam jadvaldagi bilan zid bo'lib qolardi. */
    var OXIR_QATOR = BOSH_QATOR + qatorlar.length - 1;
    if(qatorlar.length){
      /* SUM bitta oraliq oladi — ajratgich kerak emas, shuning uchun
         bu formulalar har qanday tilda bir xil ishlaydi. */
      q3[C_KAT1 - 1] = '=SUM(J' + BOSH_QATOR + ':J' + OXIR_QATOR + ')';
      q3[C_KAT1]     = '=SUM(K' + BOSH_QATOR + ':K' + OXIR_QATOR + ')';
      q3[C_KAT1 + 1] = '=SUM(L' + BOSH_QATOR + ':L' + OXIR_QATOR + ')';
      q3[C_KAT1 + 2] = '=SUM(M' + BOSH_QATOR + ':M' + OXIR_QATOR + ')';
      /* JAMI = kategoriyalar yig'indisi. Razdellar yig'indisi bilan bir
         xil chiqadi, lekin bu ko'rinish o'z-o'zini tekshiradi: agar
         kategoriya taqsimoti buzilsa JAMI ham darrov farq qiladi. */
      q3[C_SUMMA - 1] = '=SUM($J$3:$M$3)';
    }

    /* ── BITTA yozish ── */
    /* ⚠️ TIZIM YOZUVI BELGILANADI — SINX HALQASI TAHLILI.
     *
     * `setValues` o'rnatilgan onEdit tirgagini uyg'otadi. Savol: bu
     * Supabase → Sheets → Supabase → Sheets halqasiga aylanadimi?
     *
     * YO'Q. `apiT2VaraqQaytar` varaqqa BITTA HAM katak yozmaydi — u
     * faqat o'qiydi va bazaga yozadi. Zanjir shu yerda uziladi.
     * Ustiga-ustak u faqat FARQ topilgan qatorni yozadi; tizim endigina
     * chizgan varaqda farq bo'lmaydi.
     *
     * Lekin BEHUDA ISH bor: har chizishdan keyin 10 000 qatorli
     * bekorchi solishtiruv ishga tushardi. Shuning uchun tizim o'z
     * yozuvini belgilaydi va onEdit uni o'tkazib yuboradi.
     *
     * Oyna QISQA (60 s): agar odam shu vaqt ichida biror narsa yozsa,
     * uning tahriri KEYINGI tahrirda baribir bazaga tushadi — solishtiruv
     * butun varaqni tekshiradi, faqat o'zgargan katakni emas. Ya'ni
     * belgi ish yo'qotmaydi, faqat bekorchilikni kamaytiradi. */
    try{
      PropertiesService.getScriptProperties()
        .setProperty(T2_TIZIM_YOZDI, ss.getId() + '|' + Date.now());
    }catch(e){}

    sh.getRange(1, 1, jadval.length, USTUNLAR.length).setValues(jadval);

    /* ── Bezash (ommaviy, qatorma-qator emas) ── */

    /* ⚠️ `sh.clear()` birlashmalarni OLIB TASHLAMAYDI. Ustun soni
       o'zgarganda (13 → 15) eski birlashma qolib, yangisi bilan
       to'qnashardi. Shuning uchun sarlavha zonasi avval ajratiladi. */
    try{ sh.getRange(1, 1, 5, NU).breakApart(); }catch(e){}

    sh.getRange(1, 1, 1, NU).merge()
      .setBackground('#FFF3CD').setFontColor('#8A6D3B').setFontWeight('bold').setWrap(true);
    sh.getRange(2, 1, 1, NU).merge().setFontSize(13).setFontWeight('bold');
    sh.getRange(4, 1, 1, NU).merge()
      .setFontColor(toliq ? '#2E7D32' : '#C62828').setWrap(true);
    /* 3-qator: ЖАМИ va kategoriya jamlanmalari */
    sh.getRange(3, C_NARX, 1, NU - C_NARX + 1).setFontWeight('bold');
    sh.getRange(3, C_SUMMA, 1, 1).setNumberFormat('#,##0.00');
    sh.getRange(3, C_KAT1, 1, 4).setNumberFormat('#,##0.00').setBackground('#ECEFF1');
    sh.getRange(SARLAVHA_QATOR, 1, 1, NU)
      .setBackground('#37474F').setFontColor('#FFFFFF').setFontWeight('bold')
      .setWrap(true).setVerticalAlignment('middle');

    /* Turlar bo'yicha ranglash — har turni BITTA guruhda */
    var guruh = {rz: [], bl: [], mat: [], ob: [], narxsiz: []};
    for(i = 0; i < uslub.length; i++){
      if(guruh[uslub[i].tur]) guruh[uslub[i].tur].push(uslub[i].qator);
      if(uslub[i].narxsiz) guruh.narxsiz.push(uslub[i].qator);
    }
    function bezaGuruh(qatorlar2, fon, qalin, matnRang){
      if(!qatorlar2.length) return;
      var oraliqlar = qatorlar2.map(function(q){
        return sh.getRange(q, 1, 1, USTUNLAR.length).getA1Notation();
      });
      var rl = sh.getRangeList(oraliqlar);
      if(fon) rl.setBackground(fon);
      if(qalin) rl.setFontWeight('bold');
      if(matnRang) rl.setFontColor(matnRang);
    }
    bezaGuruh(guruh.rz,  CFG.RANG.rz,  true, null);
    bezaGuruh(guruh.bl,  CFG.RANG.bl,  true, CFG.RANG_BL_FONT);
    bezaGuruh(guruh.mat, CFG.RANG.mat, false, null);
    bezaGuruh(guruh.ob,  '#FCE4EC',    false, null);
    /* Narxi topilmagan qator ko'zga tashlansin — odam nimani to'ldirish
       kerakligini bir qarashda ko'rsin. */
    bezaGuruh(guruh.narxsiz, '#FFEBEE', false, '#B71C1C');

    /* Raqam formati va kengliklar */
    if(qatorlar.length){
      /* Hajm/norma — 6 kasrgacha: norma 0.0761 kabi kichik bo'ladi va
         2 kasrga yaxlitlansa nolga aylanib ko'rinardi. */
      sh.getRange(SARLAVHA_QATOR + 1, C_NORMA, qatorlar.length, 2)
        .setNumberFormat('#,##0.######');
      sh.getRange(SARLAVHA_QATOR + 1, C_NARX, qatorlar.length, 2)
        .setNumberFormat('#,##0.00');
      sh.getRange(SARLAVHA_QATOR + 1, C_KAT1, qatorlar.length, 4)
        .setNumberFormat('#,##0.00');
      /* ФАКТ + Ф2 + QOLDIQ — 6 ta ustun ketma-ket */
      sh.getRange(SARLAVHA_QATOR + 1, C_FAKT_HAJM, qatorlar.length, 6)
        .setNumberFormat('#,##0.00');
      /* Kategoriya ustunlari ko'z bilan ajralib tursin.
         Chegara — sof bezak, hujjatni yiqitishga haqqi yo'q. */
      try{
        sh.getRange(SARLAVHA_QATOR, C_KAT1, qatorlar.length + 1, 4)
          .setBorder(null, true, null, true, false, false);
      }catch(e){}
    }
    sh.setColumnWidth(1, 55);  sh.setColumnWidth(2, 95);
    sh.setColumnWidth(3, 430); sh.setColumnWidth(4, 70);
    sh.setColumnWidth(5, 85);  sh.setColumnWidth(6, 95);
    sh.setColumnWidth(7, 100); sh.setColumnWidth(8, 120);
    sh.setColumnWidth(9, 45);
    for(var kc = C_KAT1; kc < C_KAT1 + 4; kc++) sh.setColumnWidth(kc, 115);
    sh.setColumnWidth(C_FAKT_HAJM, 105);
    sh.setColumnWidth(C_FAKT_SUM, 110);
    sh.setColumnWidth(C_F2_HAJM, 100);
    sh.setColumnWidth(C_F2_SUM, 100);
    sh.setColumnWidth(C_QOLD_HAJM, 100);
    sh.setColumnWidth(C_QOLD_SUM, 100);
    /* ФАКТ ХАЖМ — TAHRIRLANADIGAN ustun, ko'z bilan ajralib tursin */
    try{
      sh.getRange(SARLAVHA_QATOR, C_FAKT_HAJM)
        .setBackground('#E8F5E9').setNote(
          'Bu ustun TAHRIRLANADI.\n\n' +
          'Bajarilgan JAMI hajmni yozing (masalan 3 dan 8 ga).\n' +
          'Tizim farqni (+5) hisoblab, ФАКТ hujjatini o\'zi yaratadi.\n' +
          'Kamaytirish ham mumkin — перерасчёт sifatida yoziladi.');
    }catch(e){}
    /* ⚠️ BEZAK HUJJATNI TO'SMASIN.
     *
     * `setFrozenColumns(3)` yiqilgan edi: 1/2/4-qatorlar butun kenglikda
     * birlashtirilgan va ustunni 3-dan muzlatish o'sha birlashmani
     * o'rtasidan kesadi —
     *   «you can't freeze columns which contain only part of a merged cell»
     * Chaqiruv try/catch siz turgani uchun BUTUN ko'zgu yaratilmasdan
     * qolardi. Ya'ni sof kosmetik narsa asosiy ishni o'ldirgan.
     *
     * Ustunlarni muzlatishdan voz kechdik (banner birlashmasi bilan
     * birga ishlamaydi), qolgan bezaklar esa endi himoyalangan: ular
     * yiqilsa ham hujjat baribir yaraladi. */
    try{ sh.setFrozenRows(SARLAVHA_QATOR); }catch(e){}
    /* Xizmat ustunlari ko'zdan yashiriladi — lekin O'CHIRILMAYDI:
       ularsiz tahrirni bazaga qaytarib bo'lmaydi. */
    try{ sh.hideColumns(C_ID, 2); }catch(e){}

    /* ⚠️ HIMOYA OLIB TASHLANDI.
     *
     * Avval butun varaq ogohlantirish bilan qulflangan edi — chunki
     * tahrir yo'qolardi. Endi tahrir SAQLANADI, shuning uchun qulf
     * faqat xalaqit berardi.
     *
     * Buning o'rniga HISOB USTUNLARI qulflanadi: СУММА, ТИП va
     * ЧЕЛ/МАШ/МАТ/ОБ — ular formula, ustiga yozilsa formula o'chib
     * ketadi va jadval jim buziladi. */
    try{
      var eski = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      for(var pi = 0; pi < eski.length; pi++) eski[pi].remove();
      var eskiR = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
      for(var pj = 0; pj < eskiR.length; pj++) eskiR[pj].remove();

      if(qatorlar.length){
        var hisobOraliq = sh.getRange(BOSH_QATOR, C_SUMMA, qatorlar.length, 1);
        var qulf1 = hisobOraliq.protect().setDescription(
          'СУММА — формула, ҳисобдан келади');
        qulf1.setWarningOnly(true);

        var katOraliq = sh.getRange(BOSH_QATOR, 9, qatorlar.length, 5);  // ТИП + 4 kategoriya
        var qulf2 = katOraliq.protect().setDescription(
          'ТИП ва ЧЕЛ/МАШ/МАТ/ОБ — формула, ҳисобдан келади');
        qulf2.setWarningOnly(true);

        /* ⚠️ ФАКТ ХАЖМ ATAYLAB QULFLANMAYDI — u kiritish ustuni.
           Qulf faqat ФАКТ СУММА dan boshlanadi (u hisobdan keladi). */
        var qulf3 = sh.getRange(BOSH_QATOR, C_FAKT_SUM, qatorlar.length, 5).protect().setDescription(
          'ФАКТ сумма, F2 ва Қолдиқ — ҳисобдан келади, фақат ўқиш учун');
        qulf3.setWarningOnly(true);
      }
    }catch(e){}

    /* ── Bazaga qayd ── */
    var barmoq = String(qatorlar.length) + ':' + String(Math.round(jami)) + ':' + String(narxsiz);
    _t2Post('t2_kozgu', [{
      obyekt_id: ob.id, fayl_id: ss.getId(),
      oxirgi_yozish: new Date().toISOString(),
      qator_soni: qatorlar.length, barmoq_izi: barmoq,
      holat: 'sinxron', xato: null
    }], false, 'obyekt_id');

    /* Ko'prik navbati yopiladi — bu o'zgarishlar endi varaqda bor */
    _t2KopriknavbatYop(ob.id);

    /* AVTOMATIK SINXRON: varaq tahrirlanganda o'zi bazaga yozsin.
       Natija ochiq qaytariladi — o'rnatilmagan bo'lsa panel buni
       aytadi va odam tugmadan foydalanishini biladi. */
    var tirgak = _t2VaraqTirgakOrnat(ss.getId());

    _t2ChizishTugadi();
    return {
      ok: true, obyekt: obyekt, fayl_id: ss.getId(), url: ss.getUrl(),
      qator: qatorlar.length, jami: jami, toliq: toliq, narxsiz: narxsiz,
      avto_sinx: tirgak, ms: Date.now() - t0
    };

  }catch(e){
    /* Bayroq xato holatida ham olinadi — aks holda sinxron
       T2_CHIZISH_UMRI tugagunicha jim o'chib turardi. */
    _t2ChizishTugadi();
    return {ok:false, xabar: String((e && e.message) || e), ms: Date.now() - t0};
  }
}

/** Ko'zguga yetkazilgan o'zgarishlarni navbatdan chiqaradi. */
function _t2KopriknavbatYop(obyektId){
  try{
    var c = _t2Cfg();
    UrlFetchApp.fetch(c.url + '/rest/v1/t2_ozgarish?obyekt_id=eq.' + obyektId +
                      '&kozguga_yozildi=is.false', {
      method: 'patch',
      headers: _t2Bosh(c, {'Prefer':'return=minimal'}),
      payload: JSON.stringify({kozguga_yozildi: true}),
      muteHttpExceptions: true
    });
  }catch(e){}
}


/**
 * To'liq yo'l: import → hisob → ko'zgu.
 * Foydalanuvchi uchun bitta tugma: fayl bazaga tushadi, baza hisoblaydi,
 * natija odam o'qiydigan hujjatga aylanadi.
 */
function apiT2ToliqZanjir(obyekt){
  var t0 = Date.now();
  var natija = {ok:false, obyekt:obyekt, bosqichlar:{}};
  try{
    natija.bosqichlar.import = apiT2ObyektImport(obyekt);
    if(!natija.bosqichlar.import || !natija.bosqichlar.import.ok){
      natija.xabar = 'Import bosqichida to\'xtadi';
      natija.ms = Date.now() - t0;
      return natija;
    }
    natija.bosqichlar.kozgu = apiT2VaraqYarat(obyekt);
    natija.ok = !!(natija.bosqichlar.kozgu && natija.bosqichlar.kozgu.ok);
    if(!natija.ok) natija.xabar = natija.bosqichlar.kozgu.xabar;
    natija.ms = Date.now() - t0;
    return natija;
  }catch(e){
    natija.xabar = String((e && e.message) || e);
    natija.ms = Date.now() - t0;
    return natija;
  }
}

/* ══════════════════════════════════════════════════════════════════
 * KO'ZGUDAN BAZAGA QAYTISH
 * ══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «bu sheets oynasida ishlangan ishlar supabase ga ham
 * o'ta olishi kerak edi, lekin u oynaga o'zgartirish kiritma keyingi
 * yangilanishda o'chib ketadi deyapdiku».
 *
 * Endi ko'zgu bir tomonlama emas. Sheets'da tahrir qilinadi, keyin shu
 * funksiya o'zgarganini bazaga qaytaradi.
 *
 * QANDAY QILIB XAVFSIZ:
 *
 *  1) QATOR ANIQLASH — yashirin `_id` ustuni orqali. Qator raqami
 *     yaramaydi: odam qator qo'shsa yoki o'chirsa hammasi suriladi va
 *     tahrir BOSHQA resursga tushardi.
 *
 *  2) ZIDDIYAT — yashirin `_v` (versiya). Ko'zgu chizilgandan keyin
 *     bazada kimdir o'zgartirgan bo'lsa versiya farq qiladi va bu qator
 *     YOZILMAYDI, ro'yxatda qaytariladi. «Oxirgi yozgan yutadi» qoidasi
 *     bu yerda birovning ishini jim o'chirib yuborardi.
 *
 *  3) FAQAT ODAM KIRITADIGAN MAYDONLAR: nom, birlik, hajm, narx.
 *     СУММА va kategoriya ustunlari HISOBDAN keladi — ularni qaytarish
 *     hisobni buzardi. ТИП/№/КОД — smetaning tuzilishi, ko'zgudan
 *     o'zgartirilmaydi.
 *
 * ⚠️ Bu yerda narx O'ZIDAN TO'QILMAYDI: bo'sh katak «narx yo'q» degani,
 * uni 0 deb yozib qo'ymaymiz — 0 «bepul» degan ma'noni beradi.
 */
function apiT2VaraqQaytar(obyekt){
  var t0 = Date.now();
  try{
    var ob = _t2ObyektOl(obyekt);
    if(!ob) return {ok:false, xabar:'Obyekt bazada topilmadi: ' + obyekt};

    var kozgu = _t2Get('t2_kozgu?obyekt_id=eq.' + ob.id + '&select=fayl_id');
    if(!kozgu.length || !kozgu[0].fayl_id)
      return {ok:false, xabar:'Bu obyekt uchun ko\'zgu yaratilmagan'};

    var ss;
    try{ ss = SpreadsheetApp.openById(kozgu[0].fayl_id); }
    catch(e){ return {ok:false, xabar:'Ko\'zgu fayli ochilmadi (o\'chirilganmi?)'}; }

    var sh = ss.getSheetByName('СМЕТА');
    if(!sh) return {ok:false, xabar:'«СМЕТА» varag\'i topilmadi'};

    var oxirgi = sh.getLastRow();
    if(oxirgi < 8) return {ok:false, xabar:'Ko\'zgu bo\'sh'};

    /* Sarlavha qatorini topamiz — u «№» bilan boshlanadi */
    var bosh = sh.getRange(1, 1, Math.min(12, oxirgi), 1).getValues();
    var sarlavha = 0;
    for(var b = 0; b < bosh.length; b++){
      if(String(bosh[b][0]).trim() === '№'){ sarlavha = b + 1; break; }
    }
    if(!sarlavha) return {ok:false, xabar:'Sarlavha qatori topilmadi — ko\'zgu qayta chizilsinmi?'};
    if(oxirgi <= sarlavha) return {ok:true, tekshirildi:0, ozgardi:0, ziddiyat:[], xatolar:[]};

    var soni = oxirgi - sarlavha;
    /* 21 ustun: ФАКТ ХАЖМ/СУММА qo'shilgach kengaydi (2026-08-28).
       Eski ko'zgu (19 ustunli) ham o'qiladi — `getValues` mavjud
       kenglikdan oshmaydi, shuning uchun aniq son beramiz. */
    var oxirgiUst = Math.min(sh.getLastColumn(), 21);
    var qiy = sh.getRange(sarlavha + 1, 1, soni, oxirgiUst).getValues();
    /* Eski (19 ustunli) varaqda _id 18-, yangisida 20-ustunda.
       Sarlavhadan aniqlaymiz — ustun tartibi o'zgarsa ham ishlasin. */
    var sarQiy = sh.getRange(sarlavha, 1, 1, oxirgiUst).getValues()[0];
    var iId = -1, iVer = -1, iFakt = -1;
    for(var si = 0; si < sarQiy.length; si++){
      var sn = String(sarQiy[si] || '').trim();
      if(sn === '_id') iId = si;
      else if(sn === '_v') iVer = si;
      else if(sn === 'ФАКТ ХАЖМ') iFakt = si;
    }
    if(iId < 0) return {ok:false, xabar:'«_id» ustuni topilmadi — ko\'zgu qayta chizilsinmi?'};

    /* Bazadagi holat — bitta o'qish, qatorma-qator so'rov EMAS */
    var bazadagi = {}, hammasi = _t2QatorlarOl(ob.id);
    for(var h = 0; h < hammasi.length; h++) bazadagi[hammasi[h].id] = hammasi[h];

    /* ⚠️ ФАКТ `t2_daraxt` da YO'Q — u hujjatlardan yig'iladi va faqat
     * `t2_qator_holat` da bor. Uni o'qimasak `fakt_hajm` undefined bo'lib,
     * har sinxda «0 dan X ga o'zgardi» deb TAKRORIY hujjat yaratilardi —
     * fakt har safar ikkilanib ketardi. Shuning uchun alohida o'qiymiz. */
    var faktJoriy = {};
    if(iFakt >= 0){
      var hol = _t2HolatlarOl(ob.id);
      for(var hh = 0; hh < hol.length; hh++){
        faktJoriy[hol[hh].qator_id] = Number(hol[hh].fakt_hajm || 0);
      }
    }

    var MAYDON = [
      {ust: 3,  nom: 'nom',    matn: true},
      {ust: 4,  nom: 'birlik', matn: true},
      {ust: 6,  nom: 'hajm',   matn: false},
      {ust: 7,  nom: 'narx',   matn: false}
    ];

    var ozgardi = 0, ziddiyat = [], xatolar = [], tekshirildi = 0;

    for(var i = 0; i < qiy.length; i++){
      var id = Number(qiy[i][iId]);                 // _id (sarlavhadan topilgan)
      if(!id) continue;                             // xizmat/bo'sh qator
      var baza = bazadagi[id];
      if(!baza) continue;                           // bazadan o'chgan
      tekshirildi++;

      var kutilganV = (iVer >= 0) ? qiy[i][iVer] : null;
      kutilganV = (kutilganV === '' || kutilganV == null) ? null : Number(kutilganV);

      /* ── ФАКТ ustuni ALOHIDA ishlanadi ──────────────────────────────
       * Boshqa maydonlar (nom/birlik/hajm/narx) `t2_qator_tahrir` bilan
       * TO'G'RIDAN-TO'G'RI yoziladi. ФАКТ esa unday EMAS: u hujjatlardan
       * (`t2_akt` tur='fakt') YIG'ILADI, shuning uchun ustiga yozib
       * bo'lmaydi. Varaqdagi qiymat JAMI ni bildiradi, demak farqni
       * hisoblab yangi hujjat yaratish kerak — buni `t2_fakt_belgila`
       * qiladi. Manfiy farq (перерасчёт) ham qabul qilinadi. */
      if(iFakt >= 0){
        var faktXom = qiy[i][iFakt];
        if(faktXom !== '' && faktXom != null && String(faktXom).indexOf('нарх') < 0){
          var faktYangi = Number(faktXom);
          var faktEski = Number(faktJoriy[id] || 0);
          if(isFinite(faktYangi) && Math.abs(faktYangi - faktEski) > 0.0000001){
            try{
              var fr = _t2Rpc('t2_fakt_belgila', {
                p_qator_id: id, p_yangi_jami: faktYangi, p_kim: 'kozgu'});
              if(fr && fr.ok){
                if(!fr.ozgarmadi) ozgardi++;
              }else{
                ziddiyat.push({qator: sarlavha + 1 + i, nom: baza.nom,
                               maydon: 'fakt', sabab: (fr && fr.xabar) || 'yozilmadi'});
              }
            }catch(ef){
              xatolar.push('«' + (baza.nom || id) + '» / fakt: ' +
                           ((ef && ef.message) || ef));
            }
          }
        }
      }

      for(var m = 0; m < MAYDON.length; m++){
        var f = MAYDON[m], xom = qiy[i][f.ust - 1];
        var yangi, eski = baza[f.nom];

        if(f.matn){
          /* Nom ustunida daraja bo'shliqlari bor — ular bezak, mazmun emas */
          yangi = String(xom == null ? '' : xom).replace(/^\s+/, '').trim();
          if(yangi === '') continue;                // bo'sh nom — tahrir emas
          if(yangi === String(eski == null ? '' : eski).trim()) continue;
        }else{
          /* ⚠️ Bo'sh katak «narx yo'q» degani. Uni 0 deb yozsak hujjat
             resursni «bepul» deb ko'rsatardi — bu yolg'on bo'ladi. */
          if(xom === '' || xom == null) continue;
          if(String(xom).indexOf('нарх') >= 0) continue;   // «нарх йўқ» yozuvi
          yangi = Number(xom);
          if(!isFinite(yangi)) continue;
          if(eski != null && Math.abs(Number(eski) - yangi) < 0.0000001) continue;
        }

        try{
          var r = _t2Rpc('t2_qator_tahrir', {
            p_qator_id: id, p_maydon: f.nom, p_qiymat: String(yangi),
            p_kutilgan_versiya: kutilganV, p_manba: 'sheets'
          });
          if(r && r.ok){
            ozgardi++;
            kutilganV = (r.versiya != null) ? Number(r.versiya) : kutilganV;
          }else{
            ziddiyat.push({qator: sarlavha + 1 + i, nom: baza.nom,
                           maydon: f.nom, sabab: (r && r.xabar) || 'ziddiyat'});
          }
        }catch(e2){
          xatolar.push('«' + (baza.nom || id) + '» / ' + f.nom + ': ' +
                       ((e2 && e2.message) || e2));
        }
      }
    }

    /* ⚠️ BU YERDA `apiT2Ishla` CHAQIRILMAYDI — U TAHRIRNI O'CHIRARDI.
     *
     * `apiT2Ishla` zanjirida `t2_markirovka` bor, u esa
     *     delete from t2_qator where manba_id = …
     * qilib xom ma'lumotdan qayta quradi. Ya'ni endigina saqlangan
     * НОМ/БИРЛИК/ХАЖМ tahriri darhol yo'q bo'lardi. Zanjirdagi
     * `t2_narxla` ham narxni svodkadan qayta yozardi.
     *
     * Bu «ishim saqlandi» deb o'ylab turib yo'qotish — aynan shu
     * funksiya oldini olishi kerak bo'lgan narsa.
     *
     * Hisob baribir yangi: `t2_qator_tahrir` har tahrirdan keyin
     * `t2_rollup` ni o'zi chaqiradi. Bu yerda faqat YANGI JAMI ni
     * o'qiymiz. */
    var hisob = null;
    if(ozgardi){
      try{
        var jam = _t2Get('t2_obyekt_jami?id=eq.' + ob.id + '&select=jami,narxsiz');
        if(jam.length){
          var nsz = Number(jam[0].narxsiz) || 0;
          hisob = {ok:true, jami: {jami: jam[0].jami, narxsiz_qator: nsz,
                                   /* `toliq` ko'rinishda yo'q — narxsizdan chiqadi */
                                   toliq: nsz === 0}};
        }
      }catch(e3){
        xatolar.push('Yangi jamini o\'qib bo\'lmadi: ' + ((e3 && e3.message) || e3));
      }
    }

    /* ══ ZIDDIYAT VARAQNING O'ZIDA BELGILANADI ══
     *
     * Reja 7.8: «Sheetsda qator/kletka aniq status bilan ko'rsatiladi;
     * avtomatik ustidan yozish yo'q».
     *
     * Bu MAJBURIY, chunki sinxron FONDA ishlaydi. Ziddiyatni faqat
     * panelga qaytarsak, avto-sinxronda odam uni HECH QACHON
     * ko'rmaydi: tahriri yozilmagan bo'ladi, lekin ekranda hech nima
     * o'zgarmaydi va u ishim saqlandi deb o'ylaydi.
     *
     * Shuning uchun: ziddiyatli qator qizil bo'ladi va katakka izoh
     * ilinadi. Muvaffaqiyatli sinxronlangan qatorlardan belgi
     * olib tashlanadi. */
    try{
      var zidQ = {};
      for(var zi = 0; zi < ziddiyat.length; zi++) zidQ[ziddiyat[zi].qator] = ziddiyat[zi];

      /* Avvalgi belgilar tozalanadi — eskisi qolib ketmasin */
      if(soni > 0){
        sh.getRange(sarlavha + 1, 3, soni, 5).setBackground(null).clearNote();
      }
      for(var zq in zidQ){
        var qn = Number(zq);
        var yac = sh.getRange(qn, 3, 1, 5);
        yac.setBackground('#FFCDD2');
        yac.setNote('⚠️ BAZAGA YOZILMADI\n' +
                    'Sabab: ' + (zidQ[zq].sabab || 'ziddiyat') + '\n\n' +
                    'Bu qatorni siz tahrirlagunizcha bazada boshqa kimdir\n' +
                    'o\'zgartirgan. Sizning qiymatingiz SAQLANMADI.\n' +
                    'Varaqni qayta chizing va tahrirni takrorlang.');
      }
    }catch(e4){
      xatolar.push('Ziddiyatni varaqda belgilab bo\'lmadi: ' + ((e4 && e4.message) || e4));
    }

    return {ok:true, obyekt: obyekt, tekshirildi: tekshirildi, ozgardi: ozgardi,
            ziddiyat: ziddiyat, xatolar: xatolar, hisob: hisob,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2VaraqQaytar: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * AVTOMATIK SINXRONIZATSIYA (Sheets → baza, tugmasiz)
 * ══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «man sanga aytgandimku bu sheetsda o'zgartirsa avtomat
 * database da o'zgarishi kerak».
 *
 * To'g'ri — tugma bosishni talab qilish yarim yechim edi: odam unutadi
 * va ishi yo'qoladi.
 *
 * QANDAY ISHLAYDI:
 *   1) Varaqqa O'RNATILADIGAN onEdit tirgagi qo'yiladi. (Oddiy `onEdit`
 *      emas — u tashqi so'rov yubora olmaydi; o'rnatiladigani esa
 *      foydalanuvchi ruxsati bilan ishlaydi va UrlFetchApp ga kira oladi.)
 *   2) Har tahrirda darhol yozmaymiz: bir katakni o'zgartirish o'nlab
 *      formulani qayta hisoblaydi va odam ketma-ket bir necha katakni
 *      tuzatadi. Shuning uchun bayroq qo'yiladi va ~45 soniyalik
 *      BITTA kechiktirilgan tirgak rejalashtiriladi.
 *   3) O'sha tirgak to'liq solishtirishni bajaradi va o'zini o'chiradi.
 *
 * Ya'ni bir seriya tahrir — bitta yozish. Panelda tugma ham qoladi:
 * «hoziroq» kerak bo'lganda.
 */

var T2_SINX_KUTMOQDA = 'T2_SINX_KUTMOQDA';
var T2_SINX_KECHIKISH = 45 * 1000;

/* ══ SINX HALQASI HIMOYASI ══
 *
 * Reja 7.4: «Supabase → Sheets yozuvi user edit deb qayta qabul
 * qilinmasin».
 *
 * Muammo aniq: `apiT2VaraqYarat` varaqni qayta chizganda MINGLAB
 * katakni yozadi. Har yozish `onEdit` ni uyg'otadi, u sinxron
 * rejalashtiradi, sinxron esa varaqni o'qib bazaga solishtiradi —
 * bekorga. Qiymatlar bir xil bo'lgani uchun zarar yo'q, lekin
 * tirgak navbati va vaqt behuda ketadi.
 *
 * Yomonroq holat: chizish paytida qo'yilgan `_v` qiymatlari «yangi
 * tahrir» deb qabul qilinishi mumkin edi.
 *
 * Yechim: chizish davomida bayroq qo'yiladi va `onEdit` uni ko'rsa
 * chetlab o'tadi. Bayroq VAQT belgisi bilan — chizish yarim yo'lda
 * yiqilsa ham sinxron abadiy o'chib qolmasin. */
var T2_CHIZILMOQDA = 'T2_CHIZILMOQDA';
var T2_CHIZISH_UMRI = 10 * 60 * 1000;      // 10 daqiqadan keyin e'tiborsiz

function _t2ChizishBoshlandi(){
  try{ PropertiesService.getScriptProperties()
         .setProperty(T2_CHIZILMOQDA, String(Date.now())); }catch(e){}
}
function _t2ChizishTugadi(){
  try{ PropertiesService.getScriptProperties().deleteProperty(T2_CHIZILMOQDA); }catch(e){}
}
function _t2ChizilmoqdaMi(){
  try{
    var v = PropertiesService.getScriptProperties().getProperty(T2_CHIZILMOQDA);
    if(!v) return false;
    /* Eskirgan bayroq — chizish yiqilgan, e'tiborsiz qoldiramiz */
    if(Date.now() - Number(v) > T2_CHIZISH_UMRI){ _t2ChizishTugadi(); return false; }
    return true;
  }catch(e){ return false; }
}
/* Tizimning o'z yozuvi — undan kelib chiqqan onEdit e'tiborsiz qoladi */
var T2_TIZIM_YOZDI = 'T2_TIZIM_YOZDI';
var T2_TIZIM_OYNA  = 60 * 1000;

/** Varaq tahrirlanganda ishlaydi (o'rnatiladigan tirgak). */
function t2VaraqOnEdit(e){
  try{
    if(!e || !e.range) return;
    /* ⚡ Varaq HOZIR bazadan qayta chizilyapti — bu odam tahriri emas.
       Busiz har chizish minglab `onEdit` uyg'otib, sinxronni bekorga
       ishga tushirardi. */
    if(_t2ChizilmoqdaMi()) return;
    var sh = e.range.getSheet();
    if(sh.getName() !== 'СМЕТА') return;

    /* Faqat odam kiritadigan ustunlar: C ном, D бирлик, E норма, F ҳажм, G нарх.
       Hisob ustunlari (СУММА, kategoriya) formula — ular o'zi yangilanadi. */
    var u1 = e.range.getColumn(), u2 = u1 + e.range.getNumColumns() - 1;
    if(u2 < 3 || u1 > 7) return;

    var ssId = sh.getParent().getId();
    var p = PropertiesService.getScriptProperties();

    /* Tizimning O'Z yozuvidan kelgan hodisani o'tkazib yuboramiz —
       aks holda har chizishdan keyin bekorchi to'liq solishtiruv
       ishga tushardi (10 000 qator o'qish, natija: nol o'zgarish). */
    var belgi = p.getProperty(T2_TIZIM_YOZDI) || '';
    var bolak = belgi.split('|');
    if(bolak[0] === ssId && (Date.now() - Number(bolak[1] || 0)) < T2_TIZIM_OYNA) return;

    p.setProperty(T2_SINX_KUTMOQDA, ssId);
    _t2SinxRejalashtir();
  }catch(err){ Logger.log('t2VaraqOnEdit: ' + err); }
}

/** Kechiktirilgan sinxronni rejalashtiradi — BITTASIDAN ORTIQ EMAS. */
function _t2SinxRejalashtir(){
  try{
    var trg = ScriptApp.getProjectTriggers();
    for(var i = 0; i < trg.length; i++){
      /* Navbatda turgani bo'lsa yangisini yasamaymiz: har tugma bosishda
         tirgak yaratish limitni (20 ta) tez to'ldirib qo'yardi. */
      if(trg[i].getHandlerFunction() === 't2VaraqSinxFon') return;
    }
    ScriptApp.newTrigger('t2VaraqSinxFon').timeBased().after(T2_SINX_KECHIKISH).create();
  }catch(e){ Logger.log('_t2SinxRejalashtir: ' + e); }
}

/** Kechiktirilgan sinxron — o'zini o'chiradi. */
function t2VaraqSinxFon(){
  var p = PropertiesService.getScriptProperties();
  var ssId = p.getProperty(T2_SINX_KUTMOQDA);

  /* AVVAL o'zini tozalaydi: quyida xato chiqsa ham tirgak osilib
     qolmasin va keyingi tahrir yangisini yasay olsin. */
  try{
    var trg = ScriptApp.getProjectTriggers();
    for(var i = 0; i < trg.length; i++){
      if(trg[i].getHandlerFunction() === 't2VaraqSinxFon') ScriptApp.deleteTrigger(trg[i]);
    }
  }catch(e){}

  if(!ssId) return;
  p.deleteProperty(T2_SINX_KUTMOQDA);

  try{
    var qay = _t2Get('t2_kozgu?fayl_id=eq.' + encodeURIComponent(ssId) + '&select=obyekt_id');
    if(!qay.length){ Logger.log('t2VaraqSinxFon: varaq bazada qayd etilmagan'); return; }
    var ob = _t2Get('t2_obyekt?id=eq.' + qay[0].obyekt_id + '&select=nom');
    if(!ob.length){ Logger.log('t2VaraqSinxFon: obyekt topilmadi'); return; }

    var n = apiT2VaraqQaytar(ob[0].nom);
    Logger.log('T2 avto-sinx «' + ob[0].nom + '»: yozildi=' + (n && n.ozgardi) +
               ' ziddiyat=' + (n && n.ziddiyat ? n.ziddiyat.length : 0));
  }catch(e){ Logger.log('t2VaraqSinxFon: ' + e); }
}

/**
 * Varaqqa onEdit tirgagini o'rnatadi (bori bo'lsa tegmaydi).
 *
 * ⚠️ Apps Script da bitta skriptga 20 tadan ortiq tirgak qo'yib
 * bo'lmaydi. Chegaraga yaqinlashsak YANGISINI YASAMAYMIZ va buni
 * ochiq aytamiz — jim to'xtab qolgandan ko'ra, odam tugmani qo'lda
 * bosishini bilgani yaxshi.
 */
function _t2VaraqTirgakOrnat(ssId){
  try{
    var trg = ScriptApp.getProjectTriggers(), soni = 0;
    for(var i = 0; i < trg.length; i++){
      if(trg[i].getHandlerFunction() !== 't2VaraqOnEdit') continue;
      soni++;
      try{ if(trg[i].getTriggerSourceId() === ssId) return {ok:true, holat:'bor'}; }catch(e2){}
    }
    if(trg.length >= 18){
      return {ok:false, holat:'limit',
              xabar:'Tirgaklar chegarasi (' + trg.length + '/20). Avtomatik sinxron ' +
                    'o\'rnatilmadi — «Bazaga qaytarish» tugmasidan foydalaning.'};
    }
    ScriptApp.newTrigger('t2VaraqOnEdit').forSpreadsheet(ssId).onEdit().create();
    return {ok:true, holat:'ornatildi'};
  }catch(e){
    return {ok:false, holat:'xato', xabar: String((e && e.message) || e)};
  }
}

/**
 * Formula argument ajratgichini SINAB aniqlaydi (',' yoki ';').
 *
 * Hujjat tili o'nlik kasrni vergul bilan yozsa, funksiya argumentlari
 * nuqtali vergul bilan ajratiladi. Buni til nomidan taxmin qilish
 * ishonchsiz (bir necha o'nlab til varianti bor), shuning uchun
 * uzoqdagi bo'sh katakka sinov formulasi yozib, natijasiga qaraymiz.
 *
 * Xarajat — bitta `flush()`. Xato ajratgich esa BUTUN jadvalni
 * #ERROR! ga aylantiradi, ya'ni bu tekshiruv arziydi.
 */
function _t2Ajratgich(sh){
  var yac = null;
  try{
    yac = sh.getRange(1, 40);                    // ma'lumot zonasidan uzoq
    yac.setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    if(Number(yac.getValue()) === 3){ yac.clearContent(); return ','; }

    yac.setFormula('=SUM(1;2)');
    SpreadsheetApp.flush();
    if(Number(yac.getValue()) === 3){ yac.clearContent(); return ';'; }
  }catch(e){
    Logger.log('_t2Ajratgich: ' + e);
  }
  try{ if(yac) yac.clearContent(); }catch(e2){}
  return ',';                                     // ma'lum bo'lmasa — odatiy
}

/* ═══════════════════════════════════════════════════════════════════════
 * BAZA → KO'ZGU AVTO-YANGILANISH (2026-08-28)
 *
 * FOYDALANUVCHI XABARI: «f2 import qilib ko'rgan edim, lekin u faqat
 * bazaga kiritildi, ko'zgu sheetda yozilmadi — mani talabim yozilishi
 * kerak edi».
 *
 * SABAB — ko'prik BIR TOMONLAMA avtomat edi:
 *     Sheet -> baza :  t2VaraqOnEdit -> t2VaraqSinxFon    AVTOMAT
 *     baza -> Sheet :  apiT2VaraqYarat   faqat QO'LDA tugma bilan
 * Ya'ni Ф2 bazaga tushsa ham, varaq eski holicha qolardi.
 *
 * Endi baza tomonida t2_akt_qator ga yozilganda trigger
 * t2_kozgu.holat ni 'farqli' qilib qo'yadi (migratsiya
 * t2_akt_kozguni_eskirtiradi), bu funksiya esa shundaylarni topib
 * QAYTA CHIZADI. apiT2VaraqYarat oxirida holatni 'sinxron' ga
 * qaytaradi — demak keyingi yurishda u qayta ishlanmaydi.
 * ═══════════════════════════════════════════════════════════════════════ */

/** Bir yurishda nechta obyekt chiziladi — GAS 6 daqiqa chegarasi uchun. */
var T2_KOZGU_BIR_YURISH = 3;

/**
 * Eskirgan ('farqli') ko'zgularni topib qayta chizadi.
 * Vaqt tirgagidan ham, qo'lda ham chaqirilishi mumkin.
 */
function t2KozguYangila(){
  var boshlandi = Date.now();
  var natija = { korildi: 0, chizildi: 0, xato: 0, tafsilot: [] };

  try{
    var eskirgan = _t2Get('t2_kozgu?holat=eq.farqli&select=obyekt_id&limit=' + T2_KOZGU_BIR_YURISH);
    natija.korildi = eskirgan.length;
    if(!eskirgan.length) return natija;

    for(var i = 0; i < eskirgan.length; i++){
      /* 6 daqiqa chegarasi: 4 daqiqadan oshsa to'xtaymiz, qolgani
         keyingi yurishda chiziladi (holat 'farqli' bo'lib turaveradi). */
      if(Date.now() - boshlandi > 4 * 60 * 1000){
        natija.tafsilot.push('vaqt tugadi — qolgani keyingi yurishda');
        break;
      }
      try{
        var ob = _t2Get('t2_obyekt?id=eq.' + eskirgan[i].obyekt_id + '&select=nom');
        if(!ob.length){ natija.xato++; continue; }
        apiT2VaraqYarat(ob[0].nom);           // oxirida holat 'sinxron' bo'ladi
        natija.chizildi++;
        natija.tafsilot.push(ob[0].nom + ' — chizildi');
      }catch(e){
        natija.xato++;
        natija.tafsilot.push('xato: ' + ((e && e.message) || e));
      }
    }
  }catch(e){
    natija.xato++;
    natija.tafsilot.push('t2KozguYangila: ' + ((e && e.message) || e));
  }
  Logger.log('t2KozguYangila: ' + JSON.stringify(natija));
  return natija;
}

/** Saytdan chaqirish uchun (Tizim_02 panelidagi 'Ko'zguni yangilash'). */
function apiT2KozguYangila(){
  return t2KozguYangila();
}

/**
 * Har 5 daqiqada avtomat yurishni o'rnatadi. BIR MARTA chaqiriladi.
 * Tirgak chegarasi 20 ta — bori bo'lsa yangisini yasamaymiz.
 */
function t2KozguTriggerOrnat(){
  var trg = ScriptApp.getProjectTriggers();
  for(var i = 0; i < trg.length; i++){
    if(trg[i].getHandlerFunction() === 't2KozguYangila'){
      return { ok: true, xabar: 'Tirgak allaqachon bor' };
    }
  }
  if(trg.length >= 19){
    return { ok: false,
             xabar: 'Tirgaklar chegarasi (' + trg.length + '/20) — qolda yangilang' };
  }
  ScriptApp.newTrigger('t2KozguYangila').timeBased().everyMinutes(5).create();
  return { ok: true, xabar: 'Har 5 daqiqada kozgu yangilanadi' };
}

function t2KozguTriggerOchir(){
  var trg = ScriptApp.getProjectTriggers(), n = 0;
  for(var i = 0; i < trg.length; i++){
    if(trg[i].getHandlerFunction() === 't2KozguYangila'){
      ScriptApp.deleteTrigger(trg[i]); n++;
    }
  }
  return { ok: true, ochirildi: n };
}
