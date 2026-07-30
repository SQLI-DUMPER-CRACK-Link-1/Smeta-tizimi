import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, HardHat, CalendarCheck, HandCoins, Search, Filter, UserCheck, UserX, Clock, UserMinus } from 'lucide-react';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { FmtN } from '../../lib/format';
import { useKadrlarData } from '../../api/hooks';
import { Skelet } from '../../umumiy/ui/Sahifa';

export default function ErpKadrlar() {
  const { data, isLoading } = useKadrlarData();
  const [qidiruv, setQidiruv] = useState('');
  const [filtir, setFiltir] = useState('barchasi');

  if (isLoading || !data) {
    return (
      <AuroraBackground>
        <div className="p-8"><Skelet qatorlar={5} /></div>
      </AuroraBackground>
    );
  }

  const ishchilarTabellarBilan = data.ishchilar.map((ishchi: any) => {
    const tabel = data.tabellar.find((t: any) => t.ishchiId === ishchi.id);
    return { ...ishchi, davomat: tabel?.holat || null, izoh: tabel?.izoh || '' };
  });

  const filtrlanganIshchilar = ishchilarTabellarBilan.filter((ishchi: any) => {
    const mosKeladi = ishchi.ism.toLowerCase().includes(qidiruv.toLowerCase()) || 
                      ishchi.kasb.toLowerCase().includes(qidiruv.toLowerCase());
    
    if (filtir === 'keldi') return mosKeladi && ishchi.davomat === 'keldi';
    if (filtir === 'kelmadi') return mosKeladi && (ishchi.davomat === 'kelmadi' || ishchi.davomat === 'otgul');
    if (filtir === 'kasal') return mosKeladi && ishchi.davomat === 'kasal';
    return mosKeladi;
  });

  const davomatRangi = (holat: string | null) => {
    switch (holat) {
      case 'keldi': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'kelmadi': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'kasal': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'otgul': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const davomatIkona = (holat: string | null) => {
    switch (holat) {
      case 'keldi': return <UserCheck size={16} />;
      case 'kelmadi': return <UserX size={16} />;
      case 'kasal': return <UserMinus size={16} />;
      case 'otgul': return <Clock size={16} />;
      default: return <span className="text-xl leading-none">-</span>;
    }
  };

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] mx-auto p-6 flex flex-col h-full overflow-hidden relative z-10">
        <header className="mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300 tracking-tight flex items-center gap-3">
            <Users className="text-blue-400" size={32} />
            Kadrlar va Davomat (HR)
          </h1>
          <p className="text-slate-400 mt-2 text-sm">Obyektlardagi ishchilar, davomat va maoshlar monitoringi</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <HardHat size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Faol Ishchilar</div>
              <div className="text-2xl font-bold font-mono text-white">{data.jamiFaolIshchilar} kishi</div>
            </div>
          </GlassCard>
          
          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CalendarCheck size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Bugungi Davomat</div>
              <div className="text-2xl font-bold font-mono text-white">{data.bugungiDavomat}%</div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <HandCoins size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Oylik Fond (Kutilma)</div>
              <div className="text-2xl font-bold font-mono text-white"><FmtN val={data.oylikFond} qisqa /></div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center gap-4 hover:bg-white/5 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <HandCoins size={24} />
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Berilgan Avanslar</div>
              <div className="text-2xl font-bold font-mono text-white"><FmtN val={data.berilganAvanslar} qisqa /></div>
            </div>
          </GlassCard>
        </div>

        <div className="flex-1 bg-[#0B0E14]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="p-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-white/5">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="F.I.O yoki kasb bo'yicha qidiruv..."
                value={qidiruv}
                onChange={e => setQidiruv(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            
            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
              <Filter size={16} className="text-slate-400 ml-2 mr-1" />
              {[
                { id: 'barchasi', nom: 'Barchasi' },
                { id: 'keldi', nom: 'Kelganlar' },
                { id: 'kelmadi', nom: 'Kelmaganlar' },
                { id: 'kasal', nom: 'Bemor/Otgul' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltir(f.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filtir === f.id ? 'bg-blue-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  {f.nom}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead className="bg-black/60 sticky top-0 z-20 backdrop-blur-md">
                <tr>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">F.I.O va Kasbi</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider">Obyekt va Brigada</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-right">Kunlik Stavka</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Bugungi Davomat</th>
                  <th className="py-4 px-6 text-xs text-slate-400 font-bold uppercase tracking-wider text-center">Harakatlar</th>
                </tr>
              </thead>
              <tbody>
                {filtrlanganIshchilar.map((ishchi: any, idx: number) => (
                  <motion.tr 
                    key={ishchi.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white/90 text-sm">{ishchi.ism}</div>
                      <div className="text-xs text-blue-400 mt-1">{ishchi.kasb}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm text-slate-300">{ishchi.obyekt}</div>
                      <div className="text-xs text-slate-500 mt-1">{ishchi.brigada}</div>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-medium text-emerald-400/90 text-sm">
                      <FmtN val={ishchi.stavka} /> 
                    </td>
                    <td className="py-4 px-6 text-center">
                      {ishchi.davomat ? (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${davomatRangi(ishchi.davomat)}`}>
                          {davomatIkona(ishchi.davomat)}
                          {ishchi.davomat}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Belgilanmagan</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button className="text-xs bg-white/5 hover:bg-white/10 text-slate-300 px-3 py-1.5 rounded border border-white/10 transition-colors">
                        Tabelga yozish
                      </button>
                    </td>
                  </motion.tr>
                ))}
                
                {filtrlanganIshchilar.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      Hech qanday ma'lumot topilmadi...
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
