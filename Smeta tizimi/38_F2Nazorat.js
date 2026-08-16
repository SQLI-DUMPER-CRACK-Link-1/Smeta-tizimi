/**
 * 38_F2Nazorat.js — F2 NAZORAT VA HAQIQAT MANBAI
 * ═══════════════════════════════════════════════════════════════════
 *
 * NIMA UCHUN BU FAYL BOR (2026-08-15):
 * Foydalanuvchi: «f2 importda sentyabrni qanchaligini ko'rmoqchi bo'lsam ham
 * f2 oylari uchun summalari 0 turibdi... tugagan yoki yo'qligini ham
 * bilmayman... manga aniqlik kerak».
 *
 * ┌─ TASHXIS ────────────────────────────────────────────────────────┐
 * │ Paneldagi «0.00 so'm» — MA'LUMOT YO'QLIGI EMAS, KO'RSATISH BUGI. │
 * │                                                                  │
 * │ LRV_PLUS da har oy UCHTA ustun bilan saqlanadi:                  │
 * │     [oy nomi] │ [oy ₊нарх] │ [oy ₊сумма]                         │
 * │        col    │   col+1    │    col+2                            │
 * │                                                                  │
 * │ Daraxt quruvchi (30_Panel.js:1059) faqat IKKITASINI o'qiydi:     │
 * │     oyVal[nom] = {obyom: g[i][col-1], narx: g[i][col]}           │
 * │ ...ya'ni СУММА ustuni (g[i][col+1]) HECH QACHON o'qilmaydi.      │
 * │                                                                  │
 * │ Ustiga-ustak `oylar` maydoni faqat `bl` (blok) tugunlarga        │
 * │ qo'shiladi — `rs` (resurs) tugunlarda umuman yo'q. Frontend esa  │
 * │ BARGLAR bo'yicha yig'adi, barglar esa aynan `rs`.                │
 * │                                                                  │
 * │ Va nihoyat frontend `Number(oylar[oy])` qiladi — bu OBYEKT,      │
 * │ Number({obyom,narx}) = NaN → 0.                                  │
 * │                                                                  │
 * │ Ya'ni bu ko'rsatkich HAR QANDAY holatda 0 chiqadi. U sentyabr    │
 * │ yozilgan-yozilmaganligi haqida HECH NARSA demaydi.               │
 * └──────────────────────────────────────────────────────────────────┘
 *
 * BU FAYL NIMA QILADI:
 * LRV_PLUS varaqlaridan СУММА ustunini TO'G'RIDAN-TO'G'RI o'qib, har oy
 * uchun haqiqiy jamini qaytaradi. Taxmin yo'q, ko'paytirish yo'q —
 * qog'ozda nima yozilgan bo'lsa, o'sha.
 *
 * MUHIM: marker turi bo'yicha ajratib beradi (rz/bl/rs/mat/ob). Chunki
 * F2 ham `bl` (ish) qatoriga, ham uning ostidagi `rs` (resurs) qatoriga
 * yozilgan bo'lsa — ularni qo'shib yuborish IKKI BARAVAR sanash bo'ladi.
 * Shuning uchun jamlanmani men o'zim «to'g'ri» deb e'lon qilmayman,
 * balki qatlamlab ko'rsataman va qaysi biri asos ekani ko'rinib turadi.
 */

/* ══ Yordamchilar ══════════════════════════════════════════════════ */

