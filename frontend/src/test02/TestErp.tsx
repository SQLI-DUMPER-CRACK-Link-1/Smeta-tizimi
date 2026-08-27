import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';
import { LayoutDashboard, Users, Wrench, PackageSearch, Activity } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';

const MOCK_DATA: any = {
  kadrlar: [
    { ism: 'Alijon Valiyev', lavozim: 'Usta', oylik_maosh: 5000000, status: 'ishda', obyekt_id: 1 },
    { ism: 'Zarif Tojiyev', lavozim: 'Quruvchi', oylik_maosh: 4500000, status: 'smenada', obyekt_id: 1 },
    { ism: 'Kamola Qosimova', lavozim: 'Buxgalter', oylik_maosh: 7000000, status: 'ishda', obyekt_id: 2 }
  ],
  texnika: [
    { texnika_nomi: 'Ekskavator CAT-320', raqam: '01 A 123 BB', holat: 'ishchi', yoqilgi_sarfi: 15, obyekt_id: 1 },
    { texnika_nomi: 'Yuk mashinasi KAMAZ', raqam: '01 456 CCC', holat: 'tamirda', yoqilgi_sarfi: 25, obyekt_id: 2 }
  ],
  taminot: [
    { buyurtma_raqami: 'T-001', maxsulot: 'Sement M400', miqdor: 50, birlik: 'tonna', holat: 'kutilmoqda', obyekt_id: 1 },
    { buyurtma_raqami: 'T-002', maxsulot: 'Armatura 12mm', miqdor: 20, birlik: 'tonna', holat: 'yetkazildi', obyekt_id: 1 }
  ],
  sifat: [
    { tekshiruv_sana: '2026-08-25', obyekt: 'A-Blok', inspektor: 'N. Tursunov', xulosa: 'Qoniqarli', kamchiliklar: 'Yoq', obyekt_id: 1 },
    { tekshiruv_sana: '2026-08-26', obyekt: 'B-Blok', inspektor: 'N. Tursunov', xulosa: 'Ogirlik', kamchiliklar: 'Beton qurimagan', obyekt_id: 2 }
  ]
};

export default function TestErp() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'taminot'|'sifat'>((params.get('modul') as any) || 'kadrlar');
  const [data, setData] = useState<any[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const obyektId = params.get('obyektId');

  useEffect(() => {
    setYuklanmoqda(true);
    sbErpDashboardOl(modul, joriy?.id || 1).then(r => {
      let q = r.qatorlar || [];
      // Fallback to MOCK if backend view is not ready
      if (!r.ok || q.length === 0) {
        q = MOCK_DATA[modul] || [];
      }
      setData(obyektId ? q.filter((x: any) => x.obyekt_id == obyektId) : q);
      setYuklanmoqda(false);
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
