import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbSozlamalarOl } from '../api/t2-sozlama';

export default function TestSozlama() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [sozlamalar, setSozlamalar] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbSozlamalarOl(aktKomp).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setSozlamalar(r.qatorlar);
      }
    });
  }, [aktKomp]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Sozlamalar (Tizim konfiguratsiyasi)</h1>
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <pre className="text-xs bg-black p-4 rounded text-emerald-400 overflow-auto border border-zinc-700 h-96">
          {JSON.stringify(sozlamalar, null, 2)}
        </pre>
      )}
    </div>
  );
}
