const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.tsx', 'utf8');
c = "import TestGantt from './test02/TestGantt';\nimport TestDidox from './test02/TestDidox';\n" + c;
fs.writeFileSync('frontend/src/App.tsx', c);
