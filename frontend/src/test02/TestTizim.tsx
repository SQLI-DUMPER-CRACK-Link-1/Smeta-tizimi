import { useState, useEffect } from 'react';
import { sbTizimLoglari } from '../api/t2-tizim';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function TestTizim() {
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const yukla = () => {
    setYuklanmoqda(true);
    sbTizimLoglari(1).then((r: any) => {
      setData(r.qatorlar || []);
      setYuklanmoqda(false);
    });
  };

  useEffect(() => { yukla(); }, []);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-400 flex items-center gap-2">
            <ShieldAlert />
            Tizim Audit Loglari
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Muhim xatolar va tizimdagi ogohlantirishlar ro'yxati</p>
        </div>
        <button onClick={yukla} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded flex items-center gap-2">
          <RefreshCw size={16} className={yuklanmoqda ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      <div className="flex-1 bg-black border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
        {yuklanmoqda && data.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 animate-pulse">Yuklanmoqda...</div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Manba / Amal</th>
                  <th className="p-3">Kim</th>
                  <th className="p-3">IP / Brauzer</th>
                  <th className="p-3">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-medium">Hech qanday log topilmadi.</td></tr>
                )}
                {data.map((l, i) => (
                  <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 font-mono text-[12px]">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">{(l.sana || l.yaratildi || '').substring(0, 19).replace('T', ' ')}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded mr-2">{l.jadval || l.manba || '-'}</span>
                      <span className="text-emerald-400">{l.amal || '-'}</span>
                    </td>
                    <td className="p-3 text-zinc-400">{l.kim || '-'}</td>
                    <td className="p-3 text-zinc-500 max-w-[200px] truncate">{l.ip || '-'}</td>
                    <td className="p-3 text-zinc-400 max-w-md truncate" title={JSON.stringify(l.tafsilot || l.eski)}>
                      {typeof l.tafsilot === 'object' ? JSON.stringify(l.tafsilot) : (l.tafsilot || '-')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
