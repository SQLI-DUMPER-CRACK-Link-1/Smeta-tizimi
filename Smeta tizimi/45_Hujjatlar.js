/********************************************************************
 * 45_Hujjatlar.gs — TASHQI HUJJATLAR (Akt / Prixod / Viborka)
 * ==================================================================
 * Har bir hujjat MUSTAQIL ishlaydi — LRV tizimiga bog'lanmagan.
 * Panel va Telegram dan faqat KO'RISH va YOZISH.
 *
 * Hujjat ID lari Script Property da (almashtirish oson):
 *   DOC_AKT, DOC_PRIXOD, DOC_VIBORKA
 * Standart qiymatlar pastda (_HUJ).
 ********************************************************************/

var _HUJ = {
  akt:     '1Co9bC9dEdJUG9wTEiQjUJ4KH-aCScQihkQ_9-MHQbP0',
  // 2026-07-03: hamkasb egalik qilgan "Navoiy park" (1DQPR05...) dan foydalanuvchining
  // o'z nusxasiga ("Copy of Navoiy park") o'tkazildi — Telegram AI sklad (86_Sklad.js,
  // SKLAD_FILE_ID) ham SHU faylga yozadi, endi Panel va Telegram bitta manbadan ishlaydi.
  prixod:  '10IWmAQTD384T7gRwSmipoEVtAqfa3J80z3B718U-lBw',
  viborka: '17PbwnwpQGhGPU_OMgnl605VmuRXzeFFSgG2QXdem_xY'
};

function _hujId(tur){
  var sp=PropertiesService.getScriptProperties();
  var key={akt:'DOC_AKT',prixod:'DOC_PRIXOD',viborka:'DOC_VIBORKA'}[tur];
  return (key && sp.getProperty(key)) || _HUJ[tur] || '';
}
/* Hujjat ID ni almashtirish: hujIdSet('prixod','YANGI_ID') */
function hujIdSet(tur, id){
  var key={akt:'DOC_AKT',prixod:'DOC_PRIXOD',viborka:'DOC_VIBORKA'}[tur];
  if(!key) throw 'tur: akt/prixod/viborka';
  PropertiesService.getScriptProperties().setProperty(key, String(id).trim());
  return key+' = '+id;
}

function _hujOpen(tur){
  var id=_hujId(tur); if(!id) throw 'Hujjat ID yo\'q: '+tur;
  return SpreadsheetApp.openById(id);
}
function _hujUrl(tur){
  var id=_hujId(tur);
  return 'https://docs.google.com/spreadsheets/d/'+id+'/edit';
}

/* ============ HUJJATLAR RO'YXATI (panel uchun meta) ============ */
function apiHujjatlarRoyxat(){
  return [
    {tur:'akt',     nom:'Актлар (яширин ишлар)', url:_hujUrl('akt'),     icon:'📋'},
    {tur:'prixod',  nom:'Приход (келган материал)', url:_hujUrl('prixod'),icon:'📦'},
    {tur:'viborka', nom:'Выборка (материал спецификация)', url:_hujUrl('viborka'),icon:'📐'}
  ];
}

/* ============ AKT — KO'RISH ============
 * Birinchi varaqdagi aktlar reestri. Sarlavha + qatorlar. */
// Akt hujjatidagi MA'LUMOT varag'i — REYESTR (TEMPLATE varaqlar emas!)
function _aktSheet(ss){ return ss.getSheetByName('REYESTR') || ss.getSheets()[0]; }

function apiAktlarOl(limit, qidiruv){
  var ss=_hujOpen('akt');
  var sh=_aktSheet(ss);
  var last=sh.getLastRow(), lastC=sh.getLastColumn();
  if(last<2) return {rows:[], jami:0, statlar:{}};
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
  // Muhim ustunlar indekslari
  var ci=_hdrIdx(hdr,{
    id:'ACT_ID', status:'STATUS', comm:'COMM_STATUS', num:'ACT_NUMBER',
    work:'WORK_NAME', obj:'OBJECT_NAME', start:'START_DATE', end:'END_DATE',
    progress:'PROGRESS', pdf:'PDF_URL', url:'ACT_FILE_URL', ref:'SMETA_REF'
  });
  var v=sh.getRange(2,1,last-1,lastC).getValues();
  var rows=[], statlar={};
  var q=qidiruv?String(qidiruv).toUpperCase().trim():'';
  for(var i=0;i<v.length;i++){
    var num=String(v[i][ci.num]||'').trim();
    var work=String(v[i][ci.work]||'').trim();
    var obj=String(v[i][ci.obj]||'').trim();
    if(!num && !work) continue;
    var status=String(v[i][ci.status]||'').trim();
    var comm=String(v[i][ci.comm]||'').trim();
    statlar[comm||status||'—']=(statlar[comm||status||'—']||0)+1;
    if(q){
      var hay=(num+' '+work+' '+obj).toUpperCase();
      if(hay.indexOf(q)<0) continue;
    }
    rows.push({
      id:String(v[i][ci.id]||'').trim(),
      num:num, work:work, obj:obj,
      status:status, comm:comm,
      start:_hujDate(v[i][ci.start]), end:_hujDate(v[i][ci.end]),
      progress:String(v[i][ci.progress]||'').trim(),
      pdf:String(v[i][ci.pdf]||'').trim(),
      url:String(v[i][ci.url]||'').trim(),
      ref:String(ci.ref>=0?v[i][ci.ref]:'').trim(),
      row:i+2
    });
  }
  // Eng oxirgilari birinchi
  rows.reverse();
  if(limit && rows.length>limit) rows=rows.slice(0,limit);
  return {rows:rows, jami:v.length, statlar:statlar, url:_hujUrl('akt')};
}

