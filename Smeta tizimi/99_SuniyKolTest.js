function testSvod() {
  var sp = PropertiesService.getScriptProperties();
  var boglashStr = sp.getProperty('_BOGLASH');
  var boglash = [];
  if (boglashStr) boglash = JSON.parse(boglashStr);

  var suniyKol = boglash.filter(function(b) { return b.obyekt.toLowerCase().indexOf("ko'l") > -1 || b.obyekt.toLowerCase().indexOf("suniy") > -1; });
  console.log("Suniy Kol configs:", JSON.stringify(suniyKol, null, 2));

  if (suniyKol.length > 0 && suniyKol[0].svodFile) {
    var svodId = suniyKol[0].svodFile;
    console.log("Svod file ID:", svodId);
    var ss = SpreadsheetApp.openById(svodId);
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var sh = sheets[i];
      var name = sh.getName();
      if (suniyKol[0].svodSheets && suniyKol[0].svodSheets.indexOf(name) === -1) continue;

      var last = sh.getLastRow();
      if (last > 10) last = 10;
      var vals = sh.getRange(1, 1, last, 10).getValues();
      console.log("Sheet:", name);
      console.log(JSON.stringify(vals, null, 2));
    }
  }
}

/* ============ MISS DIAGNOSTIKA (nima uchun narx topilmadi) ============
 * _NARX_LOG dagi berilgan obyektning barcha MISS qatorlarini o'qib, ularni
 * SVODKA faylining BARCHA varaqlaridan (svodSheets filtrisiz) qidiradi.
 * Har biri uchun aniqlaydi:
 *   - hech qayerda yo'q          → svodkada haqiqatan bu resurs mavjud emas
 *   - topildi, lekin svodSheets filtridan tashqarida → filtr xato/torg'in
 *   - topildi, lekin oraliq tashqarisida (faqat MAT/OB uchun muhim, ЧЕЛ/МАШ
 *     fix'dan keyin oraliqqa qaramaydi)
 *   - topildi va OK bo'lishi kerak edi → boshqa sabab (masalan bir nechta
 *     svod faylida bir xil nom, lekin har xil qiymat — birinchisi olingan)
 *
 * Ishlatish: Apps Script muharriri → funksiya tanlash → diagMissSababi →
 *   parametrsiz ishga tushirsa avtomatik "СКВАЖИНА" so'zi bo'yicha qidiradi,
 *   yoki diagMissSababi('boshqa obyekt qismi') deb alohida chaqiring.
 * Natija: View → Logs (yoki Ctrl+Enter) da ko'rinadi. */
