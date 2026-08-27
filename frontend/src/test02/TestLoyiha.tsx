import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FolderKanban, Plus, Search, Building2, MapPin, Calculator, ShieldCheck, CreditCard } from 'lucide-react';
import { FmtN } from '../lib/format';
import { toast } from '../umumiy/ui/Toast';
import { useKompaniya } from './KompaniyaTanlov';
import { sbT2LoyihalarOl, sbT2LoyihaYoz, type T2Loyiha } from '../api/t2-loyiha';

export default function TestLoyiha() {
  const { joriy } = useKompaniya();
  const aktKomp = joriy?.id ?? 0;
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loyihalar, setLoyihalar] = useState<T2Loyiha[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [fNom, setFNom] = useState('');
  const [fHudud, setFHudud] = useState('');
  const [fByudjet, setFByudjet] = useState('');

  const yukla = async () => {
    if (!aktKomp) return;
    setYuklanmoqda(true);
    const r = await sbT2LoyihalarOl(aktKomp);
    setYuklanmoqda(false);
    if (r.ok && r.qatorlar) {
      setLoyihalar(r.qatorlar);
    }
  };

  useEffect(() => {
    yukla();
  }, [aktKomp]);

  const handleSaqla = async () => {
    if (!fNom) return toast("Loyiha nomini kiriting!", "warn");
    setYuklanmoqda(true);
    const r = await sbT2LoyihaYoz(aktKomp, {
      nom: fNom,
      hudud: fHudud,
      byudjet: Number(fByudjet) || 0
    });
    setYuklanmoqda(false);
    
    if (r.ok) {
      toast("Loyiha yaratildi", "ok");
      setIsFormOpen(false);
      setFNom('');
      setFHudud('');
      setFByudjet('');
      yukla();
    } else {
      toast(r.error || "Xato", "danger");
    }
  };

  const filtered = loyihalar.filter(l => l.nom.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 bg-transparent min-h-screen text-text h-full overflow-y-auto">
      
      {/* HEADER */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 mb-2 text-white">
            <FolderKanban className="text-indigo-400" />
            Loyihalar (Projects)
          </h1>
          <p className="text-text-dim text-sm max-w-2xl">
            Markaziy loyihalar reestri: bir nechta obyekt bitta loyihaga guruhlanadi
            («32 gektar park» — 40 obyekt, 5 shartnoma). Loyiha ostida qatnashchilar
            har xil rolda bo'lishi mumkin: buyurtmachi, bosh pudratchi, subpudratchi.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-lg shadow-indigo-900/20"
          >
            <Plus size={16} />
            Yangi Loyiha
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-black border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border bg-[var(--surface-1)]">
              <h3 className="font-bold text-white flex items-center gap-2">
                <ShieldCheck className="text-emerald-400"/> Yangi loyiha
              </h3>
            </div>
            <div className="p-5 space-y-4 bg-[var(--surface-0)]">
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Loyiha Nomi</label>
                <input 
                  type="text" 
                  value={fNom}
                  onChange={e => setFNom(e.target.value)}
                  className="w-full bg-black border border-border rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none" 
                  placeholder="Masalan, Tashkent City Mall"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Hudud / Manzil</label>
                <input 
                  type="text" 
                  value={fHudud}
                  onChange={e => setFHudud(e.target.value)}
                  className="w-full bg-black border border-border rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none" 
                  placeholder="Toshkent sh., Shayxontohur tumani"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-dim mb-1">Byudjet (Mo'ljal)</label>
                <input 
                  type="number" 
                  value={fByudjet}
                  onChange={e => setFByudjet(e.target.value)}
                  className="w-full bg-black border border-border rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none font-mono" 
                />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-border mt-4">
                <button onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-text-dim hover:text-white transition-colors">Bekor qilish</button>
                <button 
                  onClick={handleSaqla} 
                  disabled={yuklanmoqda}
                  className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-white font-medium transition-colors shadow-lg shadow-indigo-900/20 disabled:opacity-50">
                  {yuklanmoqda ? 'Yozilmoqda...' : 'Saqlash'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-[var(--surface-1)] border border-border rounded-xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-border bg-[var(--surface-2)]">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Loyiha qidirish..."
              className="w-full bg-black border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:border-indigo-500 outline-none"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-black/40 border-b border-border text-text-dim font-medium">
                <th className="px-6 py-4">Loyiha Nomi</th>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Hudud</th>
                <th className="px-6 py-4 text-right">Byudjet (UZS)</th>
                <th className="px-6 py-4 text-center">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {yuklanmoqda ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-text-dim animate-pulse">Yuklanmoqda…</td>
                </tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 font-bold text-white flex items-center gap-2">
                    <FolderKanban size={16} className="text-indigo-400" />
                    {l.nom}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-zinc-500 truncate max-w-[150px]" title={l.id.toString()}>
                    <ShieldCheck size={12} className="inline mr-1 text-emerald-500/50" />
                    {l.id}
                  </td>
                  <td className="px-6 py-4 text-text-dim flex items-center gap-1">
                    <MapPin size={14} className="text-zinc-400" /> {l.hudud || '-'}
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-white">
                    <FmtN val={l.byudjet} />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {l.holat}
                    </span>
                  </td>
                </tr>
              ))}
              {!yuklanmoqda && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-text-dim">
                    Hali loyihalar yaratilmagan (Yoki SQL skript Supabase'da ishga tushirilmagan). 
                    Iltimos `01_T2_LOYIHA_MIGRATSIYA.sql` faylini SQL muhitida yurgizing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
