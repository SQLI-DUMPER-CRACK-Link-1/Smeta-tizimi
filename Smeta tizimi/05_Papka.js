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

function _getSysFolder(parentFolder) {
  var fn = CFG.SYS_FOLDER || '⚙️ Tizim Fayllari';
  var it = parentFolder.getFoldersByName(fn);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(fn);
}

/* FAQAT BITTA obyekt papkasini skan qiladi — butun ROOT ni emas.
 * Navbat (har qadam 1 obyekt) va bitta-obyekt [Ишла] uchun: 9 papka o'rniga 1
 * papka Drive skani → ancha tez. Keshdan folderId oladi, topilmasa to'liq skan. */
function skanBitta(obyekt){
  try{
    var folderId='';
    var sk=(typeof _keshOlStale==='function') ? (_keshOlStale('skan')||[]) : [];
    for(var i=0;i<sk.length;i++){ if(sk[i].obyekt.trim()===obyekt.trim()){ folderId=sk[i].folderId||''; break; } }
    if(folderId){
      var folder=DriveApp.getFolderById(folderId);
      var obs=_skanObyekt(folder, _boglashOl());
      if(obs && obs.length) {
        for(var k=0; k<obs.length; k++) {
          if(obs[k].obyekt.trim()===obyekt.trim()) return obs[k];
        }
      }
    }
  }catch(e){ /* keshda yo'q yoki folder ochilmadi — to'liq skanga tushamiz */ }
  // Zaxira: to'liq skan (kesh bo'sh yoki papka ID eskirган)
  var obs=papkaSkan();
  for(var j=0;j<obs.length;j++) if(obs[j].obyekt.trim()===obyekt.trim()) return obs[j];
  return null;
}

/* ⚡ 2026-07-13 YANGI: DIAGNOSTIKA — foydalanuvchi papkadagi fayllar bor-u, lekin
 * biror sub-obyekt Panelда/«Ишла» ro'yxatida ko'rinmay qolgan holatlarni (masalan
 * fayl tasodifan "СВОДКА" deb noto'g'ri tanlanib, lokalka ro'yxatidan chiqib
 * ketishi) o'zi tekshira olishi uchun. Papka nomi (obyekt ROOT papkasi, ko'p
 * smetali bo'lsa ham xuddi shu — masalan "Amfiteatr") bo'yicha HAR bir faylning
 * qanday tasniflangani (LOKALKA/СВОДКА/СИСТЕМА/e'tiborsiz) va sababini qaytaradi. */
