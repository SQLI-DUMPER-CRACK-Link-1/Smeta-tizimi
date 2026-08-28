const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestZayavka.tsx', 'utf8');
code = code.replace(/\\\`/g, '`');
code = code.replace(/\\\$/g, '$');
fs.writeFileSync('frontend/src/test02/TestZayavka.tsx', code);
