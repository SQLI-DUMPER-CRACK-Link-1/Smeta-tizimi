import { useState, useEffect } from 'react';
import { sbFakturalarOl } from '../api/supabase';

export default function TestFaktura() {
  const [fakturalar, setFakturalar] = useState<any[]>([]);

  useEffect(() => {
    sbFakturalarOl(1).then((r: any) => setFakturalar(r.qatorlar || []));
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Elektron Fakturalar (Didox)</h1>
      <pre>{JSON.stringify(fakturalar, null, 2)}</pre>
    </div>
  );
}