/* AKT — YOZISH (yangi qator qo'shadi)
 * data = {num, work, obj, progress, start, end, status} */
function apiAktYoz(data){
  var ss=_hujOpen('akt');
  var sh=_aktSheet(ss);
  var lastC=sh.getLastColumn();
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
  var ci=_hdrIdx(hdr,{
    id:'ACT_ID', status:'STATUS', num:'ACT_NUMBER',
    work:'WORK_NAME', obj:'OBJECT_NAME', start:'START_DATE',
    end:'END_DATE', progress:'PROGRESS', mat:'MATERIAL', ref:'SMETA_REF',
    pdf:'PDF_URL', sync:'MONITOR_STATUS'
  });
  // Ko'p ish bog'lanishi: data.refs massiv → ';' bilan, yoki yagona data.smetaRef
  var refStr = Array.isArray(data.refs) ? data.refs.filter(String).join(';') : String(data.smetaRef||'');
  var row=new Array(lastC).fill('');
  var newId='ACT-'+Utilities.formatDate(new Date(),'GMT+5','yyyyMMdd-HHmmss')+'-'+Math.floor(Math.random()*900+100);
  if(ci.id>=0) row[ci.id]=newId;
  if(ci.num>=0) row[ci.num]=String(data.num||'');
  if(ci.work>=0) row[ci.work]=String(data.work||'');
  if(ci.obj>=0) row[ci.obj]=String(data.obj||'');
  if(ci.progress>=0) row[ci.progress]=String(data.progress||'');
  if(ci.mat>=0) row[ci.mat]=String(data.material||'');     // smetadan kelgan materiallar
  if(ci.ref>=0) row[ci.ref]=refStr;                        // bir nechta ish: obyekt||varaq||qator;...
  if(ci.pdf>=0 && data.pdf) row[ci.pdf]=String(data.pdf);  // skan (qog'oz akt uchun)
  if(ci.start>=0) row[ci.start]=String(data.start||'');
  if(ci.end>=0) row[ci.end]=String(data.end||'');
  if(ci.status>=0) row[ci.status]=String(data.status||'NEW');  // 'QOGOZ' = arxiv/qog'oz akt
  if(ci.sync>=0) row[ci.sync]='NEW';
  sh.appendRow(row);
  SpreadsheetApp.flush();
  var tur=(String(data.status||'')==='QOGOZ')?'Қоғоз акт':'Акт';
  return {ok:true, id:newId, xabar:tur+' қўшилди: '+(data.num||newId)};
}

/* ============ SMETADAN AKT — AVTO-TO'LDIRISH (integratsiya yadrosi) ============
 * Bajarilgan ish turini smetadan o'qib, akt maydonlarini avtomat to'ldiradi:
 * obyekt, ish nomi (расценка), hajm (FAKT), materiallar (rs tarkibidan), bog'lanish kaliti.
 * Komissiya/sana/loyiha hujjati — qo'lda qo'shiladi (akt-spetsifik).
 *
 * WORK-KEY TIZIMI (barqaror bog'lanish):
 *   Eski: obyekt||varaq||qator  — re-processda qator surilsa buziladi
 *   YANGI: obyekt||KOD           (kod bor bo'lsa) yoki
 *          obyekt||NOM_KEY       (kod yo'q bo'lsa, _normNomKey(nom))
 *   Bunda re-process/yangi versiya bog'lanishni BUZMAYDI. */

// Material kategoriyalari (ЧЕЛ/МАШ — mehnat/mexanizm, materialga kirmaydi)
function _aktMatKat(kat){
  var k=String(kat||'').toUpperCase();
  return (k==='МАТ'||k==='ОБ'||k==='М/К'||k==='КАБ'||k==='БЕЗ');
}

/* ============ BARQAROR WORK-KEY ============ */
// Akt↔ish bog'lanish kaliti. KOD (расценка kodi) bor bo'lsa ishlatiladi (eng barqaror).
// KOD yo'q bo'lsa → _normNomKey(nom) (faqat son+kirill, imlo farqisiz).
function _workKey(obyekt, node){
  var kod=String(node.kod||'').trim().toUpperCase();
  if(kod) return String(obyekt)+'||'+kod;
  // KOD yo'q → normallashtirilgan nom kaliti
  var nomKey=_normNomKey(node.nom||'');
  return String(obyekt)+'||'+nomKey;
}

// Yashirin ish (akt talab qiladigan) kalit-so'z ro'yxati
var _YASHIRIN_KW=[
  'ЗЕМЛЯ','ФУНДАМЕНТ','АРМАТУР','ГИДРОИЗОЛ','ЗАСЫПК','СВАЙ','БЕТОН',
  'КЛАДК','ЗАКЛАДН','ПОДГОТОВ','УСТРОЙСТВО ОСНОВ','УТЕПЛЕН','МОНОЛИТ',
  'ИЗОЛЯЦ','АНТИКОРРОЗИОНН','ГРУНТОВ','ПРОКЛАДК','ТРУБОПРОВОД',
  'КАБЕЛ','ЭЛЕКТРОПРОВОД','КАНАЛИЗАЦ','ВОДОПРОВОД','ТЕПЛОИЗОЛ',
  'ШТУКАТУР','СКРЫТ'
];
function _yashirinMi(nom){
  var up=_normNomKey(nom);
  for(var i=0;i<_YASHIRIN_KW.length;i++)
    if(up.indexOf(_normNomKey(_YASHIRIN_KW[i]))>=0) return true;
  return false;
}

