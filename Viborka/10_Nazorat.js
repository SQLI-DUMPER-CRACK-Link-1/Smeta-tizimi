/**
 * ============================================================
 * FAYL: 10_Nazorat.gs
 * VERSION: 32.0 (DEEP-FIXED EDITION)
 * VAZIFASI:
 *   Bitta sahifa — hamma materiallar bir joyda.
 *   "Qabul qilingan" ustuniga miqdor yozasiz → Viborka avtomatik to'ladi,
 *   Z_Obyekt sahifalari ham avtomatik qayta yaratiladi.
 *
 * KO'P MUAMMOLAR TUZATILDI:
 *   1. AI_NormalizeName ishlatiladi (1_CoreTitan_AI.gs bilan teng normalize)
 *      Bu yerda lotin X → kirill Х, formatlar bir xil bo'ladi.
 *   2. matKey bir xil formula: AI_NormalizeName(full) + '__' + normalizeUnit(bir)
 *   3. Nazoratda saqlangan nom — AI_NormalizeName natija (display uchun).
 *   4. onEdit + simple onEdit ham bor — installable trigger qo'yilmasa ham ishlaydi.
 *   5. Refresh tugmasi — hammasini qayta hisoblaydi (Viborka J + Z_Obyekt).
 *   6. Diagnostika tugmasi — muammoni qayerda ekanini ko'rsatadi.
 *
 * USTUNLAR:
 *   A: №   B: Material   C: Birlik   D: Plan jami
 *   E: ✏ Qabul qilingan  F: Narx  G: Summa  H: Qoldiq  I: %
 *   J: Sana  K: Etkazuvchi  L: Izoh  M: Holat
 * ============================================================
 */

var NAZ_COLS = 14;

// ════════════════════════════════════════════════════════════
// 1. NAZORAT SAHIFASINI YARATISH / YANGILASH
// ════════════════════════════════════════════════════════════

