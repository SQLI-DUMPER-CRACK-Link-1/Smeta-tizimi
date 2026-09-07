import type { ProgressValuationResult } from '../../lib/construction-document-control';
const show = (value: number | null) => value == null ? '—' : value;
export function NakopitelniyWorkspace({result}:{result:ProgressValuationResult}){
  const t=result.totals;
  return <section aria-label="Nakopitelniy workspace" className="karta overflow-hidden p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">NAKOPITELNIY</p><h2 className="mt-1 font-semibold text-text">Tasdiqlangan F2 jamlanmasi</h2><p className="mt-1 text-xs text-text-dim">Miqdor va qiymat alohida ko‘rsatiladi; faqat tasdiqlangan davrlar jamlanadi.</p></div>
      <span className="rounded-full border border-ok/25 bg-ok/5 px-2.5 py-1 text-[11px] text-ok">Read-model</span>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-4">
      {[['Oldingi', t.previousValue], ['Joriy F2', t.currentValue], ['Jamlanma', t.cumulativeValue], ['Qolgan', t.remainingValue]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-border bg-surface-2/60 p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-text-mute">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums text-text">{show(value as number | null)}</p></div>)}
    </div>
    <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="text-[11px] uppercase tracking-[0.08em] text-text-dim"><tr><th className="px-3 py-2 text-left">O‘lchov</th><th>Oldingi</th><th>Joriy</th><th>Jamlanma</th><th>Qolgan</th></tr></thead><tbody><tr className="border-t border-border"><td className="px-3 py-2 text-left text-text">Miqdor</td><td className="tabular-nums">{t.previousQuantity}</td><td className="tabular-nums">{t.currentQuantity}</td><td className="tabular-nums">{t.cumulativeQuantity}</td><td className="tabular-nums">{show(t.remainingQuantity)}</td></tr><tr className="border-t border-border"><td className="px-3 py-2 text-left text-text">Qiymat</td><td className="tabular-nums">{show(t.previousValue)}</td><td className="tabular-nums">{show(t.currentValue)}</td><td className="tabular-nums">{show(t.cumulativeValue)}</td><td className="tabular-nums">{show(t.remainingValue)}</td></tr></tbody></table></div>
    <p className="mt-3 text-xs text-text-mute">Filtr va sahifalash canonical read port orqali beriladi; bu ko‘rinish 10k+ qatorni brauzerda to‘liq qayta chizmaydi.</p>
  </section>;
}