// Obyektdagi bajarilgan (FAKT>0) ish turlari ro'yxati — akt nomzodlari + akt bor-yo'qligi
function apiAktIshlar(obyekt){
  if(!obyekt) return {rows:[]};
  var h=apiHolatOl(obyekt), ishlar=[];
  (function walk(nodes, razdel){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'){ walk(n.children, n.nom); return; }
      if(n.type==='bl'||(n.type === 'mat' || n.type === 'ob') ){
        if(_toNum(n.fakt)>0){
          var wk=_workKey(obyekt, n);
          ishlar.push({
            varaq:n.varaq, qator:n.row, nom:n.nom, birlik:n.birlik||'',
            kod:n.kod||'',
            fakt:_toNum(n.fakt), smetaHajm:_toNum(n.smetaHajm), razdel:razdel||'',
            workKey:wk,
            // eski format ham saqlanadi — migratsiya davomida mos tushadigan akt topilishi uchun
            ref:obyekt+'||'+n.varaq+'||'+n.row,
            yashirin:_yashirinMi(n.nom)
          });
        }
        if(n.children) walk(n.children, razdel);
      }
    });
  })(h.tree, '');
  // Qaysi ishga allaqachon akt bor (REYESTR SMETA_REF bo'yicha)
  var bor=_aktRefSet();
  ishlar.forEach(function(x){
    // Yangi yoki eski formatdagi ref dan biri topilsa — akt bor
    x.aktBor=!!(bor[x.workKey]||bor[x.ref]);
  });
  return {obyekt:obyekt, rows:ishlar};
}

// REYESTR'dagi mavjud SMETA_REF lar to'plami {ref:1}
// Ikkala format ham qo'llanadi (yangi work-key va eski varaq||qator)
function _aktRefSet(){
  var set={};
  try{
    var ss=_hujOpen('akt'), sh=_aktSheet(ss), lastC=sh.getLastColumn();
    if(sh.getLastRow()<2) return set;
    var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
    var ri=hdr.indexOf('SMETA_REF'); if(ri<0) return set;
    var col=sh.getRange(2,ri+1,sh.getLastRow()-1,1).getValues();
    for(var i=0;i<col.length;i++){
      // Bitta akt bir nechta ishni o'z ichiga olishi mumkin → ';' bilan ajratilgan
      String(col[i][0]||'').split(';').forEach(function(p){ p=p.trim(); if(p) set[p]=1; });
    }
  }catch(e){}
  return set;
}

// Bir nechta ish turidan BITTA akt — nomlar, materiallar va hajmlarni jamlaydi.
// items = [{varaq, qator}, ...]
function apiAktSmetadanKop(obyekt, items){
  if(!obyekt || !items || !items.length) throw 'Иш турлари танланмаган';
  var workNomlar=[], progress=[], matSet={}, refs=[];
  for(var k=0;k<items.length;k++){
    var d=apiAktSmetadan(obyekt, items[k].varaq, items[k].qator);  // bitta ish
    if(d.work) workNomlar.push(d.work);
    if(d.progress) progress.push(d.work+': '+d.progress);
    if(d.material) String(d.material).split('; ').forEach(function(m){ m=m.trim(); if(m) matSet[m]=1; });
    if(d.smetaRef) refs.push(d.smetaRef);
  }
  return {
    obj: obyekt,
    work: workNomlar.join('; '),
    progress: progress.join('\n'),         // har ish: nom + hajm
    material: Object.keys(matSet).join('; '),
    refs: refs,                            // bog'lanish massivi (apiAktYoz refs ga)
    start:'', end:''
  };
}

// Bitta ish turidan akt maydonlarini to'ldirib qaytaradi (panel ko'rsatadi → tahrirlaydi → apiAktYoz)
function apiAktSmetadan(obyekt, varaq, qator){
  if(!obyekt||!varaq) throw 'Параметрлар тўлиқ эмас';
  qator=parseInt(qator,10);
  var h=apiHolatOl(obyekt), bl=null;
  (function walk(nodes){
    (nodes||[]).forEach(function(n){
      if(n.varaq===varaq && n.row===qator && (n.type==='bl'||(n.type === 'mat' || n.type === 'ob') )) bl=n;
      if(n.children) walk(n.children);
    });
  })(h.tree);
  if(!bl) throw 'Иш тури топилмади';
  // Materiallar — bl ostidagi rs (faqat material kategoriya), "Ном — hajm Бирлик"
  var matlar=[];
  (bl.children||[]).forEach(function(rs){
    if(rs.type!=='rs') return;
    if(!_aktMatKat(rs.kat)) return;                 // ЧЕЛ/МАШ ni qoldiramiz
    var hj=_toNum(rs.smetaHajm);
    matlar.push(rs.nom + (hj?(' — '+_aktSon(hj)+' '+(rs.birlik||'')):''));
  });
  var hajm=_toNum(bl.fakt)||_toNum(bl.smetaHajm);
  // YANGI: work-key (barqaror) ishlatiladi
  var wk=_workKey(obyekt, bl);
  return {
    obj: obyekt,
    work: bl.nom,
    progress: _aktSon(hajm)+' '+(bl.birlik||''),       // bajarilgan hajm
    material: matlar.join('; '),                       // smetadan materiallar
    smetaRef: wk,                                      // yangi barqaror work-key
    start: '', end: ''                                 // sanalar — qo'lda
  };
}
function _aktSon(n){ n=Math.round(_toNum(n)*1000)/1000; return String(n).replace('.',','); }

