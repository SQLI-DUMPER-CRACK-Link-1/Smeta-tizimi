const fs = require('fs');
const path = require('path');

const srcDir = './frontend/src/api';
const sbYozPath = './frontend/functions/api/sb-yoz.ts';
const sbPath = './frontend/functions/api/sb.ts';

const sbYozContent = fs.readFileSync(sbYozPath, 'utf8');
const allowedAmallar = [];
const amallarMatch = sbYozContent.match(/AMALLAR\s*=\s*\{([\s\S]*?)\}\s*as\s*const/m);
if (amallarMatch) {
  for (const line of amallarMatch[1].split('\n')) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+)\s*:/);
    if (m) allowedAmallar.push(m[1]);
  }
}

const sbContent = fs.readFileSync(sbPath, 'utf8');
const allowedTables = [];
const tablesMatch = sbContent.match(/RUXSAT_JADVALLAR\s*=\s*new Set\(\[([\s\S]*?)\]\)/m);
if (tablesMatch) {
  const elements = tablesMatch[1].match(/'([^']+)'/g);
  if (elements) allowedTables.push(...elements.map(e => e.replace(/'/g, '')));
}

let errors = [];
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts'));
for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  
  for (const m of content.matchAll(/amal:\s*['"]([^'"]+)['"]/g)) {
    const amal = m[1];
    // We already fixed t2-grafik and t2-hisobot string concatenation. But they might still have mal: 'grafik_' + amal and my regex doesn't parse JS perfectly.
    // If it's literally just a word, check it.
    if (!amal.includes('$') && !amal.endsWith('_') && !allowedAmallar.includes(amal)) {
      errors.push('[Yoz] File ' + file + ' calls unregistered amal: ' + amal);
    }
  }

  for (const m of content.matchAll(/jadval:\s*['"]([^'"]+)['"]/g)) {
    const jadval = m[1];
    if (!allowedTables.includes(jadval)) {
      errors.push('[Read] File ' + file + ' calls unregistered jadval: ' + jadval);
    }
  }
}

if (errors.length > 0) {
  console.log('XATOLAR TOPILDI:\n' + errors.join('\n'));
  process.exit(1);
} else {
  console.log('Jadval va RPC bog\'lanishlari toza!');
}
