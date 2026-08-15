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
