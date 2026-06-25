/********************************************************************
 * 02_Menu.gs — MENYU (yagona onOpen)
 ********************************************************************/

function onOpen(){
  try{ _keshVaraqTuzat(); }catch(e){}  // _KESH ni tartibli formatga keltir (ulkan yacheyka qotishini oldini oladi)
  SpreadsheetApp.getUi()
    .createMenu('🏗️ СМЕТА')
    .addItem('🎛️ Бошқарув панели',                'panelOch')
    .addSeparator()
    .addItem('① Созламаларни ярат',              'uiSozlama')
    .addItem('② Папкани ўқи — БАРЧА объект',      'uiPapkaBarcha')
    .addItem('   Папкани ўқи — битта объект',     'uiPapkaBitta')
    .addItem('③ Маркировкани қайта аниқла',       'uiMarker')
    .addItem('④ Серверга йиғ (DASHBOARD)',        'uiServer')
    .addItem('ℹ️ Папкадаги объектларни кўрсат',   'uiRoyxat')
    .addSeparator()
    .addItem('📊 Навбат холати',                   'uiNavbatHolat')
    .addItem('🧹 Вақтинча/дубликат файлларни тозалаш', 'uiTmpTozala')
    .addItem('🔄 Кешни янгила (барча объект)',     'uiKeshYangilash')
    .addItem('🔓 Қулф холатини текшир',            'uiLockHolat')
    .addItem('📊 Нархлар варағини яратиш/янгилаш', 'uiNarxlarYarat')
    .addSeparator()
    .addItem('🔬 Тизим диагностикаси',             'diagnostikaIshlat')
    .addToUi();
}

/* Fon navbat jarayonini ko'rsatadi (alert). Qayta bosib yangilanadi. */
function uiNavbatHolat(){
  try{
    var h = apiNavbatHolat();
    var msg;
    if(!h.running && h.bajarilgan===0){
      msg = 'Навбат бўш — ҳозир ҳеч нарса ишламаяпти.\n\n'
          + 'Бошлаш: 🏗️ СМЕТА → ② Папкани ўқи — БАРЧА объект';
    } else {
      msg = (h.running ? '⏳ ИШЛАМОҚДА...' : '✅ ТУГАДИ') + '\n\n'
          + 'Бажарилган: '+h.bajarilgan+' / '+h.jami+'  ('+h.foiz+'%)\n'
          + (h.running && h.hozir ? 'Ҳозир: '+h.hozir+'\n' : '')
          + 'Қолган: '+h.qolgan+'\n\n';
      var log = h.log||[], boshl = Math.max(0, log.length-12);
      for(var i=boshl; i<log.length; i++){
        var L=log[i];
        msg += (L.ok?'✓ ':'✗ ')+L.ob
             + (L.ok ? ('  ('+(L.qator||0)+' қатор, '+(L.sek||0)+'с)'
                        + (L.locked?' 🔒':''))
                     : ('  — '+(L.xato||'хато'))) + '\n';
      }
      if(h.running) msg += '\n(Янгилаш учун шу менюни қайта босинг)';
    }
    SpreadsheetApp.getUi().alert(msg);
  }catch(e){ _err(e); }
}

/* Lock holatini ASL MANBADAN (SOZLAMALAR_ҚУЛФ) ko'rsatadi — kesh EMAS.
 * Narxlash aynan shu varaqdan o'qiydi (lockMi), shuning uchun haqiqiy holat shu. */
function uiLockHolat(){
  try{
    var m = lockMap();            // SOZLAMALAR_ҚУЛФ dan to'g'ridan-to'g'ri
    var obs = papkaSkan();
    var msg = 'ҚУЛФ ҲОЛАТИ — асл манба (SOZLAMALAR_ҚУЛФ):\n'
            + 'Нархлаш айнан шу ҳолатдан ўқийди.\n\n';
    var qulfN = 0;
    for(var i=0;i<obs.length;i++){
      var ob = obs[i].obyekt, d = m[ob];
      var locked = !!(d && d.holat==='locked');
      if(locked) qulfN++;
      msg += (locked ? '🔒 ҚУЛФ ' : '✓ очиқ ') + ob
           + (locked && d.sana ? ('  ('+d.sana+')') : '') + '\n';
    }
    msg += '\nЖами: '+obs.length+' объект, '+qulfN+' та қулфланган.\n'
         + (qulfN===0 ? 'Барчаси ОЧИҚ — [Ишла] тўлиқ қайта нархлайди.'
                      : 'Қулфланганлар [Ишла] да фақат + қаторларни янгилайди.');
    SpreadsheetApp.getUi().alert(msg);
  }catch(e){ _err(e); }
}

/* ① sozlama */
function uiSozlama(){ try{ sozlamalarYarat(); }catch(e){ _err(e); } }

/* ② butun papka — FON NAVBATда (har obyekt alohida trigger, timeout YO'Q) */
function uiPapkaBarcha(){
  try{
    if(!_tasdiq('ROOT папкадаги БАРЧА объект ФОН НАВБАТда ишланади.\n\n'
              + 'Ҳар объект алоҳида ишлайди — 6 дақиқа timeout ЙЎҚ.\n'
              + 'Жараённи "📊 Навбат холати" дан кузатасиз. Давом?')) return;
    var r = navbatBoshla(null);
    SpreadsheetApp.getUi().alert(
      '✅ НАВБАТ БОШЛАНДИ\n\n'
      + (r.jami||0)+' объект фон навбатга қўйилди.\n'
      + 'Ҳар бири алоҳида trigger-да ишланади (timeout йўқ).\n\n'
      + 'Кузатиш: 🏗️ СМЕТА → 📊 Навбат холати\n'
      + 'Тугагач DASHBOARD ва кеш автоматик янгиланади.'
    );
  }catch(e){ _err(e); }
}

