/********************************************************************
 * 86_Sklad.js — OMBOR (SKLAD) tizimi integratsiyasi
 * ==================================================================
 * Telegram bot orqali ovozli yoki matnli xabarlarni qabul qilib,
 * ularni AI yordamida tahlil qiladi va Google Sheet'dagi "Приход"
 * yoki "Расход" varaqlariga yozadi.
 * 
 * Sklad File ID: 10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw
 ********************************************************************/

var SKLAD_FILE_ID = '10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw';

/* ══════════════════════════════════════════════════════════════════
 * MATERIAL DROPDOWN — mavjud (belgilangan) nomlardan mos variant
 * ==================================================================
 * "DropdownData" varag'i (SKLAD_FILE_ID ichida): D=Тип материала,
 * E=Ед.изм, G=Поставщик, H=Наименование — barchasi
 * SORT(UNIQUE(...)) formula, Приход/Расход tarixidan avtomatik yig'iladi.
 * Maqsad: yangi prixod/rasxod kiritilganda AVVAL shu ro'yxatdan mos
 * nom qidiriladi (imlo/dublikat xilma-xilligini kamaytirish uchun),
 * FAQAT haqiqatan mos kelmasa yangi nom yozishga ruxsat beriladi.
 * ══════════════════════════════════════════════════════════════════ */
function _skladDropdownOl(){
  var ck='sklad_dropdown_v1';
  try{ var c=CacheService.getScriptCache().get(ck); if(c) return JSON.parse(c); }catch(e){}
  var out={turlari:[], birliklar:[], yetkazuvchi:[], nomlar:[]};
  try{
    var ss=SpreadsheetApp.openById(SKLAD_FILE_ID);
    var sh=ss.getSheetByName('DropdownData');
    if(sh){
      var last=sh.getLastRow();
      if(last>1){
        var v=sh.getRange(2,4,last-1,5).getValues(); // D,E,F,G,H
        v.forEach(function(r){
          if(r[0]) out.turlari.push(String(r[0]).trim());
          if(r[1]) out.birliklar.push(String(r[1]).trim());
          if(r[3]) out.yetkazuvchi.push(String(r[3]).trim());
          if(r[4]) out.nomlar.push(String(r[4]).trim());
        });
      }
    }
  }catch(e){ try{ Logger.log('_skladDropdownOl xato: '+e); }catch(x){} }
  try{ CacheService.getScriptCache().put(ck, JSON.stringify(out), 900); }catch(e){} // 15 daqiqa
  return out;
}

function _skladNomNorm(s){
  if(typeof _normNomKey==='function'){ try{ return _normNomKey(s); }catch(e){} }
  return String(s||'').toUpperCase().replace(/[^0-9A-ZА-ЯЁ]/g,'');
}

/** Berilgan nom (matn) uchun DropdownData dagi mavjud nomlardan mos variantlarni topadi.
 * skor: 100=aynan mos, 60-99=juda o'xshash/qism, 35-59=so'z mosligi. */
function _skladNomTaklif(qidiruv, limit){
  qidiruv=String(qidiruv||'').trim();
  if(!qidiruv) return [];
  var dd=_skladDropdownOl();
  var qNorm=_skladNomNorm(qidiruv);
  var qTokens=qidiruv.toUpperCase().split(/[^0-9A-ZА-ЯЁ]+/).filter(function(t){return t.length>1;});
  var res=[];
  dd.nomlar.forEach(function(nom){
    var cNorm=_skladNomNorm(nom);
    if(!cNorm) return;
    var score=0;
    if(cNorm===qNorm){
      score=100;
    } else if(cNorm.indexOf(qNorm)>=0 || qNorm.indexOf(cNorm)>=0){
      score=60+Math.round(40*Math.min(cNorm.length,qNorm.length)/Math.max(cNorm.length,qNorm.length));
    } else if(qTokens.length){
      var cTokens=nom.toUpperCase().split(/[^0-9A-ZА-ЯЁ]+/).filter(function(t){return t.length>1;});
      var match=qTokens.filter(function(t){return cTokens.indexOf(t)>=0;}).length;
      if(match>0) score=Math.round(60*match/Math.max(qTokens.length,cTokens.length));
    }
    if(score>=35) res.push({nom:nom, skor:score});
  });
  res.sort(function(a,b){return b.skor-a.skor;});
  return res.slice(0, limit||5);
}

