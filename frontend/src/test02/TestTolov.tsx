import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbT2TolovlarOl, sbT2BuxDashboardOl, type Tolov, type BuxDashboard } from '../api/t2-buxgalteriya';
import { sbT2ShartnomaBogOl } from '../api/t2-shartnoma';
import { Calculator, AlertCircle, ArrowRightLeft, DollarSign } from 'lucide-react';
import { FmtN } from '../lib/format';
import { yangiOperationId } from '../api/supabase';
import { sbT2TolovYoz } from '../api/t2-buxgalteriya';

export default function TestTolov() {
  const [params] = useSearchParams();
  const obyektId = params.get('obyektId');
  const [tolovlar, setTolovlar] = useState<Tolov[]>([]);
  const [dash, setDash] = useState<BuxDashboard[]>([]);
  const [shartnomaId, setShartnomaId] = useState<number | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [opId, setOpId] = useState(yangiOperationId());

  const yukla = async () => {
    setYuklanmoqda(true);
    let sId = null;
    if (obyektId) {
      const bogRes = await sbT2ShartnomaBogOl(Number(obyektId));
      if (bogRes.ok && bogRes.qatorlar && bogRes.qatorlar.length > 0) {
        sId = bogRes.qatorlar[0].shartnoma_id;
        setShartnomaId(sId);
      }
    }

    const tRes = await sbT2TolovlarOl(sId || undefined);
    if (tRes.ok) setTolovlar(tRes.qatorlar as Tolov[]);
    
    if (!obyektId) {
      const dRes = await sbT2BuxDashboardOl();
      if (dRes.ok) setDash(dRes.qatorlar as BuxDashboard[]);
    } else if (sId) {
      const dRes = await sbT2BuxDashboardOl();
      if (dRes.ok) setDash((dRes.qatorlar as BuxDashboard[]).filter(d => d.shartnoma_id === sId));
    }
    setYuklanmoqda(false);
  };

  useEffect(() => { yukla(); }, [obyektId]);

  const testAvans = async () => {
    if (!shartnomaId) return alert('Avval shartnoma bog\'langan obyekt tanlang');
    setYuklanmoqda(true);
    const r = await sbT2TolovYoz({
      shartnomaId, summa: Math.floor(Math.random() * 5000000) + 1000000, 
      tur: 'avans', operationId: opId, izoh: 'Avtomatik test avans'
    });
    if (r.ok) {
      setOpId(yangiOperationId());
      yukla();
    } else {
      alert(r.error || r.xabar || 'Xato');
      setYuklanmoqda(false);
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 flex items-center gap-2">
            <Calculator />
            Moliya & Buxgalteriya {obyektId ? '(Obyekt)' : ''}
          </h1>
          <p className="text-sm text-zinc-400">To'lovlar, avans va debitorlik qarzlari Tizim_02 da</p>
        </div>
        <div className="flex gap-2">
          {obyektId && shartnomaId && (
            <button onClick={testAvans} className="bg-emerald-600 px-4 py-2 hover:bg-emerald-500 rounded text-sm font-medium">
              + Mock Avans O'tkazish
            </button>
          )}
          <button onClick={yukla} className="bg-zinc-700 px-4 py-2 hover:bg-zinc-600 rounded text-sm font-medium">Yangilash</button>
        </div>
      </div>

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="flex flex-col gap-6">
          {dash.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dash.map(d => (
                <div key={d.shartnoma_id} className="border border-zinc-700 bg-black p-4 rounded-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                  <h3 className="font-bold mb-1">№ {d.raqam}</h3>
                  <div className="text-xs text-zinc-400 mb-3">{d.nom || 'Shartnoma'} | {d.taraf}</div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Jami summa:</div><div className="text-right text-emerald-300 font-medium">{FmtN(d.dog_summa)}</div>
                    <div>Bajarilgan F2:</div><div className="text-right font-medium">{FmtN(d.bajarilgan)}</div>
                    <div>To'langan:</div><div className="text-right font-medium text-emerald-400">{FmtN(d.tolangan)}</div>
                    <div>Debitor qarz:</div><div className="text-right font-bold text-red-400">{FmtN(d.debitor)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border border-zinc-800 rounded-lg overflow-hidden mt-4">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Tur</th>
                  <th className="p-3">Summa</th>
                  <th className="p-3">Izoh</th>
                  <th className="p-3">Holat</th>
                </tr>
              </thead>
              <tbody>
                {tolovlar.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-zinc-500">Hech qanday to'lov mavjud emas</td></tr>}
                {tolovlar.map(t => (
                  <tr key={t.id} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                    <td className="p-3">{t.sana.substring(0,10)}</td>
                    <td className="p-3">
                      <span className={\px-2 py-0.5 rounded text-xs \\}>
                        {t.tur.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-emerald-400">{FmtN(t.summa)}</td>
                    <td className="p-3 text-zinc-400">{t.izoh || '-'}</td>
                    <td className="p-3">{t.holat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
