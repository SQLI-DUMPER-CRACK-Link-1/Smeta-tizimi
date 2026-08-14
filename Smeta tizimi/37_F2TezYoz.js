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
 * QATOR SURILISHIDAN HIMOYA: yozishdan oldin har nishon qatorning
 * HAQIQIY nomi/kodi tekshiriladi. Mos kelmasa — O'SHA QATOR YOZILMAYDI
 * va hisobotda ko'rsatiladi. Ya'ni noto'g'ri joyga yozib qo'yish
 * MUMKIN EMAS.
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

    /* ---- 3) Har qatorni TEKSHIRIB moslashtiramiz ---- */
    var yoziladi = [];      // {row, hajm, narx, summa}
    var radEtildi = [];     // nom/kod mos kelmagan qatorlar
    var minR = last+1, maxR = 0;

    for(var s=0; s<satrlar.length; s++){
      var it = satrlar[s] || {};
      var r = parseInt(it.row, 10) || 0;
      if(r < 1 || r > last){
        radEtildi.push({row:r, nom:it.nom, sabab:'қатор чегарадан ташқари'});
        continue;
      }
      var qKod = _tzKod(maydon[r-1][col.KOD-1]);
      var qNom = _tzNorm(maydon[r-1][col.NOM-1]);
      var bKod = _tzKod(it.kod), bNom = _tzNorm(it.nom);

      /* ⚡ QATOR SURILISHIDAN HIMOYA (foydalanuvchi talabi):
       * «100% mos kelgan smeta va f2 qatorlarida qiymatlar solishtirilishi
       *  kerak hech bo'lmaganda smetadagi nomi va f2 dagi nomi bilan».
       * Nom YOKI kod mos kelsa — yozamiz. Ikkalasi ham mos kelmasa —
       * bu boshqa qator, YOZMAYMIZ. */
      var nomMos = bNom && qNom && (bNom === qNom);
      var kodMos = bKod && qKod && (bKod === qKod);
      if(!nomMos && !kodMos){
        radEtildi.push({row:r, kutilgan:String(it.nom||'').slice(0,45),
                        topilgan:String(maydon[r-1][col.NOM-1]||'').slice(0,45),
                        sabab:'ном ҳам, код ҳам мос келмади (қатор сурилган?)'});
        continue;
      }

      var hajm = _tzNum(it.hajm), narx = _tzNum(it.narx);
      yoziladi.push({ row:r, hajm:hajm, narx:narx,
                      summa: Math.round(hajm*narx*10000)/10000 });
      if(r < minR) minR = r;
      if(r > maxR) maxR = r;
    }

    if(!yoziladi.length){
      return {ok:false, tekshirildi:satrlar.length, yozilgan:0,
              radEtilgan:radEtildi.length, radRoyxat:radEtildi.slice(0,30),
              msVaqt:Date.now()-t0,
              xabar:'Ҳеч бир қатор мос келмади — ёзилмади. Қаторлар сурилган бўлиши мумкин.'};
    }

    /* ---- 4) BITTA setValues bilan yozish ---- */
    if(!quruq){
      var balandlik = maxR - minR + 1;
      // Mavjud qiymatlarni olamiz (oraliqdagi tegilmaydigan qatorlar saqlansin)
      var blok = sh.getRange(minR, oyCol, balandlik, 3).getValues();
      for(var y=0; y<yoziladi.length; y++){
        var w = yoziladi[y];
        var idx = w.row - minR;
        blok[idx][0] = w.hajm;
        blok[idx][1] = w.narx;
        blok[idx][2] = w.summa;   // FORMULA emas — tayyor son
      }
      sh.getRange(minR, oyCol, balandlik, 3).setValues(blok);
      SpreadsheetApp.flush();
      try{ if(typeof _holatInvalidate==='function') _holatInvalidate(obyekt); }catch(e){}
    }

    var jamiSumma = 0;
    yoziladi.forEach(function(w){ jamiSumma += w.summa; });

    return {ok:true, quruq:!!quruq,
      varaq: varaqNom, oy: oyNom, oyUstun: oyCol, yangiUstun: yangiUstun,
      tekshirildi: satrlar.length,
      yozilgan: yoziladi.length,
      radEtilgan: radEtildi.length,
      radRoyxat: radEtildi.slice(0,30),
      jamiSumma: Math.round(jamiSumma*100)/100,
      msVaqt: Date.now()-t0,
      xabar: (quruq?'СИНОВ (ёзилмади): ':'✅ ')
           + yoziladi.length+' қатор'
           + (radEtildi.length ? (', '+radEtildi.length+' та РАД ЭТИЛДИ (ном/код мос эмас)') : '')
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
