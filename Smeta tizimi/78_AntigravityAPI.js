/********************************************************************
 * 78_AntigravityAPI.js — ANTIGRAVITY (AI) UCHUN MA'LUMOTLAR KO'PRIGI
 * ==================================================================
 * Bu fayl Antigravity (yoki boshqa tashqi tizim) bevosita Google Sheets
 * smetalariga HTTP GET orqali murojaat qilganda, barcha kerakli 
 * ma'lumotlarni JSON shaklida tortib beruvchi maxsus ko'prik.
 ********************************************************************/

/**
 * HTTP orqali ma'lumot jo'natuvchi asosiy API darcha
 * doGet() ichidan chaqiriladi (?action=api_boss&obyekt=Suniy_Kol)
 */
function apiAntigravityExport(obyekt) {
  try {
    var data = null;
    
    // Agar obyektsiz yuborilsa yoki "all" desa, butun Dashboard ma'lumotini beradi
    if (!obyekt || obyekt.toLowerCase() === 'barchasi' || obyekt.toLowerCase() === 'all') {
      data = apiBossData();
    } else {
      // DASTURLASH XATOSI TUZATILDI: 
      // apiBossObyekt faqat qisqa xulosa (summary) berardi. 
      // Menga smetaning ichki qatorlari (Material, Narxlar, Hajm) kerak bo'lgani uchun
      // to'liq shajara (tree) tuzib beruvchi apiHolatOl() ga o'zgartirildi.
      data = apiHolatOl(obyekt);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success', 
      obyekt: obyekt || 'Barchasi',
      timestamp: new Date().toISOString(),
      data: data
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', 
      message: err.message || String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
