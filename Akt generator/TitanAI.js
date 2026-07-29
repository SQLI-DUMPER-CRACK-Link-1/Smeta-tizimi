/*******************************************************
 * TitanAI.js - Akt Generator uchun AI Yordamchi
 * Gemini 1.5 Pro API integratsiyasi
 *******************************************************/

function saveGeminiKey(key) {
  PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', String(key).trim());
  return { success: true, message: "API kalit muvaffaqiyatli saqlandi!" };
}

function checkGeminiKey_() {
  const key = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY');
  if (!key) throw new Error("Gemini API kaliti topilmadi. Iltimos, Sozlamalar bo'limidan kiritib qo'ying.");
  return key;
}

/**
 * Returns the currently selected rows in the REYESTR sheet.
 */
function getActiveSelectionData_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
    if (ss.getActiveSheet().getName() !== CONFIG.REYESTR_SHEET) return [];
    
    const range = sh.getActiveRange();
    const startRow = range.getRow();
    const endRow = startRow + range.getNumRows() - 1;
    
    if (startRow <= 1) return []; // Header row
    
    const headers = headerMap_(sh);
    const headerNames = Object.keys(headers);
    const values = sh.getRange(startRow, 1, range.getNumRows(), sh.getLastColumn()).getDisplayValues();
    
    const selectedRows = [];
    for (let i = 0; i < values.length; i++) {
      const rowNum = startRow + i;
      if (rowNum === 1) continue; // Skip header
      const row = values[i];
      const obj = { ROW_NUMBER: rowNum };
      headerNames.forEach(h => {
        const colIdx = headers[h] - 1;
        if (row[colIdx]) obj[h] = row[colIdx];
      });
      // Only include if it has at least WORK_NAME or OBJECT_NAME
      if (obj[REY.WORK_NAME] || obj[REY.OBJECT_NAME]) {
        selectedRows.push(obj);
      }
    }
    return selectedRows;
  } catch (e) {
    return [];
  }
}

/**
 * Chatdan kelgan matn va rasm asosida yangi aktlar yaratadi.
 * @param {string} promptText - Foydalanuvchining so'rovi
 * @param {Array|string} base64Images - B64 formatidagi rasmlar massivi
 * @param {string} startDate - Foydalanuvchi tanlagan boshlanish sanasi (yyyy-mm-dd)
 * @param {string} selectedObject - UI dan tanlangan obyekt nomi
 */
