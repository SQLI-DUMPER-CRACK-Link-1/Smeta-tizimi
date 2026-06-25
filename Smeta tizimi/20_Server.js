/********************************************************************
 * 20_Server.gs — MARKAZIY SERVER (DASHBOARD)
 * ------------------------------------------------------------------
 * 2-qavatli arxitektura QAVAT 1:
 *   Har obyektning LRV_PLUS faylidan jami (smeta + 6 kat) hisoblab,
 *   markaziy DASHBOARD ga obyekt qatorini yozadi.
 *
 *   serverYozFile(obyekt, plusSS, a) — engine ichidan avtomat chaqiriladi
 *   serverYigPapka()                  — menyu: butun papkani qayta yig'adi
 ********************************************************************/

var SRV = {
  HDR: ['ОБЪЕКТ','СМЕТА','ЧЕЛ','МАШ','МАТ','ОБ','М/К','КАБ',
        'ФАКТ','Ф2 ОЛИНГАН','Ф2 ҚОЛДИҚ','ЛИФ','ЯНГИЛАНДИ']
};

/* ====== Engine ichidan: bitta obyekt LRV_PLUS dan jami → server ====== */
function serverYozFile(obyekt, plusSS, a){
  var srv = _serverSS(a);
  var dash = _dash(srv);

  // LRV_PLUS leaf (rs+mat) qatorlardan jami (hisoblangan qiymatlar)
  var sheets=plusSS.getSheets();
  var col=CFG.C, smeta=0, cats=[0,0,0,0,0,0,0], faktPul=0, f2Pul=0, ostPul=0, leaf=0;
  for(var s=0;s<sheets.length;s++){
    var nm=sheets[s].getName();
    if(nm.indexOf(CFG.LRV_SHEET)!==0) continue;
    var sh=sheets[s], last=sh.getLastRow();
    if(last<2) continue;
    // I (marker) .. AC (stoimost ostatka) — bitta o'qishda hammasi
    var width=col.ST_OST-col.MARKER+1;            // I..AC
    var g=sh.getRange(1,col.MARKER,last,width).getValues();
    var iMark=0;
    var iChel=col.CHEL-col.MARKER, iMash=col.MASH-col.MARKER, iMat=col.MAT-col.MARKER,
        iOb=col.OB-col.MARKER, iBez=col.BEZSKLAD-col.MARKER, iMk=col.MK-col.MARKER, iKab=col.KAB-col.MARKER;
    var iZ=col.ST_RES-col.MARKER, iAA=col.ST_FAKT-col.MARKER, iAB=col.ST_F2-col.MARKER, iAC=col.ST_OST-col.MARKER;
    for(var i=0;i<g.length;i++){
      var m=String(g[i][iMark]||'').trim().toLowerCase();
      if(m!=='rs'&&(m !== 'mat' && m !== 'ob') ) continue;
      leaf++;
      smeta+=_n(g[i][iZ]);                         // Z = smeta summa
      faktPul+=_n(g[i][iAA]);                      // AA = fakt summa
      f2Pul+=_n(g[i][iAB]);                        // AB = F2 summa
      ostPul+=_n(g[i][iAC]);                       // AC = ostatka summa
      // 7 kategoriya (smeta bo'yicha)
      cats[0]+=_n(g[i][iChel]); cats[1]+=_n(g[i][iMash]); cats[2]+=_n(g[i][iMat]);
      cats[3]+=_n(g[i][iOb]); cats[4]+=_n(g[i][iBez]); cats[5]+=_n(g[i][iMk]); cats[6]+=_n(g[i][iKab]);
    }
  }

  var stamp=Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'Asia/Tashkent','yyyy-MM-dd HH:mm');
  // ЧЕЛ МАШ МАТ ОБ М/К КАБ (БЕЗ СКЛАД ni alohida ko'rsatmaymiz, MAT ichida)
  var row=[obyekt, smeta, cats[0],cats[1],cats[2],cats[3],cats[5],cats[6],
           faktPul, f2Pul, ostPul, leaf, stamp];
  _upsert(dash, obyekt, row);
  _jami(dash); _fmt(dash);
  SpreadsheetApp.flush();
}

/* ====== Butun papkani qayta yig'ish (LRV_PLUS lar mavjud) ======
 * Natijani qaytaradi — getUi faqat menyu kontekstida (try-catch). */
function serverYigPapka(){
  var a=sozAsosiy(), obs=papkaSkan(), done=0, miss=[];
  for(var i=0;i<obs.length;i++){
    var nm=obs[i].obyekt+CFG.PLUS_SUF;
    var folder=DriveApp.getFolderById(obs[i].folderId);
    var fit=folder.getFilesByName(nm);
    if(!fit.hasNext()){ miss.push(obs[i].obyekt); continue; }
    var plus=SpreadsheetApp.openById(fit.next().getId());
    serverYozFile(obs[i].obyekt, plus, a);
    done++;
  }
  // RECONCILE: skanda yo'q (yetim) qatorlarni tozalash — obyekt bo'linganda/o'chganda/
  // qayta nomlanganda eski qator JAMI ni shishirmasin. Xavfsizlik: skan bo'sh bo'lsa tegmaymiz.
  if(obs.length){
    var valid={}; for(var k=0;k<obs.length;k++) valid[String(obs[k].obyekt).trim()]=1;
    try{ _dashOrphanTozala(_serverSS(a), valid); }catch(e){ Logger.log('orphan tozalash: '+e); }
  }
  var srv=_serverSS(a);
  var xabar='Server yig\'ildi: '+done+' obyekt.'
    +(miss.length?(' LRV_PLUS yo\'q: '+miss.join(', ')):'');
  try{
    SpreadsheetApp.getUi().alert(xabar+'\n\nDASHBOARD: '+srv.getUrl());
  }catch(e){}
  return {ok:true, done:done, miss:miss, xabar:xabar, url:srv.getUrl()};
}


