/**
 * ============================================================
 * FAYL: 8_Home_Page.gs  VERSION: 33.0 (TO'LIQ DASHBOARD)
 * ============================================================
 */

function buildHomePage() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('🏠 Bosh sahifa');
  if (!sheet) {
    sheet = ss.insertSheet('🏠 Bosh sahifa');
    ss.setActiveSheet(sheet);
    ss.moveActiveSheet(1);
  } else { sheet.clear(); sheet.clearConditionalFormatRules(); }
  sheet.setHiddenGridlines(true);
  var COLS = 12;
  for (var c = 1; c <= COLS; c++) sheet.setColumnWidth(c, 70);
  var stats = _calcStats(ss);
  var row = 1;

  // ── SARLAVHA ────────────────────────────────────────────
  sheet.getRange(row,1,1,COLS).merge()
    .setValue('TITAN PRO  ·  Янги Ўзбекистон лойиҳаси')
    .setBackground('#0d47a1').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(20)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(row,56); row++;
  var today = Utilities.formatDate(new Date(),'Asia/Tashkent','EEEE, d MMMM yyyy · HH:mm');
  sheet.getRange(row,1,1,COLS).merge()
    .setValue('Янгиланди: '+today)
    .setBackground('#1565c0').setFontColor('#ffffff')
    .setFontSize(11).setHorizontalAlignment('center');
  sheet.setRowHeight(row,24); row++; sheet.setRowHeight(row,16); row++;

  // ── KPI BLOK 1 ──────────────────────────────────────────
  _drawKpi(sheet,row,1, '📦',stats.totalMaterials,'jami material turi','#37474f');
  _drawKpi(sheet,row,4, '🆘',stats.deficitCount,  'defitsit',          '#c62828');
  _drawKpi(sheet,row,7, '✅',stats.closedCount,   'yopilgan',          '#2e7d32');
  _drawKpi(sheet,row,10,'🔄',stats.zamenaCount,   'zamena',            '#6a1b9a');
  sheet.setRowHeight(row,80); sheet.setRowHeight(row+1,22);
  row+=2; sheet.setRowHeight(row,10); row++;

  // ── KPI BLOK 2 ──────────────────────────────────────────
  _drawKpi(sheet,row,1, '📋',_fmt(stats.totalPlan), 'jami plan',      '#3949ab');
  _drawKpi(sheet,row,4, '📥',_fmt(stats.totalKeldi),'kelgan',         '#1565c0');
  var pct=stats.totalPlan>0?Math.round(stats.totalKeldi/stats.totalPlan*100):0;
  _drawKpi(sheet,row,7, '⚡', pct+'%',              'taminot',        '#00897b');
  _drawKpi(sheet,row,10,'📊',stats.prixodCount,     'qabul qilingan', '#7b1fa2');
  sheet.setRowHeight(row,80); sheet.setRowHeight(row+1,22);
  row+=2; sheet.setRowHeight(row,10); row++;

  // ── MOLIYAVIY BANNER ────────────────────────────────────
  var fpct=stats.totalSmeta>0?Math.round(stats.totalFakt/stats.totalSmeta*100):0;
  sheet.getRange(row,1,1,COLS).merge()
    .setValue('💰 Молиявий: '+fpct+'%  ·  Сарфланди: '+_fmt(stats.totalFakt)+' сум  ·  Смета: '+_fmt(stats.totalSmeta)+' сум')
    .setBackground('#e3f2fd').setFontColor('#0d47a1')
    .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
  sheet.setRowHeight(row,36); row++; sheet.setRowHeight(row,16); row++;

  // ══════════════════════════════════════════════════════════
  // 📊 OBYEKT PROGRESS BAR
  // ══════════════════════════════════════════════════════════
  if (stats.objectProgress && stats.objectProgress.length>0) {
    sheet.getRange(row,1,1,COLS).merge()
      .setValue('📊 OBYEKTLAR BO\'YICHA HOLAT')
      .setBackground('#1565c0').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.setRowHeight(row,30); row++;

    sheet.getRange(row,1,1,4).merge().setValue('Obyekt').setBackground('#e3f2fd').setFontWeight('bold');
    sheet.getRange(row,5,1,6).merge().setValue('Progress').setBackground('#e3f2fd').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(row,11,1,2).merge().setValue('%').setBackground('#e3f2fd').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setRowHeight(row,24); row++;

    stats.objectProgress.forEach(function(obj,idx) {
      var opct=obj.plan>0?Math.round(obj.fakt/obj.plan*100):0;
      opct=Math.min(opct,100);
      var barColor=opct>=95?'#2e7d32':opct>=50?'#1565c0':opct>0?'#ef6c00':'#c62828';

      sheet.getRange(row,1,1,4).merge().setValue(obj.name)
        .setHorizontalAlignment('left').setFontSize(10);
      sheet.getRange(row,5,1,6).merge()
        .setFormula('=SPARKLINE('+opct/100+',{"charttype","bar";"max",1;"color1","'+barColor+'";"color2","#e0e0e0"})');
      sheet.getRange(row,11,1,2).merge().setValue(opct+'%')
        .setFontWeight('bold').setFontSize(11).setFontColor(barColor).setHorizontalAlignment('center');
      sheet.getRange(row,1,1,COLS).setBackground(idx%2===0?'#fafafa':'#ffffff');
      sheet.setRowHeight(row,26); row++;
    });
    sheet.setRowHeight(row,12); row++;
  }

  // ══════════════════════════════════════════════════════════
  // ⚡ TUGMALAR
  // ══════════════════════════════════════════════════════════
  sheet.getRange(row,1,1,COLS).merge()
    .setValue('⚡ ASOSIY AMALLAR')
    .setBackground('#37474f').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');
  sheet.setRowHeight(row,32); row++; sheet.setRowHeight(row,12); row++;

  _drawBtn(sheet,row,1, '📋','NAZORAT','Yagona boshqaruv','#0277bd','buildNazorat');
  _drawBtn(sheet,row,4, '🎯','SNAB PANEL','Universal filtr','#1976d2','openSnabPanel');
  _drawBtn(sheet,row,7, '📍','OBYEKT','Obyekt materiallar','#00897b','reportByObject');
  _drawBtn(sheet,row,10,'🆘','DEFITSIT','Yetmaganlar','#d32f2f','reportDeficit');
  sheet.setRowHeight(row,30);sheet.setRowHeight(row+1,30);sheet.setRowHeight(row+2,30);
  row+=3; sheet.setRowHeight(row,12); row++;

  _drawBtn(sheet,row,1, '🔍','QIDIRUV','Material qidirish','#f9a825','reportByMaterial');
  _drawBtn(sheet,row,4, '🏷', 'KATEGORIYA','Metall · Elektr','#7b1fa2','reportByCategory');
  _drawBtn(sheet,row,7, '📄','PDF','Yuklab olish','#5d4037','exportCurrentReportToPDF');
  _drawBtn(sheet,row,10,'📧','EMAIL','PDF yuborish','#283593','sendCurrentReportByEmail');
  sheet.setRowHeight(row,30);sheet.setRowHeight(row+1,30);sheet.setRowHeight(row+2,30);
  row+=3; sheet.setRowHeight(row,16); row++;

  // ══════════════════════════════════════════════════════════
  // 🔥 TOP-5 DEFITSIT
  // ══════════════════════════════════════════════════════════
  if (stats.topDeficits && stats.topDeficits.length>0) {
    sheet.getRange(row,1,1,COLS).merge()
      .setValue('🔥 ENG KATTA DEFITSIT')
      .setBackground('#b71c1c').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.setRowHeight(row,30); row++;

    sheet.getRange(row,1,1,4).merge().setValue('Material').setBackground('#ffcdd2').setFontWeight('bold');
    sheet.getRange(row,5,1,4).merge().setValue('Birlik').setBackground('#ffcdd2').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(row,9,1,4).merge().setValue('Yetmagan').setBackground('#ffcdd2').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setRowHeight(row,24); row++;

    stats.topDeficits.forEach(function(item,idx) {
      sheet.getRange(row,1,1,4).merge().setValue(item.mat).setHorizontalAlignment('left');
      sheet.getRange(row,5,1,4).merge().setValue(item.ed).setHorizontalAlignment('center');
      sheet.getRange(row,9,1,4).merge().setValue(item.qoldiq).setNumberFormat('#,##0.##')
        .setHorizontalAlignment('right').setFontWeight('bold').setFontColor('#b71c1c');
      sheet.getRange(row,1,1,COLS).setBackground(idx%2===0?'#fff5f5':'#ffffff');
      sheet.setRowHeight(row,26); row++;
    });
    sheet.setRowHeight(row,16); row++;
  }

  // ══════════════════════════════════════════════════════════
  // 🔄 ZAMENA RO'YXATI
  // ══════════════════════════════════════════════════════════
  if (stats.zamenaList && stats.zamenaList.length>0) {
    sheet.getRange(row,1,1,COLS).merge()
      .setValue('🔄 ZAMENALAR ('+stats.zamenaList.length+' ta)')
      .setBackground('#6a1b9a').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.setRowHeight(row,30); row++;

    sheet.getRange(row,1,1,4).merge().setValue('Asl material').setBackground('#f3e5f5').setFontWeight('bold');
    sheet.getRange(row,5,1,4).merge().setValue('→ Zamena').setBackground('#f3e5f5').setFontWeight('bold');
    sheet.getRange(row,9,1,2).merge().setValue('Miqdor').setBackground('#f3e5f5').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(row,11,1,2).merge().setValue('Holat').setBackground('#f3e5f5').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setRowHeight(row,24); row++;

    stats.zamenaList.forEach(function(z,idx) {
      sheet.getRange(row,1,1,4).merge().setValue(z.asl).setHorizontalAlignment('left').setFontSize(10);
      sheet.getRange(row,5,1,4).merge().setValue('→ '+z.zamena).setFontColor('#6a1b9a').setFontSize(10);
      sheet.getRange(row,9,1,2).merge().setValue(z.miqdor).setNumberFormat('#,##0.##').setHorizontalAlignment('right');
      sheet.getRange(row,11,1,2).merge().setValue(z.holat).setHorizontalAlignment('center').setFontSize(10);
      sheet.getRange(row,1,1,COLS).setBackground(idx%2===0?'#faf5ff':'#ffffff');
      sheet.setRowHeight(row,26); row++;
    });
    sheet.setRowHeight(row,16); row++;
  }

  // ══════════════════════════════════════════════════════════
  // 📅 OXIRGI FAOLIYAT
  // ══════════════════════════════════════════════════════════
  if (stats.recentActivity && stats.recentActivity.length>0) {
    sheet.getRange(row,1,1,COLS).merge()
      .setValue('📅 OXIRGI FAOLIYAT')
      .setBackground('#00695c').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');
    sheet.setRowHeight(row,30); row++;

    sheet.getRange(row,1,1,2).merge().setValue('Sana').setBackground('#e0f2f1').setFontWeight('bold');
    sheet.getRange(row,3,1,4).merge().setValue('Material').setBackground('#e0f2f1').setFontWeight('bold');
    sheet.getRange(row,7,1,2).merge().setValue('Qabul').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(row,9,1,2).merge().setValue('Jami/Plan').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.getRange(row,11,1,2).merge().setValue('Holat').setBackground('#e0f2f1').setFontWeight('bold').setHorizontalAlignment('center');
    sheet.setRowHeight(row,24); row++;

    stats.recentActivity.forEach(function(a,idx) {
      sheet.getRange(row,1,1,2).merge().setValue(a.sana).setNumberFormat('dd.MM').setHorizontalAlignment('center').setFontSize(10);
      sheet.getRange(row,3,1,4).merge().setValue(a.mat).setHorizontalAlignment('left').setFontSize(10);
      sheet.getRange(row,7,1,2).merge().setValue(a.qabul).setNumberFormat('#,##0.##').setHorizontalAlignment('right');
      sheet.getRange(row,9,1,2).merge().setValue(a.jamiPlan).setHorizontalAlignment('center').setFontSize(10);
      sheet.getRange(row,11,1,2).merge().setValue(a.holat).setHorizontalAlignment('center').setFontSize(10);
      sheet.getRange(row,1,1,COLS).setBackground(idx%2===0?'#f0faf8':'#ffffff');
      sheet.setRowHeight(row,26); row++;
    });
    sheet.setRowHeight(row,16); row++;
  }

  // ── YORDAM ──────────────────────────────────────────────
  sheet.getRange(row,1,1,COLS).merge()
    .setValue('💡 Material kelganda: NAZORAT → "Qabul qilingan" ustuniga miqdor yozsangiz, Viborka avtomatik to\'ladi')
    .setBackground('#fff9c4').setFontColor('#5f4339')
    .setFontStyle('italic').setHorizontalAlignment('center');
  sheet.setRowHeight(row,28);
}

