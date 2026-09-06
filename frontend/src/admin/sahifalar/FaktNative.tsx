import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Save } from 'lucide-react';
import { Sahifa } from '../../umumiy/ui/Sahifa';
import { FmtN } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';
import { useKompaniya } from '../../test02/KompaniyaTanlov';
import { sbT2ObyektlarOlKomp, type T2Obyekt } from '../../api/supabase';
import { sbFaktBelgilaV2, sbFaktYoz, sbQatorHolatOl, type QatorHolat } from '../../api/t2-fakt';

/** KANONIK Fakt kiritish: faqat qator_id + operation_id orqali. */
export function FaktNative() {
  const { joriy } = useKompaniya();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [qatorlar, setQatorlar] = useState<QatorHolat[]>([]);
  const [qiymatlar, setQiymatlar] = useState<Record<number, string>>({});
  const [yozishUsuli, setYozishUsuli] = useState<'qoshish' | 'jami'>('qoshish');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const operationId = useRef(crypto.randomUUID());
  const jamiOperationIds = useRef<Record<number, string>>({});
  const obyektId = Number(params.get('obyekt'));
  const validId = Number.isSafeInteger(obyektId) && obyektId > 0;

  const bugunMahalliy = () => {
    const d = new Date();
    const ikki = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${ikki(d.getMonth() + 1)}-${ikki(d.getDate())}`;
  };

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
      jamiOperationIds.current = {};
    } finally { setLoading(false); }
  }, [obyektId, validId]);
  useEffect(() => { void yuklash(); }, [yuklash]);

  const saqlash = async () => {
    const kiritilgan = Object.entries(qiymatlar).flatMap(([id, value]) => {
      if (value.trim() === '') return [];
      const hajm = Number(value);
      return Number.isFinite(hajm) ? [{ qator_id: Number(id), hajm }] : [];
    });
    const qatorlarYozuvi = yozishUsuli === 'qoshish'
      ? kiritilgan.filter((q) => q.hajm !== 0)
      : kiritilgan;
    if (!validId || qatorlarYozuvi.length === 0) { toast('Kiritiladigan Fakt hajmi yo‘q.', 'warn'); return; }
    setSaving(true);
    try {
      if (yozishUsuli === 'qoshish') {
        const r = await sbFaktYoz({
          obyektId, sana: bugunMahalliy(), qatorlar: qatorlarYozuvi,
          operationId: operationId.current, izoh: 'Website kanonik Fakt kiritishi',
        });
        if (!r.ok) { toast(r.error || r.xabar || 'Fakt saqlanmadi.', 'danger'); return; }
        toast(r.ogohlantirish_soni ? `Fakt saqlandi, ${r.ogohlantirish_soni} ta limit ogohlantirishi bor.` : 'Fakt kanonik hujjatga saqlandi.', 'ok');
      } else {
        let saved = 0;
        let conflicts = 0;
        let failed = 0;
        for (const row of qatorlarYozuvi) {
          const canonical = qatorlar.find((q) => q.qator_id === row.qator_id);
          if (!canonical) { failed += 1; continue; }
          const operation = jamiOperationIds.current[row.qator_id] || crypto.randomUUID();
          jamiOperationIds.current[row.qator_id] = operation;
          try {
            const r = await sbFaktBelgilaV2({
              obyektId,
              qatorId: row.qator_id,
              expectedFaktHajm: canonical.fakt_hajm,
              yangiFaktHajm: row.hajm,
              sana: bugunMahalliy(),
              operationId: operation,
              izoh: 'Website kanonik Fakt jami tahriri',
            });
            if (r.ok) saved += 1;
            else if (r.code === 'FAKT_CONFLICT') conflicts += 1;
            else failed += 1;
          } catch {
            failed += 1;
          }
        }
        if (conflicts || failed) {
          const qismlar = [`${saved} ta saqlandi`];
          if (conflicts) qismlar.push(`${conflicts} ta qator eskirgan qiymat sabab rad etildi`);
          if (failed) qismlar.push(`${failed} ta qator saqlanmadi`);
          toast(qismlar.join(', ') + '. Kanonik qiymatlar qayta yuklandi.', 'warn');
        } else {
          toast(`${saved} ta Fakt jami kanonik saqlandi.`, 'ok');
        }
      }
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
        {validId && <fieldset className="flex items-center gap-1 rounded-lg border border-border p-1" aria-label="Fakt yozish usuli">
          <legend className="sr-only">Fakt yozish usuli</legend>
          <button type="button" aria-pressed={yozishUsuli === 'qoshish'} onClick={() => setYozishUsuli('qoshish')} className={`rounded-md px-3 py-1.5 text-[12px] ${yozishUsuli === 'qoshish' ? 'bg-accent text-white' : 'text-text-dim'}`}>Ustiga qo‘shish</button>
          <button type="button" aria-pressed={yozishUsuli === 'jami'} onClick={() => setYozishUsuli('jami')} className={`rounded-md px-3 py-1.5 text-[12px] ${yozishUsuli === 'jami' ? 'bg-accent text-white' : 'text-text-dim'}`}>Jami qiymat</button>
        </fieldset>}
      </section>
      {!validId && <section className="karta p-4 text-text-dim">Avval kanonik obyektni tanlang.</section>}
      {loading && <div className="skel min-h-[250px] flex-1 rounded-xl" />}
      {validId && !loading && <section className="karta min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-[12px]"><thead className="sticky top-0 bg-surface-2 text-text-dim"><tr><th className="p-3">Kod / ish</th><th>Birlik</th><th>Fakt jami</th><th>F2 mumkin</th><th className="p-3">{yozishUsuli === 'jami' ? 'Yangi Fakt jami' : 'Bugun qo‘shish'}</th></tr></thead>
          <tbody>{qatorlar.filter((q) => q.tur !== 'rz').map((q) => <tr key={q.qator_id} className="border-t border-border/60"><td className="p-3"><div className="font-medium">{q.kod}</div>{q.nom}</td><td>{q.birlik}</td><td><FmtN val={q.fakt_hajm} /></td><td><FmtN val={q.f2_mumkin_hajm} /></td><td className="p-3"><input aria-label={`Fakt hajmi: ${q.kod || q.nom || 'ish / resurs'}`} type="number" value={qiymatlar[q.qator_id] ?? ''} onChange={(e) => setQiymatlar((old) => ({ ...old, [q.qator_id]: e.target.value }))} className="w-28 rounded border border-border bg-bg px-2 py-1 text-right" /></td></tr>)}</tbody>
        </table>
      </section>}
      {validId && <section className="flex items-center justify-between gap-3"><p className="flex items-center gap-1 text-[12px] text-text-dim"><AlertTriangle size={14} /> {yozishUsuli === 'jami' ? 'Jami tahririda server eskirgan qiymatni conflict sifatida rad etadi.' : 'Limit oshishi serverda ogohlantiriladi'}; F2 hech qachon bu formadan yozilmaydi.</p><button onClick={() => void saqlash()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />{saving ? 'Saqlanmoqda…' : 'Faktni saqlash'}</button></section>}
    </div>
  </Sahifa>;
}
export default FaktNative;
