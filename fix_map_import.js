const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestXarita.tsx', 'utf8');

code = code.replace(
  "  FolderKanban, AlertTriangle, RefreshCcw",
  "  FolderKanban, AlertTriangle, RefreshCcw, Map"
);

fs.writeFileSync('frontend/src/test02/TestXarita.tsx', code);
