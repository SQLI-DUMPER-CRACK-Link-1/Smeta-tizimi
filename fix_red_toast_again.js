const fs = require('fs');
let code = fs.readFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', 'utf8');

// Remove the faulty auto-hide from the top
code = code.replace(
  "  const jimVaqt = j.yangilandi ? Date.now() - Number(j.yangilandi) : 0;\n  if ((j.status === 'tugadi' || j.status === 'xato' || qotdi) && jimVaqt > 60_000) return null; // 1 daqiqadan eski tugagan ishni ko'rsatmaymiz\n\n",
  ""
);

// Add the safe auto-hide AFTER qotdi is declared
const insertPoint = '  const qotdi = ishlayapti && jim > QOTDI_MS;';
code = code.replace(
  insertPoint,
  insertPoint + `\n\n  // F5 (reload) qilganda tugagan yoki xato qotib qolgan eski ishlarni yashiramiz\n  if ((tugadi || xato || qotdi) && jim > 60_000) return null;\n`
);

fs.writeFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', code);
