import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbT2ShartnomalarOl, sbT2ShartnomaBogOl, type Shartnoma } from '../api/t2-shartnoma';
import { Briefcase } from 'lucide-react';
import { FmtN } from '../lib/format';

export default function TestShartnoma() {
  const [params] = useSearchParams();
  const [shartnomalar, setShartnomalar] = useState<Shartnoma[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const obyektId = params.get('obyektId');

  const yukla = async () => {
    setYuklanmoqda(true);
    let boundId: number | null = null;
    if (obyektId) {
      const bRes = await sbT2ShartnomaBogOl(Number(obyektId));
      if (bRes.ok && bRes.qatorlar && bRes.qatorlar.length > 0) {
        boundId = bRes.qatorlar[0].shartnoma_id;
        setBogId(boundId);
      }
    }

    const r = await sbT2ShartnomalarOl(false); // get all contracts
    if (r.ok) {
      const all = (r.qatorlar as Shartnoma[]) || [];
      if (obyektId && boundId) {
        setShartnomalar(all.filter(s => s.id === boundId));
      } else if (obyektId && !boundId) {
        setShartnomalar([]); // none bound
      } else {
        setShartnomalar(all);
      }
    }
    setYuklanmoqda(false);
  };

  useEffect(() => { yukla(); }, [obyektId]);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-fuchsia-400 flex items-center gap-2">
            <Briefcase />
            Bosh Shartnomalar {obyektId ? '(Obyekt boyicha)' : ''}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            {obyektId ? 'Faqat tanlangan obyektga boglangan shartnomalar' : 'Kompaniyaning barcha bosh shartnomalari'}
          </p>
        </div>
        <button onClick={yukla} className="bg-fuchsia-600 px-4 py-2 hover:bg-fuchsia-500 rounded text-sm font-medium">
          Yangilash
        </button>
      </div>

      {yuklanmoqda ? (
        <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {shartnomalar.length === 0 && <div className="text-zinc-500">Hech narsa topilmadi.</div>}
          {shartnomalar.map(s => (
            <div key={s.id} className="border border-zinc-700 bg-black p-4 rounded-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-fuchsia-500"></div>
              <div className="flex justify-between mb-2">
                <span className="font-bold text-lg">№ {s.raqam}</span>
                <span className={
                  "text-xs px-2 py-1 rounded " +
                  (s.holat === 'faol' ? 'bg-emerald-500/20 text-emerald-400'
                    : s.holat === 'bekor' ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-700 text-zinc-400')
                }>
                  {s.holat.toUpperCase()}
                </span>
              </div>
              <div className="text-sm text-zinc-400 mb-4">{s.nom || 'Nomsiz shartnoma'}</div>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Taraf:</span>
                  <span>{s.taraf || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Summa:</span>
                  <span className="text-emerald-400 font-medium">{FmtN(s.summa_bez_nds || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">NDS:</span>
                  <span>{FmtN(s.nds || 0)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
