const fs = require('fs');
let code = fs.readFileSync('frontend/src/admin/AdminShell.tsx', 'utf8');

code = code.replace(
  "{ yol: '/admin/test/portfel', nom: 'Loyihalar va Obyektlar', Ikonka: FolderKanban },",
  "{ yol: '/admin/test/portfel', nom: 'Loyihalar va Obyektlar', Ikonka: FolderKanban },\n        { yol: '/admin/test/xarita', nom: 'Mindmap (Xarita)', Ikonka: Map },"
);

code = code.replace(
  "{ yol: '/admin/test/logistika', nom: 'Ta\\'minot va Sklad', Ikonka: Box },",
  "{ yol: '/admin/test/logistika', nom: 'Ta\\'minot va Sklad', Ikonka: Box },\n        { yol: '/admin/test/aosr', nom: 'QA/QC (AOSR/APPOK)', Ikonka: ShieldCheck },"
);

if (!code.includes('Map,')) {
    code = code.replace('import { LogOut,', 'import { Map, LogOut,');
}

fs.writeFileSync('frontend/src/admin/AdminShell.tsx', code);
