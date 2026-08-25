import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbFakturalarOl, type T2Faktura } from '../api/supabase';

export default function TestFaktura() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [fakturalar, setFakturalar] = useState<T2Faktura[]>([]);
  const [xato, setXato] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbFakturalarOl(aktKomp).then(r => {
      setYuklanmoqda(false);
      if (r.ok && r.qatorlar) {
        setFakturalar(r.qatorlar);
      } else {
        setXato(r.error || 'Xato');
      }
    });
  }, [aktKomp]);

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Fakturalar (Didox EHF)</h1>
      {xato && <div className="text-red-400 mb-2">{xato}</div>}
      
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <table className="w-full text-left border-collapse border border-zinc-700 mt-4">
          <thead>
            <tr className="bg-zinc-800 border-b border-zinc-700">
              <th className="p-2">Raqami</th>
              <th className="p-2">Sana</th>
              <th className="p-2">Kontragent</th>
              <th className="p-2">INN</th>
              <th className="p-2 text-right">Summa</th>
              <th className="p-2 text-center">Holat</th>
            </tr>
          </thead>
          <tbody>
            {fakturalar.map((f, i) => (
              <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="p-2">{f.raqam}</td>
                <td className="p-2">{f.sana}</td>
                <td className="p-2">{f.kontragent}</td>
                <td className="p-2">{f.inn}</td>
                <td className="p-2 text-right font-bold text-emerald-400">{f.summa}</td>
                <td className="p-2 text-center">
                  <span className={\px-2 py-1 rounded text-xs font-bold \\}>
                    {f.holat}
                  </span>
                </td>
              </tr>
            ))}
            {fakturalar.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-zinc-500">
                  Fakturalar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