/* ============ COVERAGE (qoplash nazorati) ============
 * Har bajarilgan ish uchun akt bor-yo'qligini tekshiradi.
 * Yashirin ish (akt talab qiladigan) belgilari avtomatik aniqlanadi. */
function apiAktCoverage(obyekt){
  if(!obyekt) throw 'Объект танланмаган';
  var h=apiHolatOl(obyekt), rows=[], bor=_aktRefSet();
  var stats={jami:0, qoplangan:0, yashirinJami:0, yashirinAktsiz:0};
  (function walk(nodes, razdel){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'){ walk(n.children, n.nom); return; }
      if(n.type==='bl'||(n.type === 'mat' || n.type === 'ob') ){
        if(_toNum(n.fakt)>0){
          var wk=_workKey(obyekt, n);
          var oldRef=obyekt+'||'+n.varaq+'||'+n.row;
          var aktBor=!!(bor[wk]||bor[oldRef]);
          var yash=_yashirinMi(n.nom);
          stats.jami++;
          if(aktBor) stats.qoplangan++;
          if(yash){ stats.yashirinJami++; if(!aktBor) stats.yashirinAktsiz++; }
          rows.push({
            nom:n.nom, kod:n.kod||'', birlik:n.birlik||'',
            fakt:_toNum(n.fakt), razdel:razdel||'',
            workKey:wk, aktBor:aktBor, yashirin:yash
          });
        }
        if(n.children) walk(n.children, razdel);
      }
    });
  })(h.tree, '');
  stats.foiz=stats.jami>0?Math.round(stats.qoplangan/stats.jami*100):0;
  return {obyekt:obyekt, rows:rows, stats:stats};
}

/* ============ ESKI AKTNI SMETAGA ULASH ============
 * aktRow = REYESTR dagi akt qator raqami (2-dan boshlab)
 * refs = [workKey, ...] — bog'lanadigan ish kalitlari
 * SMETA_REF ustunini yangilaydi (mavjudlarni saqlagan holda) */
function apiAktUlash(aktRow, refs){
  if(!aktRow || !refs || !refs.length) throw 'Параметрлар тўлиқ эмас';
  aktRow=parseInt(aktRow,10); if(aktRow<2) throw 'Нотўғри қатор';
  var ss=_hujOpen('akt'), sh=_aktSheet(ss), lastC=sh.getLastColumn();
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
  var ri=hdr.indexOf('SMETA_REF'); if(ri<0) throw 'SMETA_REF устуни топилмади';
  // Mavjud ref larni o'qib, yangilarini qo'shamiz
  var existing=String(sh.getRange(aktRow,ri+1).getValue()||'').trim();
  var all={};
  if(existing) existing.split(';').forEach(function(p){ p=p.trim(); if(p) all[p]=1; });
  refs.forEach(function(r){ r=String(r).trim(); if(r) all[r]=1; });
  var merged=Object.keys(all).join(';');
  sh.getRange(aktRow,ri+1).setValue(merged);
  SpreadsheetApp.flush();
  return {ok:true, row:aktRow, refs:Object.keys(all).length,
    xabar:'Боғланиш сақланди: '+Object.keys(all).length+' иш'};
}

/* ============ BOG'LANMAGAN AKTLARNI OLISH ============
 * SMETA_REF bo'sh yoki mavjud bo'lmagan aktlarni qaytaradi */
function apiAktBoglanmagan(){
  var ss=_hujOpen('akt'), sh=_aktSheet(ss), lastC=sh.getLastColumn();
  if(sh.getLastRow()<2) return {rows:[], jami:0};
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
  var ci=_hdrIdx(hdr,{
    id:'ACT_ID', num:'ACT_NUMBER', work:'WORK_NAME', obj:'OBJECT_NAME',
    status:'STATUS', comm:'COMM_STATUS', ref:'SMETA_REF'
  });
  var v=sh.getRange(2,1,sh.getLastRow()-1,lastC).getValues();
  var rows=[];
  for(var i=0;i<v.length;i++){
    var ref=ci.ref>=0?String(v[i][ci.ref]||'').trim():'';
    if(ref) continue; // bog'langan — o'tkazamiz
    var num=String(v[i][ci.num]||'').trim();
    var work=String(v[i][ci.work]||'').trim();
    if(!num && !work) continue;
    rows.push({
      row:i+2, num:num, work:work,
      obj:String(v[i][ci.obj]||'').trim(),
      status:String(v[i][ci.status]||'').trim(),
      comm:String(v[i][ci.comm]||'').trim()
    });
  }
  return {rows:rows, jami:rows.length};
}

/* ============ AKT NOMZODLARI (eski aktni ulash uchun taklif) ============
 * aktRow'dagi WORK_NAME va OBJECT_NAME bo'yicha smetadagi eng yaqin ishlarni topadi.
 * Faqat KO'RSATADI, MAJBURLAMAYDI — inson tasdiqlaydi. */
