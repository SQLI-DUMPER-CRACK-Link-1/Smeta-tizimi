/**
 * ============================================================
 * FAYL: 7_Filter_Reports.gs
 * VERSION: 1.0
 * VAZIFASI: Viborka_Shablon dan istalgan kesimda hisobot olish.
 *   - Obyekt bo'yicha — bir obyektning barcha materiallari
 *   - Material bo'yicha — bir material qaysi obyektlarda
 *   - Kategoriya bo'yicha — masalan "barcha metall"
 *   - Defitsit hisoboti — yetmagan barcha narsalar
 *
 * BARCHA HISOBOTLAR — "Hisobot" varag'iga yoziladi.
 * Snabjenets ko'rib, kerak bo'lsa Excel ga eksport qiladi.
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// MENYUDAN CHAQIRILADIGAN FUNKSIYALAR
// ════════════════════════════════════════════════════════════

/** 1. OBYEKT BO'YICHA — dialog ochiladi, obyektni tanlatadi */
function reportByObject() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var objects = _getUniqueValues(ss, 2); // B ustun
  if (objects.length === 0) { ui.alert('Obyektlar topilmadi.'); return; }

  // Dialog
  var html = '<div style="font-family:Arial;padding:12px">' +
    '<h3 style="margin:0 0 12px">Obyektni tanlang</h3>' +
    '<select id="obj" style="width:100%;padding:8px;font-size:14px">' +
    '<option value="__ALL__">— Barcha obyektlar —</option>' +
    objects.map(function(o) {
      return '<option value="' + _escape(o) + '">' + _escape(o) + '</option>';
    }).join('') +
    '</select>' +
    '<div style="margin-top:12px">' +
    '<label><input type="checkbox" id="onlyDef" checked> Faqat defitsit (yetmaganlar)</label>' +
    '</div>' +
    '<div style="margin-top:16px;text-align:right">' +
    '<button onclick="go()" style="padding:8px 18px;background:#1565c0;color:#fff;border:0;border-radius:4px;cursor:pointer">Hisobot tayyorla</button>' +
    '</div>' +
    '<script>' +
    'function go(){' +
    '  var o=document.getElementById("obj").value;' +
    '  var d=document.getElementById("onlyDef").checked;' +
    '  google.script.run.withSuccessHandler(function(){google.script.host.close();})' +
    '    ._renderReportByObject(o,d);' +
    '}' +
    '</script></div>';

  var output = HtmlService.createHtmlOutput(html).setWidth(420).setHeight(220);
  ui.showModalDialog(output, '📊 Obyekt bo\'yicha hisobot');
}

/** 2. MATERIAL BO'YICHA — material nomini kiritadi */
function reportByMaterial() {
  var ui = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    '🔍 Material bo\'yicha hisobot',
    'Material nomidan bir qism yozing (masalan: "уголок 50" yoki "профиль"):\n\n' +
    'Bu so\'z kiritilgan barcha materiallar topiladi.',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  var query = resp.getResponseText().trim();
  if (!query) { ui.alert('So\'z kiritilmadi.'); return; }
  _renderReportByMaterial(query);
}

/** 3. KATEGORIYA BO'YICHA — dialog */
function reportByCategory() {
  var ui = SpreadsheetApp.getUi();

  // Foydalanuvchiga ko'rsatadigan kategoriya guruhlari
  var cats = [
    ['ALL_METAL',    '🔩 Барча металл (Уголок + Швеллер + Лист + Труба + Профиль...)'],
    ['ARMATURA',     '🏗  Faqat Арматура'],
    ['UGOLOK',       '📐 Faqat Уголок'],
    ['PROFIL',       '📏 Faqat Профильные трубы'],
    ['LIST',         '📄 Faqat Лист (стальной)'],
    ['TRUBA_ST',     '🛡  Faqat Трубы стальные'],
    ['TRUBA_PL',     '🧪 Трубы пластиковые (ПП/ПВХ)'],
    ['ELEKTR',       '⚡ Электротехника (кабель, светильник...)'],
    ['SANTEX',       '🚿 Сантехника'],
    ['UTEPLITEL',    '🧊 Теплоизоляция'],
    ['GIDRO',        '💧 Гидроизоляция'],
    ['OTDELKA',      '🎨 Отделка (плитка, фасад)'],
    ['VENT',         '💨 Вентиляция и кондиционеры']
  ];

  var html = '<div style="font-family:Arial;padding:12px">' +
    '<h3 style="margin:0 0 12px">Kategoriya tanlang</h3>' +
    '<select id="cat" style="width:100%;padding:8px;font-size:14px">' +
    cats.map(function(c) {
      return '<option value="' + c[0] + '">' + _escape(c[1]) + '</option>';
    }).join('') +
    '</select>' +
    '<div style="margin-top:12px">' +
    '<label><input type="checkbox" id="onlyDef" checked> Faqat defitsit</label>' +
    '</div>' +
    '<div style="margin-top:16px;text-align:right">' +
    '<button onclick="go()" style="padding:8px 18px;background:#1565c0;color:#fff;border:0;border-radius:4px;cursor:pointer">Hisobot tayyorla</button>' +
    '</div>' +
    '<script>' +
    'function go(){' +
    '  var c=document.getElementById("cat").value;' +
    '  var d=document.getElementById("onlyDef").checked;' +
    '  google.script.run.withSuccessHandler(function(){google.script.host.close();})' +
    '    ._renderReportByCategory(c,d);' +
    '}' +
    '</script></div>';

  var output = HtmlService.createHtmlOutput(html).setWidth(480).setHeight(240);
  ui.showModalDialog(output, '🏷 Kategoriya bo\'yicha hisobot');
}

