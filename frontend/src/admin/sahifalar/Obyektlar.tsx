import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useObyektlar, useBossData, useNavbatHolat, useObyektIshla, useBarchaIshla, useNavbatToxtat } from '../../api/hooks';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Folder, ChevronDown, FileSpreadsheet, TrendingUp, Clock, Building2, Wallet, PlayCircle, Zap, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import type { PapkaObyekt } from '../../api/types';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { Skelet, XatoHolat } from '../../umumiy/ui/Sahifa';
import { FmtN, formatPercent } from '../../lib/format';
import { toast } from '../../umumiy/ui/Toast';

export function Obyektlar() {
  const soragan = useObyektlar();
  const { data: bossData } = useBossData();
  const { data, refetch, isFetching, error } = soragan;

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  // ⚡ Dvigatel (НАВБАТ) — fon rejimida ishlaydi, UI faqat holatni kuzatadi
  const [kuzat, setKuzat] = useState(true);
  const { data: navbat } = useNavbatHolat(kuzat);
  const navbatFaol = !!navbat?.running;
  const obyektIshla = useObyektIshla();
  const barchaIshla = useBarchaIshla();
  const navbatToxtat = useNavbatToxtat();

  // Navbat tugaganda ma'lumotni bir marta yangilaymiz
  const [oldingiFaol, setOldingiFaol] = useState(false);
  
  useEffect(() => {
    if (navbatFaol !== oldingiFaol) {
      setOldingiFaol(navbatFaol);
      if (!navbatFaol && oldingiFaol) { 
        refetch(); 
        toast('Dvigatel ishini tugatdi', 'ok'); 
      }
    }
    // Agar javob kelgan bo'lsa va ishlamayotgan bo'lsa kuzatishni to'xtatamiz
    if (navbat && !navbatFaol && kuzat) {
      setKuzat(false);
    }
  }, [navbat, navbatFaol, oldingiFaol, kuzat, refetch]);

  const hammasiniIshla = async (tezkor: boolean) => {
    try {
      const r = await barchaIshla.mutateAsync({ tezkor });
      if (r.ok === false) { toast(r.xabar || 'Boshlanmadi', 'danger'); return; }
      setKuzat(true);
      toast(tezkor ? 'Tezkor hisoblash navbatga qo\'yildi' : 'To\'liq hisoblash navbatga qo\'yildi', 'ok');
    } catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
  };

  const bittasiniIshla = async (obyekt: string, tezkor: boolean) => {
    try {
      const r = await obyektIshla.mutateAsync({ obyekt, tezkor });
      if (r.ok === false) { toast(r.xabar || 'Boshlanmadi', 'danger'); return; }
      setKuzat(true);
      toast(`«${obyekt}» navbatga qo'yildi`, 'ok');
    } catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
  };

  const groupedData = useMemo(() => {
    if (!data) return [];
    
    const groups = new Map<string, { items: PapkaObyekt[], stats: any }>();
    data.forEach(obj => {
      const baseName = obj.obyekt.split(' - ')[0];
      if (!groups.has(baseName)) {
        // BossData dan moliyaviy ma'lumotlarni qidiramiz
        let stats = null;
        if (bossData?.objects) {
           for (const sh of bossData.objects) {
              if (sh.nom.toLowerCase() === baseName.toLowerCase()) {
                 stats = sh;
                 break;
              }
              if (sh.subItems) {
                 const found = sh.subItems.find(s => s.nom.toLowerCase() === baseName.toLowerCase());
                 if (found) { stats = found; break; }
              }
           }
        }
        groups.set(baseName, { items: [], stats: stats });
      }
      groups.get(baseName)!.items.push(obj);
    });
    
    return Array.from(groups.entries()).map(([baseName, { items, stats }]) => ({
      baseName,
      items,
      stats
    }));
  }, [data, bossData]);

  const toggleGroup = (baseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [baseName]: !prev[baseName]
    }));
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  if (soragan.isLoading) {
    return (
      <AuroraBackground>
        <div className="p-8 max-w-[1600px] mx-auto w-full"><Skelet qatorlar={8} /></div>
      </AuroraBackground>
    );
  }

  if (error) {
    return (
      <AuroraBackground>
        <div className="p-8"><XatoHolat xato={error as Error} qayta={() => refetch()} /></div>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <div className="max-w-[1600px] w-full mx-auto p-6 md:p-8 flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin relative z-10">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
          <div>
            <motion.h1 
              initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 tracking-tight drop-shadow-[0_0_15px_rgba(129,140,248,0.4)]"
            >
              Obyektlar Ro'yxati
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="text-slate-300 text-base mt-3 flex items-center gap-3 font-medium"
            >
              <Building2 size={18} className="text-accent" />
              Smetalar papkasidagi jami {groupedData.length} ta asosiy obyektlar
            </motion.p>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-4"
          >
            <button
              onClick={() => refetch()} disabled={isFetching}
              className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Yangilash
            </button>
            <button
              onClick={() => hammasiniIshla(true)}
              disabled={navbatFaol || barchaIshla.isPending}
              title="Barcha obyektlarni tezkor rejimda qayta hisoblaydi (fon navbatida)"
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-white px-5 py-2.5 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-40 font-medium"
            >
              <Zap size={18} /> Tezkor
            </button>
            <button
              onClick={() => hammasiniIshla(false)}
              disabled={navbatFaol || barchaIshla.isPending}
              title="Barcha obyektlarni to'liq qayta hisoblaydi (fon navbatida)"
              className="flex items-center gap-2 bg-gradient-to-r from-accent to-blue-500 hover:from-accent/90 hover:to-blue-500/90 text-white px-6 py-2.5 rounded-xl shadow-lg shadow-accent/20 transition-all active:scale-95 font-semibold disabled:opacity-40"
            >
              <PlayCircle size={18} /> Hammasini ishla
            </button>
          </motion.div>
        </header>

        {/* ⚡ НАВБАТ — dvigatel fon rejimida ishlayotganda jonli progress */}
        <AnimatePresence>
          {navbatFaol && navbat && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <GlassCard className="p-5 border-accent/30">
                <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <Loader2 size={20} className="text-accent animate-spin" />
                    <div>
                      <div className="text-white font-semibold">
                        Dvigatel ishlamoqda — {navbat.bajarilgan}/{navbat.jami} obyekt
                      </div>
                      {navbat.hozir && (
                        <div className="text-xs text-slate-400 mt-0.5">Hozir: {navbat.hozir.split('@@')[0]}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      try { await navbatToxtat.mutateAsync(); toast('Navbat to\'xtatildi', 'ok'); }
                      catch (e: any) { toast('Xato: ' + e.message, 'danger'); }
                    }}
                    disabled={navbatToxtat.isPending}
                    className="text-xs bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-400 px-3 py-1.5 rounded border border-rose-500/30 transition-colors disabled:opacity-50"
                  >
                    To'xtatish
                  </button>
                </div>
                <div className="h-2 bg-black/50 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-accent to-blue-400 rounded-full"
                    animate={{ width: `${navbat.foiz}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                {navbat.log && navbat.log.length > 0 && (
                  <div className="mt-3 max-h-24 overflow-y-auto scrollbar-thin text-xs space-y-1">
                    {navbat.log.slice(-6).reverse().map((l, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {l.ok
                          ? <CheckCircle size={12} className="text-ok shrink-0" />
                          : <AlertTriangle size={12} className="text-danger shrink-0" />}
                        <span className="text-slate-300">{l.ob}</span>
                        {l.xabar && <span className="text-slate-500 truncate">— {l.xabar}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {groupedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] opacity-60">
            <Folder size={64} className="text-slate-500 mb-4" />
            <p className="text-xl text-slate-300 font-medium">Google Drive'da hali smeta fayllari yo'q</p>
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {groupedData.map((group, i) => {
              const isExpanded = expandedGroups[group.baseName];
              const hasMultiple = group.items.length > 1;
              const stats = group.stats; // BossData dan olingan stats
              
              return (
                <motion.div variants={itemVariants} key={i} className={isExpanded && hasMultiple ? 'row-span-2' : ''}>
                  <GlassCard 
                    className={`h-full flex flex-col group/card cursor-pointer transition-all duration-300 ${isExpanded ? 'border-accent/50 shadow-[0_0_30px_rgba(14,165,233,0.15)]' : 'border-white/10 hover:border-white/30 hover:shadow-xl'}`}
                    onClick={() => navigate(`/admin/holat/${encodeURIComponent(group.baseName)}`)}
                  >
                    <div className="p-6 flex-1 flex flex-col relative z-10">
                      
                      <div className="flex items-start justify-between mb-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-transform duration-300 ${hasMultiple ? 'bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 group-hover/card:scale-110' : 'bg-white/5 border border-white/10 text-slate-400 group-hover/card:scale-110'}`}>
                          {hasMultiple ? <Folder size={28} /> : <FileSpreadsheet size={28} />}
                        </div>
                        {hasMultiple && (
                          <div 
                            onClick={(e) => { e.stopPropagation(); toggleGroup(group.baseName, e as any); }}
                            className={`w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 cursor-pointer hover:bg-white/20 transition-all duration-300 ${isExpanded ? 'rotate-180 bg-accent/20 text-accent' : 'group-hover/card:bg-white/10'}`}
                          >
                            <ChevronDown size={18} />
                          </div>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-white mb-2 line-clamp-2 leading-tight group-hover/card:text-blue-100 transition-colors">
                        {group.baseName}
                      </h3>
                      <p className="text-sm text-slate-400 mb-6 flex items-center gap-2">
                        {hasMultiple ? <span className="bg-white/10 px-2 py-0.5 rounded text-xs">{group.items.length} ta lokalka</span> : 'Smeta hujjati'}
                      </p>

                      {/* Agar BossData ulangan bo'lsa KPI larni ko'rsatamiz */}
                      {stats ? (
                        <div className="mt-auto space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                               <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><Wallet size={12}/> Smeta</div>
                               <div className="text-sm font-mono font-bold text-slate-200"><FmtN val={stats.smeta} qisqa /></div>
                            </div>
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                               <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1"><TrendingUp size={12}/> Fakt</div>
                               <div className="text-sm font-mono font-bold text-ok"><FmtN val={stats.fakt} qisqa /></div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="flex justify-between text-xs mb-1.5">
                              <span className="text-slate-400">Bajarilish (%):</span>
                              <span className="font-bold text-accent">{formatPercent(stats.progress)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden shadow-inner">
                              <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${Math.min(stats.progress, 100)}%` }} 
                                transition={{ duration: 1, delay: i * 0.1 }}
                                className="h-full bg-gradient-to-r from-blue-500 to-accent rounded-full"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-auto pt-4 border-t border-white/10 text-xs text-slate-500 italic flex items-center gap-2">
                          <Clock size={14} /> Moliya ma'lumotlari yuklanmadi — obyektni «Ishla» tugmasi bilan hisoblang
                        </div>
                      )}

                      {/* ⚡ Shu obyektni qayta hisoblash (dvigatel, fon navbatida) */}
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); group.items.forEach(it => bittasiniIshla(it.obyekt, true)); }}
                          disabled={navbatFaol || obyektIshla.isPending}
                          title="Tezkor qayta hisoblash (narx o'zgarmagan bo'lsa)"
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white px-3 py-2 rounded-lg border border-white/10 transition-colors disabled:opacity-40"
                        >
                          <Zap size={13} /> Tezkor
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); group.items.forEach(it => bittasiniIshla(it.obyekt, false)); }}
                          disabled={navbatFaol || obyektIshla.isPending}
                          title="To'liq qayta hisoblash"
                          className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-accent/15 hover:bg-accent hover:text-white text-accent px-3 py-2 rounded-lg border border-accent/30 transition-colors disabled:opacity-40"
                        >
                          <PlayCircle size={13} /> Ishla
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && hasMultiple && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="border-t border-white/10 bg-black/20 backdrop-blur-md rounded-b-2xl relative z-20"
                        >
                          <ul className="p-3 space-y-1">
                            {group.items.map((item, j) => (
                              <li key={j}>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); navigate(`/admin/holat/${encodeURIComponent(item.obyekt)}`); }}
                                  className="w-full text-left px-4 py-3 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3 truncate group/btn border border-transparent hover:border-white/10"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover/btn:bg-accent group-hover/btn:scale-150 transition-all flex-shrink-0" />
                                  <span className="truncate">{item.obyekt.replace(group.baseName + ' - ', '')}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </AuroraBackground>
  );
}

