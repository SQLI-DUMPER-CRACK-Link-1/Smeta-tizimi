const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestXarita.tsx', 'utf8');

// Use 'Yangi O'zbekiston' or 'Yangi bino' since they exist in the screenshot
code = code.replace(
  /t\.nom\.includes\('Amfiteatr'\)/g,
  `t.nom.includes('Yangi')`
);

fs.writeFileSync('frontend/src/test02/TestXarita.tsx', code);
console.log('Updated mock to match Yangi');