/** 4. DEFITSIT HISOBOTI — yetmagan barcha narsalar */
function reportDeficit() {
  _renderReportDeficit();
}

/** 5. SNABJENETS PANELI — universal filter */
function openSnabPanel() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var objects = _getUniqueValues(ss, 2);
  var razdels = _getUniqueValues(ss, 4);

  var html = '<div style="font-family:Arial;padding:16px;max-width:540px">' +
    '<h2 style="margin:0 0 4px;color:#1565c0">⚡ Snabjenets paneli</h2>' +
    '<p style="margin:0 0 16px;color:#666;font-size:13px">Filtrlarni tanlang va "Tayyorla" bosing</p>' +

    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
      '<div><label style="font-size:12px;color:#666">Obyekt</label>' +
      '<select id="obj" style="width:100%;padding:8px;font-size:14px;margin-top:4px">' +
      '<option value="__ALL__">— Hammasi —</option>' +
      objects.map(function(o){return '<option value="'+_escape(o)+'">'+_escape(o)+'</option>';}).join('') +
      '</select></div>' +

      '<div><label style="font-size:12px;color:#666">Bo\'lim</label>' +
      '<select id="raz" style="width:100%;padding:8px;font-size:14px;margin-top:4px">' +
      '<option value="__ALL__">— Hammasi —</option>' +
      razdels.map(function(r){return '<option value="'+_escape(r)+'">'+_escape(r)+'</option>';}).join('') +
      '</select></div>' +
    '</div>' +

    '<div style="margin-bottom:12px">' +
      '<label style="font-size:12px;color:#666">Kategoriya</label>' +
      '<select id="cat" style="width:100%;padding:8px;font-size:14px;margin-top:4px">' +
      '<option value="__ALL__">— Hammasi —</option>' +
      '<option value="ALL_METAL">🔩 Барча металл</option>' +
      '<option value="ARMATURA">🏗  Арматура</option>' +
      '<option value="UGOLOK">📐 Уголок</option>' +
      '<option value="PROFIL">📏 Профильные трубы</option>' +
      '<option value="LIST">📄 Лист стальной</option>' +
      '<option value="TRUBA_ST">🛡  Трубы стальные</option>' +
      '<option value="TRUBA_PL">🧪 Трубы пластиковые</option>' +
      '<option value="ELEKTR">⚡ Электротехника</option>' +
      '<option value="SANTEX">🚿 Сантехника</option>' +
      '<option value="UTEPLITEL">🧊 Теплоизоляция</option>' +
      '<option value="GIDRO">💧 Гидроизоляция</option>' +
      '<option value="OTDELKA">🎨 Отделка</option>' +
      '<option value="VENT">💨 Вентиляция</option>' +
      '</select>' +
    '</div>' +

    '<div style="margin-bottom:12px">' +
      '<label style="font-size:12px;color:#666">Material qidirish (ixtiyoriy)</label>' +
      '<input id="search" type="text" placeholder="masalan: уголок 50, профиль 60х40" ' +
      'style="width:100%;padding:8px;font-size:14px;margin-top:4px;box-sizing:border-box">' +
    '</div>' +

    '<div style="margin-bottom:16px;padding:10px;background:#f5f5f5;border-radius:6px">' +
      '<div style="font-size:12px;color:#666;margin-bottom:6px">Holati:</div>' +
      '<label style="display:inline-block;margin-right:14px"><input type="checkbox" id="s_def" checked> Defitsit</label>' +
      '<label style="display:inline-block;margin-right:14px"><input type="checkbox" id="s_clo"> Yopilgan</label>' +
      '<label style="display:inline-block"><input type="checkbox" id="s_per" checked> Pererasxod</label>' +
    '</div>' +

    '<div style="text-align:right">' +
      '<button onclick="google.script.host.close()" ' +
      'style="padding:8px 16px;background:#fff;color:#666;border:1px solid #ccc;border-radius:4px;cursor:pointer;margin-right:8px">Bekor</button>' +
      '<button onclick="go()" id="goBtn" ' +
      'style="padding:8px 24px;background:#1565c0;color:#fff;border:0;border-radius:4px;cursor:pointer;font-weight:bold">Tayyorla</button>' +
    '</div>' +

    '<script>' +
    'function go(){' +
    '  var b=document.getElementById("goBtn"); b.disabled=true; b.textContent="Tayyorlanmoqda...";' +
    '  var f={obj:document.getElementById("obj").value,' +
    '         raz:document.getElementById("raz").value,' +
    '         cat:document.getElementById("cat").value,' +
    '         search:document.getElementById("search").value,' +
    '         showDef:document.getElementById("s_def").checked,' +
    '         showClo:document.getElementById("s_clo").checked,' +
    '         showPer:document.getElementById("s_per").checked};' +
    '  google.script.run.withSuccessHandler(function(){google.script.host.close();})' +
    '   ._renderSnabReport(f);' +
    '}' +
    '</script></div>';

  var output = HtmlService.createHtmlOutput(html).setWidth(580).setHeight(540);
  SpreadsheetApp.getUi().showModalDialog(output, '⚡ Snabjenets paneli');
}


