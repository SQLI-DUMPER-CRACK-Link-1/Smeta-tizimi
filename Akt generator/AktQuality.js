/******************************************************************
 * AktQuality.js — AKT GENERATOR: AOSR SIFAT NAZORATI (AI darvoza)
 * ==================================================================
 * Fayl yaratishdan OLDIN har bir akt qatorini MANTIQAN tekshiradi:
 *   - Yashirin ishmi (AOSR faqat yashirin ishga tuziladi)?
 *   - Majburiy maydonlar to'liqmi (isRowReadyForCreate_)?
 *   - Sanalar mantiqiymi (boshlanish <= tugash)?
 *   - Material bormi? Komissiya/papka bormi?
 * So'ng AI kamchiliklarni o'zbekcha xulosa qiladi va nima qilishni aytadi.
 * Shu bilan "akt yaratish" oldidan nosozlik oldindan ko'rinadi.
 *
 * Kirish:
 *   aktSifatTekshir(obyekt?)  -> {text, jami, tayyor, muammoli, rows}
 *   aktSifatUI()              -> menyu/alert (faol obyekt yoki barchasi)
 *
 * Yadro: Code.js (REY,CONFIG,headerMap_,isRowReadyForCreate_),
 *        AktSmetaBridge.js (_aktYashirinMi), GeminiAssistant.js (_aktAiGen).
 ******************************************************************/

function aktSifatTekshir(obyekt){
  try{
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var shName=(typeof CONFIG!=='undefined'&&CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR';
    var sh=ss.getSheetByName(shName);
    if(!sh||sh.getLastRow()<2) return {text:'REYESTR bo\'sh.', jami:0};
    var map=headerMap_(sh);
    var H=function(k,alt){ return map[(typeof REY!=='undefined'&&REY[k])||alt]||map[alt]; };
    var cNum=H('ACT_NUMBER','ACT_NUMBER'), cWork=H('WORK_NAME','WORK_NAME'), cObj=H('OBJECT_NAME','OBJECT_NAME'),
        cMat=H('MATERIAL','MATERIAL'), cSt=H('START_DATE','START_DATE'), cEnd=H('END_DATE','END_DATE'),
        cUrl=H('ACT_FILE_URL','ACT_FILE_URL'), cFold=H('TARGET_FOLDER_ID','TARGET_FOLDER_ID');
    var v=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    var on=obyekt?String(obyekt).trim().toUpperCase():'';

    var jami=0, tayyor=0, borAkt=0, muammoli=[], xulosaSanoq={};
    function bayroq(k){ xulosaSanoq[k]=(xulosaSanoq[k]||0)+1; }

    for(var i=0;i<v.length;i++){
      var row=v[i];
      var work=cWork?String(row[cWork-1]||'').trim():'';
      var obj=cObj?String(row[cObj-1]||'').trim():'';
      if(!work && !obj) continue;
      if(on && obj.toUpperCase()!==on) continue;
      jami++;

      // akt fayli bormi
      if(cUrl && String(row[cUrl-1]||'').trim()){ borAkt++; continue; }

      var muam=[];
      // obj/work
      if(!obj){ muam.push('obyekt yo\'q'); bayroq('obyekt'); }
      if(!work){ muam.push('ish nomi yo\'q'); bayroq('ish'); }
      // yashirin ish (AOSR mantiqи)
      if(work && typeof _aktYashirinMi==='function' && !_aktYashirinMi(work)){
        muam.push('AOSR shart emas? (yashirin ish emasga o\'xshaydi)'); bayroq('yashirin_emas');
      }
      // material
      if(cMat && !String(row[cMat-1]||'').trim()){ muam.push('material yo\'q'); bayroq('material'); }
      // sanalar
      var sd=cSt?_aktKun(row[cSt-1]):null, ed=cEnd?_aktKun(row[cEnd-1]):null;
      if(cEnd && !String(row[cEnd-1]||'').trim()){ muam.push('tugash sanasi yo\'q'); bayroq('sana_yoq'); }
      if(sd&&ed&&sd>ed){ muam.push('boshlanish > tugash (sana xato)'); bayroq('sana_xato'); }
      // papka
      if(cFold && !String(row[cFold-1]||'').trim()){ muam.push('papka tanlanmagan'); bayroq('papka'); }
      // umumiy tayyorlik
      var tayyorMi=false;
      try{
        var obj2={}; sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].forEach(function(h,idx){ if(h) obj2[String(h).trim()]=row[idx]; });
        tayyorMi=(typeof isRowReadyForCreate_==='function') && isRowReadyForCreate_(obj2);
      }catch(e){}
      if(tayyorMi && !muam.length){ tayyor++; }
      else{
        if(tayyorMi) tayyor++; // tayyor, lekin sifat ogohlantirishi bor
        if(muam.length) muammoli.push({ row:i+2, num:(cNum?row[cNum-1]:''), work:work.slice(0,50), obj:obj, muam:muam });
      }
    }

    // Matn (kod) + AI xulosa
    var L=['REYESTR'+(obyekt?(' / '+obyekt):'')+': jami '+jami+' qator, akt fayli bor '+borAkt+', yaratishga tayyor '+tayyor+', muammoli '+muammoli.length];
    if(Object.keys(xulosaSanoq).length){
      L.push('Kamchilik turlari: '+Object.keys(xulosaSanoq).map(function(k){return k+'='+xulosaSanoq[k];}).join(', '));
    }
    muammoli.slice(0,25).forEach(function(m){
      L.push('• №'+m.num+' ['+m.obj+'] '+m.work+' -> '+m.muam.join('; '));
    });

    var aiText='';
    try{
      if(typeof _aktAiGen==='function' && typeof _aktAiKey==='function' && _aktAiKey()){
        var sys='Sen qurilish hujjat nazoratchisisan. Senga AOSR aktlar REYESTRi sifat tekshiruvi natijasi beriladi.\n'+
          'O\'zbek tilida QISQA (180 so\'z): umumiy holat, eng ko\'p uchragan kamchilik, qaysi aktlar fayl yaratishga tayyor emas va NIMA qilish kerak. '+
          'Markdown: **qalin**, - ro\'yxat. Son o\'ylab chiqarma.';
        aiText=_aktAiGen(sys, L.join('\n'), {temp:0.25, maxTok:800});
      }
    }catch(e){}

    return { text:(aiText||L.join('\n')), raw:L.join('\n'), jami:jami, tayyor:tayyor, borAkt:borAkt, muammoli:muammoli.length, rows:muammoli.slice(0,50) };
  }catch(e){ return {text:'❌ '+(e.message||e), error:String(e.message||e)}; }
}

function _aktKun(v){
  if(v instanceof Date && !isNaN(v)) return v;
  var s=String(v||'').trim(); var m=s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if(m) return new Date(+m[3],+m[2]-1,+m[1]);
  var d=new Date(s); return isNaN(d.getTime())?null:d;
}

/* Menyu/alert */
function aktSifatUI(){
  var ui=SpreadsheetApp.getUi();
  var r=aktSifatTekshir('');
  var txt=String(r.text||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^- /gm,'• ');
  ui.alert('🧪 AOSR sifat nazorati', txt, ui.ButtonSet.OK);
}

function aktSifatTest(){ Logger.log(JSON.stringify(aktSifatTekshir(''),null,2)); }
