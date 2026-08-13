/********************************************************************
 * 36_XlsxQiymat.js — .xlsx dan FAQAT QIYMATLARNI o'qish
 * ==================================================================
 * ⚡⚡⚡ 2026-08-13 (foydalanuvchi: «F2 ni yuklashda #REF deb qolayapdi
 * va shuning uchun ko'p narsalar importda chiqmayapdi... bazi excelda
 * boshqa manbalardan tortilganlari ham ref bo'lib qolayapdi. Shu
 * exceldagi hamma F2 ni FAQAT QIYMATI bilan tortib olish muammoni
 * yechimi deb o'ylayapman»).
 *
 * ILDIZ SABAB — foydalanuvchi to'g'ri topgan:
 *   .xlsx faylda katak IKKI narsani saqlaydi:
 *     <f> — formula (masalan boshqa faylga havola: [Kitob2]List1!A5)
 *     <v> — Excel oxirgi marta HISOBLAGAN qiymat (kesh)
 *   `Drive.Files.copy` bilan Google Sheets'ga konvert qilinganda Google
 *   FORMULANI ko'chiradi va QAYTA HISOBLAYDI. Tashqi faylga havola
 *   Google Sheets'da mavjud emas → `#REF!`. Natijada Excel'da ko'rinib
 *   turgan HAQIQIY SON butunlay yo'qoladi.
 *
 * YECHIM: konvertni butunlay chetlab o'tib, .xlsx ni GAS ichida ochamiz
 * (Utilities.unzip) va FAQAT <v> keshlangan qiymatlarini o'qiymiz.
 * Formula umuman qaralmaydi → #REF! paydo bo'lishi MUMKIN EMAS.
 *
 * Manba: `_f2lab/xlsx.js` (Node sinov stendidagi ishlaydigan parser)
 * GAS'ga portlandi — mantiq bir xil, faqat fayl o'qish usuli boshqa.
 ********************************************************************/

