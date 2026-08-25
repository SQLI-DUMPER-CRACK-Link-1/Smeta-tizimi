import { useState, useEffect } from 'react';
import { sbTizimHolatOl } from '../api/t2-tizim';

export default function TestTizim() {
  const [holat, setHolat] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbTizimHolatOl().then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setHolat(r.qatorlar);
      }
    });
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Tizim holati (Barcha Kompaniyalar)</h1>
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <pre className="text-xs bg-black p-4 rounded text-emerald-400 overflow-auto border border-zinc-700 h-96">
          {JSON.stringify(holat, null, 2)}
        </pre>
      )}
    </div>
  );
}
