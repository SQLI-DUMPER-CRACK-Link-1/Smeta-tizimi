import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbGrafikHolatOl } from '../api/t2-grafik';
import { CalendarDays } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';

/* ⚠️ 2026-08-27 (Claude): avval bo'sh/xato javobda `MOCK_GRAFIK`
 * (to'qilgan "Kotlovan qazish" va h.k.) ko'rsatilardi — olib
 * tashlandi, bo'sh bo'lsa OCHIQ "ma'lumot yo'q" holati. */
export default function TestGrafik() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id;
  const obyektId = params.get('obyekt') ? Number(params.get('obyekt')) : null;
  const [grafik, setGrafik] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');

  useEffect(() => {
    if (!aktKomp || !obyektId) return;
    setYuklanmoqda(true);
    setXato('');
    sbGrafikHolatOl(aktKomp, obyektId).then(r => {
      setYuklanmoqda(false);
      if (r.ok) {
        setGrafik(r.qatorlar || []);
      } else {
        setXato(r.error || 'O\'qilmadi');
        setGrafik([]);
      }
    });
  }, [aktKomp, obyektId]);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <CalendarDays />
            Kalendar Grafik (Gantt) {obyektId ? '(Obyekt: ' + obyektId + ')' : ''}
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Loyiha rejalashtirish va amalda bajarilish muddatlari</p>
        </div>
      </div>

      {xato && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>
      )}

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="bg-black border border-zinc-800 rounded-lg overflow-x-auto shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
              <tr>
                <th className="p-4 font-medium">Ish / Kategoriya</th>
                <th className="p-4 font-medium">Holat</th>
                <th className="p-4 font-medium">Boshlanish</th>
                <th className="p-4 font-medium">Tugash</th>
                <th className="p-4 font-medium text-center">Davomiylik</th>
                <th className="p-4 font-medium">Tugallangan (%)</th>
              </tr>
            </thead>
            <tbody>
              {grafik.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-zinc-500">Hech qanday grafik topilmadi. Avval obyekt tanlang.</td></tr>
              )}
              {grafik.map((g, i) => (
                <tr key={i} className="border-t border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="p-4 font-medium text-slate-300 max-w-sm truncate">{g.nom || g.nomi || g.ish_turi || '-'}</td>
                  <td className="p-4">
                    <span className={
                      "px-2 py-1 rounded text-xs font-medium " +
                      (g.holat === 'bajarildi' ? 'bg-emerald-500/20 text-emerald-400'
                        : g.holat === 'jarayonda' ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-zinc-700 text-zinc-400')
                    }>
                      {(g.holat || 'reja').toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400">{g.boshlanish_sana ? String(g.boshlanish_sana).substring(0, 10) : '-'}</td>
                  <td className="p-4 text-zinc-400">{g.tugash_sana ? String(g.tugash_sana).substring(0, 10) : '-'}</td>
                  <td className="p-4 text-center font-mono">{g.kun || '-'} kun</td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-full bg-zinc-800 rounded-full h-2 max-w-[120px] overflow-hidden">
                        <div className="bg-emerald-400 h-2 rounded-full transition-all duration-1000" style={{ width: (g.foiz || 0) + '%' }}></div>
                      </div>
                      <span className="text-xs text-zinc-400 font-mono">{g.foiz || 0}%</span>
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
