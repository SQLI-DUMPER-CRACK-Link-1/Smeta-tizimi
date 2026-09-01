import type { CertifiedLine, ProgressLineResult, ProgressValuationInput, ProgressValuationResult } from './types';
const E = 1e-9; export const quantity = (n: number) => Math.round((n + E) * 1e6) / 1e6; export const money = (n: number) => Math.round((n + E) * 100) / 100;
const val = (q: number, p: number) => money(quantity(q) * p);
const EMPTY: readonly CertifiedLine[] = [];
/** Pure, deterministic valuation; it does not mutate certified history or fetch data.
 *  Period lines and changes are indexed by lineId once, so 10k+ BOQ rows stay O(n·periods) — no per-row rescans. */
export function calculateProgressValuation(input: ProgressValuationInput): ProgressValuationResult {
 if (input.throughPeriod < 0 || input.throughPeriod >= input.periods.length) throw new Error('PROGRESS_PERIOD_OUT_OF_RANGE');
 const tp = input.throughPeriod;
 const periodIdx: Array<Map<string, CertifiedLine[]>> = [];
 for (let i = 0; i <= tp; i++) { const m = new Map<string, CertifiedLine[]>(); for (const x of input.periods[i].lines) { const a = m.get(x.lineId); if (a) a.push(x); else m.set(x.lineId, [x]); } periodIdx.push(m); }
 const active = input.changes.filter(c => c.status === 'approved' && c.effectivePeriodIndex <= tp);
 const changesByLine = new Map<string, typeof active>(); for (const c of active) { const a = changesByLine.get(c.lineId); if (a) a.push(c); else changesByLine.set(c.lineId, [c]); }
 const pendingLines = new Set<string>(); for (const c of input.changes) if (c.status === 'pending') pendingLines.add(c.lineId);
 const periodRevIds = input.periods.slice(0, tp + 1).map(p => p.revisionId);
 const rows: ProgressLineResult[] = input.lines.map(line => {
  const periodQuantity = (index: number) => { let s = 0; for (const x of (periodIdx[index].get(line.lineId) ?? EMPTY)) s += x.quantity; return s; };
  const previousQuantity = quantity((() => { let s = 0; for (let i = 0; i < tp; i++) s += periodQuantity(i); return s; })()); const currentQuantity = quantity(periodQuantity(tp)); const cumulativeQuantity = quantity(previousQuantity + currentQuantity);
  const changes = changesByLine.get(line.lineId) ?? []; const approvedChangeQuantity = quantity(changes.reduce((sum,c) => sum + c.quantityDelta, 0)); const approvedEntitlementQuantity = quantity(line.baselineQuantity + approvedChangeQuantity); const remainingQuantity = quantity(approvedEntitlementQuantity - cumulativeQuantity);
  const previousValue = val(previousQuantity, line.baselineReferencePrice); const currentValue = val(currentQuantity, line.baselineReferencePrice); const cumulativeValue = val(cumulativeQuantity, line.baselineReferencePrice); const remainingValue = val(Math.max(0, remainingQuantity), line.baselineReferencePrice);
  const certified: CertifiedLine[] = []; for (let i = 0; i <= tp; i++) { const a = periodIdx[i].get(line.lineId); if (a) for (const x of a) certified.push(x); }
  const f2Known = certified.length > 0 && certified.every(x => x.f2ValuationPrice !== undefined); const actualKnown = certified.length > 0 && certified.every(x => x.actualProcurementPrice !== undefined); const f2ValuationValue = f2Known ? money(certified.reduce((s,x) => s + val(x.quantity, x.f2ValuationPrice!),0)) : null; const actualValue = actualKnown ? money(certified.reduce((s,x) => s + val(x.quantity, x.actualProcurementPrice!),0)) : null;
  const warnings: ProgressLineResult['warnings'] = []; if (cumulativeQuantity > approvedEntitlementQuantity + E) warnings.push('OVER_CERTIFICATION'); if (certified.some(x => !x.referencePriceSourceId || !x.actualPriceSourceId)) warnings.push('MISSING_PRICE_SOURCE'); if (pendingLines.has(line.lineId)) warnings.push('PENDING_CHANGE');
  return { lineId:line.lineId,sectionId:line.sectionId,description:line.description,unit:line.unit,baselineQuantity:line.baselineQuantity,baselineReferencePrice:line.baselineReferencePrice,approvedChangeQuantity,approvedEntitlementQuantity,previousQuantity,currentQuantity,cumulativeQuantity,remainingQuantity,previousValue,currentValue,cumulativeValue,remainingValue,f2ValuationValue,actualValue,variance:actualValue === null ? null : money(actualValue-cumulativeValue),revisionIds:[input.estimateRevisionId,...changes.map(c=>c.revisionId),...periodRevIds],warnings};
 });
 const sum = (key: keyof ProgressLineResult) => money(rows.reduce((s,r) => s + (typeof r[key] === 'number' ? r[key] as number : 0),0)); return {input,rows,totals:{previousQuantity:sum('previousQuantity'),currentQuantity:sum('currentQuantity'),cumulativeQuantity:sum('cumulativeQuantity'),remainingQuantity:sum('remainingQuantity'),previousValue:sum('previousValue'),currentValue:sum('currentValue'),cumulativeValue:sum('cumulativeValue'),remainingValue:sum('remainingValue')}};
}
