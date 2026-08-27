import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sbSozlamaOl, sbSozlamaSaqla } from '../api/t2-sozlama';
import { Settings, Save, ShieldAlert } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

/* ⚠️ 2026-08-27 (Claude): avval `sbSozlamaOl(1)`/`sbSozlamaSaqla(1,...)`
 * — kompaniya 1 ga qattiq bog'langan edi (boshqa kompaniya tanlansa
 * ham har doim 1-kompaniyaning sozlamasini o'qib/yozardi). Endi joriy
 * kompaniyadan. Sozlamalarning o'zi (maydonlar soni) — Antigravity
 * (sozlama domeni egasi) tomonidan kengaytiriladi, MULOQOT.md ga
 * qarang. Audit & Loglar foydalanuvchi ko'rsatmasi bilan shu yerga
 * (Sozlamalar ichiga) ko'chirildi. */
export default function TestSozlama() {
  const { joriy } = useKompaniya();
  const [data, setData] = useState<any>({});
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);

  useEffect(() => {
    if (!joriy?.id) return;
    setYuklanmoqda(true);
    sbSozlamaOl(joriy.id).then((r: any) => {
      setData(r || {});
      setYuklanmoqda(false);
    });
  }, [joriy]);

  const saqlash = async () => {
    if (!joriy?.id) return;
    setSaqlanmoqda(true);
    try {
      await sbSozlamaSaqla(joriy.id, data);
      toast('Sozlamalar saqlandi', 'ok');
    } catch(e) {
      toast('Xatolik yuz berdi', 'danger');
    }
    setSaqlanmoqda(false);
  };

  return (
    <div className="p-6 bg-zinc-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-400 flex items-center gap-2">
            <Settings />
            Kompaniya Sozlamalari (Tizim_02)
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Dastur va tahlil parametrlarini boshqarish</p>
        </div>
        <button onClick={saqlash} disabled={saqlanmoqda || yuklanmoqda} className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded flex items-center gap-2">
          {saqlanmoqda ? 'Saqlanmoqda...' : <><Save size={16}/> Saqlash</>}
        </button>
      </div>

      {yuklanmoqda ? <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div> : (
        <div className="max-w-2xl bg-black border border-zinc-800 p-6 rounded-lg">
          
          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-1">Kompaniya Nomi</label>
            <input 
              value={data?.kompaniya_nomi || ''} 
              onChange={e => setData({...data, kompaniya_nomi: e.target.value})} 
              className="w-full bg-zinc-800 border border-zinc-700 p-2 rounded focus:outline-none focus:border-slate-500" 
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-1">Valyuta</label>
            <select 
              value={data?.valyuta || 'UZS'} 
              onChange={e => setData({...data, valyuta: e.target.value})} 
              className="w-full bg-zinc-800 border border-zinc-700 p-2 rounded focus:outline-none focus:border-slate-500"
            >
              <option value="UZS">UZS (So'm)</option>
              <option value="USD">USD (Dollar)</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-zinc-400 mb-1 flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={data?.qatiy_nazorat || false} 
                onChange={e => setData({...data, qatiy_nazorat: e.target.checked})} 
                className="w-4 h-4"
              />
              Qat'iy moliyaviy nazorat (Idempotentlik + Tasdiqlashlar majburiy)
            </label>
          </div>
          
          <div className="p-4 bg-slate-500/10 border border-slate-500/20 rounded-lg text-sm text-slate-300">
            <strong>Eslatma:</strong> Bu yerda saqlangan sozlamalar faqat Tizim_02 doirasida test qilinadi va haqiqiy muhitdagi <code>t2_sozlama</code> jadvaliga yoziladi.
          </div>

          <Link to="/admin/test/tizim"
            className="mt-4 flex items-center gap-3 p-4 bg-black border border-zinc-800 hover:border-slate-500 rounded-lg transition-colors">
            <ShieldAlert size={20} className="text-slate-400" />
            <div>
              <div className="font-medium text-slate-300">Audit & Loglar</div>
              <div className="text-xs text-zinc-500">Kompaniyadagi barcha amallar — kim, qachon, qaysi bo'limda</div>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