// ════════════════════════════════════════════════════════════
// HISOBOT GENERATORLARI (Dialog dan chaqiriladi)
// ════════════════════════════════════════════════════════════

function _renderReportByObject(objName, onlyDeficit) {
  var rows = _gatherData(function(item) {
    if (objName !== '__ALL__' && item.obyekt !== objName) return false;
    if (onlyDeficit && item.qoldiq <= 0) return false;
    return true;
  });

  var title = objName === '__ALL__' ? 'BARCHA OBYEKTLAR' : objName.toUpperCase();
  if (onlyDeficit) title += ' — faqat defitsit';

  _writeReport(rows, title, 'object');
}

function _renderReportByMaterial(query) {
  var q = query.toLowerCase().trim();
  var rows = _gatherData(function(item) {
    return item.matLower.indexOf(q) !== -1;
  });

  _writeReport(rows, 'QIDIRUV: "' + query + '"', 'material');
}

function _renderReportByCategory(catKey, onlyDeficit) {
  var matcher = _getCategoryMatcher(catKey);
  var rows = _gatherData(function(item) {
    if (!matcher(item.matLower)) return false;
    if (onlyDeficit && item.qoldiq <= 0) return false;
    return true;
  });

  var labels = {
    'ALL_METAL': 'BARCHA METALL', 'ARMATURA': 'АРМАТУРА', 'UGOLOK': 'УГОЛОК',
    'PROFIL': 'ПРОФИЛЬНЫЕ ТРУБЫ', 'LIST': 'ЛИСТ СТАЛЬНОЙ', 'TRUBA_ST': 'ТРУБЫ СТАЛЬНЫЕ',
    'TRUBA_PL': 'ТРУБЫ ПЛАСТИКОВЫЕ', 'ELEKTR': 'ЭЛЕКТРОТЕХНИКА', 'SANTEX': 'САНТЕХНИКА',
    'UTEPLITEL': 'ТЕПЛОИЗОЛЯЦИЯ', 'GIDRO': 'ГИДРОИЗОЛЯЦИЯ',
    'OTDELKA': 'ОТДЕЛКА', 'VENT': 'ВЕНТИЛЯЦИЯ'
  };
  var title = 'KATEGORIYA: ' + (labels[catKey] || catKey);
  if (onlyDeficit) title += ' — faqat defitsit';

  _writeReport(rows, title, 'category');
}

function _renderReportDeficit() {
  var rows = _gatherData(function(item) { return item.qoldiq > 0; });
  _writeReport(rows, 'BARCHA DEFITSIT MATERIALLAR', 'deficit');
}

