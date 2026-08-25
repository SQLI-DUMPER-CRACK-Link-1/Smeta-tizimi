import { useState, useEffect } from 'react';
import { sbTizimLoglari } from '../api/t2-tizim';

export default function TestTizim() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    sbTizimLoglari(1).then((r: any) => setData(r.qatorlar || []));
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Tizim Audit Loglari</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
