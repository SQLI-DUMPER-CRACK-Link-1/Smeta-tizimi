import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbT2ShartnomalarOl } from '../api/t2-shartnoma';

export default function TestShartnoma() {
  const [params] = useSearchParams();
  const [data, setData] = useState<any[]>([]);
  const obyektId = params.get('obyektId');

  useEffect(() => {
    sbT2ShartnomalarOl().then(r => {
      const q = r.qatorlar || [];
      setData(obyektId ? q.filter((x: any) => x.obyekt_id == obyektId) : q);
    });
  }, [obyektId]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Shartnomalar (Test Tizim_02)</h1>
      <div className="bg-black p-4 border border-zinc-700 h-[600px] overflow-auto text-emerald-400 text-xs">
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
