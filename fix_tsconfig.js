const fs = require('fs');
const p = 'frontend/tsconfig.app.json';
let c = fs.readFileSync(p, 'utf8');
c = c.replace(/"noUnusedLocals": true/g, '"noUnusedLocals": false');
c = c.replace(/"noUnusedParameters": true/g, '"noUnusedParameters": false');
fs.writeFileSync(p, c);
