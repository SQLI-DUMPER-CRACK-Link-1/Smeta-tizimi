/* T2-COMPANY-CONTEXT-ADVERSARIAL-TESTS-001 — Cloudflare Functions gate.
 * This intentionally fails until frontend/functions is included in a dedicated
 * TypeScript project and release command. It changes no product code.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
// tsconfig is JSONC, not strict JSON.
const jsonc = (text) => JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''));
let ok = 0; let bad = 0;
function must(label, condition, why) {
  try { assert.ok(condition, why); console.log('  ✅ ' + label); ok++; }
  catch (e) { console.log('  ❌ ' + label + ' — ' + e.message); bad++; }
}

console.log('\n── Cloudflare Functions TypeScript release gate ──');
const app = jsonc(read('tsconfig.app.json'));
must('main browser tsconfig does not pretend to cover functions',
  Array.isArray(app.include) && !app.include.some((p) => /functions/.test(p)),
  'audit baseline changed: re-evaluate split typecheck');
must('dedicated tsconfig.functions.json exists', exists('tsconfig.functions.json'),
  'frontend/functions/** tsc -b graphdan tashqarida');
if (exists('tsconfig.functions.json')) {
  const f = jsonc(read('tsconfig.functions.json'));
  must('functions tsconfig includes frontend/functions source',
    (f.include || []).some((p) => /functions/.test(p)), 'functions include yo‘q');
  must('functions tsconfig supplies Pages/Workers types',
    JSON.stringify(f).includes('@cloudflare/workers-types') || JSON.stringify(f).includes('cloudflare'),
    'PagesFunction type manbasi explicit bo‘lishi kerak');
}
const pkg = JSON.parse(read('package.json'));
must('package scripts contain independently runnable functions typecheck',
  Object.entries(pkg.scripts || {}).some(([k, v]) => /typecheck.*function|function.*typecheck/i.test(k) && /tsc/.test(String(v))),
  'tsc -b faqat src ni tekshiradi; functions gate alohida bo‘lishi kerak');
console.log(`\n═══ ${ok} passed, ${bad} failed ═══`);
process.exit(bad ? 1 : 0);