function diagMissSababi(obyektQisman){
  obyektQisman = obyektQisman || 'СКВАЖИНА';
  var obs = papkaSkan();
  var target = null;
  for (var i=0;i<obs.length;i++){
    if (obs[i].obyekt.toUpperCase().indexOf(String(obyektQisman).toUpperCase())>-1){ target=obs[i]; break; }
  }
  if(!target){ Logger.log('Obyekt topilmadi: '+obyektQisman); return; }

  Logger.log('=== OBYEKT: '+target.obyekt+' ===');

  var plus = _plusTop(target.obyekt);
  if(!plus){ Logger.log('LRV_PLUS topilmadi: '+target.obyekt); return; }

  var logSh = plus.getSheetByName(CFG.NARX_LOG);
  if(!logSh || logSh.getLastRow()<2){ Logger.log('_NARX_LOG bo\'sh yoki yo\'q — MISS umuman yo\'q ko\'rinadi: '+target.obyekt); return; }

  var lv = logSh.getRange(2,1,logSh.getLastRow()-1,8).getValues();
  var missItems=[], seen={};
  for(var i=0;i<lv.length;i++){
    var ob=String(lv[i][0]||''), tur=String(lv[i][3]||'');
    if(ob.trim()!==target.obyekt.trim()) continue;
    if(tur==='ФОРМАТ') continue;
    var nom=String(lv[i][4]||''), bir=String(lv[i][5]||'');
    if(!nom) continue;
    var key=_normNomKey(nom)+'||'+_normBirlik(bir);
    if(seen[key]) continue; seen[key]=true;
    missItems.push({nom:nom, bir:bir, key:key});
  }
  if(!missItems.length){ Logger.log('_NARX_LOG da bu obyekt uchun MISS qator yo\'q.'); return; }
  Logger.log('MISS soni (noyob nom+birlik): '+missItems.length);

  var fmt=_normFormat(target.format||'TN');
  var svodCfgBase=_svodCfg(target);
  var svodSheetsFilter = target.svodSheets||[];
  var savedOraliq=_oraliqlarOl(target.obyekt);
  var kat=sozKategoriya();

  Logger.log('SVOD FAYL: '+(target.svodFile?target.svodFile.getName():'YOQ')+'  FORMAT: '+fmt);
  Logger.log('SVOD USTUNLARI (asosiy): '+JSON.stringify(svodCfgBase));
  Logger.log('SVOD_SHEETS FILTR: '+(svodSheetsFilter.length?JSON.stringify(svodSheetsFilter):'(filtr yoq — svodkadagi barcha varaq o\'qiladi)'));
  Logger.log('ORALIQ (SOZLAMALAR_ОРАЛИҚ) yozuvlari — jami '+savedOraliq.length+' ta:');
  for(var o=0;o<savedOraliq.length;o++){
    var oo=savedOraliq[o];
    Logger.log('   varaq="'+oo.varaq+'"  qatordan='+oo.qator+'  kat='+oo.kat+'  sarlavha="'+oo.sarlavha+'"');
  }

  if(!target.svodFile){ Logger.log('svodFile obyektda yo\'q — to\'xtatildi.'); return; }
  var svodSS=_openAsSheet(target.svodFile, target.folderId);
  var sheets=svodSS.getSheets();
  Logger.log('SVODKADAGI VARAQLAR ('+sheets.length+' ta):');
  for(var s=0;s<sheets.length;s++){
    var nm=sheets[s].getName();
    var included = !svodSheetsFilter.length || svodSheetsFilter.indexOf(nm.trim())>=0;
    Logger.log('   ['+(included?'O\'QILADI      ':'FILTRDA YO\'Q — O\'TKAZIB YUBORILADI')+'] "'+nm+'" ('+sheets[s].getLastRow()+' qator)');
  }

  var topilmagan=0, filtrdaYoq=0, oraliqdaYoq=0, boshqa=0;
  Logger.log('=== HAR BIR MISS UCHUN NATIJA ===');
  for(var m=0;m<missItems.length;m++){
    var mi=missItems[m], found=null;
    for(var s=0;s<sheets.length && !found;s++){
      var sh=sheets[s], last=sh.getLastRow();
      if(last<1) continue;
      var maxc=8;
      var vAll=sh.getRange(1,1,last,maxc).getValues();
      var curSc=svodCfgBase;
      for(var ri=0; ri<Math.min(10, vAll.length); ri++){
        var rowStr = vAll[ri].join(' ').toUpperCase();
        if(rowStr.indexOf('НАИМЕНОВАНИЕ')>=0 && rowStr.indexOf('ЕД.ИЗМ')>=0){
          if(rowStr.indexOf('КОД')>=0 || rowStr.indexOf('ОБОСНОВАНИЕ')>=0){ curSc=CFG.SVOD_ABC; }
          else { curSc=CFG.SVOD_TN; }
          break;
        }
      }
      for(var r=0;r<vAll.length;r++){
        var nomV=String(vAll[r][curSc.NOM-1]||'').trim();
        var birV=String(vAll[r][curSc.BIRLIK-1]||'').trim();
        if(!nomV||!birV) continue;
        var k=_normNomKey(nomV)+'||'+_normBirlik(birV);
        if(k===mi.key){
          var included = !svodSheetsFilter.length || svodSheetsFilter.indexOf(sh.getName().trim())>=0;
          var rKat = _oraliqKat(savedOraliq, sh.getName(), r+1);
          var bCat = _catBirlik(birV, nomV, kat);
          found={sheet:sh.getName(), row:r+1, narx:vAll[r][curSc.NARX-1], included:included, oraliqKat:rKat||'', bCat:bCat};
          break;
        }
      }
    }
    if(!found){
      topilmagan++;
      Logger.log('YOʻQ HECH QAYERDA           | '+mi.nom+' | '+mi.bir);
    } else if(!found.included){
      filtrdaYoq++;
      Logger.log('SVOD_SHEETS FILTRIDA YOʻQ   | '+mi.nom+' | '+mi.bir+'  → varaq="'+found.sheet+'" qator='+found.row+' narx='+found.narx);
    } else if(found.bCat!=='ЧЕЛ' && found.bCat!=='МАШ' && !found.oraliqKat){
      oraliqdaYoq++;
      Logger.log('ORALIQ TASHQARISIDA (MAT/OB)| '+mi.nom+' | '+mi.bir+'  → varaq="'+found.sheet+'" qator='+found.row+' narx='+found.narx);
    } else {
      boshqa++;
      Logger.log('TOPILDI, narxlanishi kerak  | '+mi.nom+' | '+mi.bir+'  → varaq="'+found.sheet+'" qator='+found.row+' kat='+(found.bCat||found.oraliqKat)+' narx='+found.narx);
    }
  }
  Logger.log('=== JAMI: hech qayerda yo\'q='+topilmagan+'  filtrdan tashqari='+filtrdaYoq+'  oraliqdan tashqari(mat/ob)='+oraliqdaYoq+'  boshqa/topildi='+boshqa+' ===');
}
