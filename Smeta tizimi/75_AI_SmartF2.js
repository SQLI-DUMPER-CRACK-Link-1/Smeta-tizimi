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
    
    // 2) Smetani skaner qilish (F2MUM larni topish)
    var col = CFG.C;
    var plus = _plusTop(obyekt);
    if (!plus) return {text: 'Obyekt fayli topilmadi.'};
    
    var f2mumRows = []; 
    var totalMumkin = 0;
    
    var shs = plus.getSheets();
    shs.forEach(function(sh) {
      var sName = sh.getName();
      if (sName === CFG.REYESTR_SHEET || sName === CFG.LOKAL_DB_NAME || sName === 'LOKAL') return;
      
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
           varaq: item.varaq, row: item.row,
           hajmToTake: item.f2mumHajm, pulToTake: item.qoldiqPul, nom: item.nom
        });
        currentSum += item.qoldiqPul;
        gap -= item.qoldiqPul;
      } else if (gap > 0) {
        var hajmToTake = gap / item.narx;
        selected.push({
           varaq: item.varaq, row: item.row,
           hajmToTake: hajmToTake, pulToTake: gap, nom: item.nom
        });
        currentSum += gap;
        gap = 0;
        break; 
      }
    }

    // 4) Yozamiz
    var yazildi = 0;
    var editsBySheet = {};
    for (var i = 0; i < selected.length; i++) {
       var s = selected[i];
       if (!editsBySheet[s.varaq]) editsBySheet[s.varaq] = [];
       editsBySheet[s.varaq].push(s);
    }

    for (var v in editsBySheet) {
      var sh = plus.getSheetByName(v);
      if (!sh) continue;
      
      var oylarData = _f2Oylar(sh);
      var oyCol = -1;
      var joriyOyNom = '';
      
      if (oylarData.length > 0) {
        oyCol = oylarData[oylarData.length - 1].col; 
        joriyOyNom = oylarData[oylarData.length - 1].nom;
      } else {
        return {text: 'Smetada F2 oylari ochilmagan! Avval UI orqali 1 ta oy (masalan "Июнь 2026") qo\'shing.'};
      }

      var items = editsBySheet[v];
      for (var j = 0; j < items.length; j++) {
         var curVal = parseFloat(sh.getRange(items[j].row, oyCol).getValue()) || 0;
         sh.getRange(items[j].row, oyCol).setValue(curVal + items[j].hajmToTake);
         yazildi++;
      }
    }
    
    // Server va holatni yangilash
    _holatInvalidate(obyekt);
    try { serverYozFile(obyekt, plus, sozAsosiy()); } catch(e){}

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
