import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';
import { LayoutDashboard } from 'lucide-react';

export default function TestErp() {
  const [params] = useSearchParams();
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'taminot'|'sifat'>((params.get('modul') as any) || 'kadrlar');
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const obyektId = params.get('obyektId');

  useEffect(() => {
    setYuklanmoqda(true);
    sbErpDashboardOl(modul, 1).then(r => {
      const q = r.qatorlar || [];
      setData(obyektId ? q.filter((x: any) => x.obyekt_id == obyektId) : q);
      setYuklanmoqda(false);
    });
  }, [modul, obyektId]);

  const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'kompaniya_id') : [];

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-sky-400 flex items-center gap-2">
        <LayoutDashboard />
        ERP Boshqaruv (Tizim_02) {obyektId ? '- Obyekt Filter' : ''}
      </h1>
      
      <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-4">
        {['kadrlar', 'texnika', 'taminot', 'sifat'].map(m => (
          <button 
            key={m} 
            className={\px-4 py-2 rounded-lg text-sm font-medium transition-colors \\}
            onClick={() => setModul(m as any)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
      
      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="border border-zinc-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-800 text-zinc-400">
              <tr>
                {keys.map(k => (
                  <th key={k} className="p-3 uppercase text-xs">{k.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={keys.length || 1} className="p-3 text-center text-zinc-500">
                    Ma'lumot topilmadi
                  </td>
                </tr>
              )}
              {data.map((row, i) => (
                <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                  {keys.map(k => (
                    <td key={k} className="p-3 text-zinc-300">
                      {typeof row[k] === 'number' && row[k] > 1000 ? new Intl.NumberFormat('ru-RU').format(row[k]) : String(row[k] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
