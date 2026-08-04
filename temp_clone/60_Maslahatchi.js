/********************************************************************
 * 60_Maslahatchi.gs — AI MASLAHATCHI (Claude API)
 * ==================================================================
 * Obyekt holatidan (smeta/fakt/Ф2/kategoriya/razdel) kelib chiqib
 * xulosa va amaliy tavsiya beradi.
 *
 * GAS da Anthropic SDK yo'q → UrlFetchApp orqali to'g'ridan
 * https://api.anthropic.com/v1/messages (raw HTTP) chaqiriladi.
 *
 * Sozlash (bir marta):
 *   Apps Script editor → Run: claudeKeySet('sk-ant-...')
 *   (yoki Project Settings → Script Properties → ANTHROPIC_API_KEY)
 *
 * API:
 *   apiMaslahatObyekt(obyekt, force)  → bitta obyekt tahlili
 *   apiMaslahatDashboard(force)       → umumiy (barcha obyekt) tahlili
 *
 * Natija CacheService da keshlanadi (maslahat_<obyekt>) — holat
 * o'zgarganda _holatInvalidate uni ham tozalaydi (qayta bilmaydi).
 ********************************************************************/

/* ============ PAST-DARAJA SO'ROV (UrlFetchApp - GEMINI) ============
 * Model-fetch loop OLIB TASHLANDI — har chaqiruvda qo'shimcha API call yo'q.
 * Model: 65_TitanAI.js da TITAN_MODEL bilan sinxron (gemini-1.5-flash). */
function _geminiSorov(systemPrompt, userPrompt){
  const apiKey = PropertiesService.getUserProperties().getProperty('GEMINI_API_KEY')
              || PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) throw new Error("Gemini API kaliti topilmadi. Chat'da: setkey:KALIT");

  const selectedModel = (typeof TITAN_MODEL !== 'undefined') ? TITAN_MODEL : 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      { parts: [{ text: "TIZIM QOIDALARI:\n" + systemPrompt + "\n\nFOYDALANUVCHI SO'ROVI/MA'LUMOTI:\n" + userPrompt }] }
    ],
    generationConfig: {
      temperature: 0.3
    }
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const raw = resp.getContentText();
  let body; try{ body=JSON.parse(raw); }catch(e){ body=null; }

  if(code !== 200){
    const msg = (body && body.error && body.error.message) ? body.error.message : raw;
    throw 'Gemini API xato ('+code+'): '+msg;
  }
  
  if (body && body.candidates && body.candidates.length > 0) {
    return body.candidates[0].content.parts[0].text.trim();
  }
  
  return '(javob bo\'sh keldi)';
}


/* ============ PUL FORMAT (token tejash) ============ */
function maslahatTest(){
  var r = _geminiSorov("Sen tahlilchisan", "Salom");
  return r;
}

function _pulQ(n){
  n = Math.round(Number(n)||0);
  if(Math.abs(n)>=1e9) return (n/1e9).toFixed(2)+' mlrd';
  if(Math.abs(n)>=1e6) return (n/1e6).toFixed(1)+' mln';
  return String(n);
}


/* ============ TIZIM PROMPTLARI ============ */
var _MASLAHAT_SYS_OB =
  'Sen — qurilish smetalari bo\'yicha tajribali moliyaviy tahlilchisan. '+
  'Senga bitta qurilish obyektining joriy holati beriladi: smeta, bajarilgan ish (факт), '+
  'Ф2 (акт) olingan summa, kategoriyalar (ЧЕЛ/МАШ/МАТ/ОБ/М-К) va razdellar bo\'yicha taqsimot.\n\n'+
  'Vazifang — shu ma\'lumotdan kelib chiqib QISQA, ANIQ va AMALIY xulosa berish:\n'+
  '1) Umumiy holat bahosi — ish qanday ketyapti.\n'+
  '2) Asosiy xavf-xatarlar — orqada qolgan razdellar, факт bilan Ф2 orasidagi katta farq, '+
  'sekin yoki to\'xtab qolgan yo\'nalishlar.\n'+
  '3) 2-4 ta aniq tavsiya — nimaga e\'tibor berish kerak.\n\n'+
  'Faqat o\'zbek tilida yoz. Oddiy matn (markdown emas), qisqa abzaslar. '+
  '220 so\'zdan oshirma. Raqamlarni mln/mlrd so\'m ko\'rinishida ishlat.';

