import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../../api/supabase';
import { sbFaktYoz, sbQatorHolatOl, type QatorHolat } from '../../api/t2-fakt';

/** KANONIK Fakt kiritish: faqat qator_id + operation_id orqali. */
export function FaktNative() {
  const { joriy } = useKompaniya();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [qatorlar, setQatorlar] = useState<QatorHolat[]>([]);
  const [qiymatlar, setQiymatlar] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  const obyektId = Number(params.get('obyekt'));
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;

  useEffect(() => {
    if (!joriy?.id) return;
    void sbT2ObyektlarOlKomp(joriy.id).then((r) => setObyektlar((r.ok ? r.qatorlar : []) as T2Obyekt[]));
  }, [joriy?.id]);

  const yuklash = useCallback(async () => {
    if (!validId) { setQatorlar([]); return; }
    setLoading(true);
    try {
      const r = await sbQatorHolatOl(obyektId);
      setQatorlar(r.ok ? r.qatorlar || [] : []);
      setQiymatlar({});
      operationId.current = crypto.randomUUID();
    } finally { setLoading(false); }
  }, [obyektId, validId]);
  useEffect(() => { void yuklash(); }, [yuklash]);

  const saqlash = async () => {
    const qatorlarYozuvi = Object.entries(qiymatlar).flatMap(([id, value]) => {
      const hajm = Number(value);
      return Number.isFinite(hajm) && hajm !== 0 ? [{ qator_id: Number(id), hajm }] : [];
    });
    if (!validId || qatorlarYozuvi.length === 0) { toast('Kiritiladigan Fakt hajmi yo‘q.', 'warn'); return; }
    setSaving(true);
    try {
      const r = await sbFaktYoz({
        obyektId, sana: new Date().toISOString().slice(0, 10), qatorlar: qatorlarYozuvi,
        operationId: operationId.current, izoh: 'Website kanonik Fakt kiritishi',
      });
      if (!r.ok) { toast(r.error || r.xabar || 'Fakt saqlanmadi.', 'danger'); return; }
      toast(r.ogohlantirish_soni ? `Fakt saqlandi, ${r.ogohlantirish_soni} ta limit ogohlantirishi bor.` : 'Fakt kanonik hujjatga saqlandi.', 'ok');
      await yuklash();
    } catch { toast('Fakt saqlanmadi. Tarmoqni tekshirib qayta urinib ko‘ring.', 'danger'); }
    finally { setSaving(false); }
  };

  return <Sahifa sarlavha="Bajarilgan ishlar (Fakt)" tavsif="Kanonik hujjatga yoziladi; tasdiqlangan F2 tarixi o‘zgarmaydi">
    <div className="flex h-full min-h-0 flex-col gap-3">
      <section className="karta flex flex-wrap items-end gap-3 p-3">
        <label className="min-w-[260px] flex-1 text-[12px] font-medium text-text">Obyekt
          <select value={validId ? obyektId : ''} onChange={(e) => setParams({ obyekt: e.target.value })} className="mt-1.5 block w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-text">
            <option value="">-- obyektni tanlang --</option>{obyektlar.map((o) => <option key={o.id} value={o.id}>{o.nom}</option>)}
          </select>
        </label>
        {validId && <button onClick={() => navigate(`/admin/holat/${obyektId}`)} className="rounded-lg border border-border px-3 py-2 text-[12px]">LRVga qaytish</button>}
      </section>
      {!validId && <section className="karta p-4 text-text-dim">Avval kanonik obyektni tanlang.</section>}
      {loading && <div className="skel min-h-[250px] flex-1 rounded-xl" />}
      {validId && !loading && <section className="karta min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[12px]"><thead className="sticky top-0 bg-surface-2 text-text-dim"><tr><th className="p-3">Kod / ish</th><th>Birlik</th><th>Fakt jami</th><th>F2 mumkin</th><th className="p-3">Bugun qo‘shish</th></tr></thead>
          <tbody>{qatorlar.filter((q) => q.tur !== 'rz').map((q) => <tr key={q.qator_id} className="border-t border-border/60"><td className="p-3"><div className="font-mono text-text-mute">{q.kod}</div>{q.nom}</td><td>{q.birlik}</td><td><FmtN val={q.fakt_hajm} /></td><td><FmtN val={q.f2_mumkin_hajm} /></td><td className="p-3"><input aria-label={`Fakt ${q.qator_id}`} type="number" value={qiymatlar[q.qator_id] || ''} onChange={(e) => setQiymatlar((old) => ({ ...old, [q.qator_id]: e.target.value }))} className="w-28 rounded border border-border bg-bg px-2 py-1 text-right" /></td></tr>)}</tbody>
        </table>
      </section>}
      {validId && <section className="flex items-center justify-between gap-3"><p className="flex items-center gap-1 text-[12px] text-text-dim"><AlertTriangle size={14} /> Limit oshishi serverda ogohlantiriladi; F2 hech qachon bu formadan yozilmaydi.</p><button onClick={() => void saqlash()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saqlanmoqda…' : 'Faktni saqlash'}</button></section>}
    </div>
  </Sahifa>;
}
export default FaktNative;
