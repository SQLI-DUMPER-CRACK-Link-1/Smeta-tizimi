import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useObyektlar, useBossData, useNavbatHolat, useObyektIshla, useBarchaIshla, useNavbatToxtat,
         useObyektTekshir, type ObyektTekshirNatija } from '../../api/hooks';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { Folder, ChevronDown, FileSpreadsheet, TrendingUp, Clock, Building2, Wallet, PlayCircle, Zap, Loader2, CheckCircle, AlertTriangle, Stethoscope, X } from 'lucide-react';
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
  const tekshir = useObyektTekshir();
  const [tashxisObyekt, setTashxisObyekt] = useState('');
  const [tashxis, setTashxis] = useState<ObyektTekshirNatija | null>(null);

  /** Papkadagi fayllar qanday tanilganini sabablari bilan ko'rsatadi */
  async function tashxisOch(obyekt: string) {
    setTashxisObyekt(obyekt);
    setTashxis(null);
    try {
      const r = await tekshir.mutateAsync({ obyekt });
      setTashxis(r);
      if (!r.ok) toast(r.xabar || 'Tekshirib bo\'lmadi', 'warn', undefined, 9000);
    } catch (e: any) {
      setTashxisObyekt('');
      toast('Tashxis xatosi: ' + e.message, 'danger', undefined, 9000);
    }
  }
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
      stats,
      /* ⚠️ 2026-08-17: OCHISH UCHUN HAQIQIY OBYEKT NOMI.
       *
       * `baseName` — bu `obj.obyekt.split(' - ')[0]`, ya'ni KO'RSATISH uchun
       * qisqartirilgan nom. Uni ochish havolasida ishlatish XATO edi:
       * «Game club - 110081_…» kartasini bosganda `/admin/holat/Game club`
       * ga o'tilardi, GAS da esa bunday nomli obyekt YO'Q — natijada
       * BUTUNLAY BOSHQA obyekt («10 kv visokiy liniya») ochilib qolardi.
       * Xato obyektni tahrirlash xavfi bor edi.
       *
       * QOIDA: guruhda bitta element bo'lsa — uning TO'LIQ haqiqiy nomi
       * bilan ochamiz. Ko'p bo'lsa — `baseName` haqiqiy ota-papka nomi
       * (ko'p smetali obyekt), u holda o'zi to'g'ri. */
      ochishNomi: items.length === 1 ? items[0].obyekt : baseName,
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
              
              /* ⚠️ 2026-08-17: `key` avval `{i}` — indeks bo'yicha edi.
                 Tartib o'zgarsa (yangi obyekt, filtr, qayta yuklash) React
                 BOSHQA guruhning DOM tugunini qayta ishlatadi — yoyilgan holat
                 boshqa kartaga o'tib ketadi. Endi nom bo'yicha: barqaror. */
              return (
                <motion.div variants={itemVariants} key={group.baseName} className={isExpanded && hasMultiple ? 'row-span-2' : ''}>
                  <GlassCard 
                    className={`h-full flex flex-col group/card cursor-pointer transition-all duration-300 ${isExpanded ? 'border-accent/50 shadow-[0_0_30px_rgba(14,165,233,0.15)]' : 'border-white/10 hover:border-white/30 hover:shadow-xl'}`}
                    onClick={() => navigate(`/admin/holat/${encodeURIComponent(group.ochishNomi)}`)}
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

                      {/* ⚡⚡⚡ 2026-08-16 ADMIN UCHUN TEXNIK MA'LUMOT.
                          Foydalanuvchi: «obyektlar tabida nima bajariladi
                          tushunmayapmanda... saytda malumot juda kam admin uchun».
                          `apiPapkaSkan` bu ma'lumotlarni ALLAQACHON qaytarardi
                          (lokName, svodName, format, folderId), lekin ekranda
                          faqat nom va KPI ko'rsatilardi. Admin uchun eng muhimi:
                          smeta va SVODKA fayllari joyidami — svodka bo'lmasa
                          narxlash umuman ishlamaydi va obyekt «hisoblanmadi»
                          bo'lib qoladi, sababi esa ko'rinmasdi. */}
                      {(() => {
                        const it = group.items[0];
                        if (!it) return null;
                        const svodYoq = !it.svodName || it.svodName === "(yo'q)";
                        const lokYoq  = !it.lokName  || it.lokName  === "(yo'q)";
                        return (
                          <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-[11px]">
                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 w-[52px] flex-shrink-0">Smeta:</span>
                              <span className={`flex-1 truncate ${lokYoq ? 'text-danger' : 'text-slate-300'}`}
                                    title={it.lokName}>
                                {lokYoq ? '⚠ topilmadi' : it.lokName}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-slate-500 w-[52px] flex-shrink-0">Svodka:</span>
                              <span className={`flex-1 truncate ${svodYoq ? 'text-warn' : 'text-slate-300'}`}
                                    title={it.svodName}>
                                {svodYoq ? '⚠ yo\'q — narxlash ishlamaydi' : it.svodName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap pt-0.5">
                              <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                {it.format || 'TN'}
                              </span>
                              {group.items.length > 1 && (
                                <span className="px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                                  {group.items.length} lokalka
                                </span>
                              )}
                              {it.folderId && (
                                <a href={`https://drive.google.com/drive/folders/${it.folderId}`}
                                   target="_blank" rel="noreferrer"
                                   onClick={(e) => e.stopPropagation()}
                                   className="px-1.5 py-0.5 rounded bg-white/5 text-accent hover:bg-accent/20 transition-colors">
                                  📁 Drive
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ⚡ Shu obyektni qayta hisoblash (dvigatel, fon navbatida) */}
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
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
                        {/* ⚡⚡⚡ 2026-08-17 (audit): TASHXIS — `apiObyektFayllarniTekshir`
                            GAS da (05_Papka.js:70) bor va hook'i ham yozilgan edi, lekin
                            HECH QAYERDA chaqirilmasdi. Bu funksiya papkadagi HAR FAYL
                            qaysi rolni (СВОДКА / ЛОКАЛКА / ТИЗИМ / e'tiborsiz) olganini
                            va NEGA shundayligini aytadi. Ya'ni «obyektim nega ishlamayapti»
                            degan eng ko'p uchraydigan savolga to'g'ridan-to'g'ri javob —
                            u saytda yo'q bo'lgani uchun har marta taxmin qilinardi. */}
                        <button
                          onClick={(e) => { e.stopPropagation(); tashxisOch(group.items[0].obyekt); }}
                          disabled={tekshir.isPending}
                          title="Papkadagi fayllar qanday tanilgan — sabablari bilan"
                          aria-label="Obyekt fayllarini tekshirish"
                          className="flex items-center justify-center gap-1.5 text-xs bg-white/5 hover:bg-amber-500/20
                                     text-slate-300 hover:text-amber-300 px-3 py-2 rounded-lg border border-white/10
                                     transition-colors disabled:opacity-40"
                        >
                          {tekshir.isPending && tashxisObyekt === group.items[0].obyekt
                            ? <Loader2 size={13} className="animate-spin" />
                            : <Stethoscope size={13} />}
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

      {/* ⚡⚡⚡ 2026-08-17 (audit): TASHXIS NATIJASI.
          Har fayl qaysi rolni olgani va NEGA — «obyekt nega ishlamayapti»
          savoliga javob. Eng qimmatli qatori: «ЛОКАЛКА (номзод)» —
          zaxira qoida uni SVODKA qilib qo'yishi mumkinligi haqidagi
          ogohlantirish, bu eng ko'p uchraydigan sabab. */}
      <AnimatePresence>
        {tashxisObyekt && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => { setTashxisObyekt(''); setTashxis(null); }}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col
                         bg-[#0B0E14] border border-white/15 rounded-2xl shadow-2xl"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <Stethoscope size={17} className="text-amber-400" />
                    Fayl tashxisi
                  </h3>
                  <p className="text-[12px] text-slate-400 mt-0.5 truncate">{tashxisObyekt}</p>
                </div>
                <button onClick={() => { setTashxisObyekt(''); setTashxis(null); }}
                  aria-label="Yopish" title="Yopish"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
                {tekshir.isPending && <div className="skel h-24 rounded" />}

                {!tekshir.isPending && tashxis && !tashxis.ok && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/25">
                    <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[13px] text-rose-200">{tashxis.xabar || 'Tekshirib bo\'lmadi'}</p>
                  </div>
                )}

                {!tekshir.isPending && tashxis?.ok && (
                  <>
                    {/* Yakuniy xulosa — eng muhim ikki qator */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                          Tanlangan SVODKA
                        </div>
                        <div className="text-[13px] text-white break-words">
                          {tashxis.yakuniySvod || '(aniqlanmadi)'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10">
                        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                          Aniqlangan sub-obyektlar ({(tashxis.yakuniyObyektlar ?? []).length})
                        </div>
                        <div className="text-[12px] text-slate-300 space-y-0.5">
                          {(tashxis.yakuniyObyektlar ?? []).length === 0
                            ? <span className="text-rose-400">Hech biri — obyekt ishlamaydi</span>
                            : (tashxis.yakuniyObyektlar ?? []).map((o) => (
                                <div key={o} className="break-words">· {o}</div>
                              ))}
                        </div>
                      </div>
                    </div>

                    {/* Qo'lda bog'lash — agar bor bo'lsa, sabab shu bo'lishi mumkin */}
                    {tashxis.override && (
                      <div className="p-3 rounded-lg bg-blue-500/[0.07] border border-blue-500/20 text-[12px] space-y-1">
                        <div className="text-[10px] uppercase tracking-widest text-blue-300 mb-1.5">
                          Qo'lda bog'langan (Sozlamalar → Bog'lash)
                        </div>
                        <div className="text-slate-300">LOKALKA: <span className="text-white">{tashxis.override.lokNom}</span></div>
                        <div className="text-slate-300">SVODKA: <span className="text-white">{tashxis.override.svodNom}</span></div>
                        {tashxis.override.format && (
                          <div className="text-slate-300">Format: <span className="text-white">{tashxis.override.format}</span></div>
                        )}
                        {tashxis.override.narxTayyor && (
                          <div className="text-emerald-400">Narx tayyor — svodka talab qilinmaydi</div>
                        )}
                      </div>
                    )}

                    {/* Fayl-fayl tafsilot */}
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                        Papkadagi fayllar ({(tashxis.fayllar ?? []).length})
                      </div>
                      <div className="space-y-1.5">
                        {(tashxis.fayllar ?? []).map((f) => {
                          const h = f.holat.toUpperCase();
                          const rang = h.startsWith('СВОДКА') ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.07]'
                            : h.startsWith('ЛОКАЛКА (НОМЗОД') ? 'text-amber-400 border-amber-500/25 bg-amber-500/[0.07]'
                            : h.startsWith('ЛОКАЛКА')        ? 'text-blue-400 border-blue-500/25 bg-blue-500/[0.07]'
                            : 'text-slate-400 border-white/10 bg-white/[0.02]';
                          return (
                            <div key={f.id} className={`p-2.5 rounded-lg border ${rang}`}>
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-[12px] text-white break-words min-w-0">{f.nom}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
                                  {f.holat}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{f.sabab}</p>
                            </div>
                          );
                        })}
                        {(tashxis.fayllar ?? []).length === 0 && (
                          <p className="text-[12px] text-slate-500 italic">Papkada fayl yo'q.</p>
                        )}
                      </div>
                    </div>

                    {tashxis.xabar && (
                      <p className="text-[11px] text-slate-500 border-t border-white/10 pt-3">{tashxis.xabar}</p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuroraBackground>
  );
}