var _MASLAHAT_SYS_DASH =
  'Sen — qurilish loyihalari bo\'yicha tajribali moliyaviy tahlilchisan. '+
  'Senga bir nechta obyektning umumiy ko\'rsatkichlari beriladi (smeta, факт %, Ф2 %, qolgan ish).\n\n'+
  'Vazifang — portfel darajasida QISQA xulosa berish: qaysi obyektlar yaxshi/yomon ketyapti, '+
  'umumiy progress va Ф2 holati, eng katta xavflar va 2-4 ta tavsiya.\n\n'+
  'Faqat o\'zbek tilida, oddiy matn (markdown emas), 220 so\'zgacha. Raqamlar mln/mlrd so\'m.';


/* ============ BITTA OBYEKT TAHLILI ============ */
function apiMaslahatObyekt(obyekt, force){
  if(!obyekt) throw 'Obyekt ko\'rsatilmagan';
  var ck = 'maslahat_'+obyekt;
  if(!force){
    var c = (typeof cacheGet==='function') ? cacheGet(ck) : null;
    if(c && c.text) return c;
  }

  var d = apiBossObyekt(obyekt);   // keshlangan holat (Bosqich 5)
  var t = d.total || {res:0,fakt:0,f2:0,ost:0,progress:0,f2pct:0};

  var L = [];
  L.push('OBYEKT: '+obyekt+(d.locked?' (qulflangan)':''));
  L.push('Smeta jami: '+_pulQ(t.res));
  L.push('Bajarilgan (факт): '+_pulQ(t.fakt)+' ('+t.progress+'%)');
  L.push('Ф2 olingan: '+_pulQ(t.f2)+' ('+t.f2pct+'% фактдан)');
  L.push('Qolgan ish: '+_pulQ(t.ost));
  L.push('');
  L.push('Kategoriya (smeta / факт / Ф2 / qoldiq):');
  (d.catKeys||[]).forEach(function(k){
    var c=d.cats[k]; if(!c||c.res<=0) return;
    L.push('  '+k+': '+_pulQ(c.res)+' / '+_pulQ(c.fakt)+' / '+_pulQ(c.f2)+' / '+_pulQ(c.ost));
  });
  if(d.rzList && d.rzList.length){
    L.push('');
    L.push('Razdellar (smeta, progress%, qolgan):');
    d.rzList.slice(0,30).forEach(function(rz){
      if(!rz.res) return;
      L.push('  '+rz.nom+' — '+_pulQ(rz.res)+', '+rz.progress+'%, qolgan '+_pulQ(rz.ost));
    });
  }
  if(d.oylar && d.oylar.length){
    L.push('');
    L.push('Oylik Ф2 dinamikasi:');
    d.oylar.forEach(function(o){ L.push('  '+o.oy+': '+_pulQ(o.val)); });
  }

  var text = _geminiSorov(_MASLAHAT_SYS_OB, L.join('\n'));
  var res = { text:text, sana:Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd HH:mm'), obyekt:obyekt };
  try{ if(typeof cachePut==='function') cachePut(ck, res, 21600); }catch(e){}
  return res;
}


/* ============ UMUMIY (DASHBOARD) TAHLILI ============ */
function apiMaslahatDashboard(force){
  var ck='maslahat__dash';
  if(!force){
    var c=(typeof cacheGet==='function')?cacheGet(ck):null;
    if(c && c.text) return c;
  }
  var d = apiBossData();
  var j = d.jami||{};
  var L=[];
  L.push('JAMI (barcha obyektlar):');
  L.push('Smeta: '+_pulQ(j.smeta)+', факт: '+_pulQ(j.fakt)+' ('+(j.progress||0)+'%), '+
         'Ф2: '+_pulQ(j.f2)+' ('+(j.f2pct||0)+'%), qolgan: '+_pulQ(j.qoldiq));
  L.push('');
  L.push('Obyektlar (smeta / факт% / Ф2%):');
  (d.objects||[]).forEach(function(o){
    L.push('  '+o.nom+': '+_pulQ(o.smeta)+' / '+(o.progress||0)+'% / '+(o.f2pct||0)+'%');
  });
  var text=_geminiSorov(_MASLAHAT_SYS_DASH, L.join('\n'));
  var res={ text:text, sana:Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd HH:mm') };
  try{ if(typeof cachePut==='function') cachePut(ck, res, 21600); }catch(e){}
  return res;
}
