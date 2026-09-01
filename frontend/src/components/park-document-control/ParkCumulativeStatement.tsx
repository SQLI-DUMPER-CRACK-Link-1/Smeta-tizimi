import type { ParkCalculationResult } from '../../lib/park-document-control';

const money = (amount: number | null, currency: string) => amount === null ? 'Aniqlanmagan' : new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 2 }).format(amount) + ` ${currency}`;

/** Read-only two-panel F2/nakopitelniy view. Parent supplies canonical data. */
export function ParkCumulativeStatement({ result }: { result: ParkCalculationResult }) {
  return <section aria-label="F2 nakopitelniy hisobi" className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs text-slate-400">OLDINGI · JORIY · NAKOPITELNIY</p>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-slate-400">Oldingi</dt><dd>{money(result.previousEstimateValue, result.currency)}</dd></div><div><dt className="text-slate-400">Joriy F2</dt><dd>{money(result.currentEstimateValue, result.currency)}</dd></div><div><dt className="text-slate-400">Nakopitelniy</dt><dd className="font-semibold text-emerald-300">{money(result.cumulativeEstimateValue, result.currency)}</dd></div></dl>
      <p className="mt-3 text-xs text-slate-400">Qolgan tasdiqlangan qiymat: <b className="text-white">{money(result.remainingEstimateValue, result.currency)}</b></p></div>
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4"><p className="text-xs text-slate-400">NARX ASOSLARI AJRATILGAN</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-400">Real ijro/material</dt><dd>{money(result.actualValue, result.currency)}</dd></div><div><dt className="text-slate-400">Narx farqi</dt><dd className={result.priceVariance && result.priceVariance > 0 ? 'text-amber-300' : 'text-emerald-300'}>{money(result.priceVariance, result.currency)}</dd></div></dl>
      <p className="mt-3 text-xs text-slate-400">Real narx estimate/reference narxni o‘zgartirmaydi. Hujjat farqi har davr kesimida alohida ko‘rsatiladi.</p></div>
  </section>;
}