/** Panel/chat autocomplete uchun ochiq API. */
function apiPrixodNomTaklif(qidiruv, limit){
  return _skladNomTaklif(qidiruv, limit);
}

/* ⚡ 2026-07-13 YANGI: BOSS PANEL uchun ombor QOLDIG'I xulosasi. Приход/Расход
 * varaqlarini (har biri xom TRANZAKSIYA jurnali) nom+birlik bo'yicha jamlab,
 * joriy qoldiqni (kirim-chiqim) hisoblaydi. Eng kam qoldiqlilar birinchi —
 * "tez tugaydigan material" xavfini ko'rsatish uchun. */
function apiSkladQoldiq(){
  try{
    var ss=SpreadsheetApp.openById(SKLAD_FILE_ID);
    var map={};
    function oqi(sheetName, isKirim){
      var sh=ss.getSheetByName(sheetName); if(!sh) return;
      var last=sh.getLastRow(); if(last<2) return;
      var v=sh.getRange(2,1,last-1,6).getValues(); // A..F: №,тип,Дата,Наименование,Ед.изм,Кол-во
      v.forEach(function(r){
        var nom=String(r[3]||'').trim(); if(!nom) return;
        var bir=String(r[4]||'').trim();
        var qty=Number(r[5])||0;
        var key=nom.toUpperCase()+'||'+bir.toUpperCase();
        if(!map[key]) map[key]={nom:nom, birlik:bir, kirim:0, chiqim:0};
        if(isKirim) map[key].kirim+=qty; else map[key].chiqim+=qty;
      });
    }
    oqi('Приход', true);
    oqi('Расход', false);
    var out=Object.keys(map).map(function(k){
      var m=map[k];
      return {nom:m.nom, birlik:m.birlik, kirim:Math.round(m.kirim*1000)/1000,
        chiqim:Math.round(m.chiqim*1000)/1000, qoldiq:Math.round((m.kirim-m.chiqim)*1000)/1000};
    });
    out.sort(function(a,b){ return a.qoldiq-b.qoldiq; });
    return {ok:true, materiallar:out, jami:out.length};
  }catch(e){ return {ok:false, xabar:String(e.message||e)}; }
}

/**
 * AI tomonidan qaytarilgan JSON ma'lumotni varaqqa yozish
 * @param {Object} data - AI qaytargan JSON
 * @param {string} operatsiya - 'prixod' yoki 'rasxod'
 */