function apiObyektFayllarniTekshir(papkaNomi){
  papkaNomi = String(papkaNomi||'').trim();
  if(!papkaNomi) return {ok:false, xabar:'Папка номини киритинг'};
  var a=sozAsosiy(), root;
  try { root = DriveApp.getFolderById(a.rootId); } catch(e){ return {ok:false, xabar:'ROOT папка хатоси: '+e}; }

  var target=null, subs=root.getFolders();
  while(subs.hasNext()){
    var f=subs.next();
    if(f.getName().trim()===papkaNomi){ target=f; break; }
  }
  if(!target) return {ok:false, xabar:'"'+papkaNomi+'" номли папка топилмади (ROOT остида)'};

  var override=_boglashOl();
  var ovFolder=override[papkaNomi];
  var narxTayyorFolder=!!_ovValFolder(override, papkaNomi, 'narxTayyor');
  var allowedMimes = [
    MimeType.GOOGLE_SHEETS, MimeType.MICROSOFT_EXCEL, MimeType.MICROSOFT_EXCEL_LEGACY,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel', 'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
  ];

  var report=[], it=target.getFiles();
  while(it.hasNext()){
    var fi=it.next(), fn=fi.getName();
    var row={nom:fn, id:fi.getId(), holat:'', sabab:''};
    if(fn.toUpperCase().indexOf(CFG.PLUS_SUF.toUpperCase())>=0){
      row.holat='LRV_PLUS'; row.sabab='Номида "'+CFG.PLUS_SUF+'" бор — ишчи файл, обyekt сифатида ҳисобланмайди.';
    } else if(fn.indexOf('_TMP_')===0 || fn.indexOf('_NAT_')===0 || fn.indexOf('(GS)')>=0){
      row.holat='ТИЗИМ (кўчирилади)'; row.sabab='Номи "_TMP_"/"_NAT_" билан бошланади ёки "(GS)" бор — ⚙️ Tizim Fayllari папкасига кўчирилади.';
    } else {
      var mt=fi.getMimeType();
      if(allowedMimes.indexOf(mt)===-1){
        row.holat='Е\'ТИБОРСИЗ'; row.sabab='MIME тури рухсат этилганлар рўйхатида йўқ: '+mt;
      } else if(ovFolder && ovFolder.svodId===fi.getId()){
        row.holat='СВОДКА (қўлда боғланган)'; row.sabab='Созламалар→Боғлаш жадвалида СВОД_ID сифатида кўрсатилган.';
      } else if(ovFolder && ovFolder.lokId===fi.getId()){
        row.holat='ЛОКАЛКА (қўлда боғланган)'; row.sabab='Созламалар→Боғлаш жадвалида ЛОК_ID сифатида кўрсатилган.';
      } else if(!narxTayyorFolder && _kw(fn.toUpperCase(), CFG.SVOD_KW)){
        row.holat='СВОДКА (калит сўз)'; row.sabab='Номида СВОД/ЦЕН/ПРАЙС каби калит сўз бор.';
      } else {
        row.holat='ЛОКАЛКА (номзод)'; row.sabab='Юқоридаги ҳеч бирига мос келмади — лекин агар папкада СВОДКА умуман топилмаса ва 2+ файл бўлса, ЗАХИРА қоида (алфавит бўйича биринчиси) буни СВОДКА қилиб қўйиши МУМКИН.';
      }
    }
    report.push(row);
  }

  // Haqiqiy _skanObyekt natijasi bilan solishtirish — qaysi fayl aynan SVOD bo'lib tanlangani
  var realResult = _skanObyekt(target, override);
  var yakuniyObyektlar = (realResult||[]).map(function(r){ return r.obyekt; });
  var yakuniySvod = (realResult && realResult[0]) ? realResult[0].svodName : '(aniqlanmadi)';

  // ⚡ 2026-07-13: RAW override (qo'lda bog'lash) qiymatlarini ID→NOM'ga hal qilib
  // ko'rsatamiz — bu "nima uchun aynan shu fayl svod/lokalka bo'lib qoldi" savoliga
  // TO'G'RIDAN-TO'G'RI javob beradi (Созламалар jadvaliga kirmasdan).
  var ovInfo = null;
  if(ovFolder){
    var idToName={};
    report.forEach(function(r){ idToName[r.id]=r.nom; });
    ovInfo = {
      lokId: ovFolder.lokId||'', lokNom: ovFolder.lokId ? (idToName[ovFolder.lokId]||'(papkada topilmadi — ID eskirgan bo\'lishi mumkin)') : '(bo\'sh)',
      svodId: ovFolder.svodId||'', svodNom: ovFolder.svodId ? (idToName[ovFolder.svodId]||'(papkada topilmadi — ID eskirgan bo\'lishi mumkin)') : '(bo\'sh)',
      format: ovFolder.format||'', narxTayyor: !!narxTayyorFolder
    };
  }

  return {ok:true, papka:papkaNomi, fayllar:report, yakuniySvod:yakuniySvod,
    yakuniyObyektlar:yakuniyObyektlar, override:ovInfo,
    xabar:report.length+' та файл текширилди. Якуний СВОДКА: '+yakuniySvod+
      '. Аниқланган суб-объектлар: '+yakuniyObyektlar.length+
      (ovInfo?' · Қўлда боғлаш: ЛОК='+ovInfo.lokNom+', СВОД='+ovInfo.svodNom:' · Қўлда боғлаш йўқ')};
}

