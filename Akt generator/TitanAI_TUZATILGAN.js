/******************************************************************
 * TitanAI.js - Akt Generator uchun AI Yordamchi (TUZATILGAN)
 * ==================================================================
 * Bu — TitanAI.js ning TO'LIQ tuzatilgan versiyasi. Mavjud TitanAI.js
 * ichidagi HAMMASINI shu fayl bilan almashtiring, so'ng bu yordamchi
 * faylni o'chiring (loyihada bitta TitanAI.js qolsin).
 *
 * TUZATISHLAR (3 ildiz muammo):
 *  1) KONTEKST QISQARTIRILDI -> "javob uzilib qoldi" (truncation) yo'qoladi:
 *     AI'ga endi oxirgi 50 ta aktning TO'LIQ ustunlari emas, faqat USLUB
 *     maydonlari va OXIRGI 15 tasi yuboriladi. (targetMemory TO'LIQ qoladi —
 *     komissiya/papka ko'chirish uchun.) Token ~5-10x kamayadi.
 *  2) DETERMINISTIK DUBLIKAT OLDINI OLISH: bir xil OBYEKT+ish nomi bo'lgan
 *     yangi aktni qayta YARATMAYDI (AI qoidasiga tayanmasdan).
 *  3) KOMISSIYA AVTOMAT: yaratgandan keyin aktDefaultsApply(obyekt) chaqirilib,
 *     qatorlar darhol "yaratishga tayyor" bo'ladi (bo'sh FIO/papka muammosi yo'q).
 *
 * AIGateway (aiCall) orqali — API limitga chidamli (throttle+backoff+fallback).
 ******************************************************************/

function saveGeminiKey(key) {
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', String(key).trim());
  return { success: true, message: "API kalit muvaffaqiyatli saqlandi!" };
}

function checkGeminiKey_() {
  const key = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')
    || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error("Gemini API kaliti topilmadi. Iltimos, Sozlamalar bo'limidan kiritib qo'ying.");
  return key;
}

/** REYESTR dagi tanlangan qatorlar (tahrirlash uchun). */
function getActiveSelectionData_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
    if (ss.getActiveSheet().getName() !== CONFIG.REYESTR_SHEET) return [];

    const range = sh.getActiveRange();
    const startRow = range.getRow();
    if (startRow <= 1) return [];

    const headers = headerMap_(sh);
    const headerNames = Object.keys(headers);
    const values = sh.getRange(startRow, 1, range.getNumRows(), sh.getLastColumn()).getDisplayValues();

    const selectedRows = [];
    for (let i = 0; i < values.length; i++) {
      const rowNum = startRow + i;
      if (rowNum === 1) continue;
      const row = values[i];
      const obj = { ROW_NUMBER: rowNum };
      headerNames.forEach(h => { const colIdx = headers[h] - 1; if (row[colIdx]) obj[h] = row[colIdx]; });
      if (obj[REY.WORK_NAME] || obj[REY.OBJECT_NAME]) selectedRows.push(obj);
    }
    return selectedRows;
  } catch (e) { return []; }
}

/** Dublikat kaliti — normalizatsiya (katta harf, faqat harf/raqam). */
function _titanDupKey(obj, work) {
  function nrm(s){ return String(s||'').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, ''); }
  return nrm(obj) + '||' + nrm(work);
}

/**
 * Chatdan kelgan matn va rasm(lar) asosida yangi aktlar yaratadi / tahrirlaydi.
 * @param {string} promptText
 * @param {Array|string} base64Images - bir yoki bir nechta b64 rasm
 * @param {string} startDate - yyyy-mm-dd
 * @param {string} selectedObject
 */
