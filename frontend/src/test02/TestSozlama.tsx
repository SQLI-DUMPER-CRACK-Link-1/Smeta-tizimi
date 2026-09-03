import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { sbSozlamaOl, sbSozlamaSaqla } from '../api/t2-sozlama';
import { Settings, Save, ShieldAlert, Building2, CreditCard, Link as LinkIcon, Key, Users, ChevronRight } from 'lucide-react';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';

export default function TestSozlama() {
  const { joriy } = useKompaniya();
  const [data, setData] = useState<any>({});
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [saqlanmoqda, setSaqlanmoqda] = useState(false);
  const [activeTab, setActiveTab] = useState<'umumiy' | 'moliya' | 'integratsiya' | 'xavfsizlik'>('umumiy');

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
      toast('Sozlamalar muvaffaqiyatli saqlandi', 'ok');
    } catch(e) {
      toast('Xatolik yuz berdi', 'danger');
    }
    setSaqlanmoqda(false);
  };

  const tabs = [
    { id: 'umumiy', nomi: 'Umumiy Akkaunt', icon: Building2 },
    { id: 'moliya', nomi: 'Moliya & Nazorat', icon: CreditCard },
    { id: 'integratsiya', nomi: 'Integratsiyalar', icon: LinkIcon },
    { id: 'xavfsizlik', nomi: 'Xavfsizlik & Audit', icon: ShieldAlert },
  ] as const;

  return (
    <div className="p-6 bg-[#0a0a0b] text-zinc-300 min-h-screen font-sans">
      <div className="flex justify-between items-end mb-6 border-b border-zinc-800/60 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
            <Settings size={22} className="text-slate-400" />
            Boshqaruv Markazi
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Akkaunt sozlamalari, moliyaviy nazorat va integratsiyalar
          </p>
        </div>
        <button 
          onClick={saqlash} 
          disabled={saqlanmoqda || yuklanmoqda} 
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-md flex items-center gap-2 text-sm font-medium transition-colors"
        >
          {saqlanmoqda ? 'Saqlanmoqda...' : <><Save size={16}/> Saqlash</>}
        </button>
      </div>

      <div className="flex gap-8">
        <div className="w-64 flex flex-col gap-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm transition-colors ${activeTab === t.id ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}`}
            >
              <t.icon size={16} className={activeTab === t.id ? 'text-slate-400' : 'text-zinc-500'} />
              {t.nomi}
            </button>
          ))}
        </div>

        <div className="flex-1">
          {yuklanmoqda ? (
            <div className="text-zinc-500 animate-pulse p-4">Kompaniya ma'lumotlari yuklanmoqda...</div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800/60 rounded-lg p-6 shadow-xl max-w-3xl">
              
              {activeTab === 'umumiy' && (
                <div className="space-y-4 animate-in fade-in">
                  <h2 className="text-lg font-medium text-white mb-2 border-b border-zinc-800/60 pb-2">Tashkilot Ma'lumotlari</h2>
                  <p className="text-sm text-zinc-400">
                    Kompaniya rekvizitlari (nom, STIR, manzil, tizimdagi roli) endi
                    <b className="text-zinc-200"> bitta joyda</b> boshqariladi — ikkita alohida
                    CRUD oynasi va jim ajralib ketadigan nusxa yo'q.
                  </p>
                  <Link to="/admin/kompaniya"
                    className="group inline-flex items-center gap-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 text-sm font-medium transition-colors">
                    <Building2 size={16} /> Kompaniya sahifasiga o'tish <ChevronRight size={15} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                  <p className="text-xs text-zinc-500">
                    Bu sahifada faqat haqiqiy ilova/foydalanuvchi sozlamalari qoladi:
                    valyuta, qat'iy nazorat, integratsiyalar, audit.
                  </p>
                </div>
              )}

              {activeTab === 'moliya' && (
                <div className="space-y-5 animate-in fade-in">
                  <h2 className="text-lg font-medium text-white mb-4 border-b border-zinc-800/60 pb-2">Moliyaviy va Qattiq Nazorat</h2>
                  
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Asosiy Valyuta</label>
                    <select 
                      value={data?.valyuta || 'UZS'} 
                      onChange={e => setData({...data, valyuta: e.target.value})} 
                      className="w-64 bg-zinc-900 border border-zinc-800 p-2 text-sm rounded focus:outline-none focus:border-slate-500"
                    >
                      <option value="UZS">UZS (O'zbek so'mi)</option>
                      <option value="USD">USD (AQSh dollari)</option>
                    </select>
                  </div>

                  <div className="pt-4 border-t border-zinc-800/60">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          checked={data?.qatiy_nazorat || false} 
                          onChange={e => setData({...data, qatiy_nazorat: e.target.checked})} 
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 accent-slate-500"
                        />
                      </div>
                      <div>
                        <div className="font-medium text-zinc-200 group-hover:text-white transition-colors">
                          Qat'iy Moliyaviy Nazorat (Idempotentlik)
                        </div>
                        <div className="text-xs text-zinc-500 mt-1 leading-relaxed max-w-xl">
                          Yoqilsa, smetadan tashqari ortiqcha xarajatlar va limitdan oshgan F2 lar tizim tomonidan avtomatik bloklanadi. Har bir operatsiya rahbariyat tasdig'ini (E-imzo) talab qiladi.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'integratsiya' && (
                <div className="space-y-5 animate-in fade-in">
                  <h2 className="text-lg font-medium text-white mb-4 border-b border-zinc-800/60 pb-2">Integratsiyalar (API)</h2>
                  
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Didox / EHF API Kaliti</label>
                    <div className="flex gap-2">
                      <input 
                        type="password"
                        value={data?.didox_key || ''} 
                        onChange={e => setData({...data, didox_key: e.target.value})} 
                        className="flex-1 bg-zinc-900 border border-zinc-800 p-2 text-sm font-mono rounded focus:outline-none focus:border-slate-500" 
                        placeholder="dx_live_*******************"
                      />
                      <button className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-sm transition-colors">Tekshirish</button>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Elektron hisob-fakturalarni (EHF) avtomatlashtirish uchun.</p>
                  </div>

                  <div className="pt-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white">
                      <input 
                        type="checkbox" 
                        checked={data?.avto_sinxronizatsiya || false} 
                        onChange={e => setData({...data, avto_sinxronizatsiya: e.target.checked})} 
                        className="w-4 h-4 rounded accent-slate-500"
                      />
                      Google Sheets (GAS) bilan uzluksiz sinxronizatsiya
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'xavfsizlik' && (
                <div className="space-y-5 animate-in fade-in">
                  <h2 className="text-lg font-medium text-white mb-4 border-b border-zinc-800/60 pb-2 flex items-center gap-2">
                    <ShieldAlert size={18} className="text-red-400" />
                    Xavfsizlik va Jurnallar
                  </h2>
                  
                  <div className="text-sm text-zinc-400 mb-6">
                    Tizimdagi barcha kiritish, o'zgartirish va o'chirish amallari o'zgartirib bo'lmaydigan (immutable) jurnallarda (PostgreSQL Triggers orqali) saqlanadi.
                  </div>

                  <Link to="/admin/test/tizim"
                    className="group flex flex-col p-4 bg-zinc-900/50 border border-zinc-800 hover:border-slate-500 hover:bg-zinc-900 rounded-lg transition-all">
                    <div className="flex items-center gap-2 font-medium text-slate-300 group-hover:text-slate-200">
                      Audit Jurnali (Qora Quti) <ChevronRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0"/>
                    </div>
                    <div className="text-xs text-zinc-500 mt-1">Barcha foydalanuvchilar harakati, IP manzillar va o'chirilgan fayllar arxivini ko'rish.</div>
                  </Link>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