/* ---------- XML matn belgilarini ochish ---------- */
function _xqDec(s){
  return String(s)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"')
    .replace(/&apos;/g,"'")
    .replace(/&#(\d+);/g, function(m,d){ return String.fromCharCode(+d); })
    .replace(/&#x([0-9a-fA-F]+);/g, function(m,d){ return String.fromCharCode(parseInt(d,16)); })
    .replace(/&amp;/g,'&');
}

/* ---------- "BC" → 0-asosli ustun indeksi ---------- */
function _xqColIdx(ref){
  var c=0;
  for(var i=0;i<ref.length;i++){
    var ch=ref[i];
    if(ch>='A' && ch<='Z') c=c*26+(ch.charCodeAt(0)-64);
    else break;
  }
  return c-1;
}

/* ---------- zip ichidagi fayllarni nom→matn xaritasiga ---------- */
function _xqOch(blob){
  var xarita = {};
  var fayllar = Utilities.unzip(blob);
  for (var i=0;i<fayllar.length;i++){
    var f = fayllar[i];
    var nom = String(f.getName()||'').replace(/\\/g,'/');
    // Faqat kerakli XML'lar (qolganini o'qish xotira va vaqtni yeydi)
    if (!/^(xl\/workbook\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/sharedStrings\.xml|xl\/worksheets\/.+\.xml)$/.test(nom)) continue;
    try { xarita[nom] = f.getDataAsString('UTF-8'); } catch(e){
      try { xarita[nom] = f.getDataAsString(); } catch(e2){}
    }
  }
  return xarita;
}

/* ---------- sharedStrings ---------- */
function _xqSharedStrings(xarita){
  var xml = xarita['xl/sharedStrings.xml'];
  if(!xml) return [];
  var out=[];
  var siRe = /<si>([\s\S]*?)<\/si>/g, m;
  while((m = siRe.exec(xml)) !== null){
    var t='';
    var tRe = /<t[^>]*>([\s\S]*?)<\/t>/g, tm;
    while((tm = tRe.exec(m[1])) !== null) t += tm[1];
    out.push(_xqDec(t));
  }
  return out;
}

/* ---------- varaq nomlari + XML manzillari ---------- */
function _xqVaraqlar(xarita){
  var wb = xarita['xl/workbook.xml'];
  if(!wb) return [];
  var rels = xarita['xl/_rels/workbook.xml.rels'] || '';
  var relMap = {};
  var rRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g, rm;
  while((rm = rRe.exec(rels)) !== null) relMap[rm[1]] = rm[2];

  var out=[];
  // r:id atributi name'dan oldin ham, keyin ham kelishi mumkin — ikki naqsh
  var sRe = /<sheet\b([^>]*)\/?>/g, sm;
  while((sm = sRe.exec(wb)) !== null){
    var attrs = sm[1];
    var nomM = attrs.match(/name="([^"]*)"/);
    var idM  = attrs.match(/r:id="([^"]+)"/);
    if(!nomM || !idM) continue;
    var t = String(relMap[idM[1]]||'').replace(/^\/?xl\//,'');
    if(!t) continue;
    out.push({nom: _xqDec(nomM[1]), manzil: 'xl/'+t});
  }
  return out;
}

/* ---------- bitta varaqni o'qish: FAQAT <v> keshlangan qiymatlar ----------
 * @return {{rows:Array<Array>, merges:Array, xatoKatak:number, formulaKatak:number}}
 */
function _xqVaraqOqi(xarita, manzil){
  var xml = xarita[manzil];
  if(!xml) return null;
  var ss = _xqSharedStrings(xarita);
  var rows = [], maxR = 0;
  var xatoKatak = 0, formulaKatak = 0;

  var rowRe = /<row[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g, rm;
  while((rm = rowRe.exec(xml)) !== null){
    var rIdx = (+rm[1]) - 1, arr = [];
    var cRe = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
    while((cm = cRe.exec(rm[2])) !== null){
      var attrs = cm[1], body = cm[2] || '';
      var refM = attrs.match(/r="([A-Z]+)\d+"/);
      if(!refM) continue;
      var t = (attrs.match(/t="(\w+)"/) || [])[1] || '';
      if(/<f[\s>]/.test(body)) formulaKatak++;

      var v = '';
      var vm = body.match(/<v>([\s\S]*?)<\/v>/);
      if(vm) v = _xqDec(vm[1]);
      else {
        var im = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
        if(im) v = _xqDec(im[1]);
      }

      if(t === 'e'){
        /* Xato TURI (#REF!, #N/A ...). Excel'da ham xato bo'lgan katak —
         * bunda tiklab bo'lmaydi, BO'SH qoldiramiz. Bu Google konvertidan
         * kelgan #REF! dan farq qiladi: bu yerda xato ASL faylda bor. */
        xatoKatak++;
        v = '';
      } else if(t === 's'){
        v = (ss[+v] !== undefined ? ss[+v] : '');
      } else if(t !== 'str' && t !== 'inlineStr' && v !== '' && !isNaN(v)){
        v = Number(v);
      }
      arr[_xqColIdx(refM[1])] = v;
    }
    rows[rIdx] = arr;
    if(rIdx > maxR) maxR = rIdx;
  }
  for(var i=0;i<=maxR;i++) if(!rows[i]) rows[i] = [];

  var merges = [];
  var mRe = /<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g, mm;
  while((mm = mRe.exec(xml)) !== null){
    merges.push({r1:(+mm[2])-1, c1:_xqColIdx(mm[1]), r2:(+mm[4])-1, c2:_xqColIdx(mm[3])});
  }
  return {rows: rows, merges: merges, xatoKatak: xatoKatak, formulaKatak: formulaKatak};
}

/* ══════════════════════════════════════════════════════════════════
 * API: .xlsx faylni FAQAT QIYMAT bilan Google Sheets'ga aylantirish
 * ==================================================================
 * Konvert emas — YANGI toza jadval yaratib, ichiga faqat qiymatlarni
 * yozadi. Formula ko'chirilmaydi → #REF! bo'lishi mumkin emas.
 *
 * @param {string} fileId  .xlsx fayl ID
 * @param {string} papkaId qayerga saqlash (bo'sh — fayl turgan papka)
 * @return {{ok:boolean, fileId?:string, nom?:string, varaqlar?:Array, xabar?:string}}
 * ══════════════════════════════════════════════════════════════════ */
function apiXlsxQiymatBilanOch(fileId, papkaId){
  try{
    var meta = Drive.Files.get(fileId, {fields:'id,name,mimeType,parents,size'});
    if (meta.mimeType === 'application/vnd.google-apps.spreadsheet')
      return {ok:false, xabar:'Бу аллақачон Google Sheets — конверт керак эмас'};

    var blob = DriveApp.getFileById(fileId).getBlob();
    var xarita;
    try { xarita = _xqOch(blob); }
    catch(ez){ return {ok:false, xabar:'Файлни очиб бўлмади (zip эмас ёки шикастланган): '+String((ez&&ez.message)||ez)}; }

    var vlar = _xqVaraqlar(xarita);
    if(!vlar.length) return {ok:false, xabar:'Файл ичида варақ топилмади (.xlsx эмасми?)'};

    var yangiNom = String(meta.name||'F2').replace(/\.(xlsx|xlsm|xls)$/i,'') + ' (қиймат)';

    /* ⚡⚡⚡ 2026-08-13 DUBLIKAT TO'PLANISHI TUZATILDI: har safar fayl tanlanganda
     * yangi nusxa yaratilardi — foydalanuvchi Ф2 ro'yxatida bir xil nomli 4-5 ta
     * «(GS)»/«(қиймат)» fayl ko'rib chalkashardi (jonli skrinshot bilan tasdiq).
     * Endi: shu papkada AYNAN shu nomli tayyor fayl bo'lsa — QAYTA
     * ISHLATILADI (qayta konvert qilinmaydi, tezroq ham bo'ladi). */
    var nishonPapka = papkaId || (meta.parents && meta.parents[0]) || '';
    if (nishonPapka) {
      try {
        var mavjud = DriveApp.getFolderById(nishonPapka).getFilesByName(yangiNom);
        while (mavjud.hasNext()) {
          var mf = mavjud.next();
          if (mf.getMimeType() !== 'application/vnd.google-apps.spreadsheet') continue;
          var msS = SpreadsheetApp.openById(mf.getId());
          var msOut = msS.getSheets().map(function(sh){
            return { nom: sh.getName(), qatorlar: sh.getLastRow(),
                     ustunlar: sh.getLastColumn(), yashirin: sh.isSheetHidden() };
          }).filter(function(v){ return !v.yashirin && v.qatorlar > 1; });
          if (msOut.length) {
            return {ok:true, fileId: mf.getId(), nom: yangiNom, varaqlar: msOut,
                    qaytaIshlatildi:true,
                    xabar:'Тайёр «фақат қиймат» нусхаси топилди — қайта ишлатилди'};
          }
        }
      } catch(em){}
    }

    var ss = SpreadsheetApp.create(yangiNom);
    var natijaVaraq = [];
    var jamiXato = 0, jamiFormula = 0;

    for(var i=0;i<vlar.length;i++){
      var d = _xqVaraqOqi(xarita, vlar[i].manzil);
      if(!d) continue;
      jamiXato += d.xatoKatak; jamiFormula += d.formulaKatak;

      var rows = d.rows;

      /* ⚡⚡⚡ 2026-08-13 «10 000 000 katak limiti» XATOSI TUZATILDI:
       * .xlsx da chetda (masalan XFD ustunida) bitta bo'sh-formatli katak
       * bo'lsa ham kenglik 16384 ga chiqib ketardi → 556 qator × 16384 =
       * 9.1 mln katak, uch varaqda 10 mln limitidan oshib xato berardi
       * (jonli sinovda tasdiqlandi). ENDI: HAQIQATAN to'ldirilgan oxirgi
       * qator/ustun aniqlanib, faqat shu diapazon yoziladi. */
      var oxirgiQator = -1, oxirgiUstun = -1;
      for(var r=0;r<rows.length;r++){
        var a = rows[r] || [];
        for(var c=0;c<a.length;c++){
          if(a[c] !== undefined && a[c] !== ''){
            if(r > oxirgiQator) oxirgiQator = r;
            if(c > oxirgiUstun) oxirgiUstun = c;
          }
        }
      }
      if(oxirgiQator < 0){ natijaVaraq.push({nom: vlar[i].nom, qatorlar:0, ustunlar:0, bosh:true}); continue; }

      // Xavfsizlik chegarasi (F2 aktlari bunchaga yaqinlashmaydi)
      var MAX_Q = 20000, MAX_U = 200, kesildi = false;
      if(oxirgiQator + 1 > MAX_Q){ oxirgiQator = MAX_Q - 1; kesildi = true; }
      if(oxirgiUstun + 1 > MAX_U){ oxirgiUstun = MAX_U - 1; kesildi = true; }

      var h = oxirgiQator + 1, w = oxirgiUstun + 1;
      rows = rows.slice(0, h);
      for(var r2=0;r2<rows.length;r2++){
        var a2 = rows[r2] || [];
        if(a2.length > w) a2 = a2.slice(0, w);
        for(var c2=0;c2<w;c2++) if(a2[c2] === undefined) a2[c2] = '';
        rows[r2] = a2;
      }

      var sh = (i === 0) ? ss.getSheets()[0] : ss.insertSheet();
      sh.setName(String(vlar[i].nom).slice(0,99));

      // Varaq o'lchamini kerakli darajaga keltiramiz (ortiqchasini o'chiramiz —
      // shunda kitobdagi umumiy katak soni limitga yetmaydi)
      if(sh.getMaxRows()    < h) sh.insertRowsAfter(sh.getMaxRows(), h - sh.getMaxRows());
      if(sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
      if(sh.getMaxRows()    > h) sh.deleteRows(h + 1, sh.getMaxRows() - h);
      if(sh.getMaxColumns() > w) sh.deleteColumns(w + 1, sh.getMaxColumns() - w);

      if(h && w){
        // Katta varaqni bo'lib yozamiz (bir marta 100k+ katak yozish og'ir)
        var BOLAK = 2000;
        for(var b=0;b<rows.length;b+=BOLAK){
          var qism = rows.slice(b, Math.min(b+BOLAK, rows.length));
          sh.getRange(b+1, 1, qism.length, w).setValues(qism);
        }
      }
      /* Merge'larni tiklaymiz — sarlavha/razdel aniqlash (_f2UstunAniqla,
       * razdel B/A ustun merge naqshlari) SHUNGA tayanadi, shuning uchun
       * tashlab ketish mumkin emas. Kesilgan diapazondan tashqarisi
       * o'tkazib yuboriladi. */
      for(var mi=0; mi<d.merges.length; mi++){
        var mg = d.merges[mi];
        if(mg.r1 < 0 || mg.c1 < 0) continue;
        if(mg.r2 >= h || mg.c2 >= w) continue;   // kesilgan hududdan tashqarida
        try{
          sh.getRange(mg.r1+1, mg.c1+1, mg.r2-mg.r1+1, mg.c2-mg.c1+1).merge();
        }catch(em){}
      }
      natijaVaraq.push({nom: vlar[i].nom, qatorlar: h, ustunlar: w,
                        xatoKatak: d.xatoKatak, formulaKatak: d.formulaKatak,
                        kesildi: kesildi});
    }

    // Asl fayl yonidagi papkaga ko'chiramiz
    try{
      var nishon = papkaId || (meta.parents && meta.parents[0]);
      if(nishon){
        var f = DriveApp.getFileById(ss.getId());
        DriveApp.getFolderById(nishon).addFile(f);
        try{ DriveApp.getRootFolder().removeFile(f); }catch(e){}
      }
    }catch(e){}

    return {ok:true, fileId: ss.getId(), nom: yangiNom, varaqlar: natijaVaraq,
            aslFormulaKatak: jamiFormula, aslXatoKatak: jamiXato,
            xabar: 'Фақат ҚИЙМАТ билан ўқилди — формула кўчирилмади, #REF! бўлиши мумкин эмас'
                   + (jamiXato ? (' (асл файлда '+jamiXato+' та хато катак бор эди — улар бўш қолди)') : '')};
  }catch(e){
    return {ok:false, xabar:'Қиймат билан ўқиш хатоси: '+String((e&&e.message)||e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * API: TASHXIS — jadvalda nechta xato katak (#REF! va sh.k.) bor?
 * Foydalanuvchi «#REF bo'lib qolayapdi» deganda AVVAL shuni chaqiring:
 * muammo qayerda ekani (asl faylda-mi yoki konvertdan-mi) aniqlanadi.
 * ══════════════════════════════════════════════════════════════════ */
function apiSheetXatoTashxis(fileId, varaqNom){
  try{
    var ss = SpreadsheetApp.openById(fileId);
    var shs = varaqNom ? [ss.getSheetByName(varaqNom)] : ss.getSheets();
    var natija = [];
    var XATOLAR = ['#REF!','#N/A','#VALUE!','#DIV/0!','#NAME?','#NULL!','#NUM!','#ERROR!'];
    for(var i=0;i<shs.length;i++){
      var sh = shs[i];
      if(!sh) continue;
      var last = sh.getLastRow(), lastC = sh.getLastColumn();
      if(last < 1 || lastC < 1){ natija.push({varaq: sh.getName(), qatorlar:0, xato:0}); continue; }
      var v = sh.getRange(1,1,last,lastC).getDisplayValues();
      var fx = sh.getRange(1,1,last,lastC).getFormulas();
      var xato = 0, formula = 0, turlar = {};
      for(var r=0;r<v.length;r++){
        for(var c=0;c<v[r].length;c++){
          if(fx[r][c]) formula++;
          var s = String(v[r][c]||'').trim();
          if(s && XATOLAR.indexOf(s) >= 0){ xato++; turlar[s] = (turlar[s]||0)+1; }
        }
      }
      natija.push({varaq: sh.getName(), qatorlar: last, ustunlar: lastC,
                   xatoKatak: xato, formulaKatak: formula, turlar: turlar});
    }
    var jami = 0; natija.forEach(function(x){ jami += (x.xatoKatak||0); });
    return {ok:true, jamiXato: jami, varaqlar: natija,
            xabar: jami ? (jami+' та хато катак топилди — «Фақат қиймат билан ўқиш» тавсия этилади')
                        : 'Хато катак топилмади'};
  }catch(e){
    return {ok:false, xabar:'Ташхис хатоси: '+String((e&&e.message)||e)};
  }
}

/* ══════════════════════════════════════════════════════════════════
 * API: MAVJUD Google Sheets faylni «faqat qiymat» nusxasiga aylantirish
 * ==================================================================
 * ⚡ 2026-08-13: foydalanuvchi «баъзи excelda boshqa manbalardan
 * tortilganlari ham ref bo'lib qolayapdi» dedi. Agar fayl ALLAQACHON
 * Google Sheets bo'lsa va ichida formula bor bo'lsa, uni o'qishda
 * qiymatlar to'g'ri chiqadi (getValues formulani hisoblangan holda
 * beradi) — LEKIN formula #REF! bergan bo'lsa qiymat yo'q.
 *
 * MUHIM CHEKLOV (halol aytish kerak): agar Google Sheets'da katak
 * ALLAQACHON #REF! bo'lsa — asl son U YERDA YO'Q, uni tiklashning
 * imkoni yo'q. Bunday holda faqat ASL .xlsx dan qayta yuklash yordam
 * beradi (u yerda Excel'ning keshlangan qiymati saqlangan).
 *
 * Bu funksiya nima qiladi: barcha formulani o'z JORIY qiymati bilan
 * almashtiradi (paste-values-only). Foyda: fayl keyinchalik ko'chirilsa
 * yoki manba o'zgarsa qiymatlar BUZILMAYDI (muzlatiladi).
 *
 * @param {string} fileId Google Sheets fayl ID
 * @param {boolean} yangiNusxa true — yangi faylga (asl tegilmaydi)
 * ══════════════════════════════════════════════════════════════════ */
function apiSheetFormulaniMuzlat(fileId, yangiNusxa){
  try{
    var manba = SpreadsheetApp.openById(fileId);
    var ss = manba;
    var yangiId = fileId;

    if (yangiNusxa){
      var meta = Drive.Files.get(fileId, {fields:'id,name,parents'});
      var nusxa = DriveApp.getFileById(fileId)
        .makeCopy(String(meta.name||'F2') + ' (қиймат)');
      try{
        var p = meta.parents && meta.parents[0];
        if(p){ DriveApp.getFolderById(p).addFile(nusxa); try{ DriveApp.getRootFolder().removeFile(nusxa); }catch(e){} }
      }catch(e){}
      yangiId = nusxa.getId();
      ss = SpreadsheetApp.openById(yangiId);
    }

    var XATOLAR = ['#REF!','#N/A','#VALUE!','#DIV/0!','#NAME?','#NULL!','#NUM!','#ERROR!'];
    var shs = ss.getSheets();
    var muzlatildi = 0, xatoQoldi = 0, varaqlar = [];

    for (var i=0;i<shs.length;i++){
      var sh = shs[i];
      var last = sh.getLastRow(), lastC = sh.getLastColumn();
      if (last < 1 || lastC < 1) continue;
      var rng = sh.getRange(1,1,last,lastC);
      var fx = rng.getFormulas();
      var vals = rng.getValues();
      var disp = rng.getDisplayValues();
      var shMuz = 0, shXato = 0, ozgardi = false;

      for (var r=0;r<fx.length;r++){
        for (var c=0;c<fx[r].length;c++){
          if (!fx[r][c]) continue;                    // formula emas — tegmaymiz
          var d = String(disp[r][c]||'').trim();
          if (XATOLAR.indexOf(d) >= 0){
            // Xato — tiklab bo'lmaydi. Bo'sh qoldiramiz (formula qolsa
            // keyin ham #REF! ko'rsatib importni chalg'itadi).
            vals[r][c] = '';
            shXato++; ozgardi = true;
          } else {
            vals[r][c] = vals[r][c];                  // hisoblangan qiymat
            shMuz++; ozgardi = true;
          }
        }
      }
      if (ozgardi) rng.setValues(vals);               // formula → qiymat
      muzlatildi += shMuz; xatoQoldi += shXato;
      if (shMuz || shXato) varaqlar.push({varaq: sh.getName(), muzlatildi: shMuz, xato: shXato});
    }

    SpreadsheetApp.flush();
    return {ok:true, fileId: yangiId, muzlatildi: muzlatildi, xatoQoldi: xatoQoldi,
            varaqlar: varaqlar,
            xabar: muzlatildi + ' формула қийматга айлантирилди'
                   + (xatoQoldi ? ('; ' + xatoQoldi + ' та хато (#REF! ва ш.к.) катак БЎШАТИЛДИ — уларнинг асл сони бу файлда йўқ, асл .xlsx дан қайта юкланг')
                                : '')};
  }catch(e){
    return {ok:false, xabar:'Формулани музлатиш хатоси: '+String((e&&e.message)||e)};
  }
}