function apiAktNomzodlar(aktRow){
  aktRow=parseInt(aktRow,10); if(aktRow<2) throw 'Нотўғри қатор';
  var ss=_hujOpen('akt'), sh=_aktSheet(ss), lastC=sh.getLastColumn();
  var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
  var ci=_hdrIdx(hdr,{work:'WORK_NAME', obj:'OBJECT_NAME'});
  var row=sh.getRange(aktRow,1,1,lastC).getValues()[0];
  var aktWork=String(row[ci.work]||'').trim();
  var aktObj=String(row[ci.obj]||'').trim();
  if(!aktObj) return {rows:[], aktWork:aktWork, aktObj:aktObj};
  // Smetadan shu obyektdagi bajarilgan ishlarni olamiz
  var h;
  try{ h=apiHolatOl(aktObj); }catch(e){ return {rows:[], aktWork:aktWork, aktObj:aktObj, xato:String(e)}; }
  var ishlar=[];
  var aktNK=_normNomKey(aktWork);
  (function walk(nodes, razdel){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'){ walk(n.children, n.nom); return; }
      if(n.type==='bl'||(n.type === 'mat' || n.type === 'ob') ){
        if(_toNum(n.fakt)>0){
          var wk=_workKey(aktObj, n);
          var ishNK=_normNomKey(n.nom);
          // O'xshashlik skori — kalit so'zlar kesishishi
          var skor=_aktSkorHisob(aktNK, ishNK);
          ishlar.push({
            nom:n.nom, kod:n.kod||'', birlik:n.birlik||'',
            fakt:_toNum(n.fakt), razdel:razdel||'', workKey:wk,
            skor:skor
          });
        }
        if(n.children) walk(n.children, razdel);
      }
    });
  })(h.tree, '');
  // Skor bo'yicha tartiblash (eng yaxshi birinchi), faqat top 10
  ishlar.sort(function(a,b){ return b.skor-a.skor; });
  return {
    rows:ishlar.slice(0,10),
    aktWork:aktWork, aktObj:aktObj, aktRow:aktRow
  };
}

// Ikki normallashtirilgan nom orasidagi o'xshashlik skori (0-100).
// Kalit-so'z kesishish asosida — 3+ harfli so'zlar to'plami Jaccard.
function _aktSkorHisob(nk1, nk2){
  if(!nk1||!nk2) return 0;
  if(nk1===nk2) return 100;
  // 3+ harfli bo'laklarga bo'lish (raqamlar ham so'z)
  function words(s){
    var out={}, m=s.match(/[А-ЯЁ0-9]{3,}/g)||[];
    for(var i=0;i<m.length;i++) out[m[i]]=1;
    return out;
  }
  var w1=words(nk1), w2=words(nk2);
  var k1=Object.keys(w1), k2=Object.keys(w2);
  if(!k1.length||!k2.length) return 0;
  var kesish=0;
  for(var i=0;i<k1.length;i++) if(w2[k1[i]]) kesish++;
  var birlash={};
  k1.forEach(function(k){birlash[k]=1;}); k2.forEach(function(k){birlash[k]=1;});
  var jac=kesish/Object.keys(birlash).length;
  return Math.round(jac*100);
}

/* ============ OMMAVIY ULASH (MASS BIND) ============ */
// 1. Daraxt va unlinked aktlarni olib beradi
function apiAktMassUlashTree(obyekt){
  if(!obyekt) return {aktlar:[], tree:[]};
  
  var targetOb = String(obyekt).trim().toUpperCase();

  // 1. Unlinked aktlarni olish
  var ss=_hujOpen('akt'), sh=_aktSheet(ss);
  var lastC=sh.getLastColumn(), last=sh.getLastRow();
  var aktlar=[];
  if(last>=2){
    var hdr=sh.getRange(1,1,1,lastC).getValues()[0].map(function(x){return String(x||'').trim();});
    var ci=_hdrIdx(hdr,{
      id:'ACT_ID', num:'ACT_NUMBER', work:'WORK_NAME', obj:'OBJECT_NAME', ref:'SMETA_REF'
    });
    var v=sh.getRange(2,1,last-1,lastC).getValues();
    for(var i=0;i<v.length;i++){
      var o=String(v[i][ci.obj]||'').trim();
      var ref=String(ci.ref>=0?v[i][ci.ref]:'').trim();
      if(!ref){
        aktlar.push({
          row: i+2,
          id: String(v[i][ci.id]||''),
          num: String(v[i][ci.num]||''),
          work: String(v[i][ci.work]||'')
        });
      }
    }
  }

  // 2. Smeta daraxtini olish (rz -> bl -> ishlar)
  var h=apiHolatOl(obyekt), tree=[];
  (function walk(nodes, parentList){
    (nodes||[]).forEach(function(n){
      if(n.type==='rz'){
        var node = {type:n.type, nom:n.nom, children:[]};
        walk(n.children, node.children);
        if(node.children.length > 0) parentList.push(node); // faqat ishi borlari
      } else if(n.type==='bl'){ // ish turi
        parentList.push({
          type:'ish', nom:n.nom, birlik:n.birlik||'',
          fakt:_toNum(n.fakt), smetaHajm:_toNum(n.smetaHajm),
          workKey:_workKey(obyekt, n), yashirin:_yashirinMi(n.nom)
        });
      }
    });
  })(h.tree, tree);

  return {aktlar:aktlar, tree:tree};
}

