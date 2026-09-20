import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Target } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { SmetaTree } from '../../umumiy/daraxt/SmetaTree';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { sbT2DaraxtOl, sbT2ObyektlarOlKomp, sbT2QatorHolatOl, sbT2TreeQur, yangiOperationId, type T2Obyekt, type T2Qator, type T2QatorHolat } from '../../api/supabase';
import { sbFaktBelgilaV2, sbFaktYoz } from '../../api/t2-fakt';
import { priceControlOl, type PriceControlLine } from '../../api/t2-price-control';
import type { TreeNode } from '../../api/types';
import { faktQoldaKiritiladimi } from '../../lib/fakt-input-policy';
import { toast } from '../../umumiy/ui/Toast';

function walk(nodes: TreeNode[], fn: (n: TreeNode) => void) { for (const n of nodes) { fn(n); if (n.children) walk(n.children, fn); } }

export function FaktNative() {
  const { joriy } = useKompaniya(); const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]); const [rows, setRows] = useState<T2Qator[]>([]); const [states, setStates] = useState<T2QatorHolat[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]); const [price, setPrice] = useState<PriceControlLine[]>([]); const [marker, setMarker] = useState('');
  const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  const obyektId = Number(params.get('obyekt')); const valid = Number.isSafeInteger(obyektId) && obyektId > 0; const selected = obyektlar.find(o => o.id === obyektId);
  const markers = useMemo(() => Array.from(new Set(rows.filter(r => faktQoldaKiritiladimi(r.tur || '') && r.kat?.trim()).map(r => r.kat!.trim()))).sort(), [rows]);
  const smetaJami = states.reduce((s, r) => s + (r.smeta_hajm || 0), 0); const faktJami = states.reduce((s, r) => s + (r.fakt_hajm || 0), 0);
  useEffect(() => { if (joriy?.id) void sbT2ObyektlarOlKomp(joriy.id).then(r => setObyektlar((r.ok ? r.qatorlar : []) as T2Obyekt[])); }, [joriy?.id]);
  const yuklash = useCallback(async () => {
    if (!valid) { setTree([]); return; } setLoading(true); setError('');
    try { const [d, h, p] = await Promise.all([sbT2DaraxtOl(obyektId), sbT2QatorHolatOl(obyektId), priceControlOl(obyektId)]);
      if (!d.ok || !h.ok) throw new Error(d.error || h.error || 'Kanonik Fakt daraxti o‘qilmadi.');
      const nextRows = (d.qatorlar || []) as T2Qator[]; const nextStates = (h.qatorlar || []) as T2QatorHolat[];
      setRows(nextRows); setStates(nextStates); setTree(sbT2TreeQur(nextRows, nextStates)); setPrice(p.ok ? p.qatorlar : []);
    } catch (e) { setTree([]); setRows([]); setStates([]); setError(e instanceof Error ? e.message : 'Fakt daraxti o‘qilmadi.'); } finally { setLoading(false); }
  }, [obyektId, valid]);
  useEffect(() => { void yuklash(); }, [yuklash, refresh]);
  const faktSaqlash = useCallback(async (node: TreeNode, mode: 'qoshish' | 'jami', value: number) => {
    if (!valid || node.id == null) return { ok: false, message: 'Kanonik qator ID topilmadi.' };
    if (!faktQoldaKiritiladimi(node.type)) return { ok: false, message: 'Bu qatorga Fakt qo‘lda kiritilmaydi.' };
    const sana = new Date().toISOString().slice(0, 10); const operationId = yangiOperationId();
    if (mode === 'qoshish') { const r = await sbFaktYoz({ obyektId, sana, operationId, qatorlar: [{ qator_id: node.id, hajm: value }], izoh: 'Fakt daraxtidan kanonik qo‘shish' }); if (!r.ok) return { ok: false, message: r.error || r.xabar || 'Fakt qo‘shilmadi.' }; }
    else { const r = await sbFaktBelgilaV2({ obyektId, qatorId: node.id, expectedFaktHajm: Number(node.fakt || 0), yangiFaktHajm: value, sana, operationId, izoh: 'Fakt daraxtidan kanonik jami tahriri' }); if (!r.ok) return { ok: false, conflict: r.code === 'FAKT_CONFLICT', message: r.code === 'FAKT_CONFLICT' ? 'Qator serverda o‘zgargan. Yangilang.' : (r.error || r.xabar || 'Fakt saqlanmadi.') }; }
    setRefresh(n => n + 1); return { ok: true };
  }, [obyektId, valid]);
  const yuz = async () => {
    if (!marker || saving) return; const targets: TreeNode[] = []; walk(tree, n => { if (faktQoldaKiritiladimi(n.type) && String(n.kat || '').trim() === marker && n.smetaHajm != null && n.fakt !== n.smetaHajm) targets.push(n); });
    if (!targets.length) { toast('Bu markirovkada bajarilmagan hajm topilmadi.', 'warn'); return; } setSaving(true); let ok = 0; let fail = 0;
    try { for (const n of targets) { const r = await sbFaktBelgilaV2({ obyektId, qatorId: n.id!, expectedFaktHajm: Number(n.fakt || 0), yangiFaktHajm: n.smetaHajm!, sana: new Date().toISOString().slice(0, 10), operationId: yangiOperationId(), izoh: `Markirovka ${marker} bo‘yicha 100% Fakt` }); if (r.ok) ok++; else fail++; } toast(`${ok} ta qator 100% ga belgilandi${fail ? `, ${fail} ta qator saqlanmadi` : ''}.`, fail ? 'warn' : 'ok'); setRefresh(n => n + 1); } catch { toast('100% belgilash vaqtida javob olinmadi.', 'danger'); } finally { setSaving(false); }
  };
  return <Sahifa sarlavha="Bajarilgan ishlar (Fakt)" tavsif="Smeta hajmi va Faktni RZ → BL → RS/MAT/OB daraxtida boshqaring">
    <div className="flex h-full min-h-0 flex-col gap-3"><section className="karta flex flex-wrap items-end gap-3 p-3"><label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">Obyekt<select aria-label="Obyekt" value={valid ? obyektId : ''} onChange={e => { const o = obyektlar.find(x => x.id === Number(e.target.value)); setParams({ obyekt: e.target.value, obyekt_nomi: o?.nom || '' }); }} className="input mt-1.5 block h-9 w-full px-2 text-[13px]"><option value="">-- obyektni tanlang --</option>{obyektlar.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}</select></label>{valid && <button onClick={() => navigate(`/admin/holat/${obyektId}?obyekt_nomi=${encodeURIComponent(selected?.nom || '')}`)} className="rounded-lg border border-border px-3 py-2 text-[12px]">LRVga qaytish</button>}{valid && <button onClick={() => void yuklash()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px]"><RefreshCw size={14}/> Yangilash</button>}</section>
      {valid && !loading && !error && tree.length > 0 && <section className="karta flex flex-wrap items-end gap-3 p-3" aria-label="Fakt markirovka boshqaruvi"><span className="text-[12px] text-text-dim"><b className="text-text">Smeta:</b> {smetaJami.toLocaleString('ru-RU')} · <b className="text-text">Fakt:</b> {faktJami.toLocaleString('ru-RU')}</span><label className="min-w-[220px] text-[12px] font-medium text-text">Markirovka bo‘yicha 100%<select aria-label="Fakt markirovkasi" value={marker} onChange={e => setMarker(e.target.value)} className="input mt-1 block h-9 w-full px-2"><option value="">Markirovkani tanlang</option>{markers.map(m => <option key={m} value={m}>{m}</option>)}</select></label><button onClick={() => void yuz()} disabled={!marker || saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-white disabled:opacity-50"><Target size={14}/> {saving ? 'Belgilanmoqda…' : '100% qilish'}</button><span className="text-[11px] text-text-mute">Faqat BL/MAT/OB; RS avtomatik hisoblanadi.</span></section>}
      {!valid && <section className="karta p-4 text-text-dim">Avval kanonik obyektni tanlang.</section>}{error && valid && <section role="alert" className="karta flex items-center gap-2 border-danger/40 bg-danger/5 p-4 text-danger"><AlertTriangle size={16}/>{error}</section>}{loading && <div className="skel min-h-[280px] flex-1 rounded-xl"/>}{valid && !loading && !error && tree.length === 0 && <section className="karta p-5 text-[13px] text-text-dim">Bu obyektda kanonik smeta daraxti yo‘q. Avval Smeta/LRV paketini import qiling.</section>}{tree.length > 0 && !loading && !error && <div className="min-h-0 flex-1"><SmetaTree data={tree} priceControlLines={price} onFaktSave={faktSaqlash} onQatorTahrirlandi={yuklash}/></div>}
    </div></Sahifa>;
}
export default FaktNative;