/* ② bitta obyekt */
function uiPapkaBitta(){
  try{ var ob=_pick(); if(ob) lrvPlusYasaObyekt(ob); }catch(e){ _err(e); }
}

/* ③ markirovka */
function uiMarker(){
  try{ var ob=_pick(); if(ob) markirovkaQaytaObyekt(ob); }catch(e){ _err(e); }
}

/* ④ server */
function uiServer(){ try{ serverYigPapka(); }catch(e){ _err(e); } }

/* ℹ️ ro'yxat */
function uiRoyxat(){
  try{
    var obs=papkaSkan();
    if(!obs.length){ SpreadsheetApp.getUi().alert('ROOT papkada obyekt (sub-papka) topilmadi.'); return; }
    var msg='ROOT papkada '+obs.length+' obyekt:\n\n';
    for(var i=0;i<obs.length;i++){
      msg+=(i+1)+') '+obs[i].obyekt+'\n'
         +'    ЛОК:  '+obs[i].lokName+'\n'
         +'    СВОД: '+obs[i].svodName+'\n';
    }
    SpreadsheetApp.getUi().alert(msg);
  }catch(e){ _err(e); }
}


/* ====== obyekt tanlash ====== */
function _pick(){
  var obs=papkaSkan(), ui=SpreadsheetApp.getUi();
  if(!obs.length){ ui.alert('ROOT papkada obyekt topilmadi. SOZLAMALAR → ROOT_FOLDER_ID tekshir.'); return ''; }
  if(obs.length===1) return obs[0].obyekt;
  var msg='Қайси объект?\n\n';
  for(var i=0;i<obs.length;i++) msg+=(i+1)+') '+obs[i].obyekt+'\n';
  msg+='\nРақам ёз (1-'+obs.length+'):';
  var res=ui.prompt('Объект танлаш', msg, ui.ButtonSet.OK_CANCEL);
  if(res.getSelectedButton()!==ui.Button.OK) return '';
  var k=parseInt(String(res.getResponseText()).trim(),10);
  if(isNaN(k)||k<1||k>obs.length){ ui.alert('Нотўғри рақам.'); return ''; }
  return obs[k-1].obyekt;
}

/* narxlar varaqi */
function uiNarxlarYarat(){
  try{
    SpreadsheetApp.getUi().alert('NARXLAR varaqi tayyorlanmoqda...\nBarcha ob\'ektlar LRV_PLUS laridan resurslar yig\'iladi.\n(1-3 daqiqa)');
    var r = apiNarxlarYarat();
    SpreadsheetApp.getUi().alert('NARXLAR varaqi tayyor!\n\n'+r.xabar);
  }catch(e){ _err(e); }
}

/* _TMP_ va dublikat tozalash */
function uiTmpTozala(){
  try{
    var r=tmpTozala();
    SpreadsheetApp.getUi().alert('🧹 '+r.xabar);
  }catch(e){ _err(e); }
}

/* kesh yangilash */
function uiKeshYangilash(){
  try{
    SpreadsheetApp.getUi().alert('Кеш янгиланмоқда... Тайёр бўлганида хабар берилади.\n(2-5 дақиқа кетиши мумкин)');
    apiKeshYangilash();
  }catch(e){ _err(e); }
}

function _err(e){ SpreadsheetApp.getUi().alert('Хато:\n'+(e&&e.message?e.message:e)); }

/* Tizim diagnostikasi — obyektlarni skan qilish va muammoni aniqlash */
function diagnostikaIshlat() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('_DIAGNOSTIKA');
  if (sh) {
    try { ss.deleteSheet(sh); } catch(e) {}
  }
  sh = ss.insertSheet('_DIAGNOSTIKA');
  
  var rows = [];
  rows.push(['Obyekt', 'Holat', 'Lok File', 'Svod File', 'Lok Sheets', 'Varaqlar Count', 'Varaqlar Nomlari', 'Xabar']);
  
  try {
    var obs = papkaSkan();
    var lockM = lockMap();
    
    for (var i = 0; i < obs.length; i++) {
      var ob = obs[i];
      var name = ob.obyekt;
      var locked = !!(lockM[name] && lockM[name].holat === 'locked');
      
      var msg = '';
      var varaqCount = 0;
      var varaqNomlari = '';
      
      var lokSS = null;
      var err = '';
      try {
        if (ob.lokFile) {
          lokSS = _openAsSheet(ob.lokFile, ob.folderId);
          var sheets = lokSS.getSheets();
          var varaqlar = [];
          for (var s = 0; s < sheets.length; s++) {
            var src = sheets[s], snm = src.getName();
            if (_skip(snm)) continue;
            if (ob.lokSheets && ob.lokSheets.length && ob.lokSheets.indexOf(snm) < 0) continue;
            if (src.getLastRow() < 2) continue;
            varaqlar.push(snm);
          }
          varaqCount = varaqlar.length;
          varaqNomlari = varaqlar.join(', ');
        } else {
          err = 'Lok fayl topilmadi';
        }
      } catch (e) {
        err = String(e.message || e);
      }
      
      rows.push([
        name,
        locked ? 'LOCKED' : 'OPEN',
        ob.lokName,
        ob.svodName,
        ob.lokSheets ? ob.lokSheets.join(', ') : '',
        varaqCount,
        varaqNomlari,
        err || 'OK'
      ]);
    }
  } catch (e) {
    rows.push(['XATO', '', '', '', '', '', '', String(e.message || e)]);
  }
  
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.autoResizeColumns(1, rows[0].length);
  ss.setActiveSheet(sh);
  SpreadsheetApp.getUi().alert('Diagnostika tugadi. "_DIAGNOSTIKA" varag\'ini ko\'ring.');
}