function _skanObyekt(folder, override){
  var nom = folder.getName().trim();
  override = override || {};

  var cand=[], it=folder.getFiles(), sysFolder=null;
  var plusId=null;
  var allowedMimes = [
    MimeType.GOOGLE_SHEETS, 
    MimeType.MICROSOFT_EXCEL, 
    MimeType.MICROSOFT_EXCEL_LEGACY,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12'
  ];
  while(it.hasNext()){
    var fi=it.next(), fn=fi.getName();
    if(fn.toUpperCase().indexOf(CFG.PLUS_SUF.toUpperCase())>=0) {
       plusId = fi.getId();
       continue;
    }
    if(fn.indexOf('_TMP_')===0 || fn.indexOf('_NAT_')===0 || fn.indexOf('(GS)')>=0) {
      if(!sysFolder) sysFolder = _getSysFolder(folder);
      try { fi.moveTo(sysFolder); } catch(e){}
      continue;
    }
    var mt = fi.getMimeType();
    if(allowedMimes.indexOf(mt) === -1) continue;
    cand.push({id:fi.getId(), name:fn, file:fi});
  }
  if(!cand.length) return [];

  var lokFiles=[], svod=null;
  var ovFolder = override[nom];
  // НАРХ_ТАЙЁР: lokalka(lar) allaqachon narxlangan — svodka UMUMAN qidirilmaydi/so'ralmaydi,
  // barcha fayllar lokalka deb hisoblanadi (engine o'z НАРХ ustunidan o'qiydi, §narxTayyor).
  var narxTayyorFolder = !!_ovValFolder(override, nom, 'narxTayyor');

  // 1) qo'lda bog'lash (puzzle) - folder nomi bo'yicha
  if(ovFolder){
    for(var c=0;c<cand.length;c++){
      if(ovFolder.lokId  && cand[c].id===ovFolder.lokId)  lokFiles.push(cand[c].file);
      if(!narxTayyorFolder && ovFolder.svodId && cand[c].id===ovFolder.svodId) svod=cand[c].file;
    }
  }

  if(!narxTayyorFolder){
    // 2) Svodni topish (kalit so'z bo'yicha)
    for(var c=0;c<cand.length;c++){
      var up=cand[c].name.toUpperCase(), fi2=cand[c].file;
      if(!svod && _kw(up, CFG.SVOD_KW) && (!ovFolder || cand[c].id!==ovFolder.lokId)){ svod=fi2; continue; }
    }
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
  // НАРХ_ТАЙЁР papkada bu hech qachon ishlamaydi — hammasi lokalka bo'lib qoladi.
  // ⚡⚡⚡ 2026-07-13 KRITIK BARQARORLASHTIRISH: `lokFiles[0]` — Drive'ning
  // `folder.getFiles()` iteratori TARTIBI hech qachon KAFOLATLANMAGAN (bir xil
  // papka ikki marta skanlansa, ayniqsa ichida fayl sони/tarkibi o'zgargan bo'lsa —
  // masalan qandaydir fayl _TMP_/_NAT_ tizim papkasiga ko'chirilgach — TARTIB
  // O'ZGARISHI MUMKIN). Natijada HAR SAFAR BOSHQA fayl "тасодифан svodka" deb
  // tanlanib, o'sha lokalka BUTUNLAY obyekt ro'yxatidan (demak "Ишла" ro'yxatidan
  // ham) g'oyib bo'lib qolardi — "avval ko'rinardi, hozir ko'rinmayapti, hech
  // narsa o'zgartirmagan edim" shikoyatining ILDIZI aynan shu edi. Endi tanlov
  // FAYL NOMI bo'yicha ALFAVIT tartibida — barqaror, takrorlanuvchi va nomi
  // bo'yicha bashorat qilса bo'ladigan.
  if(!narxTayyorFolder && !svod && lokFiles.length > 1) {
     var potentialSvod = null;
     var pIdx = -1;
     var lokSorted = lokFiles.map(function(f,idx){ return {f:f, idx:idx, nm:f.getName()}; })
        .sort(function(a,b){ return a.nm<b.nm?-1:(a.nm>b.nm?1:0); });
     // Agar nomida LOKAL so'zi yo'q bo'lgan bitta fayl bo'lsa, o'shani svod qilamiz
     for(var i=0; i<lokSorted.length; i++) {
        if(!_kw(lokSorted[i].nm.toUpperCase(), CFG.LOK_KW)) {
           potentialSvod = lokSorted[i].f;
           pIdx = lokSorted[i].idx;
           break;
        }
     }
     if(potentialSvod) {
        svod = potentialSvod;
        lokFiles.splice(pIdx, 1);
     } else {
        svod = lokSorted[0].f;
        lokFiles.splice(lokSorted[0].idx, 1);
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
      format:     _normFormat(_ovValFolder(override, nom, 'format') || 'TN'),
      lokSheets:  (ov && ov.lokSheets)  ? _sheetsParse(ov.lokSheets) : [],
      svodSheets: _svodSheetsFolder(override, nom),
      svodCols:   _svodColsFolder(override, nom),
      narxTayyor: narxTayyorFolder,
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
      // Yoki bitta papkadagi boshqa lokalkadan meros olamiz
      var subSvod = svod;
      var inheritedSvodId = _ovValFolder(override, subNom, 'svodId');
      if (inheritedSvodId) {
        for (var c = 0; c < cand.length; c++) {
          if (cand[c].id === inheritedSvodId) {
            subSvod = cand[c].file;
            break;
          }
        }
      }

      var subNarxTayyor = !!_ovValFolder(override, subNom, 'narxTayyor') || narxTayyorFolder;

      results.push({
        obyekt:     subNom,
        folderId:   folder.getId(),
        lokFiles:   [lf],
        lokFile:    lf,
        svodFile:   subSvod,
        lokName:    lf.getName(),
        svodName:   subSvod ? subSvod.getName() : '(yo\'q)',
        format:     _normFormat(_ovValFolder(override, subNom, 'format') || 'TN'),
        lokSheets:  _lokSheetsFolder(override, subNom),
        svodSheets: _svodSheetsFolder(override, subNom),
        svodCols:   _svodColsFolder(override, subNom),
        narxTayyor: subNarxTayyor,
        plusId:     plusId,
        candidates: cand.map(function(x){ return {id:x.id, name:x.name}; })
      });
    }
  }

  return results;
}

/* ⚡ 2026-07-13 KRITIK TUZATISH: avval oddiy substring qidiruv edi — qisqa
 * kalit so'zlar ("ЦЕН","ЛОК") boshqa so'zlar ICHIDA tasodifan uchrab qolishi
 * mumkin (masalan "СЦЕНА" — sahna — "ЦЕН" ni o'z ichiga oladi!). Bunday holda
 * "110081...АРХИТЕКТУРНАЯ ЧАСТЬ - СЦЕНА.xls" каби oddiy lokalka fayl XATO
 * равишда СВОДКА (narx-kalit) deb tanilib, obyekt ro'yxatidan g'oyib bo'lardi.
 * Endi so'z FAQAT boshida (probel/raqam/tire/qatordan keyin, harf EMAS) mos
 * kelsa hisobga olinadi. */
function _kw(s, arr){
  for(var i=0;i<arr.length;i++){
    var k=arr[i], idx=-1;
    while((idx=s.indexOf(k, idx+1))>=0){
      var prevCh = idx>0 ? s.charAt(idx-1) : '';
      if(!/[A-ZА-ЯЁ]/i.test(prevCh)) return true;
    }
  }
  return false;
}


/* PUZZLE BOG'LASH override.
 * SOZLAMALAR_BOGLASH ustunlari:
 *   A=ОБЪЕКТ  B=ЛОК_ID  C=ЛОК_НОМ  D=СВОД_ID  E=СВОД_НОМ  F=ФОРМАТ
 *   G=ЛОК_SHEETS  H=СВОД_SHEETS
 *   I=СВОД_НОМ_УСТ  J=СВОД_БИР_УСТ  K=СВОД_НАРХ_УСТ  L=СВОД_БЛОК_УСТ  M=СВОД_QTY_УСТ  N=СВОД_СУММА_УСТ
 *   O=НАРХ_ТАЙЁР (2026-07 — "1"/TRUE = lokalka allaqachon narxlangan, svodka UMUMAN kerak emas)
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
    var narxTayyorRaw=String(v[i][14]||'').trim().toUpperCase();
    m[nom]={
      lokId:    String(v[i][1]||'').trim(),
      svodId:   String(v[i][3]||'').trim(),
      format:   _normFormat(String(v[i][5]||'TN').trim().toUpperCase()),
      lokSheets: String(v[i][6]||'').trim(),
      svodSheets:String(v[i][7]||'').trim(),
      svodCols: (sc.nom||sc.bir||sc.narx||sc.blok||sc.qty||sc.summa) ? sc : null,
      narxTayyor: (narxTayyorRaw==='1' || narxTayyorRaw==='TRUE')
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
/* Umumiy qiymat (format, svodId) ni meros olish yordamchisi */
function _ovValFolder(override, nomFull, key){
  if(!override) return null;
  if(override[nomFull] && override[nomFull][key]) return override[nomFull][key];
  var fk=_cfgNorm(_cfgKalit(nomFull));
  for(var k in override){
    if(override[k] && override[k][key] && _cfgNorm(_cfgKalit(k))===fk) return override[k][key];
  }
  return null;
}
/* Sheets ro'yxatini parse qilish — YANGI format '|' bilan, ESKI saqlangan ma'lumot ','
 * bilan turgan bo'lishi mumkin. '|' bo'lsa '|' bilan, aks holda ',' bilan bo'linadi.
 * (Aks holda "ЛРВ1,ЛРВ2" bitta nom deb o'qilib, svod varaq filtri hech narsani
 *  o'tkazmaydi → priceDB bo'sh → HAMMA NARX 0 bo'lardi.) */
function _sheetsParse(s){
  if(!s) return [];
  s=String(s);
  var sep = s.indexOf('|')>=0 ? '|' : ',';
  return s.split(sep).map(function(x){return x.trim();}).filter(String);
}

/* svodSheets (qaysi svod varaqlarini o'qish) — SVODKAga tegishli → papka bo'yicha meros.
 * Massiv qaytaradi. */
function _svodSheetsFolder(override, nomFull){
  if(!override) return [];
  if(override[nomFull] && override[nomFull].svodSheets) return _sheetsParse(override[nomFull].svodSheets);
  var fk=_cfgNorm(_cfgKalit(nomFull));
  for(var k in override){
    if(override[k] && override[k].svodSheets && _cfgNorm(_cfgKalit(k))===fk) return _sheetsParse(override[k].svodSheets);
  }
  return [];
}

/* lokSheets (qaysi lok varaqlarini ishlash) — obyekt bo'yicha; topilmasa papka merosi.
 * ⚠️ Bu funksiya YO'Q edi (chaqirilgan-u, aniqlanmagan) → ko'p-lokalkali papkada
 * papkaSkan ReferenceError bilan CRASH bo'lardi (butun tizim ishlamay qolardi). */
function _lokSheetsFolder(override, nomFull){
  if(!override) return [];
  if(override[nomFull] && override[nomFull].lokSheets) return _sheetsParse(override[nomFull].lokSheets);
  var fk=_cfgNorm(_cfgKalit(nomFull));
  for(var k in override){
    if(override[k] && override[k].lokSheets && _cfgNorm(_cfgKalit(k))===fk) return _sheetsParse(override[k].lokSheets);
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
  var sysFolder = _getSysFolder(folder);
  var it = sysFolder.getFilesByName(natName), found = null;
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
  var newId = _excelToNative(fid, sysFolder.getId(), natName);
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
    /* ⚡⚡⚡ 2026-08-13 ZAXIRA YO'L (jonli sinovda topildi): Telegram/API orqali
     * yuklangan .xlsx Drive'da ba'zan 'application/zip' mime bilan saqlanadi
     * (xlsx aslida zip arxiv). Bunda Drive.Files.copy "The requested conversion
     * is not supported" beradi — Drive uni jadval deb bilmaydi.
     * YECHIM: fayl baytlarini olib, MIME'ni majburan Excel deb belgilab,
     * Google Sheets sifatida QAYTA YARATAMIZ (Drive endi konvertni tushunadi). */
    try {
      var blob = DriveApp.getFileById(fileId).getBlob()
        .setContentType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      var yaratildi = Drive.Files.create(
        { name: newName, mimeType: MimeType.GOOGLE_SHEETS, parents: resource.parents },
        blob
      );
      if (yaratildi && yaratildi.id) return yaratildi.id;
      throw 'Drive.Files.create qaytarmadi';
    } catch(e2){
      throw 'Конвертация хатоси ('+newName+'): '+(e.message||e)+' | Заҳира йўл ҳам ишламади: '+(e2.message||e2);
    }
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
    var byName={}, natByName={};
    
    var it=folder.getFiles();
    while(it.hasNext()){
      var f=it.next(), nm=f.getName();
      if(nm.indexOf('_TMP_')===0){ try{ f.setTrashed(true); tmpN++; }catch(e){} continue; }
      if(nm.indexOf('_NAT_')===0){ (natByName[nm]=natByName[nm]||[]).push(f); continue; }
      if(nm.indexOf(CFG.PLUS_SUF)>=0 || nm.indexOf(' - Ф2 тайёр (')>=0){
        (byName[nm]=byName[nm]||[]).push(f);
      }
    }

    var sysIt = folder.getFoldersByName(CFG.SYS_FOLDER || '⚙️ Tizim Fayllari');
    if(sysIt.hasNext()){
      var sysFolder = sysIt.next();
      var sit = sysFolder.getFiles();
      while(sit.hasNext()){
        var sf=sit.next(), snm=sf.getName();
        if(snm.indexOf('_TMP_')===0){ try{ sf.setTrashed(true); tmpN++; }catch(e){} continue; }
        if(snm.indexOf('_NAT_')===0){ (natByName[snm]=natByName[snm]||[]).push(sf); continue; }
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
  var msg='Тозаланди: '+tmpN+' та _TMP_ , '+dupN+' та дубликат LRV_PLUS/Ф2-тайёр, '+natN+' та ортиқча _NAT_ нусха';
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

  // ⚡ 2026-07-12 TUZATILDI: ikkita ijro (masalan Навбат trigger + qo'lda "Ишла"/
  // Ф2 тайёрлаш, yoki chunking davomida ikkita so'rov) shu obyekt uchun BIR VAQTDA
  // shu yerga kelsa — ikkalasi ham yuqoridagi getFilesByName'da "topilmadi" deb
  // ko'rib, ikkalasi ham SpreadsheetApp.create qilib, IKKI XIL ID'li bir xil nomli
  // LRV_PLUS yaratib qo'yardi (Game Club/Yevropa Oshxonasi'da 2-3 taga ko'paygani
  // shu edi). Qulf: ikkinchi chaqiruv birinchisi tugaguncha kutadi, so'ng
  // getFilesByName'ni QAYTA tekshiradi — endi topadi va yangisini yaratmaydi.
  var lock = LockService.getScriptLock();
  var gotLock = false;
  try{ gotLock = lock.tryLock(20000); }catch(e){}
  try{
    ex = folder.getFilesByName(nm);
    if(ex.hasNext()) return SpreadsheetApp.openById(ex.next().getId());

    // HIMOYA: Agar fayl qo'lda o'chirilgan (Korzinada) bo'lsa, uni tiklaymiz!
    var q = "title = '" + nm.replace(/'/g,"\\'") + "' and trashed = true";
    var trashed = folder.searchFiles(q);
    if(trashed.hasNext()) {
      var tf = trashed.next();
      tf.setTrashed(false); // Korzinadan qaytarish
      return SpreadsheetApp.openById(tf.getId());
    }

    var ss = SpreadsheetApp.create(nm);
    var file = DriveApp.getFileById(ss.getId());
    folder.addFile(file);
    try { DriveApp.getRootFolder().removeFile(file); } catch(e){}
    return ss;
  } finally {
    if(gotLock) try{ lock.releaseLock(); }catch(e){}
  }
}
