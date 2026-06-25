/********************************************************************
 * 05_Papka.gs — PAPKA SKANER
 * ------------------------------------------------------------------
 * FORMAT BUG TUZATISH:
 *   _boglashOl()  → endi FORMAT ustunini ham o'qiydi (6-ustun)
 *   papkaSkan()   → ob.format = override dagi format (TN yoki ABC4)
 *   _skanObyekt() → format maydonni qaytaradi
 *
 *   apiBoglashSaqla() — 30_Panel.gs da, FORMAT ham saqlanadi
 *   Karting ABC4 tanlansa → papkaSkan natijasida ob.format='ABC4'
 *   → _ishlaObyekt svodCfg=CFG.SVOD_ABC ishlatadi — 0 bo'lmaydi
 ********************************************************************/

function papkaSkan(){
  var a = sozAsosiy();
  var root;
  try { root = DriveApp.getFolderById(a.rootId); }
  catch(e){ throw 'ROOT_FOLDER_ID xato: '+a.rootId; }

  var override = _boglashOl();
  var obyektlar=[], subs=root.getFolders();
  while(subs.hasNext()){
    var f=subs.next();
    var obs=_skanObyekt(f, override);
    if(obs && obs.length){
      obyektlar = obyektlar.concat(obs);
    }
  }
  obyektlar.sort(function(x,y){ return x.obyekt<y.obyekt?-1:1; });
  return obyektlar;
}

/* FAQAT BITTA obyekt papkasini skan qiladi — butun ROOT ni emas.
 * Navbat (har qadam 1 obyekt) va bitta-obyekt [Ишла] uchun: 9 papka o'rniga 1
 * papka Drive skani → ancha tez. Keshdan folderId oladi, topilmasa to'liq skan. */
function skanBitta(obyekt){
  try{
    var folderId='';
    var sk=(typeof _keshOlStale==='function') ? (_keshOlStale('skan')||[]) : [];
    for(var i=0;i<sk.length;i++){ if(sk[i].obyekt===obyekt){ folderId=sk[i].folderId||''; break; } }
    if(folderId){
      var folder=DriveApp.getFolderById(folderId);
      var obs=_skanObyekt(folder, _boglashOl());
      if(obs && obs.length) {
        for(var k=0; k<obs.length; k++) {
          if(obs[k].obyekt===obyekt) return obs[k];
        }
      }
    }
  }catch(e){ /* keshda yo'q yoki folder ochilmadi — to'liq skanga tushamiz */ }
  // Zaxira: to'liq skan (kesh bo'sh yoki papka ID eskirган)
  var obs=papkaSkan();
  for(var j=0;j<obs.length;j++) if(obs[j].obyekt===obyekt) return obs[j];
  return null;
}