// 2. Belgilangan aktlarga belgilangan ishlarni ulash (M:N)
function apiAktMassUlash(obyekt, aktRows, workKeys){
  if(!aktRows || !aktRows.length || !workKeys || !workKeys.length) throw 'Акт ёки иш танланмади';
  var ss=_hujOpen('akt'), sh=_aktSheet(ss);
  var lastRow = sh.getLastRow();
  if(lastRow < 2) throw 'Актлар базаси бўш';

  var hdr=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(function(x){return String(x||'').trim();});
  var ri=hdr.indexOf('SMETA_REF'); if(ri<0) throw 'SMETA_REF ustuni yo\'q';
  
  var qoshilgan = workKeys.join(';');
  
  // Ma'lumotlarni ommaviy olish
  var refsRange = sh.getRange(2, ri+1, lastRow-1, 1);
  var refsData = refsRange.getValues(); // 2D array [[v], [v]]
  
  for(var i=0;i<aktRows.length;i++){
    var r = parseInt(aktRows[i], 10);
    var dataIdx = r - 2; // qator indeks (2-qatordan boshlangani uchun)
    if(dataIdx >= 0 && dataIdx < refsData.length){
      var old = String(refsData[dataIdx][0]||'').trim();
      var nval = old ? (old+';'+qoshilgan) : qoshilgan;
      // Dublikatlarni tozalash (ehtiyot shart)
      var nArr = nval.split(';').filter(function(v,idx,a){ return v && a.indexOf(v)===idx; });
      refsData[dataIdx][0] = nArr.join(';');
    }
  }
  
  // Ommaviy saqlash
  refsRange.setValues(refsData);
  SpreadsheetApp.flush();
  try{ _sbDirty(obyekt); }catch(e){} // soatlik sinx uchun dirty
  return {ok:true, xabar: aktRows.length+' та акт '+workKeys.length+' та ишга боғланди'};
}

/* ============ PRIXOD — KO'RISH ============ */
function apiPrixodOl(limit, qidiruv){
  var ss=_hujOpen('prixod');
  var sh=ss.getSheetByName('Приход') || ss.getSheets()[0];
  var last=sh.getLastRow(), lastC=Math.max(sh.getLastColumn(), 8);
  if(last<2) return {rows:[], jami:0};
  var v=sh.getRange(2,1,last-1,lastC).getValues();
  var rows=[], q=qidiruv?String(qidiruv).toUpperCase().trim():'';
  // Yangi Ustunlar: 0=№ 1=тип 2=дата 3=наименование 4=ед.изм 5=объем 6=счет 7=поставщик
  for(var i=0;i<v.length;i++){
    var nom=String(v[i][3]||'').trim();
    if(!nom) continue;
    if(q && nom.toUpperCase().indexOf(q)<0 && String(v[i][1]||'').toUpperCase().indexOf(q)<0) continue;
    rows.push({
      nom:nom, razdel:String(v[i][1]||'').trim(), birlik:String(v[i][4]||'').trim(),
      hajm:_toNum(v[i][5]), sana:_hujDate(v[i][2]),
      postavshik:String(v[i][7]||'').trim(), narx: 0, // Narx yo'q
      ostatka: 0, row:i+2 // Qoldiq endi alohida "Остаток" varag'ida
    });
  }
  rows.reverse();
  var jami=rows.length;
  if(limit && rows.length>limit) rows=rows.slice(0,limit);
  return {rows:rows, jami:jami, url:_hujUrl('prixod')};
}

/* PRIXOD — YOZISH
 * data = {nom, razdel, birlik, hajm, sana, postavshik, narx, obyekt} */
function apiPrixodYoz(data){
  var ss=_hujOpen('prixod');
  var sh=ss.getSheetByName('Приход') || ss.getSheets()[0];
  var lastC=Math.max(sh.getLastColumn(), 8);
  var row=new Array(lastC).fill('');
  row[0] = sh.getLastRow(); // tartib raqam
  row[1] = String(data.razdel||'Прочее'); // tip material
  row[2] = data.sana||Utilities.formatDate(new Date(),'GMT+5','dd.MM.yyyy'); // data
  row[3] = String(data.nom||''); // nom
  row[4] = String(data.birlik||'шт'); // birlik
  row[5] = _toNum(data.hajm); // obyom
  row[6] = ''; // schot faktura
  row[7] = String(data.postavshik||''); // postavshik
  sh.appendRow(row);
  SpreadsheetApp.flush();
  try{ _sbDirty(data.obyekt); }catch(e){}
  return {ok:true, xabar:'Приход қўшилди: '+(data.nom||'')};
}

/* RASHOD (CHIQIM) — YOZISH
 * data = {nom, birlik, hajm, sana, obyekt, ish, izoh} */
function apiRashodYoz(data){
  var ss=_hujOpen('prixod');
  var sh=ss.getSheetByName('Расход');
  if(!sh) {
    sh=ss.insertSheet('Расход');
    sh.appendRow(['№','Тип материала','Дата','Наименование','Ед.изм','Кол-во','Прораб/brigada','Субподрядные организации','Блок']);
  }
  var lastC=Math.max(sh.getLastColumn(), 9);
  var row=new Array(lastC).fill('');
  row[0] = sh.getLastRow();
  row[1] = 'Материал'; // tip
  row[2] = data.sana||Utilities.formatDate(new Date(),'GMT+5','dd.MM.yyyy');
  row[3] = String(data.nom||''); // nom
  row[4] = String(data.birlik||'шт'); // birlik
  row[5] = _toNum(data.hajm); // obyom
  row[6] = String(data.ish||''); // prorab
  row[7] = String(data.izoh||''); // subpodryad / izoh
  row[8] = String(data.obyekt||''); // blok (obyekt)
  sh.appendRow(row);
  SpreadsheetApp.flush();
  try{ _sbDirty(data.obyekt); }catch(e){}
  return {ok:true, xabar:'Расход (чиқим) қилинди: '+(data.nom||'')};
}

/* RASHOD (CHIQIM) OMMAVIY (Bitta materialni ko'p ishlarga bo'lish)
 * data = {nom, birlik, sana, obyekt, izoh, taqsimot: [{ish, hajm}], kirimRow: <optional>} */
