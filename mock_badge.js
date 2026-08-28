const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestXarita.tsx', 'utf8');

// Inject mock badge logic for Amfiteatr
code = code.replace(
  /\{\(t\.meta\?\.zayavka \|\| t\.meta\?\.bildirishnoma\) && \(/,
  `{(t.meta?.zayavka || t.meta?.bildirishnoma || (t.tur === 'obyekt' && t.nom.includes('Amfiteatr'))) && (`
);

code = code.replace(
  /\{t\.meta\.zayavka \|\| t\.meta\.bildirishnoma\}/,
  `{t.meta.zayavka || t.meta.bildirishnoma || (t.tur === 'obyekt' && t.nom.includes('Amfiteatr') ? '90m parog (Zayavka)' : '')}`
);

fs.writeFileSync('frontend/src/test02/TestXarita.tsx', code);
console.log('TestXarita.tsx mock badge injected');