/* ====== Server faylini ochish/yaratish ====== */
function _serverSS(a){
  if(a.serverId){
    try { return SpreadsheetApp.openById(a.serverId); } catch(e){}
  }
  // ROOT papkada DASHBOARD fayli (auto)
  var root=DriveApp.getFolderById(a.rootId);
  var ex=root.getFilesByName('_SERVER_DASHBOARD');
  if(ex.hasNext()) return SpreadsheetApp.openById(ex.next().getId());
  var ss=SpreadsheetApp.create('_SERVER_DASHBOARD');
  var file=DriveApp.getFileById(ss.getId());
  root.addFile(file); try{ DriveApp.getRootFolder().removeFile(file); }catch(e){}
  return ss;
}

function _dash(srv){
  var d=srv.getSheetByName(CFG.DASH);
  if(!d){ d=srv.insertSheet(CFG.DASH); _hdr(d); _ochSheet1(srv); }
  else if(d.getLastRow()<1) _hdr(d);
  return d;
}
function _hdr(d){
  d.getRange(1,1,1,SRV.HDR.length).setValues([SRV.HDR])
   .setFontWeight('bold').setBackground('#1f4e79').setFontColor('#ffffff').setWrap(true);
  d.setFrozenRows(1);
}
function _ochSheet1(srv){
  var sh=srv.getSheetByName('Sheet1')||srv.getSheetByName('Лист1');
  if(sh && srv.getSheets().length>1){ try{srv.deleteSheet(sh);}catch(e){} }
}

/* ====== Yetim (orphaned) dashboard qatorlarini tozalash ======
 * valid = {obyekt nomi: 1} — hozir skanda mavjud obyektlar. Ro'yxatда YO'Q qatorlar
 * (bo'lingan/o'chgan/qayta nomlangan) o'chiriladi → JAMI shishmaydi. ЖАМИ saqlanadi. */
function _dashOrphanTozala(srv, valid){
  var dash=_dash(srv), last=dash.getLastRow(); if(last<2) return;
  var keys=dash.getRange(2,1,last-1,1).getValues(), oldur=false;
  for(var r=keys.length-1;r>=0;r--){
    var k=String(keys[r][0]||'').trim();
    if(!k || k.toUpperCase()==='ЖАМИ') continue;
    if(!valid[k]){ dash.deleteRow(r+2); oldur=true; }
  }
  if(oldur) _jami(dash);
}

/* ====== upsert: obyekt qatorini yangilash yoki qo'shish ====== */
function _upsert(dash, obyekt, row){
  var last=dash.getLastRow(), found=0;
  if(last>=2){
    var keys=dash.getRange(2,1,last-1,1).getValues();
    for(var r=0;r<keys.length;r++){
      var k=String(keys[r][0]).trim();
      if(k===obyekt){ found=r+2; break; }
    }
  }
  if(found) dash.getRange(found,1,1,row.length).setValues([row]);
  else      dash.appendRow(row);
}

/* ====== ЖАМИ qatori ====== */
function _jami(dash){
  var last=dash.getLastRow();
  if(last>=2){
    var fc=dash.getRange(2,1,last-1,1).getValues();
    for(var r=fc.length-1;r>=0;r--)
      if(String(fc[r][0]).trim().toUpperCase()==='ЖАМИ'){ dash.deleteRow(r+2); break; }
  }
  last=dash.getLastRow(); if(last<2) return;
  var L=_cl, jami=['ЖАМИ'];
  for(var c=2;c<=11;c++) jami.push('=SUM('+L(c)+'2:'+L(c)+last+')');  // СМЕТА..Ф2 ҚОЛДИҚ
  jami.push(''); jami.push('');
  dash.appendRow(jami);
}
function _fmt(dash){
  var last=dash.getLastRow(); if(last<2) return;
  dash.getRange(2,2,last-1,10).setNumberFormat('#,##0');
  var fc=dash.getRange(2,1,last-1,1).getValues();
  for(var r=0;r<fc.length;r++)
    if(String(fc[r][0]).trim().toUpperCase()==='ЖАМИ'){
      dash.getRange(r+2,1,1,SRV.HDR.length).setFontWeight('bold').setBackground('#ffe599'); break;
    }
  dash.autoResizeColumns(1,SRV.HDR.length);
}

function _n(v){
  if(v===''||v===null||v===undefined) return 0;
  if(typeof v==='number') return v;
  var f=parseFloat(String(v).replace(/\s/g,'').replace(/,/g,'.')); return isNaN(f)?0:f;
}
