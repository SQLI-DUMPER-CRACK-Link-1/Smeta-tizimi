import { useState } from 'react';
import { sbTaklifYubor, sbTaklifQabul } from '../api/t2-invite';

export default function TestInvite() {
  const [email, setEmail] = useState('');
  const [natija, setNatija] = useState<any>(null);

  const yubor = async () => {
    const res = await sbTaklifYubor(email, 'xodim');
    setNatija(res);
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Kompaniyaga Taklif (B2B Federation)</h1>
      <div className="flex gap-2 mb-4">
        <input 
          className="bg-black border border-zinc-700 p-2 text-white" 
          placeholder="xodim e-maili" 
          value={email} onChange={e => setEmail(e.target.value)} 
        />
        <button onClick={yubor} className="bg-sky-600 px-4 py-2 hover:bg-sky-500">Taklif yuborish</button>
      </div>
      {natija && <pre className="bg-black p-4 text-emerald-400 border border-zinc-700">{JSON.stringify(natija, null, 2)}</pre>}
    </div>
  );
}
