const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestXarita.tsx', 'utf8');

// Insert a red notification badge if meta.zayavka or meta.bildirishnoma exists
const badgeCode = `
                  {/* Bildirishnoma / Zayavka (Tick) */}
                  {(t.meta?.zayavka || t.meta?.bildirishnoma) && (
                    <div className="absolute -top-2 -left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-[#111827] shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse flex items-center gap-1 z-20">
                      <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                      {t.meta.zayavka || t.meta.bildirishnoma}
                    </div>
                  )}
`;

code = code.replace(
  '<div className="flex items-center gap-1.5 font-semibold',
  badgeCode + '\n                  <div className="flex items-center gap-1.5 font-semibold'
);

fs.writeFileSync('frontend/src/test02/TestXarita.tsx', code);
