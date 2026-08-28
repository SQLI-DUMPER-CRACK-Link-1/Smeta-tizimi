const fs = require('fs');
const path = require('path');

const fixFmtN = (content) => {
  return content.replace(/\{FmtN\(([^)]+)\)\}/g, '<FmtN val={$1} />');
};

const dir = path.join(__dirname, 'frontend/src/test02');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const fp = path.join(dir, file);
  let content = fs.readFileSync(fp, 'utf8');
  let orig = content;
  
  // Fix FmtN
  content = fixFmtN(content);
  
  // Specifically for TestTizim.tsx AuditLog type errors
  if (file === 'TestTizim.tsx') {
    content = content.replace(/log: AuditLog/g, 'log: any');
  }

  if (file === 'TestInvite.tsx') {
    content = content.replace(/<Clock /g, '<Lock ');
  }

  if (orig !== content) {
    fs.writeFileSync(fp, content, 'utf8');
    console.log('Fixed', file);
  }
}
