import { useState } from 'react';
import { uploadFayl } from '../api/t2-fayl';

export default function TestHujjat() {
  const [fayl, setFayl] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const yuklash = async () => {
    if (!fayl) return;
    const res = await uploadFayl(fayl);
    if (res.ok) setUrl(res.url);
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Cloudflare R2 Chizmalar Arxivi</h1>
      <div className="border border-zinc-700 p-4 bg-black rounded inline-block">
        <input type="file" onChange={e => setFayl(e.target.files?.[0] || null)} className="mb-4 block" />
        <button onClick={yuklash} className="bg-sky-600 px-4 py-2 hover:bg-sky-500 rounded">Yuklash (DWG/PDF)</button>
        
        {url && (
          <div className="mt-4 p-2 bg-zinc-800 rounded text-emerald-400 break-all">
            Fayl manzili: <a href={url} target="_blank" rel="noreferrer" className="underline">{url}</a>
          </div>
        )}
      </div>
    </div>
  );
}
