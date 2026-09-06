/*
 * Release correction guard: kundalik T2 yo‘llari legacy menyuda takrorlanmasin
 * va PTO operatoriga ichki ID/version/hash ko‘rsatilmasin. Canonical ID’lar
 * komponentlarning state/key/API qatlamida qolishi mumkin; bu oracle faqat
 * rendered user-facing fragmentlarni tekshiradi.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const noComment = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
let passed = 0;
let failed = 0;
function must(label, condition, reason) {
  try {
    assert.ok(condition, reason || label);
    console.log('  ✅ ' + label);
    passed++;
  } catch (error) {
    console.log('  ❌ ' + label + ' — ' + error.message);
    failed++;
  }
}

const shell = noComment(read('frontend', 'src', 'admin', 'AdminShell.tsx'));
const oldMenu = shell.slice(shell.indexOf('const ESKI_TIZIM_MENYU = ['), shell.indexOf('export default function AdminShell'));
const t2Menu = shell.slice(shell.indexOf('const TIZIM_02_GURUHLAR = ['), shell.indexOf('const ESKI_TIZIM_MENYU'));
const exactMenuPath = (source, route) => new RegExp(`yol:\\s*['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(source);

console.log('\n── T2 / legacy navigation boundary ──');
for (const route of ['/admin/obyektlar', '/admin/f2', '/admin/f2-tayyorlash', '/admin/narxlar']) {
  must(route + ' legacy menu duplicate removed', !exactMenuPath(oldMenu, route),
    route + ' ESKI_TIZIM_MENYU ichida qolmasligi kerak');
}
for (const route of ['/admin/obyektlar', '/admin/f2', '/admin/f2-tayyorlash', '/admin/narxlar']) {
  must(route + ' remains in T2 navigation', exactMenuPath(t2Menu, route),
    route + ' TIZIM_02 navigation ichida ko‘rinadigan bo‘lishi kerak');
}

console.log('\n── PTO-visible identity boundary ──');
const ptoSources = [
  ['F2TayyorlashNative', read('frontend', 'src', 'admin', 'sahifalar', 'F2TayyorlashNative.tsx')],
  ['F2TarixNative', read('frontend', 'src', 'admin', 'sahifalar', 'F2TarixNative.tsx')],
  ['FaktNative', read('frontend', 'src', 'admin', 'sahifalar', 'FaktNative.tsx')],
  ['AdditionalReplacementNative', read('frontend', 'src', 'admin', 'sahifalar', 'AdditionalReplacementNative.tsx')],
  ['HujjatNazoratPage', read('frontend', 'src', 'admin', 'pages', 'HujjatNazoratPage.tsx')],
  ['ProgressValuationWorkspace', read('frontend', 'src', 'components', 'construction-document-control', 'ProgressValuationWorkspace.tsx')],
  ['RevisionHistoryView', read('frontend', 'src', 'components', 'construction-document-control', 'RevisionHistoryView.tsx')],
  ['ChangeControlWorkspace', read('frontend', 'src', 'components', 'construction-document-control', 'ChangeControlWorkspace.tsx')],
  ['ExportPreview', read('frontend', 'src', 'components', 'construction-document-control', 'ExportPreview.tsx')],
  ['ProjectCloseoutWorkspace', read('frontend', 'src', 'components', 'construction-document-control', 'ProjectCloseoutWorkspace.tsx')],
  ['NarxlarNative', read('frontend', 'src', 'admin', 'sahifalar', 'NarxlarNative.tsx')],
  ['DocumentCenter', read('frontend', 'src', 'components', 'document-center', 'DocumentCenter.tsx')],
  ['BossDashboard', read('frontend', 'src', 'admin', 'sahifalar', 'BossDashboard.tsx')],
];
for (const [name, source] of ptoSources) {
  const clean = noComment(source);
  must(name + ' has no visible row-number interpolation', !/>\s*#\$\{[^}]*qator_id/.test(clean) && !/F2\s+#\$\{/.test(clean),
    name + ' user-facing JSX ichida #qator_id ko‘rinmasligi kerak');
  must(name + ' has no visible revision/projection/hash identity',
    !/revisionIds\.join|projectionHash\s*\}/.test(clean) && !/>\s*\{e\.revisionId\}|>\s*\{c\.revisionId\}/.test(clean),
    name + ' user-facing JSX ichida revision/projection identifikatori ko‘rinmasligi kerak');
}
must('PTO visible export errors omit canonical line IDs',
  !/\{x\.lineId\}:\s*\{x\.code\}/.test(noComment(ptoSources.find(([name]) => name === 'ExportPreview')[1])),
  'eksport tekshiruvi operatorga ichki lineId bermasligi kerak');
must('DocumentCenter omits technical document identity',
  !/document_id|sha256|document\.revision|Canonical revision|Replica revision/.test(noComment(ptoSources.find(([name]) => name === 'DocumentCenter')[1])),
  'hujjat markazi document ID, revision va hashni oddiy foydalanuvchiga ko‘rsatmasligi kerak');
must('BossDashboard omits technical signal identity and raw error',
  !/s\.entity_type\}\s*#\$\{s\.entity_id\}|\(q\.error as any\)\?\.message/.test(noComment(ptoSources.find(([name]) => name === 'BossDashboard')[1])),
  'rahbar paneli signal ID yoki backend xatosini foydalanuvchiga chiqarmasligi kerak');
must('F2 tarixida developer versiya izohi yo‘q',
  !/serverdagi versiya|revision\s*[:=]/i.test(noComment(ptoSources.find(([name]) => name === 'F2TarixNative')[1])),
  'operatorga ichki versiya atamasi emas, tushunarli tasdiqlash holati ko‘rsatilishi kerak');

console.log(`\n═══ ${passed} passed, ${failed} failed ═══`);
process.exit(failed ? 1 : 0);
