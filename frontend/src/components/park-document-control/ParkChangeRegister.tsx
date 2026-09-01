import type { ParkCalculationInput } from '../../lib/park-document-control';

export function ParkChangeRegister({ input }: { input: Pick<ParkCalculationInput, 'changes'> }) {
  return <section aria-label="O‘zgarishlar reestri" className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-medium">O‘zgarishlar / revision</h2><span className="text-xs text-slate-400">Pending qiymatlar kanonik F2/nakopitelniyga kirmaydi</span></div>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-slate-400"><tr><th className="pb-2">Revision</th><th>Tur</th><th>Holat</th><th className="text-right">Hajm Δ</th><th>Sabab</th></tr></thead><tbody>{input.changes.map(change => <tr key={change.changeId} className="border-t border-white/5"><td className="py-2 font-mono text-xs">{change.revisionId}</td><td>{change.kind}</td><td><span className={change.status === 'approved' ? 'text-emerald-300' : change.status === 'pending' ? 'text-amber-300' : 'text-slate-400'}>{change.status}</span></td><td className="text-right tabular-nums">{change.quantityDelta}</td><td>{change.reason}</td></tr>)}</tbody></table></div>
  </section>;
}
