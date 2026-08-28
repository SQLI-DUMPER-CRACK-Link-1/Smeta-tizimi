const fs = require('fs');

let code = fs.readFileSync('frontend/src/test02/TestSklad.tsx', 'utf8');

// 1. Add new imports
if (!code.includes('sbSkladlarOl')) {
  code = code.replace(
    "import { sbT2ObyektlarOl, sbSkladQoldiqOl, sbSkladgaYozish, yangiOperationId, type T2Obyekt, type T2SkladQoldiq } from '../api/supabase';",
    "import { sbT2ObyektlarOl, sbSkladQoldiqOl, sbSkladgaYozish, yangiOperationId, type T2Obyekt, type T2SkladQoldiq } from '../api/supabase';\nimport { sbSkladlarOl } from '../api/t2-resurs';\nimport { sbSkladKonsolidatsiyaOl, type SkladKonsolidatsiya } from '../api/t2-sklad-konsolidatsiya';"
  );
}

// 2. Add 'konsolidatsiya' to activeTab state
code = code.replace(
  "const [activeTab, setActiveTab] = useState<'qoldiq' | 'kirim' | 'chiqim' | 'm29'>('qoldiq');",
  "const [activeTab, setActiveTab] = useState<'qoldiq' | 'kirim' | 'chiqim' | 'm29' | 'konsolidatsiya'>('konsolidatsiya');" // Default to new tab to show it off
);

// 3. Add state variables for Konsolidatsiya
code = code.replace(
  "const [searchTerm, setSearchTerm] = useState('');",
  `const [searchTerm, setSearchTerm] = useState('');

  // Konsolidatsiya State
  const [markaziySkladlar, setMarkaziySkladlar] = useState<any[]>([]);
  const [markaziyId, setMarkaziyId] = useState<number | null>(null);
  const [konsQoldiqlar, setKonsQoldiqlar] = useState<SkladKonsolidatsiya[]>([]);
`
);

// 4. Update the useEffect to also load Markaziy Skladlar
code = code.replace(
  /useEffect\(\(\) => \{\s*sbT2ObyektlarOl\(\)\.then\(r => \{[\s\S]*?\}\);\s*\}, \[aktKomp\]\);/,
  `useEffect(() => {
    sbT2ObyektlarOl().then(r => {
      if (r.ok && r.qatorlar) {
        setObyektlar(r.qatorlar);
        if (r.qatorlar.length > 0 && !obyektId) {
          setObyektId(r.qatorlar[0].id);
        }
      }
    });
    if (aktKomp) {
      sbSkladlarOl(aktKomp).then(r => {
        if (r.ok && r.qatorlar) {
          setMarkaziySkladlar(r.qatorlar);
          if (r.qatorlar.length > 0 && !markaziyId) {
            setMarkaziyId(r.qatorlar[0].id);
          }
        }
      });
    }
  }, [aktKomp]);

  // Yuklash logika: Agar konsolidatsiya tanlangan bo'lsa, konsolidatsiya yuklaymiz
  useEffect(() => {
    if (activeTab === 'konsolidatsiya' && markaziyId) {
      setYuklanmoqda(true);
      sbSkladKonsolidatsiyaOl(markaziyId).then(r => {
        if (r.ok && r.qatorlar) setKonsQoldiqlar(r.qatorlar as SkladKonsolidatsiya[]);
        setYuklanmoqda(false);
      });
    }
  }, [activeTab, markaziyId]);
`
);

// 5. Add Tab button
code = code.replace(
  "{/* TABS */}",
  `{/* TABS */}
        <div className="flex items-center gap-2 mb-4 border-b border-border pb-2 overflow-x-auto">
          <button onClick={() => setActiveTab('konsolidatsiya')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${activeTab === 'konsolidatsiya' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}\`}>
            Jamlangan Ombor (Konsolidatsiya)
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button onClick={() => setActiveTab('qoldiq')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${activeTab === 'qoldiq' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}\`}>
            Obyekt Qoldiqlari
          </button>
          <button onClick={() => setActiveTab('kirim')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${activeTab === 'kirim' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}\`}>
            Prixod (Kirim)
          </button>
          <button onClick={() => setActiveTab('chiqim')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${activeTab === 'chiqim' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}\`}>
            Rasxod (Chiqim)
          </button>
          <button onClick={() => setActiveTab('m29')} className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${activeTab === 'm29' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-white'}\`}>
            M-29 Hisobot
          </button>
        </div>`
);
// Remove old Tabs rendering
code = code.replace(
  /<div className="flex gap-2 mb-4">[\s\S]*?<\/div>/, // Will match the first old <div className="flex gap-2 mb-4"> block
  ""
);

// 6. Add UI for 'konsolidatsiya'
const konsolidatsiyaUI = `
        {activeTab === 'konsolidatsiya' && (
          <div className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1 max-w-sm">
                <label className="block text-xs text-text-dim mb-1">Markaziy Skladni tanlang</label>
                <select value={markaziyId || ''} onChange={e => setMarkaziyId(Number(e.target.value))} className="w-full bg-bg border border-border rounded-xl p-2.5 text-sm outline-none focus:border-accent">
                  <option value="">-- Tanlang --</option>
                  {markaziySkladlar.map(s => (
                    <option key={s.id} value={s.id}>{s.nomi} {s.manzil ? \`(\${s.manzil})\` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {yuklanmoqda ? <div className="skel h-40 rounded-xl" /> : (
              <div className="karta overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50 text-text-dim">
                      <th className="text-left px-4 py-3 font-medium">Material</th>
                      <th className="text-right px-4 py-3 font-medium text-emerald-400">JAMI QOLDIQ</th>
                      <th className="text-left px-4 py-3 font-medium border-l border-border/50">Obyektlardagi Taqsimot (Filiallar kesimida)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {konsQoldiqlar.length === 0 && (
                      <tr><td colSpan={3} className="px-4 py-8 text-center text-text-mute">Ushbu markaziy sklad va unga bog'langan obyektlarda qoldiq yo'q.</td></tr>
                    )}
                    {konsQoldiqlar.map((kq, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-surface-2/30">
                        <td className="px-4 py-3 text-white font-medium">{kq.material_nomi}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-400 font-bold bg-emerald-500/5">
                          <FmtN val={kq.jami_qoldiq} /> {kq.birligi}
                        </td>
                        <td className="px-4 py-3 border-l border-border/50">
                          <div className="flex flex-wrap gap-2">
                            {kq.obyektlar_boyicha?.map((ob, j) => (
                              <div key={j} className="inline-flex items-center gap-1.5 bg-bg border border-border px-2 py-1 rounded-md text-[11px]">
                                <span className="text-text-dim truncate max-w-[120px]">{ob.obyekt_nom}:</span>
                                <span className="text-white font-medium"><FmtN val={ob.qoldiq} /></span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
`;

code = code.replace(
  "{activeTab === 'qoldiq' && (",
  konsolidatsiyaUI + "\n        {activeTab === 'qoldiq' && ("
);

fs.writeFileSync('frontend/src/test02/TestSklad.tsx', code);
console.log('TestSklad.tsx updated with Konsolidatsiya tab');
