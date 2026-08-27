import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbErpDashboardOl } from '../api/t2-erp';
import { Users, Truck, Wrench, ShieldCheck, Plus, Search, Building2, MapPin, HardHat, FileText, CheckCircle2 } from 'lucide-react';
import { useKompaniya } from './KompaniyaTanlov';
import { toast } from '../umumiy/ui/Toast';

export default function TestErp() {
  const [params] = useSearchParams();
  const { joriy } = useKompaniya();
  const [modul, setModul] = useState<'kadrlar'|'texnika'|'sifat'>((params.get('modul') as any) || 'kadrlar');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fNomi, setFNomi] = useState('');
  const [fToifa, setFToifa] = useState('');
  const [fNarx, setFNarx] = useState('');

  // Demoga moslashtirilgan o'zgaruvchilar. (Keyin supabase ga ulanadi)
  const kadrlarList = [
    { id: 1, ism: "Rustamov Alisher", lavozim: "Prorab", brigada: "Betonchilar-1", tel: "+998 90 123 45 67", holat: "obyektda" },
    { id: 2, ism: "Valiyev Sherzod", lavozim: "Usta", brigada: "Suvoqchilar-2", tel: "+998 99 987 65 43", holat: "obyektda" },
  ];

  const texnikaList = [
    { id: 1, nomi: "Ekskavator CAT 320", toifa: "Og'ir texnika", davRaqami: "01 H 123 AB", motochas: 1450, holat: "ishlamoqda" },
    { id: 2, nomi: "Avtokran XCMG 25t", toifa: "Kranlar", davRaqami: "10 A 987 BA", motochas: 3200, holat: "ta'mirda" },
  ];

  const saqlash = () => {
    toast(`${modul === 'kadrlar' ? 'Xodim' : 'Texnika'} muvaffaqiyatli saqlandi (Demo)`, 'ok');
    setIsFormOpen(false);
    setFNomi('');
    setFToifa('');
    setFNarx('');
  };

  return (
    <div className="p-6 bg-bg min-h-screen text-text">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
            <Building2 className="text-blue-500" />
            Korxona Resurslarini Boshqarish (ERP)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Kompaniyaning markazlashgan HR, Maxsus texnikalar parki va Mehnat muhofazasi (HSE) boshqaruvi. Bu resurslar Obyektlarga dinamik biriktiriladi.
          </p>
        </div>
        <button 
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={18} />
          {modul === 'kadrlar' ? 'Yangi Xodim' : modul === 'texnika' ? 'Yangi Texnika' : 'Yangi Yozuv'}
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-surface border border-border p-1 rounded-lg w-max mb-6">
        {[
          { id: 'kadrlar', label: 'Xodimlar va Brigadalar', icon: Users },
          { id: 'texnika', label: 'Texnika Parki va Mexanizatsiya', icon: Truck },
          { id: 'sifat', label: 'Mehnat Muhofazasi (HSE) va Sifat', icon: ShieldCheck }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setModul(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${modul === tab.id ? 'bg-bg text-white shadow-sm border border-border' : 'text-text-dim hover:text-white hover:bg-surface-2'}`}
          >
            <tab.icon size={16} className={modul === tab.id ? 'text-blue-400' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* WRITE FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-bg/50">
              <h3 className="font-bold text-white flex items-center gap-2">
                {modul === 'kadrlar' ? <HardHat className="text-blue-400"/> : <Truck className="text-blue-400"/>}
                {modul === 'kadrlar' ? 'Xodimni ro\'yxatga olish' : 'Texnikani ro\'yxatga olish'}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">
                  {modul === 'kadrlar' ? 'F.I.Sh' : 'Texnika Nomi / Markasi'}
                </label>
                <input 
                  type="text" 
                  value={fNomi}
                  onChange={e => setFNomi(e.target.value)}
                  className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none" 
                  placeholder={modul === 'kadrlar' ? 'G\'aniyev Zafar' : 'CAT 320 Ekskavator'}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">
                    {modul === 'kadrlar' ? 'Lavozim / Kasb' : 'Davlat Raqami'}
                  </label>
                  <input 
                    type="text" 
                    value={fToifa}
                    onChange={e => setFToifa(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-dim mb-1">
                    {modul === 'kadrlar' ? 'Brigada (Ixtiyoriy)' : 'YoMM turi'}
                  </label>
                  <input 
                    type="text" 
                    value={fNarx}
                    onChange={e => setFNarx(e.target.value)}
                    className="w-full bg-bg border border-border rounded-lg px-3 py-2 text-white focus:border-accent outline-none" 
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-4">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-text-dim hover:text-white transition-colors">Bekor qilish</button>
                <button onClick={saqlash} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-blue-900/20">Saqlash</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT: KADRLAR */}
      {modul === 'kadrlar' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Xodim ishlari, kasb yoki brigada bo'yicha..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent outline-none"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">F.I.Sh</th>
                <th className="px-6 py-4">Kasb / Lavozim</th>
                <th className="px-6 py-4">Brigada</th>
                <th className="px-6 py-4">Telefon</th>
                <th className="px-6 py-4">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kadrlarList.map(k => (
                <tr key={k.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <Users size={16} className="text-blue-500" />
                    {k.ism}
                  </td>
                  <td className="px-6 py-4 text-text-dim">{k.lavozim}</td>
                  <td className="px-6 py-4 font-mono text-text-dim">{k.brigada}</td>
                  <td className="px-6 py-4 font-mono text-white">{k.tel}</td>
                  <td className="px-6 py-4">
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                      {k.holat}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTENT: TEXNIKA */}
      {modul === 'texnika' && (
        <div className="bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-4 border-b border-border bg-bg/50">
            <div className="relative w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
              <input 
                type="text" 
                placeholder="Texnika nomi yoki davlat raqami bo'yicha..."
                className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-accent outline-none"
              />
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">Texnika Nomi</th>
                <th className="px-6 py-4">Toifa</th>
                <th className="px-6 py-4">Davlat Raqami</th>
                <th className="px-6 py-4">Motochas / YoMM</th>
                <th className="px-6 py-4">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {texnikaList.map(t => (
                <tr key={t.id} className="hover:bg-bg/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <Truck size={16} className="text-amber-500" />
                    {t.nomi}
                  </td>
                  <td className="px-6 py-4 text-text-dim">{t.toifa}</td>
                  <td className="px-6 py-4 font-mono font-bold text-sky-300">
                    <span className="border border-sky-500/30 px-2 py-0.5 rounded bg-sky-950/20">{t.davRaqami}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-white">{t.motochas} soat</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                      t.holat === 'ishlamoqda' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {t.holat}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTENT: SIFAT (HSE) */}
      {modul === 'sifat' && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center shadow-xl">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-emerald-500/20">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Sifat va Mehnat Muhofazasi Jurnallari (HSE)</h2>
          <p className="text-text-dim max-w-lg mx-auto mb-8">
            Jarayonda... Obyektlardagi yong'in xavfsizligi, instruktaj jurnallari va GOST sifat nazorati aktlari shu yerda yuritiladi.
          </p>
        </div>
      )}

    </div>
  );
}
