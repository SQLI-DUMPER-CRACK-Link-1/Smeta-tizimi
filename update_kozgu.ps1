$file = 'Smeta tizimi\T2_Kozgu.js'
$content = Get-Content $file -Raw -Encoding UTF8

# 1. Insert _t2HolatlarOl
$qatorlarOlCode = "function _t2QatorlarOl(obyektId){"
$holatlarOlCode = "function _t2HolatlarOl(obyektId){`n  var hammasi = [], offset = 0, SAHIFA = 1000;`n  for(var qadam = 0; qadam < 100; qadam++){`n    var bolak = _t2Get('t2_qator_holat?obyekt_id=eq.' + obyektId + '&limit=' + SAHIFA + '&offset=' + offset);`n    if(!bolak.length) break;`n    hammasi = hammasi.concat(bolak);`n    if(bolak.length < SAHIFA) break;`n    offset += bolak.length;`n  }`n  return hammasi;`n}`n`n"
$content = $content.Replace($qatorlarOlCode, $holatlarOlCode + $qatorlarOlCode)

# 2. Merge holatlar in apiT2VaraqYarat
$xaritaLoop = "for(i = 0; i < qatorlar.length; i++) xarita[qatorlar[i].id] = qatorlar[i];"
$holatlarMerge = "    var holatlar = _t2HolatlarOl(ob.id);`n    var holatXarita = {};`n    for(var hi = 0; hi < holatlar.length; hi++) holatXarita[holatlar[hi].qator_id] = holatlar[hi];`n    `n    for(i = 0; i < qatorlar.length; i++) {`n      var h = holatXarita[qatorlar[i].id];`n      if(h) {`n        qatorlar[i].fakt_hajm = h.fakt_hajm; qatorlar[i].fakt_summa = h.fakt_summa;`n        qatorlar[i].qoldiq_hajm = h.qoldiq_hajm; qatorlar[i].qoldiq_summa = h.qoldiq_summa;`n      }`n      xarita[qatorlar[i].id] = qatorlar[i];`n    }"
$content = $content.Replace($xaritaLoop, $holatlarMerge)

# 3. Add columns to USTUNLAR
$ustun = "'_id', '_v'"
$ustunNew = "'F2 HAJM', 'F2 SUMMA', 'QOLDIQ HAJM', 'QOLDIQ SUMMA', '_id', '_v'"
$content = $content.Replace($ustun, $ustunNew)
$content = $content.Replace("var KO_RINADI = 13", "var KO_RINADI = 17")
$content = $content.Replace("var C_ID = 14, C_VER = 15;", "var C_F2_HAJM = 14, C_F2_SUM = 15, C_QOLD_HAJM = 16, C_QOLD_SUM = 17; var C_ID = 18, C_VER = 19;")

# 4. Push F2 data to qator array
$idSet = "qator[C_ID - 1]  = r.id;"
$f2Set = "      qator[C_F2_HAJM - 1] = (r.fakt_hajm == null) ? '' : Number(r.fakt_hajm);`n      qator[C_F2_SUM - 1]  = (r.fakt_summa == null) ? '' : Number(r.fakt_summa);`n      qator[C_QOLD_HAJM - 1] = (r.qoldiq_hajm == null) ? '' : Number(r.qoldiq_hajm);`n      qator[C_QOLD_SUM - 1]  = (r.qoldiq_summa == null) ? '' : Number(r.qoldiq_summa);`n      `n      qator[C_ID - 1]  = r.id;"
$content = $content.Replace($idSet, $f2Set)

Set-Content -Path $file -Value $content -Encoding UTF8
