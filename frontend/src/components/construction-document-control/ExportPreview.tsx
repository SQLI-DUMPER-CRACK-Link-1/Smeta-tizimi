import type { Id, ProgressLineResult, ProgressValuationResult } from '../../lib/construction-document-control';
import { generateNakopitelniy } from '../../lib/construction-document-control/export/nakopitelniy-export';
import { generateForma2 } from '../../lib/construction-document-control/export/forma2-export';
import { generateForma3 } from '../../lib/construction-document-control/export/forma3-export';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';

export interface ExportPreviewModel { 
  f2PeriodId: Id; 
  estimateRevisionId: Id; 
  rows: readonly ProgressLineResult[]; 
  totals: ProgressValuationResult['totals']; 
  reconciliation: readonly {lineId:Id;code:string}[]; 
  documents: readonly Id[]; 
  projectName: string;
  objectName: string;
  contractId?: Id; projectionHash?: string;
  vatRatePercent?: number | null;
}

const show = (value: number | null) => value == null ? 'NOANIQ' : value;
const errorLabel: Record<string, string> = { NAKOPITELNIY_MISMATCH: 'Nakopitelniy yig‘indisi mos emas', MISSING_BASELINE_PRICE: 'Boshlang‘ich narx manbasi yo‘q' };

export function ExportPreview({model}:{model:ExportPreviewModel}) {
  const handleNakopitelniy = async () => {
    const data = await generateNakopitelniy(model.rows, {
      projectName: model.projectName,
      objectName: model.objectName,
      periodLabel: model.f2PeriodId,
      documentNumber: `NAK-${model.f2PeriodId}`
    });
    downloadBlob(data, `Nakopitelniy_${model.f2PeriodId}.xlsx`);
  };

  const handleForma2 = async () => {
    const data = await generateForma2(model.rows, {
      projectName: model.projectName,
      objectName: model.objectName,
      periodLabel: model.f2PeriodId,
      documentNumber: `F2-${model.f2PeriodId}`,
      contractNumber: model.contractId
    });
    downloadBlob(data, `Forma2_${model.f2PeriodId}.xlsx`);
  };

  const handleForma3 = async () => {
    const data = await generateForma3({ input: null as any, rows: [...model.rows], totals: model.totals }, {
      projectName: model.projectName,
      objectName: model.objectName,
      periodLabel: model.f2PeriodId,
      documentNumber: `F3-${model.f2PeriodId}`,
      contractNumber: model.contractId,
      vatRatePercent: model.vatRatePercent
    });
    downloadBlob(data, `Forma3_${model.f2PeriodId}.xlsx`);
  };

  return (
    <section aria-label="Excel eksporti oldindan ko‘rish" className="rounded-xl border border-white/10 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-medium">Hujjatlarni yuklab olish</h2>
        <div className="flex gap-2">
          <button onClick={handleNakopitelniy} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition-colors">Nakopitelniy</button>
          <button onClick={handleForma2} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-sm font-medium transition-colors">Forma-2</button>
          <button onClick={handleForma3} className="px-3 py-1 bg-purple-600 hover:bg-purple-500 rounded text-sm font-medium transition-colors">Forma-3</button>
        </div>
      </div>
      <p className="text-sm">Tanlangan davr: tayyor · Smeta manbasi: mavjud</p>
      <p className="text-sm">Jami bajarilgan: {show(model.totals.cumulativeValue)} · Qolgan: {show(model.totals.remainingValue)}</p>
      <p className="text-xs text-slate-400">Biriktirilgan dalillar: {model.documents.length ? `${model.documents.length} ta hujjat` : 'qayd etilmagan'}</p>
      {model.reconciliation.length>0&&<p role="alert" className="text-red-300">Tekshiruvda {model.reconciliation.length} ta nomuvofiqlik bor: {model.reconciliation.map(x=>errorLabel[x.code] ?? 'Qator ma’lumoti mos emas').join(', ')}</p>}
    </section>
  );
}
export function ExportValidationSummary({errors}:{errors:readonly {lineId:Id;code:string}[]}){return <p className={errors.length?'text-red-300':'text-emerald-300'}>{errors.length?`${errors.length} ta eksport tekshiruvi talab qiladi`:'Eksport hisob-kitobi mos'}</p>}
export function ReconciliationErrors({errors}:{errors:readonly {lineId:Id;code:string}[]}){return <ul aria-label="Eksport nomuvofiqliklari">{errors.map(x=><li key={`${x.lineId}:${x.code}`}>{errorLabel[x.code] ?? 'Qator ma’lumoti mos emas'}</li>)}</ul>}
