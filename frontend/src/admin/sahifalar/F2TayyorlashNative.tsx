import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Save } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { toast } from '../../umumiy/ui/Toast';
import { FmtN } from '../../lib/format';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { sbT2AktYaratV2, sbT2ObyektlarOlKomp, yangiOperationId, type T2Obyekt } from '../../api/supabase';
import { sbQatorHolatOl, type QatorHolat } from '../../api/t2-fakt';
import { f2NativePayloadQur, type F2NativeInput } from '../../lib/f2-native-preparation';
import { f2NativeExportRowsQur } from '../../lib/f2-native-export';
import { generateForma2 } from '../../lib/construction-document-control/export/forma2-export';
import { downloadBlob } from '../../lib/construction-document-control/export/download-helper';

type Draft = Omit<F2NativeInput, 'qatorId'>;
const boshDraft: Draft = { quantity: '', unitPrice: '', amount: '', sourceReference: '', priceIntentionallyAbsent: false };
const oyBoshlanishi = () => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

/** T1 GASsiz F2 qoralama: only canonical Fakt qoldig'i + exact F2 document values. */
export function F2TayyorlashNative() {
  const { joriy } = useKompaniya();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [qatorlar, setQatorlar] = useState<QatorHolat[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [oy, setOy] = useState(oyBoshlanishi());
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
    if (!validId) { setQatorlar([]); return; }
    setLoading(true);
    try {
      const result = await sbQatorHolatOl(obyektId);
      setQatorlar(result.ok ? (result.qatorlar || []).filter((row) => row.tur !== 'rz' && row.f2_mumkin_hajm > 0) : []);
      setDrafts({});
      operationId.current = yangiOperationId();
    } finally { setLoading(false); }
  }, [obyektId, validId]);
  useEffect(() => { void yuklash(); }, [yuklash]);

  const tanlangan = useMemo(() => qatorlar.flatMap((row) => {
    const draft = drafts[row.qator_id];
    return draft?.quantity.trim() ? [{ qatorId: row.qator_id, ...draft }] : [];
  }), [drafts, qatorlar]);
  const tekshiruv = useMemo(() => f2NativePayloadQur(tanlangan, qatorlar.map((row) => ({ qatorId: row.qator_id, f2Mumkin: row.f2_mumkin_hajm }))), [tanlangan, qatorlar]);
  const issueMap = useMemo(() => new Map(tekshiruv.issues.map((issue) => [issue.qatorId, issue])), [tekshiruv.issues]);
  const ozgartir = (id: number, next: Partial<Draft>) => setDrafts((old) => ({ ...old, [id]: { ...(old[id] || boshDraft), ...next } }));

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
      const data = await generateForma2(f2NativeExportRowsQur(qatorlar, tekshiruv.qatorlar), {
        projectName: object.nom, objectName: object.nom, periodLabel: oy.slice(0, 7), documentNumber: `F2-QORALAMA-${obyektId}-${oy.slice(0, 7)}`,
      });
      downloadBlob(data, `Forma2_qoralama_${obyektId}_${oy.slice(0, 7)}.xlsx`);
    } catch { toast('Forma-2 Excel qoralamasini yaratib bo‘lmadi.', 'danger'); }
  };

  return <Sahifa sarlavha="F2 tayyorlash" tavsif="Fakt qoldig‘idan qoralama; narx va summa faqat F2 manbasidan">
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="karta flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">Obyekt
          <select value={validId ? obyektId : ''} onChange={(event) => setParams({ obyekt: event.target.value })} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text">
            <option value="">-- kanonik obyektni tanlang --</option>{obyektlar.map((object) => <option key={object.id} value={object.id}>{object.nom}</option>)}
          </select>
        </label>
        <label className="text-[12px] font-medium text-text">F2 davri<input type="month" value={oy.slice(0, 7)} onChange={(event) => setOy(`${event.target.value}-01`)} className="mt-1.5 block rounded-lg border border-border bg-surface-2 px-3 py-2 text-text" /></label>
      </section>
      {!validId && <section className="karta p-4 text-text-dim">Avval obyektni kanonik ro‘yxatdan tanlang.</section>}
      {loading && <div className="skel min-h-[260px] flex-1 rounded-xl" />}
      {validId && !loading && <section className="karta min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[1100px] text-left text-[12px]"><thead className="sticky top-0 bg-surface-2 text-text-dim"><tr><th className="p-3">Ish / kanonik qator</th><th>F2 mumkin</th><th>Joriy hajm</th><th>Narx</th><th>Hujjat summasi</th><th>Manba</th><th className="p-3">Holat</th></tr></thead>
          <tbody>{qatorlar.map((row) => { const draft = drafts[row.qator_id] || boshDraft; const issue = issueMap.get(row.qator_id); return <tr key={row.qator_id} className="border-t border-border/60 align-top"><td className="p-3"><div className="font-mono text-text-mute">#{row.qator_id} · {row.kod}</div><div>{row.nom}</div><div className="text-text-dim">{row.birlik}</div></td><td><FmtN val={row.f2_mumkin_hajm} /></td><td><input aria-label={`F2 hajm ${row.qator_id}`} type="number" min="0" value={draft.quantity} onChange={(event) => ozgartir(row.qator_id, { quantity: event.target.value })} className="w-28 rounded border border-border bg-bg px-2 py-1 text-right" /></td><td><input aria-label={`F2 narx ${row.qator_id}`} type="number" disabled={draft.priceIntentionallyAbsent} value={draft.unitPrice} onChange={(event) => ozgartir(row.qator_id, { unitPrice: event.target.value })} className="w-28 rounded border border-border bg-bg px-2 py-1 text-right disabled:opacity-50" /></td><td><input aria-label={`F2 summa ${row.qator_id}`} type="number" disabled={draft.priceIntentionallyAbsent} value={draft.amount} onChange={(event) => ozgartir(row.qator_id, { amount: event.target.value })} className="w-32 rounded border border-border bg-bg px-2 py-1 text-right disabled:opacity-50" /></td><td><input aria-label={`F2 manba ${row.qator_id}`} value={draft.sourceReference} onChange={(event) => ozgartir(row.qator_id, { sourceReference: event.target.value })} placeholder="F2 №, sahifa" className="w-40 rounded border border-border bg-bg px-2 py-1" /><label className="mt-1 block text-[10px] text-text-dim"><input type="checkbox" checked={draft.priceIntentionallyAbsent} onChange={(event) => ozgartir(row.qator_id, { priceIntentionallyAbsent: event.target.checked })} /> narx hujjatda ataylab yo‘q</label></td><td className="p-3">{issue ? <span className={issue.blocking ? 'text-danger' : 'text-warn'}>{issue.code === 'ARITHMETIC_MISMATCH' ? 'Arifmetik farq — summa saqlanadi' : issue.code}</span> : draft.quantity ? <span className="text-ok">Tayyor</span> : <span className="text-text-dim">Tanlanmagan</span>}</td></tr>; })}</tbody>
        </table>
      </section>}
      {validId && <section className="flex flex-wrap items-center justify-between gap-3"><p className="flex items-center gap-1 text-[12px] text-text-dim"><AlertTriangle size={14} /> Smeta narxi fallback emas. Arifmetik farq faqat ogohlantirish; hujjat summasi aynan saqlanadi.</p><div className="flex items-center gap-2"><button onClick={() => navigate(`/admin/f2-tarix?obyekt=${obyektId}`)} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold text-text">F2 tarixini ko‘rish</button><button onClick={() => void excelYuklash()} disabled={!tekshiruv.ok || saving} className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-50"><Download size={16} />Forma-2 Excel qoralama</button><button onClick={() => void saqlash()} disabled={!tekshiruv.ok || saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Yaratilmoqda…' : `F2 qoralama yaratish (${tekshiruv.qatorlar.length})`}</button></div></section>}
    </div>
  </Sahifa>;
}

export default F2TayyorlashNative;
