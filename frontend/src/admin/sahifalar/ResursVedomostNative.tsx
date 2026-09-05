import { useEffect, useState } from 'react';
import { sbT2ObyektlarOlKomp, sbT2QatorHolatOl, type T2Obyekt, type T2QatorHolat } from '../../api/supabase';
import { resursVedomostKategoriyalarga, type ResursVedomostKategoriya } from '../../lib/resurs-vedomost';
import { useKompaniya } from '../../umumiy/kontekst/KompaniyaKontekst';
import { FmtN } from '../../lib/format';

// T2-PTO-CLOSURE-007 (Claude lane): egasining so'rovi bo'yicha — butun
// smeta+F2'dan kategoriya (ЧЕЛ/МАШ/МАТ/ОБ/КАБ/М-К) kesimida resurs
// vedomosti. Manba — `t2_qator_holat` (bu sessiyada certified_* ustuvor
// bo'lishi tuzatilgan), yangi hisob-kitob yo'q, faqat jamlanma. Holat.tsx
// bilan bir xil "ochish ixtiyoriy" naqsh — mavjud oqimga tegmaydi.

function Sessiya({ companyId }: { companyId: number }) {
  const [objects, setObjects] = useState<T2Obyekt[]>([]);
  const [objectId, setObjectId] = useState('');
  const [kategoriyalar, setKategoriyalar] = useState<ResursVedomostKategoriya[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qidiruv, setQidiruv] = useState('');

  useEffect(() => {
    let active = true;
    void sbT2ObyektlarOlKomp(companyId).then(r => {
      if (!active) return;
      setObjects(r.ok ? (r.qatorlar || []) as T2Obyekt[] : []);
      if (!r.ok) setError('Obyektlar o‘qilmadi.');
    });
    return () => { active = false; };
  }, [companyId]);

  async function obyektTanla(id: string) {
    setObjectId(id); setKategoriyalar([]); setError('');
    if (!id) return;
    setLoading(true);
    try {
      const r = await sbT2QatorHolatOl(Number(id));
      if (!r.ok) throw new Error('Ma’lumot o‘qilmadi.');
      setKategoriyalar(resursVedomostKategoriyalarga((r.qatorlar || []) as T2QatorHolat[]));
    } catch (e) { setError(e instanceof Error ? e.message : 'O‘qish bajarilmadi.'); }
    finally { setLoading(false); }
  }

  const filtr = qidiruv.trim().toUpperCase();
  const korinadigan = kategoriyalar.map(k => ({
    ...k,
    qatorlar: filtr ? k.qatorlar.filter(r => r.nom.toUpperCase().includes(filtr)) : k.qatorlar,
  })).filter(k => k.qatorlar.length > 0);

  return (
    <div className="space-y-3 p-1">
      <label className="block text-sm">Obyekt
        <select aria-label="Obyekt" className="ml-2 border rounded px-2 py-1"
          value={objectId} onChange={e => void obyektTanla(e.target.value)}>
          <option value="">Tanlang</option>
          {objects.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </label>
      {loading && <p role="status">Yuklanmoqda…</p>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {kategoriyalar.length > 0 && (
        <>
          <label className="block text-sm">Resurs qidirish
            <input aria-label="Resurs qidirish" className="ml-2 border rounded px-2 py-1"
              value={qidiruv} onChange={e => setQidiruv(e.target.value)} />
          </label>
          {korinadigan.map(k => (
            <details key={k.kat} className="karta p-3" open>
              <summary className="cursor-pointer font-semibold text-sm flex items-center justify-between">
                <span>{k.kat} <span className="text-text-mute font-normal">({k.qatorlar.length} resurs)</span></span>
                <span className="text-[11px] text-text-mute font-normal">
                  Smeta: <FmtN val={k.jamiSmetaSumma} /> · F2: <FmtN val={k.jamiF2Summa} /> · Qoldiq: <FmtN val={k.jamiQoldiqSumma} />
                </span>
              </summary>
              <table className="w-full text-[12px] mt-2">
                <thead className="text-text-mute text-left">
                  <tr>
                    <th className="py-1">Resurs</th><th>Birlik</th>
                    <th className="text-right">Smeta hajm</th><th className="text-right">Smeta summa</th>
                    <th className="text-right">F2 hajm</th><th className="text-right">F2 summa</th>
                    <th className="text-right">Qoldiq hajm</th><th className="text-right">Qoldiq summa</th>
                  </tr>
                </thead>
                <tbody>
                  {k.qatorlar.map(r => (
                    <tr key={k.kat + '|' + r.nom + '|' + r.birlik} className="border-t border-border/60">
                      <td className="py-1">{r.kod ? r.kod + ' ' : ''}{r.nom}</td>
                      <td>{r.birlik || '—'}</td>
                      <td className="text-right tabular-nums"><FmtN val={r.smetaHajm} /></td>
                      <td className="text-right tabular-nums"><FmtN val={r.smetaSumma} /></td>
                      <td className="text-right tabular-nums"><FmtN val={r.f2Hajm} /></td>
                      <td className="text-right tabular-nums"><FmtN val={r.f2Summa} /></td>
                      <td className="text-right tabular-nums"><FmtN val={r.qoldiqHajm} /></td>
                      <td className="text-right tabular-nums"><FmtN val={r.qoldiqSumma} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          ))}
        </>
      )}
      {objectId && !loading && kategoriyalar.length === 0 && !error && (
        <p className="text-text-mute text-sm">Bu obyektda resurs qatori topilmadi.</p>
      )}
    </div>
  );
}

export default function ResursVedomostNative() {
  const { joriy, yuklanmoqda } = useKompaniya();
  if (yuklanmoqda) return <p>Kompaniya yuklanmoqda…</p>;
  if (!joriy?.id) return <p>Kompaniyani tanlang.</p>;
  return <Sessiya key={joriy.id} companyId={joriy.id} />;
}