function apiSkladgaYozish(data, operatsiya) {
  try {
    // Aniq to'ldirilishi shart bo'lgan maydonlar (Наименование/Ед.изм/Ҳажм)
    var yetishmagan=[];
    if(!data || !String(data.nomi||'').trim()) yetishmagan.push('НОМИ');
    if(!data || !String(data.birligi||'').trim()) yetishmagan.push('БИРЛИГИ');
    if(!data || !(Number(data.obyomi)>0)) yetishmagan.push('ҲАЖМИ');
    if(yetishmagan.length){
      return { ok:false, error:'Тўлдирилиши шарт: '+yetishmagan.join(', ') };
    }

    var ss = SpreadsheetApp.openById(SKLAD_FILE_ID);
    var sheetName = operatsiya.toLowerCase() === 'rasxod' ? 'Расход' : 'Приход';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { ok: false, error: '"' + sheetName + '" nomli varaq (sheet) topilmadi!' };
    }

    // Oxirgi № (Tartib raqami) ni topish
    var lastRow = sheet.getLastRow();
    var tr = 1;
    if (lastRow > 1) {
      var lastId = sheet.getRange(lastRow, 1).getValue();
      var parsedId = parseInt(lastId, 10);
      if (!isNaN(parsedId)) {
        tr = parsedId + 1;
      } else {
        tr = lastRow; // fall back
      }
    }

    var qator = [];
    var bugun = Utilities.formatDate(new Date(), 'Asia/Tashkent', 'dd.MM.yyyy');
    var sana = data.sanasi || bugun;
    
    if (sheetName === 'Приход') {
      // Приход ustunlari: №, тип материала, Дата, Наименование, Ед.изм, Приход, С/Ф подтвержденный, Поставщик
      qator = [
        tr,
        data.turi || 'Прочее',
        sana,
        data.nomi || 'Noma\'lum',
        data.birligi || 'шт',
        data.obyomi || 0,
        '', // С/Ф подтвержденный
        data.postavshik || data.qabul_qiluvchi || ''
      ];
    } else {
      // Расход ustunlari: №, тип материала, Дата, Наименование, Ед.изм, Кол-во, Прораб/brigada, Субподрядные организации, Блок
      
      var prarab = '', subpudrat = '', blok = '';
      if (data.qabul_turi === 'subpudrat') subpudrat = data.qabul_qiluvchi || '';
      else if (data.qabul_turi === 'blok') blok = data.qabul_qiluvchi || '';
      else prarab = data.qabul_qiluvchi || '';

      qator = [
        tr,
        data.turi || 'Прочее',
        sana,
        data.nomi || 'Noma\'lum',
        data.birligi || 'шт',
        data.obyomi || 0,
        prarab,
        subpudrat,
        blok
      ];
    }

    sheet.appendRow(qator);
    
    return { 
      ok: true, 
      operatsiya: sheetName,
      xabar: "✅ " + sheetName + " yozildi:\n" + 
             "📦 " + qator[3] + " (" + qator[5] + " " + qator[4] + ")"
    };

  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

/**
 * Telegramdan kelgan xabarni Sklad uchun ishlash
 */
function apiSkladTelegramQabul(msg, chatId) {
  var token = (typeof _tgToken==='function') ? _tgToken() : null;
  if(!token) return;

  var botMsg = null;
  function yubor(t) {
    if(!botMsg) {
      try {
        var res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({chat_id: chatId, text: t}), muteHttpExceptions: true
        });
        botMsg = JSON.parse(res.getContentText()).result;
      } catch(e) {}
    } else {
      try {
        UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/editMessageText', {
          method: 'post', contentType: 'application/json',
          payload: JSON.stringify({chat_id: chatId, message_id: botMsg.message_id, text: t}), muteHttpExceptions: true
        });
      } catch(e) {}
    }
  }

  try {
    var isVoice = false;
    var fileId = null;
    var mimeType = '';
    
    if (msg.voice) { isVoice = true; fileId = msg.voice.file_id; mimeType = msg.voice.mime_type || 'audio/ogg'; }
    else if (msg.audio) { isVoice = true; fileId = msg.audio.file_id; mimeType = msg.audio.mime_type || 'audio/mpeg'; }

    var aiParts = [];
    var matn = String(msg.text || msg.caption || '').trim();

    if (isVoice && fileId) {
      yubor('🔄 Ovozli xabar o\'qilmoqda (AI)...');
      
      var fRes = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/getFile?file_id=' + fileId, {muteHttpExceptions:true});
      var fJson = JSON.parse(fRes.getContentText());
      if(fJson.ok && fJson.result && fJson.result.file_path) {
        var fUrl = 'https://api.telegram.org/file/bot' + token + '/' + fJson.result.file_path;
        var blob = UrlFetchApp.fetch(fUrl, {muteHttpExceptions:true}).getBlob();

        var ovozMatni = null;
        if(typeof _groqGwKey==='function' && _groqGwKey()){
          try{
            blob.setContentType(mimeType);
            ovozMatni = groqTranscribeAudio(blob);
          }catch(gtErr){ try{ Logger.log('Groq Whisper xato, Geminiga o\'tildi: '+gtErr); }catch(e){} ovozMatni=null; }
        }

        if(ovozMatni){
          // Groq: matnga o'tkazildi (tez) — JSON ajratish aiCall() ichida yana Groq'da davom etadi
          aiParts.push({ text: "Ovozli xabar matni: \"" + ovozMatni + "\"\nUshbu matnni tahlil qil va Sklad formatida JSON qaytar." });
        } else {
          // Zaxira: Gemini multimodal (audio to'g'ridan-to'g'ri)
          var b64 = Utilities.base64Encode(blob.getBytes());
          aiParts.push({ inlineData: { mimeType: mimeType, data: b64 } });
          aiParts.push({ text: "Bu ovozli xabarni tahlil qil va Sklad formatida JSON qaytar." });
        }
      } else {
        yubor('❌ Ovozli xabarni yuklab bo\'lmadi.');
        return;
      }
    } else if (matn) {
      if(!matn.toLowerCase().includes('prixod') && !matn.toLowerCase().includes('rasxod') && !matn.toLowerCase().includes('keldi') && !matn.toLowerCase().includes('ketdi')) {
        // Omborga daxldor bo'lmasa rad etamiz, chunki oddiy xabar
        return; 
      }
      yubor('🔄 Matn tahlil qilinmoqda (AI)...');
      aiParts.push({ text: matn });
    } else {
      return;
    }

    var _skTurlari = (function(){
      try{
        var t = _skladDropdownOl().turlari;
        if(t && t.length) return t.join('", "');
      }catch(e){}
      return 'Бетон", "Металл", "Пиломатериалы", "Кабель", "ЖБ", "Песок", "Шебень", "Известь", "Кирпич';
    })();

    var sysPrompt =
      "Sen qurilish omborining aqlli yordamchisisan. \n" +
      "Omborchining ovozli yoki yozma xabarini tahlil qilib, QAT'IY JSON ARRAY formatida ma'lumot qaytar!\n\n" +
      "Xabarda omborga kelgan (Приход) yoki ombordan chiqqan (Расход) materiallar aytiladi.\n\n" +
      "QAYTARISH FORMATI (JSON ARRAY):\n" +
      "[\n" +
      "  {\n" +
      "    \"operatsiya\": \"prixod\" yoki \"rasxod\",\n" +
      "    \"turi\": \"" + _skTurlari + "\" yoki \"Прочее\" (mavjud turlardan eng mosini tanla, hech qaysi mos kelmasa \"Прочее\"),\n" +
      "    \"sanasi\": \"\",\n" +
      "    \"nomi\": \"Materialning to'liq nomi\",\n" +
      "    \"birligi\": \"шт\", \"м\", \"м3\", \"кг\", \"тн\" kabi,\n" +
      "    \"obyomi\": Miqdori (faqat raqam),\n" +
      "    \"postavshik\": (Faqat prixod uchun) Kim yoki qaysi firma obkelgani,\n" +
      "    \"qabul_qiluvchi\": (Faqat rasxod uchun) Kimga berilgani (ism yoki firma yoki blok nomi),\n" +
      "    \"qabul_turi\": (Faqat rasxod uchun) agar qabul qiluvchi subpudrat firma bo'lsa \"subpudrat\", agar bino yoki qism bo'lsa \"blok\", aks holda ism/brigada bo'lsa \"prarab\" deb yoz.\n" +
      "  }\n" +
      "]\n\n" +
      "DIQQAT: Qat'iy ARRAY qaytarasan. Agar xabarda 1 ta material aytilsa ham, uni massiv ichiga sol [ { ... } ]. Faqat JSON, markdown siz!";

    var req = {
      system: sysPrompt,
      parts: aiParts,
      temp: 0.1,
      maxTok: 800,
      json: true
    };
    
    var resText = (typeof aiCall==='function') ? aiCall(req) : null;
    if (!resText) {
      yubor('❌ AI dan javob kelmadi yoki xatolik yuz berdi.');
      return;
    }

    var parsed = JSON.parse(resText);
    if (!Array.isArray(parsed)) parsed = [parsed];

    if(parsed.length === 0) {
      yubor('❌ Xabardan hech qanday sklad ma\'lumoti topilmadi.');
      return;
    }

    yubor('🔄 Google Sheetga yozilmoqda...');

    var natijalar = [];
    for(var i=0; i<parsed.length; i++) {
      var item = parsed[i];
      if(!item.operatsiya) continue;

      // Mavjud (belgilangan) nomlardan mos variant qidirish — aynan/deyarli mos bo'lsa
      // o'sha nomdan foydalanamiz (dublikat/imlo xilma-xilligi kamayadi); aks holda
      // AI topgan nom YANGI sifatida yoziladi (topilmasagina yangi yozish qoidasi).
      var oxshash = null;
      if(item.nomi){
        try{
          var nomz = _skladNomTaklif(item.nomi, 3);
          if(nomz.length && nomz[0].skor>=90){
            item.nomi = nomz[0].nom;
          } else if(nomz.length && nomz[0].skor>=50){
            oxshash = nomz.map(function(n){return n.nom;}).join(' / ');
          }
        }catch(nErr){}
      }

      var res = apiSkladgaYozish(item, item.operatsiya);
      if(res.ok) {
        natijalar.push(res.xabar + (oxshash ? ('\n   ❓ Ўхшаш мавжуд номлар: '+oxshash) : ''));
      } else {
        natijalar.push("❌ Xato: " + (item.nomi||'?') + " - " + res.error);
      }
    }

    if(natijalar.length > 0) {
      yubor(natijalar.join('\n\n'));
    } else {
      yubor('❌ Hech narsa yozilmadi. Formati xato.');
    }

  } catch (err) {
    yubor('❌ Xatolik yuz berdi: ' + err.toString());
  }
}
