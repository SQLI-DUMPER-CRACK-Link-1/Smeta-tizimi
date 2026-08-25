import { useState, useEffect } from 'react';
import { sbBossInitOl, sbBossDataOl } from '../api/t2-hisobot';

export default function TestHisobot() {
  const [initData, setInitData] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    sbBossInitOl(1).then((r: any) => setInitData(r.qatorlar?.[0]));
    sbBossDataOl(1).then((r: any) => setData(r.qatorlar || []));
  }, []);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Boss Hisoboti (Tahlil)</h1>
      <pre className="mb-4">{JSON.stringify(initData, null, 2)}</pre>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