function _renderSnabReport(filters) {
  var matcher = _getCategoryMatcher(filters.cat);
  var search = String(filters.search || '').toLowerCase().trim();

  var rows = _gatherData(function(item) {
    // Obyekt
    if (filters.obj !== '__ALL__' && item.obyekt !== filters.obj) return false;
    // Razdel
    if (filters.raz !== '__ALL__' && item.razdel !== filters.raz) return false;
    // Kategoriya
    if (!matcher(item.matLower)) return false;
    // Qidiruv
    if (search && item.matLower.indexOf(search) === -1) return false;

    // Holat (status)
    var pct = item.plan > 0 ? (item.fakt / item.plan) : 0;
    var isClosed = pct >= 0.98;
    var isPerer  = item.plan > 0 && item.fakt > item.plan * 1.20;
    var isDef    = item.qoldiq > 0 && !isPerer;

    if (isDef    && !filters.showDef) return false;
    if (isClosed && !filters.showClo) return false;
    if (isPerer  && !filters.showPer) return false;
    // Hech qaysi turga tushmasa — defitsit ham emas, yopilgan ham emas
    if (!isDef && !isClosed && !isPerer) return filters.showDef;

    return true;
  });

  var titleParts = [];
  if (filters.obj !== '__ALL__') titleParts.push(filters.obj);
  if (filters.raz !== '__ALL__') titleParts.push(filters.raz);
  if (filters.cat !== '__ALL__') titleParts.push(filters.cat);
  if (search)                    titleParts.push('"' + filters.search + '"');
  var title = titleParts.length ? titleParts.join(' / ') : 'TO\'LIQ HISOBOT';

  _writeReport(rows, title, 'snab');
}


// ════════════════════════════════════════════════════════════
// MA'LUMOT YIG'ISH (umumiy yadro)
// ════════════════════════════════════════════════════════════

/**
 * Viborka_Shablon ni o'qib, har bir unique (material+birlik) bo'yicha
 * obyekt/razdel kesimida ma'lumot yig'adi va filterlash funksiyasini
 * qo'llaydi.
 *
 * @returns Array of items, har biri:
 *   { mat, matLower, ed, plan, fakt, qoldiq, sumSmeta, sumFakt,
 *     details: [ { obyekt, razdel, konstruksiya, plan, fakt, qoldiq } ] }
 */
function _gatherData(filterFn) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var src     = ss.getSheetByName('Viborka_Shablon');
  if (!src) { SpreadsheetApp.getUi().alert("'Viborka_Shablon' topilmadi!"); return []; }

  var lastRow = src.getLastRow();
  if (lastRow < 2) return [];

  var data = src.getRange(2, 1, lastRow - 1, 16).getValues();

  // Birinchi pass: barcha qatorlarni tahlil qilib, materialKey bo'yicha guruh
  // groupedByMat[matKey] = { mat, ed, items: [ ...rows... ] }
  // Lekin filterlash uchun avval har bir qatorni tekshiramiz
  var lastBase = '';

  // Per-row tahlil
  var allItems = []; // har bir qator alohida
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var obyekt = String(row[1]).trim();
    var rawMat = String(row[5]).trim();
    if (!obyekt || !rawMat || rawMat === '0') continue;

    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;

    var marka  = String(row[6]).trim();
    var full   = resolved + (marka && marka !== '0' ? ' ' + marka : '');
    var clean  = AI_NormalizeName(full);
    if (!clean) continue;

    var razdel = String(row[3]).trim() || '—';
    var konstr = String(row[4]).trim() || '—';
    var ed     = normalizeUnit(String(row[7]).trim());
    var plan   = round2(row[8]);
    var fakt   = round2(row[9]);
    var sSm    = round2(row[12]);
    var sFa    = round2(row[13]);

    var qoldiq = round2(plan - fakt);
    if (qoldiq < 0) qoldiq = 0;

    allItems.push({
      obyekt: obyekt, razdel: razdel, konstr: konstr,
      mat: clean, matLower: clean.toLowerCase(),
      ed: ed, plan: plan, fakt: fakt, qoldiq: qoldiq,
      sumSmeta: sSm, sumFakt: sFa
    });
  }

  // FILTER: filterFn ni qo'llab, faqat mos keladiganlar
  var filtered = allItems.filter(function(it) {
    return filterFn(it);
  });

  // GURUHLASH: material+birlik bo'yicha
  // Maqsad: bitta material bo'yicha umumiy raqam + obyektlar tafsiloti
  var grouped = {};
  filtered.forEach(function(it) {
    var key = it.mat + '__' + it.ed;
    if (!grouped[key]) {
      grouped[key] = {
        mat: it.mat, matLower: it.matLower, ed: it.ed,
        plan: 0, fakt: 0, qoldiq: 0,
        sumSmeta: 0, sumFakt: 0,
        details: []
      };
    }
    var g = grouped[key];
    g.plan     = round2(g.plan     + it.plan);
    g.fakt     = round2(g.fakt     + it.fakt);
    g.qoldiq   = round2(g.qoldiq   + it.qoldiq);
    g.sumSmeta = round2(g.sumSmeta + it.sumSmeta);
    g.sumFakt  = round2(g.sumFakt  + it.sumFakt);
    g.details.push({
      obyekt: it.obyekt, razdel: it.razdel, konstr: it.konstr,
      plan: it.plan, fakt: it.fakt, qoldiq: it.qoldiq
    });
  });

  // Massivga aylantirish va saralash (defitsit kattaligi bo'yicha)
  var result = [];
  Object.keys(grouped).forEach(function(k) { result.push(grouped[k]); });
  result.sort(function(a, b) {
    if (b.qoldiq !== a.qoldiq) return b.qoldiq - a.qoldiq;
    return a.mat.localeCompare(b.mat, 'ru');
  });

  return result;
}


