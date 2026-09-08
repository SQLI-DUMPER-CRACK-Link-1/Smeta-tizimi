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
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConstructionDocumentWorkbench } from '../../components/construction-document-control';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaKerak } from '../../umumiy/kontekst/KompaniyaKerak';
import { Skelet } from '../../umumiy/ui/Sahifa';
import { sbT2LoyihalarOl, type Loyiha } from '../../api/t2-loyiha';
import { useHujjatNazoratModel, progressValuationPage } from '../../api/t2-document-control';

export default function HujjatNazoratPage() {
  const { joriy } = useKompaniya();
  const [loyihalar, setLoyihalar] = useState<Loyiha[]>([]);
  const [loyihaId, setLoyihaId] = useState<number | null>(null);
  const [obyektId, setObyektId] = useState<number | null>(null);
  const [davr, setDavr] = useState('');
  const [qidiruv, setQidiruv] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [pageOffset, setPageOffset] = useState(0);

  useEffect(() => {
    if (!joriy?.id) { setLoyihalar([]); setLoyihaId(null); setObyektId(null); return; }
    sbT2LoyihalarOl(joriy.id).then((r) => {
      const rows = (r.ok ? (r.qatorlar as Loyiha[]) : []) || [];
      setLoyihalar(rows);
      setLoyihaId((p) => p ?? rows[0]?.id ?? null);
    });
  }, [joriy?.id]);

  const loyiha = useMemo(() => loyihalar.find((l) => l.id === loyihaId) ?? null, [loyihalar, loyihaId]);
  useEffect(() => { setObyektId((p) => (loyiha?.obyektlar.some((o) => o.obyekt_id === p) ? p : loyiha?.obyektlar[0]?.obyekt_id ?? null)); setDavr(''); setQidiruv(''); setSectionId(''); setPageOffset(0); }, [loyiha]);

  const q = useHujjatNazoratModel(obyektId, davr || null);
  const model = q.data;
  const pageSize = 300;
  const page = useMemo(() => (model ? progressValuationPage(model, { limit: pageSize, offset: pageOffset, search: qidiruv, sectionId: sectionId || undefined }) : null), [model, pageOffset, qidiruv, sectionId]);
  const sectionOptions = useMemo(() => {
    if (!model) return [];
    const labels = new Map<string, string>();
    for (const line of model.valuation.lines) if (!labels.has(line.sectionId)) labels.set(line.sectionId, line.description || `Bo‘lim ${labels.size + 1}`);
    return [...labels.entries()];
  }, [model]);
  const notApplied = (q.error as any)?.code === 'HTTP_501';
  const noPerm = (q.error as any)?.code === 'HTTP_403';

  if (!joriy?.id) return <KompaniyaKerak nima="Hujjat nazorati (F2/Nakopitelniy)" />;

  return (
    <div className="os-workbench text-text space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">PTO · HUJJAT NAZORATI</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Nakopitelniy va tasdiqlangan F2</h1>
          <p className="mt-1 max-w-2xl text-sm text-text-dim">Smeta, o‘zgarishlar, F2 davrlari va yopilish dalillarini bitta kanonik ish oynasida tekshiring.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-ok/20 bg-ok/5 px-3 py-1.5 text-xs text-ok">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" /> Supabase read-model
        </div>
      </header>
      {joriy?.id && (
        <div className="karta flex flex-wrap items-end gap-3 p-3">
          <label className="text-[13px] min-w-[220px]">
            <span className="mr-2 text-text-dim">Loyiha</span>
            <select className="rounded-lg border border-border bg-surface px-2 py-1"
              value={loyihaId ?? ''} onChange={(e) => { setLoyihaId(Number(e.target.value) || null); setPageOffset(0); }}>
              {loyihalar.length === 0 && <option value="">— loyiha yo‘q —</option>}
              {loyihalar.map((l) => <option key={l.id} value={l.id}>{l.nom}</option>)}
            </select>
          </label>
          <label className="text-[13px] min-w-[220px]">
            <span className="mr-2 text-text-dim">Obyekt</span>
            <select className="rounded-lg border border-border bg-surface px-2 py-1"
              value={obyektId ?? ''} onChange={(e) => { setObyektId(Number(e.target.value) || null); setPageOffset(0); }}>
              {(loyiha?.obyektlar ?? []).length === 0 && <option value="">— obyekt yo‘q —</option>}
              {(loyiha?.obyektlar ?? []).map((o) => <option key={o.obyekt_id} value={o.obyekt_id}>{o.obyekt_nom}</option>)}
            </select>
          </label>
          <label className="text-[13px] min-w-[190px]"><span className="mr-2 text-text-dim">Davr</span><select className="rounded-lg border border-border bg-surface px-2 py-1" value={davr} onChange={(e) => { setDavr(e.target.value); setPageOffset(0); }}><option value="">Joriy tasdiqlangan davr</option>{(model?.valuation.periods ?? []).map((period) => <option key={period.periodId} value={period.periodId}>{period.label}</option>)}</select></label>
          <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 text-[13px] text-text-dim"><Search size={14} /><input aria-label="Nakopitelniy qatoridan qidirish" value={qidiruv} onChange={(e) => { setQidiruv(e.target.value); setPageOffset(0); }} placeholder="Ish / resurs qidirish…" className="min-w-0 flex-1 bg-transparent text-text outline-none" /></label>
          <label className="text-[13px] min-w-[190px]"><span className="mr-2 text-text-dim">Bo‘lim</span><select className="rounded-lg border border-border bg-surface px-2 py-1" value={sectionId} onChange={(e) => { setSectionId(e.target.value); setPageOffset(0); }}><option value="">Barcha bo‘limlar</option>{sectionOptions.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        </div>
      )}

      {notApplied && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100 flex items-start gap-2 max-w-3xl">
          <Info size={16} className="mt-0.5 shrink-0" />
          <div>Hujjat nazorati bu obyekt uchun hozircha mavjud emas.</div>
        </div>
      )}

      {noPerm && <p className="text-sm text-rose-300">Bu obyekt uchun ruxsat yo‘q.</p>}
      {q.isLoading && <Skelet qatorlar={6} />}
      {q.isError && !notApplied && !noPerm && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger"><span className="flex-1">Ma’lumotlarni yuklab bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.</span><button type="button" onClick={() => void q.refetch()} className="rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-semibold hover:bg-danger/10">Qayta urinish</button></div>
      )}

      {model && page && <>
        <ConstructionDocumentWorkbench model={model} page={page} />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3 text-xs text-text-dim" aria-label="Nakopitelniy sahifalash"><span>{page.totalCount === 0 ? 'Qator topilmadi' : `${page.query.offset + 1}–${page.query.offset + page.rows.length} / ${page.totalCount} qator`}</span><div className="flex items-center gap-2"><button type="button" onClick={() => setPageOffset((old) => Math.max(0, old - pageSize))} disabled={pageOffset === 0} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-text disabled:opacity-40"><ChevronLeft size={14} />Oldingi</button><button type="button" onClick={() => setPageOffset((old) => old + pageSize)} disabled={pageOffset + page.rows.length >= page.totalCount} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-text disabled:opacity-40">Keyingi<ChevronRight size={14} /></button></div></div>
      </>}

    </div>
  );
}
