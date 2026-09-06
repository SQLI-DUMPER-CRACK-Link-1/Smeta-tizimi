import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Check, Download, Search, Save, X } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { IkkiPanel } from '../../umumiy/ui/IkkiPanel';
import { F2Daraxt, type DaraxtTugun } from '../../umumiy/ui/F2Daraxt';
import { toast } from '../../umumiy/ui/Toast';
import { FmtN } from '../../lib/format';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { sbT2AktYaratV2, sbT2DaraxtOl, sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt, type T2Qator } from '../../api/supabase';
import { sbQatorHolatOl, type QatorHolat } from '../../api/t2-fakt';
import { f2NativePayloadQur, type F2NativeInput, type F2NativeIssue } from '../../lib/f2-native-preparation';
import { f2NativeExportRowsQur } from '../../lib/f2-native-export';
import { generateForma2 } from '../../lib/construction-document-control/export/forma2-export';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';

type Draft = Omit<F2NativeInput, 'qatorId'>;
const boshDraft: Draft = { quantity: '', unitPrice: '', amount: '', sourceReference: '', priceIntentionallyAbsent: false };
const oyBoshlanishi = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

function sonMatni(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('uz-UZ', { maximumFractionDigits: 3 });
}

function daraxtniQidir(nodes: DaraxtTugun[], query: string): DaraxtTugun[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const out: DaraxtTugun[] = [];
  for (const node of nodes) {
    const children = node.children ? daraxtniQidir(node.children, query) : [];
    const selfMatches = [node.nom, node.kod, node.bir].filter(Boolean).join(' ').toLowerCase().includes(q);
    if (selfMatches || children.length > 0) out.push({ ...node, children });
  }
  return out;
}

function issueMessage(issue: F2NativeIssue) {
  switch (issue.code) {
    case 'QTY_INVALID': return 'Joriy hajmni kiriting';
    case 'QTY_EXCEEDS_FAKT': return 'F2 mumkin hajmidan oshib ketdi';
    case 'SOURCE_REQUIRED': return 'F2 manbasi ko‘rsatilmagan';
    case 'PRICE_REQUIRED': return 'F2 narxi kiritilmagan';
    case 'AMOUNT_REQUIRED': return 'F2 summasi kiritilmagan';
    case 'ARITHMETIC_MISMATCH': return 'Hajm × narx va hujjat summasi farq qiladi';
    default: return 'Tekshiruv kerak';
  }
}

function sectionFor(qatorId: number, rows: Map<number, T2Qator>) {
  let current = rows.get(qatorId);
  let guard = 0;
  while (current && guard++ < 100) {
    if (current.tur === 'rz') return current.nom || 'Bo‘lim';
    current = current.ota_id == null ? undefined : rows.get(current.ota_id);
  }
  return 'Boshqa ishlar';
}

