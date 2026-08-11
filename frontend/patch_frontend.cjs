const fs = require('fs');

// Patch F2Import.tsx
const f2ImportFile = 'c:\\Users\\PC\\Documents\\GAS\\frontend\\src\\admin\\sahifalar\\F2Import.tsx';
let imp = fs.readFileSync(f2ImportFile, 'utf8');

imp = imp.replace(
  `<F2Daraxt
                tugunlar={aktDaraxt}
                bogMi={aktBogMi}
                dopMi={(k) => !!qolDop[k]}
                hover={hover}
                setHover={setHover}
                filtr={filtr}
                ochiqYopiqSignal={ochiqSignal}
              />`,
  `<F2Daraxt
                tugunlar={aktDaraxt}
                bogMi={aktBogMi}
                dopMi={(k) => !!qolDop[k]}
                hover={hover}
                setHover={setHover}
                filtr={filtr}
                ochiqYopiqSignal={ochiqSignal}
                takliflar={natija?.takliflar}
                onTaklifTanlandi={(uid, smetaKalit) => qolBogla(uid, smetaKalit)}
              />`
);

fs.writeFileSync(f2ImportFile, imp);
console.log("Patched F2Import.tsx");

// Patch F2Daraxt.tsx
const f2DaraxtFile = 'c:\\Users\\PC\\Documents\\GAS\\frontend\\src\\umumiy\\ui\\F2Daraxt.tsx';
let dar = fs.readFileSync(f2DaraxtFile, 'utf8');

dar = dar.replace(
  `onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;`,
  `onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  takliflar?: Record<string, any[]>;
  onTaklifTanlandi?: (uid: string, cand: any) => void;`
);

dar = dar.replace(
  `onDopClick, onOtishClick, scrollRef,
}: {`,
  `onDopClick, onOtishClick, takliflar, onTaklifTanlandi, scrollRef,
}: {`
);

const taklifBtn = `           {/* Takliflar (faqat chap taraf uchun) */}
           {!bog && takliflar && takliflar[t.kalit] && takliflar[t.kalit].length > 0 && onTaklifTanlandi && (
             <div className="relative group/taklif">
               <button onClick={(e) => e.stopPropagation()} className="w-6 h-6 ml-0.5 flex items-center justify-center rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:scale-110 transition-all cursor-pointer" title="Taklif qilingan variantlar">
                 <span className="text-[12px] font-bold">🎯</span>
               </button>
               <div className="absolute left-full top-0 ml-2 bg-slate-800 border border-slate-700 rounded shadow-xl p-2 z-50 hidden group-hover/taklif:block w-[400px]">
                 <div className="text-[11px] text-slate-400 mb-2 font-semibold">Takliflar ({takliflar[t.kalit].length}):</div>
                 <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1">
                   {takliflar[t.kalit].map((c: any, i: number) => (
                     <div key={i} onClick={(e) => { e.stopPropagation(); onTaklifTanlandi(t.kalit, c.varaq+'#'+c.row); }} className="bg-slate-700/50 hover:bg-emerald-500/20 border border-slate-600 hover:border-emerald-500/40 rounded p-1.5 cursor-pointer transition-colors text-[11px]">
                       <div className="font-semibold text-emerald-400 mb-1">{c.nom}</div>
                       <div className="flex justify-between text-[10px] text-slate-400">
                         <span>Varaq: {c.varaq}</span>
                         <span>Qator: {c.row}</span>
                         <span>Kod: {c.kod}</span>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
           )}

           {/* Tur belgisi */}`;

dar = dar.replace(
  `           {/* Tur belgisi */}`,
  taklifBtn
);

// F2Daraxt Component Props update
dar = dar.replace(
  `onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  bosh?: string;
}) {`,
  `onDopClick?: (kalit: string) => void;
  onOtishClick?: (kalit: string) => void;
  bosh?: string;
  takliflar?: Record<string, any[]>;
  onTaklifTanlandi?: (uid: string, smetaKalit: string) => void;
}) {`
);

dar = dar.replace(
  `onDopClick, onOtishClick, bosh = "Daraxt bo'sh",
}:`,
  `onDopClick, onOtishClick, takliflar, onTaklifTanlandi, bosh = "Daraxt bo'sh",
}:`
);

dar = dar.replace(
  `onDopClick={onDopClick}
          onOtishClick={onOtishClick}
          scrollRef={kalit === scrollToKey ? qatorRef : undefined}
        />`,
  `onDopClick={onDopClick}
          onOtishClick={onOtishClick}
          takliflar={takliflar}
          onTaklifTanlandi={onTaklifTanlandi}
          scrollRef={kalit === scrollToKey ? qatorRef : undefined}
        />`
);

fs.writeFileSync(f2DaraxtFile, dar);
console.log("Patched F2Daraxt.tsx");
