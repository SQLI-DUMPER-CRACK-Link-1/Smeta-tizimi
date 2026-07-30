import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Search, Filter, ShieldAlert, CheckCircle, Clock } from 'lucide-react';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { useSifatData } from '../../api/hooks';
import { Skelet } from '../../umumiy/ui/Sahifa';

export default function ErpSifat() {
  const { data, isLoading } = useSifatData();
  const [qidiruv, setQidiruv] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Barchasi');

  if (isLoading || !data) {
    return (
      <AuroraBackground>
        <div className="p-8"><Skelet qatorlar={5} /></div>
      </AuroraBackground>
    );
  }

  const filtrlanganNuqsonlar = data.nuqsonlar.filter((n: any) => {
    const mosKeladi = n.tavsif.toLowerCase().includes(qidiruv.toLowerCase()) || 
                      n.obyekt.toLowerCase().includes(qidiruv.toLowerCase());
    if (filterStatus !== 'Barchasi') {
      return mosKeladi && n.status === filterStatus;
    }
    return mosKeladi;
  });

  const darajaRangi = (daraja: string) => {
    switch (daraja) {
      case 'Oddiy': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'O\'rta': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'Kritik': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const statusRangi = (status: string) => {
    switch (status) {
      case 'Yangi': return 'text-blue-400';
      case 'Jarayonda': return 'text-amber-400';
      case 'Tuzatildi': return 'text-emerald-400';
      case 'Muddati o\'tgan': return 'text-rose-500 font-bold animate-pulse';
      default: return 'text-slate-400';
    }
  };

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] mx-auto p-6 flex flex-col h-full overflow-hidden relative z-10">
        
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 tracking-tight flex items-center gap-3">
            <ShieldCheck className="text-blue-400" size={32} />
            Sifat Nazorati (Texnadzor)
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Obyektlardagi nuqsonlar (defektlar) va ularni tuzatish jarayoni</p>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-blue-500/20">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Jami Nuqsonlar</div>
              <div className="text-2xl font-bold font-mono text-white">{data.jamiNuqsonlar} ta</div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-emerald-500/20">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Tuzatilgan</div>
              <div className="text-2xl font-bold font-mono text-white">{data.tuzatilganlar} ta</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-rose-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl"></div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 relative z-10">
              <Clock size={24} />
              {data.muddatOtilgan > 0 && <span className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>}
            </div>
            <div className="relative z-10">
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Muddati O'tgan</div>
              <div className="text-2xl font-bold font-mono text-white">{data.muddatOtilgan} ta</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors border-orange-500/20">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-400">
              <ShieldAlert size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Kritik Holatlar</div>
              <div className="text-2xl font-bold font-mono text-white">{data.kritik} ta</div>
            </div>
          </GlassCard>
        </div>

        <div className="flex-1 bg-[#0B0E14]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
            <div className="flex gap-2">
               {['Barchasi', 'Yangi', 'Jarayonda', 'Muddati o\'tgan', 'Tuzatildi'].map(st => (
                 <button 
                   key={st}
                   onClick={() => setFilterStatus(st)}
                   className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterStatus === st ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-black/40 text-slate-400 hover:text-white border border-white/10'}`}
                 >
                   {st}
                 </button>
               ))}
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Nuqson tavsifi yoki obyekt..."
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/60 sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Nuqson Tavsifi / Darajasi</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Obyekt va Prorab</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Sana / Muddat</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Status</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {filtrlanganNuqsonlar.map((n: any, idx: number) => (
                  <motion.tr 
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="py-4 px-6 max-w-md">
                      <div className="font-semibold text-white/90 text-sm whitespace-normal">{n.tavsif}</div>
                      <div className={`inline-flex px-2 py-0.5 mt-2 rounded border text-[10px] font-bold uppercase tracking-wider ${darajaRangi(n.daraja)}`}>
                        {n.daraja}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-300 font-bold">{n.obyekt}</div>
                      <div className="text-xs text-slate-500 mt-1">{n.prorab}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-slate-400">Yozilgan: <span className="text-slate-300 font-mono">{n.sana}</span></div>
                      <div className="text-xs text-slate-400 mt-1">Muddat: <span className="text-slate-300 font-mono">{n.muddat}</span></div>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-sm">
                      <span className={statusRangi(n.status)}>{n.status}</span>
                      {n.izoh && <div className="text-[10px] text-rose-400 mt-1 font-normal bg-rose-500/10 px-2 py-1 rounded inline-block">{n.izoh}</div>}
                    </td>
                    <td className="py-4 px-6 text-center space-x-2">
                      {n.status !== 'Tuzatildi' && (
                        <button className="text-xs bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400 px-3 py-1.5 rounded border border-emerald-500/30 transition-colors">
                          Tuzatildi deb belgilash
                        </button>
                      )}
                      <button className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors">
                        Batafsil
                      </button>
                    </td>
                  </motion.tr>
                ))}
                
                {filtrlanganNuqsonlar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Hech qanday nuqson topilmadi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AuroraBackground>
  );
}
