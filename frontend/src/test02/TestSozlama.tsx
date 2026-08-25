import { useState, useEffect } from 'react';
import { sbSozlamaOl, sbSozlamaSaqla } from '../api/t2-sozlama';

export default function TestSozlama() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    sbSozlamaOl(1).then((r: any) => setData(r));
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Kompaniya Sozlamalari</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <button className="bg-sky-600 px-4 py-2 mt-4" onClick={() => sbSozlamaSaqla(1, {})}>Saqlash (Mock)</button>
    </div>
  );
}
