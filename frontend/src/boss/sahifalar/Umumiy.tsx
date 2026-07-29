import { useState, useEffect } from 'react';
import { useBossData, useBossObyekt } from '../../api/hooks';
import { FmtN, formatPercent } from '../../lib/format';
import { MalumotYoshi, Skelet, XatoHolat } from '../../umumiy/ui/Sahifa';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, TrendingUp, Wallet, CheckCircle, Clock, ChevronRight, ChevronDown, FileText, ArrowDownToLine, ArrowUpFromLine, HardHat, Truck, Wrench, Info, Layers } from 'lucide-react';

// --- AURORA BACKGROUND (Kuchaytirilgan, yorug'lashtirilgan) ---
function AuroraBackground({ children }: { children: React.ReactNode }) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen bg-slate-900 overflow-hidden text-white font-sans selection:bg-accent/30">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ x: `${mousePosition.x}%`, y: `${mousePosition.y}%` }}
          transition={{ type: 'spring', damping: 80, stiffness: 40, mass: 1 }}
          className="absolute -top-[75%] -left-[75%] w-[150vw] h-[150vw] rounded-full bg-accent/30 blur-[150px] mix-blend-screen opacity-70"
        />
        <div className="absolute top-[10%] right-[5%] w-[70vw] h-[70vw] rounded-full bg-indigo-500/20 blur-[180px] mix-blend-screen animate-pulse duration-[8000ms]" />
        <div className="absolute -bottom-[20%] left-[10%] w-[80vw] h-[80vw] rounded-full bg-emerald-500/15 blur-[160px] mix-blend-screen" />
      </div>

      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-[0.05] pointer-events-none" />

      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-slate-800/40 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// --- CHART ---
