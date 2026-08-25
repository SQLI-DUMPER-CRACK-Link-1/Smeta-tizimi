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
  const [birligi, setBirligi] = useState('sht');
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

  // When changing operation to rasxod, reset nomi
  useEffect(() => {
    setNomi('');
  }, [operatsiya]);

  const joriyQoldiqData = qoldiqlar.find(q => q.nomi === nomi);

  const onSubmit = async () => {
    if (!obId) return;
    if (!nomi.trim()) {
      setXato('Nomini kiriting yoki tanlang');
      return;
    }
    const o = Number(obyomi);
    if (!o || o <= 0) {
      setXato('Obyom noldan katta bo\'lishi kerak');
      return;
    }

    let ishlatiladiganBirlik = birligi;

    if (operatsiya === 'rasxod') {
      if (!joriyQoldiqData) {
        setXato('Kiritilgan nom bazada yo\'q!');
        return;
      }
      if (joriyQoldiqData.qoldiq_obyomi < o) {
        setXato('Qoldiq yetarli emas! Faqat ' + joriyQoldiqData.qoldiq_obyomi + ' ' + joriyQoldiqData.birligi + ' bor.');
        return;
      }
      ishlatiladiganBirlik = joriyQoldiqData.birligi;
    }

    const item: T2SkladHarakat = {
      obyekt_id: obId,
      operatsiya,
      turi,
      sana: new Date().toISOString().split('T')[0],
      nomi,
      birligi: ishlatiladiganBirlik,
      obyomi: o
    };
    
    setXato('');
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
      {xato && <div className="text-red-400 bg-red-900/50 p-2 rounded mb-4 border border-red-500/50">{xato}</div>}
      
      <div className="mb-4">
        <label className="mr-2">Obyekt:</label>
        <select 
          className="bg-zinc-800 border border-zinc-700 p-2 rounded text-white"
          value={obId || ''} 
          onChange={(e) => setObId(Number(e.target.value))}
        >
          {obyektlar.map(o => <option key={o.id} value={o.id}>{o.nom}</option>)}
        </select>
      </div>

      <div className="bg-zinc-800 p-4 rounded-lg mb-6 flex flex-wrap gap-4 items-end border border-zinc-700 shadow-lg">
        <div>
          <label className="block text-xs text-zinc-400 mb-1">Operatsiya</label>
          <select 
            className="bg-zinc-900 border border-zinc-700 p-2 rounded text-white"
            value={operatsiya} 
            onChange={(e) => setOperatsiya(e.target.value as any)}
          >
            <option value="prixod"> Prixod (Kirim)</option>
            <option value="rasxod"> Rasxod (Chiqim)</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-zinc-400 mb-1">
            Nomi {operatsiya === 'rasxod' && '(Faqat ombordagi mahsulotlar)'}
          </label>
          {operatsiya === 'rasxod' ? (
            <select
              className="bg-zinc-900 border border-zinc-700 p-2 rounded text-white w-full"
              value={nomi}
              onChange={(e) => setNomi(e.target.value)}
            >
              <option value="">-- Ombordagi mahsulotni tanlang --</option>
              {qoldiqlar.filter(q => q.qoldiq_obyomi > 0).map((q, i) => (
                <option key={i} value={q.nomi}>{q.nomi} (Qoldiq: {q.qoldiq_obyomi} {q.birligi})</option>
              ))}
            </select>
          ) : (
            <input 
              className="bg-zinc-900 border border-zinc-700 p-2 rounded text-white w-full" 
              value={nomi} 
              onChange={(e) => setNomi(e.target.value)} 
              placeholder="Yangi yoki mavjud mahsulot nomi"
            />
          )}
        </div>

        {operatsiya === 'prixod' && (
          <div className="w-24">
            <label className="block text-xs text-zinc-400 mb-1">Birligi</label>
            <input 
              className="bg-zinc-900 border border-zinc-700 p-2 rounded text-white w-full" 
              value={birligi} 
              onChange={(e) => setBirligi(e.target.value)} 
              placeholder="sht, m3, t"
            />
          </div>
        )}

        <div className="w-32">
          <label className="block text-xs text-zinc-400 mb-1">
            Miqdori {joriyQoldiqData && operatsiya === 'rasxod' ? (Maks: ) : ''}
          </label>
          <div className="flex items-center">
            <input 
              type="number"
              className="bg-zinc-900 border border-zinc-700 p-2 rounded-l text-white w-full" 
              value={obyomi} 
              onChange={(e) => setObyomi(e.target.value)} 
            />
            {operatsiya === 'rasxod' && joriyQoldiqData && (
               <span className="bg-zinc-700 border border-zinc-700 p-2 rounded-r text-sm text-zinc-300">
                 {joriyQoldiqData.birligi}
               </span>
            )}
          </div>
        </div>
        
        <button 
          onClick={onSubmit}
          className={"px-6 py-2 rounded text-white font-medium " + (operatsiya === 'prixod' ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500")}
        >
          {operatsiya === 'prixod' ? 'Kirim qilish' : 'Chiqim qilish'}
        </button>
      </div>

      <h2 className="text-xl mb-2 text-sky-400">Joriy Ombordagi Qoldiqlar</h2>
      {yuklanmoqda ? <div className="text-zinc-400">Yuklanmoqda...</div> : (
        <div className="overflow-x-auto rounded border border-zinc-700">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-800 border-b border-zinc-700">
                <th className="p-3 text-zinc-300">Nomi</th>
                <th className="p-3 text-zinc-300">Birligi</th>
                <th className="p-3 text-right text-zinc-300">Jami Kirim</th>
                <th className="p-3 text-right text-zinc-300">Jami Chiqim</th>
                <th className="p-3 text-right text-emerald-400 font-bold bg-emerald-900/10">Joriy Qoldiq</th>
              </tr>
            </thead>
            <tbody>
              {qoldiqlar.map((q, i) => (
                <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                  <td className="p-3 text-sky-100">{q.nomi}</td>
                  <td className="p-3 text-zinc-400">{q.birligi}</td>
                  <td className="p-3 text-right text-emerald-400/80">+{q.prixod_obyomi}</td>
                  <td className="p-3 text-right text-rose-400/80">-{q.rasxod_obyomi}</td>
                  <td className="p-3 text-right text-emerald-400 font-bold bg-emerald-900/10">{q.qoldiq_obyomi}</td>
                </tr>
              ))}
              {qoldiqlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-500">
                    Obyektda hozircha ombor qoldiqlari yo'q
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
