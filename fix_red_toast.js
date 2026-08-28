const fs = require('fs');
let code = fs.readFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', 'utf8');

code = code.replace(
  "if (j.status === 'tugadi' && jimVaqt > 60_000) return null;",
  "if ((j.status === 'tugadi' || j.status === 'xato' || qotdi) && jimVaqt > 60_000) return null;"
);

fs.writeFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', code);
