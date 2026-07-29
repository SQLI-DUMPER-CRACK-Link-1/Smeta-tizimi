/******************************************************************
 * TitanAI.js — Akt Generator AI Yordamchi (FINAL)
 * ==================================================================
 * Mavjud TitanAI.js ICHIDAGI HAMMASINI shu fayl bilan almashtiring,
 * so'ng bu yordamchi faylni (va eski TitanAI_TUZATILGAN.js ni) o'chiring.
 *
 * TUZATISHLAR:
 *  1) KONTEKST QISQA -> truncation yo'q (uslub maydonlari + oxirgi 15).
 *  2) DETERMINISTIK DUBLIKAT oldini olish (obyekt+ish nomi bo'yicha).
 *  3) KOMISSIYA AVTOMAT (aktDefaultsApply) -> akt darhol "tayyor".
 *  4) ⭐ BO'LIB YARATISH: bir martada KO'PI BILAN 6 ta akt; "juda ko'p"
 *     deb RAD ETMAYDI. "davom" bilan keyingilarini yaratish uchun
 *     yaratilgan akt nomlari (createdNames) qaytariladi.
 *
 * AIGateway (aiCall) orqali — API limitga chidamli.
 ******************************************************************/

function saveGeminiKey(key) {
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', String(key).trim());
  return { success: true, message: "API kalit muvaffaqiyatli saqlandi!" };
}

function checkGeminiKey_() {
  const key = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')
    || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error("Gemini API kaliti topilmadi. Sozlamalar bo'limidan kiriting.");
  return key;
}

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
      headerNames.forEach(h => { const c = headers[h] - 1; if (row[c]) obj[h] = row[c]; });
      if (obj[REY.WORK_NAME] || obj[REY.OBJECT_NAME]) selectedRows.push(obj);
    }
    return selectedRows;
  } catch (e) { return []; }
}

function _titanDupKey(obj, work) {
  function nrm(s){ return String(s||'').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, ''); }
  return nrm(obj) + '||' + nrm(work);
}

