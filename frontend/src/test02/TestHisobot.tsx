import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbBossInitOl, sbBossDataOl } from '../api/t2-hisobot';

export default function TestHisobot() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [init, setInit] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbBossInitOl(aktKomp).then(r => {
      if (r.ok && r.qatorlar) setInit(r.qatorlar);
      return sbBossDataOl(aktKomp, '2026-08-01', '2026-08-31');
    }).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) setData(r.qatorlar);
    });
  }, [aktKomp]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Boss Dashboard (Hisobot)</h1>
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <div className="flex gap-4">
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-2">Init Ma'lumotlari</h2>
            <pre className="text-xs bg-black p-4 rounded text-emerald-400 overflow-auto border border-zinc-700 h-96">
              {JSON.stringify(init, null, 2)}
            </pre>
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-lg mb-2">Data (Tahlil) Ma'lumotlari</h2>
            <pre className="text-xs bg-black p-4 rounded text-sky-300 overflow-auto border border-zinc-700 h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
