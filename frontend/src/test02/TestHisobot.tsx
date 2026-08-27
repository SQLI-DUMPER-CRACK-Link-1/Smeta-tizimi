import { useState, useEffect } from 'react';
import { sbBossInitOl, sbBossDataOl } from '../api/t2-hisobot';
import { BarChart3, RefreshCw } from 'lucide-react';
import { FmtN } from '../lib/format';

export default function TestHisobot() {
  const [initData, setInitData] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  const yukla = () => {
    setYuklanmoqda(true);
    Promise.all([
      sbBossInitOl(1).then((r: any) => setInitData(r.qatorlar?.[0])),
      sbBossDataOl(1).then((r: any) => setData(r.qatorlar || []))
    ]).finally(() => setYuklanmoqda(false));
  };

  useEffect(() => { yukla(); }, []);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-violet-400 flex items-center gap-2">
            <BarChart3 /> Boss Hisoboti (Tahlil)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Kompaniya moliya va ko'rsatkichlari dinamikasi</p>
        </div>
        <button onClick={yukla} className="bg-violet-600 hover:bg-violet-500 px-4 py-2 rounded flex items-center gap-2">
          <RefreshCw size={16} className={yuklanmoqda ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {yuklanmoqda && !initData ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="flex flex-col gap-6">
          {initData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black border border-zinc-800 p-4 rounded-lg border-t-4 border-t-emerald-500">
                <div className="text-zinc-500 text-sm mb-1">Jami Foyda</div>
                <div className="text-xl font-bold text-emerald-400"><FmtN val={initData.foyda || 0} /></div>
              </div>
              <div className="bg-black border border-zinc-800 p-4 rounded-lg border-t-4 border-t-blue-500">
                <div className="text-zinc-500 text-sm mb-1">Daromad</div>
                <div className="text-xl font-bold text-blue-400"><FmtN val={initData.daromad || 0} /></div>
              </div>
              <div className="bg-black border border-zinc-800 p-4 rounded-lg border-t-4 border-t-red-500">
                <div className="text-zinc-500 text-sm mb-1">Xarajatlar</div>
                <div className="text-xl font-bold text-red-400"><FmtN val={initData.xarajat || 0} /></div>
              </div>
              <div className="bg-black border border-zinc-800 p-4 rounded-lg border-t-4 border-t-amber-500">
                <div className="text-zinc-500 text-sm mb-1">Qoldiq Kassa</div>
                <div className="text-xl font-bold text-amber-400"><FmtN val={initData.kassa || 0} /></div>
              </div>
            </div>
          )}

          <div className="bg-black border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-400">
                <tr>
                  <th className="p-3">Obyekt / Kategoriya</th>
                  <th className="p-3 text-right">Kirim</th>
                  <th className="p-3 text-right">Chiqim</th>
                  <th className="p-3 text-right">Foyda</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-zinc-500">Hech qanday tahlil topilmadi.</td></tr>}
                {data.map((d, i) => (
                  <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="p-3 font-medium">{d.kategoriya || d.nom || '-'}</td>
                    <td className="p-3 text-right text-emerald-400"><FmtN val={d.kirim || 0} /></td>
                    <td className="p-3 text-right text-red-400"><FmtN val={d.chiqim || 0} /></td>
                    <td className="p-3 text-right font-bold text-blue-400"><FmtN val={(d.kirim || 0) - (d.chiqim || 0)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
