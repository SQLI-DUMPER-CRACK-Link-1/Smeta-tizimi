/**
 * ============================================================
 * FAYL: 1_CoreTitan_AI.gs
 * VERSION: 25.0 (DEEP ANALYSIS EDITION)
 * VAZIFASI: Real ma'lumotlarga asoslangan chuqur tahlil.
 *   - Metall: metr, shtuk, m² — hammasini to'g'ri aniqlaydi
 *   - Guruhlash: faqat (material + birlik) asosida — razdel emas
 *   - Umumiy zayavka: har bir material uchun qaysi
 *     obyekt/bo'lim/qancha kerak/qancha kelgan — yagona ustunda
 * ============================================================
 */

// ════════════════════════════════════════════════════════════
// BLOK A — MATEMATIK VA YORDAMCHI
// ════════════════════════════════════════════════════════════

function round2(num) {
  var v = parseFloat(String(num).replace(/,/g, '.').replace(/\s/g, ''));
  return (isNaN(v) || !isFinite(v)) ? 0 : Math.round(v * 100) / 100;
}

function normalizeUnit(unit) {
  var u = String(unit).toLowerCase().replace(/\s+/g, '').replace(/\./g, '');
  if (/^(т|тн|тонн)/.test(u))          return 'тн';
  if (/^(кг|килограмм)/.test(u))        return 'кг';
  // "м", "пм", "п/м", "пог" — бarchasi п/м
  if (/^(м$|пм|пм|п\/м|пог|погм)/.test(u)) return 'п/м';
  if (/^(м2|мкв|квм)/.test(u))          return 'м²';
  if (/^(м3|мкуб|кубм)/.test(u))        return 'м³';
  if (/^(шт|штук|д$|доно)/.test(u))     return 'шт';
  if (/^(кт|к-т|компл)/.test(u))        return 'компл.';
  if (/^(машч|маш-ч|маш\.ч)/.test(u))  return 'маш-ч';
  return unit.trim() || '—';
}

// ════════════════════════════════════════════════════════════
// BLOK B — "ТО ЖЕ" (DITTO) TIKLASH
// ════════════════════════════════════════════════════════════

function resolveDitto(current, prevFull) {
  var rx = /^(то\s+же|шундан|ушандан|тоже|ditto|--\/\/--)[,.\s-]*/i;
  if (!rx.test(current)) return current;
  if (!prevFull) return current;
  var suffix = current.replace(rx, '').trim();
  // Avvalgi nomning birinchi 3 so'zi (markirovkasiz asos)
  var base = prevFull.split(/\s+/).slice(0, 3).join(' ');
  return suffix ? (base + ' ' + suffix).trim() : prevFull;
}

// ════════════════════════════════════════════════════════════
// BLOK C — NORMALIZATSIYA (ENTITY RECOGNITION)
// ════════════════════════════════════════════════════════════

