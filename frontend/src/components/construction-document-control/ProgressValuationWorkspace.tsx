import { nakopitelniyHolat, type ProgressValuationPage } from '../../lib/construction-document-control';
const HOLAT_BELGI: Record<ReturnType<typeof nakopitelniyHolat>, { matn: string; klass: string }> = {
 normal: { matn: 'Me’yorida', klass: 'text-emerald-400' },
 chegara: { matn: 'Chegarada', klass: 'text-amber-300' },
 ortiqcha: { matn: 'Ortiqcha', klass: 'text-rose-400 font-medium' },
 aniq_emas: { matn: 'Aniq emas', klass: 'text-amber-300' },
};
const show = (value: number | null) => value == null ? '—' : value;
const CHANGE_LABEL: Record<string, string> = {
  substitution: 'Almashtirish',
  replacement: 'Almashtirish',
  additional_work: 'Qo‘shimcha ish',
  removed_work: 'Ish olib tashlangan',
  quantity_increase: 'Hajm oshgan',
  quantity_decrease: 'Hajm kamaygan',
  new_section: 'Yangi bo‘lim',
  new_item: 'Yangi ish',
};
const changeLabel = (kind: string) => CHANGE_LABEL[kind] ?? 'O‘zgarish';

export function ProgressValuationWorkspace({page}:{page:ProgressValuationPage}){return <section aria-label="F2 ish baholash jadvali" className="overflow-x-auto rounded-xl border border-white/10 p-4"><div className="mb-3 text-sm text-slate-400">{page.totalCount.toLocaleString()} ta smeta qatori · {page.query.offset + 1}–{page.query.offset + page.rows.length} ko‘rsatilmoqda</div><table className="w-full min-w-[1680px] text-right text-xs"><thead className="text-slate-400"><tr><th className="text-left">Ish / resurs</th><th>Boshlang‘ich hajm</th><th>Boshlang‘ich narx</th><th>Tasdiqlangan o‘zgarish</th><th>Amaldagi limit</th><th>Oldingi</th><th>Joriy</th><th>Nakopitelniy</th><th>Qolgan</th><th>F2 hajmi</th><th>F2 narxi</th><th>F2 summasi</th><th>Amaldagi xarid</th><th>Farq</th><th>Holat</th><th>Tarix</th></tr></thead><tbody>{page.rows.map(row=>{const holat=HOLAT_BELGI[nakopitelniyHolat(row)];return <tr key={row.lineId} className={`border-t border-white/5 ${row.changeKinds.includes('substitution')?'border-l-2 border-l-violet-400/60':row.changeKinds.includes('additional_work')?'border-l-2 border-l-emerald-400/60':''}`}><td className="py-2 text-left">{row.description}<span className="ml-2 text-slate-500">{row.unit}</span>{row.changeKinds.length>0&&<span className="ml-2 text-[10px] text-slate-400">{row.changeKinds.map(changeLabel).join(', ')}</span>}</td><td>{show(row.baselineQuantity)}</td><td>{show(row.baselineReferencePrice)}</td><td>{row.approvedChangeQuantity}</td><td>{show(row.approvedEntitlementQuantity)}</td><td>{row.previousQuantity}/{show(row.previousValue)}</td><td>{row.currentQuantity}/{show(row.currentValue)}</td><td>{row.cumulativeQuantity}/{show(row.cumulativeValue)}</td><td>{show(row.remainingQuantity)}/{show(row.remainingValue)}</td><td>{row.currentQuantity}</td><td>{show(row.currentF2ValuationPrice)}</td><td>{show(row.currentCertifiedValue)}</td><td>{show(row.actualValue)}</td><td className={row.variance&&row.variance>0?'text-amber-300':''}>{show(row.variance)}</td><td className={holat.klass}>{holat.matn}</td><td className="text-text-dim">{row.revisionIds.length ? 'Tarix mavjud' : '—'}</td></tr>;})}</tbody></table></section>}
