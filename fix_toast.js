const fs = require('fs');

const files = [
  'frontend/src/test02/TestFakt.tsx',
  'frontend/src/test02/TestKontragent.tsx',
  'frontend/src/test02/TestXodimlarRollar.tsx'
];

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/'success'/g, "'ok'");
  content = content.replace(/"success"/g, '"ok"');
  content = content.replace(/'info'/g, "'ok'");
  content = content.replace(/"info"/g, '"ok"');
  fs.writeFileSync(f, content);
});

console.log('done toast fix');
