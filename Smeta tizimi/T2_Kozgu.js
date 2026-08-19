/**
 * T2_Kozgu.js — TIZIM_02: BAZA → GOOGLE SHEETS KO'ZGUSI
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi so'zi bilan: «sheets esa ko'zgu bo'ladi — yani shu supabase
 * dagi ma'lumotdan kelib chiqib yasaladi, bu oddiy foydalanuvchi uchun
 * tushunarli hujjatga ega bo'lishi uchun yordam berishi kerak».
 *
 * YO'NALISH — DIQQAT: bu modul Sheets'dan O'QIMAYDI. U bazadagi ma'lumotdan
 * YANGI hujjat CHIZADI. Ya'ni Sheets endi haqiqat manbai emas, u — bazaning
 * inson o'qiy oladigan ko'rinishi.
 *
 * ⚠️ SHUNING UCHUN KO'ZGU FAYLI TAHRIR UCHUN EMAS. Unda qilingan o'zgarish
 * keyingi chizishda YO'QOLADI. Buni yashirish mumkin emas — shuning uchun
 * varaqning birinchi qatorida qizil ogohlantirish yoziladi va varaq
 * himoyalanadi. Teskari ko'prik (Sheets → baza) tayyor bo'lgach bu qoida
 * o'zgaradi; hozircha halol aytiladi.
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

    /* ── Sarlavha ── */
    var USTUNLAR = ['№', 'Код', 'Наименование', 'Ед.изм.', 'Кол-во', 'Цена', 'Сумма', 'Кат.'];
    var jadval = [];

    jadval.push(['⚠️ БУ ФАЙЛ — КЎЗГУ. Уни таҳрирламанг: кейинги чизишда ' +
                 'ўзгаришлар ЙЎҚОЛАДИ. Ҳақиқат манбаи — маълумотлар базаси.',
                 '', '', '', '', '', '', '']);
    jadval.push([obyekt, '', '', '', '', '', '', '']);
    jadval.push(['Чизилди: ' + Utilities.formatDate(new Date(), 'Asia/Tashkent', 'yyyy-MM-dd HH:mm'),
                 '', '', '', '', 'ЖАМИ:', jami, '']);
    jadval.push(toliq
      ? ['Барча қатор нархланган — жами ишончли.', '', '', '', '', '', '', '']
      : ['⚠️ ' + narxsiz + ' қаторда нарх топилмади — ЖАМИ ТЎЛИҚ ЭМАС. ' +
         'Бу рақам устида молиявий қарор қабул қилманг.', '', '', '', '', '', '', '']);
    jadval.push(['', '', '', '', '', '', '', '']);
    jadval.push(USTUNLAR);

    var SARLAVHA_QATOR = jadval.length;          // ma'lumot shundan keyin

    /* ── Ma'lumot qatorlari ── */
    var uslub = [];                              // {qator, tur, chuqur}
    for(i = 0; i < qatorlar.length; i++){
      var r = qatorlar[i];
      var d = chuqurlik(r);
      var nom = new Array(d + 1).join('    ') + (r.nom || '');

      jadval.push([
        (r.tur === 'rs' || r.tur === 'bl' || r.tur === 'mat' || r.tur === 'ob')
          ? (r.xom_qator || '') : '',
        r.kod || '',
        nom,
        r.birlik || '',
        r.hajm === null ? '' : Number(r.hajm),
        /* ⚠️ Narx topilmagan bo'lsa 0 YOZILMAYDI — «нарх йўқ» deb yoziladi.
           0 yozilsa hujjat «bepul» deb ko'rsatardi va bu yolg'on bo'lardi. */
        r.narx === null ? (r.tur === 'rz' || r.tur === 'bl' ? '' : 'нарх йўқ') : Number(r.narx),
        r.summa === null ? '' : Number(r.summa),
        r.kat || ''
      ]);
      uslub.push({qator: jadval.length, tur: r.tur, narxsiz: (r.narx === null)});
    }

    /* ── BITTA yozish ── */
    sh.getRange(1, 1, jadval.length, USTUNLAR.length).setValues(jadval);

    /* ── Bezash (ommaviy, qatorma-qator emas) ── */
    sh.getRange(1, 1, 1, USTUNLAR.length).merge()
      .setBackground('#FFF3CD').setFontColor('#8A6D3B').setFontWeight('bold').setWrap(true);
    sh.getRange(2, 1, 1, USTUNLAR.length).merge().setFontSize(13).setFontWeight('bold');
    sh.getRange(4, 1, 1, USTUNLAR.length).merge()
      .setFontColor(toliq ? '#2E7D32' : '#C62828').setWrap(true);
    sh.getRange(3, 6, 1, 2).setFontWeight('bold');
    sh.getRange(SARLAVHA_QATOR, 1, 1, USTUNLAR.length)
      .setBackground('#37474F').setFontColor('#FFFFFF').setFontWeight('bold');

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
      sh.getRange(SARLAVHA_QATOR + 1, 5, qatorlar.length, 1).setNumberFormat('#,##0.###');
      sh.getRange(SARLAVHA_QATOR + 1, 6, qatorlar.length, 2).setNumberFormat('#,##0.00');
    }
    sh.getRange(3, 7).setNumberFormat('#,##0.00');
    sh.setColumnWidth(1, 55);  sh.setColumnWidth(2, 90);
    sh.setColumnWidth(3, 460); sh.setColumnWidth(4, 70);
    sh.setColumnWidth(5, 85);  sh.setColumnWidth(6, 105);
    sh.setColumnWidth(7, 125); sh.setColumnWidth(8, 60);
    sh.setFrozenRows(SARLAVHA_QATOR);

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