function apiRashodYozMass(data){
  var ss=_hujOpen('prixod');
  /* ⚡⚡⚡ 2026-08-16 NOTO'G'RI VARAQ VA USTUNLAR (audit C12 — TASDIQLANDI).
   *
   * Bu funksiya `ss.getSheets()[0]` — ya'ni faylning BIRINCHI varag'ini
   * olardi, nomiga qaramasdan. `apiPrixodOl` (o'qish) esa
   * `getSheetByName('Приход')` ishlatadi. Fayl ichida boshqa varaq
   * birinchi bo'lsa — chiqim BUTUNLAY BOSHQA varaqqa yozilardi.
   *
   * Ustunlar ham nomuvofiq edi:
   *     o'qish (ishlaydi):  index 3 = НОМ,   index 5 = ҲАЖМ
   *     yozish (bu yer):    index 1 = nom,   index 4 = hajm   ← XATO
   * Ya'ni material nomi RAZDEL ustuni bilan solishtirilardi va miqdor
   * BIRLIK ustunidan o'qilardi. Natijada kirim qatori deyarli hech
   * qachon topilmasdi; topilganda esa qoldiq hisobi ma'nosiz chiqardi.
   *
   * ENDI: o'qish funksiyasi bilan AYNAN bir xil varaq va ustunlar. */
  var sh=ss.getSheetByName('Приход') || ss.getSheets()[0];
  var IDX_NOM = 3, IDX_HAJM = 5;   // apiPrixodOl bilan bir xil

  var taqsimot = data.taqsimot || [];
  if (!taqsimot.length) return {ok:false, xabar:'Тақсимот йўқ'};

  var lastR = sh.getLastRow();
  var lastC = Math.max(sh.getLastColumn(), 20);
  var vP = sh.getRange(1, 1, lastR, lastC).getValues();
  
  var kirimRows = [];
  var targetNom = String(data.nom||'').trim().toUpperCase();
  
  if (data.kirimRow) {
    var r = parseInt(data.kirimRow);
    kirimRows.push({ row: r, qoldiq: 999999999 }); // Specific row bypasses strict FIFO limits for UI simplicity, but we can calculate actual qoldiq
  } else {
    for (var i = 1; i < lastR; i++) {
      var nom = String(vP[i][IDX_NOM]||'').trim().toUpperCase();
      if (nom === targetNom) {
        var hajm = _toNum(vP[i][IDX_HAJM]);
        var sumR = 0;
        for (var c = 14; c < lastC; c += 4) { // vP index 14 is column 15
          sumR += _toNum(vP[i][c]);
        }
        var qol = hajm - sumR;
        if (qol > 0) kirimRows.push({ row: i + 1, qoldiq: qol });
      }
    }
  }

  if (!kirimRows.length) return {ok:false, xabar:'Керакли кирим (қолдиқ) топилмади!'};

  var updates = []; // {row, col, values:[]}
  var jami = 0;
  var taqIndex = 0;
  var curTaq = { ish: taqsimot[0].ish, qolgan: _toNum(taqsimot[0].hajm) };
  
  for (var k = 0; k < kirimRows.length; k++) {
    var kRow = kirimRows[k];
    var qoldiq = kRow.qoldiq;
    
    // Find first empty col index for this row
    var cIdx = 14; 
    while (cIdx < lastC && _toNum(vP[kRow.row - 1][cIdx]) > 0) {
      cIdx += 4;
    }
    
    while (curTaq && curTaq.qolgan > 0 && qoldiq > 0) {
      var ol = Math.min(curTaq.qolgan, qoldiq);
      
      var izohFull = curTaq.ish + (data.izoh ? ' ('+data.izoh+')' : '');
      updates.push({
        row: kRow.row,
        col: cIdx + 1, // 1-indexed
        vals: [[ol, String(data.obyekt||''), String(data.sana||''), izohFull]]
      });
      
      jami += ol;
      qoldiq -= ol;
      curTaq.qolgan -= ol;
      cIdx += 4; // Move to next chunk if we still have capacity in this row but taqsimot changes
      
      if (curTaq.qolgan <= 0) {
        taqIndex++;
        if (taqIndex < taqsimot.length) {
          curTaq = { ish: taqsimot[taqIndex].ish, qolgan: _toNum(taqsimot[taqIndex].hajm) };
        } else {
          curTaq = null;
          break;
        }
      }
    }
    if (!curTaq) break; // All distributed
  }
  
  if (updates.length > 0) {
    updates.forEach(function(u) {
      sh.getRange(u.row, u.col, 1, 4).setValues(u.vals);
    });
    SpreadsheetApp.flush();
    try{ _sbDirty(data.obyekt); }catch(e){}
  }
  
  if (curTaq && curTaq.qolgan > 0 && !data.kirimRow) {
    return {ok:true, xabar:'Расход: '+jami+' '+(data.birlik||'')+' тақсимланди, аммо ' + curTaq.qolgan + ' қолдиқ етмади!'};
  }
  
  return {ok:true, xabar:'Расход: '+jami+' '+(data.birlik||'')+' → '+updates.length+' та кирим қаторига ёзилди'};
}