function FinancialChart({ objects }: { objects: any[] }) {
  const allSubItems = objects.flatMap(sh => sh.subItems || []).filter(o => !o.nom.startsWith('👷'));
  
  if (!allSubItems || allSubItems.length === 0) return null;
  const maxSmeta = Math.max(...allSubItems.map(o => o.smeta || 0));

  return (
    <GlassCard className="p-6 h-[320px] flex flex-col">
      <h3 className="text-lg font-semibold text-white/90 mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-accent" />
        Moliyaviy Oqim (Top Obyektlar)
      </h3>
      
      <div className="flex-1 flex items-end gap-3 w-full overflow-x-auto pb-4 scrollbar-thin">
        {allSubItems.sort((a, b) => b.smeta - a.smeta).slice(0, 20).map((obj, idx) => {
          const hSmeta = Math.max(5, ((obj.smeta || 0) / maxSmeta) * 100);
          const hFakt = Math.max(0, ((obj.fakt || 0) / maxSmeta) * 100);
          const hF2 = Math.max(0, ((obj.f2 || 0) / maxSmeta) * 100);
          
          return (
            <div key={idx} className="flex flex-col items-center gap-2 group flex-1 min-w-[50px] relative">
              <div className="w-full h-[180px] relative flex justify-center items-end bg-white/5 rounded-t-xl overflow-hidden shadow-inner">
                <motion.div initial={{ height: 0 }} animate={{ height: `${hSmeta}%` }} transition={{ duration: 1, delay: idx * 0.02 }} className="absolute bottom-0 w-full bg-white/10" />
                <motion.div initial={{ height: 0 }} animate={{ height: `${hFakt}%` }} transition={{ duration: 1, delay: 0.2 + idx * 0.02 }} className="absolute bottom-0 w-full bg-ok/50" />
                <motion.div initial={{ height: 0 }} animate={{ height: `${hF2}%` }} transition={{ duration: 1, delay: 0.4 + idx * 0.02 }} className="absolute bottom-0 w-full bg-t-rs/70" />
              </div>
              <span className="text-[10px] text-white/50 truncate w-full text-center group-hover:text-white transition-colors" title={obj.nom}>
                {obj.nom.substring(0, 10)}...
              </span>
              
              <div className="absolute -top-24 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 backdrop-blur-xl px-4 py-3 rounded-xl text-xs whitespace-nowrap z-20 pointer-events-none border border-white/20 shadow-2xl">
                <div className="font-bold text-white mb-2 max-w-[250px] truncate border-b border-white/10 pb-1">{obj.nom}</div>
                <div className="text-white/70 flex justify-between gap-4"><span>Smeta:</span> <span className="font-mono text-white"><FmtN val={obj.smeta} /></span></div>
                <div className="text-white/70 flex justify-between gap-4"><span>Fakt:</span> <span className="font-mono text-ok"><FmtN val={obj.fakt} /></span></div>
                <div className="text-white/70 flex justify-between gap-4"><span>F2:</span> <span className="font-mono text-t-rs"><FmtN val={obj.f2} /></span></div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

// --- IERARXIYA (Razdellar va Oy Trendlari) ---
function RazdelRow({ nom }: { nom: string }) {
  const { data, isLoading, error } = useBossObyekt(nom);
  
  if (isLoading) return (
    <tr className="bg-black/20">
      <td colSpan={6} className="py-4 text-center text-accent/70 text-sm">Razdellar yuklanmoqda...</td>
    </tr>
  );
  
  if (error || !data) return (
    <tr className="bg-black/20">
      <td colSpan={6} className="py-4 text-center text-danger/70 text-sm">Xatolik yuz berdi</td>
    </tr>
  );
  
  if (data.rzList?.length === 0) return (
    <tr className="bg-black/20">
      <td colSpan={6} className="py-4 pl-[80px] text-white/40 text-sm italic">Razdellar mavjud emas</td>
    </tr>
  );
  
  const maxVal = Math.max(...(data.oylar || []).map(o => o.val || 0), 1);

  return (
    <>
      {data.rzList.sort((a, b) => (b.res || 0) - (a.res || 0)).map((rz, idx) => {
        const pCol = rz.progress >= 70 ? 'text-ok' : rz.progress >= 30 ? 'text-warn' : 'text-danger';
        const bgCol = rz.progress >= 70 ? 'bg-ok' : rz.progress >= 30 ? 'bg-warn' : 'bg-danger';
        return (
          <tr key={`rz-${idx}`} className="bg-black/20 border-b border-white/5 hover:bg-black/30 transition-colors">
            <td className="py-3 pl-[80px] pr-4 text-white/70 text-sm flex items-center gap-2">
              <span className="text-white/20 font-mono">└</span>
              {rz.nom}
            </td>
            <td className="py-3 px-4 text-right font-mono text-white/40"><FmtN val={rz.res} /></td>
            <td className="py-3 px-4 text-right font-mono text-ok/80"><FmtN val={rz.fakt} /></td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-3 justify-end">
                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${bgCol}`} style={{ width: `${Math.min(rz.progress, 100)}%` }} />
                </div>
                <span className={`font-mono font-bold text-xs w-10 text-right ${pCol}`}>{rz.progress}%</span>
              </div>
            </td>
            <td className="py-3 px-4 text-right font-mono text-warn/80"><FmtN val={rz.f2} /></td>
            <td className="py-3 px-4 text-right font-mono text-danger/80"><FmtN val={rz.ost} /></td>
          </tr>
        );
      })}
      
      {/* Oylar Trendi */}
      {data.oylar && data.oylar.length > 0 && (
        <tr className="bg-black/30 border-b border-white/10">
          <td colSpan={6} className="py-4 pl-[80px] pr-8">
            <div className="text-xs text-white/40 font-bold mb-3 uppercase tracking-widest">📈 F-2 Oylik Dinamikasi</div>
            <div className="flex flex-col gap-2">
              {data.oylar.map((oy, idx) => {
                const w = Math.max(2, Math.round((oy.val || 0) / maxVal * 100));
                return (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-24 text-xs text-white/50">{oy.oy}</div>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.8 }} className="h-full bg-gradient-to-r from-accent to-indigo-400" />
                    </div>
                    <div className="w-32 text-right font-mono text-xs text-t-rs/90"><FmtN val={oy.val} /></div>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ObyektRow({ obj }: { obj: any }) {
  const [open, setOpen] = useState(false);
  const isSub = obj.nom.startsWith('👷');
  const pCol = obj.progress >= 70 ? 'text-ok' : obj.progress >= 30 ? 'text-warn' : 'text-danger';
  const bgCol = obj.progress >= 70 ? 'bg-ok' : obj.progress >= 30 ? 'bg-warn' : 'bg-danger';
  
  return (
    <>
      <tr onClick={() => setOpen(!open)} className="cursor-pointer bg-transparent hover:bg-white/[0.03] transition-colors border-b border-white/5">
        <td className="py-4 pl-[48px] pr-4 flex items-center gap-3">
          <div className="w-4 flex justify-center text-accent/50">{!isSub && (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}</div>
          <span className={`text-sm ${isSub ? 'text-white/50' : 'text-white/80 font-medium'}`}>
            {!isSub && <FileText size={14} className="inline mr-2 text-white/30" />}
            {obj.nom} 
            {obj.leaf ? <span className="text-[11px] text-white/30 ml-2">({obj.leaf} qator)</span> : ''}
            {(obj.fakt - obj.f2) > 0 && <span className="text-[10px] ml-3 text-warn/70 bg-warn/10 px-2 py-0.5 rounded-full">❄️ Muzlagan: <FmtN val={obj.fakt - obj.f2} /></span>}
          </span>
        </td>
        <td className="py-4 px-4 text-right font-mono text-white/70"><FmtN val={obj.smeta} /></td>
        <td className="py-4 px-4 text-right font-mono text-ok font-medium"><FmtN val={obj.fakt} /></td>
        <td className="py-4 px-4">
          <div className="flex items-center gap-3 justify-end">
            <div className="w-24 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className={`h-full ${bgCol}`} style={{ width: `${Math.min(obj.progress, 100)}%` }} />
            </div>
            <span className={`font-mono font-bold text-sm w-12 text-right ${pCol}`}>{obj.progress}%</span>
          </div>
        </td>
        <td className="py-4 px-4 text-right font-mono text-warn"><FmtN val={obj.f2} /></td>
        <td className="py-4 px-4 text-right font-mono text-danger/80"><FmtN val={obj.qoldiq} /></td>
      </tr>
      
      {open && !isSub && (
        <RazdelRow nom={obj.nom} />
      )}
    </>
  );
}

function ShartnomaRow({ shartnoma }: { shartnoma: any }) {
  const [open, setOpen] = useState(false);
  const pCol = shartnoma.progress >= 70 ? 'text-ok' : shartnoma.progress >= 30 ? 'text-warn' : 'text-danger';
  const bgCol = shartnoma.progress >= 70 ? 'bg-ok' : shartnoma.progress >= 30 ? 'bg-warn' : 'bg-danger';

  return (
    <>
      <tr onClick={() => setOpen(!open)} className="cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] transition-colors border-b border-white/10">
        <td className="py-5 px-4 flex items-center gap-3">
          <div className="w-5 h-5 flex items-center justify-center bg-white/10 rounded-md text-accent">
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
          <span className="font-bold text-white tracking-wide text-base">
            {shartnoma.nom}
            <span className="font-normal text-xs text-white/40 ml-3">({shartnoma.subItems?.length || 0} obyekt)</span>
          </span>
          <div className="flex gap-2 ml-4">
             {shartnoma.tolangan > 0 && <span className="text-[10px] text-ok bg-ok/10 px-2 py-0.5 rounded border border-ok/20">💵 To'langan: <FmtN val={shartnoma.tolangan} qisqa /></span>}
             {shartnoma.debitor > 0 && <span className="text-[10px] text-danger bg-danger/10 px-2 py-0.5 rounded border border-danger/20">⚠ Debitor: <FmtN val={shartnoma.debitor} qisqa /></span>}
          </div>
        </td>
        <td className="py-5 px-4 text-right font-mono font-bold text-accent"><FmtN val={shartnoma.smeta} /></td>
        <td className="py-5 px-4 text-right font-mono font-bold text-ok"><FmtN val={shartnoma.fakt} /></td>
        <td className="py-5 px-4">
          <div className="flex items-center gap-4 justify-end">
            <div className="w-32 h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner">
              <div className={`h-full ${bgCol}`} style={{ width: `${Math.min(shartnoma.progress, 100)}%` }} />
            </div>
            <span className={`font-mono font-extrabold text-base w-12 text-right ${pCol}`}>{shartnoma.progress}%</span>
          </div>
        </td>
        <td className="py-5 px-4 text-right font-mono font-bold text-warn"><FmtN val={shartnoma.f2} /></td>
        <td className="py-5 px-4 text-right font-mono font-bold text-danger"><FmtN val={shartnoma.qoldiq} /></td>
      </tr>
      
      <AnimatePresence>
        {open && shartnoma.subItems?.map((obj: any, j: number) => (
          <ObyektRow key={`ob-${j}`} obj={obj} />
        ))}
      </AnimatePresence>
    </>
  );
}

export default function Umumiy() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useBossData();

  if (isLoading) {
    return (
      <AuroraBackground>
        <div className="h-screen flex items-center justify-center p-6">
          <div className="max-w-4xl w-full">
            <Skelet qatorlar={5} />
          </div>
        </div>
      </AuroraBackground>
    );
  }

  if (error || !data) {
    return (
      <AuroraBackground>
        <div className="p-6">
          <XatoHolat xato={error || new Error("Ma'lumot yo'q")} qayta={() => refetch()} />
        </div>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] w-full mx-auto p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin">
        
        {/* Apple-style Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-md"
            >
              Boshqaruv Markazi
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-slate-300 text-base mt-3 flex items-center gap-3 font-medium"
            >
              Umumiy smeta hajmi va moliyaviy oqimlar holati
              {dataUpdatedAt && (
                <>
                  <span className="w-1.5 h-1.5 bg-slate-500 rounded-full"></span>
                  <MalumotYoshi vaqt={dataUpdatedAt} />
                </>
              )}
            </motion.p>
          </div>
          
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-5 py-2.5 rounded-2xl transition-all shadow-xl backdrop-blur-md active:scale-95"
          >
            <RefreshCw size={18} className={isFetching ? 'animate-spin text-accent' : ''} />
            <span className="font-semibold">Yangilash</span>
          </motion.button>
        </header>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {[
            { nom: "Smeta Jami", qiymat: data.jami.smeta, pct: null, color: "text-white", icon: Wallet, desc: "Barcha obyektlar yig'indisi" },
            { nom: "Bajarilgan (Fakt)", qiymat: data.jami.fakt, pct: data.jami.progress, color: "text-ok", bg: "bg-ok", icon: TrendingUp, desc: "Amalda qilingan ishlar" },
            { nom: "Tasdiqlangan (F2)", qiymat: data.jami.f2, pct: data.jami.f2pct, color: "text-t-rs", bg: "bg-t-rs", icon: CheckCircle, desc: "Buyurtmachi tasdiqlagan" },
            { nom: "Qoldiq", qiymat: data.jami.qoldiq, pct: null, color: "text-slate-300", icon: Clock, desc: "Smetadan qolgan miqdor" },
          ].map((kpi, idx) => (
            <motion.div key={`kpi1-${idx}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1, duration: 0.6, type: "spring" }}>
              <GlassCard className="p-6 relative group cursor-default hover:bg-white/10 transition-colors border-white/10">
                <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-colors" />
                <h3 className="text-slate-400 font-semibold flex items-center justify-between mb-3 tracking-wide text-sm uppercase">
                  <div className="flex items-center gap-2">
                    <kpi.icon size={18} className={kpi.color} />
                    {kpi.nom}
                  </div>
                  <div title={kpi.desc} className="cursor-help">
                    <Info size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                  </div>
                </h3>
                <div className={`text-3xl font-bold tracking-tight font-mono ${kpi.color}`}>
                  <FmtN val={kpi.qiymat} />
                </div>
                {kpi.pct !== null && (
                  <div className="mt-5 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-black/50 rounded-full overflow-hidden shadow-inner">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(kpi.pct, 100)}%` }} transition={{ duration: 1, delay: 0.5 }} className={`h-full ${kpi.bg} rounded-full`} />
                    </div>
                    <span className={`text-sm font-bold ${kpi.color}`}>{formatPercent(kpi.pct)}</span>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Second Row KPIs: Moliya va Xarajatlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {[
            { nom: "Tushum (To'langan)", qiymat: data.jami.tolangan, color: "text-emerald-400", icon: ArrowDownToLine, border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
            { nom: "Debitor (Qarz)", qiymat: data.jami.debitor, color: "text-red-400", icon: ArrowUpFromLine, border: "border-red-500/30", bg: "bg-red-500/5" },
            { nom: "Avans", qiymat: data.jami.avans, color: "text-amber-400", icon: Layers, border: "border-amber-500/30", bg: "bg-amber-500/5" },
            { nom: "Material", qiymat: data.jami.mat, color: "text-t-mat", icon: Wrench, border: "border-white/10", bg: "bg-white/5" },
            { nom: "Ish Haqi (Oylik)", qiymat: data.jami.chel, color: "text-blue-400", icon: HardHat, border: "border-white/10", bg: "bg-white/5" },
            { nom: "Texnika (Mashina)", qiymat: data.jami.mash, color: "text-purple-400", icon: Truck, border: "border-white/10", bg: "bg-white/5" },
          ].map((kpi, idx) => (
            <motion.div key={`kpi2-${idx}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + idx * 0.05, duration: 0.4 }}>
              <div className={`p-4 rounded-xl border ${kpi.border} ${kpi.bg} backdrop-blur-md flex flex-col items-center text-center group hover:bg-white/10 transition-colors`}>
                <kpi.icon size={20} className={`${kpi.color} mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all`} />
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{kpi.nom}</div>
                <div className={`text-lg font-mono font-bold ${kpi.color}`}><FmtN val={kpi.qiymat} qisqa /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <div className="mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
            <FinancialChart objects={data.objects || []} />
          </motion.div>
        </div>

        {/* IERARXIK JADVAL */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
          <h2 className="text-2xl font-bold text-white mb-6 drop-shadow">Ierarxik Moliyaviy Jadval</h2>
          <GlassCard className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-black/30 border-b border-white/10">
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold w-[35%]">Nomi (Shartnoma / Obyekt / Razdel)</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold text-right">Mijozga narx (so'm)</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold text-right">Fakt Bajarildi</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold text-right">Progress</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold text-right">F-2 Olingan</th>
                  <th className="py-4 px-4 text-xs uppercase tracking-wider text-slate-400 font-bold text-right">Qoldiq</th>
                </tr>
              </thead>
              <tbody>
                {(data.objects || []).sort((a,b) => b.smeta - a.smeta).map((sh, idx) => (
                  <ShartnomaRow key={idx} shartnoma={sh} />
                ))}
              </tbody>
            </table>
          </GlassCard>
        </motion.div>

      </div>
    </AuroraBackground>
  );
}