// ════════════════════════════════════════════════════════════
// HISOBOT YOZISH — PRO VERSIYA
// Progress bar · Aqlli xulosa · Rang kodi · Tafsilot
// ════════════════════════════════════════════════════════════

function _writeReport(items, title, mode) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Hisobot') || ss.insertSheet('Hisobot');
  sheet.clear();
  sheet.clearConditionalFormatRules();
  sheet.setHiddenGridlines(true);

  var today = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm');
  var COLS  = 9; // +1: Progress ustuni

  // ── Sarlavha ──────────────────────────────────────────────
  sheet.getRange(1, 1, 1, COLS).merge()
    .setValue('📊  ' + title)
    .setBackground('#0d47a1').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(1, 48);

  // ── Umumiy statistika ─────────────────────────────────────
  var totalP = 0, totalF = 0, totalSm = 0;
  var cntDef = 0, cntOk = 0, cntOver = 0;
  items.forEach(function(it) {
    totalP  = round2(totalP  + it.plan);
    totalF  = round2(totalF  + it.fakt);
    totalSm = round2(totalSm + it.sumSmeta);
    var pct = it.plan > 0 ? it.fakt / it.plan : 0;
    if (pct >= 0.98 && it.plan > 0)        cntOk++;
    else if (it.plan > 0 && pct > 1.20)    cntOver++;
    else if (it.qoldiq > 0)                cntDef++;
  });
  var overallPct = totalP > 0 ? Math.round(totalF / totalP * 100) : 0;

  // 4 ta mini-stat katak
  var statsRow = 2;
  var stats4 = [
    ['🧾  ' + items.length + ' хил\nматериал',   '#37474f', '#fff'],
    ['🆘  ' + cntDef + '\nдефицит',              '#c62828', '#fff'],
    ['✅  ' + cntOk  + '\nёпилган',              '#2e7d32', '#fff'],
    ['⚡  ' + overallPct + '%\nбажарилиш',       '#1565c0', '#fff']
  ];
  // Har biri 2 ustundan — jami 8 ustun (9-ustun: overlap ichida)
  var statWidths = [2, 2, 2, 2]; // 2+2+2+2 = 8, +1 = 9
  var colOffset = 1;
  stats4.forEach(function(s, i) {
    var w = statWidths[i];
    sheet.getRange(statsRow, colOffset, 1, w + (i === 3 ? 1 : 0)).merge()
      .setValue(s[0])
      .setBackground(s[1]).setFontColor(s[2])
      .setFontWeight('bold').setFontSize(12)
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setWrap(true);
    colOffset += w + (i === 3 ? 1 : 0);
  });
  sheet.setRowHeight(statsRow, 52);

  // Sana + PDF eslatma
  sheet.getRange(3, 1, 1, COLS).merge()
    .setValue(
      today + '  ·  ' +
      '📄 PDF uchun: ⚡ TITAN PRO → PDF qilish  ·  ' +
      '📱 WhatsApp/Telegram ga yuborish uchun: ⚡ TITAN PRO → Email yuborish'
    )
    .setBackground('#e8eaf6').setFontColor('#283593')
    .setFontSize(9).setHorizontalAlignment('center').setItalic(true);
  sheet.setRowHeight(3, 22);

  // ── Ustun sarlavhalari ────────────────────────────────────
  var HDR_ROW = 4;
  sheet.getRange(HDR_ROW, 1, 1, COLS)
    .setValues([[
      '№', 'Материал номи', 'Бир.',
      'Режа', 'Факт', 'Қолдиқ',
      'Прогресс (%)',
      'Смета',
      'Тафсилот: Объект / Бўлим  →  Р: | Ф: | Деф:'
    ]])
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(HDR_ROW, 40);

  if (items.length === 0) {
    sheet.getRange(HDR_ROW + 1, 1, 1, COLS).merge()
      .setValue('😊  Hech narsa topilmadi — bu yaxshi belgi! Filtrlarni o\'zgartiring.')
      .setFontStyle('italic').setHorizontalAlignment('center')
      .setFontColor('#555').setFontSize(12);
    sheet.setRowHeight(HDR_ROW + 1, 40);
    _setColumnWidthsPro(sheet);
    sheet.setFrozenRows(HDR_ROW);
    ss.setActiveSheet(sheet);
    return;
  }

  // ── Qatorlarni quramiz ────────────────────────────────────
  var rows    = [];
  var rowMeta = []; // { status, pct } — rang berish uchun
  var rowNum  = 1;

  items.forEach(function(it) {
    // Holat aniqlash
    var pct   = it.plan > 0 ? (it.fakt / it.plan) : 0;
    var pctR  = Math.round(pct * 100);
    var isOver = it.plan > 0 && pct > 1.20;
    var isOk   = pct >= 0.98 && it.plan > 0;
    var isDef  = it.qoldiq > 0 && !isOver;

    var status = isOver ? 'over' : (isOk ? 'ok' : (isDef ? 'def' : 'norm'));

    // Progress bar (10 ta blok)
    var barFill  = Math.min(10, Math.round(pct * 10));
    var bar      = '█'.repeat(barFill) + '░'.repeat(10 - barFill);
    var barLabel = pctR + '%  ' + bar;
    if (isOver)  barLabel = '⚠ ' + pctR + '%  ' + bar;
    if (isOk)    barLabel = '✅ ' + pctR + '%';

    // Tafsilot — eng mos formatda
    var lines = it.details
      .sort(function(a, b) { return b.qoldiq - a.qoldiq; })
      .map(function(d) {
        var pref = d.qoldiq > 0 ? '🔴 ' : (d.fakt >= d.plan * 0.98 ? '🟢 ' : '🟡 ');
        var k = (d.konstr && d.konstr !== '—' && d.konstr !== d.razdel)
                ? ' · ' + d.konstr : '';
        return pref + d.obyekt + ' / ' + d.razdel + k +
               '   →   Р:' + d.plan + ' | Ф:' + d.fakt + ' | Деф:' + d.qoldiq;
      });

    rows.push([
      rowNum++,
      it.mat,
      it.ed,
      it.plan,
      it.fakt,
      it.qoldiq > 0 ? it.qoldiq : (isOk ? '—' : 0),
      barLabel,
      it.sumSmeta,
      lines.join('\n')
    ]);
    rowMeta.push({ status: status, pct: pct });
  });

  // ── Yozish ────────────────────────────────────────────────
  var startRow = HDR_ROW + 1;
  var dataRange = sheet.getRange(startRow, 1, rows.length, COLS);
  dataRange.setValues(rows);
  dataRange.setVerticalAlignment('top').setWrap(true);
  dataRange.setBorder(true, true, true, true, false, true,
    '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);

  // Raqam formati
  sheet.getRange(startRow, 4, rows.length, 3).setNumberFormat('#,##0.##');
  sheet.getRange(startRow, 8, rows.length, 1).setNumberFormat('#,##0');

  // Holat bo'yicha rang berish + qator balandligi
  var cRules = [];
  var redRows = [], greenRows = [], amberRows = [];

  for (var j = 0; j < rows.length; j++) {
    var absRow = startRow + j;
    var meta   = rowMeta[j];
    var lc     = Math.max(1, String(rows[j][8]).split('\n').length);
    sheet.setRowHeight(absRow, Math.max(32, lc * 19 + 12));

    // Navbatma-navbat fon (yon-orqa)
    var baseBg = j % 2 === 0 ? '#f8f9fa' : '#ffffff';

    if (meta.status === 'ok') {
      sheet.getRange(absRow, 1, 1, COLS).setBackground('#e8f5e9');
    } else if (meta.status === 'over') {
      sheet.getRange(absRow, 1, 1, COLS).setBackground('#fff3e0');
    } else if (meta.status === 'def') {
      sheet.getRange(absRow, 1, 1, COLS).setBackground(baseBg);
      // Defitsit qoldig'i katta bo'lsa — birinchi katakni qizil qil
      if (rows[j][5] > 0) {
        sheet.getRange(absRow, 6).setBackground('#ffebee').setFontColor('#b71c1c');
      }
    } else {
      sheet.getRange(absRow, 1, 1, COLS).setBackground(baseBg);
    }

    // Progress ustuniga rang
    var progCell = sheet.getRange(absRow, 7);
    if (meta.status === 'ok')   progCell.setFontColor('#2e7d32');
    else if (meta.status === 'over') progCell.setFontColor('#e65100');
    else progCell.setFontColor('#1565c0');
  }

  // 9-ustun (Tafsilot) alig'ment
  sheet.getRange(startRow, 9, rows.length, 1)
    .setHorizontalAlignment('left').setVerticalAlignment('top');

  _setColumnWidthsPro(sheet);
  sheet.setFrozenRows(HDR_ROW);

  // ── AQLLI XULOSA (JAMI) ────────────────────────────────────
  // Bo'sh qator
  var blankRow = startRow + rows.length;
  sheet.setRowHeight(blankRow, 12);

  var totalRow = blankRow + 1;
  var deficit  = round2(totalP - totalF);
  var pctFmt   = totalP > 0 ? Math.round(totalF/totalP*100) + '%' : '—';
  sheet.getRange(totalRow, 1, 1, COLS)
    .setValues([[
      '', 'УМУМИЙ ЖАМИ — ' + items.length + ' хил',
      '', totalP, totalF,
      deficit > 0 ? deficit : '✅',
      pctFmt, totalSm,
      (cntDef ? '🔴 Дефицит: ' + cntDef + ' · ' : '') +
      (cntOk  ? '✅ Ёпилган: ' + cntOk  + ' · ' : '') +
      (cntOver ? '⚠ Перерасход: ' + cntOver : '')
    ]])
    .setBackground('#0d47a1').setFontColor('#ffffff').setFontWeight('bold')
    .setFontSize(12).setVerticalAlignment('middle');
  sheet.getRange(totalRow, 4, 1, 3).setNumberFormat('#,##0.##');
  sheet.getRange(totalRow, 8, 1, 1).setNumberFormat('#,##0');
  sheet.setRowHeight(totalRow, 40);

  // ── AQLLI MASLAHAT (oxirgi qator) ─────────────────────────
  var advRow = totalRow + 1;
  var advice = _buildAdvice(cntDef, cntOver, cntOk, items.length, overallPct);
  sheet.getRange(advRow, 1, 1, COLS).merge()
    .setValue('💡 ' + advice)
    .setBackground('#fffde7').setFontColor('#5f4339')
    .setFontStyle('italic').setFontSize(11)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(advRow, 36);

  // Hisobot varag'iga o'tish
  ss.setActiveSheet(sheet);
  sheet.getRange(1, 1).activate();

  ss.toast(
    '✅ ' + items.length + ' xil material · ' +
    cntDef + ' defitsit · ' + overallPct + '% bajarilish',
    '📊 Hisobot tayyor', 6
  );
}