/** T1 GASsiz F2 qoralama: faqat canonical Fakt qoldig'i + exact F2 document values. */
export function F2TayyorlashNative() {
  const { joriy } = useKompaniya();
  const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [qatorlar, setQatorlar] = useState<QatorHolat[]>([]);
  const [smetaRows, setSmetaRows] = useState<T2Qator[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [oy, setOy] = useState(oyBoshlanishi());
  const [qidiruv, setQidiruv] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const operationId = useRef(yangiOperationId());
  const obyektId = Number(params.get('obyekt'));
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;

  useEffect(() => {
    if (!joriy?.id) return;
    void sbT2ObyektlarOlKomp(joriy.id).then((result) => setObyektlar((result.ok ? result.qatorlar : []) as T2Obyekt[]));
  }, [joriy?.id]);

  const yuklash = useCallback(async () => {
    if (!validId) { setQatorlar([]); setSmetaRows([]); return; }
    setLoading(true);
    try {
      const [holat, daraxt] = await Promise.all([sbQatorHolatOl(obyektId), sbT2DaraxtOl(obyektId)]);
      setQatorlar(holat.ok ? (holat.qatorlar || []) : []);
      setSmetaRows(daraxt.ok ? ((daraxt.qatorlar || []) as T2Qator[]) : []);
      setDrafts({});
      operationId.current = yangiOperationId();
    } finally { setLoading(false); }
  }, [obyektId, validId]);
  useEffect(() => { void yuklash(); }, [yuklash]);

  const holatById = useMemo(() => new Map(qatorlar.map((row) => [row.qator_id, row])), [qatorlar]);
  const qatorById = useMemo(() => new Map(smetaRows.map((row) => [row.id, row])), [smetaRows]);
  const tanlanganIds = useMemo(() => new Set(Object.entries(drafts).filter(([, draft]) => draft.quantity.trim()).map(([id]) => Number(id))), [drafts]);
  const tanlangan = useMemo(() => qatorlar.flatMap((row) => {
    const draft = drafts[row.qator_id];
    return draft?.quantity.trim() ? [{ qatorId: row.qator_id, ...draft }] : [];
  }), [drafts, qatorlar]);
  const tekshiruv = useMemo(() => f2NativePayloadQur(tanlangan, qatorlar.map((row) => ({ qatorId: row.qator_id, f2Mumkin: row.f2_mumkin_hajm }))), [tanlangan, qatorlar]);
  const issueMap = useMemo(() => new Map(tekshiruv.issues.map((issue) => [issue.qatorId, issue])), [tekshiruv.issues]);
  const jamiSumma = useMemo(() => {
    if (!tekshiruv.qatorlar.length || tekshiruv.qatorlar.some((row) => row.certifiedAmount == null)) return null;
    return tekshiruv.qatorlar.reduce((sum, row) => sum + (row.certifiedAmount || 0), 0);
  }, [tekshiruv.qatorlar]);

  const ozgartir = (id: number, next: Partial<Draft>) => setDrafts((old) => ({ ...old, [id]: { ...(old[id] || boshDraft), ...next } }));
  const tanlovniAlmashtir = (id: number) => {
    setDrafts((old) => {
      if (old[id]) {
        const next = { ...old };
        delete next[id];
        return next;
      }
      const holat = holatById.get(id);
      return { ...old, [id]: { ...boshDraft, quantity: holat && holat.f2_mumkin_hajm > 0 ? String(holat.f2_mumkin_hajm) : '' } };
    });
  };

  const smetaDaraxti = useMemo(() => {
    const allowed = new Set<number>();
    const includeAncestors = (id: number) => {
      let current = qatorById.get(id);
      let guard = 0;
      while (current && guard++ < 100) {
        if (allowed.has(current.id)) break;
        allowed.add(current.id);
        current = current.ota_id == null ? undefined : qatorById.get(current.ota_id);
      }
    };
    for (const row of qatorlar) if (row.tur !== 'rz' && row.f2_mumkin_hajm > 0) includeAncestors(row.qator_id);
    const nodes = new Map<number, DaraxtTugun>();
    for (const row of smetaRows) {
      if (!allowed.has(row.id)) continue;
      const holat = holatById.get(row.id);
      const tanlangan = tanlanganIds.has(row.id);
      nodes.set(row.id, {
        kalit: String(row.id), type: row.tur || 'rs', nom: row.nom || 'Nomsiz smeta qatori', kod: row.kod || undefined,
        bir: row.birlik || undefined, hajm: row.hajm ?? undefined, summa: row.summa ?? undefined,
        belgi: row.tur === 'rz' ? 'Bo‘lim' : `Mumkin: ${sonMatni(holat?.f2_mumkin_hajm)} · Fakt: ${sonMatni(holat?.fakt_hajm)}`,
        isQosh: Boolean(row.qoshimcha), isZamena: Boolean(row.zamena),
        nazorat: row.tur !== 'rz' ? <div className="flex items-center gap-1.5">
          <input type="checkbox" aria-label={`F2 qatorini tanlash ${row.kod || row.nom || row.id}`} checked={tanlangan} onChange={() => tanlovniAlmashtir(row.id)} />
          {tanlangan && <input aria-label={`F2 miqdori ${row.kod || row.nom || row.id}`} type="number" min="0" step="any" value={drafts[row.id]?.quantity || ''} onChange={(event) => ozgartir(row.id, { quantity: event.target.value })} className="w-24 rounded border border-border bg-bg px-1.5 py-1 text-right text-[11px]" />}
        </div> : undefined,
      });
    }
    const roots: DaraxtTugun[] = [];
    for (const row of smetaRows) {
      const node = nodes.get(row.id);
      if (!node) continue;
      const parent = row.ota_id == null ? undefined : nodes.get(row.ota_id);
      if (parent) parent.children = [...(parent.children || []), node];
      else roots.push(node);
    }
    return roots;
  }, [qatorlar, smetaRows, holatById, qatorById, tanlanganIds, drafts]);
  const visibleSmetaDaraxti = useMemo(() => daraxtniQidir(smetaDaraxti, qidiruv), [smetaDaraxti, qidiruv]);

  const previewSections = useMemo(() => {
    const sections = new Map<string, typeof tanlangan>();
    for (const row of tanlangan) {
      const title = sectionFor(row.qatorId, qatorById);
      const group = sections.get(title) || [];
      group.push(row);
      sections.set(title, group);
    }
    return [...sections.entries()];
  }, [tanlangan, qatorById]);

  const saqlash = async () => {
    if (!validId || !tekshiruv.ok || saving) return;
    setSaving(true);
    try {
      const result = await sbT2AktYaratV2({ obyektId, oy, operationId: operationId.current, qatorlar: tekshiruv.qatorlar });
      if (!result.ok) { toast(result.error || result.xabar || 'F2 qoralama yaratilmadi.', 'danger'); return; }
      toast('Kanonik F2 qoralama yaratildi. Tasdiqlash alohida boshqaruv amali.', 'ok');
      await yuklash();
    } catch { toast('Javob olinmadi. Shu amal IDsi bilan qayta urinishingiz mumkin.', 'danger'); }
    finally { setSaving(false); }
  };

  const excelYuklash = async () => {
    if (!validId || !tekshiruv.ok) return;
    const object = obyektlar.find((item) => item.id === obyektId);
    if (!object) { toast('Kanonik obyekt topilmadi.', 'danger'); return; }
    try {
      const data = await generateForma2(f2NativeExportRowsQur(qatorlar, tekshiruv.qatorlar), { projectName: object.nom, objectName: object.nom, periodLabel: oy.slice(0, 7), documentNumber: `F2-QORALAMA-${obyektId}-${oy.slice(0, 7)}` });
      downloadBlob(data, `Forma2_qoralama_${obyektId}_${oy.slice(0, 7)}.xlsx`);
    } catch { toast('Forma-2 Excel qoralamasini yaratib bo‘lmadi.', 'danger'); }
  };

  const preview = <div className="h-full overflow-auto p-3 space-y-4">
    <div className="rounded-lg border border-border bg-surface-2/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-text">Forma-2 qoralama</span><span className="text-text-dim">{tanlangan.length} qator · jami {jamiSumma == null ? '—' : <FmtN val={jamiSumma} />}</span></div>
      <p className="mt-1 text-text-dim">Summalar hujjat manbasidan olinadi. Manba summasi bo‘lmasa tizim summa to‘qimaydi.</p>
    </div>
    {previewSections.length === 0 && <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-text-dim">Chap daraxtdan F2 qatorlarini tanlang. Tanlov shu yerda darhol ko‘rinadi.</div>}
    {previewSections.map(([section, rows]) => <section key={section} className="rounded-lg border border-border overflow-hidden">
      <header className="bg-surface-2/60 px-3 py-2 text-xs font-semibold text-text">{section}</header>
      <div className="divide-y divide-border/60">{rows.map((row) => {
        const draft = drafts[row.qatorId] || boshDraft;
        const source = tekshiruv.qatorlar.find((item) => item.qatorId === row.qatorId);
        const issue = issueMap.get(row.qatorId);
        const model = qatorById.get(row.qatorId);
        return <article key={row.qatorId} className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-3"><div><div className="text-sm font-medium text-text">{model?.nom || 'Smeta qatori'}</div><div className="text-[11px] text-text-dim">{model?.kod || 'Kod ko‘rsatilmagan'} · {model?.birlik || 'birlik ko‘rsatilmagan'}</div></div><button type="button" onClick={() => tanlovniAlmashtir(row.qatorId)} aria-label={`F2 qatorini olib tashlash ${model?.nom || row.qatorId}`} className="rounded p-1 text-text-dim hover:bg-danger/10 hover:text-danger"><X size={15} /></button></div>
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4"><span className="text-text-dim">F2 mumkin <b className="text-text">{sonMatni(holatById.get(row.qatorId)?.f2_mumkin_hajm)}</b></span><span className="text-text-dim">Joriy <b className="text-text">{draft.quantity || '—'}</b></span><span className="text-text-dim">Narx <b className="text-text">{draft.priceIntentionallyAbsent ? 'Manbada yo‘q' : draft.unitPrice || '—'}</b></span><span className="text-text-dim">Summa <b className="text-text">{draft.priceIntentionallyAbsent ? '—' : draft.amount || '—'}</b></span></div>
          <div className="flex items-center gap-2 text-[11px]">{source && !issue ? <><Check size={14} className="text-ok" /><span className="text-ok">Tekshiruvdan o‘tdi</span></> : issue ? <><AlertTriangle size={14} className={issue.blocking ? 'text-danger' : 'text-warn'} /><span className={issue.blocking ? 'text-danger' : 'text-warn'}>{issueMessage(issue)}</span></> : <span className="text-text-dim">Ma’lumot kutilmoqda</span>}</div>
        </article>;
      })}</div>
    </section>)}
  </div>;

  return <Sahifa sarlavha="F2 tayyorlash" tavsif="Fakt qoldig‘idan kanonik qoralama; narx va summa faqat F2 manbasidan">
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="karta sticky top-0 z-10 flex flex-wrap items-end gap-3 bg-bg/95 p-3 backdrop-blur">
        <label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">Kanonik obyekt
          <select value={validId ? obyektId : ''} onChange={(event) => setParams({ obyekt: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text"><option value="">-- obyektni tanlang --</option>{obyektlar.map((object) => <option key={object.id} value={object.id}>{object.nom}</option>)}</select>
        </label>
        <label className="text-[12px] font-medium text-text">F2 davri<input type="month" value={oy.slice(0, 7)} onChange={(event) => setOy(`${event.target.value}-01`)} className="mt-1.5 block rounded-lg border border-border bg-surface-2 px-3 py-2 text-text" /></label>
        {validId && <label className="min-w-[220px] flex-1 text-[12px] font-medium text-text"><span className="flex items-center gap-1 text-text-dim"><Search size={13} /> Smeta qatorlarini qidirish</span><input value={qidiruv} onChange={(event) => setQidiruv(event.target.value)} placeholder="Kod yoki nom" className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text" /></label>}
      </section>
      {!validId && <section className="karta p-4 text-text-dim">Avval obyektni kanonik ro‘yxatdan tanlang.</section>}
      {loading && <div className="skel min-h-[360px] flex-1 rounded-xl" />}
      {validId && !loading && <IkkiPanel
        chapSarlavha={<>F2 olish mumkin <span className="text-text-mute">({tanlangan.length} tanlangan)</span></>}
        ongSarlavha={<>Forma-2 qoralama preview <span className="text-text-mute">({tanlangan.length})</span></>}
        balandlik="min(68vh, 760px)"
        chap={<F2Daraxt tugunlar={visibleSmetaDaraxti} bogMi={(key) => tanlanganIds.has(Number(key))} bosh="F2 olish mumkin bo‘lgan qator topilmadi" />}
        ong={preview}
      />}
      {validId && !loading && <section className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1 text-[12px] text-text-dim"><AlertTriangle size={14} /> Smeta narxi fallback emas. Arifmetik farq faqat ogohlantirish; hujjat summasi aynan saqlanadi.</p>
        <div className="flex items-center gap-2"><button onClick={() => void excelYuklash()} disabled={!tekshiruv.ok || saving} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-50"><Download size={16} />Forma-2 Excel qoralama</button><button onClick={() => void saqlash()} disabled={!tekshiruv.ok || saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Yaratilmoqda…' : `F2 qoralama yaratish (${tekshiruv.qatorlar.length})`}</button></div>
      </section>}
    </div>
  </Sahifa>;
}

export default F2TayyorlashNative;
