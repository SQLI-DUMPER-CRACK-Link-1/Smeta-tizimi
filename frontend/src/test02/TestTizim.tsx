import { useState, useEffect } from 'react';
import { sbTizimLoglari, type AuditLog } from '../api/t2-tizim';
import { ShieldAlert, RefreshCw } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';

/** ⚠️ 2026-08-27 (Claude): avval `sbTizimLoglari(1)` — kompaniya 1 ga
 *  qattiq bog'langan edi (boshqa kompaniya tanlansa ham har doim
 *  1-kompaniyani ko'rsatardi). Endi `useKompaniya()` orqali joriy
 *  kompaniyadan o'qiydi. */
export default function TestTizim() {
  const { joriy } = useKompaniya();
  const [data, setData] = useState<AuditLog[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');

  const yukla = () => {
    if (!joriy?.id) return;
    setYuklanmoqda(true);
    setXato('');
    sbTizimLoglari(joriy.id).then((r) => {
      setYuklanmoqda(false);
      if (r.ok) setData(r.qatorlar || []);
      else setXato(r.error || 'O\'qilmadi');
    });
  };

  useEffect(() => { yukla(); }, [joriy]);

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen flex flex-col">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-400 flex items-center gap-2">
            <ShieldAlert />
            Tizim Audit Loglari
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Kompaniyadagi barcha amallar — kim, qachon, qaysi bo'limda</p>
        </div>
        <button onClick={yukla} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded flex items-center gap-2">
          <RefreshCw size={16} className={yuklanmoqda ? 'animate-spin' : ''} /> Yangilash
        </button>
      </div>

      {xato && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>
      )}

      <div className="flex-1 bg-black border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
        {yuklanmoqda && data.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 animate-pulse">Yuklanmoqda...</div>
        ) : (
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800 text-zinc-400 sticky top-0">
                <tr>
                  <th className="p-3">Sana</th>
                  <th className="p-3">Modul / Amal</th>
                  <th className="p-3">Kim</th>
                  <th className="p-3">IP</th>
                  <th className="p-3">Tafsilot</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center text-zinc-600 font-medium">Hech qanday log topilmadi.</td></tr>
                )}
                {data.map((l) => (
                  <tr key={l.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/30 font-mono text-[12px]">
                    <td className="p-3 text-zinc-500 whitespace-nowrap">{(l.yaratilgan_vaqt || '').substring(0, 19).replace('T', ' ')}</td>
                    <td className="p-3">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded mr-2">{l.modul}</span>
                      <span className="text-emerald-400">{l.amal_turi}</span>
                    </td>
                    <td className="p-3 text-zinc-400">{l.kim || '-'}</td>
                    <td className="p-3 text-zinc-500 max-w-[200px] truncate">{l.ip_manzil || '-'}</td>
                    <td className="p-3 text-zinc-400 max-w-md truncate" title={l.tafsilot || ''}>
                      {l.tafsilot || '-'}
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
