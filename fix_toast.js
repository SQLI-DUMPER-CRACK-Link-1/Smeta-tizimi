const fs = require('fs');
let code = fs.readFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', 'utf8');

code = code.replace(
  'const [yopilgan, setYopilgan] = useState<string | null>(null);',
  'const [yopilgan, setYopilgan] = useState<string | null>(() => sessionStorage.getItem("f2_chip_yopiq"));'
);

code = code.replace(
  'onClick={(e) => { e.stopPropagation(); setYopilgan(kalit); }}',
  'onClick={(e) => { e.stopPropagation(); setYopilgan(kalit); sessionStorage.setItem("f2_chip_yopiq", kalit); }}'
);

// If it's finished and we haven't seen it, but it finished more than 30 seconds ago, just auto-hide it.
// Because the user reloads the page 2 days later and it still says "F2 yozish tugadi".
code = code.replace(
  'if (yopilgan === kalit) return null;',
  `if (yopilgan === kalit) return null;
  const jimVaqt = j.yangilandi ? Date.now() - Number(j.yangilandi) : 0;
  if (j.status === 'tugadi' && jimVaqt > 60_000) return null; // 1 daqiqadan eski tugagan ishni ko'rsatmaymiz
`
);

fs.writeFileSync('frontend/src/umumiy/ui/F2NavbatChip.tsx', code);