// ── Aqlli maslahat matni ──────────────────────────────────────
function _buildAdvice(cntDef, cntOver, cntOk, total, pct) {
  if (total === 0) return 'Ma\'lumot topilmadi. Filtrni tekshiring.';
  if (cntDef === 0 && cntOver === 0) return 'Hammasi yopilgan yoki yetarli! Ajoyib natija.';
  var parts = [];
  if (cntDef > 0)  parts.push('🔴 ' + cntDef + ' xil material hali yetib kelmagan — snabjenetsga tezkor buyurtma kerak');
  if (cntOver > 0) parts.push('⚠ ' + cntOver + ' xil material rejadan oshib ketgan — tekshirib ko\'ring');
  if (pct < 30)    parts.push('Bajarilish ' + pct + '% — boshlang\'ich bosqich, hali vaqt bor');
  else if (pct > 80) parts.push('Bajarilish ' + pct + '% — loyiha yaqinlashmoqda, defitsitlarni jadal yopish kerak');
  return parts.join('  ·  ');
}

function _setColumnWidthsPro(sheet) {
  sheet.setColumnWidth(1,  40);   // №
  sheet.setColumnWidth(2,  280);  // Material
  sheet.setColumnWidth(3,  55);   // Birlik
  sheet.setColumnWidth(4,  85);   // Reja
  sheet.setColumnWidth(5,  85);   // Fakt
  sheet.setColumnWidth(6,  80);   // Qoldiq
  sheet.setColumnWidth(7,  160);  // Progress
  sheet.setColumnWidth(8,  110);  // Smeta
  sheet.setColumnWidth(9,  520);  // Tafsilot
}

