import { calculatePark, forma3Unresolved, type ParkCalculationInput } from '../../lib/park-document-control';
import { ParkChangeRegister } from './ParkChangeRegister';
import { ParkCumulativeStatement } from './ParkCumulativeStatement';

/** Reusable, isolated UI. It intentionally makes no API calls and owns no canonical persistence. */
export function ParkF2ControlPanel({ input }: { input: ParkCalculationInput }) {
  const result = calculatePark(input);
  return <section aria-label="PARK F2 document control" className="space-y-4"><ParkCumulativeStatement result={result}/><ParkChangeRegister input={input}/>
    <section className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><h2 className="font-medium">Qatorlar balansi</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-right text-sm"><thead className="text-xs text-slate-400"><tr><th className="text-left">Qator</th><th>Tasdiqlangan</th><th>Oldingi</th><th>Joriy</th><th>Nakop.</th><th>Qolgan</th><th>Estimate</th><th>Real</th><th>Farq</th></tr></thead><tbody>{result.lines.map(line=><tr key={line.lineId} className={line.overCertified?'border-t border-red-500/30 text-red-200':'border-t border-white/5'}><td className="py-2 text-left">{line.description}<span className="ml-2 text-xs text-slate-500">{line.unit}</span></td><td>{line.approvedQuantity}</td><td>{line.previousQuantity}</td><td>{line.currentQuantity}</td><td>{line.cumulativeQuantity}</td><td>{line.remainingQuantity}</td><td>{line.estimateValue}</td><td>{line.actualValue ?? '—'}</td><td>{line.priceVariance ?? '—'}</td></tr>)}</tbody></table></div>
      {result.warnings.length > 0 && <p role="alert" className="mt-3 text-sm text-red-300">{result.warnings.join(', ')}</p>}</section>
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><b>Forma-3: qoidasi tasdiqlanmagan.</b><p className="mt-1 text-slate-300">{forma3Unresolved.code}. Ushbu komponent Forma-3 bo‘yicha legal jami, to‘lov yoki soliq summasini hisoblamaydi.</p></section>
  </section>;
}