/* SKLAD OSTATKA (Agregat) */
function apiSkladOl(qidiruv) {
  var ss=_hujOpen('prixod');
  var sh = ss.getSheetByName('Остаток');
  if(!sh) return {rows:[], jami:0, url:_hujUrl('prixod')};
  
  var last = sh.getLastRow();
  var lastC = Math.max(sh.getLastColumn(), 7);
  if(last < 2) return {rows:[], jami:0, url:_hujUrl('prixod')};
  
  var v = sh.getRange(2,1,last-1, lastC).getValues();
  var q = qidiruv ? String(qidiruv).toUpperCase().trim() : '';
  
  var result = [];
  
  // A=№, B=Наименование, C=Ед.изм, D=Остаток на начало, E=Приход, F=Расход, G=Остаток на конец
  for(var i=0; i<v.length; i++){
     var nom = String(v[i][1]||'').trim();
     if(!nom) continue;
     if(q && nom.toUpperCase().indexOf(q) < 0) continue;
     
     var birlik = String(v[i][2]||'').trim();
     var qoldiqBosh = _toNum(v[i][3]);
     var kirim = _toNum(v[i][4]);
     var chiqim = _toNum(v[i][5]);
     var qoldiq = _toNum(v[i][6]);
     
     result.push({
        nom: nom,
        razdel: 'Материал',
        birlik: birlik,
        qoldiqBosh: qoldiqBosh,
        kirim: kirim,
        chiqim: chiqim,
        qoldiq: qoldiq,
        summa: 0, 
        ort_narx: 0,
        history: [] // Tarix endi alohida "Приход" va "Расход" varaqlarida
     });
  }
  
  return {rows:result, jami:result.length, url:_hujUrl('prixod')};
}

/* ============ VIBORKA — KO'RISH (faqat) ============
 * Murakkab struktura. Faqat URL va asosiy ko'rsatkichlar. */
/* VIBORKA — Nazorat varag'ini O'QIB ko'rsatadi (havola emas).
 * Nazorat ustunlari: 1№ 2Материал 3Бирлик 4План 5Қабул 6Нарх 7Сумма
 *                    8Қолдиқ 9% 10Сана 11Етказувчи 12Изоҳ 13Ҳолат 14Замена
 * Nazorat varag'i topilmasa — havola + xabar (xavfsiz fallback). */
function apiViborkaOl(limit, qidiruv){
  var ss=_hujOpen('viborka');
  var sh=ss.getSheetByName('Nazorat');
  if(!sh) return {rows:[], jami:0, url:_hujUrl('viborka'),
    xabar:'Nazorat варағи топилмади — Виборка ҳужжатини очинг (ёки DOC_VIBORKA ID ни текширинг).'};
  var last=sh.getLastRow();
  if(last<2) return {rows:[], jami:0, url:_hujUrl('viborka'), xabar:'Nazorat бўш.'};
  var lastC=Math.max(sh.getLastColumn(),14);
  var v=sh.getRange(2,1,last-1,lastC).getValues();
  var disp=sh.getRange(2,1,last-1,lastC).getDisplayValues();
  var rows=[], q=qidiruv?String(qidiruv).toUpperCase().trim():'';
  var jamiPlan=0, jamiQabul=0, jamiSumma=0;
  for(var i=0;i<v.length;i++){
    var nom=String(v[i][1]||'').trim(); if(!nom) continue;
    if(q && nom.toUpperCase().indexOf(q)<0 && String(v[i][12]||'').toUpperCase().indexOf(q)<0) continue;
    var plan=_toNum(v[i][3]), qabul=_toNum(v[i][4]);
    rows.push({
      nom:nom, birlik:String(v[i][2]||'').trim(),
      plan:plan, qabul:qabul, narx:_toNum(v[i][5]), summa:_toNum(v[i][6]),
      qoldiq:_toNum(v[i][7]), foiz:String(disp[i][8]||'').trim(),
      sana:String(disp[i][9]||'').trim(), postavshik:String(v[i][10]||'').trim(),
      izoh:String(v[i][11]||'').trim(),
      holat:String(v[i][12]||'').trim(), zamena:String(v[i][13]||'').trim(), row:i+2
    });
    jamiPlan+=plan; jamiQabul+=qabul; jamiSumma+=_toNum(v[i][6]);
  }
  
  var jamiSoni=rows.length;
  if(limit && rows.length>limit) rows=rows.slice(0,limit);
  
  // Shablon va Z_Obyekt larni o'qish
  var shablonData = [];
  var shablonSh = ss.getSheetByName('Viborka_Shablon') || ss.getSheetByName('viborka shablon') || ss.getSheetByName('Виборка шаблон');
  if (shablonSh) {
    var lR = shablonSh.getLastRow();
    var lC = shablonSh.getLastColumn();
    if (lR > 1 && lC > 0) {
      shablonData = shablonSh.getRange(1, 1, lR, lC).getDisplayValues();
    }
  }

  var zayavkalar = {};
  ss.getSheets().forEach(function(s){
    var n = s.getName();
    if (n.indexOf('Z_') === 0 || n.indexOf('З_') === 0) {
      var zlR = s.getLastRow();
      var zlC = s.getLastColumn();
      if (zlR > 1 && zlC > 0) {
        zayavkalar[n] = s.getRange(1, 1, zlR, zlC).getDisplayValues();
      }
    }
  });

  return {
    rows:rows, jami:jamiSoni, url:_hujUrl('viborka'),
    jamiPlan:jamiPlan, jamiQabul:jamiQabul, jamiSumma:jamiSumma,
    shablon: shablonData, zayavkalar: zayavkalar
  };
}

/* ============ YORDAMCHILAR ============ */
function _hdrIdx(hdr, map){
  var out={};
  for(var k in map){
    out[k]=-1;
    var want=map[k].toUpperCase();
    for(var i=0;i<hdr.length;i++){
      if(String(hdr[i]).toUpperCase()===want){ out[k]=i; break; }
    }
  }
  return out;
}
function _hujDate(v){
  if(v instanceof Date){ return Utilities.formatDate(v,'GMT+5','dd.MM.yyyy'); }
  return String(v==null?'':v).trim();
}