// _setColumnWidthsPro funksiyasi yuqorida _writeReport bilan birgalikda joylashgan


// ════════════════════════════════════════════════════════════
// KATEGORIYA MATCHER
// ════════════════════════════════════════════════════════════

/**
 * Kategoriya kalit so'zi → matn tekshiruvchi funksiya qaytaradi.
 * Funksiya material nomini (lowercase) qabul qilib, mosligini qaytaradi.
 */
function _getCategoryMatcher(catKey) {
  switch (catKey) {
    case '__ALL__':
      return function(n) { return true; };

    case 'ALL_METAL':
      return function(n) {
        return /уголок|швеллер|двутавр|балка|профиль|лист|труба.*(сталь|электросвар|ппу|ø\d|бесшовн)|трубы стальные|арматура|катанка|сетка.*(кладочн|стал|арматур|метал)|профнастиль|закладн|зд-\d|шпилка|анкер|болт.*ø|поковк/.test(n) &&
               !/гкл|гвл|цсп|пп|пвх|пнд|полипроп/.test(n);
      };

    case 'ARMATURA':
      return function(n) { return /арматура|а-iii|а-ii|катанка|аш\d/.test(n); };

    case 'UGOLOK':
      return function(n) { return /уголок/.test(n); };

    case 'PROFIL':
      return function(n) {
        if (!/профиль/.test(n)) return false;
        if (/пвх|направляющ|стоечн|ud|cd|гкл/.test(n)) return false;
        return true;
      };

    case 'LIST':
      return function(n) {
        if (!/лист/.test(n)) return false;
        if (/гкл|гвл|цсп|фиброц|ламинат/.test(n)) return false;
        return true;
      };

    case 'TRUBA_ST':
      return function(n) {
        return /труб/.test(n) &&
               (/сталь|электросвар|ппу|бесшовн|ø\d|\d{2}х\d/.test(n)) &&
               !/пп|пвх|пнд|полипроп|канализ/.test(n);
      };

    case 'TRUBA_PL':
      return function(n) {
        return /труб/.test(n) && /пп|пвх|пнд|полипроп|полиэт|канализ/.test(n);
      };

    case 'ELEKTR':
      return function(n) {
        return /кабель|провод.*ввг|пугнп|ввгнг|трп-|светильник|лампа|люстр|щит.*(освещ|распред|управ)|автомат.*выключ|выключатель|розетк|гофра|труба.*вини|коробк.*(установ|распа|ответв)|лоток.*кабел|стойка кабел|полка кабел|инвертор|солнечная панель/.test(n);
      };

    case 'SANTEX':
      return function(n) {
        return /унитаз|биде|умывальник|мойка.*(стальн|керам)|смеситель|сифон|душ|писсуар|трап\s*ø|чаша напольн|водонагрев/.test(n);
      };

    case 'UTEPLITEL':
      return function(n) {
        return /минвата|минеральная вата|пеноплекс|пенопласт|пенополистирол|isocom|ппж|утеплит/.test(n);
      };

    case 'GIDRO':
      return function(n) {
        return /гидроизол|мембрана|рубероид|полиэтилен пленка|геотекстиль|plastguard/.test(n);
      };

    case 'OTDELKA':
      return function(n) {
        return /керамогранит|керамическая плитка|плитка.*(пол|керам|600|300)|гранитн.*плитк|плинтус|алюминиевый компози|фиброцемент|травертин|мрамор|гипсокартон/.test(n);
      };

    case 'VENT':
      return function(n) {
        return /вентилятор|воздуховод|диффузор|решетка.*(вытяжн|приточн|размер)|фанкойл|чиллер|шумоглушит|зонт.*прямоугол|кондицион|ос[её]вой/.test(n);
      };

    default:
      return function(n) { return true; };
  }
}


// ════════════════════════════════════════════════════════════
// YORDAMCHI
// ════════════════════════════════════════════════════════════

function _getUniqueValues(ss, colNum) {
  var sheet = ss.getSheetByName('Viborka_Shablon');
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var data = sheet.getRange(2, colNum, lastRow - 1, 1).getValues();
  var seen = {};
  var list = [];
  data.forEach(function(r) {
    var v = String(r[0]).trim();
    if (v && v !== '0' && !seen[v]) { seen[v] = true; list.push(v); }
  });
  return list.sort();
}

function _escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}