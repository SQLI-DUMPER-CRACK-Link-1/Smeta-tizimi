import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBossData } from '../../api/hooks';
import { FmtN, formatPercent } from '../../lib/format';
import { MalumotYoshi, Skelet, XatoHolat } from '../../umumiy/ui/Sahifa';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, Wallet, CheckCircle, Clock, ChevronRight } from 'lucide-react';

// --- AURORA BACKGROUND ---
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
    <div className="relative w-full h-full min-h-screen bg-[#05050A] overflow-hidden text-white font-sans selection:bg-accent/30">
      {/* Animated Gradient Orbs */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: `${mousePosition.x}%`,
            y: `${mousePosition.y}%`,
          }}
          transition={{ type: 'spring', damping: 100, stiffness: 50, mass: 2 }}
          className="absolute -top-[50%] -left-[50%] w-[100vw] h-[100vw] rounded-full bg-accent/20 blur-[120px] mix-blend-screen opacity-50"
        />
        <div className="absolute top-[20%] right-[10%] w-[60vw] h-[60vw] rounded-full bg-indigo-600/10 blur-[150px] mix-blend-screen animate-pulse duration-[10000ms]" />
        <div className="absolute -bottom-[20%] left-[20%] w-[70vw] h-[70vw] rounded-full bg-emerald-600/10 blur-[130px] mix-blend-screen" />
      </div>

      {/* Grid Overlay */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-[0.03] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

// --- GLASS CARD ---
function GlassCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-[#1C1F26]/40 backdrop-blur-2xl border border-white/5 shadow-2xl rounded-3xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

// --- CUSTOM SVG CHART ---
function FinancialChart({ objects }: { objects: any[] }) {
  // Barcha sub obyektlarni bitta yassi ro'yxatga yig'amiz (Subpodryadlarni olib tashlaymiz)
  const allSubItems = objects.flatMap(sh => sh.subItems || []).filter(o => !o.nom.startsWith('👷'));
  
  if (!allSubItems || allSubItems.length === 0) return null;
  const maxSmeta = Math.max(...allSubItems.map(o => o.smeta || 0));

  return (
    <GlassCard className="p-6 h-[300px] flex flex-col">
      <h3 className="text-lg font-semibold text-white/90 mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-accent" />
        Moliyaviy Oqim (Top Obyektlar)
      </h3>
      
      <div className="flex-1 flex items-end gap-3 w-full overflow-x-auto pb-2 scrollbar-thin">
        {allSubItems.sort((a, b) => b.smeta - a.smeta).slice(0, 15).map((obj, idx) => {
          const hSmeta = Math.max(5, ((obj.smeta || 0) / maxSmeta) * 100);
          const hFakt = Math.max(0, ((obj.fakt || 0) / maxSmeta) * 100);
          const hF2 = Math.max(0, ((obj.f2 || 0) / maxSmeta) * 100);
          
          return (
            <div key={idx} className="flex flex-col items-center gap-2 group flex-1 min-w-[40px] relative">
              <div className="w-full h-[150px] relative flex justify-center items-end bg-white/5 rounded-t-lg overflow-hidden">
                {/* Smeta */}
                <motion.div 
                  initial={{ height: 0 }} animate={{ height: `${hSmeta}%` }} transition={{ duration: 1, delay: idx * 0.03 }}
                  className="absolute bottom-0 w-full bg-white/10"
                />
                {/* Fakt */}
                <motion.div 
                  initial={{ height: 0 }} animate={{ height: `${hFakt}%` }} transition={{ duration: 1, delay: 0.2 + idx * 0.03 }}
                  className="absolute bottom-0 w-full bg-ok/40"
                />
                {/* F2 */}
                <motion.div 
                  initial={{ height: 0 }} animate={{ height: `${hF2}%` }} transition={{ duration: 1, delay: 0.4 + idx * 0.03 }}
                  className="absolute bottom-0 w-full bg-t-rs/60"
                />
              </div>
              <span className="text-[10px] text-white/40 truncate w-full text-center group-hover:text-white/80 transition-colors" title={obj.nom}>
                {obj.nom.substring(0, 8)}...
              </span>
              
              {/* Tooltip on Hover */}
              <div className="absolute -top-20 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md px-3 py-2 rounded-xl text-xs whitespace-nowrap z-20 pointer-events-none border border-white/10 shadow-xl">
                <div className="font-bold text-white mb-1 max-w-[200px] truncate">{obj.nom}</div>
                <div className="text-white/60">Smeta: <FmtN val={obj.smeta} qisqa /></div>
                <div className="text-ok">Fakt: <FmtN val={obj.fakt} qisqa /></div>
                <div className="text-t-rs">F2: <FmtN val={obj.f2} qisqa /></div>
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export default function Umumiy() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useBossData();
  const navigate = useNavigate();

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
      <div className="max-w-[1600px] w-full mx-auto p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden">
        
        {/* Apple-style Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight"
            >
              Boshqaruv Markazi
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-white/50 text-base mt-2 flex items-center gap-3"
            >
              Umumiy smeta hajmi va moliyaviy oqimlar holati
              {dataUpdatedAt && (
                <>
                  <span className="w-1.5 h-1.5 bg-white/20 rounded-full"></span>
                  <MalumotYoshi vaqt={dataUpdatedAt} />
                </>
              )}
            </motion.p>
          </div>
          
          <motion.button 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/90 px-5 py-2.5 rounded-2xl transition-all shadow-lg backdrop-blur-md active:scale-95"
          >
            <RefreshCw size={18} className={isFetching ? 'animate-spin text-accent' : ''} />
            <span className="font-medium">Yangilash</span>
          </motion.button>
        </header>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { nom: "Smeta Jami", qiymat: data.jami.smeta, pct: null, color: "text-white", icon: Wallet },
            { nom: "Bajarilgan (Fakt)", qiymat: data.jami.fakt, pct: data.jami.progress, color: "text-ok", bg: "bg-ok", icon: TrendingUp },
            { nom: "Tasdiqlangan (F2)", qiymat: data.jami.f2, pct: data.jami.f2pct, color: "text-t-rs", bg: "bg-t-rs", icon: CheckCircle },
            { nom: "Qoldiq", qiymat: data.jami.qoldiq, pct: null, color: "text-white/70", icon: Clock },
          ].map((kpi, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1, duration: 0.6, type: "spring" }}
            >
              <GlassCard className="p-6 relative group cursor-default hover:bg-white/[0.07] transition-colors">
                <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
                
                <h3 className="text-white/50 font-medium flex items-center gap-2 mb-3">
                  <kpi.icon size={18} />
                  {kpi.nom}
                </h3>
                
                <div className={`text-3xl font-bold tracking-tight font-mono ${kpi.color}`}>
                  <FmtN val={kpi.qiymat} />
                </div>
                
                {kpi.pct !== null && (
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden inset-shadow-sm">
                      <motion.div 
                        initial={{ width: 0 }} animate={{ width: `${Math.min(kpi.pct, 100)}%` }} transition={{ duration: 1, delay: 0.5 }}
                        className={`h-full ${kpi.bg} rounded-full`} 
                      />
                    </div>
                    <span className={`text-sm font-semibold ${kpi.color}`}>{formatPercent(kpi.pct)}</span>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* Lower Section: Chart & List */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left: Chart */}
          <div className="lg:col-span-2 flex flex-col gap-8">
             <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4, duration: 0.6 }}>
               <FinancialChart objects={data.objects || []} />
             </motion.div>
          </div>

          {/* Right: Glass List of Objects */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="flex flex-col h-[500px]"
          >
            <h3 className="text-xl font-bold text-white/90 mb-4 px-2">Obyektlar va Shartnomalar</h3>
            <GlassCard className="flex-1 overflow-y-auto p-2 scrollbar-thin flex flex-col gap-2">
              {(data.objects || []).map((shartnoma, i) => (
                <div key={i} className="mb-2">
                  <div className="px-4 py-2 bg-white/[0.03] border border-white/5 rounded-t-xl">
                    <h4 className="font-semibold text-white/70 text-sm tracking-wider uppercase">{shartnoma.nom}</h4>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {(shartnoma.subItems || []).map((obj, j) => {
                      const isSub = obj.nom.startsWith('👷');
                      return (
                        <div 
                          key={j} 
                          onClick={() => !isSub && navigate('/boss/holat/' + encodeURIComponent(obj.nom))}
                          className={`p-4 rounded-xl transition-all flex items-center justify-between group
                            ${isSub ? 'bg-white/[0.02] cursor-default' : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 cursor-pointer'}
                          `}
                        >
                          <div className="flex-1 min-w-0 pr-4">
                            <h4 className={`font-medium truncate transition-colors ${isSub ? 'text-white/50 text-sm' : 'text-white/90 group-hover:text-accent'}`}>
                              {obj.nom}
                            </h4>
                            <div className="flex gap-4 mt-1 text-xs font-mono">
                              <span className="text-white/40">S: <FmtN val={obj.smeta} qisqa /></span>
                              <span className="text-ok/70">F: <FmtN val={obj.fakt} qisqa /></span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-center gap-1">
                            <span className={`text-sm font-bold ${obj.progress > 90 ? 'text-ok' : obj.progress > 50 ? 'text-warn' : 'text-danger'}`}>
                              {formatPercent(obj.progress)}
                            </span>
                            {!isSub && (
                              <ChevronRight size={16} className="text-white/20 group-hover:text-white/60 transition-colors group-hover:translate-x-1" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </GlassCard>
          </motion.div>
          
        </div>
        
      </div>
    </AuroraBackground>
  );
}
