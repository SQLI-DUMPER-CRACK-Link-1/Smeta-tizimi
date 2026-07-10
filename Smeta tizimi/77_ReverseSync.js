/******************************************************************
 * 77_ReverseSync.js — TASHQI TIZIMLARDAN FAKT/SMETA YANGILASH
 * ==================================================================
 * Webhook (doPost) orqali kiritilgan ishlarning hajmini Smetada 
 * to'g'ridan-to'g'ri yangilash uchun ishlatiladi (Masalan, Akt Generator)
 ******************************************************************/

function apiFaktSinxron(obyekt, rows){
  var col = CFG.C;
  var plus = _plusTop(obyekt);
  if(!plus) return {ok:false, xabar:'Obyekt topilmadi'};

  var jami = 0;
  var byV = {};
  for(var i=0; i<rows.length; i++){
    var v = rows[i].varaq;
    if(!v) continue;
    byV[v] = byV[v] || [];
    byV[v].push(rows[i]);
  }

  for(var v in byV){
    var sh = plus.getSheetByName(v);
    if(!sh) continue;
    var maxR = sh.getLastRow();
    
    byV[v].forEach(function(r){
      if(r.row > maxR || r.row < 2) return;
      var curFakt = parseFloat(sh.getRange(r.row, col.FAKT).getValue()) || 0;
      var newFakt = curFakt + (parseFloat(r.hajmQosh)||0);
      sh.getRange(r.row, col.FAKT).setValue(newFakt);
      jami++;
    });
  }
  
  _holatInvalidate(obyekt);
  try { serverYozFile(obyekt, plus, sozAsosiy()); } catch(e){}
  
  return {ok:true, jami:jami, xabar:'FAKT ' + jami + ' ta qatorga qo\'shildi'};
}
