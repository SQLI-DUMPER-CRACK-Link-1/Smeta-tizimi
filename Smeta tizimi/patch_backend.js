const fs = require('fs');
const file = 'c:\\Users\\PC\\Documents\\GAS\\Smeta tizimi\\35_F2Moslash.js';
let content = fs.readFileSync(file, 'utf8');

// Replace findUnique calls with pickUnique
content = content.replace(/sMatch = findUnique/g, 'sMatch = pickUnique');

// Modify pickUnique to not use _ekvivmi
content = content.replace(
  `return _ekvivmi(ok) ? _birinchiBosh(ok) : null;`,
  `return _birinchiBosh(ok); // Yanada kuchaytirildi: bir xil qatorlar orasidan birinchisini olish`
);

fs.writeFileSync(file, content);
console.log("Patched 35_F2Moslash.js");
