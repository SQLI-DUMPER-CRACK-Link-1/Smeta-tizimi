import { useState } from 'react';
import { tolovniBoshla } from '../api/t2-tolov';

export default function TestTolov() {
  const [summa, setSumma] = useState('');
  const [url, setUrl] = useState<string | null>(null);

  const tlash = async () => {
    const res = await tolovniBoshla(1234, Number(summa));
    if (res.ok) setUrl(res.redirect_url);
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Open Banking (To'lov Darvozasi)</h1>
      <div className="border border-zinc-700 p-4 bg-black rounded inline-block">
        <label className="block mb-2 text-zinc-400">O'tkazma summasi (UZS)</label>
        <input type="number" onChange={e => setSumma(e.target.value)} className="mb-4 block bg-zinc-800 text-white p-2 border border-zinc-700 w-full" />
        <button onClick={tlash} className="bg-emerald-600 px-4 py-2 hover:bg-emerald-500 rounded w-full">To'lash</button>
        
        {url && (
          <div className="mt-4 p-2 bg-zinc-800 rounded text-sky-400 text-sm break-all">
            To'lov manzili: <a href={url} target="_blank" rel="noreferrer" className="underline">{url}</a>
          </div>
        )}
      </div>
    </div>
  );
}
