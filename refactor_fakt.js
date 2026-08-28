const fs = require('fs');

let content = fs.readFileSync('frontend/src/test02/TestFakt.tsx', 'utf8');

// Add import
if (!content.includes('useVirtualizer')) {
  content = content.replace("import { FmtN } from '../lib/format';", "import { FmtN } from '../lib/format';\nimport { useVirtualizer } from '@tanstack/react-virtual';");
}

// Extract table into a new component or just refactor in place.
// Actually, it's easier to replace the PTO part with a Virtualized component.

const ptoPart = `
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="sticky top-0 bg-surface-2 border-b border-border text-text-dim font-medium text-[10px] uppercase tracking-wider z-10">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3 min-w-[250px]">Ish nomi</th>
                  <th className="px-4 py-3 text-right">Smeta Jami</th>
                  <th className="px-4 py-3 text-right text-emerald-400">FAKT Jami</th>
                  <th className="px-4 py-3 text-right text-sky-400">2 Jami</th>
                  <th className="px-4 py-3 text-right text-amber-400">Qoldiq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {qatorlar.map(q => (
                  <tr key={q.id} className="hover:bg-bg/50 transition-colors">
                    <td className="px-4 py-2 font-mono text-[11px] text-zinc-500">{q.kod}</td>
                    <td className="px-4 py-2 whitespace-normal text-xs text-white max-w-sm leading-tight">{q.nom}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300">
                      {FmtN(q.smeta_hajm)} {q.birlik}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      <input 
                        type="number"
                        className="w-20 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 text-emerald-400 font-bold text-right outline-none focus:border-emerald-500"
                        defaultValue={q.fakt_hajm}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val !== q.fakt_hajm) {
                            ptoJamiOzgarishi(q.qator_id, val);
                          }
                        }}
                        onKeyDown={(e) => {
                           if (e.key === 'Enter') e.currentTarget.blur();
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-sky-400">
                      {FmtN(q.f2_hajm)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs text-amber-400 font-bold bg-amber-500/5">
                      {FmtN(q.qoldiq_hajm)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
`;

const virtualizedTable = `
          <VirtualTable qatorlar={qatorlar} ptoJamiOzgarishi={ptoJamiOzgarishi} />
`;

content = content.replace(ptoPart.trim(), virtualizedTable.trim());

// Add VirtualTable component at the bottom
if (!content.includes('function VirtualTable')) {
  content += `

// 20k rows uchun Virtualization!
function VirtualTable({ qatorlar, ptoJamiOzgarishi }: { qatorlar: QatorHolat[], ptoJamiOzgarishi: any }) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: qatorlar.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 45, // default row height
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto relative">
      <table className="w-full text-left text-sm whitespace-nowrap table-fixed">
        <thead className="sticky top-0 bg-surface-2 border-b border-border text-text-dim font-medium text-[10px] uppercase tracking-wider z-20">
          <tr>
            <th className="px-4 py-3 w-24">Kod</th>
            <th className="px-4 py-3 w-1/3">Ish nomi</th>
            <th className="px-4 py-3 text-right w-24">Smeta Jami</th>
            <th className="px-4 py-3 text-right text-emerald-400 w-32">FAKT Jami</th>
            <th className="px-4 py-3 text-right text-sky-400 w-24">2 Jami</th>
            <th className="px-4 py-3 text-right text-amber-400 w-24">Qoldiq</th>
          </tr>
        </thead>
        <tbody 
          className="divide-y divide-border/50 relative"
          style={{ height: \`\${rowVirtualizer.getTotalSize()}px\` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const q = qatorlar[virtualRow.index];
            return (
              <tr 
                key={q.id} 
                className="hover:bg-bg/50 transition-colors absolute w-full"
                style={{
                  top: 0,
                  left: 0,
                  transform: \`translateY(\${virtualRow.start}px)\`,
                  height: \`\${virtualRow.size}px\`
                }}
              >
                <td className="px-4 py-2 font-mono text-[11px] text-zinc-500 w-24 overflow-hidden text-ellipsis">{q.kod}</td>
                <td className="px-4 py-2 whitespace-normal text-xs text-white leading-tight w-1/3 overflow-hidden" title={q.nom}>
                  <div className="line-clamp-2">{q.nom}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-zinc-300 w-24">
                  {FmtN(q.smeta_hajm)} {q.birlik}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs w-32">
                  <input 
                    type="number"
                    className="w-20 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 text-emerald-400 font-bold text-right outline-none focus:border-emerald-500"
                    defaultValue={q.fakt_hajm}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val !== q.fakt_hajm) {
                        ptoJamiOzgarishi(q.qator_id, val);
                      }
                    }}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                  />
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-sky-400 w-24">
                  {FmtN(q.f2_hajm)}
                </td>
                <td className="px-4 py-2 text-right font-mono text-xs text-amber-400 font-bold bg-amber-500/5 w-24">
                  {FmtN(q.qoldiq_hajm)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
`;
}

fs.writeFileSync('frontend/src/test02/TestFakt.tsx', content);
