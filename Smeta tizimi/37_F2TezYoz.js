/********************************************************************
 * 37_F2TezYoz.js — Ф2 ni smetaga TEZ va SODDA yozish
 * ==================================================================
 * ⚡⚡⚡ 2026-08-14 QAYTA LOYIHALASH (foydalanuvchi haq edi):
 *
 *   «shunchaki qoida aniq. F2 dan obyom narx summani olib smetadagi
 *    belgilangan joyga qo'yib berishi kerak. agar smetada qator
 *    bo'lmasa mos ravishda qo'shishi kerak xolos.»
 *
 * ESKI YO'L NEGA YIQILARDI (o'lchov bilan):
 *   apiOyQosh    → 3 ustun ochadi, keyin BARCHA qatorga va BARCHA
 *                  eski oyga formula to'ldiradi, so'ng butun varaqni
 *                  qayta yozadi  → 19-28 soniya BITTA smetaga
 *   apiF2Qolla   → 120 talik bo'laklarda apiHolatSaqla chaqiradi,
 *                  har bo'lakda varaq qayta o'qiladi/yoziladi
 *   Natija: 97 qator uchun ham 6 daqiqa limitiga urilardi.
 *
 * YANGI YO'L — 97 qator uchun kerak bo'lgan ish:
 *   97 qator × 3 katak = 291 katak. Bu BITTA setValues chaqiruvi.
 *
 *   1) Varaqni BIR MARTA o'qiymiz (kod+nom+marker ustunlari)
 *   2) Oy ustunlari bor-yo'qligini tekshiramiz; yo'q bo'lsa 3 ta
 *      ustun QO'SHAMIZ (formula to'ldirilmaydi!)
 *   3) Har F2 qatorini nishon qator bilan solishtiramiz (NOM+KOD)
 *   4) Hammasini BITTA setValues bilan yozamiz
 *   5) Summa = hajm × narx — JS da hisoblanadi, FORMULA yozilmaydi
 *
 * FORMULA YOZILMAYDI — ataylab. Sabab: formula qator raqamiga
 * bog'lanadi va qo'lda qator o'chirilsa BUZILADI (foydalanuvchining
 * LRV'sida aynan shu bo'ldi: СУММА ustunida 10 715 681 turardi,
 * to'g'risi 102 585 edi — 104 barobar xato).
 *
 * TEKSHIRUV YO'Q: foydalanuvchi panelda 100% qo'lda bog'laydi.
 * BOG'LANGAN HAR BIR QATOR YOZILADI — bittasi ham qoldirilmaydi.
 ********************************************************************/

