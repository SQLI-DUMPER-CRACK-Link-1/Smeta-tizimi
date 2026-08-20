/**
 * T2_Kozgu.js — TIZIM_02: BAZA → GOOGLE SHEETS KO'ZGUSI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi so'zi bilan: «sheets esa ko'zgu bo'ladi — yani shu supabase
 * dagi ma'lumotdan kelib chiqib yasaladi, bu oddiy foydalanuvchi uchun
 * tushunarli hujjatga ega bo'lishi uchun yordam berishi kerak».
 *
 * YO'NALISH — IKKI TOMONLAMA (2026-08-20 dan):
 *
 *   apiT2KozguYarat  — baza → Sheets. Bazadagi ma'lumotdan LRV_PLUS
 *                      shaklidagi hujjat chizadi.
 *   apiT2KozguQaytar — Sheets → baza. Odam tahrirlagan NОМ/БИРЛИК/
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
function apiT2KozguYarat(obyekt){
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
    for(i = 0; i < qatorlar.length; i++) xarita[qatorlar[i].id] = qatorlar[i];
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
    var faylNomi = obyekt + ' — TIZIM_02 ko\'zgu';
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

    var sh = ss.getSheets()[0];
    sh.clear();
    try{ sh.clearConditionalFormatRules(); }catch(e){}
    sh.setName('СМЕТА');

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
    var USTUNLAR = ['№', 'КОД', 'НАИМЕНОВАНИЕ', 'ЕД.ИЗМ.',
                    'ХАЖМ (ед)', 'ХАЖМ (жами)', 'НАРХ (1 ед)', 'СУММА', 'ТИП',
                    'ЧЕЛ', 'МАШ', 'МАТ', 'ОБ',
                    '_id', '_v'];
    var NU = USTUNLAR.length;
    var KO_RINADI = 13;                      // 14–15 yashirin
    var C_NORMA = 5, C_HAJM = 6, C_NARX = 7, C_SUMMA = 8, C_KAT1 = 10;
    var C_ID = 14, C_VER = 15;
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
    q1[0] = '✏️ ТАҲРИР ҚИЛСА БЎЛАДИ: НОМ, БИРЛИК, ХАЖМ (жами), НАРХ. ' +
            'Ўзгартиргач панелдаги «Ўзгаришларни базага қайтариш» тугмасини босинг — ' +
            'акс ҳолда кейинги чизишда йўқолади. Бошқа устунлар ҳисобдан келади.';
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

    /* ── Ma'lumot qatorlari ── */
    var uslub = [];                              // {qator, tur, narxsiz}
    for(i = 0; i < qatorlar.length; i++){
      var r = qatorlar[i];
      var d = chuqurlik(r);
      var nom = new Array(d + 1).join('    ') + (r.nom || '');
      var resursmi = (r.tur === 'rs' || r.tur === 'mat' || r.tur === 'ob');
      var summa = (r.summa === null || r.summa === undefined) ? null : Number(r.summa);

      var qator = bosh();
      /* № — smetaning ASL raqami (1, 1.1, 1.2, 2 …). Bu odam izlaydigan
         belgi; oddiy sanoq uning o'rnini bosa olmaydi. */
      qator[0] = r.raqam || '';
      qator[1] = r.kod || '';
      qator[2] = nom;
      qator[3] = r.birlik || '';
      /* НОРМА faqat resursda bo'ladi: blokda 5-ustun uning o'z hajmi */
      qator[C_NORMA - 1] = (r.norma === null || r.norma === undefined) ? '' : Number(r.norma);
      qator[C_HAJM - 1]  = (r.hajm  === null || r.hajm  === undefined) ? '' : Number(r.hajm);
      /* ⚠️ Narx topilmagan bo'lsa 0 YOZILMAYDI — «нарх йўқ» deb yoziladi.
         0 yozilsa hujjat «bepul» deb ko'rsatardi va bu yolg'on bo'lardi. */
      qator[C_NARX - 1] = (r.narx === null || r.narx === undefined)
        ? ((r.tur === 'rz' || r.tur === 'bl') ? '' : 'нарх йўқ') : Number(r.narx);
      qator[C_SUMMA - 1] = summa === null ? '' : summa;
      qator[8] = r.tur || '';

      /* ── KATEGORIYA USTUNLARI ──
         Накрутка har kategoriya bo'yicha alohida hisoblanadi, shuning
         uchun summa o'z ustuniga ham tushadi. Faqat RESURS qatorlari:
         blok/razdel summasi bolalarining yig'indisi — uni ham qo'shsak
         ikki marta sanalardi. */
      if(resursmi && summa !== null){
        if(r.kat === 'ЧЕЛ')      qator[C_KAT1 - 1] = summa;
        else if(r.kat === 'МАШ') qator[C_KAT1]     = summa;
        else if(r.kat === 'ОБ')  qator[C_KAT1 + 2] = summa;
        else                     qator[C_KAT1 + 1] = summa;   // МАТ — qolgani
      }

      qator[C_ID - 1]  = r.id;
      qator[C_VER - 1] = (r.versiya == null) ? '' : r.versiya;

      jadval.push(qator);
      uslub.push({qator: jadval.length, tur: r.tur, narxsiz: (r.narx === null && resursmi)});
    }

    /* ── BITTA yozish ── */
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

    /* ⚠️ Himoya: ko'zgu tasodifan tahrirlanmasin. Ogohlantirish yetarli
       emas — odam baribir yozadi va keyin ishi yo'qolganini ko'radi. */
    try{
      var himoya = sh.protect().setDescription(
        'TIZIM_02 ko\'zgusi — bazadan chiziladi, qo\'lda tahrir yo\'qoladi');
      himoya.removeEditors(himoya.getEditors());
      himoya.setWarningOnly(true);
    }catch(e){}

    /* ── Bazaga qayd ── */
    var barmoq = String(qatorlar.length) + ':' + String(Math.round(jami)) + ':' + String(narxsiz);
    _t2Post('t2_kozgu', [{
      obyekt_id: ob.id, fayl_id: ss.getId(),
      oxirgi_yozish: new Date().toISOString(),
      qator_soni: qatorlar.length, barmoq_izi: barmoq,
      holat: 'sinxron', xato: null
    }], false, 'obyekt_id');

    /* Ko'prik navbati yopiladi — bu o'zgarishlar endi ko'zguda bor */
    _t2KopriknavbatYop(ob.id);

    return {
      ok: true, obyekt: obyekt, fayl_id: ss.getId(), url: ss.getUrl(),
      qator: qatorlar.length, jami: jami, toliq: toliq, narxsiz: narxsiz,
      ms: Date.now() - t0
    };

  }catch(e){
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
    natija.bosqichlar.kozgu = apiT2KozguYarat(obyekt);
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
function apiT2KozguQaytar(obyekt){
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
    var qiy = sh.getRange(sarlavha + 1, 1, soni, 15).getValues();

    /* Bazadagi holat — bitta o'qish, qatorma-qator so'rov EMAS */
    var bazadagi = {}, hammasi = _t2QatorlarOl(ob.id);
    for(var h = 0; h < hammasi.length; h++) bazadagi[hammasi[h].id] = hammasi[h];

    var MAYDON = [
      {ust: 3,  nom: 'nom',    matn: true},
      {ust: 4,  nom: 'birlik', matn: true},
      {ust: 6,  nom: 'hajm',   matn: false},
      {ust: 7,  nom: 'narx',   matn: false}
    ];

    var ozgardi = 0, ziddiyat = [], xatolar = [], tekshirildi = 0;

    for(var i = 0; i < qiy.length; i++){
      var id = Number(qiy[i][13]);                 // 14-ustun: _id
      if(!id) continue;                             // xizmat/bo'sh qator
      var baza = bazadagi[id];
      if(!baza) continue;                           // bazadan o'chgan
      tekshirildi++;

      var kutilganV = qiy[i][14];                   // 15-ustun: _v
      kutilganV = (kutilganV === '' || kutilganV == null) ? null : Number(kutilganV);

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

    /* O'zgarish bo'lsa hisob eskiradi */
    var hisob = null;
    if(ozgardi){
      try{ hisob = apiT2Ishla(obyekt); }catch(e3){
        xatolar.push('Qayta hisob yiqildi: ' + ((e3 && e3.message) || e3));
      }
    }

    return {ok:true, obyekt: obyekt, tekshirildi: tekshirildi, ozgardi: ozgardi,
            ziddiyat: ziddiyat, xatolar: xatolar, hisob: hisob,
            ms: Date.now() - t0};

  }catch(e){
    return {ok:false, xabar:'apiT2KozguQaytar: ' + ((e && e.message) || e),
            ms: Date.now() - t0};
  }
}