function buildNazorat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var vib = ss.getSheetByName('Viborka_Shablon');
  if (!vib) { ui.alert('Viborka_Shablon topilmadi!'); return; }

  var sheet = ss.getSheetByName('Nazorat');
  var existingData = {};

  if (sheet) {
    var resp = ui.alert(
      'Nazorat allaqachon mavjud',
      'Qayta yaratilsa:\n' +
      '✅ Sizning kiritgan ma\'lumotlar (Qabul, Narx, Sana, Etkazuvchi, Izoh) SAQLANADI\n' +
      '🔄 Material ro\'yxati va Plan jami qaytadan hisoblanadi\n\n' +
      'Davom etilsinmi?',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return;

    var last = sheet.getLastRow();
    if (last >= 2) {
      var existing = sheet.getRange(2, 1, last - 1, NAZ_COLS).getValues();
      existing.forEach(function(r) {
        var mat = String(r[1]).trim();
        var bir = String(r[2]).trim();
        if (!mat || !bir) return;
        var key = _nazKey(mat, bir);
        if (!key) return;
        existingData[key] = {
          qabul:      r[4],
          narx:       r[5],
          sana:       r[9],
          etkazuvchi: r[10],
          izoh:       r[11],
          zamena:     r[13]
        };
      });
    }
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet('Nazorat');
  }

  var headers = [
    '№', 'Материал', 'Бирлик', 'План (жами)',
    '✏ Қабул қилинган', 'Нарх', 'Сумма (жами)',
    'Қолдиқ', '%', 'Сана', 'Етказувчи', 'Изоҳ', 'Ҳолат',
    '🔄 Замена (ҳақиқий материал)'
  ];
  sheet.getRange(1, 1, 1, NAZ_COLS).setValues([headers])
    .setBackground('#0d47a1').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 52);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);

  var widths = [44, 320, 70, 100, 130, 95, 130, 90, 60, 95, 140, 200, 130, 260];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // ── Viborka unique materiallar ──────────────────────────
  var lastRow = vib.getLastRow();
  if (lastRow < 2) { ui.alert('Viborka bo\'sh!'); return; }

  var data = vib.getRange(2, 1, lastRow - 1, 16).getValues();
  var groups = {};
  var lastBase = '';

  data.forEach(function(row) {
    var rawMat = String(row[5]).trim();
    if (!rawMat || rawMat === '0') return;
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;
    var marka = String(row[6]).trim();
    var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
    var bir = String(row[7]).trim();
    var plan = round2(row[8]);
    var jVal = round2(row[9]);

    if (!full || !bir || plan <= 0) return;

    var normName = AI_NormalizeName(full);
    var normBir  = normalizeUnit(bir);
    var key = normName + '__' + normBir;

    if (!groups[key]) {
      groups[key] = { display: normName, bir: normBir, plan: 0, jSum: 0 };
    }
    groups[key].plan = round2(groups[key].plan + plan);
    groups[key].jSum = round2(groups[key].jSum + jVal);
  });

  var keys = Object.keys(groups).sort(function(a, b) {
    return groups[a].display.localeCompare(groups[b].display);
  });

  if (keys.length === 0) {
    ui.alert('Viborka da material topilmadi.');
    return;
  }

  var rows = [];
  var migratedCount = 0;

  keys.forEach(function(key, idx) {
    var g = groups[key];
    var existing = existingData[key] || {};

    var qabul;
    if (existing.qabul !== undefined && existing.qabul !== '' && round2(existing.qabul) > 0) {
      qabul = round2(existing.qabul);
    } else {
      qabul = g.jSum;
      if (qabul > 0) migratedCount++;
    }

    var narx = round2(existing.narx);
    var summa = round2(qabul * narx);
    var qoldiq = round2(g.plan - qabul);
    var pct = g.plan > 0 ? Math.round(qabul / g.plan * 100) : 0;
    var zamena = existing.zamena || '';
    var holat = _calcHolat(qabul, g.plan, zamena);

    rows.push([
      idx + 1, g.display, g.bir, g.plan,
      qabul, narx, summa,
      qoldiq, pct + '%',
      existing.sana || '',
      existing.etkazuvchi || '',
      existing.izoh || '',
      holat,
      zamena
    ]);
  });

  sheet.getRange(2, 1, rows.length, NAZ_COLS).setValues(rows);
  sheet.getRange(2, 4, rows.length, 5).setNumberFormat('#,##0.##');
  sheet.getRange(2, 10, rows.length, 1).setNumberFormat('dd.MM.yyyy');

  sheet.getRange(1, 5).setBackground('#2e7d32');
  sheet.getRange(2, 5, rows.length, 1)
    .setBackground('#e8f5e9').setFontWeight('bold').setFontSize(11);

  // Zamena ustuni (N = 14)
  sheet.getRange(1, 14).setBackground('#6a1b9a');
  sheet.getRange(2, 14, rows.length, 1)
    .setBackground('#f3e5f5').setFontColor('#4a148c');

  sheet.getRange(1, 1, rows.length + 1, NAZ_COLS)
    .setBorder(true, true, true, true, true, true, '#bdbdbd', SpreadsheetApp.BorderStyle.SOLID);

  var holRange = sheet.getRange(2, 13, rows.length, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('✅').setBackground('#c8e6c9').setFontColor('#1b5e20')
      .setRanges([holRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('🏬').setBackground('#bbdefb').setFontColor('#0d47a1')
      .setRanges([holRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('⚠').setBackground('#ffe0b2').setFontColor('#e65100')
      .setRanges([holRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('🆘').setBackground('#ffcdd2').setFontColor('#b71c1c')
      .setRanges([holRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('🔄').setBackground('#e1bee7').setFontColor('#4a148c')
      .setRanges([holRange]).build()
  ]);

  // Eski Prixod o'chirish
  var oldPrx = ss.getSheetByName('Prixod');
  var oldMat = ss.getSheetByName('_MaterialList');
  if (oldPrx || oldMat) {
    var delResp = ui.alert(
      'Eski Prixod fayl(lar)i topildi',
      'Prixod va _MaterialList sahifalari kerak emas. O\'chirilsinmi?',
      ui.ButtonSet.YES_NO
    );
    if (delResp === ui.Button.YES) {
      if (oldPrx) ss.deleteSheet(oldPrx);
      if (oldMat) ss.deleteSheet(oldMat);
    }
  }

  // Migration: Viborka J ni Nazorat asosida BATCH taqsimlash
  if (migratedCount > 0 || rows.some(function(r) { return round2(r[4]) > 0; })) {
    _batchDistributeFromRows(vib, rows);
  }

  _ensureNazoratTrigger();

  ss.toast('Z_Obyekt sahifalari yangilanmoqda...', '📦', -1);
  try {
    if (typeof runTitanAiPro === 'function') runTitanAiPro();
  } catch(err) { Logger.log('TitanAi: ' + err); }

  ss.setActiveSheet(sheet);
  ss.toast('✅ Nazorat tayyor: ' + rows.length + ' material', '📋', 5);

  var msg = '✅ NAZORAT TAYYOR!\n\n' + rows.length + ' ta material.';
  if (migratedCount > 0) {
    msg += '\n📥 ' + migratedCount + ' ta material Viborka J dan ko\'chirildi.';
  }
  msg += '\n\n📦 Z_Obyekt sahifalari ham yangilandi.\n\n' +
    'ENDI:\n' +
    '1. ✏ Qabul ustuniga miqdor yozing\n' +
    '2. Viborka J avtomatik to\'ladi\n' +
    '3. Z_Obyekt sahifalari - menyu → "♻ Hammasini qayta hisoblash"';

  ui.alert(msg);
}

// ════════════════════════════════════════════════════════════
// 2. onEdit — foydalanuvchi yozganda
// ════════════════════════════════════════════════════════════

function onNazoratEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  if (sheet.getName() !== 'Nazorat') return;

  var row = e.range.getRow();
  if (row < 2) return;
  var col = e.range.getColumn();

  if (col !== 5 && col !== 6 && col !== 14) return;

  var qabul = round2(sheet.getRange(row, 5).getValue());
  var narx  = round2(sheet.getRange(row, 6).getValue());
  var plan  = round2(sheet.getRange(row, 4).getValue());
  var zamena = String(sheet.getRange(row, 14).getValue()).trim();

  sheet.getRange(row, 7).setValue(round2(qabul * narx));
  sheet.getRange(row, 8).setValue(round2(plan - qabul));
  sheet.getRange(row, 9).setValue(plan > 0 ? Math.round(qabul / plan * 100) + '%' : '0%');
  sheet.getRange(row, 13).setValue(_calcHolat(qabul, plan, zamena));

  if (col === 5 || col === 14) {
    var mat = String(sheet.getRange(row, 2).getValue()).trim();
    var bir = String(sheet.getRange(row, 3).getValue()).trim();
    if (mat && bir) {
      try {
        var distributed = distributeFromNazorat(mat, bir, qabul, zamena);
        var sanaCell = sheet.getRange(row, 10);
        if (!sanaCell.getValue()) {
          sanaCell.setValue(new Date()).setNumberFormat('dd.MM.yyyy');
        }
        // Zamena tarixga yozish
        if (zamena && qabul > 0) {
          var izoh = String(sheet.getRange(row, 12).getValue()).trim();
          _logZamenaToHistory(mat, zamena, bir, qabul, narx, izoh);
        }
        if (distributed === 0) {
          SpreadsheetApp.getActiveSpreadsheet().toast(
            '⚠ Viborka da topilmadi: ' + mat, '❌', 5
          );
        }
      } catch (err) {
        sheet.getRange(row, 13).setValue('❌ ' + err.message);
      }
    }
  }
}

// ════════════════════════════════════════════════════════════
// 3. ASOSIY: TAQSIMOT (AI_NormalizeName bilan)
// ════════════════════════════════════════════════════════════

function distributeFromNazorat(matFull, birlik, totalQabul, zamena) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var vib = ss.getSheetByName('Viborka_Shablon');
  if (!vib) throw new Error('Viborka topilmadi');

  var normTarget = AI_NormalizeName(matFull);
  var birTarget = normalizeUnit(birlik);
  var zamenaStr = zamena ? String(zamena).trim() : '';

  var lastRow = vib.getLastRow();
  if (lastRow < 2) return 0;

  var data = vib.getRange(2, 1, lastRow - 1, 16).getValues();
  var matches = [];
  var lastBase = '';

  data.forEach(function(row, i) {
    var rawMat = String(row[5]).trim();
    if (!rawMat || rawMat === '0') return;
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;
    var marka = String(row[6]).trim();
    var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
    var norm = AI_NormalizeName(full);
    var bir = normalizeUnit(String(row[7]).trim());
    var plan = round2(row[8]);

    if (norm === normTarget && bir === birTarget && plan > 0) {
      matches.push({ realRow: i + 2, plan: plan });
    }
  });

  if (matches.length === 0) return 0;

  var remaining = totalQabul;
  var newVals = [];

  for (var k = 0; k < matches.length; k++) {
    var mt = matches[k];
    var isLast = (k === matches.length - 1);
    if (remaining <= 0) { newVals.push(''); continue; }
    if (isLast)                    { newVals.push(remaining); remaining = 0; }
    else if (remaining >= mt.plan) { newVals.push(mt.plan); remaining = round2(remaining - mt.plan); }
    else                           { newVals.push(remaining); remaining = 0; }
  }

  // Viborka J va P ustuniga yozish
  matches.forEach(function(mt, idx) {
    var val = newVals[idx];
    vib.getRange(mt.realRow, 10).setValue(val === '' ? '' : val);
    // P ustuniga zamena belgisi qo'shish (agar bor bo'lsa)
    if (zamenaStr && val !== '') {
      var pCell = vib.getRange(mt.realRow, 16);
      var oldP = String(pCell.getValue()).trim();
      // Eski zamena yozuvini tozalash
      var cleanedP = oldP.replace(/🔄\s*[^\n]*/g, '').trim();
      var newP = '🔄 ' + zamenaStr + (cleanedP ? ' · ' + cleanedP : '');
      pCell.setValue(newP);
    } else if (!zamenaStr) {
      // Zamena o'chirilgan — P dan zamena yozuvini ham olib tashlash
      var pCell2 = vib.getRange(mt.realRow, 16);
      var oldP2 = String(pCell2.getValue()).trim();
      if (oldP2.indexOf('🔄') !== -1) {
        var cleanedP2 = oldP2.replace(/🔄\s*[^\n]*/g, '').trim();
        pCell2.setValue(cleanedP2);
      }
    }
  });

  return matches.length;
}

// ════════════════════════════════════════════════════════════
// 4. HAMMASINI QAYTA HISOBLASH (asosiy tugma)
// ════════════════════════════════════════════════════════════

function refreshAllNazorat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var sheet = ss.getSheetByName('Nazorat');
  if (!sheet) { ui.alert('Nazorat yo\'q.'); return; }

  var vib = ss.getSheetByName('Viborka_Shablon');
  if (!vib) { ui.alert('Viborka topilmadi.'); return; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { ui.alert('Nazorat bo\'sh.'); return; }

  var resp = ui.alert(
    '♻ Hammasini qayta hisoblash',
    'Bu amal:\n' +
    '✅ Viborka J ni Nazorat asosida qayta yozadi\n' +
    '✅ Z_Obyekt sahifalarini qayta yaratadi\n' +
    '✅ Dashboard va Bosh sahifani yangilaydi\n\n' +
    'Davom etilsinmi?',
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  // ══════════════════════════════════════════════════════
  // BATCH: 1 marta o'qi → xotirada hisobla → 1 marta yoz
  // ══════════════════════════════════════════════════════

  ss.toast('1/4 — Ma\'lumotlar o\'qilmoqda...', '♻', -1);

  // ── 1. NAZORAT — bir marta o'qish ──────────────────────
  var nazData = sheet.getRange(2, 1, lastRow - 1, NAZ_COLS).getValues();

  // Nazorat → { matKey: { qabul, zamena, narx, ... } }
  var nazMap = {};
  nazData.forEach(function(r) {
    var mat = String(r[1]).trim();
    var bir = String(r[2]).trim();
    if (!mat || !bir) return;
    var key = AI_NormalizeName(mat) + '__' + normalizeUnit(bir);
    nazMap[key] = {
      qabul: round2(r[4]),
      zamena: String(r[13]).trim(),
      narx: round2(r[5])
    };
  });

  // ── 2. VIBORKA — bir marta o'qish ─────────────────────
  var vibLast = vib.getLastRow();
  if (vibLast < 2) { ui.alert('Viborka bo\'sh.'); return; }

  var vibData = vib.getRange(2, 1, vibLast - 1, 16).getValues();

  // Viborka qatorlarini matKey bo'yicha guruhlash (xotirada)
  var vibGroups = {}; // matKey → [ { idx, plan } ]
  var lastBase = '';

  for (var i = 0; i < vibData.length; i++) {
    var rawMat = String(vibData[i][5]).trim();
    if (!rawMat || rawMat === '0') continue;
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;
    var marka = String(vibData[i][6]).trim();
    var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
    var norm = AI_NormalizeName(full);
    var bir = normalizeUnit(String(vibData[i][7]).trim());
    var plan = round2(vibData[i][8]);

    if (!norm || !bir || plan <= 0) continue;

    var key = norm + '__' + bir;
    if (!vibGroups[key]) vibGroups[key] = [];
    vibGroups[key].push({ idx: i, plan: plan });
  }

  // ── 3. XOTIRADA TAQSIMLASH ─────────────────────────────
  ss.toast('2/4 — Taqsimlanmoqda (xotirada)...', '♻', -1);

  // J va P ustunlari uchun yangi qiymatlar
  var newJ = []; // [[val]] formatida
  var newP = []; // [[val]] formatida
  for (var j = 0; j < vibData.length; j++) {
    newJ.push(['']);
    newP.push([String(vibData[j][15]).trim()]); // mavjud P
  }

  var count = 0;
  var notFound = [];

  Object.keys(nazMap).forEach(function(key) {
    var naz = nazMap[key];
    if (naz.qabul <= 0) return;

    var matches = vibGroups[key];
    if (!matches || matches.length === 0) {
      // Nazoratdagi nom bilan topilmadi
      var parts = key.split('__');
      notFound.push(parts[0] || key);
      return;
    }

    count++;
    var remaining = naz.qabul;
    var zamenaStr = naz.zamena;

    for (var k = 0; k < matches.length; k++) {
      var mt = matches[k];
      var isLast = (k === matches.length - 1);
      var val;

      if (remaining <= 0)          val = '';
      else if (isLast)             { val = remaining; remaining = 0; }
      else if (remaining >= mt.plan) { val = mt.plan; remaining = round2(remaining - mt.plan); }
      else                         { val = remaining; remaining = 0; }

      newJ[mt.idx] = [val];

      // P ustuniga zamena belgisi
      if (zamenaStr && val !== '') {
        var cleanedP = String(newP[mt.idx][0]).replace(/🔄\s*[^\n]*/g, '').trim();
        newP[mt.idx] = ['🔄 ' + zamenaStr + (cleanedP ? ' · ' + cleanedP : '')];
      } else if (!zamenaStr && String(newP[mt.idx][0]).indexOf('🔄') !== -1) {
        var cleanedP2 = String(newP[mt.idx][0]).replace(/🔄\s*[^\n]*/g, '').trim();
        newP[mt.idx] = [cleanedP2];
      }
    }
  });

  // ── 4. VIBORKA GA BATCH YOZISH (1 marta) ──────────────
  ss.toast('3/4 — Viborka ga yozilmoqda...', '♻', -1);
  vib.getRange(2, 10, vibData.length, 1).setValues(newJ); // J ustun
  vib.getRange(2, 16, vibData.length, 1).setValues(newP); // P ustun

  // ── 5. NAZORAT HOLATLARINI BATCH YANGILASH ────────────
  var nazUpdates = nazData.map(function(r) {
    var plan = round2(r[3]);
    var qabul = round2(r[4]);
    var narx  = round2(r[5]);
    var zamena2 = String(r[13]).trim();
    return [
      round2(qabul * narx),                                        // G: Summa
      round2(plan - qabul),                                         // H: Qoldiq
      (plan > 0 ? Math.round(qabul / plan * 100) + '%' : '0%'),   // I: %
      '', '', '',                                                    // J,K,L saqlanadi
      _calcHolat(qabul, plan, zamena2)                              // M: Holat
    ];
  });
  // G(7), H(8), I(9) — ustunlar
  var ghi = nazData.map(function(r, i) {
    var plan = round2(r[3]);
    var qabul = round2(r[4]);
    var narx  = round2(r[5]);
    return [round2(qabul * narx), round2(plan - qabul),
            plan > 0 ? Math.round(qabul / plan * 100) + '%' : '0%'];
  });
  sheet.getRange(2, 7, ghi.length, 3).setValues(ghi);

  // M(13) — holat
  var holatCol = nazData.map(function(r) {
    return [_calcHolat(round2(r[4]), round2(r[3]), String(r[13]).trim())];
  });
  sheet.getRange(2, 13, holatCol.length, 1).setValues(holatCol);

  SpreadsheetApp.flush();

  // ── 6. Z_Obyekt + Dashboard + Bosh ────────────────────
  ss.toast('4/4 — Z_Obyekt qayta yaratilmoqda...', '♻', -1);
  try {
    if (typeof runTitanAiPro === 'function') runTitanAiPro();
    if (typeof buildDashboard === 'function') buildDashboard();
    if (typeof buildHomePage  === 'function') buildHomePage();
  } catch (err) { Logger.log('Refresh: ' + err); }

  var msg = '✅ Yakunlandi!\n\n' +
    '📊 ' + count + ' ta material taqsimlandi\n' +
    '📦 Z_Obyekt sahifalari qayta yaratildi\n' +
    '📈 Dashboard yangilandi';

  if (notFound.length > 0) {
    msg += '\n\n⚠ DIQQAT: ' + notFound.length + ' material Viborka da topilmadi:';
    notFound.slice(0, 5).forEach(function(m) { msg += '\n  • ' + m; });
    if (notFound.length > 5) msg += '\n  • ... va yana ' + (notFound.length - 5);
  }

  ui.alert(msg);
}

/**
 * SILENT versiya — fullRefresh chaqiradi (alertsiz, Z_Obyekt alohida)
 */
function refreshAllNazorat_silent() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Nazorat');
  var vib = ss.getSheetByName('Viborka_Shablon');
  if (!sheet || !vib) return;
  var lastRow = sheet.getLastRow();
  var vibLast = vib.getLastRow();
  if (lastRow < 2 || vibLast < 2) return;

  var nazData = sheet.getRange(2, 1, lastRow - 1, NAZ_COLS).getValues();
  var nazMap = {};
  nazData.forEach(function(r) {
    var mat = String(r[1]).trim();
    var bir = String(r[2]).trim();
    if (!mat || !bir) return;
    var key = AI_NormalizeName(mat) + '__' + normalizeUnit(bir);
    nazMap[key] = { qabul: round2(r[4]), zamena: String(r[13]).trim() };
  });

  var vibData = vib.getRange(2, 1, vibLast - 1, 16).getValues();
  var vibGroups = {};
  var lastBase = '';
  for (var i = 0; i < vibData.length; i++) {
    var rawMat = String(vibData[i][5]).trim();
    if (!rawMat || rawMat === '0') continue;
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;
    var marka = String(vibData[i][6]).trim();
    var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
    var norm = AI_NormalizeName(full);
    var bir = normalizeUnit(String(vibData[i][7]).trim());
    var plan = round2(vibData[i][8]);
    if (!norm || !bir || plan <= 0) continue;
    var key = norm + '__' + bir;
    if (!vibGroups[key]) vibGroups[key] = [];
    vibGroups[key].push({ idx: i, plan: plan });
  }

  var newJ = [];
  var newP = [];
  for (var j = 0; j < vibData.length; j++) {
    newJ.push(['']);
    newP.push([String(vibData[j][15]).trim()]);
  }

  Object.keys(nazMap).forEach(function(key) {
    var naz = nazMap[key];
    if (naz.qabul <= 0) return;
    var matches = vibGroups[key];
    if (!matches || matches.length === 0) return;
    var remaining = naz.qabul;
    var zamenaStr = naz.zamena;
    for (var k = 0; k < matches.length; k++) {
      var mt = matches[k];
      var isLast = (k === matches.length - 1);
      var val;
      if (remaining <= 0)              val = '';
      else if (isLast)                 { val = remaining; remaining = 0; }
      else if (remaining >= mt.plan)   { val = mt.plan; remaining = round2(remaining - mt.plan); }
      else                             { val = remaining; remaining = 0; }
      newJ[mt.idx] = [val];
      if (zamenaStr && val !== '') {
        var cp = String(newP[mt.idx][0]).replace(/🔄\s*[^\n]*/g, '').trim();
        newP[mt.idx] = ['🔄 ' + zamenaStr + (cp ? ' · ' + cp : '')];
      } else if (!zamenaStr && String(newP[mt.idx][0]).indexOf('🔄') !== -1) {
        newP[mt.idx] = [String(newP[mt.idx][0]).replace(/🔄\s*[^\n]*/g, '').trim()];
      }
    }
  });

  vib.getRange(2, 10, vibData.length, 1).setValues(newJ);
  vib.getRange(2, 16, vibData.length, 1).setValues(newP);

  var ghi = nazData.map(function(r) {
    var plan = round2(r[3]); var qabul = round2(r[4]); var narx = round2(r[5]);
    return [round2(qabul * narx), round2(plan - qabul),
            plan > 0 ? Math.round(qabul / plan * 100) + '%' : '0%'];
  });
  sheet.getRange(2, 7, ghi.length, 3).setValues(ghi);

  var holatCol = nazData.map(function(r) {
    return [_calcHolat(round2(r[4]), round2(r[3]), String(r[13]).trim())];
  });
  sheet.getRange(2, 13, holatCol.length, 1).setValues(holatCol);
  SpreadsheetApp.flush();
}

// ════════════════════════════════════════════════════════════
// 5. DIAGNOSTIKA
// ════════════════════════════════════════════════════════════

function diagnoseNazorat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var naz = ss.getSheetByName('Nazorat');
  var vib = ss.getSheetByName('Viborka_Shablon');

  if (!naz || !vib) { ui.alert('Nazorat yoki Viborka topilmadi'); return; }

  var report = '🔍 DIAGNOSTIKA\n\n';

  // 1. Trigger
  var triggers = ScriptApp.getProjectTriggers();
  var hasMasterTrigger = triggers.some(function(t) {
    return t.getHandlerFunction() === 'masterOnEdit' &&
           t.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  report += '1. masterOnEdit trigger: ' + (hasMasterTrigger ? '✅ BOR' : '❌ YO\'Q') + '\n';
  report += '   (Simple onEdit har doim ishlaydi)\n';

  // 2. Nazorat qatorlar
  var nazLast = naz.getLastRow();
  report += '\n2. Nazorat qatorlar: ' + (nazLast - 1) + '\n';

  // 3. Birinchi to'ldirilgan
  var firstFilledRow = 0;
  if (nazLast >= 2) {
    var nazData = naz.getRange(2, 1, nazLast - 1, 5).getValues();
    for (var i = 0; i < nazData.length; i++) {
      if (round2(nazData[i][4]) > 0) { firstFilledRow = i + 2; break; }
    }
  }
  report += '3. Birinchi to\'ldirilgan qator: ' + (firstFilledRow || 'YO\'Q') + '\n';

  if (firstFilledRow > 0) {
    var mat = String(naz.getRange(firstFilledRow, 2).getValue()).trim();
    var bir = String(naz.getRange(firstFilledRow, 3).getValue()).trim();
    var qabul = round2(naz.getRange(firstFilledRow, 5).getValue());

    report += '   Material: "' + mat + '"\n';
    report += '   Birlik: "' + bir + '"\n';
    report += '   Qabul: ' + qabul + '\n';

    var normTarget = AI_NormalizeName(mat);
    var birTarget = normalizeUnit(bir);
    report += '\n4. Normallashgan target:\n';
    report += '   Nom: "' + normTarget + '"\n';
    report += '   Birlik: "' + birTarget + '"\n';

    var vibLast = vib.getLastRow();
    var found = 0;
    var samples = [];
    if (vibLast >= 2) {
      var vibData = vib.getRange(2, 1, vibLast - 1, 16).getValues();
      var lastBase = '';
      vibData.forEach(function(row) {
        var rawMat = String(row[5]).trim();
        if (!rawMat || rawMat === '0') return;
        var resolved = resolveDitto(rawMat, lastBase);
        lastBase = resolved;
        var marka = String(row[6]).trim();
        var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
        var norm = AI_NormalizeName(full);
        var bir2 = normalizeUnit(String(row[7]).trim());

        if (norm === normTarget && bir2 === birTarget) found++;

        if (samples.length < 5) {
          var firstWord = normTarget.split(' ')[0].toLowerCase();
          if (norm.toLowerCase().indexOf(firstWord) >= 0) {
            samples.push('"' + norm + '" (' + bir2 + ')');
          }
        }
      });
    }

    report += '\n5. Viborka da mos qatorlar: ' + found + '\n';
    if (found === 0) {
      report += '   ❌ TOPILMADI!\n';
      report += '   Viborkadagi o\'xshash nomlar:\n';
      samples.forEach(function(s) { report += '     • ' + s + '\n'; });
      report += '\n   Yechim: Viborkadagi nom bilan Nazoratdagi nom bir xil bo\'lishi kerak';
    } else {
      report += '   ✅ TOPILDI. ' + found + ' qatorga taqsimlanishi mumkin.';
    }
  }

  ui.alert('Diagnostika', report, ui.ButtonSet.OK);
}

// ════════════════════════════════════════════════════════════
// 5.5. ZAMENA_TARIX — tarix va ro'yxat
// ════════════════════════════════════════════════════════════

/**
 * Zamena_Tarix varaq'ini yaratish / yangilash.
 * Bu varaqda barcha zamena materiallari saqlanadi.
 */
function buildZamenaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Zamena_Tarix');
  if (!sheet) {
    sheet = ss.insertSheet('Zamena_Tarix');
  } else {
    // Sarlavha qayta yozamiz, ma'lumotlar saqlanadi
    sheet.getRange(1, 1, 1, 10).clearContent().clearFormat();
  }

  var headers = [
    '№', 'Сана', 'Асл материал (план)', '🔄 Замена (ҳақиқий)',
    'Бирлик', 'Миқдор', 'Нарх', 'Сумма',
    'Сабаб / Изоҳ', 'Ҳолат'
  ];
  sheet.getRange(1, 1, 1, 10).setValues([headers])
    .setBackground('#6a1b9a').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 44);
  sheet.setFrozenRows(1);

  var widths = [44, 95, 260, 260, 70, 100, 95, 120, 220, 120];
  widths.forEach(function(w, i) { sheet.setColumnWidth(i + 1, w); });

  // Formatlar
  var lastRow = Math.max(sheet.getLastRow(), 2);
  sheet.getRange(2, 2, 2000, 1).setNumberFormat('dd.MM.yyyy');
  sheet.getRange(2, 6, 2000, 3).setNumberFormat('#,##0.##');

  // Rangli format
  var holRange = sheet.getRange(2, 10, 2000, 1);
  sheet.clearConditionalFormatRules();
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('✅').setBackground('#e1bee7').setFontColor('#4a148c')
      .setRanges([holRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains('⏳').setBackground('#fff3e0').setFontColor('#e65100')
      .setRanges([holRange]).build()
  ]);

  // Nazoratdan mavjud zamena ma'lumotlarini yig'ish
  var naz = ss.getSheetByName('Nazorat');
  if (naz) {
    var nazLast = naz.getLastRow();
    if (nazLast >= 2) {
      var nazData = naz.getRange(2, 1, nazLast - 1, NAZ_COLS).getValues();
      // Mavjud Zamena_Tarix da bor yozuvlarni tekshirish
      var existingKeys = {};
      var ztLast = sheet.getLastRow();
      if (ztLast >= 2) {
        var ztData = sheet.getRange(2, 1, ztLast - 1, 10).getValues();
        ztData.forEach(function(r) {
          var key = String(r[2]).trim() + '||' + String(r[3]).trim();
          existingKeys[key] = true;
        });
      }

      var newRows = [];
      var counter = ztLast >= 2 ? ztLast : 1;
      nazData.forEach(function(r) {
        var zamena = String(r[13]).trim(); // N ustun (14, 0-indexed=13)
        if (!zamena) return;
        var mat = String(r[1]).trim();
        var bir = String(r[2]).trim();
        var qabul = round2(r[4]);
        var narx = round2(r[5]);
        var key = mat + '||' + zamena;
        if (existingKeys[key]) return; // allaqachon bor

        counter++;
        newRows.push([
          counter - 1,
          r[9] || new Date(), // Sana
          mat,
          zamena,
          bir,
          qabul,
          narx,
          round2(qabul * narx),
          String(r[11]).trim() || '', // Izoh
          '✅ Tasdiqlangan'
        ]);
      });

      if (newRows.length > 0) {
        sheet.getRange(ztLast + 1, 1, newRows.length, 10).setValues(newRows);
      }
    }
  }

  ss.toast('✅ Zamena_Tarix: ' + (sheet.getLastRow() - 1) + ' yozuv', '🔄', 4);
  ss.setActiveSheet(sheet);
}

/**
 * Nazoratdan zamena yozilganda → avtomatik Zamena_Tarix ga qo'shish
 */
function _logZamenaToHistory(aslMat, zamenaMat, birlik, miqdor, narx, izoh) {
  if (!zamenaMat || !aslMat) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Zamena_Tarix');
  if (!sheet) {
    // Zamena_Tarix yo'q bo'lsa yaratamiz
    sheet = ss.insertSheet('Zamena_Tarix');
    var headers = [
      '№', 'Сана', 'Асл материал (план)', '🔄 Замена (ҳақиқий)',
      'Бирлик', 'Миқдор', 'Нарх', 'Сумма',
      'Сабаб / Изоҳ', 'Ҳолат'
    ];
    sheet.getRange(1, 1, 1, 10).setValues([headers])
      .setBackground('#6a1b9a').setFontColor('#ffffff')
      .setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
  }

  // Duplikat tekshirish
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existing = sheet.getRange(2, 3, lastRow - 1, 2).getValues();
    for (var i = 0; i < existing.length; i++) {
      if (String(existing[i][0]).trim() === aslMat &&
          String(existing[i][1]).trim() === zamenaMat) {
        // Mavjud — miqdorni yangilaymiz
        sheet.getRange(i + 2, 6).setValue(miqdor);
        sheet.getRange(i + 2, 7).setValue(narx);
        sheet.getRange(i + 2, 8).setValue(round2(miqdor * narx));
        sheet.getRange(i + 2, 2).setValue(new Date()).setNumberFormat('dd.MM.yyyy');
        return;
      }
    }
  }

  // Yangi qator
  var newRow = [
    lastRow, new Date(), aslMat, zamenaMat,
    birlik, miqdor, narx, round2(miqdor * narx),
    izoh || '', '✅ Tasdiqlangan'
  ];
  sheet.getRange(lastRow + 1, 1, 1, 10).setValues([newRow]);
  sheet.getRange(lastRow + 1, 2, 1, 1).setNumberFormat('dd.MM.yyyy');
  sheet.getRange(lastRow + 1, 6, 1, 3).setNumberFormat('#,##0.##');
}

// ════════════════════════════════════════════════════════════
// 6. YORDAMCHILAR
// ════════════════════════════════════════════════════════════

/**
 * BATCH TAQSIMLASH — Nazorat rows dan Viborka ga bir martalik yozish.
 * rows — Nazorat qatorlari (buildNazorat formatda):
 *   [idx, mat, bir, plan, qabul, narx, summa, ..., zamena]
 */
function _batchDistributeFromRows(vib, nazRows) {
  var vibLast = vib.getLastRow();
  if (vibLast < 2) return;

  var vibData = vib.getRange(2, 1, vibLast - 1, 16).getValues();

  // Viborka qatorlarini matKey bo'yicha guruhlash
  var vibGroups = {};
  var lastBase = '';
  for (var i = 0; i < vibData.length; i++) {
    var rawMat = String(vibData[i][5]).trim();
    if (!rawMat || rawMat === '0') continue;
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;
    var marka = String(vibData[i][6]).trim();
    var full = resolved + (marka && marka !== '0' && marka !== resolved ? ' ' + marka : '');
    var norm = AI_NormalizeName(full);
    var bir = normalizeUnit(String(vibData[i][7]).trim());
    var plan = round2(vibData[i][8]);
    if (!norm || !bir || plan <= 0) continue;
    var key = norm + '__' + bir;
    if (!vibGroups[key]) vibGroups[key] = [];
    vibGroups[key].push({ idx: i, plan: plan });
  }

  // J va P uchun yangi qiymatlar
  var newJ = [];
  var newP = [];
  for (var j = 0; j < vibData.length; j++) {
    newJ.push(['']);
    newP.push([String(vibData[j][15]).trim()]);
  }

  // Har Nazorat qatori uchun taqsimlash
  nazRows.forEach(function(r) {
    var mat = String(r[1]).trim();
    var bir = String(r[2]).trim();
    var qabul = round2(r[4]);
    var zamenaStr = String(r[13] || '').trim();
    if (!mat || !bir || qabul <= 0) return;

    var key = AI_NormalizeName(mat) + '__' + normalizeUnit(bir);
    var matches = vibGroups[key];
    if (!matches) return;

    var remaining = qabul;
    for (var k = 0; k < matches.length; k++) {
      var mt = matches[k];
      var isLast = (k === matches.length - 1);
      var val;
      if (remaining <= 0)              val = '';
      else if (isLast)                 { val = remaining; remaining = 0; }
      else if (remaining >= mt.plan)   { val = mt.plan; remaining = round2(remaining - mt.plan); }
      else                             { val = remaining; remaining = 0; }

      newJ[mt.idx] = [val];
      if (zamenaStr && val !== '') {
        var cleanedP = String(newP[mt.idx][0]).replace(/🔄\s*[^\n]*/g, '').trim();
        newP[mt.idx] = ['🔄 ' + zamenaStr + (cleanedP ? ' · ' + cleanedP : '')];
      }
    }
  });

  // BIR MARTA yozish
  vib.getRange(2, 10, vibData.length, 1).setValues(newJ);
  vib.getRange(2, 16, vibData.length, 1).setValues(newP);
}

function _calcHolat(qabul, plan, zamena) {
  if (plan <= 0) return '—';
  var hasZamena = zamena && String(zamena).trim().length > 0;
  if (qabul <= 0) return '🆘 Yo\'q';
  if (hasZamena && qabul >= plan * 0.98) return '🔄 Zamena (to\'liq)';
  if (hasZamena) return '🔄 Zamena (qisman)';
  if (qabul > plan * 1.05) return '🏬 Ortiqcha';
  if (qabul >= plan * 0.98) return '✅ To\'liq';
  return '⚠ Qisman';
}

function _nazKey(mat, bir) {
  if (!mat || !bir) return null;
  return AI_NormalizeName(mat) + '__' + normalizeUnit(bir);
}

function _ensureNazoratTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasMaster = triggers.some(function(t) {
    return t.getHandlerFunction() === 'masterOnEdit' &&
           t.getEventType() === ScriptApp.EventType.ON_EDIT;
  });
  if (!hasMaster) {
    ScriptApp.newTrigger('masterOnEdit')
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onEdit().create();
  }
}

// onEdit endi 0_Master_Triggers.gs da