import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Database, RefreshCw } from 'lucide-react';
import { SmetaTree } from '../../umumiy/daraxt/SmetaTree';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import {
  sbT2DaraxtOl, sbT2ObyektlarOlKomp, sbT2QatorHolatOl, sbT2TreeQur,
  type T2Obyekt,
} from '../../api/supabase';
import type { TreeNode } from '../../api/types';
import { priceControlOl, type PriceControlLine } from '../../api/t2-price-control';
import SmetaYuklaNative from './SmetaYuklaNative';
import AdditionalReplacementNative from './AdditionalReplacementNative';
import ResursVedomostNative from './ResursVedomostNative';
import NarxNazoratNative from './NarxNazoratNative';

/**
 * Kundalik ISHCHI SMETA/LRV sahifasi. Bu komponentda Sheet nomi, Drive
 * papkasi, `varaq` yoki `row` biznes identity sifatida ishlatilmaydi.
 * URL va barcha o'qishlar faqat `t2_obyekt.id` hamda `t2_qator.id` bilan.
 */
export function HolatNative() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { joriy } = useKompaniya();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [priceControlLines, setPriceControlLines] = useState<PriceControlLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ochiqPanel, setOchiqPanel] = useState<string | null>(null);

  const obyektId = Number(id);
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;
  const selected = obyektlar.find((o) => o.id === obyektId) ?? null;

  useEffect(() => {
    let active = true;
    if (!joriy?.id) { setObyektlar([]); return; }
    void sbT2ObyektlarOlKomp(joriy.id).then((r) => {
      if (!active) return;
      if (!r.ok) { setError('Obyektlar kanonik ro‘yxatdan o‘qilmadi.'); return; }
      setObyektlar((r.qatorlar || []) as T2Obyekt[]);
    }).catch(() => { if (active) setError('Obyektlar kanonik ro‘yxatdan o‘qilmadi.'); });
    return () => { active = false; };
  }, [joriy?.id]);

  const yuklash = useCallback(async () => {
    if (!validId) { setTree([]); return; }
    setLoading(true); setError(''); setPriceControlLines([]);
    try {
      const [daraxt, holat, nazorat] = await Promise.all([
        sbT2DaraxtOl(obyektId), sbT2QatorHolatOl(obyektId), priceControlOl(obyektId),
      ]);
      if (!daraxt.ok || !holat.ok) {
        setError(daraxt.error || holat.error || 'Kanonik LRV o‘qilmadi.');
        setTree([]);
        return;
      }
      setTree(sbT2TreeQur(daraxt.qatorlar || [], holat.qatorlar || []));
      setPriceControlLines(nazorat.ok ? nazorat.qatorlar : []);
    } catch {
      setError('Kanonik LRV o‘qilmadi. Tarmoq yoki ruxsatni tekshiring.');
      setTree([]);
    } finally { setLoading(false); }
  }, [obyektId, validId]);

  useEffect(() => { void yuklash(); }, [yuklash]);

  const smetaJami = tree.reduce((sum, n) => sum + (n.smeta || 0), 0);
  const faktJami = tree.reduce((sum, n) => sum + (n.stFakt || 0), 0);
  const f2Jami = tree.reduce((sum, n) => sum + (n.stF2 || 0), 0);

  return (
    <Sahifa sarlavha="Ishchi smeta / LRV" tavsif="Supabase kanonik qatorlari va tasdiqlangan F2 tarixi">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <section className="karta flex flex-wrap items-end gap-3 p-3">
          <button onClick={() => navigate('/admin/obyektlar')} className="rounded-lg border border-border p-2 text-text-dim hover:text-text" aria-label="Obyektlarga qaytish"><ArrowLeft size={17} /></button>
          <label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">
            Kanonik obyekt
            <select value={validId ? String(obyektId) : ''} onChange={(e) => navigate(`/admin/holat/${e.target.value}`)} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none focus:border-accent">
              <option value="">-- obyektni tanlang --</option>
              {obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
            </select>
          </label>
          <button onClick={() => void yuklash()} disabled={!validId || loading} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] font-medium hover:bg-surface-2 disabled:opacity-40"><RefreshCw size={14} /> Yangilash</button>
          {validId && <button onClick={() => navigate(`/admin/fakt?obyekt=${obyektId}`)} className="rounded-lg bg-accent px-3 py-2 text-[12px] font-medium text-white">Fakt kiritish</button>}
        </section>

        {!validId && (
          <section className="karta border-warn/40 bg-warn/5 p-4 text-[13px] text-text-dim">
            Eski matnli obyekt havolasi kanonik identity emas. Yuqoridan obyektni tanlang — sahifa keyin faqat raqamli `t2_obyekt.id` bilan ishlaydi.
          </section>
        )}
        {error && <section className="karta flex items-center gap-2 border-danger/40 bg-danger/5 p-4 text-[13px] text-danger"><AlertTriangle size={16} />{error}</section>}
        {loading && <div className="skel min-h-[280px] flex-1 rounded-xl" />}
        {selected && !loading && !error && (
          <section className="karta flex flex-wrap gap-x-6 gap-y-1 p-3 text-[12px]">
            <span><Database size={13} className="mr-1 inline text-accent" />{selected.nom}</span>
            <span className="text-text-dim">Smeta: <b className="text-text"><FmtN val={smetaJami} /></b></span>
            <span className="text-text-dim">Fakt: <b className="text-text"><FmtN val={faktJami} /></b></span>
            <span className="text-text-dim">Tasdiqlangan F2: <b className="text-text"><FmtN val={f2Jami} /></b></span>
          </section>
        )}
        {validId && !loading && !error && tree.length === 0 && <section className="karta p-5 text-[13px] text-text-dim">Bu obyektda kanonik smeta qatorlari yo‘q.</section>}
        {tree.length > 0 && !loading && <div className="min-h-0 flex-1"><SmetaTree data={tree} priceControlLines={priceControlLines} /></div>}
        {selected && !loading && !error && (
          <div className="shrink-0 space-y-3" aria-label="LRV kundalik boshqaruv panellari">
            <details className="karta group p-3" open={ochiqPanel === 'smeta'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'smeta' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Smeta XLSX yuklash</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'smeta' && <div className="mt-3 max-h-[360px] overflow-auto"><SmetaYuklaNative obyektId={obyektId} /></div>}
            </details>
            <details className="karta group p-3" open={ochiqPanel === 'o‘zgarish'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'o‘zgarish' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Qo‘shimcha ish / Zamena / Resurs qo‘shish</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'o‘zgarish' && <div className="mt-3 max-h-[520px] overflow-auto"><AdditionalReplacementNative obyektId={obyektId} /></div>}
            </details>
            <details className="karta group p-3" open={ochiqPanel === 'resurs'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'resurs' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Resurs vedomosti</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'resurs' && <div className="mt-3 max-h-[520px] overflow-auto"><ResursVedomostNative obyektId={obyektId} /></div>}
            </details>
            <details className="karta group p-3" open={ochiqPanel === 'narx'} onToggle={(e) => setOchiqPanel(e.currentTarget.open ? 'narx' : null)}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[13px] font-semibold text-text">
                <span>Narx nazorati</span><span className="text-[11px] font-normal text-text-mute group-open:hidden">ochish ▾</span><span className="hidden text-[11px] font-normal text-text-mute group-open:inline">yopish ▴</span>
              </summary>
              {ochiqPanel === 'narx' && <div className="mt-3 max-h-[520px] overflow-auto"><NarxNazoratNative obyektId={obyektId} /></div>}
            </details>
          </div>
        )}
      </div>
    </Sahifa>
  );
}

export default HolatNative;
