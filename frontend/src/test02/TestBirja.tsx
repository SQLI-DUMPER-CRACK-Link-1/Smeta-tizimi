import { useState, useEffect } from 'react';
import { sbBirjaSorovOl, sbBirjaRfqYarat, sbBirjaTaklifBer } from '../api/t2-birja';

export default function TestBirja() {
  const [rfqlar, setRfqlar] = useState<any[]>([]);

  useEffect(() => {
    sbBirjaSorovOl().then(r => setRfqlar(r.qatorlar || []));
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">B2B Materiallar Birjasi (Marketplace)</h1>
      <button className="bg-emerald-600 px-4 py-2 mb-4 hover:bg-emerald-500" onClick={() => sbBirjaRfqYarat({})}>Yangi Tender (RFQ) Yaratish</button>
      
      <div className="grid grid-cols-3 gap-4">
        {rfqlar.map((r, i) => (
          <div key={i} className="border border-zinc-700 p-4 bg-black rounded">
            <h2 className="font-bold text-lg">{r.nom}</h2>
            <p className="text-zinc-400">Hajm: {r.hajm} {r.birlik}</p>
            <button className="mt-2 text-sky-400 border border-sky-400 px-3 py-1 rounded" onClick={() => sbBirjaTaklifBer(r.id, 1000, 'Menda bor')}>Taklif berish</button>
          </div>
        ))}
      </div>
    </div>
  );
}
