import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  sbT2ObyektlarOl, 
  sbSkladQoldiqOl, 
  sbSkladgaYozish, 
  type T2Obyekt, 
  type T2SkladQoldiq,
  type T2SkladHarakat 
} from '../api/supabase';

export default function TestSklad() {
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [obId, setObId] = useState<number | null>(null);
  const [qoldiqlar, setQoldiqlar] = useState<T2SkladQoldiq[]>([]);
  const [xato, setXato] = useState('');
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  // Form states
  const [operatsiya, setOperatsiya] = useState<'prixod' | 'rasxod'>('prixod');
  const [nomi, setNomi] = useState('');
  const [birligi] = useState('sht');
  const [obyomi, setObyomi] = useState('');
  const [turi] = useState('MAT');

  useEffect(() => {
    sbT2ObyektlarOl().then(r => {
      if (r.ok && r.qatorlar) {
        setObyektlar(r.qatorlar);
        if (r.qatorlar.length > 0 && !obId) {
          setObId(r.qatorlar[0].id);
        }
      }
    });
  }, [aktKomp]);

  useEffect(() => {
    if (obId) {
      setYuklanmoqda(true);
      sbSkladQoldiqOl(obId).then(r => {
        setYuklanmoqda(false);
        if (r.ok && r.qatorlar) {
          setQoldiqlar(r.qatorlar);
          setXato('');
        } else {
          setXato(r.error || 'Xato');
        }
      });
    }
  }, [obId]);

  const onSubmit = async () => {
    if (!obId) return;
    const item: T2SkladHarakat = {
      obyekt_id: obId,
      operatsiya,
      turi,
      sana: new Date().toISOString().split('T')[0],
      nomi,
      birligi,
      obyomi: Number(obyomi) || 0
    };
    
    // Yozish uchun versiya kerak, hozircha 1 deb beramiz (yoki DB dagi joriy versiya)
    const r = await sbSkladgaYozish(aktKomp, operatsiya, item, 1);
    if (r.ok) {
      // Refresh
      const q = await sbSkladQoldiqOl(obId);
      if (q.ok && q.qatorlar) setQoldiqlar(q.qatorlar);
      setNomi(''); setObyomi('');
    } else {
      setXato(r.error || 'Saqlashda xato');
    }
  };

  return (
    <div className="p-4 bg-zinc-900 text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-sky-400">Sklad Boshqaruvi</h1>
      {xato && <div className="text-red-400 mb-2">{xato}</div>}
      
      <div className="mb-4">
        <label className="mr-2">Obyekt:</label>
        <select 
          className="bg-zinc-800 border border-zinc-700 p-2 rounded"
          value={obId || ''} 
          onChange={(e) => setObId(Number(e.target.value))}
        >
          {obyektlar.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-end border border-white/10">
        <div>
          <label className="block text-xs text-zinc-400">Operatsiya</label>
          <select 
            className="bg-zinc-900 border border-zinc-700 p-2 rounded text-white"
            value={operatsiya} 
            onChange={(e) => setOperatsiya(e.target.value as any)}
          >
            <option value="prixod">Prixod</option>
            <option value="rasxod">Rasxod</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Nomi</label>
          <input 
            className="bg-zinc-900 border-zinc-700 w-48 text-white" 
            value={nomi} 
            onChange={(e: any) => setNomi(e.target.value)} 
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400">Obyomi</label>
          <input 
            type="number"
            className="bg-zinc-900 border-zinc-700 w-24 text-white" 
            value={obyomi} 
            onChange={(e: any) => setObyomi(e.target.value)} 
          />
        </div>
        <button 
          onClick={onSubmit}
          className="bg-emerald-500 hover:bg-emerald-600 text-white"
        >
          Saqlash
        </button>
      </div>

      <h2 className="text-xl mb-2 text-sky-400">Qoldiqlar</h2>
      {yuklanmoqda ? <div>Yuklanmoqda...</div> : (
        <table className="w-full text-left border-collapse border border-zinc-700">
          <thead>
            <tr className="bg-zinc-800 border-b border-zinc-700">
              <th className="p-2">Nomi</th>
              <th className="p-2">Birligi</th>
              <th className="p-2 text-right">Prixod</th>
              <th className="p-2 text-right">Rasxod</th>
              <th className="p-2 text-right text-emerald-400">Qoldiq</th>
            </tr>
          </thead>
          <tbody>
            {qoldiqlar.map((q, i) => (
              <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="p-2">{q.nomi}</td>
                <td className="p-2">{q.birligi}</td>
                <td className="p-2 text-right">{q.prixod_obyomi}</td>
                <td className="p-2 text-right">{q.rasxod_obyomi}</td>
                <td className="p-2 text-right text-emerald-400 font-bold">{q.qoldiq_obyomi}</td>
              </tr>
            ))}
            {qoldiqlar.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-zinc-500">
                  Qoldiqlar yo'q
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

