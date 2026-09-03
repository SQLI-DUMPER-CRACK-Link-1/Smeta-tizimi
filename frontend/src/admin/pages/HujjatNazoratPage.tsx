/**
 * HujjatNazoratPage.tsx — canonical /admin/hujjat-nazorat.
 * The visible SMETA/F2/NAKOPITELNIY document-control workbench: it feeds the
 * generic Codex <ConstructionDocumentWorkbench> from the REAL canonical read
 * model (t2_workbench_v1 via /api/hujjat-nazorat). No Drive/Sheets/GAS. No demo
 * data. Forma-3 legal totals stay intentionally unavailable (FORMA3_RULE_UNRESOLVED).
 * EGALIK: Claude (integration lane).
 */
import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { ConstructionDocumentWorkbench } from '../../components/construction-document-control';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaKerak } from '../../umumiy/kontekst/KompaniyaKerak';
import { sbT2LoyihalarOl, type Loyiha } from '../../api/t2-loyiha';
import { useHujjatNazoratModel, progressValuationPage } from '../../api/t2-document-control';

export default function HujjatNazoratPage() {
  const { joriy } = useKompaniya();
  const [loyihalar, setLoyihalar] = useState<Loyiha[]>([]);
  const [loyihaId, setLoyihaId] = useState<number | null>(null);
  const [obyektId, setObyektId] = useState<number | null>(null);

  useEffect(() => {
    if (!joriy?.id) { setLoyihalar([]); setLoyihaId(null); setObyektId(null); return; }
    sbT2LoyihalarOl(joriy.id).then((r) => {
      const rows = (r.ok ? (r.qatorlar as Loyiha[]) : []) || [];
      setLoyihalar(rows);
      setLoyihaId((p) => p ?? rows[0]?.id ?? null);
    });
  }, [joriy?.id]);

  const loyiha = useMemo(() => loyihalar.find((l) => l.id === loyihaId) ?? null, [loyihalar, loyihaId]);
  useEffect(() => { setObyektId((p) => (loyiha?.obyektlar.some((o) => o.obyekt_id === p) ? p : loyiha?.obyektlar[0]?.obyekt_id ?? null)); }, [loyiha]);

  const q = useHujjatNazoratModel(obyektId);
  const model = q.data;
  const page = useMemo(() => (model ? progressValuationPage(model, { limit: 300 }) : null), [model]);
  const notApplied = (q.error as any)?.code === 'HTTP_501';
  const noPerm = (q.error as any)?.code === 'HTTP_403';

  if (!joriy?.id) return <KompaniyaKerak nima="Hujjat nazorati (F2/Nakopitelniy)" />;

  return (
    <div className="p-6 bg-bg min-h-screen text-text space-y-4">
      {joriy?.id && (
        <div className="flex flex-wrap gap-3">
          <label className="text-[13px]">
            <span className="mr-2 text-text-dim">Loyiha</span>
            <select className="rounded-lg border border-border bg-surface px-2 py-1"
              value={loyihaId ?? ''} onChange={(e) => setLoyihaId(Number(e.target.value) || null)}>
              {loyihalar.length === 0 && <option value="">— loyiha yo‘q —</option>}
              {loyihalar.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
            </select>
          </label>
          <label className="text-[13px]">
            <span className="mr-2 text-text-dim">Obyekt</span>
            <select className="rounded-lg border border-border bg-surface px-2 py-1"
              value={obyektId ?? ''} onChange={(e) => setObyektId(Number(e.target.value) || null)}>
              {(loyiha?.obyektlar ?? []).length === 0 && <option value="">— obyekt yo‘q —</option>}
              {(loyiha?.obyektlar ?? []).map((o) => <option key={o.obyekt_id} value={o.obyekt_id}>{o.obyekt_nom}</option>)}
            </select>
          </label>
        </div>
      )}

      {notApplied && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-3xl">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>Hujjat nazorati bu obyekt uchun hozircha mavjud emas.</div>
        </div>
      )}

      {noPerm && <p className="text-sm text-rose-300">Bu obyekt uchun ruxsat yo‘q.</p>}
      {q.isLoading && <p className="text-sm text-text-dim">Yuklanmoqda…</p>}
      {q.isError && !notApplied && !noPerm && (
        <p className="text-sm text-rose-300">Xato: {String((q.error as any)?.code || (q.error as any)?.message || 'noma’lum')}</p>
      )}

      {model && page && <ConstructionDocumentWorkbench model={model} page={page} />}

      {model && model.valuation.periods.length === 0 && (
        <p className="text-sm text-text-dim">Bu obyektda hali tasdiqlangan Ф2 davri yo‘q — Nakopitelniy bo‘sh.</p>
      )}
    </div>
  );
}
