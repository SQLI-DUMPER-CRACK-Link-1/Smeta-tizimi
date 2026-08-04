/******************************************************************
 * 75_AI_SmartF2.js — SMART F2 GENERATSIYASI (AI yordamida)
 * ==================================================================
 * Maqsad: Kiritilgan summa uchun eng optimal "F2MUM" qoldiqlarini 
 * topib, joriy oydagi F2 ga yozish uchun ro'yxat shakllantirish.
 ******************************************************************/

function apiAiSmartF2(obyekt, text) {
  try {
    // 1) Matndan summani ajratib olish
    var regex = /(\d+[\d\s\.,]*)\s*(ming|mln|million|mlrd|milliard)?/i;
    var match = text.match(regex);
    if (!match) return {text: 'Kechirasiz, summani aniq kiritmadingiz. Masalan: "500 mln so\'mga F2 yasab ber" deng.'};
    
    var numStr = match[1].replace(/[\s,]/g, '');
    var baseVal = parseFloat(numStr);
    var scaleStr = (match[2] || '').toLowerCase();
    
    if (scaleStr.indexOf('ming') >= 0) baseVal *= 1000;
    else if (scaleStr.indexOf('mln') >= 0 || scaleStr.indexOf('million') >= 0) baseVal *= 1000000;
    else if (scaleStr.indexOf('mlrd') >= 0 || scaleStr.indexOf('milliard') >= 0) baseVal *= 1000000000;
    
    if (isNaN(baseVal) || baseVal <= 0) {
      return {text: 'Kiritilgan summa noto\'g\'ri tushunildi: ' + match[0]};
    }

    var targetSum = baseVal;

    // ⚡⚡ 2026-07-10 TUZATILDI: ko'p smetali (jamlangan) obyektlarda `_plusTop(obyekt)`
    //   ota-obyekt uchun HECH QANDAY fayl topmasdi (haqiqiy LRV fayllar sub-obyekt
    //   nomlari ostida) — chat orqali Smart F2 jamlangan obyektlarda butunlay
    //   ishlamasdi. Endi boshqa barcha API bilan bir xil qoida: _subObyektlar orqali
    //   HAMMA faylni yig'amiz (subObjects bo'sh bo'lsa — oddiy bitta obyekt).
    var col = CFG.C;
    var subObjects = (typeof _subObyektlar==='function') ? _subObyektlar(obyekt) : [];
    var targets = subObjects.length ? subObjects : [obyekt];
    var plusMap = {};   // sub-obyekt nomi → shu obyektning LRV_PLUS fayli
    var f2mumRows = [];
    var totalMumkin = 0;

    for (var ti=0; ti<targets.length; ti++) {
      var plusT = _plusTop(targets[ti]);
      if (!plusT) continue;
      plusMap[targets[ti]] = plusT;
      var shs = plusT.getSheets();
      shs.forEach(function(sh) {
        var sName = sh.getName();
        if (sh.getName().indexOf(CFG.LRV_SHEET)!==0) return;   // faqat LRV_* varaqlar

        var lastR = sh.getLastRow();
        if (lastR < 2) return;
        var maxC = Math.max(col.F2MUM, col.NARX);
        if(sh.getLastColumn() < maxC) return;

        var vals = sh.getRange(1, 1, lastR, maxC).getValues();

        for (var r = 1; r < lastR; r++) {
          var f2mumHajm = parseFloat(vals[r][col.F2MUM - 1]) || 0;
          var smetaNarx = parseFloat(vals[r][col.NARX - 1]) || 0;
          var nom = String(vals[r][col.NOM - 1] || '').trim();

          if (f2mumHajm !== 0 && smetaNarx !== 0 && nom) {
            var pul = f2mumHajm * smetaNarx;
            f2mumRows.push({
              subObyekt: targets[ti],   // ⚡ qaysi sub-obyekt fayliga tegishli (jamlangan uchun)
              varaq: sName,
              row: r + 1,
              f2mumHajm: f2mumHajm,
              qoldiqPul: pul,
              nom: nom,
              narx: smetaNarx
            });
            totalMumkin += pul;
          }
        }
      });
    }
    if (Object.keys(plusMap).length===0) return {text: 'Obyekt fayli topilmadi.'};

    if (f2mumRows.length === 0) {
      return {text: 'Smetada faktda qilingan, lekin F2 ga kirmagan ochiq ishlar qolmagan (F2MUM = 0).'};
    }

    if (totalMumkin < targetSum) {
      return {text: 'Obyekt bo\'yicha barcha mumkin bo\'lgan F2 qoldig\'i: ' + fmt0(totalMumkin) + ' so\'m. Siz so\'ragan ' + fmt0(targetSum) + ' so\'mga yetmaydi!'};
    }

    // 3) Greedy algorithm
    f2mumRows.sort(function(a, b) { return b.qoldiqPul - a.qoldiqPul; });
    
    var selected = [];
    var currentSum = 0;
    var gap = targetSum;

    for (var i = 0; i < f2mumRows.length; i++) {
      var item = f2mumRows[i];
      if (item.qoldiqPul <= gap + 0.01) {
        selected.push({
           subObyekt: item.subObyekt, varaq: item.varaq, row: item.row,
           hajmToTake: item.f2mumHajm, pulToTake: item.qoldiqPul, nom: item.nom
        });
        currentSum += item.qoldiqPul;
        gap -= item.qoldiqPul;
      } else if (gap > 0) {
        var hajmToTake = gap / item.narx;
        selected.push({
           subObyekt: item.subObyekt, varaq: item.varaq, row: item.row,
           hajmToTake: hajmToTake, pulToTake: gap, nom: item.nom
        });
        currentSum += gap;
        gap = 0;
        break;
      }
    }

    // 4) Yozamiz — HAR sub-obyekt faylining o'z varag'iga (jamlangan-xavfsiz)
    var yazildi = 0;
    var editsBySub = {};   // "subObyekt||varaq" → items[]
    for (var i = 0; i < selected.length; i++) {
       var s = selected[i];
       var gk = s.subObyekt + '||' + s.varaq;
       if (!editsBySub[gk]) editsBySub[gk] = [];
       editsBySub[gk].push(s);
    }

    var touchedSheets = {};
    for (var gk2 in editsBySub) {
      var _i = gk2.indexOf('||'), subOb = gk2.slice(0, _i), varaqNom = gk2.slice(_i+2);
      var plusX = plusMap[subOb];
      if (!plusX) continue;
      var shX = plusX.getSheetByName(varaqNom);
      if (!shX) continue;

      var oylarData = _f2Oylar(shX);
      if (oylarData.length === 0) {
        return {text: '"'+varaqNom+'" варағида Ф2 ойлари очилмаган! Аввал UI орқали 1 та ой (масалан "Июнь 2026") қўшинг.'};
      }
      var oyCol = oylarData[oylarData.length - 1].col;

      var items = editsBySub[gk2];
      for (var j = 0; j < items.length; j++) {
         var curVal = parseFloat(shX.getRange(items[j].row, oyCol).getValue()) || 0;
         shX.getRange(items[j].row, oyCol).setValue(curVal + items[j].hajmToTake);
         yazildi++;
      }
      touchedSheets[gk2] = shX;
    }

    // ⚡⚡ 2026-07-10: FORMULA/YIG'INDI YANGILASH — avval bu qadam UMUMAN yo'q edi,
    //   shuning uchun F2OL/ST_F2 (va ulardan hisoblangan Panel/Boss/Накрутка) yangi
    //   yozilgan qiymatlarni ko'rsatmasdan eskirib qolardi. Endi har tegilgan
    //   varaqda formulalar to'g'rilanadi va yig'indi qayta hisoblanadi.
    var _aTz = sozAsosiy();
    for (var gk3 in touchedSheets) {
      var shY = touchedSheets[gk3];
      try {
        var start2 = _aTz.dataQator>0?_aTz.dataQator:_autoData(shY), last2 = shY.getLastRow();
        if (last2>=start2) _oyFormulaToldur(shY, start2, last2);
        _oyYigindiFormulalarYangila(shY);
      } catch(eF){}
    }

    // Server va holatni yangilash — HAR tegilgan sub-obyekt uchun (+ ota-obyekt kesh)
    for (var ti2=0; ti2<targets.length; ti2++) {
      if (!plusMap[targets[ti2]]) continue;
      try { _holatInvalidate(targets[ti2]); serverYozFile(targets[ti2], plusMap[targets[ti2]], sozAsosiy()); } catch(eS){}
    }
    _holatInvalidate(obyekt);

    var ans = '🤖 **Smart F2 Muvaffaqiyatli Bajarildi!**\n\n';
    ans += 'Kiritilgan maqsad: **' + fmt0(targetSum) + ' so\'m**\n';
    ans += 'Yozilgan summa: **' + fmt0(currentSum) + ' so\'m** (Eng ohirgi ochilgan oyga qo\'shildi)\n';
    ans += 'O\'zgartirilgan ishlar soni: **' + yazildi + ' ta**\n\n';
    ans += 'Iltimos, sahifani yangilang (F5) va F2 ustuniga qarang.';
    
    return {text: ans, intent: 'smart_f2'};
    
  } catch(e) {
    return {text: 'Xatolik (Smart F2): ' + String(e.message || e)};
  }
}
