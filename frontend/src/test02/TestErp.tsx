import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';

export default function TestErp() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [dashboard, setDashboard] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'taminot'|'sifat'>('kadrlar');

  useEffect(() => {
    setYuklanmoqda(true);
    sbErpDashboardOl(modul, aktKomp).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setDashboard(r.qatorlar);
      }
    });
  }, [aktKomp, modul]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">ERP Modullari</h1>
      <div className="flex gap-2 mb-4">
        {['kadrlar', 'texnika', 'taminot', 'sifat'].map(m => (
          <button 
            key={m} 
            onClick={() => setModul(m as any)}
            className={\px-4 py-2 rounded \\}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <pre className="text-xs bg-black p-4 rounded text-emerald-400 overflow-auto border border-zinc-700 h-96">
          {JSON.stringify(dashboard, null, 2)}
        </pre>
      )}
    </div>
  );
}
