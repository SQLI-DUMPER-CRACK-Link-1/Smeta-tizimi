import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';
import { LayoutDashboard, Users, Wrench, PackageSearch, Activity } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';

/* ⚠️ 2026-08-27 (Claude): BU YERDA AVVAL `MOCK_DATA` FALLBACK BOR EDI —
 * backend so'rovi bo'sh yoki xato qaytarsa, TO'QILGAN soxta ism/texnika/
 * tekshiruv yozuvlari (masalan "Alijon Valiyev", "Ekskavator CAT-320")
 * jim ko'rsatilardi, haqiqiy ma'lumotdan farqlanmaydigan holda.
 * Foydalanuvchi to'g'ri payqadi: "ERP boshqaruvda nima bo'ladi
 * tushunmadim, yolg'on tizim". Bu loyihaning ENG QATTIQ qoidasini
 * buzardi (NARX/MA'LUMOT O'ZIDAN TO'QILMAYDI). Olib tashlandi — endi
 * bo'sh bo'lsa OCHIQ "ma'lumot yo'q" holati ko'rsatiladi. */
export default function TestErp() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'taminot'|'sifat'>((params.get('modul') as any) || 'kadrlar');
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');
  const obyektId = params.get('obyektId');

  useEffect(() => {
    if (!joriy?.id) return;
    setYuklanmoqda(true);
    setXato('');
    sbErpDashboardOl(modul, joriy.id).then(r => {
      setYuklanmoqda(false);
      if (!r.ok) {
        setXato(r.error || 'O\'qilmadi');
        setData([]);
        return;
      }
      const q = r.qatorlar || [];
      setData(obyektId ? q.filter((x: any) => x.obyekt_id == obyektId) : q);
    });
  }, [modul, obyektId, joriy]);

  const keys = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'kompaniya_id' && k !== 'obyekt_id') : [];

  const icons = {
    kadrlar: <Users size={16}/>,
    texnika: <Wrench size={16}/>,
    taminot: <PackageSearch size={16}/>,
    sifat: <Activity size={16}/>
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-6 text-sky-400 flex items-center gap-2">
        <LayoutDashboard />
        ERP Boshqaruv (Tizim_02) {obyektId ? ' - Obyekt: ' + obyektId : ''}
      </h1>

      <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-4">
        {(['kadrlar', 'texnika', 'taminot', 'sifat'] as const).map(m => (
          <button
            key={m}
            className={
              "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors " +
              (modul === m ? 'bg-sky-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')
            }
            onClick={() => setModul(m)}
          >
            {icons[m]} {m.toUpperCase()}
          </button>
        ))}
      </div>

      {xato && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg text-sm">{xato}</div>
      )}

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="border border-zinc-800 rounded-lg overflow-x-auto bg-black">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-zinc-800 text-zinc-400">
              <tr>
                {keys.map(k => (
                  <th key={k} className="p-3 uppercase text-xs">{k.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={keys.length || 1} className="p-6 text-center text-zinc-500 font-medium">
                    {modul.toUpperCase()} bo'limida ma'lumot topilmadi
                  </td>
                </tr>
              )}
              {data.map((row, i) => (
                <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                  {keys.map(k => (
                    <td key={k} className="p-3 text-zinc-300">
                      {typeof row[k] === 'number' && row[k] > 1000 ? new Intl.NumberFormat('ru-RU').format(row[k]) : String(row[k] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

