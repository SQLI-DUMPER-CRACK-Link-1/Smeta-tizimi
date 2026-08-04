/* ============ M-29 YUKLASH ============ */
function apiM29Yarat(obyekt, oyNom){
  try {
    var d = apiHolatOl(obyekt);
    if(!d || !d.tree) throw 'Obyekt daraxti (Smeta) topilmadi!';
    
    var ss = SpreadsheetApp.create('M-29: ' + obyekt + ' (' + oyNom + ')');
    var sh = ss.getActiveSheet();
    
    // Header
    sh.appendRow([
      '№', 'Иш номи (Блок)', 'Иш бирлиги', 'Ойлик Ф-2 ҳажми',
      'Материал / Ресурс номи', 'Материал бирлиги', 'Материал тоифаси',
      'Норма (бирлик учун)', 'Ф-2 даги Жами Сарф'
    ]);
    sh.getRange('A1:I1').setFontWeight('bold').setBackground('#1e293b').setFontColor('white');
    sh.setFrozenRows(1);
    
    var mData = [];
    var tree = d.tree;
    var rowIdx = 1;
    
    for(var i=0; i<tree.length; i++){
      var n = tree[i];
      if(n.type === 'bl'){
         var oyHajm = (n.oylar && n.oylar[oyNom]) ? parseFloat(n.oylar[oyNom]) : 0;
         if(oyHajm > 0 && n.children && n.children.length > 0){
            var ishNom = n.nom;
            var ishBirlik = n.birlik;
            var ishSmeta = n.smetaHajm > 0 ? n.smetaHajm : 1;
            
            for(var j=0; j<n.children.length; j++){
               var r = n.children[j];
               // faqat material, mexanizm
               if(r.kat === 'ЧЕЛ' || r.kat === 'ОБ') continue; // Ishchilar va oborudovaniye kirmaydi M-29 ga
               
               var matNom = r.nom;
               var matBirlik = r.birlik;
               var matSmeta = r.smetaHajm || 0;
               var kat = r.kat || 'МАТ';
               
               // norma
               var norm = matSmeta / ishSmeta;
               var sarf = oyHajm * norm;
               
               if(sarf > 0.0001) {
                 mData.push([
                   rowIdx++, ishNom, ishBirlik, oyHajm,
                   matNom, matBirlik, kat, norm, sarf
                 ]);
               }
            }
         }
      }
    }
    
    if(mData.length > 0){
      sh.getRange(2, 1, mData.length, mData[0].length).setValues(mData);
    } else {
       sh.appendRow(['', 'Бу ойда ҳеч қандай ресурс сарфи топилмади']);
    }
    
    // Formatlash
    sh.setColumnWidth(2, 300);
    sh.setColumnWidth(5, 300);
    sh.getRange('D:D').setNumberFormat('#,##0.000');
    sh.getRange('H:I').setNumberFormat('#,##0.000');
    
    return { ok: true, url: ss.getUrl() };
  } catch(e) {
    return { ok: false, xabar: String(e.message || e) };
  }
}
