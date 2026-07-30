import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, AlertTriangle, Search, Filter, TrendingUp, HandCoins, Package, ClipboardList, MapPin } from 'lucide-react';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { FmtN } from '../../lib/format';
import { useTaminotData } from '../../api/hooks';
import { Skelet } from '../../umumiy/ui/Sahifa';

export default function ErpTaminot() {
  const { data, isLoading } = useTaminotData();
  const [qidiruv, setQidiruv] = useState('');
  const [tab, setTab] = useState<'zayavkalar' | 'sklad'>('zayavkalar');

  if (isLoading || !data) {
    return (
      <AuroraBackground>
        <div className="p-8"><Skelet qatorlar={5} /></div>
      </AuroraBackground>
    );
  }

  const filtrlanganZayavkalar = data.zayavkalar.filter((z: any) => 
    z.material.toLowerCase().includes(qidiruv.toLowerCase()) || 
    z.prorab.toLowerCase().includes(qidiruv.toLowerCase())
  );

  const filtrlanganMateriallar = data.materiallar.filter((m: any) => 
    m.nom.toLowerCase().includes(qidiruv.toLowerCase())
  );

  const zayavkaRangi = (status: string) => {
    switch (status) {
      case 'Kutilmoqda': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'Bozorda': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Yuborildi': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'Qabul qilindi': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] mx-auto p-6 flex flex-col h-full overflow-hidden relative z-10">
        
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-300 tracking-tight flex items-center gap-3">
            <ShoppingCart className="text-blue-400" size={32} />
            Ta'minot va Ombor (Sklad)
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Zayavkalar, materiallar qoldig'i va moliyaviy smeta nazorati</p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-blue-500/20">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 relative">
              <ClipboardList size={24} />
              {data.yangiZayavkalarSoni > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500 items-center justify-center text-[9px] font-bold text-white">{data.yangiZayavkalarSoni}</span>
                </span>
              )}
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Yangi Zayavkalar</div>
              <div className="text-2xl font-bold font-mono text-white">{data.yangiZayavkalarSoni} ta</div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-rose-500/20">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Kritik Qoldiq</div>
              <div className="text-2xl font-bold font-mono text-white">{data.kritikMateriallarSoni} ta tovar</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-orange-500/20">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <TrendingUp size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Smetadan Qimmat</div>
              <div className="text-2xl font-bold font-mono text-white">{data.smetaNarxidanOshganlar} ta tovar</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-emerald-500/20">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <HandCoins size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Postavshikdan Qarzimiz</div>
              <div className="text-2xl font-bold font-mono text-white"><FmtN val={data.jamiQarzimiz} qisqa /></div>
            </div>
          </GlassCard>
        </div>

        <div className="flex-1 bg-[#0B0E14]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
            <div className="flex gap-2">
              <button 
                onClick={() => setTab('zayavkalar')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'zayavkalar' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-black/40 text-slate-400 hover:text-white border border-white/10'}`}
              >
                <ClipboardList size={16} /> Zayavkalar (Talabnomalar)
              </button>
              <button 
                onClick={() => setTab('sklad')}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${tab === 'sklad' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-black/40 text-slate-400 hover:text-white border border-white/10'}`}
              >
                <Package size={16} /> Ombor Qoldiqlari (Sklad)
              </button>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Qidiruv..."
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            
            {tab === 'zayavkalar' && (
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/60 sticky top-0 z-20 backdrop-blur-md">
                  <tr>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Material va Miqdor</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Prorab va Obyekt</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Sana / Izoh</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Status</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Harakatlar</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrlanganZayavkalar.map((z: any, idx: number) => (
                    <motion.tr 
                      key={z.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white/90 text-sm">{z.material}</div>
                        <div className="text-xs font-mono text-blue-400 mt-1">{z.miqdor} {z.birlik}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm font-medium text-slate-200">{z.prorab}</div>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin size={12}/> {z.obyekt}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="text-sm text-slate-300">{z.sana}</div>
                        {z.izoh && <div className="text-xs text-rose-400 mt-1 font-medium">{z.izoh}</div>}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${zayavkaRangi(z.status)}`}>
                          {z.status}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center space-x-2">
                        {z.status === 'Kutilmoqda' && (
                          <button className="text-xs bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-400 px-3 py-1.5 rounded border border-blue-500/30 transition-colors">
                            Bozorga tushish
                          </button>
                        )}
                        {z.status === 'Bozorda' && (
                          <button className="text-xs bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400 px-3 py-1.5 rounded border border-emerald-500/30 transition-colors">
                            Jo'natish (Rasmiylashtirish)
                          </button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                  {filtrlanganZayavkalar.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">Hech narsa topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            )}

            {tab === 'sklad' && (
              <table className="w-full text-left border-collapse">
                <thead className="bg-black/60 sticky top-0 z-20 backdrop-blur-md">
                  <tr>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Material Nomi</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Joylashuv (Sklad)</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-right">Haqiqiy Qoldiq</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-right">Smeta vs Fakt Narxi</th>
                    <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Holat</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrlanganMateriallar.map((m: any, idx: number) => {
                    const isKritik = m.qoldiq <= m.minQoldiq;
                    const isOshgan = m.faktNarxi > m.smetaNarxi;
                    
                    return (
                      <motion.tr 
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="font-semibold text-white/90 text-sm">{m.nom}</div>
                          <div className="text-xs text-slate-500 mt-1">{m.guruh}</div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="text-sm font-medium text-slate-300 flex items-center gap-1"><Package size={14} className="text-slate-500"/> {m.obyekt}</div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className={`text-base font-mono font-bold ${isKritik ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {m.qoldiq} {m.birlik}
                          </div>
                          {isKritik && <div className="text-[10px] text-rose-500 uppercase font-bold mt-1 tracking-wider flex justify-end items-center gap-1"><AlertTriangle size={10}/> Min: {m.minQoldiq}</div>}
                        </td>
                        <td className="py-4 px-6 text-right font-mono">
                          <div className="text-xs text-slate-400 line-through"><FmtN val={m.smetaNarxi} /> so'm</div>
                          <div className={`text-sm font-bold ${isOshgan ? 'text-orange-400' : 'text-emerald-400'}`}>
                            <FmtN val={m.faktNarxi} /> so'm
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          {isOshgan ? (
                            <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2 py-1 rounded text-xs font-bold uppercase">Smetadan Qimmat</span>
                          ) : (
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs font-bold uppercase">Normada</span>
                          )}
                        </td>
                      </motion.tr>
                    );
                  })}
                  {filtrlanganMateriallar.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-slate-500">Hech narsa topilmadi</td></tr>
                  )}
                </tbody>
              </table>
            )}

          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
