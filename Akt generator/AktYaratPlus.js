/******************************************************************
 * AktYaratPlus.js — AKT YARATISH GENERATORINI KUCHAYTIRISH (additiv)
 * ==================================================================
 * TitanAI.js (askTitanAiForAct) generatorini O'ZGARTIRMASDAN ustiga
 * 3 ta mustahkamlovchi qatlam qo'shadi:
 *   1) aktDedupTekshir(apply) — DETERMINISTIK dublikat nazorati
 *      (AI qoidasi #9 ga tayanmasdan): bir xil OBYEKT+ish nomi, akt
 *      fayli yo'q qatorlarni topadi; apply=true bo'lsa STATUS='DUPLIKAT'
 *      deb belgilaydi (O'CHIRMAYDI — xavfsiz).
 *   2) aktYaratSmetadan(obyekt) — SMETADAN grounded avto-akt: smetada
 *      bajarilgan, lekin aktsiz YASHIRIN ishlarni olib, ularga akt
 *      yaratadi (uydirma emas — haqiqiy bajarilgan ishlar).
 *   3) aktYaratHisobot(obyekt) — yaratishdan keyin TO'LIQ holat:
 *      tayyor / komissiya kerak / dublikat / sifat muammosi (bitta xulosa).
 *
 * Bog'liq: Code.js (REY/CONFIG/headerMap_/writeRow_/isRowReadyForCreate_),
 *   TitanAI.js (askTitanAiForAct), AktAIChat.js (aktDefaultsApply),
 *   AktSmetaBridge.js (aktAiKamchilik), AktQuality.js (aktSifatTekshir).
 ******************************************************************/

function _aypNorm(s){ return String(s||'').toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g,''); }
function _aypRey(){ return (typeof CONFIG!=='undefined'&&CONFIG.REYESTR_SHEET)?CONFIG.REYESTR_SHEET:'REYESTR'; }
function _aypCol(map,key,alt){ return map[(typeof REY!=='undefined'&&REY[key])||alt]||map[alt]; }

/* ══════════════════════════════════════════════════════════════
 * 1) DETERMINISTIK DUBLIKAT NAZORATI
 * ══════════════════════════════════════════════════════════════ */
function aktDedupTekshir(apply){
  try{
    var ss=SpreadsheetApp.getActiveSpreadsheet();
    var sh=ss.getSheetByName(_aypRey());
    if(!sh||sh.getLastRow()<2) return {dublikat:0, text:'REYESTR bo\'sh.'};
    var map=headerMap_(sh);
    var cW=_aypCol(map,'WORK_NAME','WORK_NAME'), cO=_aypCol(map,'OBJECT_NAME','OBJECT_NAME'),
        cU=_aypCol(map,'ACT_FILE_URL','ACT_FILE_URL'), cSt=_aypCol(map,'STATUS','STATUS'),
        cErr=_aypCol(map,'ERROR','ERROR'), cNum=_aypCol(map,'ACT_NUMBER','ACT_NUMBER');
    if(!cW||!cO) return {dublikat:0, text:'Ustunlar topilmadi.'};
    var v=sh.getRange(2,1,sh.getLastRow()-1,sh.getLastColumn()).getValues();
    var korilgan={}, dubs=[];
    for(var i=0;i<v.length;i++){
      var row=v[i];
      var work=String(row[cW-1]||'').trim(); if(!work) continue;
      var obj=String(row[cO-1]||'').trim();
      var hasFile=cU && String(row[cU-1]||'').trim();
      var key=_aypNorm(obj)+'||'+_aypNorm(work);
      if(korilgan[key]){
        // dublikat — faqat akt fayli BO'LMAGANINI belgilaymiz (faylik bor bo'lsa tegmaymiz)
        if(!hasFile) dubs.push({row:i+2, num:(cNum?row[cNum-1]:''), work:work, obj:obj, asl:korilgan[key]});
      } else {
        korilgan[key]={row:i+2, num:(cNum?row[cNum-1]:'')};
      }
    }
    if(apply && dubs.length){
      dubs.forEach(function(d){
        if(cSt) sh.getRange(d.row, cSt).setValue('DUPLIKAT');
        if(cErr) sh.getRange(d.row, cErr).setValue('Dublikat: '+d.obj+' / '+d.work+' (asl qator '+d.asl.row+')');
      });
      SpreadsheetApp.flush();
    }
    var L=['Dublikat (akt fayli yo\'q): '+dubs.length+' ta'+(apply?' — STATUS=DUPLIKAT belgilandi':'')];
    dubs.slice(0,25).forEach(function(d){ L.push('• №'+d.num+' ['+d.obj+'] '+(d.work.length>50?d.work.slice(0,50)+'…':d.work)+' (asl: '+d.asl.row+'-qator)'); });
    return {dublikat:dubs.length, rows:dubs, text:L.join('\n')};
  }catch(e){ return {dublikat:0, error:String(e.message||e), text:'❌ '+(e.message||e)}; }
}

/* ══════════════════════════════════════════════════════════════
 * 2) SMETADAN GROUNDED AVTO-AKT — aktsiz yashirin ishlarga
 * ══════════════════════════════════════════════════════════════ */
