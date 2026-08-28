const fs = require('fs');
let code = fs.readFileSync('frontend/src/test02/TestXarita.tsx', 'utf8');

// We will use replace with string indexOf to avoid CRLF mismatch
const startStr = '<div className="flex-1 overflow-y-auto p-4 space-y-4">';
const endStr = '<div className="text-[11px] text-zinc-400 mb-2">Bog\'lanishlari';

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const before = code.substring(0, startIndex);
  const after = code.substring(endIndex + endStr.length);
  
  const dashboardStr = `<div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* === MINI DASHBOARD (FUNKSIONALLIK KARKASI) === */}
              {tanlanganTugun.tur === 'obyekt' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(56,189,248,0.02)]">
                  <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={12} /> Obyekt Holati</h4>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">Byudjet (Smeta)</div>
                      <div className="text-[12px] font-bold text-emerald-400">12.5 Mlrd</div>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                      <div className="text-[10px] text-zinc-500">O'zlashtirildi (F2)</div>
                      <div className="text-[12px] font-bold text-sky-400">8.2 Mlrd <span className="text-[10px] text-zinc-500">(65%)</span></div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 space-y-2 mt-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Jarayondagi Zayavkalar:</span>
                      <span className="text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-amber-500/20" onClick={() => window.location.href='/admin/test/zayavka'}>3 ta</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Sklad qoldig'i:</span>
                      <span className="text-emerald-400 font-bold cursor-pointer hover:text-emerald-300" onClick={() => window.location.href='/admin/test/logistika'}>142 tonna</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-400">Biriktirilgan Texnikalar:</span>
                      <span className="text-white font-bold">4 ta aylanma</span>
                    </div>
                  </div>
                </div>
              )}

              {tanlanganTugun.tur === 'shartnoma' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(52,211,153,0.02)]">
                  <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={12} /> Moliyaviy Holat</h4>
                  <div className="bg-white/5 p-2 rounded-lg border border-white/5 space-y-2">
                    <div>
                      <div className="text-[10px] text-zinc-500">Shartnoma Summasi (NDS bilan)</div>
                      <div className="text-[13px] font-bold text-white">4 500 000 000 so'm</div>
                    </div>
                    <div className="w-full bg-black/50 rounded-full h-1.5 mt-2 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5" style={{ width: '45%' }}></div>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-emerald-400">To'langan: 2.02 Mlrd</span>
                      <span className="text-rose-400">Qarz: 2.47 Mlrd</span>
                    </div>
                  </div>
                </div>
              )}

              {tanlanganTugun.tur === 'kontragent' && (
                <div className="space-y-3 mb-6 bg-black/20 p-3 rounded-xl border border-white/5 shadow-[inset_0_0_20px_rgba(251,146,60,0.02)]">
                  <h4 className="text-[11px] font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users size={12} /> Kontragent Ma'lumoti</h4>
                  <div className="bg-white/5 p-3 rounded-lg border border-white/5 text-[11px] space-y-2">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-zinc-500">Turi:</span><span className="text-white font-medium">Subpudratchi (B2B)</span></div>
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-zinc-500">Reyting:</span><span className="text-amber-400 tracking-widest">★★★★☆</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Aktiv Shartnomalar:</span><span className="text-emerald-400 font-bold">2 ta</span></div>
                  </div>
                </div>
              )}
              {/* ================================================== */}

              <div>
                <div className="text-[11px] text-zinc-400 mb-2">Bog'lanishlari`;
  
  const newCode = before + dashboardStr + after;
  fs.writeFileSync('frontend/src/test02/TestXarita.tsx', newCode);
  console.log('Successfully injected exact mini dashboard payload into TestXarita.tsx');
} else {
  console.log('Could not find the target string ranges.');
}
