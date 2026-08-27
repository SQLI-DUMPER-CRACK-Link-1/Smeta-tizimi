import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbGrafikHolatOl } from '../api/t2-grafik';
import { CalendarDays, AlertTriangle, PlayCircle, CheckCircle2 } from 'lucide-react';

export default function TestGrafik() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const obyektId = Number(params.get('obyekt') || '1');
  const [grafik, setGrafik] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbGrafikHolatOl(aktKomp, obyektId).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setGrafik(r.qatorlar);
      }
    });
  }, [aktKomp, obyektId]);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <CalendarDays />
            Kalendar Grafik (Gantt) {obyektId ? '(Obyekt bo\yicha)' : ''}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Loyiha rejalashtirish va amalda bajarilish muddatlari</p>
        </div>
      </div>
      
      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="bg-black border border-zinc-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
              <tr>
                <th className="p-3 font-medium">Ish / Kategoriya</th>
                <th className="p-3 font-medium">Holat</th>
                <th className="p-3 font-medium">Boshlanish</th>
                <th className="p-3 font-medium">Tugash</th>
                <th className="p-3 font-medium">Davomiylik (kun)</th>
                <th className="p-3 font-medium">Tugallangan (%)</th>
              </tr>
            </thead>
            <tbody>
              {grafik.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-zinc-500">Hech qanday grafik topilmadi. Avval obyekt tanlang.</td></tr>
              )}
              {grafik.map((g, i) => (
                <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-3 font-medium text-slate-300 max-w-sm truncate">{g.nom || g.nomi || g.ish_turi || '-'}</td>
                  <td className="p-3">
                    <span className={\px-2 py-0.5 rounded text-xs \\}>
                      {g.holat || 'reja'}
                    </span>
                  </td>
                  <td className="p-3 text-zinc-400">{g.boshlanish_sana ? String(g.boshlanish_sana).substring(0, 10) : '-'}</td>
                  <td className="p-3 text-zinc-400">{g.tugash_sana ? String(g.tugash_sana).substring(0, 10) : '-'}</td>
                  <td className="p-3 text-center">{g.kun || '-'}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 max-w-[100px]">
                        <div className="bg-emerald-400 h-1.5 rounded-full" style={{ width: \\%\ }}></div>
                      </div>
                      <span className="text-xs text-zinc-500">{g.foiz || 0}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