function aktYaratSmetadan(obyekt){
  try{
    if(!obyekt) return {success:false, error:'Obyekt tanlanmagan'};
    if(typeof askTitanAiForAct!=='function') return {success:false, error:'TitanAI.js (askTitanAiForAct) yo\'q'};
    if(typeof aktAiKamchilik!=='function') return {success:false, error:'AktSmetaBridge.js (aktAiKamchilik) yo\'q'};

    var k=aktAiKamchilik(obyekt);
    var ishlar=(k && k.ishlar) ? k.ishlar : [];
    if(!ishlar.length) return {success:true, message:'✅ '+obyekt+': smetada aktsiz yashirin ish topilmadi (yoki hub sinx bo\'lmagan).', actsCreated:false};

    var royxat = ishlar.slice(0,20).map(function(r){
      return '- '+(r.nom||'') + (r.birlik?(' ('+r.birlik+')'):'') + (r.razdel?(' | razdel: '+r.razdel):'');
    }).join('\n');
    var prompt =
      'Quyidagi ishlar SMETADA bajarilgan (FAKT>0), lekin ularga AOSR akti YO\'Q. '+
      'Har bittasiga bittadan AOSR akt yarat. OBYEKT: "'+obyekt+'".\n'+
      'Materiallarni ish nomidan mantiqan keltir (hajm/GOST yozma). Sanalarni ketma-ket qo\'y.\n\n'+
      'AKTSIZ ISHLAR:\n'+royxat;

    // TitanAI generatori (xotira/defaults: obyekt berilgani uchun targetMemory ishlaydi)
    var res = askTitanAiForAct(prompt, null, '', obyekt);

    // Komissiya/papka defaults avtomat
    if(res && res.success && res.actsCreated){
      try{
        if(typeof aktDefaultsApply==='function'){
          var ap=aktDefaultsApply(obyekt);
          if(ap.toldirildi>0) res.message=(res.message||'')+'\n🔧 Komissiya '+ap.toldirildi+' qatorga to\'ldirildi.';
          if(ap.tayyor>0) res.message+='\n✅ '+ap.tayyor+' ta akt yaratishga tayyor.';
        }
      }catch(e){}
    }
    return res;
  }catch(e){ return {success:false, error:String(e.message||e)}; }
}

/* ══════════════════════════════════════════════════════════════
 * 3) YARATISHDAN KEYIN TO'LIQ HOLAT — bitta xulosa
 * ══════════════════════════════════════════════════════════════ */
function aktYaratHisobot(obyekt){
  try{
    var L=[];
    // a) komissiya defaults to'ldirish (agar obyekt berilgan)
    if(obyekt && typeof aktDefaultsApply==='function'){
      var ap=aktDefaultsApply(obyekt);
      L.push('Komissiya/papka: '+ap.toldirildi+' qator to\'ldirildi, '+ap.tayyor+' ta tayyor'+(ap.shablonYoq?' (⚠️ shablon yo\'q — "komissiya sozla")':''));
    }
    // b) dublikat
    var dd=aktDedupTekshir(false);
    L.push('Dublikat: '+dd.dublikat+' ta'+(dd.dublikat?' (tozalash: aktDedupTekshir(true))':''));
    // c) sifat (AOSR) — AktQuality
    if(typeof aktSifatTekshir==='function'){
      var q=aktSifatTekshir(obyekt||'');
      L.push('Sifat: jami '+(q.jami||0)+', tayyor '+(q.tayyor||0)+', muammoli '+(q.muammoli||0));
    }
    return {text:'📋 AKT HOLATI'+(obyekt?(' — '+obyekt):'')+':\n'+L.join('\n')};
  }catch(e){ return {text:'❌ '+(e.message||e)}; }
}

/* UI o'ramlari (menyu) */
function aktDedupUI(){
  var ui=SpreadsheetApp.getUi();
  var r=aktDedupTekshir(false);
  if(!r.dublikat){ ui.alert('✅ Dublikat topilmadi.'); return; }
  var resp=ui.alert('Dublikat: '+r.dublikat+' ta', r.text+'\n\nSTATUS=DUPLIKAT deb belgilaymi?', ui.ButtonSet.YES_NO);
  if(resp===ui.Button.YES){ aktDedupTekshir(true); ui.alert('✅ Belgilandi. REYESTR\'da STATUS=DUPLIKAT bo\'yicha filtrlab ko\'ring.'); }
}
function aktYaratSmetadanUI(){
  var ui=SpreadsheetApp.getUi();
  var res=ui.prompt('Smetadan avto-akt','Obyekt nomini kiriting (aktsiz yashirin ishlarga akt yaratiladi):', ui.ButtonSet.OK_CANCEL);
  if(res.getSelectedButton()!==ui.Button.OK) return;
  var ob=String(res.getResponseText()||'').trim(); if(!ob) return;
  var r=aktYaratSmetadan(ob);
  ui.alert(r.success?(r.message||'Bajarildi'):('❌ '+(r.error||'xato')));
}

function aktYaratPlusTest(){ Logger.log(JSON.stringify(aktDedupTekshir(false),null,2)); }