// ════════════════════════════════════════════════════════════
function _drawKpi(sheet,row,col,icon,value,label,bgColor) {
  var dv=(typeof value==='string')?value:_fmt(value);
  sheet.getRange(row,col,1,3).merge().setValue(icon+'  '+dv)
    .setBackground(bgColor).setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(22)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.getRange(row+1,col,1,3).merge().setValue(label)
    .setBackground(bgColor).setFontColor('#ffffff')
    .setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle');
}

function _drawBtn(sheet,row,col,icon,title,sub,bgColor,fnName) {
  sheet.getRange(row,col,3,3).merge()
    .setValue(icon+'\n'+title+'\n'+sub)
    .setBackground(bgColor).setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(12)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setNote('👆 ⚡ TITAN PRO → '+title+'\nFunksiya: '+fnName);
}

// ════════════════════════════════════════════════════════════
// STATISTIKA
// ════════════════════════════════════════════════════════════
function _calcStats(ss) {
  var cache = CacheService.getDocumentCache();
  var cached = cache.get("VIBORKA_STATS");
  if (cached) {
    try { return JSON.parse(cached); } catch(e) {}
  }

  var stats = {
    totalMaterials:0,deficitCount:0,closedCount:0,overCount:0,
    totalPlan:0,totalKeldi:0,totalSmeta:0,totalFakt:0,
    prixodCount:0,zamenaCount:0,
    topDeficits:[],objectProgress:[],zamenaList:[],recentActivity:[]
  };

  var src=ss.getSheetByName('Viborka_Shablon');
  if (!src) return stats;
  var lastRow=src.getLastRow();
  if (lastRow<2) return stats;

  var data=src.getRange(2,1,lastRow-1,16).getValues();
  var grouped={};
  var objectMap={};
  var lastBase='';

  data.forEach(function(row) {
    var objName=String(row[1]).trim();
    var rawMat=String(row[5]).trim();
    if (!rawMat||rawMat==='0') return;
    var resolved=(typeof resolveDitto==='function')?resolveDitto(rawMat,lastBase):rawMat;
    lastBase=resolved;
    var marka=String(row[6]).trim();
    var full=resolved+(marka&&marka!=='0'&&marka!==resolved?' '+marka:'');
    var clean=(typeof AI_NormalizeName==='function')?AI_NormalizeName(full):full;
    var ed=(typeof normalizeUnit==='function')?normalizeUnit(String(row[7]).trim()):String(row[7]).trim();
    var plan=_r3hp(row[8]);
    var fakt=_r3hp(row[9]);
    var sSm=_r3hp(row[12]);
    var sFa=_r3hp(row[13]);

    var key=clean+'||'+ed;
    if (!grouped[key]) grouped[key]={mat:clean,ed:ed,plan:0,fakt:0,sSm:0,sFa:0};
    grouped[key].plan=_r3hp(grouped[key].plan+plan);
    grouped[key].fakt=_r3hp(grouped[key].fakt+fakt);
    grouped[key].sSm =_r3hp(grouped[key].sSm+sSm);
    grouped[key].sFa =_r3hp(grouped[key].sFa+sFa);

    if (objName&&objName!=='0') {
      if (!objectMap[objName]) objectMap[objName]={plan:0,fakt:0};
      objectMap[objName].plan=_r3hp(objectMap[objName].plan+plan);
      objectMap[objName].fakt=_r3hp(objectMap[objName].fakt+fakt);
    }
  });

  // Nazorat
  var nazSheet=ss.getSheetByName('Nazorat');
  if (nazSheet) {
    var nazLast=nazSheet.getLastRow();
    if (nazLast>=2) {
      var nazData=nazSheet.getRange(2,1,nazLast-1,14).getValues();
      var sevenDaysAgo=new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);

      nazData.forEach(function(r) {
        var mat=String(r[1]).trim();
        var bir=String(r[2]).trim();
        var plan=_r3hp(r[3]);
        var qabul=_r3hp(r[4]);
        var zamena=String(r[13]).trim();
        var sana=r[9];
        var holat=String(r[12]).trim();

        if (qabul>0) { stats.prixodCount++; stats.totalKeldi=_r3hp(stats.totalKeldi+qabul); }

        if (zamena) {
          stats.zamenaCount++;
          stats.zamenaList.push({asl:mat,zamena:zamena,miqdor:qabul,holat:holat||'—'});
        }

        if (sana&&qabul>0) {
          var d=(sana instanceof Date)?sana:new Date(sana);
          if (!isNaN(d.getTime())&&d>=sevenDaysAgo) {
            stats.recentActivity.push({
              sana:d, mat:mat+' ('+bir+')', qabul:qabul,
              jamiPlan:_fmtShort(qabul)+' / '+_fmtShort(plan),
              holat:holat||'—', timestamp:d.getTime()
            });
          }
        }
      });

      stats.recentActivity.sort(function(a,b){return b.timestamp-a.timestamp;});
      stats.recentActivity=stats.recentActivity.slice(0,10);
    }
  }

  var deficits=[];
  Object.keys(grouped).forEach(function(k) {
    var g=grouped[k];
    stats.totalMaterials++;
    stats.totalSmeta=_r3hp(stats.totalSmeta+g.sSm);
    stats.totalFakt =_r3hp(stats.totalFakt+g.sFa);
    stats.totalPlan =_r3hp(stats.totalPlan+g.plan);
    var pctVal=g.plan>0?(g.fakt/g.plan):0;
    if (g.plan>0&&g.fakt>g.plan*1.20) stats.overCount++;
    else if (pctVal>=0.98&&g.plan>0) stats.closedCount++;
    else if (g.plan-g.fakt>0) {
      stats.deficitCount++;
      deficits.push({mat:g.mat,ed:g.ed,qoldiq:_r3hp(g.plan-g.fakt)});
    }
  });

  deficits.sort(function(a,b){return b.qoldiq-a.qoldiq;});
  stats.topDeficits=deficits.slice(0,5);

  Object.keys(objectMap).sort(function(a,b) {
    var pA=objectMap[a].plan>0?objectMap[a].fakt/objectMap[a].plan:0;
    var pB=objectMap[b].plan>0?objectMap[b].fakt/objectMap[b].plan:0;
    return pB-pA;
  }).forEach(function(name) {
    var o=objectMap[name];
    if (o.plan>0) stats.objectProgress.push({name:name,plan:o.plan,fakt:o.fakt});
  });

  try { cache.put("VIBORKA_STATS", JSON.stringify(stats), 900); } catch(e) {}

  return stats;
}

function _r3hp(n) {
  var v=parseFloat(String(n).replace(/,/g,'.').replace(/\s/g,''));
  return (isNaN(v)||!isFinite(v))?0:Math.round(v*100)/100;
}
function _fmt(n) {
  if (n===0||!n) return '0';
  if (n>=1e6) return (n/1e6).toFixed(1).replace(/\.0$/,'')+'M';
  if (n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'')+'K';
  return String(Math.round(n));
}
function _fmtShort(n) {
  if (n===0||!n) return '0';
  if (n>=1e3) return (n/1e3).toFixed(1).replace(/\.0$/,'')+'K';
  return String(Math.round(n*100)/100);
}