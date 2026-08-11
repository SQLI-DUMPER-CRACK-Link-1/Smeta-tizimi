const fs = require('fs');
const file = 'c:\\Users\\PC\\Documents\\GAS\\Smeta tizimi\\35_F2Moslash.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add takliflar
content = content.replace(
  `var rzDiag    = [];`,
  `var rzDiag    = [];\n  var takliflar = {};`
);

content = content.replace(
  `return {mosliklar: mosliklar, sabablar: sabablar, rzDiag: rzDiag, stat: st};`,
  `return {mosliklar: mosliklar, sabablar: sabablar, rzDiag: rzDiag, stat: st, takliflar: takliflar};`
);

// 2. Remove _f2mLokalkaAniqla inside f2MoslashEngine
content = content.replace(
  `  var lokAuto = false;\n  if (!lok){\n    var det = _f2mLokalkaAniqla(aktTree, lrvTree);\n    if (det.best && det.ball >= 5){ lok = det.best; lokAuto = true; }\n  }`,
  `  var lokAuto = false;\n  // REMOVED: Tizim avtomatik lokalka tanlamaydi, global qidiruv uchun barchasi ochiq qoladi.`
);

// Helper function to insert takliflar generation logic
const taklifStr = `
      var ts = [];
      if (scope && fk) ts.push.apply(ts, (scope.byKod[fk] || []).filter(leafFilter));
      if (scope && fkan) ts.push.apply(ts, ((scope.byKanon || {})[fkan] || []).filter(leafFilter));
      if (scope) ts.push.apply(ts, (scope.byNomBir[nb] || []).filter(leafFilter));
      if (!qatiy && fk) ts.push.apply(ts, (byKod[fk] || []).filter(leafFilter));
      if (!qatiy && fkan) ts.push.apply(ts, (byKanon[fkan] || []).filter(leafFilter));
      if (!qatiy) ts.push.apply(ts, (byNomBir[nb] || []).filter(leafFilter));
      var uniq = [], map = {};
      for(var i=0; i<ts.length; i++) {
        var c = ts[i];
        if(!smetaTaken(c.varaq, c.row)) {
          var k = c.varaq+'#'+c.row;
          if(!map[k]) { map[k]=1; uniq.push(c); }
        }
      }
      if(uniq.length>0) takliflar[fNode.uid] = uniq;
`;

// 3. processStandalone
content = content.replace(
  `else { st.otkazib++; sababYoz(fNode.uid, fk, nb); }`,
  `else { st.otkazib++; sababYoz(fNode.uid, fk, nb);` + taklifStr + `}`
);

// 4. processBl
content = content.replace(
  `st.otkazib++; sababYoz(fBl.uid, kK, nbBl);`,
  `st.otkazib++; sababYoz(fBl.uid, kK, nbBl);\n` + taklifStr.replace(/fk/g, 'kK').replace(/fkan/g, 'kanBl').replace(/nb/g, 'nbBl').replace(/fNode\.uid/g, 'fBl.uid')
);

fs.writeFileSync(file, content);
console.log("Patched 35_F2Moslash.js");
