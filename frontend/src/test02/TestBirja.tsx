import { useState, useEffect } from 'react';
import { sbBirjaSorovOl, sbBirjaRfqYarat, sbBirjaTaklifBer, type BirjaRfq } from '../api/t2-birja';
import { ShoppingCart, Gavel, FileCheck, PackageSearch, Plus, MapPin, Building2 } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestBirja() {
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;
  const [rfqlar, setRfqlar] = useState<BirjaRfq[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  
  // Modals
  const [yangiRfqOchiq, setYangiRfqOchiq] = useState(false);
  const [taklifOchiq, setTaklifOchiq] = useState<number | null>(null);

  // Forms
  const [fNom, setFNom] = useState('');
  const [fBirlik, setFBirlik] = useState('t');
  const [fHajm, setFHajm] = useState('');
  const [fIzoh, setFIzoh] = useState('');
  
  const [tNarx, setTNarx] = useState('');
  const [tIzoh, setTIzoh] = useState('');

  useEffect(() => {
    yukla();
  }, []);

  const yukla = () => {
    setYuklanmoqda(true);
    sbBirjaSorovOl().then(r => {
      setYuklanmoqda(false);
      if (r.ok) {
        setRfqlar(r.qatorlar || []);
      } else {
        toast(r.error || 'RFQ ro\'yxati o\'qilmadi', 'danger');
      }
    });
  };

  const rfqYarat = async () => {
    if (!fNom.trim() || !fHajm || Number(fHajm) <= 0) {
      toast('Material nomi va hajmini kiriting', 'warn');
      return;
    }
    if (!aktKomp) {
      toast('Kompaniya tanlanmagan', 'warn');
      return;
    }
    setYuklanmoqda(true);
    const r = await sbBirjaRfqYarat({
      nom: fNom, birlik: fBirlik, hajm: Number(fHajm), izoh: fIzoh,
      kompaniya_id: aktKomp,
    });
    setYuklanmoqda(false);
    if (r.ok) {
      toast('✓ Tender yaratildi', 'ok');
      setYangiRfqOchiq(false);
      setFNom(''); setFHajm(''); setFIzoh('');
      yukla();
    } else {
      toast(r.error || 'Xato', 'danger');
    }
  };

  const taklifBer = async (rfqId: number) => {
    if (!tNarx || Number(tNarx) <= 0) {
      toast('Narx kiriting', 'warn');
      return;
    }
    if (!aktKomp) {
      toast('Kompaniya tanlanmagan', 'warn');
      return;
    }
    setYuklanmoqda(true);
    const r = await sbBirjaTaklifBer(rfqId, aktKomp, Number(tNarx), tIzoh);
    setYuklanmoqda(false);
    if (r.ok) {
      toast('✓ Taklif yuborildi', 'ok');
      setTaklifOchiq(null);
      setTNarx(''); setTIzoh('');
      yukla();
    } else {
      toast(r.error || 'Xato', 'danger');
    }
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2">
            <ShoppingCart className="text-sky-400" />
            B2B Materiallar Birjasi (Tenderlar)
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Pudratchilar moddiy resurslarga so'rov tashlaydi (RFQ) va ta'minotchilar tenderda qatnashadi.
          </p>
        </div>
        <button 
          onClick={() => setYangiRfqOchiq(true)}
          className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded flex items-center gap-2 font-medium transition-colors"
        >
          <Plus size={18} /> Yangi Tender (RFQ)
        </button>
      </div>

      {yuklanmoqda && <div className="text-sky-400 mb-4 animate-pulse">Yuklanmoqda...</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {rfqlar.map((r, i) => (
          <div key={i} className="border border-zinc-800 bg-black rounded-lg p-5 shadow-lg relative flex flex-col">
            <div className="flex justify-between items-start mb-3">
              <h2 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                <PackageSearch size={18} className="text-sky-400"/> {r.nom || "Noma'lum material"}
              </h2>
              <span className="bg-sky-500/20 text-sky-300 text-xs px-2 py-1 rounded border border-sky-500/30">
                {r.holat || 'Ochiq'}
              </span>
            </div>
            
            <div className="text-3xl font-light text-emerald-400 mb-4">
              {r.hajm} <span className="text-lg text-emerald-600">{r.birlik}</span>
            </div>

            <div className="space-y-2 mb-4 flex-1 text-sm">
              <div className="flex items-center gap-2 text-zinc-400">
                <Building2 size={14} /> Buyurtmachi ID: {r.kompaniya_id}
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <MapPin size={14} /> Obyektga yetkazish bilan
              </div>
              <div className="flex items-start gap-2 text-zinc-400">
                <FileCheck size={14} className="mt-0.5" /> 
                <span className="flex-1 italic">{r.izoh || "Qo'shimcha shartlar ko'rsatilmagan"}</span>
              </div>
            </div>

            {taklifOchiq === r.id ? (
              <div className="bg-zinc-900 border border-zinc-700 p-3 rounded mt-auto">
                <div className="text-sm text-sky-400 mb-2 font-medium">Taklif narxini kiriting (1 {r.birlik} uchun):</div>
                <input 
                  type="number" 
                  className="w-full bg-black border border-zinc-700 rounded p-1.5 mb-2 text-sm focus:border-sky-500 outline-none" 
                  placeholder="Summa so'mda..."
                  value={tNarx} onChange={e => setTNarx(e.target.value)}
                />
                <input 
                  type="text" 
                  className="w-full bg-black border border-zinc-700 rounded p-1.5 mb-3 text-sm focus:border-sky-500 outline-none" 
                  placeholder="Izoh (masalan: ertaga yetkazaman)"
                  value={tIzoh} onChange={e => setTIzoh(e.target.value)}
                />
                <div className="flex gap-2">
                  <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded text-sm transition-colors" onClick={() => taklifBer(r.id)}>Yuborish</button>
                  <button className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white py-1.5 rounded text-sm transition-colors" onClick={() => setTaklifOchiq(null)}>Bekor qilish</button>
                </div>
              </div>
            ) : (
              <button 
                className="w-full bg-sky-600/10 text-sky-400 border border-sky-600/30 hover:bg-sky-600 hover:text-white py-2 rounded flex items-center justify-center gap-2 transition-colors mt-auto font-medium" 
                onClick={() => setTaklifOchiq(r.id)}
              >
                <Gavel size={16} /> Tenderda qatnashish
              </button>
            )}
          </div>
        ))}
        {rfqlar.length === 0 && !yuklanmoqda && (
          <div className="col-span-full py-12 text-center text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            Hozircha birjada tenderlar yo'q. "Yangi Tender" tugmasi orqali so'rov yarating.
          </div>
        )}
      </div>

      {/* MODAL: Yangi RFQ */}
      {yangiRfqOchiq && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-[400px]">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
              <Plus className="text-sky-400"/> Tender So'rovi
            </h2>
            
            <label className="block text-sm text-zinc-400 mb-1">Material nomi</label>
            <input type="text" className="w-full bg-black border border-zinc-700 rounded p-2 mb-3 outline-none focus:border-sky-500" value={fNom} onChange={e=>setFNom(e.target.value)} placeholder="Masalan: M400 Sement" />
            
            <div className="flex gap-3 mb-3">
              <div className="flex-1">
                <label className="block text-sm text-zinc-400 mb-1">Hajmi</label>
                <input type="number" className="w-full bg-black border border-zinc-700 rounded p-2 outline-none focus:border-sky-500" value={fHajm} onChange={e=>setFHajm(e.target.value)} />
              </div>
              <div className="w-24">
                <label className="block text-sm text-zinc-400 mb-1">O'lchovi</label>
                <select className="w-full bg-black border border-zinc-700 rounded p-2 outline-none focus:border-sky-500" value={fBirlik} onChange={e=>setFBirlik(e.target.value)}>
                  <option value="t">Tonna</option>
                  <option value="m3">M.Kub</option>
                  <option value="sht">Dona</option>
                  <option value="kg">Kg</option>
                </select>
              </div>
            </div>

            <label className="block text-sm text-zinc-400 mb-1">Qo'shimcha shartlar</label>
            <textarea className="w-full bg-black border border-zinc-700 rounded p-2 mb-5 outline-none focus:border-sky-500 h-20" value={fIzoh} onChange={e=>setFIzoh(e.target.value)} placeholder="Toshkent shahar, Yunusobodga yetkazib berish bilan..."></textarea>

            <div className="flex gap-2 justify-end">
              <button className="px-4 py-2 rounded text-zinc-300 hover:text-white" onClick={() => setYangiRfqOchiq(false)}>Bekor qilish</button>
              <button className="bg-sky-600 hover:bg-sky-500 px-4 py-2 rounded font-medium" onClick={rfqYarat}>Yaratish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


