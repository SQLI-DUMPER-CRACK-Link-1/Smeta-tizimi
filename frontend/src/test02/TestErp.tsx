import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';

export default function TestErp() {
  const [params] = useSearchParams();
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'taminot'|'sifat'>((params.get('modul') as any) || 'kadrlar');
  const [data, setData] = useState<any[]>([]);
  const obyektId = params.get('obyektId');

  useEffect(() => {
    sbErpDashboardOl(modul, 1).then(r => {
      const q = r.qatorlar || [];
      setData(obyektId ? q.filter((x: any) => x.obyekt_id == obyektId) : q);
    });
  }, [modul, obyektId]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">ERP Dashboard (Test)</h1>
      <div className="flex gap-2 mb-4">
        {['kadrlar', 'texnika', 'taminot', 'sifat'].map(m => (
          <button 
            key={m} 
            className={'px-3 py-1 rounded ' + (modul === m ? 'bg-sky-600' : 'bg-zinc-700')}
            onClick={() => setModul(m as any)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="bg-black p-4 border border-zinc-700 h-96 overflow-auto text-emerald-400 text-xs">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}

