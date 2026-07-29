/********************************************************************
 * 99_Diagnostika.js — CHUQUR TIZIM DIAGNOSTIKASI (2026-07-18)
 * ==================================================================
 * MAQSAD: foydalanuvchi 20 joyni qo'lda sinamasin. BIR BOSISHDA butun
 * tizim tekshiriladi va natija:
 *   (1) Panelda ko'rinadi,
 *   (2) Drive'ga `_DIAGNOSTIKA.txt` fayl sifatida yoziladi —
 *       shu faylni dasturchi (AI) TO'G'RIDAN-TO'G'RI o'qiy oladi.
 *
 * Tekshiradi: konfiguratsiya, funksiya registri, РАЗДЕЛЛАР reestri,
 * har obyektning LRV strukturasi (axlat razdel, otasiz resurs, Д1-Д3
 * tasnifi, oy ustunlari, ЖАМИ formulalari), buxgalteriya varaqlari.
 ********************************************************************/

var _DIAG_FILE = '_DIAGNOSTIKA.txt';

function apiTolaDiagnostika(obyektlar){
  var T0 = Date.now(), BUDGET = 4*60*1000;   // 4 daq — 6 daq limitdan zaxira bilan
  var L = [];   // hisobot qatorlari
  var xato = 0, ogoh = 0;
  function say(s){ L.push(s); }
  function ERR(s){ xato++; say('❌ '+s); }
  function WARN(s){ ogoh++; say('⚠️  '+s); }
  function OK(s){ say('✅ '+s); }

  say('╔══════════════════════════════════════════════════════════╗');
  say('║  SMETA TIZIMI — CHUQUR DIAGNOSTIKA                       ║');
  say('╚══════════════════════════════════════════════════════════╝');
  say('Вақт: '+Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','yyyy-MM-dd HH:mm:ss'));
  say('');

  /* ── 1. KONFIGURATSIYA ── */
  say('── 1. КОНФИГУРАЦИЯ ──');
  var a=null;
  try{
    a = sozAsosiy();
    if(!a.rootId) ERR('ROOT папка ID йўқ (Созламалар)');
    else OK('ROOT папка: '+a.rootId);
    try{ DriveApp.getFolderById(a.rootId).getName(); OK('ROOT папка очилди'); }
    catch(e){ ERR('ROOT папка ОЧИЛМАДИ: '+(e.message||e)); }
    try{ var _ss=_serverSS(a); OK('_SERVER_DASHBOARD: '+_ss.getName()); }
    catch(e){ ERR('_SERVER_DASHBOARD очилмади: '+(e.message||e)); }
  }catch(e){ ERR('sozAsosiy() ЙИҚИЛДИ: '+(e.message||e)); }
  say('');

  /* ── 2. FUNKSIYA REGISTRI ── */
  say('── 2. ФУНКЦИЯ РЕГИСТРИ ──');
  try{
    if(typeof selftestFunksiyalar==='function'){
      // ⚡ 2026-07-18: avval `[object Object]` chiqardi — selftest natijasi obyekt
      // (matn maydoni boshqacha nomlanadi). Endi barcha ehtimoliy maydonlar ko'riladi.
      var r=selftestFunksiyalar();
      var txt='';
      if(typeof r==='string') txt=r;
      else if(r){
        txt = r.matn || r.xabar || r.text || r.natija || '';
        if(!txt && r.qatorlar) txt = (r.qatorlar||[]).join(' | ');
        if(!txt){ try{ txt=JSON.stringify(r); }catch(e){ txt='(натижа ўқилмади)'; } }
      }
      txt=String(txt).replace(/\n+/g,' | ').slice(0,300);
      if(/ТОПИЛМАДИ|XATO|ХАТО/i.test(txt)){ ERR('Функциялар: '+txt); } else OK('Функциялар: '+txt);
    } else WARN('selftestFunksiyalar йўқ (98_SelfTest.js)');
  }catch(e){ ERR('Функция текшируви йиқилди: '+(e.message||e)); }
  // UI dan chaqiriladigan MUHIM funksiyalar (crash sabab bo'lганlar)
  ['apiXarajatOl','apiXarajatYoz','apiHolatOl','apiF2FaylOqi','apiF2Qolla','apiF2JobHolat',
   'apiF2TayyorHujjatYarat','apiDarajalarLrvGaYoz','apiRazdelShYasat','_soxtaRzNomMi',
   'apiShartnomaDashboard','apiBuxDashboard','apiTolovOl','apiSkladQoldiq','apiBossTahlilBoshla'
  ].forEach(function(fn){
    var bor=false; try{ bor=(eval('typeof '+fn)==='function'); }catch(e){}
    if(!bor) ERR('КРИТИК функция ЙЎҚ: '+fn);
  });
  say('');

  /* ── 3. BUXGALTERIYA / SHARTNOMA VARAQLARI (ishlash sinovi) ── */
  say('── 3. БУХГАЛТЕРИЯ / ШАРТНОМА ──');
  function _sinov(nom, fn){
    try{
      var res = fn();
      // ⚡ 2026-07-18: massiv → uzunlik; obyekt ichidagi massiv → uning uzunligi;
      // aks holda «ишлади» (avval «ok та ёзув» kabi g'alati matn chiqardi).
      var n=null;
      if(Array.isArray(res)) n=res.length;
      else if(res && typeof res==='object'){
        for(var k in res){ if(Array.isArray(res[k])){ n=res[k].length; break; } }
      }
      OK(nom+': '+(n===null?'ишлади ✓':(n+' та ёзув'))+' (ўқилди)');
    }catch(e){ ERR(nom+' ЙИҚИЛДИ: '+(e.message||e)); }
  }
  _sinov('Харажатлар', function(){ return apiXarajatOl(); });
  _sinov('Тўловлар', function(){ return apiTolovOl(); });
  _sinov('Шартномалар', function(){ return apiShartnomaOl(); });
  _sinov('Қўшимча ишлар', function(){ return apiQoshIshOl(); });
  _sinov('Накрутка', function(){ return apiNakrutkaOl(''); });
  _sinov('Склад қолдиқ', function(){ return apiSkladQoldiq(); });
  say('');

  /* ── 4. РАЗДЕЛЛАР REESTRI ── */
  say('── 4. РАЗДЕЛЛАР РЕЕСТРИ ──');
  try{
    var dsh=SpreadsheetApp.getActive().getSheetByName(CFG.RAZDEL_SH);
    if(!dsh) WARN('РАЗДЕЛЛАР варағи ҳали яратилмаган');
    else{
      var lr=dsh.getLastRow();
      if(lr<2) WARN('РАЗДЕЛЛАР бўш');
      else{
        var rv=dsh.getRange(2,1,lr-1,8).getValues();
        var jami=0, axlat=0, d1siz=0, obSet={};
        rv.forEach(function(row){
          var ob=String(row[0]||'').trim(); if(!ob) return;
          jami++; obSet[ob]=1;
          var rzNom=String(row[2]||'').trim();
          if(rzNom && typeof _soxtaRzNomMi==='function' && _soxtaRzNomMi(rzNom)) axlat++;
          if(!String(row[3]||'').trim()) d1siz++;
        });
        OK('Реестр: '+jami+' қатор, '+Object.keys(obSet).length+' объект');
        if(axlat) WARN('АХЛАТ (сарлавҳа/имзо) қаторлар: '+axlat+' та — «Реестрни тўла қайта қуриш» тавсия этилади');
        if(d1siz) WARN('Д-1 тўлдирилмаган: '+d1siz+' та ('+Math.round(d1siz/jami*100)+'%) — улар «Тақсимланмаган»да туради');
      }
    }
  }catch(e){ ERR('РАЗДЕЛЛАР текшируви: '+(e.message||e)); }
  say('');

  /* ── 5. OBYEKTLAR: LRV STRUKTURA SALOMATLIGI ── */
  say('── 5. ОБЪЕКТЛАР (LRV структураси) ──');
  var oblar = obyektlar && obyektlar.length ? obyektlar
            : (typeof _grafikParentObyektlar==='function' ? _grafikParentObyektlar() : []);
  say('Текширилади: '+oblar.length+' объект');
  var jamiIsh=0, jamiAxlatRz=0, jamiOtasizRs=0, jamiRz=0, jamiD1siz=0, tekshirildi=0, qoldi=[];
  var col=CFG.C;
  for(var oi=0; oi<oblar.length; oi++){
    if(Date.now()-T0 > BUDGET){ qoldi=oblar.slice(oi); break; }
    var ob=oblar[oi];
    try{
      var subs = (typeof _subObyektlar==='function') ? _subObyektlar(ob) : [];
      var targets = subs.length ? subs : [ob];
      var oIsh=0, oAxlat=0, oOtasiz=0, oRz=0, oD1siz=0, oFayl=0, oOy=0;
      targets.forEach(function(t){
        var plus=null; try{ plus=_plusTop(t); }catch(e){}
        if(!plus) return;
        oFayl++;
        plus.getSheets().forEach(function(sh){
          if(sh.getName().indexOf(CFG.LRV_SHEET)!==0) return;
          var last=sh.getLastRow(), start=(a&&a.dataQator>0)?a.dataQator:_autoData(sh);
          if(last<start) return;
          var n=last-start+1;
          var g=sh.getRange(start,1,n,Math.max(col.QAVAT3,col.MARKER)).getValues();
          var curBl=null;
          for(var i=0;i<n;i++){
            var mk=String(g[i][col.MARKER-1]||'').trim().toLowerCase().replace(/[+~]$/,'');
            if(mk==='rz'){
              oRz++;
              var nm=String(g[i][col.NOM-1]||'').trim();
              if(!nm){ for(var c=0;c<8;c++){ var v=String(g[i][c]||'').trim(); if(v&&/[А-ЯЁA-Za-zА-яёa-z]/.test(v)){ nm=v; break; } } }
              if(typeof _soxtaRzNomMi==='function' && _soxtaRzNomMi(nm)) oAxlat++;
              else if(!String(g[i][col.QAVAT1-1]||'').trim()) oD1siz++;
              curBl=null; continue;
            }
            if(mk==='bl'){ curBl=1; oIsh++; continue; }
            if(mk==='mat'||mk==='ob'){ oIsh++; continue; }
            if(mk==='rs'){ oIsh++; if(!curBl) oOtasiz++; continue; }
          }
          try{ oOy += _f2Oylar(sh).length; }catch(e){}
        });
      });
      tekshirildi++;
      jamiIsh+=oIsh; jamiAxlatRz+=oAxlat; jamiOtasizRs+=oOtasiz; jamiRz+=oRz; jamiD1siz+=oD1siz;
      var bayroq=[];
      if(!oFayl) bayroq.push('LRV_PLUS ЙЎҚ');
      if(oAxlat) bayroq.push(oAxlat+' ахлат-rz');
      if(oOtasiz) bayroq.push(oOtasiz+' ОТАСИЗ ресурс(даражада йўқолади!)');
      if(oD1siz) bayroq.push(oD1siz+' Д1-сиз rz');
      if(!oIsh && oFayl) bayroq.push('иш қатори 0 (бўш LRV?)');
      say((bayroq.length?'⚠️  ':'✅ ')+ob+' → '+oFayl+' файл, '+oRz+' rz, '+oIsh+' иш/ресурс, '+oOy+' ой'
          + (bayroq.length?('  ← '+bayroq.join('; ')):''));
      if(bayroq.length) ogoh++;
    }catch(e){ ERR(ob+' → '+(e.message||e)); }
  }
  say('');
  say('── 6. ЖАМИ ──');
  say('Текширилди: '+tekshirildi+'/'+oblar.length+' объект'+(qoldi.length?(' (вақт лимити — қолди: '+qoldi.length+')'):''));
  say('Иш/ресурс қаторлари: '+jamiIsh);
  say('Разделлар: '+jamiRz+(jamiAxlatRz?(' — шундан АХЛАТ: '+jamiAxlatRz+' ('+Math.round(jamiAxlatRz/Math.max(1,jamiRz)*100)+'%)'):''));
  if(jamiOtasizRs) say('⚠️  ОТАСИЗ ресурслар: '+jamiOtasizRs+' та — булар дарахтда КЎРИНМАЙДИ ва Ф2 га ТУШМАЙДИ!');
  if(jamiD1siz) say('⚠️  Д1 тўлдирилмаган разделлар: '+jamiD1siz+' та — «Тақсимланмаган»да туради');
  say('');
  say('НАТИЖА: '+(xato?('❌ '+xato+' ХАТО'):'✅ хато йўқ')+', '+ogoh+' огоҳлантириш');

  var matn = L.join('\n');

  /* ── Drive'ga yozamiz (dasturchi o'qishi uchun) ── */
  var url='';
  try{
    if(a && a.rootId){
      var folder=DriveApp.getFolderById(a.rootId);
      var it=folder.getFilesByName(_DIAG_FILE);
      if(it.hasNext()){ var f=it.next(); f.setContent(matn); url=f.getUrl(); }
      else { var nf=folder.createFile(_DIAG_FILE, matn, MimeType.PLAIN_TEXT); url=nf.getUrl(); }
    }
  }catch(e){ matn += '\n(⚠ Drive\'га ёзилмади: '+(e.message||e)+')'; }

  return {ok:(xato===0), xato:xato, ogoh:ogoh, matn:matn, url:url,
          jami:{ish:jamiIsh, rz:jamiRz, axlatRz:jamiAxlatRz, otasizRs:jamiOtasizRs, d1siz:jamiD1siz},
          tekshirildi:tekshirildi, qoldi:qoldi.length};
}

/* Faqat bitta obyekt uchun tez diagnostika (Panel: obyekt tanlangan bo'lsa) */
function apiObyektDiagnostika(obyekt){
  return apiTolaDiagnostika([obyekt]);
}