function _skanObyekt(folder, override){
  var nom = folder.getName().trim();
  override = override || {};

  var cand=[], it=folder.getFiles();
  var allowedMimes = [
    MimeType.GOOGLE_SHEETS, 
    MimeType.MICROSOFT_EXCEL, 
    MimeType.MICROSOFT_EXCEL_LEGACY,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  while(it.hasNext()){
    var fi=it.next(), fn=fi.getName();
    if(fn.toUpperCase().indexOf(CFG.PLUS_SUF.toUpperCase())>=0) continue;
    if(fn.indexOf('_TMP_')===0 || fn.indexOf('_NAT_')===0 || fn.indexOf('(GS)')>=0) continue;
    var mt = fi.getMimeType();
    if(allowedMimes.indexOf(mt) === -1) continue;
    cand.push({id:fi.getId(), name:fn, file:fi});
  }
  if(!cand.length) return [];

  var lokFiles=[], svod=null;
  var ovFolder = override[nom];

  // 1) qo'lda bog'lash (puzzle) - folder nomi bo'yicha
  if(ovFolder){
    for(var c=0;c<cand.length;c++){
      if(ovFolder.lokId  && cand[c].id===ovFolder.lokId)  lokFiles.push(cand[c].file);
      if(ovFolder.svodId && cand[c].id===ovFolder.svodId) svod=cand[c].file;
    }
  }

  // 2) Svodni topish (kalit so'z bo'yicha)
  for(var c=0;c<cand.length;c++){
    var up=cand[c].name.toUpperCase(), fi2=cand[c].file;
    if(!svod && _kw(up, CFG.SVOD_KW) && (!ovFolder || cand[c].id!==ovFolder.lokId)){ svod=fi2; continue; }
  }

  // 3) Qolgan barcha fayllarni Lokalka deb hisoblash
  for(var c=0;c<cand.length;c++){
    var id=cand[c].id;
    if(svod && svod.getId()===id) continue;
    
    // Check if it's already in lokFiles (from manual override)
    var isLok=false; 
    for(var i=0;i<lokFiles.length;i++){ if(lokFiles[i].getId()===id) { isLok=true; break; } }
    if(isLok) continue;
    
    lokFiles.push(cand[c].file);
  }
  
  // 4) Agar SVOD topilmagan bo'lsa, lekin bir nechta fayl bo'lsa
  // Eski mantiq bo'yicha bittasini svod deb olamiz (qanday nomlanganidan qat'iy nazar)
  if(!svod && lokFiles.length > 1) {
     var potentialSvod = null;
     var pIdx = -1;
     // Agar nomida LOKAL so'zi yo'q bo'lgan bitta fayl bo'lsa, o'shani svod qilamiz
     for(var i=0; i<lokFiles.length; i++) {
        if(!_kw(lokFiles[i].getName().toUpperCase(), CFG.LOK_KW)) {
           potentialSvod = lokFiles[i];
           pIdx = i;
           break;
        }
     }
     if(potentialSvod) {
        svod = potentialSvod;
        lokFiles.splice(pIdx, 1);
     } else {
        svod = lokFiles[0];
        lokFiles.splice(0, 1);
     }
  }

  if (lokFiles.length === 0) return [];

  // Helper function to remove file extension
  function _stripExt(filename) {
    return filename.replace(/\.[^/.]+$/, "");
  }

  var results = [];

  if (lokFiles.length <= 1) {
    // 1 ta lokalka bo'lsa - eski mantiq (folder nomi bilan bitta obyekt)
    var ov = override[nom];
    results.push({
      obyekt:     nom,
      folderId:   folder.getId(),
      lokFiles:   lokFiles,
      lokFile:    lokFiles[0] || null,
      svodFile:   svod,
      lokName:    lokFiles[0] ? lokFiles[0].getName() : '(yo\'q)',
      svodName:   svod ? svod.getName() : '(yo\'q)',
      format:     _normFormat((ov && ov.format) ? ov.format : 'TN'),
      lokSheets:  (ov && ov.lokSheets)  ? ov.lokSheets.split(',').map(function(s){return s.trim();}).filter(String) : [],
      svodSheets: _svodSheetsFolder(override, nom),
      svodCols:   _svodColsFolder(override, nom),
      candidates: cand.map(function(x){ return {id:x.id, name:x.name}; })
    });
  } else {
    // Bir nechta lokalka bo'lsa - har birini alohida obyekt qilib chiqamiz
    for (var i = 0; i < lokFiles.length; i++) {
      var lf = lokFiles[i];
      var subNom = nom + " - " + _stripExt(lf.getName());
      
      // Override-da subNom bo'yicha bog'lash bormi yoki folder nomi bo'yichami?
      var ov = override[subNom] || override[nom];
      
      // Agar override aynan shu subNom uchun bo'lsa va unda svodId bo'lsa, o'shani ishlatamiz
      var subSvod = svod;
      if (override[subNom] && override[subNom].svodId) {
        for (var c = 0; c < cand.length; c++) {
          if (cand[c].id === override[subNom].svodId) {
            subSvod = cand[c].file;
            break;
          }
        }
      }

      results.push({
        obyekt:     subNom,
        folderId:   folder.getId(),
        lokFiles:   [lf],
        lokFile:    lf,
        svodFile:   subSvod,
        lokName:    lf.getName(),
        svodName:   subSvod ? subSvod.getName() : '(yo\'q)',
        format:     _normFormat((ov && ov.format) ? ov.format : 'TN'),
        lokSheets:  (ov && ov.lokSheets)  ? ov.lokSheets.split(',').map(function(s){return s.trim();}).filter(String) : [],
        svodSheets: _svodSheetsFolder(override, subNom),
        svodCols:   _svodColsFolder(override, subNom),
        candidates: cand.map(function(x){ return {id:x.id, name:x.name}; })
      });
    }
  }

  return results;
}

function _kw(s, arr){ for(var i=0;i<arr.length;i++) if(s.indexOf(arr[i])>=0) return true; return false; }


/* PUZZLE BOG'LASH override.
 * SOZLAMALAR_BOGLASH ustunlari:
 *   A=ОБЪЕКТ  B=ЛОК_ID  C=ЛОК_НОМ  D=СВОД_ID  E=СВОД_НОМ  F=ФОРМАТ
 *   G=ЛОК_SHEETS  H=СВОД_SHEETS
 *   I=СВОД_НОМ_УСТ  J=СВОД_БИР_УСТ  K=СВОД_НАРХ_УСТ  L=СВОД_БЛОК_УСТ
 *   (ustun raqamlari, 1-based; 0/bo'sh = format default ishlatiladi) */
function _boglashOl(){
  var sh=SpreadsheetApp.getActive().getSheetByName(CFG.SOZ_BOG);
  if(!sh) return {};
  var v=sh.getDataRange().getValues(), m={};
  for(var i=1;i<v.length;i++){
    var nom=String(v[i][0]||'').trim(); if(!nom) continue;
    // I-N (idx 8-13): СВОД_НОМ/БИР/НАРХ/БЛОК/QTY/СУММА ustun raqamlari (1-based)
    var sc={ nom:Number(v[i][8])||0, bir:Number(v[i][9])||0, narx:Number(v[i][10])||0,
             blok:Number(v[i][11])||0, qty:Number(v[i][12])||0, summa:Number(v[i][13])||0 };
    m[nom]={
      lokId:    String(v[i][1]||'').trim(),
      svodId:   String(v[i][3]||'').trim(),
      format:   _normFormat(String(v[i][5]||'TN').trim().toUpperCase()),
      lokSheets: String(v[i][6]||'').trim(),
      svodSheets:String(v[i][7]||'').trim(),
      svodCols: (sc.nom||sc.bir||sc.narx||sc.blok||sc.qty||sc.summa) ? sc : null
    };
  }
  return m;
}

/* Obyekt uchun svodka ustun konfiguratsiyasi — qo'lda belgilangan ustunlar
 * (svodCols) format defaultidan (SVOD_TN/SVOD_ABC) ustun turadi. */
function _svodCfg(ob){
  var fmt=_normFormat(ob.format||'TN');
  var base=(fmt==='ABC4')?CFG.SVOD_ABC:CFG.SVOD_TN;
  var sc=ob.svodCols;
  if(!sc) return base;
  return {
    BLOK:   sc.blok>0  ? sc.blok  : base.BLOK,
    NOM:    sc.nom>0   ? sc.nom   : base.NOM,
    BIRLIK: sc.bir>0   ? sc.bir   : base.BIRLIK,
    NARX:   sc.narx>0  ? sc.narx  : base.NARX,
    QTY:    sc.qty>0   ? sc.qty   : (base.QTY||0),
    SUMMA:  sc.summa>0 ? sc.summa : (base.SUMMA||0),
    KOD:    base.KOD||null
  };
}

/* ============ NARXLASH SOZLAMA KALITI (multi-lokalka uchun BARQAROR + IZCHIL) ============
 * MUHIM MANTIQ: oraliq, svod ustun xaritasi (svodCols), ЧЕЛ-Ч stavka — bularning HAMMASI
 * SVODKAga tegishli (obyektga emas). Bitta papkada BIR svodka + KO'P lokalka bo'lsa,
 * bo'lingan (split) obyektlar — masalan "Suniy ko'l - ozera", "Suniy ko'l - fontan" —
 * BIR XIL sozlamani ulashadi. Shuning uchun kalit = PAPKA nomi (split nomdan " - " gacha).
 * Taqqoslash NORMALLASHTIRILGAN: katta/kichik harf, ortiqcha probel, apostrof variantlari,
 * ё/е farqi e'tiborga olinmaydi → kirill/lotin imlo tafovutlaridan kelib chiqqan
 * "oraliqlar topilmadi" xatosi yo'qoladi. */
function _cfgKalit(obyekt){ return String(obyekt==null?'':obyekt).split(' - ')[0].trim(); }
function _cfgNorm(s){
  return String(s==null?'':s).toUpperCase()
    .replace(/Ё/g,'Е')             // Ё → Е
    // O'zbek lotin okina/apostrof barcha variantlari: ' ` ´ ' ' ʻ ʼ ′
    .replace(/['`´‘’ʻʼ′]/g,'')
    .replace(/\s+/g,' ').trim();
}
/* Saqlangan kalit (dbOb) shu obyektga yoki uning papkasiga mos keladimi? */
function _cfgMos(dbOb, obyekt){
  var d=_cfgNorm(dbOb);
  return d===_cfgNorm(obyekt) || d===_cfgNorm(_cfgKalit(obyekt));
}
/* svodCols (svod ustun xaritasi) — SVODKAga tegishli → papka bo'yicha meros olinadi:
 * 1) aynan shu obyekt nomi, 2) papkadagi istalgan boshqa lokalka (sibling).
 * Shunda keyin yangi lokalka qo'shilsa ham ustun xaritasi avtomat qo'llanadi. */
function _svodColsFolder(override, nomFull){
  if(!override) return null;
  if(override[nomFull] && override[nomFull].svodCols) return override[nomFull].svodCols;
  var fk=_cfgNorm(_cfgKalit(nomFull));
  for(var k in override){
    if(override[k] && override[k].svodCols && _cfgNorm(_cfgKalit(k))===fk) return override[k].svodCols;
  }
  return null;
}
/* svodSheets (qaysi svod varaqlarini o'qish) — SVODKAga tegishli → papka bo'yicha meros.
 * Massiv qaytaradi (vergulli string parse qilinadi). */
function _svodSheetsFolder(override, nomFull){
  function parse(s){ return s ? String(s).split(',').map(function(x){return x.trim();}).filter(String) : []; }
  if(!override) return [];
  if(override[nomFull] && override[nomFull].svodSheets) return parse(override[nomFull].svodSheets);
  var fk=_cfgNorm(_cfgKalit(nomFull));
  for(var k in override){
    if(override[k] && override[k].svodSheets && _cfgNorm(_cfgKalit(k))===fk) return parse(override[k].svodSheets);
  }
  return [];
}
/* Parent (papka) obyektining bo'lingan (split) sub-obyektlari ro'yxati — keshdagi skandan.
 * YAGONA manba: takroriy `o.obyekt.split(' - ')[0]===parent` bloklarini almashtiradi. */
function _subObyektlar(parent){
  var out=[], sk=(typeof _keshOlStale==='function')?(_keshOlStale('skan')||[]):[];
  var p=_cfgNorm(parent);
  for(var i=0;i<sk.length;i++){
    var o=String(sk[i].obyekt||'');
    if(o && _cfgNorm(o)!==p && _cfgNorm(_cfgKalit(o))===p) out.push(o);
  }
  return out;
}

/* Faylning varaq nomlarini qaytaradi (panel uchun) */
function apiSheetlarOl(fileId){
  if(!fileId) return [];
  try{
    var file=DriveApp.getFileById(fileId);
    var ss;
    if(file.getMimeType()===MimeType.GOOGLE_SHEETS){
      ss=SpreadsheetApp.openById(fileId);
    } else {
      // Excel — vaqtincha konvertatsiya
      var tmp=_openAsSheet(file, null);
      var names=tmp.getSheets().map(function(s){ return s.getName(); });
      _cleanupTmp(tmp);
      return names;
    }
    return ss.getSheets().map(function(s){ return s.getName(); });
  }catch(e){ return []; }
}

function _normFormat(fmt){
  var f=String(fmt||'TN').trim().toUpperCase();
  if(f==='ABC' || f==='АБЦ') return 'ABC4';
  if(f!=='ABC4') return 'TN';
  return f;
}


/* Excel → Google Sheets (vaqtinchalik, o'qish uchun).
 * MUHIM TEZLASHTIRISH: avval file.getBlob() butun faylni XOTIRAGA yuklab,
 * Drive.Files.create bilan qayta yuklardi → KATTA fayl uchun timeout.
 * ENDI: Drive.Files.copy — server tomonda konvertatsiya, blob yuklanmaydi.
 * Eslatma: doimiy konvertatsiya (apiNativeGaAylantir) bog'langan bo'lsa,
 * bu funksiya umuman chaqirilmaydi (fayl allaqachon native bo'ladi). */
function _openAsSheet(file, folderId){
  var mt = file.getMimeType();
  if(mt === MimeType.GOOGLE_SHEETS) return SpreadsheetApp.openById(file.getId());
  // DOIMIY NUSXA: Excel → native Sheets BIR MARTA konvert, keyin tezkor ochish.
  // _NAT_ prefiksi bilan saqlanadi. Excel o'zgarmagan bo'lsa qayta konvert QILINMAYDI.
  var fid = file.getId();
  var folderRealId = folderId || DriveApp.getRootFolder().getId();
  var natName = '_NAT_' + file.getName();
  var exTime = file.getLastUpdated().getTime();

  // (1) ⚡ DOIMIY KESH (Script Property) — Drive qidiruvisiz reuse.
  //     Drive qidiruvi (getFilesByName) yangi faylni darrov indekslamaydi → katta obyekt
  //     timeout bo'lib qayta uringanda har safar yangi _NAT_ yaralardi (49 ta dublikat).
  //     Kesh excelID→nativeID ni saqlaydi → race YO'Q, qayta konvert YO'Q, vaqt sarflanmaydi.
  var ent = _natKeshOl(fid);
  if(ent && ent.natId){
    try{
      var nf = DriveApp.getFileById(ent.natId);
      if(!nf.isTrashed() && exTime <= (ent.t||0)) return SpreadsheetApp.openById(ent.natId);
      if(exTime > (ent.t||0)){ try{ nf.setTrashed(true); }catch(e){} }   // Excel yangilangan
    }catch(e){ /* nat o'chirilgan — qayta konvert */ }
  }

  // (2) Drive'даги mavjud _NAT_ (kesh bo'sh bo'lsa) + ORTIQCHA dublikatlarni darhol tozalash.
  var folder = DriveApp.getFolderById(folderRealId);
  var it = folder.getFilesByName(natName), found = null;
  while(it.hasNext()){
    var nf2 = it.next();
    if(!found && exTime <= nf2.getLastUpdated().getTime()) found = nf2;
    else { try{ nf2.setTrashed(true); }catch(e){} }   // eski yoki ortiqcha nusxa → chiqindi
  }
  if(found){
    _natKeshYoz(fid, found.getId(), found.getLastUpdated().getTime());
    return SpreadsheetApp.openById(found.getId());
  }

  // (3) Bir marta konvert + keshga yoz (keyingi runlar darrov ishlatadi)
  var newId = _excelToNative(fid, folderRealId, natName);
  var when = Date.now();
  try{ when = DriveApp.getFileById(newId).getLastUpdated().getTime(); }catch(e){}
  _natKeshYoz(fid, newId, when);
  return SpreadsheetApp.openById(newId);
}

/* _NAT_ konvert keshi (Script Property) — {excelFileId:{natId,t}}.
 * Drive qidiruvi race'ini chetlab o'tadi → dublikat va qayta konvert YO'Q. */
function _natKeshOl(fid){
  try{
    var m = JSON.parse(PropertiesService.getScriptProperties().getProperty('NAT_CACHE')||'{}');
    return fid ? m[fid] : m;
  }catch(e){ return fid ? null : {}; }
}
function _natKeshYoz(fid, natId, t){
  try{
    var p = PropertiesService.getScriptProperties();
    var m = {}; try{ m = JSON.parse(p.getProperty('NAT_CACHE')||'{}'); }catch(e){}
    m[fid] = {natId:natId, t:t||Date.now()};
    p.setProperty('NAT_CACHE', JSON.stringify(m));
  }catch(e){}
}

/* Excel faylni native Google Sheets ga aylantiradi — SERVER TOMONDA (copy).
 * Blob yuklamaydi → katta fayl uchun ham tez va xotira yemaydi.
 * Yangi (native) fayl ID sini qaytaradi. */
function _excelToNative(fileId, folderId, newName){
  var resource = {
    name: newName,
    mimeType: MimeType.GOOGLE_SHEETS,        // = native Google Sheets
    parents: [folderId || DriveApp.getRootFolder().getId()]
  };
  try {
    var copied = Drive.Files.copy(resource, fileId);  // konvert server tomonda
    if(copied && copied.id) return copied.id;
    throw 'Drive.Files.copy qaytarmadi';
  } catch(e){
    throw 'Конвертация хатоси ('+newName+'): '+(e.message||e);
  }
}

function _cleanupTmp(spreadsheet){
  try {
    var nm=spreadsheet.getName();
    // _TMP_ bilan boshlansa o'chiramiz
    if(nm.indexOf('_TMP_')===0) DriveApp.getFileById(spreadsheet.getId()).setTrashed(true);
  } catch(e){}
}

/* ============ _TMP_ VA DUBLIKAT TOZALASH ============
 * Ijro 6-min limitda o'lsa _cleanupTmp ishlamay qoladi → obyekt papkalarida
 * '_TMP_...' konvert fayllar to'planadi. Shuningdek parallel ijrolar bir nechta
 * LRV_PLUS yaratib qo'yishi mumkin. Bu funksiya:
 *   1) Har obyekt papkasidagi barcha '_TMP_' fayllarni o'chiradi
 *   2) Bir xil nomli LRV_PLUS dublikatlardan ENG YANGISINI qoldiradi
 *   3) '_NAT_' (Excel→Sheets konvert) DUBLIKATLARini tozalaydi — eng yangisi qoladi.
 *      (Katta obyekt timeout bo'lib qayta-qayta uringanda Drive qidiruvi yangi nusxani
 *       darrov indekslamaydi → har urinishда yangi _NAT_ yaraladi → o'nlab keraksiz nusxa.)
 * Chaqiriladi: _navbatTugadi (avto) + menyu '🧹 Вақтинча файлларни тозалаш'. */
function tmpTozala(){
  var a=sozAsosiy(), tmpN=0, dupN=0, natN=0;
  var root=DriveApp.getFolderById(a.rootId);
  var subs=root.getFolders();
  while(subs.hasNext()){
    var folder=subs.next();
    var byName={}, natByName={}, it=folder.getFiles();
    while(it.hasNext()){
      var f=it.next(), nm=f.getName();
      if(nm.indexOf('_TMP_')===0){ try{ f.setTrashed(true); tmpN++; }catch(e){} continue; }
      if(nm.indexOf('_NAT_')===0){ (natByName[nm]=natByName[nm]||[]).push(f); continue; }
      if(nm.indexOf(CFG.PLUS_SUF)>=0){
        (byName[nm]=byName[nm]||[]).push(f);
      }
    }
    // Dublikat LRV_PLUS: eng yangi qoladi, qolganлари chiqindi
    for(var nm2 in byName){
      var arr=byName[nm2];
      if(arr.length<2) continue;
      arr.sort(function(x,y){ return y.getLastUpdated().getTime()-x.getLastUpdated().getTime(); });
      for(var d=1; d<arr.length; d++){ try{ arr[d].setTrashed(true); dupN++; }catch(e){} }
    }
    // Dublikat _NAT_ konvert: har nom uchun eng yangisi qoladi, qolganлари chiqindi
    for(var nm3 in natByName){
      var na=natByName[nm3];
      if(na.length<2) continue;
      na.sort(function(x,y){ return y.getLastUpdated().getTime()-x.getLastUpdated().getTime(); });
      for(var k=1; k<na.length; k++){ try{ na[k].setTrashed(true); natN++; }catch(e){} }
    }
  }
  var msg='Тозаланди: '+tmpN+' та _TMP_ , '+dupN+' та дубликат LRV_PLUS, '+natN+' та ортиқча _NAT_ нусха';
  Logger.log(msg);
  // Skan keshini yangilaymiz — plusId eskirgan bo'lishi mumkin
  try{ apiKeshSkanYangilash(); }catch(e){}
  return {ok:true, tmp:tmpN, dup:dupN, nat:natN, xabar:msg};
}

/* Eski "Untitled" fayllarni tozalash — bir marta ishga tushirish kerak */
function untitledTozala(){
  var root=DriveApp.getRootFolder();
  var files=root.getFilesByName('Untitled');
  var cnt=0;
  while(files.hasNext()){
    var f=files.next();
    // Faqat GSheets fayllarini o'chiramiz
    if(f.getMimeType()===MimeType.GOOGLE_SHEETS){
      f.setTrashed(true); cnt++;
    }
  }
  Logger.log('O\'chirildi: '+cnt+' ta "Untitled" Google Sheets fayli');
  return cnt+' ta o\'chirildi';
}

function _plusFile(obyekt, folderId){
  var nm = obyekt + CFG.PLUS_SUF;
  var folder = DriveApp.getFolderById(folderId);
  var ex = folder.getFilesByName(nm);
  if(ex.hasNext()) return SpreadsheetApp.openById(ex.next().getId());
  var ss = SpreadsheetApp.create(nm);
  var file = DriveApp.getFileById(ss.getId());
  folder.addFile(file);
  try { DriveApp.getRootFolder().removeFile(file); } catch(e){}
  return ss;
}