function askTitanAiForAct(promptText, base64Images, startDate, selectedObject) {
  try {
    checkGeminiKey_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);

    var reqId = PropertiesService.getScriptProperties().getProperty('CURRENT_REQ_ID');
    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Avvalgi aktlar xotirasi tekshirilmoqda...");

    const lastRow = sh.getLastRow();
    const headers = headerMap_(sh);

    // FIX#1 — AI'ga faqat USLUB maydonlari ketadi (token tejash, truncation yo'q)
    const STYLE_FIELDS = [REY.OBJECT_NAME, REY.WORK_NAME, REY.PROJECT_DOC, REY.MATERIAL, REY.PROGRESS, REY.NEXT_WORK];
    const contextData = [];   // slim (uslub)
    const existingKeys = {};   // FIX#2 — dublikat oldini olish uchun

    let lastActNumber = 0;
    let targetMemory = null;   // TO'LIQ qator (komissiya/papka ko'chirish uchun)

    if (lastRow > 1) {
      const lastActVal = sh.getRange(lastRow, headers[REY.ACT_NUMBER]).getValue();
      lastActNumber = parseInt(lastActVal) || 0;

      // Dublikat kalitlari uchun BUTUN OBYEKT+ish nomini o'qiymiz (yengil: 2 ustun)
      try {
        var cW = headers[REY.WORK_NAME], cO = headers[REY.OBJECT_NAME];
        if (cW && cO) {
          var allW = sh.getRange(2, cW, lastRow - 1, 1).getValues();
          var allO = sh.getRange(2, cO, lastRow - 1, 1).getValues();
          for (var z = 0; z < allW.length; z++) {
            var w = String(allW[z][0] || '').trim();
            if (w) existingKeys[_titanDupKey(allO[z][0], w)] = true;
          }
        }
      } catch (e) {}

      // Uslub (style) konteksti — oxirgi 50 qator, lekin faqat slim maydonlar
      const startRow = Math.max(2, lastRow - 50);
      const rowCount = lastRow - startRow + 1;
      const values = sh.getRange(startRow, 1, rowCount, sh.getLastColumn()).getDisplayValues();
      const headerNames = Object.keys(headers);

      for (const row of values) {
        const obj = {};
        headerNames.forEach(h => { const colIdx = headers[h] - 1; if (row[colIdx]) obj[h] = row[colIdx]; });

        // Tanlangan obyekt uchun eng to'liq qatorni TO'LIQ saqlaymiz (komissiya manbai)
        if (selectedObject && obj[REY.OBJECT_NAME] === selectedObject) targetMemory = obj;

        if (obj[REY.WORK_NAME]) {
          const slim = {};
          STYLE_FIELDS.forEach(f => { if (obj[f]) slim[f] = obj[f]; });
          contextData.push(slim);
        }
      }
    }

    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Baza qidirildi: " + contextData.length + " ta xotira (uslub) o'qildi.");

    // Sana
    let baseDateStr = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');
    if (startDate) { const p = startDate.split('-'); if (p.length === 3) baseDateStr = `${p[2]}.${p[1]}.${p[0]}`; }

    // Tanlangan qatorlar (tahrirlash)
    const activeRows = getActiveSelectionData_();
    let selectedRowsText = "";
    if (activeRows.length > 0) {
      selectedRowsText = `FOYDALANUVCHI BELGILAGAN QATORLAR (tahrirlash so'ralsa, shularga e'tibor bering!):\n${JSON.stringify(activeRows, null, 2)}\n\n`;
    }

    // FIX#1 — faqat oxirgi 15 ta uslub namunasi
    const contextSlim = contextData.slice(-15);

    const systemInstruction = `
Siz Qurilish bo'yicha Bosh Muhandis (Prorab) yordamchisisiz.
Vazifangiz: Foydalanuvchi matni va rasmidan qurilish jarayonlarini tahlil qilib, Akt (AOSR) yaratish yoki tahrirlash.
QOIDALAR (Qat'iy rioya qiling!):
1. AOSR MANTIQI: AOSR faqat "Yashirin ishlar" uchun (Karkas, Armatura, Beton va h.k.). Bo'yoq kabi yashirin bo'lmagan ishga AOSR YARATMANG (foydalanuvchi qat'iy so'rasagina).
2. MANTIQIY BO'LINISH: Murakkab ish bo'lsa QMQ/SNiP bo'yicha bir nechta aktga bo'ling.
3. ORTIQCHA MA'LUMOTSIZ: Aktga HAJM (m2, m3), miqdor, sun'iy GOST raqam YOZMANG. Faqat ish nomi va material.
4. OBYEKT: Berilgan bo'lsa yozing, bo'lmasa bo'sh qoldiring (dastur to'ldiradi).
5. SANA: Boshlang'ich sana [ ${baseDateStr} ]. Mantiqiy ketma-ketlikda START_DATE va END_DATE.
6. MA'LUMOT YETISHMASA: Obyekt va sana umuman bo'lmasa, akt yaratmang. JSON da so'rang: [{"chat_message": "Aka, bu ish qaysi obyekt uchun va sanasi qachon?"}]. Salomlashsa ham shu shaklda.
7. TAHRIRLASH: "5 kubga o'zgartir", "betonni M300 qil" kabi so'rovda JSON Array qaytaring va "ROW_NUMBER" ni ko'rsating. Yangi yaratishda ROW_NUMBER bo'lmaydi.
8. FORMAT: Faqat qat'iy JSON Array qaytaring.
9. TAKRORLAMANG: 'OLDINGI AKTLAR XOTIRASI' da aynan shu ish (WORK_NAME) bo'lsa, qaytadan YARATMANG.
10. BATAFSIL YOZING: PROGRESS va NEXT_WORK ni professional, to'liq yozing (faqat hajm emas, butun izoh).
11. RASM: Siz rasmlarni o'qiy olasiz. Joriy xabarda rasm bo'lmasa-yu, foydalanuvchi "rasmni o'qimadingmi" desa: "Bu xabarda rasm yo'q, qayta biriktiring" deng.
12. RASMDAN AYNAN O'QING: Rasm (smeta/loyiha/chizma) bo'lsa, o'zingizdan to'qimang! "Примечание" va chizma ma'lumotini topib, PROGRESS/WORK_NAME ga AYNAN o'shani yozing.

Qaytariladigan JSON Array kalitlari (Tahrirlashda ROW_NUMBER qo'shiladi):
[
  {
    "ROW_NUMBER": 15,
    "OBJECT_NAME": "Наименование объекта",
    "WORK_NAME": "Наименование работ",
    "PROJECT_DOC": "Shifr proyekta",
    "MATERIAL": "Materiallar (Hajmlarsiz)",
    "NEXT_WORK": "Keyingi ish",
    "PROGRESS": "Qanday materiallardan qilinganligi (Hajmsiz)",
    "START_DATE": "Boshlanish sanasi (dd.MM.yyyy)",
    "END_DATE": "Tugash sanasi (dd.MM.yyyy)",
    "DEVIATION": "Нет"
  }
]

${selectedRowsText}
FOYDALANUVCHINING OLDINGI AKTLARI XOTIRASI (faqat uslub uchun, oxirgi 15 ta):
${JSON.stringify(contextSlim, null, 2)}
`;

    // Payload (matn + rasm(lar))
    const parts = [{ text: promptText }];
    if (base64Images && Array.isArray(base64Images)) {
      base64Images.forEach(img => {
        if (img) {
          const mimeType = img.split(';')[0].split(':')[1];
          const dataStr = img.split(',')[1];
          parts.push({ inline_data: { mime_type: mimeType, data: dataStr } });
        }
      });
    }

    let selectedModel = (typeof GEMINI_MODEL !== 'undefined') ? GEMINI_MODEL : "gemini-2.5-flash";
    if (reqId && typeof aktLogStep === 'function') {
      aktLogStep(reqId, "Model: " + selectedModel + " tanlandi.");
      aktLogStep(reqId, "API ulanishi (AIGateway orqali)...");
    }

    // API — AIGateway (throttle + backoff + fallback)
    let aiText = "";
    try {
      if (typeof aiCall !== 'function') throw new Error("AIGateway.js yuklanmagan!");
      aiText = aiCall({ model: selectedModel, parts: parts, system: systemInstruction, json: true, temp: 0.2, maxTok: 8192 });
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("unsupported mime type")) {
        return { success: false, error: "AI Excel/Word ni to'g'ridan o'qiy olmaydi. Iltimos PDF qilib yuklang." };
      }
      return { success: false, error: e.message || String(e) };
    }

    // JSON ajratish (+ salvage)
    let extractedActs;
    try {
      const m = aiText.match(/\[[\s\S]*\]/);
      extractedActs = JSON.parse(m ? m[0] : aiText);
      if (!Array.isArray(extractedActs)) extractedActs = [extractedActs];
      if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "AI dan " + extractedActs.length + " ta struktura qabul qilindi.");
    } catch (e) {
      extractedActs = [];
      const objRegex = /\{[^{}]*\}/g; let match;
      while ((match = objRegex.exec(aiText)) !== null) {
        try { const o = JSON.parse(match[0]); if (o && o.WORK_NAME) extractedActs.push(o); } catch (err) {}
      }
      if (extractedActs.length === 0) {
        return { success: true, message: aiText, actsCreated: false };
      }
      if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Javob qisman uzildi, " + extractedActs.length + " ta akt qutqarildi.");
    }

    if (extractedActs.length > 0 && extractedActs[0].chat_message) {
      return { success: true, message: extractedActs[0].chat_message, actsCreated: false };
    }

    extractedActs = extractedActs.filter(a => a && Object.keys(a).length > 0 && a.WORK_NAME);
    if (extractedActs.length === 0) {
      return { success: true, message: "AI bu ma'lumotdan aniq ish turini aniqlay olmadi.", actsCreated: false };
    }

    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Aktlar jadvalga yozilmoqda...");

    let startRowW = sh.getLastRow() + 1;
    let editCount = 0, newCount = 0, skipDup = 0;
    const skippedNames = [];

    for (const act of extractedActs) {
      // To'xtatish (abort) tekshiruvi
      var reqStart = PropertiesService.getScriptProperties().getProperty('REQ_START_TIME');
      var abortTime = CacheService.getScriptCache().get('abort_time');
      var isGloballyAborted = (abortTime && reqStart && parseInt(reqStart) < parseInt(abortTime));
      var isLocallyAborted = (reqId && CacheService.getScriptCache().get('abort_' + reqId));
      if (isGloballyAborted || isLocallyAborted) throw new Error("Foydalanuvchi barcha jarayonlarni to'xtatdi");

      const isEdit = act.ROW_NUMBER && !isNaN(parseInt(act.ROW_NUMBER));

      // FIX#2 — yangi akt dublikatmi? (tahrirlash bundan mustasno)
      if (!isEdit) {
        const objForKey = (selectedObject || act[REY.OBJECT_NAME] || '');
        const dk = _titanDupKey(objForKey, act.WORK_NAME);
        if (existingKeys[dk]) {
          skipDup++; skippedNames.push(act.WORK_NAME);
          if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "⏭ Dublikat o'tkazildi: " + act.WORK_NAME);
          continue;
        }
        existingKeys[dk] = true; // shu sessiyada qayta yaratilmasin
      }

      let targetRow = startRowW;
      const payloadObj = {};

      if (isEdit) {
        targetRow = parseInt(act.ROW_NUMBER);
        editCount++;
      } else {
        lastActNumber++;
        payloadObj[REY.ACT_NUMBER] = lastActNumber;
        payloadObj[REY.STATUS] = "IMPORTED_NEW";
        payloadObj[REY.COMM_STATUS] = "Не отправлено";
        payloadObj[REY.LAST_SYNC] = new Date();
        payloadObj[REY.ERROR] = "";
        newCount++;
      }

      for (const key in act) { if (key !== "ROW_NUMBER" && act[key]) payloadObj[key] = act[key]; }

      // Komissiya/papkani xotiradan ko'chirish (tanlangan obyekt)
      if (selectedObject && targetMemory && !isEdit) {
        payloadObj[REY.OBJECT_NAME] = selectedObject;
        const criticalFields = [
          REY.TARGET_FOLDER_ID, REY.TARGET_FOLDER_PATH, REY.ACT_FOLDER_ID,
          REY.CUSTOMER_ORG, REY.GEN_NAME, REY.GEN_FIO, REY.GEN_POS,
          REY.SUB_NAME, REY.SUB_FIO, REY.SUB_POS,
          REY.TEX_FIO, REY.TEX_POS, REY.PROJ_ORG, REY.PROJ_FIO, REY.PROJ_POS
        ];
        criticalFields.forEach(f => { if (targetMemory[f]) payloadObj[f] = targetMemory[f]; });
      }

      writeRow_(sh, targetRow, payloadObj);
      sh.autoResizeRows(targetRow, 1);
      if (!isEdit) startRowW++;
      if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "💾 Saqlandi: " + act.WORK_NAME);
    }

    // FIX#3 — komissiya/papka defaults avtomat to'ldirish (akt darhol "tayyor" bo'lsin)
    let tayyorMsg = "";
    if (newCount > 0 && selectedObject && typeof aktDefaultsApply === 'function') {
      try {
        const ap = aktDefaultsApply(selectedObject);
        if (ap.toldirildi > 0) tayyorMsg += `\n🔧 Komissiya/papka ${ap.toldirildi} qatorga to'ldirildi.`;
        if (ap.tayyor > 0) tayyorMsg += `\n✅ ${ap.tayyor} ta akt "yaratishga tayyor".`;
        else if (ap.shablonYoq) tayyorMsg += `\n⚠️ Komissiya shabloni yo'q — "komissiya sozla" deb yozing.`;
      } catch (e) {}
    }

    let resultMessage = [];
    if (newCount > 0) resultMessage.push(`✅ ${newCount} ta yangi akt yaratildi`);
    if (editCount > 0) resultMessage.push(`📝 ${editCount} ta akt tahrirlandi`);
    if (skipDup > 0) resultMessage.push(`⏭ ${skipDup} ta dublikat o'tkazildi (${skippedNames.slice(0,3).join(', ')}${skippedNames.length>3?'...':''})`);

    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "✅ Yakunlandi!");

    try { if (typeof aktSupabasePush === "function") aktSupabasePush(); } catch (e) { console.error("Supabase push: " + e.message); }

    return {
      success: true,
      count: extractedActs.length,
      message: (resultMessage.length > 0 ? resultMessage.join(" · ") : "Bajarildi!") + tayyorMsg,
      actsCreated: newCount > 0
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/** REYESTR dagi unikal obyekt nomlari (UI uchun). */
function getAvailableObjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = headerMap_(sh);
  const objColIdx = headers[REY.OBJECT_NAME];
  if (!objColIdx) return [];
  const values = sh.getRange(2, objColIdx, lastRow - 1, 1).getValues();
  const objSet = new Set();
  values.forEach(row => { const val = String(row[0]).trim(); if (val) objSet.add(val); });
  return Array.from(objSet).sort();
}