function AI_NormalizeName(name) {
  if (!name || name === '0') return '';
  var n = String(name).toUpperCase();

  // Lotin → Kirill (vizual o'xshash)
  var lt2cyr = {
    'X':'Х','C':'С','A':'А','O':'О','M':'М','P':'Р',
    'E':'Е','K':'К','B':'В','H':'Н','T':'Т','Y':'У'
  };
  for (var k in lt2cyr) n = n.split(k).join(lt2cyr[k]);

  // O'lchamlarni standartlash: "10 Х 100" → "10х100"
  n = n.replace(/(\d+)\s*[ХX*×]\s*(\d+)\s*[ХX*×]\s*(\d+)/g, '$1х$2х$3');
  n = n.replace(/(\d+)\s*[ХX*×]\s*(\d+)/g, '$1х$2');

  // Diametr: Д-12, Ф12, D=12, ∅12 → Ø12
  n = n.replace(/(?:Д\s*[-.]?\s*|Ф\s*|D\s*=?\s*|∅|Ø)(\d+(?:[.,]\d+)?)/g, 'Ø$1');

  // Qalinlik: ЛИСТ Т=6, ЛИСТ T6 → ЛИСТ t=6
  n = n.replace(/ЛИСТ\s*[ТT]\s*=?\s*(\d+)/g, 'ЛИСТ t=$1');

  // Qo'shtirnoq, \" → olib tashlash
  n = n.replace(/["""«»'']/g, '');

  // Ko'p bo'shliq va oxirdagi tinish
  n = n.replace(/\s{2,}/g, ' ').replace(/[.,;:\s]+$/, '').trim();

  // Formula himoya
  if (/^[=+\-@]/.test(n)) n = "'" + n;

  return n.charAt(0) + n.slice(1).toLowerCase();
}

// ════════════════════════════════════════════════════════════
// BLOK D — KATEGORIYALASH
// ════════════════════════════════════════════════════════════
//
// QOIDA: Barcha metallar "Металлопрокат — ..." bilan boshlanadi.
//   → Shunda Google Sheets da Колонка 2 bo'yicha filter qilinganda
//     barcha metallar bir guruhda chiqadi.
//
// Guruhlash kaliti matKey = cleanName + '__' + ed
//   (kategoriya kalitga KIRMAYDI — xuddi shu material boshqa bo'limda
//    bo'lsa ham bir qatorga yig'iladi)

function AI_Categorize(n, unit, razdel) {
  var nm = String(n).toLowerCase();
  var r  = String(razdel).toUpperCase().trim();

  // ── МЕТАЛЛОПРОКАТ ──────────────────────────────────────────

  // 1. Арматура / катанка
  if (/арматура|а-iii|а-ii|аш400|аш500|катанка/.test(nm))
    return 'Металлопрокат — Арматура';

  // 2. Уголок (стальной фасонный)
  if (/уголок/.test(nm))
    return 'Металлопрокат — Уголок стальной';

  // 3. Швеллер / Двутавр / Балка (металл)
  if (/швеллер|двутавр|балка.*(метал|стал)/.test(nm))
    return 'Металлопрокат — Швеллер / Балка';

  // 4. Профиль — МЕТАЛЛИЧЕСКИЙ (конструктивный)
  //    Признак: КЖ раздел, или большие размеры ≥50мм
  if (/профиль/.test(nm) && !/направляющ|стоечн|ud|cd|гкл|пвх/.test(nm)) {
    // Определяем размер первого числа в размере
    var dimM = nm.match(/(\d+)х(\d+)/);
    var bigDim = dimM && (parseInt(dimM[1]) >= 40 || parseInt(dimM[2]) >= 40);
    if (r === 'КЖ' || bigDim) return 'Металлопрокат — Профильные трубы';
    // Маленький профиль в АР — подрешётка фасада
    return 'Металлопрокат — Профили фасадные (АР)';
  }

  // 5. Труба СТАЛЬНАЯ
  if (/труба.*(сталь|электросвар|бесшовн|ф\d|φ\d|ппу)/.test(nm) ||
      /трубы стальные|стальные трубы/.test(nm) ||
      (/труба/.test(nm) && r === 'КЖ') ||
      (/труба/.test(nm) && /\d{2}х\d/.test(nm) && !/пп|пвх|пнд|полип/.test(nm)))
    return 'Металлопрокат — Трубы стальные';

  // 6. Лист стальной (НЕ ГКЛ, НЕ ЦСП)
  if (/лист/.test(nm) && !/гкл|гвл|цсп|фиброц|ламинат/.test(nm)) {
    if (/рифлен/.test(nm))   return 'Металлопрокат — Листовая сталь рифлёная';
    if (/оцинков/.test(nm))  return 'Металлопрокат — Листовая сталь оцинк.';
    return 'Металлопрокат — Листовая сталь';
  }

  // 7. Сетка металлическая / кладочная
  if (/сетка.*(кладочн|стал|арматур|метал|дорожн)/.test(nm) ||
      /кладочная сетка/.test(nm))
    return 'Металлопрокат — Сетки кладочные';

  // 8. Профнастиль
  if (/профнастиль|нс\d/.test(nm))
    return 'Металлопрокат — Профнастиль';

  // 9. Закладные / МК мелкие (гайки, болты, шпильки, анкеры)
  if (/закладн|зд-\d|поковк/.test(nm) ||
      (/анкер|шпилка|болт\s+\d|болт\s+ф|гайка|шайба/.test(nm) && /\d/.test(nm)))
    return 'Металлопрокат — Закладные и МК';

  // ── ПРОЧИЕ КАТЕГОРИИ ──────────────────────────────────────

  // Механизмы
  if (unit === 'маш-ч' ||
      /экскаватор|бульдозер|автомобил|самосвал|кран|погрузчик|каток|трактор/.test(nm))
    return 'Механизмы (маш-ч)';

  // Электрика
  if (/кабель|провод.*ввг|провод.*пугнп|ввгнг|нуп|трп-|светильник|лампа|люстр|щит.*освещ|щит.*распред|щит.*управ|автомат.*выключ|выключатель|розетк|гофра.*труб|труба.*вини|коробк.*(установ|распа|ответв|универс)|лоток.*кабел|стойка кабел|полка кабел/.test(nm))
    return 'Электротехника (ЭО/ЭС)';

  // Трубы пластиковые (ПП, ПВХ, ПНД)
  if (/труба.*(пп|пвх|пнд|полипроп|канализ|пластик|полиэт)/.test(nm) ||
      /трубы полипропилен/.test(nm))
    return 'Трубопровод — Трубы пластиковые';

  // Трубопровод арматура / фитинги
  if (/задвижка|вентил[ь ].*(запорн|шаров|муфт|пожарн)|кран.*(шаров|запорн|маевск|спуск)|клапан|муфта.*(переход|комбин|разъем|полипроп)|тройник|угольник|отвод\s+\d|фланец|фильтр.*(сетч|полипроп)|переход со стали/.test(nm))
    return 'Трубопровод — Арматура и фитинги';

  // Санфаянс
  if (/унитаз|биде|умывальник|мойка.*(стальн|керам)|смеситель|сифон|душ.*(поддон|смесит)|писсуар|трап\s+\d|чаша напольн/.test(nm))
    return 'Сантехника — Приборы';

  // Теплоизоляция
  if (/минеральная вата|минвата|пеноплекс|пенопласт|пенополистирол|isocom|ппж|утеплитель.*вспен|полужесткая минв/.test(nm))
    return 'Теплоизоляция';

  // Гидроизоляция
  if (/гидроизол|мембрана|рубероид|пленка.*полиэт|геотекстиль|plastguard/.test(nm))
    return 'Гидроизоляция';

  // Отделка полов
  if (/керамогранит|керамическая плитка|плитка.*(пол|керам|гранит|600х600|300х300)/.test(nm) ||
      /гранитн.*плитк|плинтус.*керам|плинтус.*резин|резинов.*плинтус/.test(nm))
    return 'Отделка — Полы';

  // Отделка стен/фасада
  if (/алюминиевый компози|фиброцемент|плита из травертин|гранит.*плитк.*фасад|декоратив.*решетка/.test(nm))
    return 'Отделка — Фасад';

  // ГКЛ / листовые
  if (/гипсокартон|гкл|гвл|цсп/.test(nm))
    return 'Листовые материалы (ГКЛ/ЦСП)';

  // Инертные
  if (/бетон|раствор|цемент|песок|щебень|гравий|смесь.*сух|клей.*плиточн/.test(nm))
    return 'Инертные материалы';

  // Вентиляция / ОВ
  if (/вентилятор|воздуховод|диффузор|решетка.*(вытяжн|приточн)|фанкойл|чиллер|шумоглушит|зонт.*прямоугол/.test(nm))
    return 'Вентиляция и кондиционирование (ОВ)';

  // Оборудование (ТХ)
  if (/холодильник|кофемашин|радиатор.*(бимет|секц)|насос.*(цирк|дренаж|подач)|привод.*(частотн|регул)|чиллер/.test(nm))
    return 'Инженерное оборудование';

  return 'Прочие (' + r + ')';
}

// ════════════════════════════════════════════════════════════
// BLOK E — ASOSIY ENGINE: runTitanAiPro()
// ════════════════════════════════════════════════════════════

function runTitanAiPro() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheetByName('Viborka_Shablon');
  if (!src) { SpreadsheetApp.getUi().alert("'Viborka_Shablon' topilmadi!"); return; }

  var lastRow = src.getLastRow();
  if (lastRow < 2) return;

  ss.toast('Ma\'lumotlar tahlil qilinyapti...', '📦 TITAN AI', -1);
  var data = src.getRange(2, 1, lastRow - 1, 16).getValues();

  // ── Ma'lumot tuzilmalari ──────────────────────────────────
  //
  // globalSvodka[matKey] = {
  //   kat, mat, ed,
  //   totalP, totalF,
  //   byObject: { objName: { razdel: { p, f } } }
  // }
  //
  // objectStore[objName][matKey] = {
  //   kat, mat, ed, p, f,
  //   constrs: [ { name, p, f } ]
  // }

  var globalSvodka = {};
  var objectStore  = {};
  var lastBase     = '';

  for (var i = 0; i < data.length; i++) {
    var row     = data[i];
    var objName = String(row[1]).trim();
    var rawMat  = String(row[5]).trim();

    if (!objName || objName === '0' || !rawMat || rawMat === '0') continue;

    // Ditto tiklash
    var resolved = resolveDitto(rawMat, lastBase);
    lastBase = resolved;

    var marka    = String(row[6]).trim();
    var fullName = resolved + (marka && marka !== '0' ? ' ' + marka : '');
    var clean    = AI_NormalizeName(fullName);
    if (!clean) continue;

    var razdel = String(row[3]).trim() || '—';
    var konstr = String(row[4]).trim() || '—';
    var ed     = normalizeUnit(String(row[7]).trim());
    var plan   = round2(row[8]);
    var fakt   = round2(row[9]);
    var cSmeta = round2(row[10]);
    var cFakt  = round2(row[11]);
    var sSm    = round2(row[12]);

    if (sSm === 0 && plan > 0 && cSmeta > 0) sSm = round2(plan * cSmeta);

    var kat = AI_Categorize(clean, ed, razdel);

    // Zamena belgisi P ustunidan (row[15])
    var pNote = String(row[15]).trim();
    var zamenaMatch = pNote.match(/🔄\s*(.+?)(?:\s*·|$)/);
    var zamenaName = zamenaMatch ? zamenaMatch[1].trim() : '';

    // ════ GURUHLASH KALITI: faqat material + birlik ════
    var matKey = clean + '__' + ed;

    // ── GLOBAL SVODKA ─────────────────────────────────────
    if (!globalSvodka[matKey]) {
      globalSvodka[matKey] = {
        kat: kat, mat: clean, ed: ed,
        totalP: 0, totalF: 0,
        byObject: {},
        zamena: ''
      };
    }
    var gs = globalSvodka[matKey];
    gs.totalP = round2(gs.totalP + plan);
    gs.totalF = round2(gs.totalF + fakt);
    if (zamenaName && !gs.zamena) gs.zamena = zamenaName;

    // Per-object, per-razdel
    if (!gs.byObject[objName])          gs.byObject[objName] = {};
    if (!gs.byObject[objName][razdel])  gs.byObject[objName][razdel] = { p: 0, f: 0 };
    gs.byObject[objName][razdel].p = round2(gs.byObject[objName][razdel].p + plan);
    gs.byObject[objName][razdel].f = round2(gs.byObject[objName][razdel].f + fakt);

    // ── OBJECT STORE ──────────────────────────────────────
    if (!objectStore[objName]) objectStore[objName] = {};
    if (!objectStore[objName][matKey]) {
      objectStore[objName][matKey] = {
        kat: kat, mat: clean, ed: ed, p: 0, f: 0,
        constrs: [], zamena: ''
      };
    }
    var om = objectStore[objName][matKey];
    om.p = round2(om.p + plan);
    om.f = round2(om.f + fakt);
    if (zamenaName && !om.zamena) om.zamena = zamenaName;

    // Konstruksiya (plan/fakt bilan)
    if (konstr && konstr !== '—' && konstr !== '0') {
      var found = null;
      for (var ci = 0; ci < om.constrs.length; ci++) {
        if (om.constrs[ci].name === konstr) { found = om.constrs[ci]; break; }
      }
      if (found) {
        found.p = round2(found.p + plan);
        found.f = round2(found.f + fakt);
      } else {
        om.constrs.push({ name: konstr, p: plan, f: fakt });
      }
    }
  }

  // ── Yozish ───────────────────────────────────────────────
  ss.toast('Z_ sahifalar yozilmoqda...', '📦 AI', -1);
  Object.keys(objectStore).forEach(function(name) {
    _writeObjectSheet(ss, name, objectStore[name]);
  });

  ss.toast('Umumiy svodka tayyorlanmoqda...', '📦 AI', -1);
  _writeSvodkaSheet(ss, globalSvodka);

  ss.toast(
    '✅ ' + Object.keys(objectStore).length + ' ta obyekt + Umumiy svodka tayyor!',
    '📦 TITAN AI', 6
  );
}

// ════════════════════════════════════════════════════════════
// BLOK F — UMUMIY SVODKA (Zayavka_Tizimi)
// ════════════════════════════════════════════════════════════
//
// Ustunlar:
//   1. №
//   2. Категория   ← bu ustun bo'yicha FILTER qiling!
//   3. Материал
//   4. Ед.
//   5. Жами режа   (barcha obyektlar)
//   6. Жами факт
//   7. Дефицит
//   8. Тафсилот — qaysi obyekt / bo'lim / qancha / qancha kelgan
//      Format: "Объект / Раздел → Р:123 | Ф:0 | Деф:123"
//              (har bir qator yangi satr bilan)

function _writeSvodkaSheet(ss, globalSvodka) {
  var sheet = ss.getSheetByName('Zayavka_Tizimi') || ss.insertSheet('Zayavka_Tizimi');
  sheet.clear();
  sheet.clearConditionalFormatRules();

  var today = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy HH:mm');
  var COLS  = 8;

  // ── Sarlavha ──────────────────────────────────────────────
  sheet.getRange(1, 1, 1, COLS).merge()
    .setValue('UMUMIY ZAYAVKA — BARCHA OBYEKTLAR  |  ' + today)
    .setBackground('#0d47a1').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  sheet.setRowHeight(1, 38);

  // Ikkinchi qator — izoh (filter qanday ishlatiladi)
  sheet.getRange(2, 1, 1, COLS).merge()
    .setValue('💡 Фильтр учун: 2-устун (Категория) бўйича "Металлопрокат" деб қидиринг — барча металл чиқади')
    .setBackground('#e8f5e9').setFontColor('#1b5e20').setFontStyle('italic')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(2, 26);

  // Ustun sarlavhalari
  sheet.getRange(3, 1, 1, COLS)
    .setValues([[
      '№', 'Категория', 'Материал', 'Ед.',
      'Жами\nрежа', 'Жами\nфакт', 'Дефицит',
      'Тафсилот по объектам: Объект / Раздел → Р: | Ф: | Деф:'
    ]])
    .setBackground('#1565c0').setFontColor('#ffffff').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(3, 48);

  // ── Ma'lumotlarni yig'ish va saralash ─────────────────────
  var items = [];
  Object.keys(globalSvodka).forEach(function(k) {
    var m = globalSvodka[k];
    // 98% filtr: to'liq yetkazilganlar chiqmasin
    if (m.totalP > 0 && (m.totalF / m.totalP) >= 0.98) return;
    var deficit = round2(m.totalP - m.totalF);
    if (deficit <= 0) return;
    items.push(m);
  });

  // Kategoriya → Material tartibida saralash
  items.sort(function(a, b) {
    var cc = a.kat.localeCompare(b.kat, 'ru');
    if (cc !== 0) return cc;
    return a.mat.localeCompare(b.mat, 'ru');
  });

  if (items.length === 0) {
    sheet.getRange(4, 1, 1, COLS).merge()
      .setValue('✅ Barcha materiallar 98%+ yetkazilgan — zayavka talab etilmaydi.')
      .setFontStyle('italic').setHorizontalAlignment('center').setFontColor('#2e7d32');
    return;
  }

  // ── Qatorlarni quramiz ────────────────────────────────────
  var rows   = [];
  var rowNum = 1;

  items.forEach(function(m) {
    var deficit = round2(m.totalP - m.totalF);

    // Tafsilot ustuni — har bir obyekt/bo'lim alohida satr
    var lines = [];
    var objNames = Object.keys(m.byObject).sort();
    objNames.forEach(function(objName) {
      var razMap   = m.byObject[objName];
      var razNames = Object.keys(razMap).sort();
      razNames.forEach(function(raz) {
        var d  = razMap[raz];
        var od = round2(d.p - d.f);
        if (od <= 0) return; // Yopilgan pozitsiyani ko'rsatmaymiz
        lines.push(
          objName + ' / ' + raz +
          '  →  Р: ' + d.p + '  |  Ф: ' + d.f + '  |  Деф: ' + od
        );
      });
    });

    rows.push([
      rowNum++,
      m.kat,
      m.mat,
      m.ed,
      m.totalP,
      m.totalF,
      deficit,
      lines.join('\n')
    ]);
  });

  // ── Google Sheets ga yozish ───────────────────────────────
  var startRow = 4;
  var dataRange = sheet.getRange(startRow, 1, rows.length, COLS);
  dataRange.setValues(rows);
  dataRange.setVerticalAlignment('top').setWrap(true);
  dataRange.setBorder(
    true, true, true, true, false, false,
    '#d0d0d0', SpreadsheetApp.BorderStyle.SOLID
  );

  // Raqam formati
  sheet.getRange(startRow, 5, rows.length, 3).setNumberFormat('#,##0.##');

  // Qator balandliklari — tafsilot uzunligiga qarab
  for (var j = 0; j < rows.length; j++) {
    var absRow    = startRow + j;
    var lineCount = Math.max(1, String(rows[j][7]).split('\n').length);
    sheet.setRowHeight(absRow, Math.max(28, lineCount * 18 + 10));
    // Juft qatorlar uchun yengil fon
    if (j % 2 === 0) {
      sheet.getRange(absRow, 1, 1, COLS).setBackground('#f4f6fb');
    }
  }

  // Defitsit ustuni — yashil rang
  var defRange = sheet.getRange(startRow, 7, rows.length, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberGreaterThan(0)
      .setBackground('#e8f5e9').setFontColor('#1b5e20')
      .setRanges([defRange]).build()
  ]);

  // ── Ustun kengliklari ─────────────────────────────────────
  sheet.setColumnWidth(1,  42);   // №
  sheet.setColumnWidth(2,  260);  // Kategoria — filtr shu yerda!
  sheet.setColumnWidth(3,  310);  // Material
  sheet.setColumnWidth(4,  65);   // Birlik
  sheet.setColumnWidth(5,  100);  // Reja
  sheet.setColumnWidth(6,  100);  // Fakt
  sheet.setColumnWidth(7,  100);  // Defitsit
  sheet.setColumnWidth(8,  520);  // Tafsilot — keng!

  sheet.setFrozenRows(3);

  // ── JAMI QATORI ───────────────────────────────────────────
  var totalRow = startRow + rows.length;
  var grandP   = round2(items.reduce(function(s,m){ return s + m.totalP; }, 0));
  var grandF   = round2(items.reduce(function(s,m){ return s + m.totalF; }, 0));
  var grandD   = round2(grandP - grandF);

  sheet.getRange(totalRow, 1, 1, COLS)
    .setValues([[
      '', 'УМУМИЙ ЖАМИ  (' + items.length + ' хил материал)',
      '', '', grandP, grandF, grandD,
      'Жами дефицит сумма | Фильтр: устун 2 → "Металлопрокат" — барча металл'
    ]])
    .setBackground('#0d47a1').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(totalRow, 5, 1, 3).setNumberFormat('#,##0.##');
  sheet.setRowHeight(totalRow, 34);
}

// ════════════════════════════════════════════════════════════
// BLOK G — Z_OBYEKT SAHIFASI
// ════════════════════════════════════════════════════════════

function _writeObjectSheet(ss, objName, materials) {
  var sheetName = ('Z_' + objName).substring(0, 30).trim();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  var today = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');
  var COLS  = 10;

  // ── Sarlavha ──────────────────────────────────────────────
  sheet.getRange(1, 1, 1, COLS).merge()
    .setValue('ЗАЙАВКА: ' + objName.toUpperCase() + '  (санаси: ' + today + ')')
    .setBackground('#1a56a0').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  sheet.setRowHeight(1, 36);

  sheet.getRange(2, 1, 1, COLS)
    .setValues([[
      '№', 'Категория', 'Материал', 'Ед.',
      'Режа', 'Факт', 'Қолдиқ', 'Статус',
      'Конструкциялар (Режа / Факт)', '🔄 Замена'
    ]])
    .setBackground('#2b6cb0').setFontColor('#ffffff')
    .setFontWeight('bold').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(2, 44);

  // ── Ma'lumotlar ───────────────────────────────────────────
  var rows = [];
  Object.keys(materials).sort().forEach(function(k) {
    var m = materials[k];

    // 98% FILTR
    if (m.p > 0 && (m.f / m.p) >= 0.98) return;
    var ostatok = round2(m.p - m.f);
    if (ostatok <= 0) return;

    // Bajarilish foizi
    var pct    = m.p > 0 ? Math.round(m.f / m.p * 100) : 0;
    var status = pct === 0 ? '⏳ Kutilmoqda' :
                 pct < 50  ? '🟡 ' + pct + '% kelgan' :
                             '🔵 ' + pct + '% kelgan';

    // Konstruksiyalar — "Nom (Р:X, Ф:Y)"
    var constrText = m.constrs.map(function(c) {
      return c.name + ' (Р: ' + c.p + ', Ф: ' + c.f + ')';
    }).join(';\n');

    rows.push([
      rows.length + 1,
      m.kat,
      m.mat,
      m.ed,
      m.p,
      m.f,
      ostatok,
      status,
      constrText,
      m.zamena ? '🔄 ' + m.zamena : ''
    ]);
  });

  if (rows.length > 0) {
    var dataRange = sheet.getRange(3, 1, rows.length, COLS);
    dataRange.setValues(rows);

    // Raqam formati
    sheet.getRange(3, 5, rows.length, 3).setNumberFormat('#,##0.##');

    // Chegara
    sheet.getRange(1, 1, rows.length + 2, COLS)
      .setBorder(true, true, true, true, true, true,
                 '#c0c0c0', SpreadsheetApp.BorderStyle.SOLID);

    // Defitsit — yashil
    var oRange = sheet.getRange(3, 7, rows.length, 1);
    sheet.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setBackground('#e8f5e9').setFontColor('#1b5e20')
        .setRanges([oRange]).build()
    ]);

    dataRange.setWrap(true).setVerticalAlignment('top');

  } else {
    sheet.getRange(3, 1, 1, COLS).merge()
      .setValue('✅ Barcha materiallar 98%+ yetkazilgan.')
      .setFontStyle('italic').setHorizontalAlignment('center').setFontColor('#2e7d32');
  }

  // Ustun kengliklari
  sheet.setColumnWidth(1,  40);
  sheet.setColumnWidth(2,  230);
  sheet.setColumnWidth(3,  290);
  sheet.setColumnWidth(4,  65);
  sheet.setColumnWidth(5,  85);
  sheet.setColumnWidth(6,  85);
  sheet.setColumnWidth(7,  90);
  sheet.setColumnWidth(8,  110);
  sheet.setColumnWidth(9,  320);
  sheet.setFrozenRows(2);
}