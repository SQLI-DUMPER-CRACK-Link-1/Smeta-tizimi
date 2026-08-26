import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbFakturalarOl, sbFakturaYoz, sbSkladgaYozish, sbT2ObyektlarOl, type T2Faktura, type T2Obyekt } from '../api/supabase';
import { FileText, CheckCircle2, PackagePlus, AlertCircle, Building2 } from 'lucide-react';

export default function TestFaktura() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [fakturalar, setFakturalar] = useState<T2Faktura[]>([]);
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [tanlanganObId, setTanlanganObId] = useState<number | null>(null);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [xato, setXato] = useState('');

  useEffect(() => {
    sbT2ObyektlarOl().then(r => {
      if (r.ok && r.qatorlar) {
        setObyektlar(r.qatorlar);
        if (r.qatorlar.length > 0) setTanlanganObId(r.qatorlar[0].id);
      }
    });
    fakturalarniYukla();
  }, [aktKomp]);

  const fakturalarniYukla = () => {
    setYuklanmoqda(true);
    sbFakturalarOl(aktKomp).then((r: any) => {
      setYuklanmoqda(false);
      if (r.ok) {
        setFakturalar(r.qatorlar || []);
      } else {
        setXato(r.error || 'Xato yuz berdi');
      }
    });
  };

  const skladgaQabulQil = async (faktura: T2Faktura) => {
    if (!tanlanganObId) {
      setXato('Obyekt tanlanmagan!');
      return;
    }
    
    setYuklanmoqda(true);
    setXato('');
    
    try {
      // Mock items if empty for demonstration
      const items = faktura.items && faktura.items.length > 0 ? faktura.items : [
        { nomi: 'Sement M400 (Didox)', birligi: 't', obyomi: 20 },
        { nomi: 'Armatura 12mm (Didox)', birligi: 't', obyomi: 5 }
      ];

      // Skladga prixod qilish
      for (const item of items) {
        const res = await sbSkladgaYozish(aktKomp, 'prixod', {
          obyekt_id: tanlanganObId,
          turi: 'MAT',
          sana: new Date().toISOString().split('T')[0],
          nomi: item.nomi,
          birligi: item.birligi,
          obyomi: String(item.obyomi)
        }, 1);
        if (!res.ok) throw new Error(res.error || 'Skladga yozishda xato');
      }

      // Fakturani tasdiqlangan holatga o'tkazish
      const fRes = await sbFakturaYoz({ ...faktura, holat: 'tasdiqlangan' });
      if (!fRes.ok) throw new Error(fRes.error || 'Faktura holatini yangilashda xato');

      fakturalarniYukla();
    } catch (err: any) {
      setXato(err.message);
    } finally {
      setYuklanmoqda(false);
    }
  };

  // Yangi mock faktura yaratish
  const mockFakturaYarat = async () => {
    setYuklanmoqda(true);
    await sbFakturaYoz({
      kompaniya_id: aktKomp,
      raqam: 'EHF-' + Math.floor(Math.random() * 10000),
      sana: new Date().toISOString().split('T')[0],
      kontragent: "OOO Qurilish Ta'minot",
      inn: '30' + Math.floor(Math.random() * 10000000),
      summa: Math.floor(Math.random() * 50000000) + 1000000,
      holat: 'yangi',
      items: [
        { nomi: 'G\'isht', birligi: 'sht', obyomi: 10000 },
        { nomi: 'Kafel', birligi: 'm2', obyomi: 200 }
      ]
    } as T2Faktura);
    fakturalarniYukla();
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <FileText className="text-sky-400" />
            Elektron Hisob Fakturalar (Didox Integratsiyasi)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Didox.uz / Soliq.uz orqali kelgan EHF larni to'g'ridan-to'g'ri skladga kirim qilish (Avto-Prixod)
          </p>
        </div>
        <button 
          onClick={mockFakturaYarat}
          disabled={yuklanmoqda}
          className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded font-medium text-sm transition-colors disabled:opacity-50"
        >
          + Yangi EHF (Mock)
        </button>
      </div>

      {xato && (
        <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4 flex items-center gap-2 border border-red-500/30">
          <AlertCircle size={16} /> {xato}
        </div>
      )}

      <div className="bg-black border border-zinc-800 rounded-lg p-4 mb-6 flex items-center gap-4">
        <Building2 className="text-zinc-400" size={20} />
        <span className="text-zinc-300">Qaysi obyekt skladiga qabul qilinadi:</span>
        <select 
          className="bg-zinc-900 border border-zinc-700 rounded p-1.5 text-sm w-64 focus:outline-none focus:border-sky-500"
          value={tanlanganObId || ''}
          onChange={e => setTanlanganObId(Number(e.target.value))}
        >
          {obyektlar.map(o => (
            <option key={o.id} value={o.id}>{o.nomi}</option>
          ))}
        </select>
      </div>

      {yuklanmoqda && <div className="text-sky-400 mb-4 animate-pulse">Yuklanmoqda...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fakturalar.map((f, i) => (
          <div key={i} className="border border-zinc-800 p-5 bg-black rounded-lg shadow-xl relative overflow-hidden group">
            {f.holat === 'tasdiqlangan' && (
              <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-bl-lg text-xs font-bold border-b border-l border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 size={12} /> Qabul qilingan
              </div>
            )}
            
            <h2 className="font-bold text-lg mb-2 text-zinc-100 flex items-center gap-2">
              № {f.raqam}
            </h2>
            
            <div className="grid grid-cols-2 gap-2 text-sm text-zinc-400 mb-4">
              <div><span className="text-zinc-500">Sana:</span> {f.sana}</div>
              <div><span className="text-zinc-500">INN:</span> {f.inn}</div>
              <div className="col-span-2"><span className="text-zinc-500">Kontragent:</span> <span className="text-amber-200/80">{f.kontragent}</span></div>
              <div className="col-span-2"><span className="text-zinc-500">Summa:</span> <b className="text-emerald-400">{(Number(f.summa)).toLocaleString('ru-RU')} so'm</b></div>
            </div>

            <div className="bg-zinc-900/50 p-3 rounded border border-zinc-800/50 mb-4">
              <div className="text-xs text-zinc-500 mb-2 font-medium">Tarkibidagi tovarlar:</div>
              <ul className="text-xs text-zinc-300 space-y-1">
                {(f.items && f.items.length > 0 ? f.items : [{nomi:'Sement', birligi:'t', obyomi:20}]).map((item: any, idx: number) => (
                  <li key={idx} className="flex justify-between border-b border-zinc-800/50 pb-1">
                    <span>{item.nomi}</span>
                    <span className="text-sky-400 font-mono">{item.obyomi} {item.birligi}</span>
                  </li>
                ))}
              </ul>
            </div>

            {f.holat === 'yangi' && (
              <button 
                onClick={() => skladgaQabulQil(f)}
                disabled={yuklanmoqda}
                className="w-full bg-sky-600/20 text-sky-400 hover:bg-sky-600 hover:text-white border border-sky-600/50 py-2 rounded-lg flex items-center justify-center gap-2 transition-all font-medium disabled:opacity-50"
              >
                <PackagePlus size={18} />
                Skladga Kirim Qilish (Prixod)
              </button>
            )}
          </div>
        ))}
        {fakturalar.length === 0 && !yuklanmoqda && (
          <div className="col-span-full text-center text-zinc-500 py-10 border border-dashed border-zinc-800 rounded-lg">
            Hozircha fakturalar yo'q. "Yangi EHF" tugmasini bosib mock ma'lumot yarating.
          </div>
        )}
      </div>
    </div>
  );
}