function _nzNum(v){
  if(v === null || v === undefined || v === '') return 0;
  if(typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v).replace(/ /g,' ').replace(/\s/g,'').replace(',', '.');
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/* Marker qatoridan asosiy turni ajratadi: 'rz+' → 'rz', 'bl~' → 'bl' */
function _nzMk(v){
  var s = String(v||'').trim().toLowerCase();
  if(!s) return '';
  return s.replace(/[+~]+$/, '');
}

/* Obyekt + uning barcha sub-obyektlari ro'yxati */
function _nzObyektlar(obyekt){
  var out = [obyekt];
  try{
    var subs = (typeof _subObyektlar === 'function') ? (_subObyektlar(obyekt) || []) : [];
    for(var i=0;i<subs.length;i++) if(out.indexOf(subs[i])<0) out.push(subs[i]);
  }catch(e){}
  return out;
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2Nazorat(obyekt) — ASOSIY HISOBOT
 *
 * Qaytaradi:
 *  {ok, obyekt, vaqt,
 *   oylar:[ {nom, summa, qatorlar, obyom,
 *            qatlam:{bl:{summa,qatorlar}, rs:{...}, mat:{...}, ...},
 *            varaqlar:[{sub, varaq, summa, qatorlar}] } ],
 *   jamiSumma, varaqSoni, ogohlantirish:[...] }
 * ══════════════════════════════════════════════════════════════════ */
function apiF2Nazorat(obyekt){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};

    var col   = CFG.C;
    var obs   = _nzObyektlar(obyekt);
    var oyMap = {};          // oyNom → yig'indi
    var varaqSoni = 0, ochilmagan = [], ogoh = [];

    for(var oi=0; oi<obs.length; oi++){
      var ob = obs[oi], plus = null;
      try{ plus = _plusTop(ob); }catch(e){}
      if(!plus){ ochilmagan.push(ob); continue; }

      var shlar = plus.getSheets();
      for(var si=0; si<shlar.length; si++){
        var sh = shlar[si];
        var nomV = sh.getName();
        if(nomV.charAt(0) === '_') continue;            // xizmat varaqlari

        var last = sh.getLastRow(), lastC = sh.getLastColumn();
        if(last < 2 || lastC < col.F2_BIRINCHI) continue;

        var oylar = [];
        try{ oylar = _f2Oylar(sh) || []; }catch(e){ continue; }
        if(!oylar.length) continue;
        varaqSoni++;

        var hr = 1;
        try{ hr = _hdrRow(sh); }catch(e){}
        var bosh = hr + 1;
        if(bosh > last) continue;
        var qSoni = last - bosh + 1;

        /* Markerlar — bir marta o'qiladi */
        var mkUst = sh.getRange(bosh, col.MARKER, qSoni, 1).getValues();

        /* Oy bloki — F2_BIRINCHI dan oxirigacha BITTA o'qish */
        var blok = sh.getRange(bosh, col.F2_BIRINCHI, qSoni, lastC - col.F2_BIRINCHI + 1).getValues();

        for(var k=0; k<oylar.length; k++){
          var oyNom = oylar[k].nom;
          /* blok ichidagi nisbiy indeks: oy ustuni - F2_BIRINCHI */
          var iOb = oylar[k].col - col.F2_BIRINCHI;   // ОБЪЁМ
          var iSu = iOb + 2;                          // СУММА
          if(iSu >= blok[0].length) {
            ogoh.push(nomV + ' / ' + oyNom + ': СУММА устуни йўқ (эски 1-устунли формат?)');
            iSu = -1;
          }

          if(!oyMap[oyNom]) oyMap[oyNom] = {
            nom:oyNom, summa:0, obyom:0, qatorlar:0, qatlam:{}, varaqlar:[]
          };
          var O = oyMap[oyNom];
          var vSum = 0, vQat = 0, vObyom = 0;

          for(var r=0; r<qSoni; r++){
            var ob_ = _nzNum(blok[r][iOb]);
            var su_ = (iSu >= 0) ? _nzNum(blok[r][iSu]) : 0;
            if(!ob_ && !su_) continue;                 // bu qatorda F2 yo'q

            var mk = _nzMk(mkUst[r][0]);
            if(!O.qatlam[mk||'?']) O.qatlam[mk||'?'] = {summa:0, qatorlar:0, obyom:0};
            O.qatlam[mk||'?'].summa   += su_;
            O.qatlam[mk||'?'].obyom   += ob_;
            O.qatlam[mk||'?'].qatorlar++;

            vSum += su_; vObyom += ob_; vQat++;
          }

          if(vQat){
            O.summa += vSum; O.obyom += vObyom; O.qatorlar += vQat;
            O.varaqlar.push({sub:ob, varaq:nomV, summa:vSum, qatorlar:vQat});
          }
        }
      }
    }

    /* Natijani massivga aylantirish */
    var oyArr = [], jami = 0;
    for(var kk in oyMap){
      var o = oyMap[kk];
      /* ⚠ IKKI BARAVAR SANASH ogohlantirishi: agar ham bl, ham rs qatlamida
       * summa bo'lsa — bu ikkalasi bir xil ishni ifodalayotgan bo'lishi mumkin */
      var qatlamlar = Object.keys(o.qatlam);
      var pul = [];
      for(var q=0;q<qatlamlar.length;q++)
        if(o.qatlam[qatlamlar[q]].summa) pul.push(qatlamlar[q]);
      o.pulliQatlamlar = pul;
      if(pul.length > 1) o.ikkiBaravarXavfi = true;

      oyArr.push(o);
      jami += o.summa;
    }
    oyArr.sort(function(a,b){ return b.summa - a.summa; });

    return {ok:true, obyekt:obyekt, oylar:oyArr, jamiSumma:jami,
            varaqSoni:varaqSoni, obyektlar:obs, ochilmagan:ochilmagan,
            ogohlantirish:ogoh, vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};

  }catch(e){
    return {ok:false, xabar:'apiF2Nazorat: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2PriamoyZatrat(obyekt, oyNom) — «ПРЯМЫЕ ЗАТРАТЫ» HISOBI
 *
 * Foydalanuvchi javobi (2026-08-15), «hujjat jamisi qayerdan olinadi?»:
 *   «uni rs mat ob qatorlarini chel-chas, mash-chas, resurs,
 *    oborudovaniya kabi yonda ajratiladigan ustunlaridan yig'ilishi kerak»
 *
 * Ya'ni bitta «Всего» katagi QIDIRILMAYDI. Jami QATORLAB yig'iladi:
 * faqat `rs`/`mat`/`ob` qatorlari olinadi (ish `bl` qatorlari EMAS —
 * ular resurslarning yig'indisi bo'lgani uchun ikki baravar sanaladi),
 * har biri o'z kategoriyasiga qo'shiladi:
 *
 *     ЧЕЛ + МАШ + МАТ + ОБ + М/К + КАБ  =  ПРЯМЫЕ ЗАТРАТЫ
 *
 * Kategoriya aniqlash mantig'i daraxt quruvchidagi bilan AYNAN bir xil
 * (30_Panel.js `rkat`) — ikki joyda ikki xil bo'lib qolmasligi uchun.
 * ЧЕЛ/МАШ faqat o'z ustunidan aniqlanadi, qolgani МАТ ga tushadi.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2PriamoyZatrat(obyekt, oyNom){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};
    oyNom = String(oyNom||'').trim();
    if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};

    var col = CFG.C, obs = _nzObyektlar(obyekt);
    var oyK = (typeof _oyKey==='function') ? _oyKey(oyNom) : oyNom.toLowerCase();

    var kat = {'ЧЕЛ':0, 'МАШ':0, 'МАТ':0, 'ОБ':0, 'М/К':0, 'КАБ':0};
    var qatorlar = 0, blOtkazildi = 0, jami = 0, varaqlar = [];

    for(var oi=0; oi<obs.length; oi++){
      var ob = obs[oi], plus = null;
      try{ plus = _plusTop(ob); }catch(e){}
      if(!plus) continue;

      var shlar = plus.getSheets();
      for(var si=0; si<shlar.length; si++){
        var sh = shlar[si];
        if(sh.getName().charAt(0) === '_') continue;

        var oylar = [];
        try{ oylar = _f2Oylar(sh) || []; }catch(e){ continue; }
        var oyCol = 0;
        for(var k=0;k<oylar.length;k++){
          var kk = (typeof _oyKey==='function') ? _oyKey(oylar[k].nom) : String(oylar[k].nom).toLowerCase();
          if(kk === oyK){ oyCol = oylar[k].col; break; }
        }
        if(!oyCol) continue;

        var last = sh.getLastRow();
        var hr = 1; try{ hr = _hdrRow(sh); }catch(e){}
        var bosh = hr + 1;
        if(bosh > last) continue;
        var qSoni = last - bosh + 1;

        var enKeng = Math.max(col.MARKER, col.CHEL, col.MASH, col.OB, col.MK, col.KAB);
        var chap = sh.getRange(bosh, 1, qSoni, enKeng).getValues();
        var oyD  = sh.getRange(bosh, oyCol, qSoni, 3).getValues();

        var vJami = 0, vQator = 0;
        for(var r=0; r<qSoni; r++){
          var summa = _nzNum(oyD[r][2]);
          var hajm  = _nzNum(oyD[r][0]);
          if(!summa && !hajm) continue;

          var mk = _nzMk(chap[r][col.MARKER-1]);
          /* ИШ (bl) qatorlari ATAYLAB o'tkazib yuboriladi — ular
           * resurslarning yig'indisi, qo'shilsa ikki baravar bo'ladi */
          if(mk === 'bl'){ blOtkazildi++; continue; }
          if(mk !== 'rs' && mk !== 'mat' && mk !== 'ob') continue;

          /* kategoriya — 30_Panel.js `rkat` bilan bir xil tartib */
          var k2 = 'МАТ';
          if(_nzNum(chap[r][col.CHEL-1])>0)      k2='ЧЕЛ';
          else if(_nzNum(chap[r][col.MASH-1])>0) k2='МАШ';
          else if(_nzNum(chap[r][col.OB-1])>0)   k2='ОБ';
          else if(_nzNum(chap[r][col.MK-1])>0)   k2='М/К';
          else if(_nzNum(chap[r][col.KAB-1])>0)  k2='КАБ';

          kat[k2] += summa; jami += summa;
          qatorlar++; vJami += summa; vQator++;
        }
        if(vQator) varaqlar.push({sub:ob, varaq:sh.getName(), summa:vJami, qatorlar:vQator});
      }
    }

    return {ok:true, obyekt:obyekt, oyNom:oyNom,
            priamoyZatrat: jami,
            kategoriyalar: kat,
            qatorlar: qatorlar,
            blOtkazildi: blOtkazildi,
            varaqlar: varaqlar,
            izoh: 'ЧЕЛ+МАШ+МАТ+ОБ+М/К+КАБ, faqat rs/mat/ob qatorlari. '+
                  'ИШ (bl) qatorlari qo\'shilmadi ('+blOtkazildi+' ta) — '+
                  'ular resurslarning yig\'indisi.',
            vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};
  }catch(e){
    return {ok:false, xabar:'apiF2PriamoyZatrat: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2QatlamTahlil(obyekt) — «bl mi, rs mi?» SAVOLIGA MA'LUMOTDAN JAVOB
 *
 * MUAMMO: F2 ham `bl` (ish) qatoriga, ham uning ostidagi `rs` (resurs)
 * qatorlariga yozilgan bo'lsa — ularni qo'shib yuborish PULNI IKKI BARAVAR
 * sanaydi va «171 mlrd = 171 mlrd» tekshiruvi buziladi.
 *
 * Bu funksiya foydalanuvchidan SO'RAMAYDI — o'zi aniqlaydi. LRV_PLUS
 * ketma-ket o'qiladi: `bl` qatori guruh boshlaydi, keyingi `rs` qatorlar
 * uning bolalari. Har oy uchun solishtiradi:
 *     blOzi  = bl qatorining O'Z summasi
 *     rsBola = uning bolalari summalari yig'indisi
 *
 * XULOSA:
 *   • faqat blOzi bor          → asos = 'bl'   (jami = blOzi)
 *   • faqat rsBola bor         → asos = 'rs'   (jami = rsBola)
 *   • ikkalasi bor va TENG     → TAKROR! (rs — bl ning yoyilmasi)
 *                                jami = blOzi (bir marta sanaladi)
 *   • ikkalasi bor, teng emas  → ARALASH — qo'lda ko'rish kerak,
 *                                hech narsa taxmin qilinmaydi
 * ══════════════════════════════════════════════════════════════════ */
function apiF2QatlamTahlil(obyekt){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};
    var col = CFG.C, obs = _nzObyektlar(obyekt), oyMap = {};

    for(var oi=0; oi<obs.length; oi++){
      var ob = obs[oi], plus = null;
      try{ plus = _plusTop(ob); }catch(e){}
      if(!plus) continue;

      var shlar = plus.getSheets();
      for(var si=0; si<shlar.length; si++){
        var sh = shlar[si];
        if(sh.getName().charAt(0) === '_') continue;

        var last = sh.getLastRow(), lastC = sh.getLastColumn();
        if(last < 2 || lastC < col.F2_BIRINCHI) continue;
        var oylar = [];
        try{ oylar = _f2Oylar(sh) || []; }catch(e){ continue; }
        if(!oylar.length) continue;

        var hr = 1; try{ hr = _hdrRow(sh); }catch(e){}
        var bosh = hr + 1;
        if(bosh > last) continue;
        var qSoni = last - bosh + 1;

        var mkUst = sh.getRange(bosh, col.MARKER, qSoni, 1).getValues();
        var blok  = sh.getRange(bosh, col.F2_BIRINCHI, qSoni, lastC - col.F2_BIRINCHI + 1).getValues();

        for(var k=0; k<oylar.length; k++){
          var oyNom = oylar[k].nom;
          var iSu = oylar[k].col - col.F2_BIRINCHI + 2;   // СУММА
          if(iSu >= blok[0].length) continue;

          if(!oyMap[oyNom]) oyMap[oyNom] = {
            nom:oyNom, blOzi:0, rsBola:0, rsYetim:0,
            blSoni:0, rsSoni:0, guruhTakror:0, guruhAjrim:0
          };
          var O = oyMap[oyNom];

          /* Ketma-ket yurish: bl guruh ochadi, rs unga qo'shiladi */
          var joriyBl = null;   // {ozi:, bola:}
          var yopish = function(){
            if(!joriyBl) return;
            if(joriyBl.ozi && joriyBl.bola){
              /* ikkalasida ham pul — teng bo'lsa TAKROR */
              var farq = Math.abs(joriyBl.ozi - joriyBl.bola);
              if(farq <= Math.max(1, Math.abs(joriyBl.ozi)*0.001)) O.guruhTakror++;
              else O.guruhAjrim++;
            }
            joriyBl = null;
          };

          for(var r=0; r<qSoni; r++){
            var mk = _nzMk(mkUst[r][0]);
            var su = _nzNum(blok[r][iSu]);

            if(mk === 'bl'){
              yopish();
              joriyBl = {ozi:su, bola:0};
              if(su){ O.blOzi += su; O.blSoni++; }
            }
            else if(mk === 'rs' || mk === 'mat' || mk === 'ob'){
              if(su){
                O.rsSoni++;
                if(joriyBl){ joriyBl.bola += su; O.rsBola += su; }
                else       { O.rsYetim += su; }   // otasiz resurs
              }
            }
            else if(mk === 'rz'){ yopish(); }
          }
          yopish();
        }
      }
    }

    /* Xulosa chiqarish */
    var oyArr = [], jamiTogri = 0, aralashBor = false, takrorBor = false;
    for(var kk in oyMap){
      var o = oyMap[kk], asos, jami, izoh;

      if(o.blOzi && !o.rsBola && !o.rsYetim){
        asos = 'bl'; jami = o.blOzi;
        izoh = 'F2 faqat ИШ (bl) qatorlariga yozilgan — ikki baravar sanash xavfi yo\'q';
      } else if(!o.blOzi && (o.rsBola || o.rsYetim)){
        asos = 'rs'; jami = o.rsBola + o.rsYetim;
        izoh = 'F2 faqat RESURS qatorlariga yozilgan — ikki baravar sanash xavfi yo\'q';
      } else if(o.blOzi && o.guruhTakror && !o.guruhAjrim){
        asos = 'bl'; jami = o.blOzi + o.rsYetim; takrorBor = true;
        izoh = 'ИШ va uning RESURSlari BIR XIL summani ko\'rsatmoqda (' + o.guruhTakror +
               ' guruh) — resurslar ishning yoyilmasi. Jami BIR MARTA sanaldi (bl bo\'yicha).';
      } else if(o.blOzi && (o.rsBola || o.rsYetim)){
        asos = 'aralash'; jami = null; aralashBor = true;
        izoh = 'ARALASH: ' + o.guruhTakror + ' guruh takror, ' + o.guruhAjrim +
               ' guruh farqli. Avtomatik jam chiqarilmaydi — «Qatorlar» oynasida ko\'ring.';
      } else {
        asos = 'yoq'; jami = 0;
        izoh = 'Bu oyga summa yozilmagan';
      }

      o.asos = asos; o.jamiTogri = jami; o.izoh = izoh;
      if(jami !== null) jamiTogri += jami;
      oyArr.push(o);
    }
    oyArr.sort(function(a,b){ return (b.jamiTogri||0) - (a.jamiTogri||0); });

    return {ok:true, obyekt:obyekt, oylar:oyArr,
            /* IKKI BARAVAR SANAMAYDIGAN jami */
            jamiTogri: aralashBor ? null : jamiTogri,
            takrorBor: takrorBor, aralashBor: aralashBor,
            ishonchli: !aralashBor,
            xulosa: aralashBor
              ? 'Ba\'zi oylarda ИШ va RESURS summalari mos kelmadi — avtomatik jam chiqarilmadi.'
              : (takrorBor
                  ? 'Resurslar ishning yoyilmasi ekan — jami BIR MARTA sanaldi.'
                  : 'Ikki baravar sanash xavfi topilmadi.'),
            vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};
  }catch(e){
    return {ok:false, xabar:'apiF2QatlamTahlil: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2OyTafsilot(obyekt, oyNom) — BITTA OY, HAR BIR QATOR
 *
 * «har bir qatorni har qanaqasiga boshqara olishimiz kerak» —
 * bu shuning ma'lumot manbai: oyda yozilgan HAR BIR qator, o'z
 * manzili (sub/varaq/row), qiymatlari va qaysi F2 dan kelgani
 * (f2uid izohi) bilan.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2OyTafsilot(obyekt, oyNom){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};
    oyNom = String(oyNom||'').trim();
    if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};

    var col = CFG.C;
    var obs = _nzObyektlar(obyekt);
    var oyK = (typeof _oyKey === 'function') ? _oyKey(oyNom) : oyNom.toLowerCase();
    var qatorlar = [], jamiSum = 0, uidlar = {};

    for(var oi=0; oi<obs.length; oi++){
      var ob = obs[oi], plus = null;
      try{ plus = _plusTop(ob); }catch(e){}
      if(!plus) continue;

      var shlar = plus.getSheets();
      for(var si=0; si<shlar.length; si++){
        var sh = shlar[si], nomV = sh.getName();
        if(nomV.charAt(0) === '_') continue;

        var oylar = [];
        try{ oylar = _f2Oylar(sh) || []; }catch(e){ continue; }
        var oyCol = 0;
        for(var k=0;k<oylar.length;k++){
          var kk = (typeof _oyKey==='function') ? _oyKey(oylar[k].nom) : String(oylar[k].nom).toLowerCase();
          if(kk === oyK){ oyCol = oylar[k].col; break; }
        }
        if(!oyCol) continue;

        var last = sh.getLastRow();
        var hr = 1; try{ hr = _hdrRow(sh); }catch(e){}
        var bosh = hr + 1;
        if(bosh > last) continue;
        var qSoni = last - bosh + 1;

        var enKeng = Math.max(col.KOD, col.NOM, col.BIRLIK, col.MARKER, col.NARX, col.E);
        var chap = sh.getRange(bosh, 1, qSoni, enKeng).getValues();
        var oyRng = sh.getRange(bosh, oyCol, qSoni, 3);
        var oyD   = oyRng.getValues();
        var oyN   = oyRng.getNotes();          // f2uid izohlari

        for(var r=0; r<qSoni; r++){
          var hajm  = _nzNum(oyD[r][0]);
          var narx  = _nzNum(oyD[r][1]);
          var summa = _nzNum(oyD[r][2]);
          if(!hajm && !summa) continue;

          var izoh = String(oyN[r][0]||'');
          var uid  = '';
          var m = izoh.match(/f2uid:\s*([^\s\n]+)/);
          if(m) uid = m[1];
          if(uid) uidlar[uid] = (uidlar[uid]||0) + 1;

          jamiSum += summa;
          qatorlar.push({
            sub:      ob,
            varaq:    nomV,
            row:      bosh + r,
            marker:   _nzMk(chap[r][col.MARKER-1]),
            kod:      String(chap[r][col.KOD-1]||'').trim(),
            nom:      String(chap[r][col.NOM-1]||'').trim(),
            birlik:   String(chap[r][col.BIRLIK-1]||'').trim(),
            smetaHajm:_nzNum(chap[r][col.E-1]),
            smetaNarx:_nzNum(chap[r][col.NARX-1]),
            hajm:hajm, narx:narx, summa:summa,
            uid:uid,
            /* nazorat: summa hajm×narx ga mos keladimi? */
            nomuvofiq: (hajm && narx && Math.abs(summa - hajm*narx) > Math.max(1, Math.abs(summa)*0.001))
          });
        }
      }
    }

    qatorlar.sort(function(a,b){
      if(a.varaq !== b.varaq) return a.varaq < b.varaq ? -1 : 1;
      return a.row - b.row;
    });

    return {ok:true, obyekt:obyekt, oyNom:oyNom, qatorlar:qatorlar,
            soni:qatorlar.length, jamiSumma:jamiSum,
            uidSoni:Object.keys(uidlar).length,
            nomuvofiqSoni:qatorlar.filter(function(q){return q.nomuvofiq;}).length,
            vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};

  }catch(e){
    return {ok:false, xabar:'apiF2OyTafsilot: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2QatorTahrir(obyekt, oyNom, ozgarishlar)
 *
 * «agar xato bog'langan yoki boshqacha bo'lsa o'sha joyni o'zidagi
 *  o'zgarish lrv plusda ham shu o'zgarishni bera olishi kerak»
 *
 * ozgarishlar: [{sub, varaq, row, hajm, narx, summa, ochir:true?}]
 * Nuqtali tahrir — butun oyni qayta yozmasdan, faqat ko'rsatilgan
 * qatorlarni yangilaydi. `ochir:true` — qatorni bo'shatadi.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2QatorTahrir(obyekt, oyNom, ozgarishlar){
  var t0 = Date.now();
  try{
    ozgarishlar = ozgarishlar || [];
    if(!ozgarishlar.length) return {ok:false, xabar:'Ўзгариш берилмади'};
    oyNom = String(oyNom||'').trim();
    if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};

    /* ⚡ 2026-08-15 MUHR TEKSHIRUVI — muhrlangan oy tahrirlanmaydi */
    if(typeof _f2rMuhrTekshir === 'function'){
      var _m = _f2rMuhrTekshir(obyekt, oyNom);
      if(_m.muhrlangan) return {ok:false, muhr:true,
        xabar:'«'+oyNom+'» МУҲРЛАНГАН — таҳрирлаш тақиқланган. Аввал муҳрни очинг.'};
    }

    var oyK = (typeof _oyKey === 'function') ? _oyKey(oyNom) : oyNom.toLowerCase();

    /* sub+varaq bo'yicha guruhlash — har varaq bir marta ochiladi */
    var guruh = {};
    ozgarishlar.forEach(function(o){
      var sub = o.sub || obyekt, v = o.varaq || '';
      var kalit = sub + '||' + v;
      if(!guruh[kalit]) guruh[kalit] = {sub:sub, varaq:v, lar:[]};
      guruh[kalit].lar.push(o);
    });

    var yozildi = 0, ochirildi = 0, xatolar = [];

    Object.keys(guruh).forEach(function(kalit){
      var g = guruh[kalit];
      try{
        var plus = _plusTop(g.sub);
        if(!plus){ xatolar.push(g.sub+': LRV_PLUS топилмади'); return; }
        var sh = plus.getSheetByName(g.varaq);
        if(!sh){ xatolar.push(g.varaq+': варақ топилмади'); return; }

        var oylar = _f2Oylar(sh) || [], oyCol = 0;
        for(var k=0;k<oylar.length;k++){
          var kk = (typeof _oyKey==='function') ? _oyKey(oylar[k].nom) : String(oylar[k].nom).toLowerCase();
          if(kk === oyK){ oyCol = oylar[k].col; break; }
        }
        if(!oyCol){ xatolar.push(g.varaq+': «'+oyNom+'» устуни топилмади'); return; }

        /* qamrov: eng kichik va eng katta qator */
        var minR = 1e9, maxR = 0;
        g.lar.forEach(function(o){
          var r = Number(o.row)||0;
          if(r < minR) minR = r;
          if(r > maxR) maxR = r;
        });
        if(!maxR){ xatolar.push(g.varaq+': қатор рақами йўқ'); return; }

        var bal = maxR - minR + 1;
        var rng = sh.getRange(minR, oyCol, bal, 3);
        var blok = rng.getValues();

        g.lar.forEach(function(o){
          var idx = (Number(o.row)||0) - minR;
          if(idx < 0 || idx >= bal) return;
          if(o.ochir){
            blok[idx][0] = ''; blok[idx][1] = ''; blok[idx][2] = '';
            ochirildi++;
          } else {
            var h = _nzNum(o.hajm), n = _nzNum(o.narx), s = _nzNum(o.summa);
            if(!s) s = Math.round(h*n*10000)/10000;
            blok[idx][0] = h;
            if(n > 0) blok[idx][1] = n;
            blok[idx][2] = s;
            yozildi++;
          }
        });

        rng.setValues(blok);
      }catch(e){
        xatolar.push(kalit+': '+(e && e.message ? e.message : e));
      }
    });

    try{ SpreadsheetApp.flush(); }catch(e){}

    return {ok:(yozildi+ochirildi)>0, yozildi:yozildi, ochirildi:ochirildi,
            xatolar:xatolar, vaqt:((Date.now()-t0)/1000).toFixed(1)+'s',
            xabar: yozildi+' қатор янгиланди, '+ochirildi+' қатор тозаланди'
                   + (xatolar.length ? ' ('+xatolar.length+' хато)' : '')};

  }catch(e){
    return {ok:false, xabar:'apiF2QatorTahrir: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2Bosliqlar(obyekt, oyNom, hujjatJami) — YO'QOLGAN PULNI TOPADI
 *
 * Jonli holat (2026-08-15, Sentyabr-2025):
 *     F2 hujjatda (итог):  8 151 662 266.27
 *     Smetada:             7 931 314 902.06
 *     YETISHMAYAPTI:         220 347 364.21   (900 qator yozilgan)
 *
 * Foydalanuvchidan «uchta raqamni solishtiring» deb SO'RAMAYMIZ —
 * tizim o'zi qidiradi. Bu funksiya pul yo'qoladigan HAR BIR
 * naqshni alohida sanaydi va aybdor qatorlarni ro'yxat qilib beradi:
 *
 *   A) HAJM BOR, PUL YO'Q  — eng ehtimolli sabab. Yozuvchi narxni
 *      faqat `narx > 0` bo'lganda yozadi; F2 da narx bo'sh bo'lsa
 *      summa 0 bo'lib qoladi va qator "yozilgan" ko'rinadi, lekin
 *      pul olib kelmaydi.
 *   B) SUMMA ≠ HAJM × NARX — qiymat buzilgan yoki qo'lda o'zgargan
 *   C) HAJM YO'Q, PUL BOR   — teskari nomuvofiqlik
 *   D) NOL QATORLAR         — bog'langan, lekin ikkalasi ham bo'sh
 *
 * `hujjatJami` berilsa — yetishmayotgan summa ham hisoblanadi va
 * yuqoridagi naqshlar uni QOPLAYDIMI degan savolga javob beradi.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2Bosliqlar(obyekt, oyNom, hujjatJami){
  var t0 = Date.now();
  try{
    var t = apiF2OyTafsilot(obyekt, oyNom);
    if(!t.ok) return t;

    var A = [], B = [], C = [], D = [];
    var aPul = 0, bPul = 0, cPul = 0;
    var yozilgan = 0;

    for(var i=0;i<t.qatorlar.length;i++){
      var q = t.qatorlar[i];
      var h = _nzNum(q.hajm), n = _nzNum(q.narx), s = _nzNum(q.summa);
      yozilgan += s;

      /* A — hajm bor, pul yo'q. Yo'qolgan pulni SMETA narxi bilan
       * baholaymiz (q.smetaNarx) — bu TAXMIN, shuning uchun alohida
       * maydonda qaytariladi va jamiga qo'shilmaydi. */
      /* ⚠ MUHIM (2026-08-15, foydalanuvchi ko'rsatmasi):
       * «bazi resurslar o'zi narxlanmagan bo'ladi, ularga ham narx
       *  qo'yib mani qamatib yubormasin»
       * Ya'ni narxsiz qator — HAR DOIM XATO EMAS. Bu ko'pincha
       * NORMAL holat: F2 da o'sha resurs narxlanmagan.
       * Shuning uchun quyidagi `smetaNarx` bo'yicha baho — FAQAT
       * «agar narxlanganda shuncha bo'lardi» degan MA'LUMOT.
       * U hech qayerga avtomatik YOZILMAYDI va yetishmayotgan pulni
       * «izohlangan» deb hisoblashga ham qo'shilmaydi. Qaror —
       * foydalanuvchiniki. */
      if(h && !s){
        var taxminiy = h * _nzNum(q.smetaNarx);
        aPul += taxminiy;
        if(A.length < 60) A.push({varaq:q.varaq, row:q.row, kod:q.kod,
          nom:q.nom, hajm:h, narx:n, smetaNarx:q.smetaNarx,
          agarNarxlansa:taxminiy, marker:q.marker});
        continue;
      }
      /* B — summa hajm×narx ga mos emas */
      if(h && n && s){
        var kutilgan = h * n;
        if(Math.abs(s - kutilgan) > Math.max(1, Math.abs(kutilgan)*0.001)){
          bPul += (kutilgan - s);
          if(B.length < 60) B.push({varaq:q.varaq, row:q.row, kod:q.kod,
            nom:q.nom, hajm:h, narx:n, summa:s, kutilgan:kutilgan,
            farq:kutilgan - s, marker:q.marker});
        }
        continue;
      }
      /* C — hajm yo'q, pul bor */
      if(!h && s){
        cPul += s;
        if(C.length < 60) C.push({varaq:q.varaq, row:q.row, kod:q.kod,
          nom:q.nom, summa:s, marker:q.marker});
        continue;
      }
      /* D — ikkalasi ham bo'sh (bu yerga kelmasligi kerak) */
      if(!h && !s && D.length < 30) D.push({varaq:q.varaq, row:q.row, nom:q.nom});
    }

    var hj = (hujjatJami === undefined || hujjatJami === null || hujjatJami === '')
               ? null : (Number(hujjatJami)||0);
    var yetishmayotgan = (hj === null) ? null : (hj - yozilgan);

    /* ⚡ 2026-08-15 QAYTA KO'RIB CHIQILDI.
     * Avval `aPul` (narxsiz qatorlarning smeta narxi bo'yicha bahosi)
     * «izohlangan pul» ga qo'shilardi va tizim «yo'qolgan pul topildi»
     * deb xulosa qilardi. Bu NOTO'G'RI: narxsiz resurs ko'pincha
     * shunchaki narxlanmagan — F2 unga pul da'vo qilmagan.
     * Bunday qatorni «yo'qolgan pul» deb ko'rsatish foydalanuvchini
     * hujjatda yo'q summani qo'shishga undaydi.
     * Endi FAQAT `bPul` (summa ≠ hajm×narx — haqiqiy hisob xatosi)
     * izohlangan deb sanaladi. Narxsizlar alohida MA'LUMOT sifatida. */
    var izohlanadi = Math.max(0, bPul);
    var xulosa;
    if(hj === null){
      xulosa = 'Ҳужжат жами берилмади — етишмаётган пул ҳисобланмади.';
    } else if(Math.abs(yetishmayotgan) <= Math.max(1, Math.abs(hj)*0.0001)){
      xulosa = '✓ Фарқ ЙЎҚ — ҳужжат билан смета тенг.';
    } else if(izohlanadi >= Math.abs(yetishmayotgan)*0.9){
      xulosa = 'Сабаб ТОПИЛДИ: '+B.length+' та қаторда сумма ҳажм×нарх га '+
               'мос эмас. Буларни тўғрилаш керак.';
    } else if(A.length){
      xulosa = 'Ёзилган қаторларда ҳисоб хатоси топилмади. '+
               A.length+' та қатор НАРХСИЗ — Ф2 да уларга нарх берилмаган. '+
               'Бу одатда НОРМАЛ ҳолат (нарxланмаган ресурслар) ва тизим '+
               'уларга ЎЗИДАН нарх қўймайди. Агар нарх бўлиши керак бўлса — '+
               'Ф2 ҳужжатининг ўзида нарх йўқлигини текширинг. '+
               'Қолган фарқ эса сметага БОҒЛАНМАГАН қаторлардан бўлиши мумкин.';
    } else {
      xulosa = 'Ёзилган қаторларда бўшлиқ ТОПИЛМАДИ. Демак етишмаётган пул — '+
               'Ф2 да бор лекин сметага БОҒЛАНМАГАН қаторлардан. '+
               'Ф2 ни қайта очиб боғланмаганларини кўринг.';
    }

    return {ok:true, obyekt:obyekt, oyNom:oyNom,
            qatorSoni: t.qatorlar.length,
            yozilganJami: yozilgan,
            hujjatJami: hj,
            yetishmayotgan: yetishmayotgan,
            /* A: NARXSIZ qatorlar — ayb emas, MA'LUMOT. 
             * faqat «agar narxlanganda shuncha bo'lardi» degan baho;
             * hech qayerga avtomatik yozilmaydi. */
            hajmBorPulYoq: {soni:A.length, agarNarxlansaPul:aPul, qatorlar:A},
            /* B: summa hajm×narx ga mos emas */
            summaNomuvofiq: {soni:B.length, farqPul:bPul, qatorlar:B},
            /* C: hajm yo'q pul bor */
            hajmYoqPulBor: {soni:C.length, pul:cPul, qatorlar:C},
            bosh: {soni:D.length, qatorlar:D},
            izohlanadi: izohlanadi,
            xulosa: xulosa,
            vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};
  }catch(e){
    return {ok:false, xabar:'apiF2Bosliqlar: '+(e && e.message ? e.message : e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * apiF2YozishgaRuxsat(obyekt, oyNom, uidlar) — YOZISHDAN OLDINGI TEKSHIRUV
 *
 * Arxitektura qoidasi (2026-08-16): biznes qaror FRONTENDDA emas,
 * SERVERDA qabul qilinadi. Frontend faqat shu javobni ko'rsatadi.
 *
 * Avval frontend o'zi qaror qilardi («oyda ma'lumot bormi? tozalaymizmi?»)
 * va bo'laklab yozganda har bo'lakda qayta so'rab, OLDINGI BO'LAKNI
 * o'chirib yuborish tuzog'ini yaratardi.
 *
 * Bu funksiya hech narsani o'zgartirmaydi — faqat HOLATNI aytadi:
 *   holat: 'toza'      — oy bo'sh, bemalol yoziladi
 *          'davom'     — oyda SHU hujjatning oldingi bo'lagi bor
 *                        (uid lar mos) → tozalash KERAK EMAS
 *          'begona'    — oyda BOSHQA hujjat ma'lumoti bor → ogohlantirish
 *          'aralash'   — ikkalasi ham bor
 *
 * `uidlar` — hozir yozilmoqchi bo'lgan akt qatorlarining uid ro'yxati.
 * ══════════════════════════════════════════════════════════════════ */
function apiF2YozishgaRuxsat(obyekt, oyNom, uidlar){
  var t0 = Date.now();
  try{
    if(!obyekt) return {ok:false, xabar:'Обект берилмади'};
    oyNom = String(oyNom||'').trim();
    if(!oyNom) return {ok:false, xabar:'Ой номи бўш'};

    var t = apiF2OyTafsilot(obyekt, oyNom);
    if(!t.ok) return t;

    /* Oy bo'sh — hech qanday savol yo'q */
    if(!t.qatorlar.length){
      return {ok:true, holat:'toza', ogohlantirish:false,
              borQator:0, borSumma:0, ozQator:0, begonaQator:0,
              xabar:'«'+oyNom+'» ойи бўш — бемалол ёзилади.',
              vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};
    }

    var kutilgan = {};
    (uidlar||[]).forEach(function(u){ if(u) kutilgan[String(u)] = 1; });
    var bilamiz = Object.keys(kutilgan).length > 0;

    var oz = 0, begona = 0, izsiz = 0, borSumma = 0;
    for(var i=0;i<t.qatorlar.length;i++){
      var q = t.qatorlar[i];
      borSumma += _nzNum(q.summa);
      if(!q.uid){ izsiz++; continue; }            // izohsiz yozuv (eski/qo'lda)
      if(!bilamiz) continue;
      kutilgan[q.uid] ? oz++ : begona++;
    }

    var holat;
    if(!bilamiz)                 holat = 'nomalum'; // uid berilmadi — baho bermaymiz
    else if(oz && !begona)       holat = 'davom';
    else if(!oz && (begona||izsiz)) holat = 'begona';
    else if(oz && begona)        holat = 'aralash';
    else                         holat = 'begona';

    var xabar;
    if(holat === 'davom'){
      xabar = 'Бу ойда ШУ ҳужжатнинг олдинги бўлаги бор ('+oz+' қатор). '+
              'Давом эттирилади — эскиси ЎЧМАЙДИ, тозалаш КЕРАК ЭМАС.';
    } else if(holat === 'aralash'){
      xabar = 'Бу ойда ҳам шу ҳужжатдан ('+oz+' қатор), ҳам БОШҚАСИДАН ('+
              begona+' қатор) ёзув бор. Тозалансa бошқа ҳужжат ҳам ўчади — '+
              'эҳтиёт бўлинг.';
    } else if(holat === 'begona'){
      xabar = 'Бу ойда БОШҚА ҳужжатнинг маълумоти бор: '+t.qatorlar.length+
              ' қатор · '+borSumma.toFixed(2)+' сўм. Устига ёзилса иккаласи '+
              'ҚЎШИЛИБ кетади ва ой жамиси ҳужжатдан катта чиқади.';
    } else {
      xabar = 'Бу ойда '+t.qatorlar.length+' қатор бор, лекин уларнинг '+
              'қайси ҳужжатдан экани аниқланмади (uid йўқ).';
    }

    return {ok:true, holat:holat,
            /* faqat 'begona'/'aralash'/'nomalum' da foydalanuvchidan so'raladi */
            ogohlantirish: (holat !== 'toza' && holat !== 'davom'),
            tozalashTavsiya: (holat === 'begona'),
            borQator:t.qatorlar.length, borSumma:borSumma,
            ozQator:oz, begonaQator:begona, izsizQator:izsiz,
            xabar:xabar, vaqt:((Date.now()-t0)/1000).toFixed(1)+'s'};
  }catch(e){
    return {ok:false, xabar:'apiF2YozishgaRuxsat: '+(e && e.message ? e.message : e)};
  }
}
