import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbGrafikHolatOl } from '../api/t2-grafik';

export default function TestGrafik() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const obyektId = Number(params.get('obyekt') || '1');
  const [grafik, setGrafik] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbGrafikHolatOl(aktKomp, obyektId).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setGrafik(r.qatorlar);
      }
    });
  }, [aktKomp, obyektId]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Kalendar Grafik (Gantt)</h1>
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <pre className="text-xs bg-black p-4 rounded text-emerald-400 overflow-auto border border-zinc-700 h-96">
          {JSON.stringify(grafik, null, 2)}
        </pre>
      )}
    </div>
  );
}