function askTitanAiForAct(promptText, base64Images, startDate, selectedObject) {
  try {
    checkGeminiKey_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);

    var reqId = PropertiesService.getScriptProperties().getProperty('CURRENT_REQ_ID');
    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Avvalgi aktlar xotirasi tekshirilmoqda...");

    const lastRow = sh.getLastRow();
    const headers = headerMap_(sh);
    const STYLE_FIELDS = [REY.OBJECT_NAME, REY.WORK_NAME, REY.PROJECT_DOC, REY.MATERIAL, REY.PROGRESS, REY.NEXT_WORK];
    const contextData = [];
    const existingKeys = {};
    let lastActNumber = 0;
    let targetMemory = null;

    if (lastRow > 1) {
      const lav = sh.getRange(lastRow, headers[REY.ACT_NUMBER]).getValue();
      lastActNumber = parseInt(lav) || 0;
      try {
        var cW = headers[REY.WORK_NAME], cO = headers[REY.OBJECT_NAME];
        if (cW && cO) {
          var aW = sh.getRange(2, cW, lastRow - 1, 1).getValues();
          var aO = sh.getRange(2, cO, lastRow - 1, 1).getValues();
          for (var z = 0; z < aW.length; z++) {
            var w = String(aW[z][0] || '').trim();
            if (w) existingKeys[_titanDupKey(aO[z][0], w)] = true;
          }
        }
      } catch (e) {}

      const startRow = Math.max(2, lastRow - 50);
      const values = sh.getRange(startRow, 1, lastRow - startRow + 1, sh.getLastColumn()).getDisplayValues();
      const headerNames = Object.keys(headers);
      for (const row of values) {
        const obj = {};
        headerNames.forEach(h => { const c = headers[h] - 1; if (row[c]) obj[h] = row[c]; });
        if (selectedObject && obj[REY.OBJECT_NAME] === selectedObject) targetMemory = obj;
        if (obj[REY.WORK_NAME]) {
          const slim = {};
          STYLE_FIELDS.forEach(f => { if (obj[f]) slim[f] = obj[f]; });
          contextData.push(slim);
        }
      }
    }
    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Xotira o'qildi: " + contextData.length + " ta uslub namunasi.");

    let baseDateStr = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');
    if (startDate) { const p = startDate.split('-'); if (p.length === 3) baseDateStr = `${p[2]}.${p[1]}.${p[0]}`; }

    const activeRows = getActiveSelectionData_();
    let selectedRowsText = "";
    if (activeRows.length > 0) selectedRowsText = `FOYDALANUVCHI BELGILAGAN QATORLAR (tahrirlash so'ralsa shularga e'tibor bering!):\n${JSON.stringify(activeRows, null, 2)}\n\n`;

    const contextSlim = contextData.slice(-15);

    const systemInstruction = `
Siz Qurilish bo'yicha Bosh Muhandis (Prorab) yordamchisisiz.
Vazifa: matn/rasmdan qurilish jarayonini tahlil qilib, AOSR aktlar yaratish yoki tahrirlash.
QOIDALAR (qat'iy!):
1. AOSR faqat "Yashirin ishlar" uchun (armatura, beton, fbs, monolit, setka va h.k.). Yashirin bo'lmaganga yaratmang.
2. Murakkab ishni QMQ/SNiP bo'yicha bir nechta mantiqiy, TO'G'RI KETMA-KETLIKDAGI aktga bo'ling.
3. Hajm (m2,m3), miqdor, sun'iy GOST YOZMANG. Faqat ish nomi va material.
4. OBYEKT berilgan bo'lsa yozing, bo'lmasa bo'sh qoldiring.
5. Boshlang'ich sana [ ${baseDateStr} ]. START_DATE/END_DATE ni MANTIQIY ketma-ketlikda (har keyingisi avvalgisidan keyin).
6. Obyekt/sana umuman bo'lmasa: [{"chat_message":"Aka, bu qaysi obyekt va qachon?"}]. Salomga ham shunday.
7. TAHRIRLASH: "M300 qil" kabi so'rovda ROW_NUMBER bilan JSON qaytaring.
8. FAQAT qat'iy JSON Array qaytaring.
9. "OLDINGI AKTLAR XOTIRASI" yoki "ALLAQACHON YARATILGAN" da bor ishni QAYTA YARATMANG.
10. PROGRESS/NEXT_WORK ni professional va BATAFSIL yozing (faqat hajm emas).
11. Siz rasm o'qiy olasiz. Joriy xabarda rasm bo'lmasa "rasm yo'q, qayta biriktiring" deng.
12. RASMDAN AYNAN o'qing (Примечание, chizma) — o'zingizdan to'qimang.
13. ⭐ BO'LIB YARATISH: BIR MARTADA KO'PI BILAN 6 TA akt yarating. Ishlar ko'p bo'lsa HAM "juda ko'p, bo'lib yozing" deb RAD ETMANG va bo'sh qaytarmang — eng birinchi navbatdagi (ketma-ketlik bo'yicha keyingi) 6 tagacha aktni yarating. Qolganini foydalanuvchi "davom" deganda davom ettirasiz.
14. Agar "ALLAQACHON YARATILGAN AKTLAR" ro'yxati berilgan bo'lsa — shu ketma-ketlikda ULARDAN KEYINGI aktlarni yarating, takrorlamang. Hammasi tugagan bo'lsa: [{"chat_message":"✅ Barcha aktlar yaratildi."}].

JSON kalitlari (Tahrirlashda ROW_NUMBER qo'shiladi):
[
  {"ROW_NUMBER":15,"OBJECT_NAME":"","WORK_NAME":"Наименование работ","PROJECT_DOC":"","MATERIAL":"Materiallar (hajmsiz)","NEXT_WORK":"","PROGRESS":"Qanday qilingani (hajmsiz)","START_DATE":"dd.MM.yyyy","END_DATE":"dd.MM.yyyy","DEVIATION":"Нет"}
]

${selectedRowsText}
OLDINGI AKTLAR XOTIRASI (faqat uslub uchun, oxirgi 15 ta):
${JSON.stringify(contextSlim, null, 2)}
`;

    const parts = [{ text: promptText }];
    if (base64Images && Array.isArray(base64Images)) {
      base64Images.forEach(img => {
        if (img) { const mt = img.split(';')[0].split(':')[1]; const d = img.split(',')[1]; parts.push({ inline_data: { mime_type: mt, data: d } }); }
      });
    }

    let selectedModel = (typeof GEMINI_MODEL !== 'undefined') ? GEMINI_MODEL : "gemini-2.5-flash";
    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Model: " + selectedModel + " (AIGateway orqali)...");

    let aiText = "";
    try {
      if (typeof aiCall !== 'function') throw new Error("AIGateway.js yuklanmagan!");
      aiText = aiCall({ model: selectedModel, parts: parts, system: systemInstruction, json: true, temp: 0.2, maxTok: 8192 });
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("unsupported mime type"))
        return { success: false, error: "AI Excel/Word ni o'qiy olmaydi. PDF qilib yuklang." };
      return { success: false, error: e.message || String(e) };
    }

    let acts;
    try {
      const m = aiText.match(/\[[\s\S]*\]/);
      acts = JSON.parse(m ? m[0] : aiText);
      if (!Array.isArray(acts)) acts = [acts];
    } catch (e) {
      acts = [];
      const rx = /\{[^{}]*\}/g; let mm;
      while ((mm = rx.exec(aiText)) !== null) { try { const o = JSON.parse(mm[0]); if (o && (o.WORK_NAME || o.chat_message)) acts.push(o); } catch (er) {} }
      if (acts.length === 0) return { success: true, message: aiText, actsCreated: false };
    }

    if (acts.length > 0 && acts[0].chat_message) return { success: true, message: acts[0].chat_message, actsCreated: false };

    acts = acts.filter(a => a && a.WORK_NAME);
    if (acts.length === 0) return { success: true, message: "AI aniq ish turini aniqlay olmadi.", actsCreated: false };

    if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Aktlar jadvalga yozilmoqda...");

    let startRowW = sh.getLastRow() + 1;
    let editCount = 0, newCount = 0, skipDup = 0;
    const createdNames = [], skippedNames = [];

    for (const act of acts) {
      var rs = PropertiesService.getScriptProperties().getProperty('REQ_START_TIME');
      var at = CacheService.getScriptCache().get('abort_time');
      if ((at && rs && parseInt(rs) < parseInt(at)) || (reqId && CacheService.getScriptCache().get('abort_' + reqId)))
        throw new Error("Foydalanuvchi jarayonni to'xtatdi");

      const isEdit = act.ROW_NUMBER && !isNaN(parseInt(act.ROW_NUMBER));
      if (!isEdit) {
        const dk = _titanDupKey(selectedObject || act[REY.OBJECT_NAME] || '', act.WORK_NAME);
        if (existingKeys[dk]) { skipDup++; skippedNames.push(act.WORK_NAME); if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "⏭ Dublikat: " + act.WORK_NAME); continue; }
        existingKeys[dk] = true;
      }

      let targetRow = startRowW;
      const payloadObj = {};
      if (isEdit) { targetRow = parseInt(act.ROW_NUMBER); editCount++; }
      else {
        lastActNumber++;
        payloadObj[REY.ACT_NUMBER] = lastActNumber;
        payloadObj[REY.STATUS] = "IMPORTED_NEW";
        payloadObj[REY.COMM_STATUS] = "Не отправлено";
        payloadObj[REY.LAST_SYNC] = new Date();
        payloadObj[REY.ERROR] = "";
        newCount++;
        createdNames.push(act.WORK_NAME);
      }
      for (const k in act) { if (k !== "ROW_NUMBER" && act[k]) payloadObj[k] = act[k]; }

      if (selectedObject && targetMemory && !isEdit) {
        payloadObj[REY.OBJECT_NAME] = selectedObject;
        [REY.TARGET_FOLDER_ID, REY.TARGET_FOLDER_PATH, REY.ACT_FOLDER_ID, REY.CUSTOMER_ORG,
         REY.GEN_NAME, REY.GEN_FIO, REY.GEN_POS, REY.SUB_NAME, REY.SUB_FIO, REY.SUB_POS,
         REY.TEX_FIO, REY.TEX_POS, REY.PROJ_ORG, REY.PROJ_FIO, REY.PROJ_POS
        ].forEach(f => { if (targetMemory[f]) payloadObj[f] = targetMemory[f]; });
      }

      writeRow_(sh, targetRow, payloadObj);
      sh.autoResizeRows(targetRow, 1);
      if (!isEdit) startRowW++;
      if (reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "💾 " + act.WORK_NAME);
    }

    let tayyorMsg = "";
    if (newCount > 0 && selectedObject && typeof aktDefaultsApply === 'function') {
      try { const ap = aktDefaultsApply(selectedObject);
        if (ap.toldirildi > 0) tayyorMsg += `\n🔧 Komissiya/papka ${ap.toldirildi} qatorga to'ldirildi.`;
        if (ap.tayyor > 0) tayyorMsg += `\n✅ ${ap.tayyor} ta akt yaratishga tayyor.`;
        else if (ap.shablonYoq) tayyorMsg += `\n⚠️ Komissiya shabloni yo'q — "komissiya sozla" deng.`;
      } catch (e) {}
    }

    let msg = [];
    if (newCount > 0) msg.push(`✅ ${newCount} ta yangi akt yaratildi`);
    if (editCount > 0) msg.push(`📝 ${editCount} tahrirlandi`);
    if (skipDup > 0) msg.push(`⏭ ${skipDup} dublikat o'tkazildi`);

    try { if (typeof aktSupabasePush === "function") aktSupabasePush(); } catch (e) {}

    return {
      success: true, count: acts.length,
      message: (msg.length ? msg.join(" · ") : "Bajarildi!") + tayyorMsg,
      actsCreated: newCount > 0,
      createdNames: createdNames   // ⭐ "davom" uchun
    };
  } catch (err) { return { success: false, error: err.message || String(err) }; }
}

function getAvailableObjects() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
  if (!sh) return [];
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const headers = headerMap_(sh);
  const c = headers[REY.OBJECT_NAME];
  if (!c) return [];
  const values = sh.getRange(2, c, lastRow - 1, 1).getValues();
  const s = new Set();
  values.forEach(r => { const v = String(r[0]).trim(); if (v) s.add(v); });
  return Array.from(s).sort();
}
