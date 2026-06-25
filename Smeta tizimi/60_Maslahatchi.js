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

var CLAUDE_MODEL    = 'claude-opus-4-8';   // sonnet uchun: 'claude-sonnet-4-6'
var CLAUDE_MAXTOK   = 5000;                 // thinking + javob uchun joy
var CLAUDE_THINKING = true;                 // adaptive thinking (sifat ↑, biroz sekinroq)
var CLAUDE_VER      = '2023-06-01';

/* Editordan sinash — tashqi so'rov (UrlFetchApp) ruxsatini ham faollashtiradi.
 * Birinchi marta ishga tushirilganda Google avtorizatsiya so'raydi → ruxsat bering. */
function maslahatTest(){
  var r = _claudeSorov(
    'Sen yordamchisan. Faqat o\'zbek tilida, bitta gap bilan javob ber.',
    'Salom! Ulanish ishlayaptimi?'
  );
  Logger.log('CLAUDE JAVOBI: '+r);
  return r;
}

/* ============ API KALITINI SOZLASH ============ */
function claudeKeySet(key){
  if(!key || String(key).indexOf('sk-ant-')!==0)
    throw 'Kalit sk-ant- bilan boshlanishi kerak: claudeKeySet("sk-ant-...")';
  PropertiesService.getScriptProperties().setProperty('ANTHROPIC_API_KEY', String(key).trim());
  return 'ANTHROPIC_API_KEY saqlandi.';
}
function _claudeKey(){
  var k=PropertiesService.getScriptProperties().getProperty('ANTHROPIC_API_KEY');
  if(!k) throw 'ANTHROPIC_API_KEY o\'rnatilmagan. Editorda: claudeKeySet("sk-ant-...")';
  return k;
}


/* ============ PAST-DARAJA SO'ROV (UrlFetchApp) ============ */
function _claudeSorov(systemPrompt, userPrompt){
  var payload = {
    model:      CLAUDE_MODEL,
    max_tokens: CLAUDE_MAXTOK,
    system:     systemPrompt,
    messages:   [{ role:'user', content:userPrompt }]
  };
  if(CLAUDE_THINKING) payload.thinking = { type:'adaptive' };

  var resp = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method:           'post',
    contentType:      'application/json',
    headers:          { 'x-api-key':_claudeKey(), 'anthropic-version':CLAUDE_VER },
    payload:          JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  var raw  = resp.getContentText();
  var body; try{ body=JSON.parse(raw); }catch(e){ body=null; }

  if(code !== 200){
    var msg = (body && body.error && body.error.message) ? body.error.message : raw;
    throw 'Claude API xato ('+code+'): '+msg;
  }
  // Faqat text bloklarni yig'amiz (thinking bloklari o'tkazib yuboriladi)
  var out='';
  var blocks = (body && body.content) || [];
  for(var i=0;i<blocks.length;i++) if(blocks[i].type==='text') out += blocks[i].text;
  return out.trim() || '(javob bo\'sh keldi)';
}


/* ============ PUL FORMAT (token tejash) ============ */
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

  var text = _claudeSorov(_MASLAHAT_SYS_OB, L.join('\n'));
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
  var text=_claudeSorov(_MASLAHAT_SYS_DASH, L.join('\n'));
  var res={ text:text, sana:Utilities.formatDate(new Date(),'Asia/Tashkent','yyyy-MM-dd HH:mm') };
  try{ if(typeof cachePut==='function') cachePut(ck, res, 21600); }catch(e){}
  return res;
}