function askTitanAiForAct(promptText, base64Images, startDate, selectedObject) {
  try {
    const apiKey = checkGeminiKey_();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(CONFIG.REYESTR_SHEET);
    
    // 1. Xotirani o'qish (Oxirgi 50 ta akt)
    var reqId = PropertiesService.getScriptProperties().getProperty('CURRENT_REQ_ID');
    if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Avvalgi aktlar xotirasi tekshirilmoqda...");
    
    const lastRow = sh.getLastRow();
    const headers = headerMap_(sh);
    const contextData = [];
    
    let lastActNumber = 0; // Avtomatik raqamlash uchun
    let targetMemory = null; // Tanlangan obyekt uchun eng mukammal xotira (over-write uchun)
    
    if (lastRow > 1) {
      // Eng oxirgi akt raqamini topish
      const lastActVal = sh.getRange(lastRow, headers[REY.ACT_NUMBER]).getValue();
      lastActNumber = parseInt(lastActVal) || 0;
      
      const startRow = Math.max(2, lastRow - 50);
      const rowCount = lastRow - startRow + 1;
      const values = sh.getRange(startRow, 1, rowCount, sh.getLastColumn()).getDisplayValues();
      const headerNames = Object.keys(headers);
      
      for (const row of values) {
        const obj = {};
        headerNames.forEach(h => {
          const colIdx = headers[h] - 1;
          if (row[colIdx]) obj[h] = row[colIdx];
        });
        
        // Agar foydalanuvchi obyektni tanlagan bo'lsa, xotiradagi aynan shu obyektni ushlab qolamiz
        if (selectedObject && obj[REY.OBJECT_NAME] === selectedObject) {
          targetMemory = obj;
        }

        // Only include if it has at least WORK_NAME or OBJECT_NAME
        if (obj[REY.WORK_NAME] || obj[REY.OBJECT_NAME]) {
          contextData.push(obj);
        }
      }
    }
    
    if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Baza qidirildi: " + contextData.length + " ta eski akt xotirasi o'qib olindi.");

    // Sanani formatlash
    let baseDateStr = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');
    if (startDate) {
      const parts = startDate.split('-'); // yyyy-mm-dd
      if (parts.length === 3) baseDateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    // 1.5 Fetch active selection
    const activeRows = getActiveSelectionData_();
    let selectedRowsText = "";
    if (activeRows.length > 0) {
      selectedRowsText = `FOYDALANUVCHI BELGILAGAN QATORLAR (Agar foydalanuvchi tahrirlash/o'zgartirishni so'rasa, ushbu qatorlarga e'tibor bering!):\n${JSON.stringify(activeRows, null, 2)}\n\n`;
    }

    // 2. Gemini ga System Prompt tayyorlash
    const systemInstruction = `
Siz Qurilish bo'yicha Bosh Muhandis (Prorab) yordamchisisiz.
Vazifangiz: Foydalanuvchi matni va rasmidan qurilish jarayonlarini tahlil qilib, Akt (AOSR) yaratish yoki ularni tahrirlash.
QOIDALAR (Qat'iy rioya qiling!):
1. AOSR MANTIQI: AOSR (Akt Osvidetelstvovaniya Skritix Rabot) faqat "Yashirin ishlar" uchun tuziladi (masalan: Karkas, Armatura, Beton). Bo'yoqchilik kabi yashirin bo'lmagan ishlarga AOSR akti YARATMANG! (Foydalanuvchi o'zi qat'iy so'rasagina yarating).
2. MANTIQIY BO'LINISH: Agar umumiy murakkab ish aytilsa uni QMQ/SNiP ga muvofiq bir nechta mantiqiy aktlarga bo'ling. 
3. ORTIQCHA MA'LUMOTSIZ: Aktga umuman HAJM (obyom, m2, m3), miqdor, va sun'iy GOST raqamlarini YOZMANG! Faqat ish nomi va materialning o'zi yoziladi.
4. OBYEKT: Agar obyekt nomi berilgan bo'lsa uni yozing. Bo'lmasa bo'sh qoldiring, dastur o'zi to'ldiradi.
5. SANA: Boshlang'ich sana sifatida [ ${baseDateStr} ] ni qabul qiling. Mantiqiy ketma-ketlikda START_DATE va END_DATE yarating.
6. SUHBAT VA MA'LUMOT YETISHMOVCHILIGI: Agar foydalanuvchi OBYEKT nomini va SANANI mutlaqo taqdim etmagan bo'lsa, zudlik bilan akt yaratishga URINMANG! Obyekt va sana haqida ma'lumot so'rang. Muhim: Siz doim JSON qaytarishingiz shart. Shuning uchun bunday xabarlarni ushbu shaklda qaytaring: [{"chat_message": "Aka (yoki jigar), bu ish qaysi obyekt uchun va sanasi qachon?"}]. Agar shunchaki salomlashsa ham shu shaklda qaytaring.
7. TAHRIRLASH (EDIT): Agar foydalanuvchi "shuni 5 kubga o'zgartir", "betonni M300 qil", "shu qatordagi obyektni to'g'irla" kabi tahrirlash so'rovini bersa, siz unga javoban JSON Array qaytarishingiz kerak. JSON ichida albatta tahrirlanayotgan qator raqamini "ROW_NUMBER" kalitida ko'rsating. Yangi akt yaratishda esa ROW_NUMBER bo'lmaydi yoki null bo'ladi.
8. FORMAT: Akt yaratish yoki tahrirlash kerak bo'lsa Faqat qat'iy JSON Array qaytarishingiz kerak.
9. TAKRORLAMANG: Agar 'FOYDALANUVCHINING OLDINGI AKTLARI XOTIRASI' da aynan siz yaratmoqchi bo'lgan ish (WORK_NAME) bo'yicha tayyor akt borligini ko'rsangiz, uni qaytadan YARATMANG! Foydalanuvchi faqat yangi yoki qo'shimcha ishlarni yozishini kuting.
10. LONDAN YOZING (Xotira tejang!): Ish jarayoni, materiallar va qanday qilinganligini (PROGRESS) professional, lekin QISQA VA LONDAN (har biriga maksimal 2-3 gap) qilib yozing. Hech qachon uzun doston qilib yubormang! Sababi sizda xotira limiti bor, agar juda batafsil yozsangiz ko'p aktlarni bittada chiqara olmaysiz va javobingiz uzilib qoladi!
11. SIZNING QOBILIYATINGIZ: Siz foydalanuvchi yuborgan rasmlarni o'qiy olasiz! Hech qachon foydalanuvchiga "men rasmlarni o'qiy olmayman" demang. Agar joriy xabarda rasm kelmasa, ammo foydalanuvchi "rasmni o'qimadingmi" deb so'rasa, "Kechirasiz, bu xabaringizda rasm yo'q, iltimos rasmni qaytadan biriktirib yuboring" deb javob qaytaring.
12. RASMDAN O'QISH QAT'IY TALABI: Agar foydalanuvchi rasm yuborgan bo'lsa (ayniqsa smeta, loyiha yoki chizma rasmlari), SIZ ASLO o'zingizdan to'qib standart va umumiy gaplarni yozmang! Rasm ichidagi har bir so'zni, ayniqsa "Примечание" (Izohlar) yoki chizma ma'lumotlarini qidirib toping va aktning PROGRESS yoki WORK_NAME qatorlariga AYNAN rasmdagi ma'lumotlarni ishlating!

Siz qaytarishingiz kerak bo'lgan JSON Array obyekti kalitlari (Tahrirlashda ROW_NUMBER qo'shiladi, Yangi yaratishda yo'q):
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
FOYDALANUVCHINING OLDINGI AKTLARI XOTIRASI (Uslubni o'rganish uchun):
${JSON.stringify(contextData, null, 2)}
`;

    // 3. Request Payload tayyorlash
    const parts = [{ text: promptText }];
    
    if (base64Images && Array.isArray(base64Images)) {
      base64Images.forEach(base64Image => {
        if (base64Image) {
          const mimeType = base64Image.split(';')[0].split(':')[1];
          const dataStr = base64Image.split(',')[1];
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: dataStr
            }
          });
        }
      });
    }
    
    let selectedModel = (typeof GEMINI_MODEL !== 'undefined') ? GEMINI_MODEL : "gemini-2.5-flash";

    if(reqId && typeof aktLogStep === 'function') {
      aktLogStep(reqId, "Model: " + selectedModel + " tanlandi.");
      aktLogStep(reqId, "API ulanishi kutilmoqda (MaxToken: 8192)...");
    }

    // 4. API ga so'rov yuborish (AIGateway orqali)
    let aiText = "";
    try {
      if (typeof aiCall !== 'function') throw new Error("AIGateway.js yuklanmagan!");
      aiText = aiCall({
        model: selectedModel,
        parts: parts,
        system: systemInstruction,
        json: true,
        temp: 0.2,
        maxTok: 8192
      });
    } catch (e) {
      if (e.message && e.message.toLowerCase().includes("unsupported mime type")) {
        return { success: false, error: "Kechirasiz, sun'iy intellekt hozircha Excel yoki Word formatlarini to'g'ridan-to'g'ri o'qiy olmaydi. Iltimos, faylni PDF qilib saqlab, keyin qayta yuklang." };
      }
      return { success: false, error: e.message || String(e) };
    }
    let extractedActs;
    try {
      // JSON ni ajratib olishga harakat qilamiz (agar ichida boshqa matnlar bo'lsa ham)
      const jsonStrMatch = aiText.match(/\[[\s\S]*\]/);
      const jsonStr = jsonStrMatch ? jsonStrMatch[0] : aiText;
      
      extractedActs = JSON.parse(jsonStr);
      
      if (!Array.isArray(extractedActs)) {
        extractedActs = [extractedActs];
      }
      
      if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "AI dan " + extractedActs.length + " ta yangi akt strukturasi muvaffaqiyatli qabul qilindi.");
      
    } catch (e) {
      // Agar JSON parselanmasa (uzilib qolgan bo'lsa), butun ob'ektlarni qutqarishga urinamiz
      extractedActs = [];
      const objRegex = /\{[^{}]*\}/g;
      let match;
      while ((match = objRegex.exec(aiText)) !== null) {
        try {
          const parsedObj = JSON.parse(match[0]);
          if (parsedObj && parsedObj.WORK_NAME) {
            extractedActs.push(parsedObj);
          }
        } catch (err) {}
      }

      if (extractedActs.length === 0) {
        let errMsg = aiText;
        if (aiText.trim().startsWith("[") && aiText.includes('"WORK_NAME"')) {
          errMsg = "Kechirasiz, AI rasm/matndagi ma'lumotlarni o'qib juda ko'p akt yaratishga urindi va xotira yetmay qoldi (Javob mutlaqo uzilib qoldi). Iltimos, bitta-bitta so'rang.";
        }
        return { success: true, message: errMsg, actsCreated: false };
      } else {
        if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Javob uzilib qoldi, lekin " + extractedActs.length + " ta butun akt qutqarib qolindi!");
      }
    }

    if (extractedActs.length > 0 && extractedActs[0].chat_message) {
      return { success: true, message: extractedActs[0].chat_message, actsCreated: false };
    }

    // Yaroqsiz yoki bo'sh aktlarni o'chiramiz (WORK_NAME majburiy)
    extractedActs = extractedActs.filter(act => act && Object.keys(act).length > 0 && act.WORK_NAME);
    
    if (extractedActs.length === 0) {
      if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Akt yaratilmadi (rasmda ma'lumot topilmadi).");
      return { success: true, message: "Aftidan AI bu ma'lumotlardan aniq bir ish turini aniqlay olmadi yoki rasmda tushunarli ish yozilmagan.", actsCreated: false };
    }
    
    if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "Aktlar bazaga (jadvalga) yozilmoqda...");

    // 5. Jadvalga yozish yoki tahrirlash (VA MAJBURIY OVERWRITE QILISH)
    
    let startRow = sh.getLastRow() + 1;
    let editCount = 0;
    let newCount = 0;
    
    for (const act of extractedActs) {
      var reqStart = PropertiesService.getScriptProperties().getProperty('REQ_START_TIME');
      var abortTime = CacheService.getScriptCache().get('abort_time');
      var isGloballyAborted = (abortTime && reqStart && parseInt(reqStart) < parseInt(abortTime));
      var isLocallyAborted = (reqId && CacheService.getScriptCache().get('abort_' + reqId));
      
      if (isGloballyAborted || isLocallyAborted) {
        throw new Error("Foydalanuvchi barcha jarayonlarni to'xtatdi");
      }
      
      let targetRow = startRow;
      const isEdit = act.ROW_NUMBER && !isNaN(parseInt(act.ROW_NUMBER));
      
      const payloadObj = {};
      
      if (isEdit) {
        targetRow = parseInt(act.ROW_NUMBER);
        editCount++;
        // Tahrirlashda ACT_NUMBER va STATUS ga tegmaymiz
      } else {
        lastActNumber++; 
        payloadObj[REY.ACT_NUMBER] = lastActNumber;
        payloadObj[REY.STATUS] = "IMPORTED_NEW";
        payloadObj[REY.COMM_STATUS] = "Не отправлено";
        payloadObj[REY.LAST_SYNC] = new Date();
        payloadObj[REY.ERROR] = "";
        newCount++;
      }
      
      // AI bergan maydonlarni to'ldirish
      for (const key in act) {
        if (key !== "ROW_NUMBER" && act[key]) {
          payloadObj[key] = act[key];
        }
      }
      
      // *** BACKEND MAJBURIY OVERWRITE (Gibrid Integratsiya) - Faqat yangi akt bo'lsa yoki obyekt tanlangan bo'lsa ***
      if (selectedObject && targetMemory && !isEdit) {
        payloadObj[REY.OBJECT_NAME] = selectedObject; // Obyekt nomi qat'iy yoziladi
        
        // Xotiradan barcha Papka ID lari va FIO larni to'g'ridan-to'g'ri ko'chirib uramiz!
        const criticalFields = [
          REY.TARGET_FOLDER_ID, REY.TARGET_FOLDER_PATH, REY.ACT_FOLDER_ID,
          REY.CUSTOMER_ORG, REY.GEN_NAME, REY.GEN_FIO, REY.GEN_POS,
          REY.SUB_NAME, REY.SUB_FIO, REY.SUB_POS,
          REY.TEX_FIO, REY.TEX_POS, REY.PROJ_ORG, REY.PROJ_FIO, REY.PROJ_POS
        ];
        
        criticalFields.forEach(field => {
          if (targetMemory[field]) {
            payloadObj[field] = targetMemory[field];
          }
        });
      }
      
      writeRow_(sh, targetRow, payloadObj);
      sh.autoResizeRows(targetRow, 1);
      
      if (!isEdit) {
        startRow++;
      }
      if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "📝 Jadvalga saqlandi: " + act.WORK_NAME);
    }
    
    let resultMessage = [];
    if (newCount > 0) resultMessage.push(`✅ ${newCount} ta yangi akt yaratildi`);
    if (editCount > 0) resultMessage.push(`📝 ${editCount} ta akt tahrirlandi`);
    
    if(reqId && typeof aktLogStep === 'function') aktLogStep(reqId, "✅ Barcha jarayon muvaffaqiyatli yakunlandi!");

    // SUPABASE VA SMETA TIZIMIGA INTEGRATSIYA UCHUN PUSH QILISH
    try {
      if (typeof aktSupabasePush === "function") {
        aktSupabasePush();
      }
    } catch (e) {
      console.error("Supabase push xatosi: " + e.message);
    }

    return { 
      success: true, 
      count: extractedActs.length, 
      message: resultMessage.length > 0 ? resultMessage.join(" va ") + "!" : "Muvaffaqiyatli bajarildi!",
      actsCreated: newCount > 0
    };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * REYESTR jadvalidagi barcha unikal obyekt nomlarini UI uchun qaytaradi.
 */
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
  
  values.forEach(row => {
    const val = String(row[0]).trim();
    if (val) objSet.add(val);
  });
  
  return Array.from(objSet).sort();
}
