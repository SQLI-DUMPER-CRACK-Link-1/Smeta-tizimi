const fs = require('fs');
const path = require('path');

const srcDir = './frontend/src/api';
const sbYozPath = './frontend/functions/api/sb-yoz.ts';
const sbPath = './frontend/functions/api/sb.ts';

// 1. Read sb-yoz.ts to get AMALLAR keys
const sbYozContent = fs.readFileSync(sbYozPath, 'utf8');
const amallarRegex = /AMALLAR\s*=\s*\{([\s\S]*?)\}\s*as\s*const;/m;
const amallarMatch = sbYozContent.match(amallarRegex);
const allowedAmallar = [];
if (amallarMatch) {
  const lines = amallarMatch[1].split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
    if (match) allowedAmallar.push(match[1]);
  }
}

// 2. Read sb.ts to get RUXSAT_JADVALLAR keys
const sbContent = fs.readFileSync(sbPath, 'utf8');
const tablesRegex = /RUXSAT_JADVALLAR\s*=\s*\[([\s\S]*?)\];/m;
const tablesMatch = sbContent.match(tablesRegex);
const allowedTables = [];
if (tablesMatch) {
  const elements = tablesMatch[1].match(/'([^']+)'/g);
  if (elements) {
    allowedTables.push(...elements.map(e => e.replace(/'/g, '')));
  }
}

let errors = [];

// 3. Scan src/api/*.ts files for yozAmali and fetch calls
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts'));
for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  
  // Check yozAmali { amal: 'X' }
  const yozMatches = content.matchAll(/amal:\s*['"]([^'"]+)['"]/g);
  for (const match of yozMatches) {
    const amal = match[1];
    // Some amals are dynamic like 	izim_\ or erp_\. Handle interpolations.
    if (!amal.includes('$') && !allowedAmallar.includes(amal)) {
      errors.push(\[Yoz] File \ calls yozAmali with unregistered amal: '\'\);
    }
  }

  // Check fetch('/api/sb', ... { jadval: 'X' })
  const readMatches = content.matchAll(/jadval:\s*['"]([^'"]+)['"]/g);
  for (const match of readMatches) {
    const jadval = match[1];
    if (!allowedTables.includes(jadval)) {
      errors.push(\[O'qish] File \ tries to read unregistered jadval: '\'\);
    }
  }
}

if (errors.length > 0) {
  console.log('XATOLAR TOPILDI:\\n', errors.join('\\n'));
  process.exit(1);
} else {
  console.log('Hamma mantiqiy bog\\'lanishlar (jadval va amallar) to\\'g\\'ri!');
}
