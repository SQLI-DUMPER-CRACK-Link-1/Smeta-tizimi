/**
 * 80_JarvisWorker.js
 * JARVIS AI - Avtonom fon jarayonlari (Background Worker)
 * Kompyuter o'chiq bo'lganda ham Google Cloud serverlarida mustaqil ishlaydi.
 */

/**
 * Ushbu funksiya har 15-30 daqiqada avtomat ishga tushadi (Time-Driven Trigger orqali)
 */
function jarvisAutoWorker() {
  try {
    var ts = new Date().getTime();
    Logger.log("🤖 Jarvis AI Background Worker ishga tushdi: " + new Date());
    
    // 1. Yangi papkalar skani (Avtomat)
    var p = PropertiesService.getScriptProperties();
    var lastScan = parseInt(p.getProperty('JARVIS_LAST_SCAN') || '0', 10);
    
    if(ts - lastScan > 60 * 60 * 1000) { // Har 1 soatda to'liq skan qilib chiqish
       Logger.log("Jarvis: Obyektlar skan qilinmoqda...");
       /* ⚠️ 2026-08-17 (audit): avval `_obyektlarSkan(true)` chaqirilardi —
          bunday funksiya TIZIMDA YO'Q. Haqiqiy nomi `papkaSkan()`
          (05_Papka.js:14). Chaqiruv try/catch ichida bo'lgani uchun xato
          jim yutilardi va faqat «Scan error» loggа yozilardi — natijada
          Jarvis ning soatlik avtomat skani BIR MARTA HAM ishlamagan,
          ammo pastda `JARVIS_LAST_SCAN` yangilanib, «bajarildi» ko'rinishi
          saqlanib qolgan.
          Endi haqiqiy skan chaqiriladi va xato bo'lsa vaqt belgisi
          yangilanMAYDI — keyingi tsiklda qayta urinadi. */
       var skanOk = false;
       try { papkaSkan(); skanOk = true; }
       catch(e) { Logger.log("Jarvis skan xatosi: " + (e && e.message ? e.message : e)); }
       if(skanOk) p.setProperty('JARVIS_LAST_SCAN', String(ts));
    }
    
    // 2. Tizim holatini tekshirish
    // ... Bu yerga qo'shimcha AI kuzatuvlar, smetalarni solishtirish 
    // yoki telegramga summary jo'natish mantiqlari qo'shiladi.
    
    Logger.log("🤖 Jarvis AI Worker tugatdi.");
  } catch (e) {
    Logger.log("Jarvis Worker Xatosi: " + e.message);
  }
}

/**
 * Jarvis Worker uchun taymer (Cron job) o'rnatish
 */
function jarvisWorkerStart() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'jarvisAutoWorker') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('jarvisAutoWorker')
           .timeBased()
           .everyMinutes(15) // Har 15 daqiqada
           .create();
  return "🤖 Jarvis AI Avtonom tizimi muvaffaqiyatli ishga tushirildi! Endi kompyuter o'chiq bo'lsa ham ishlaydi.";
}

/**
 * Jarvis Worker ni to'xtatish
 */
function jarvisWorkerStop() {
  var triggers = ScriptApp.getProjectTriggers();
  var count = 0;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'jarvisAutoWorker') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  return count > 0 ? "Jarvis AI to'xtatildi." : "Ishlab turgan worker topilmadi.";
}
