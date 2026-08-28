const fs = require('fs');

// App.tsx
let app = fs.readFileSync('frontend/src/App.tsx', 'utf8');
if (!app.includes('TestZayavka')) {
  app = app.replace(
    "const TestSklad     = lazy(() => import('./test02/TestSklad'));",
    "const TestSklad     = lazy(() => import('./test02/TestSklad'));\nconst TestZayavka   = lazy(() => import('./test02/TestZayavka'));"
  );
  app = app.replace(
    '<Route path="sklad" element={<TestSklad />} />',
    '<Route path="sklad" element={<TestSklad />} />\n              <Route path="zayavka" element={<TestZayavka />} />'
  );
  fs.writeFileSync('frontend/src/App.tsx', app);
  console.log('App.tsx updated');
}

// AdminShell.tsx
let shell = fs.readFileSync('frontend/src/admin/AdminShell.tsx', 'utf8');
if (!shell.includes('/admin/test/zayavka')) {
  shell = shell.replace(
    "{ yol: '/admin/test/logistika', nom: 'Ta\\'minot va Sklad', Ikonka: Box },",
    "{ yol: '/admin/test/logistika', nom: 'Ta\\'minot va Sklad', Ikonka: Box },\n        { yol: '/admin/test/zayavka', nom: 'Zayavkalar (PTO)', Ikonka: ClipboardList },"
  );
  if (!shell.includes('ClipboardList')) {
    shell = shell.replace("import { LayoutDashboard, Users, HardHat, FileInput", "import { ClipboardList, LayoutDashboard, Users, HardHat, FileInput");
  }
  fs.writeFileSync('frontend/src/admin/AdminShell.tsx', shell);
  console.log('AdminShell.tsx updated');
}