/** Nom/kodni solishtirish uchun normallashtirish */
function _tzNorm(s){
  return String(s==null?'':s).toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/g,'');
}
function _tzKod(s){
  return _tzNorm(s).replace(/^0+/,'');
}
function _tzNum(v){
  if(v===null||v===undefined||v==='') return 0;
  if(typeof v==='number') return isFinite(v)?v:0;
  var n=parseFloat(String(v).replace(/[\s ']/g,'').replace(',','.'));
  return isFinite(n)?n:0;
}

/** Varaqdagi oy ustunlarini topadi: [{nom, col}] (col = ОБЪЁМ ustuni) */
function _tzOylarniTop(sh, hdrQator){
  var lastC = sh.getLastColumn();
  if(lastC < CFG.C.F2_BIRINCHI) return [];
  var hdr = sh.getRange(hdrQator, 1, 1, lastC).getValues()[0];
  var out = [];
  for(var c = CFG.C.F2_BIRINCHI-1; c < lastC; c++){
    var t = String(hdr[c]||'').trim();
    if(!t) continue;
    // "₊нарх" / "₊сумма" — bular yordamchi ustunlar, oy nomi EMAS
    if(/₊|\+\s*(нарх|сумма)/i.test(t)) continue;
    out.push({ nom: t, col: c+1 });
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════
 * ASOSIY: Ф2 qatorlarini smetaga yozish
 * ==================================================================
 * @param {string} obyekt   sub-obyekt (AYNAN bitta smeta!)
 * @param {string} varaqNom LRV varaq nomi
 * @param {string} oyNom    oy ustuni nomi
 * @param {Array}  satrlar  [{row, nom, kod, hajm, narx}]
 * @param {boolean} quruq   true — YOZMAYDI, faqat tekshiradi (sinov)
 * @return {Object} hisobot
 * ══════════════════════════════════════════════════════════════════ */
function apiF2TezYoz(obyekt, varaqNom, oyNom, satrlar, quruq){
  var t0 = Date.now();
  try{
    satrlar = satrlar || [];
    if(!satrlar.length) return {ok:false, xabar:'Ёзиш учун қатор берилмади'};
    oyNom = String(oyNom||'').trim();
    if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};

    var plus = _plusTop(obyekt);
    if(!plus) return {ok:false, xabar:'LRV_PLUS топилмади: '+obyekt+' — аввал [Ишла] қилинг'};
    var sh = plus.getSheetByName(varaqNom);
    if(!sh) return {ok:false, xabar:'Варақ топилмади: '+varaqNom};

    var col = CFG.C;
    var last = sh.getLastRow();
    if(last < 2) return {ok:false, xabar:'Варақ бўш'};

    /* ---- 1) BIR MARTA o'qish: kod + nom + marker ---- */
    var enKeng = Math.max(col.KOD, col.NOM, col.MARKER);
    var maydon = sh.getRange(1, 1, last, enKeng).getValues();
    var hdrQator = (typeof _hdrRow==='function') ? _hdrRow(sh) : 1;

    /* ---- 2) Oy ustunini topamiz yoki QO'SHAMIZ (formulasiz) ---- */
    var oylar = _tzOylarniTop(sh, hdrQator);
    var oyKey = (typeof _oyKey==='function') ? _oyKey(oyNom) : _tzNorm(oyNom);
    var oyCol = 0;
    for(var i=0;i<oylar.length;i++){
      var k = (typeof _oyKey==='function') ? _oyKey(oylar[i].nom) : _tzNorm(oylar[i].nom);
      if(k === oyKey){ oyCol = oylar[i].col; break; }
    }
    var yangiUstun = false;
    if(!oyCol){
      if(quruq){
        oyCol = sh.getLastColumn() + 1;   // quruq rejimda yaratmaymiz
      } else {
        var boshla = sh.getLastColumn() + 1;
        sh.insertColumnsAfter(sh.getLastColumn(), 3);
        sh.getRange(hdrQator, boshla, 1, 3)
          .setValues([[oyNom, oyNom+' ₊нарх', oyNom+' ₊сумма']])
          .setFontWeight('bold');
        oyCol = boshla;
        yangiUstun = true;
      }
    }

    /* ---- 3) Har qatorni tayyorlaymiz ----
     * ⚡⚡⚡ 2026-08-14: NOM/KOD TEKSHIRUVI BUTUNLAY OLIB TASHLANDI.
     * Foydalanuvchi panelda 100% qo'lda bog'laydi va bog'lanishlariga
     * ishonadi. Tekshiruv HAQIQIY bog'lanishlarni rad etib ish qoldirardi:
     * «F2 va smetada kiritilmay qolinishi keyingi ishlarni pachava qiladi —
     *  ko'p yoki kam obyom olinib bir ikkitasi qamalib ketishi hech gap emas».
     * QOIDA: BOG'LANGAN HAR BIR QATOR YOZILADI. Bittasi ham qoldirilmaydi.
     *
     * Eski (to'g'ri ishlagan)  semantikasi AYNAN saqlanadi:
     *   obyom — DOIM yoziladi
     *   narx  — faqat >0 bo'lsa (aks holda smeta narx formulasi tegilmaydi)
     *   summa — F2 hujjatdagi AYNAN summa, !=0 bo'lsa (manfiy ham — перерасчёт).
     *           Berilmasa hajm×narx bilan hisoblanadi.
     *   uid   — katakka izoh (note) — kelib chiqishini kuzatish uchun */
    var yoziladi = [];
    var xatolar  = [];
    var minR = last+1, maxR = 0;

    for(var s=0; s<satrlar.length; s++){
      var it = satrlar[s] || {};
      var r = parseInt(it.row, 10) || 0;
      if(r < 1 || r > last){
        xatolar.push({row:r, nom:String(it.nom||'').slice(0,45),
                      sabab:'қатор варақ чегарасидан ташқари (1-'+last+')'});
        continue;
      }
      var hajm = _tzNum(it.hajm);
      var narx = _tzNum(it.narx);
      var summa = _tzNum(it.summa);
      if(!summa) summa = Math.round(hajm*narx*10000)/10000;

      yoziladi.push({ row:r, hajm:hajm, narx:narx, summa:summa, uid:it.uid||'' });
      if(r < minR) minR = r;
      if(r > maxR) maxR = r;
    }

    if(!yoziladi.length){
      return {ok:false, tekshirildi:satrlar.length, yozilgan:0,
              radEtilgan:xatolar.length, radRoyxat:xatolar.slice(0,30),
              msVaqt:Date.now()-t0,
              xabar:'Ёзиладиган қатор топилмади'};
    }

    /* ---- 4) BITTA setValues bilan yozish ---- */
    if(!quruq){
      var balandlik = maxR - minR + 1;
      var rng  = sh.getRange(minR, oyCol, balandlik, 3);
      var blok = rng.getValues();
      var izoh = rng.getNotes();
      for(var y=0; y<yoziladi.length; y++){
        var w = yoziladi[y], idx = w.row - minR;
        blok[idx][0] = w.hajm;                          // obyom — DOIM
        if(w.narx > 0)  blok[idx][1] = w.narx;          // narx — faqat >0
        if(w.summa !== 0) blok[idx][2] = w.summa;       // summa — !=0 (manfiy ham)
        if(w.uid) izoh[idx][0] = 'f2uid:' + w.uid;
      }
      rng.setValues(blok);
      try{ rng.setNotes(izoh); }catch(e){}
      SpreadsheetApp.flush();
      try{ if(typeof _holatInvalidate==='function') _holatInvalidate(obyekt); }catch(e){}
    }

    var jamiSumma = 0;
    yoziladi.forEach(function(w){ jamiSumma += w.summa; });

    return {ok:true, quruq:!!quruq,
      varaq: varaqNom, oy: oyNom, oyUstun: oyCol, yangiUstun: yangiUstun,
      tekshirildi: satrlar.length,
      yozilgan: yoziladi.length,
      radEtilgan: xatolar.length,
      radRoyxat: xatolar.slice(0,30),
      jamiSumma: Math.round(jamiSumma*100)/100,
      msVaqt: Date.now()-t0,
      xabar: (quruq?'СИНОВ (ёзилмади): ':'✅ ')
           + yoziladi.length+' қатор'
           + (xatolar.length ? (', '+xatolar.length+' та қатор ёзилмади (қатор чегарадан ташқари)') : '')
           + ' · '+Math.round((Date.now()-t0)/100)/10+' сония'};
  }catch(e){
    return {ok:false, xabar:'Тез ёзиш хатоси: '+String((e&&e.message)||e),
            stack:String((e&&e.stack)||'').slice(0,500)};
  }
}

/** QURUQ SINOV — hech narsa yozmaydi, faqat nechta qator mos kelishini aytadi.
 *  Katta F2 dan OLDIN shuni chaqiring: qator surilgan bo'lsa darhol ko'rinadi. */
function apiF2TezSinov(obyekt, varaqNom, oyNom, satrlar){
  return apiF2TezYoz(obyekt, varaqNom, oyNom, satrlar, true);
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiF2TezYoz = apiF2TezYoz;
  globalThis.apiF2TezSinov = apiF2TezSinov;
}

/* ══════════════════════════════════════════════════════════════════
 * TO'LIQ YOZISH: mos qatorlar (TEZ) + qo'shimcha/zamena (qator qo'shish)
 * ==================================================================
 * ⚡ 2026-08-14: nega ikki xil yo'l kerak —
 *   MOS QATORLAR  — smetada qator BOR, faqat 3 katakka qiymat yoziladi.
 *                   Minglab bo'lsa ham BITTA setValues. Tez.
 *   QO'SHIMCHA/ZAMENA — smetaga YANGI QATOR qo'shiladi. Har qo'shishda
 *                   qator raqamlari suriladi, shuning uchun bittalab
 *                   bajarilishi SHART (guruhlab bo'lmaydi).
 * Tartib MUHIM: avval mos qatorlar (joriy raqamlar bo'yicha), keyin
 * qo'shimchalar (ular raqamlarni suradi).
 *
 * Qo'shimcha mantiqi ATAYLAB qayta yozilmadi — u ancha nozik (rz+/bl+/rs+,
 * zamena, uid-dedup, перерасчёт manfiy hajm). Mavjud, sinovdan o'tgan
 * `apiF2Qolla` chaqiriladi, LEKIN faqat dopps bilan (edits bo'sh) va
 * oy ustuni allaqachon tayyor deb belgilanadi.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2YozTola(obyekt, varaqNom, oyNom, satrlar, dopps, quruq){
  var t0 = Date.now();
  try{
    satrlar = satrlar || []; dopps = dopps || [];

    /* --- 1-BOSQICH: mos qatorlar (tez) --- */
    var tez = {yozilgan:0, radEtilgan:0, radRoyxat:[], msVaqt:0, jamiSumma:0};
    if(satrlar.length){
      tez = apiF2TezYoz(obyekt, varaqNom, oyNom, satrlar, quruq);
      if(!tez.ok && !tez.yozilgan){
        /* ⚡ 2026-08-14: bu yerda `mos` qaytarilmasdi → chaqiruvchi
         * hisoblagichi bo'sh qolib UI «0 мос, 0 рад» ko'rsatardi, holbuki
         * 97 ta qator RAD ETILGAN edi. Endi sonlar ham qaytariladi. */
        return {ok:false, bosqich:'mos qatorlar', xabar: tez.xabar,
                mos: {yozilgan:0, radEtilgan: tez.radEtilgan||0,
                      radRoyxat: tez.radRoyxat||[], jamiSumma:0},
                radRoyxat: tez.radRoyxat || []};
      }
    }

    /* --- 2-BOSQICH: qo'shimcha / zamena --- */
    var dopNatija = null;
    if(dopps.length && !quruq){
      if(typeof apiF2Qolla !== 'function'){
        return {ok:false, xabar:'apiF2Qolla топилмади — қўшимча қаторлар ёзилмади'};
      }
      /* oyTayyor:true — oy ustuni 1-bosqichda yaratilgan, qayta yaratilmasin
       * (aynan shu qayta yaratish 26 smetaga tarqalib o'lim siklini bergandi) */
      dopNatija = apiF2Qolla(obyekt, oyNom, [], dopps, 0,
                             {oyTayyor:true, editStart:0, dopStart:0});
    }

    var ms = Date.now()-t0;
    return {ok:true, quruq:!!quruq,
      mos: {yozilgan: tez.yozilgan||0, radEtilgan: tez.radEtilgan||0,
            radRoyxat: tez.radRoyxat||[], jamiSumma: tez.jamiSumma||0},
      qoshimcha: dopNatija ? {ok:dopNatija.ok, xabar:dopNatija.xabar,
                              davomEtadi: !!dopNatija.resume} : null,
      msVaqt: ms,
      xabar: (quruq?'СИНОВ: ':'✅ ')
        + (tez.yozilgan||0)+' мос қатор'
        + (tez.radEtilgan ? (', '+tez.radEtilgan+' РАД ЭТИЛДИ') : '')
        + (dopps.length ? (', '+dopps.length+' қўшимча/замена') : '')
        + ' · '+Math.round(ms/100)/10+' сония'
        + (dopNatija && dopNatija.resume ? ' (қўшимчалар навбатда давом этади)' : '')};
  }catch(e){
    return {ok:false, xabar:'Тўлиқ ёзиш хатоси: '+String((e&&e.message)||e),
            stack:String((e&&e.stack)||'').slice(0,500)};
  }
}

/** Frontend uchun kirish nuqtasi — eski `apiF2QollaNavbatga` o'rniga.
 *  edits[] ichida `varaq` "sub||LRV" ko'rinishida keladi — ajratamiz. */
function apiF2YozTez2(obyekt, oyNom, edits, dopps, aktJami, quruq){
  try{
    edits = edits || []; dopps = dopps || [];
    if(!edits.length && !dopps.length) return {ok:false, xabar:'Ёзиш учун маълумот йўқ'};

    /* ⚡ 2026-08-15 MUHR TEKSHIRUVI (39_F2Reestr.js).
     * Tekshirilgan va topshirilgan oy tasodifan qayta yozilmasin.
     * Quruq sinovga ruxsat — u hech narsa o'zgartirmaydi. */
    if(!quruq && typeof _f2rMuhrTekshir === 'function'){
      var _m = _f2rMuhrTekshir(obyekt, oyNom);
      if(_m.muhrlangan) return {ok:false, muhr:true,
        xabar:'«'+oyNom+'» МУҲРЛАНГАН — қайта ёзиш тақиқланган. '+
              'Аввал муҳрни очинг (Ф2 тарихи → муҳр белгиси).'};
    }

    /* varaq bo'yicha guruhlash: har smeta/varaq alohida yoziladi */
    var guruh = {};
    edits.forEach(function(e){
      var v = String(e.varaq||'');
      var sub = obyekt, varaqNom = v;
      if(v.indexOf('||') >= 0){ sub = v.split('||')[0]; varaqNom = v.split('||')[1]; }
      var kalit = sub + '||' + varaqNom;
      if(!guruh[kalit]) guruh[kalit] = {sub:sub, varaq:varaqNom, satrlar:[]};
      /* ⚡ 2026-08-14 BUG TUZATILDI: bu yerda smetaNom/smetaKod UZATILMASDAN
       * qolgandi → himoya ishlamasdi (jonli sinov: qator 1 ga surilgan
       * holatda ham 97/97 «mos» deb qabul qilinardi — xavfli). */
      guruh[kalit].satrlar.push({row:e.row, uid:e.uid,
                                 hajm:e.hajm, narx:e.narx, summa:e.summa});
    });

    var kalitlar = Object.keys(guruh);
    if(!kalitlar.length && dopps.length){
      // faqat qo'shimchalar bo'lsa — to'g'ridan-to'g'ri eski yo'lga
      return apiF2YozTola(obyekt, '', oyNom, [], dopps, quruq);
    }

    var natijalar = [], jamiYoz = 0, jamiRad = 0, barchaRad = [];
    for(var i=0;i<kalitlar.length;i++){
      var g = guruh[kalitlar[i]];
      // Qo'shimchalarni FAQAT oxirgi guruhda bir marta bajaramiz
      var d = (i === kalitlar.length-1) ? dopps : [];
      var r = apiF2YozTola(g.sub, g.varaq, oyNom, g.satrlar, d, quruq);
      natijalar.push({smeta:g.sub, varaq:g.varaq, natija:r});
      if(r.mos){ jamiYoz += r.mos.yozilgan||0; jamiRad += r.mos.radEtilgan||0;
                 barchaRad = barchaRad.concat(r.mos.radRoyxat||[]); }
    }

    /* ⚡⚡⚡ 2026-08-15 F2 REESTRGA YOZISH (39_F2Reestr.js).
     * Foydalanuvchi: «171 mlrd kiritsam, 171 mlrd smetada turishi kerak».
     * Ilgari yozuvchi ishini bajarib TARQAB KETARDI — qaysi hujjat, qancha
     * edi, qancha tushdi degan yozuv qolmasdi. Solishtirish uchun ikkinchi
     * tomon yo'q edi. Endi har yozuv daftarga tushadi va farq ko'rinadi.
     *
     * `aktJami` — F2 hujjatining O'Z jami (frontend uzatadi).
     * `yozilganSum` — biz smetaga yozgan summalar yig'indisi.
     * Ikkalasi teng bo'lishi kerak; teng bo'lmasa reestr «ҚИСМАН» deydi. */
    var yozilganSum = 0;
    for(var e2=0; e2<edits.length; e2++){
      var s2 = _tzNum(edits[e2].summa);
      if(!s2) s2 = _tzNum(edits[e2].hajm) * _tzNum(edits[e2].narx);
      yozilganSum += s2;
    }

    var reestr = null;
    if(!quruq){
      try{
        if(typeof apiF2ReestrYoz === 'function'){
          reestr = apiF2ReestrYoz({
            obyekt: obyekt, oy: oyNom,
            hujjatJami: (aktJami === undefined || aktJami === null || aktJami === '')
                          ? '' : aktJami,        // noma'lum bo'lsa BO'SH — taxmin yo'q
            yozilganJami: yozilganSum,
            qatorJami: edits.length + dopps.length,
            qatorYozildi: jamiYoz,
            varaqlar: kalitlar,
            izoh: dopps.length ? (dopps.length+' та қўшимча') : ''
          });
        }
      }catch(e){ reestr = {ok:false, xabar:String((e&&e.message)||e)}; }
    }

    return {ok:true, quruq:!!quruq, smetalar:kalitlar.length,
      yozilgan:jamiYoz, radEtilgan:jamiRad, radRoyxat:barchaRad.slice(0,40),
      tafsilot:natijalar,
      /* nazorat raqamlari — panel shularni ko'rsatadi */
      yozilganSumma: yozilganSum,
      hujjatJami: (aktJami===undefined||aktJami===null||aktJami==='') ? null : Number(aktJami)||0,
      farq: (aktJami===undefined||aktJami===null||aktJami==='')
              ? null : (Number(aktJami)||0) - yozilganSum,
      reestr: reestr,
      xabar:(quruq?'СИНОВ: ':'✅ ')+jamiYoz+' қатор ёзилди'
        + (jamiRad?(', '+jamiRad+' РАД ЭТИЛДИ (ном/код мос эмас)'):'')
        + ' · '+kalitlar.length+' сметада'};
  }catch(e){
    return {ok:false, xabar:'Хато: '+String((e&&e.message)||e)};
  }
}

/** QURUQ sinov — hech narsa yozmaydi */
function apiF2YozTezSinov2(obyekt, oyNom, edits, dopps, aktJami){
  return apiF2YozTez2(obyekt, oyNom, edits, dopps, aktJami, true);
}

if (typeof globalThis !== 'undefined') {
  globalThis.apiF2YozTola = apiF2YozTola;
  globalThis.apiF2YozTez2 = apiF2YozTez2;
  globalThis.apiF2YozTezSinov2 = apiF2YozTezSinov2;
}
