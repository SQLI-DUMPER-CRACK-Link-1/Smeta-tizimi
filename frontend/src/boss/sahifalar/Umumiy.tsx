import { useState } from 'react';
import { useBossData, useBossObyekt } from '../../api/hooks';
import { FmtN, formatPercent } from '../../lib/format';
import { MalumotYoshi, Skelet, XatoHolat } from '../../umumiy/ui/Sahifa';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, TrendingUp, Wallet, CheckCircle, Clock, ChevronRight, ChevronDown, FileText, ArrowDownToLine, ArrowUpFromLine, HardHat, Truck, Wrench, Info, Layers, PieChart, Activity, X, AlertTriangle, Cpu, Server, Component, Zap, Users } from 'lucide-react';
import Sahna3D from '../../kirish/Sahna3D';

// --- 3D INTERACTIVE BACKGROUND ---
function AuroraBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden text-white font-sans selection:bg-accent/30">
      {/* 3D Interactive Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <Sahna3D />
      </div>

      {/* Grid Overlay for texture */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none" />

      {/* Blur overlays to make text readable */}
      <div className="absolute inset-0 z-0 bg-black/30 pointer-events-none" />

      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
}

function GlassCard({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`bg-slate-800/40 backdrop-blur-xl border border-white/10 shadow-xl rounded-2xl overflow-hidden ${className}`}>
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

// --- PROFIT AND LOSS (Rentabellik Tahlili) ---
function ProfitAndLoss({ jami, objects, onKpiClick }: { jami: any, objects: any[], onKpiClick: (kpi: any) => void }) {
  const umumiyXarajat = (jami.chel || 0) + (jami.mash || 0) + (jami.mat || 0) + (jami.ob || 0) + (jami.mk || 0) + (jami.kab || 0) + (jami.sub || 0);
  const sofFoyda = (jami.smeta || 0) - umumiyXarajat;
  const rentabellik = jami.smeta > 0 ? (sofFoyda / jami.smeta) * 100 : 0;
  
  const realFoyda = (jami.tolangan || 0) - (umumiyXarajat > 0 ? (umumiyXarajat * (jami.progress/100)) : 0); // Keltirilgan foyda

  const handleClick = () => {
    const items = objects.map(o => {
      const oXarajat = (o.chel || 0) + (o.mash || 0) + (o.mat || 0) + (o.ob || 0) + (o.mk || 0) + (o.kab || 0) + (o.sub || 0);
      const oFoyda = (o.smeta || 0) - oXarajat;
      return { nom: o.nom, val: oFoyda };
    }).filter(item => item.val !== 0);
    
    onKpiClick({
      nom: "Sof Foyda (Prognoz)",
      color: "text-emerald-400",
      icon: PieChart,
      total: sofFoyda,
      items: items
    });
  };
  
  return (
    <GlassCard 
      onClick={handleClick}
      className="p-6 h-[320px] flex flex-col relative overflow-hidden group cursor-pointer hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200"
    >
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl group-hover:bg-accent/20 transition-all duration-700 pointer-events-none" />
      <h3 className="text-lg font-semibold text-white/90 mb-4 flex items-center gap-2">
        <PieChart size={20} className="text-emerald-400" />
        Rentabellik va Foyda (Prognoz)
      </h3>
      
      <div className="flex-1 flex flex-col justify-center gap-5 z-10">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Kutilayotgan Sof Foyda</div>
          <div className="text-3xl font-extrabold font-mono text-emerald-400 drop-shadow-md">
            <FmtN val={sofFoyda} />
          </div>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center">
            <div className="text-[10px] text-slate-400 uppercase mb-1">Rentabellik</div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-1">
              {rentabellik.toFixed(1)}% <Activity size={14} className="text-accent" />
            </div>
          </div>
          <div className="flex-1 bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center" title="Tushgan puldan qilingan ish hajmi xarajati ayirmasi">
            <div className="text-[10px] text-slate-400 uppercase mb-1">Joriy Holat (Kesh)</div>
            <div className={`text-lg font-bold font-mono ${realFoyda >= 0 ? 'text-ok' : 'text-danger'}`}>
              <FmtN val={realFoyda} qisqa />
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// --- SMART AI XULOSA ---
function SmartXulosa({ jami }: { jami: any }) {
  const qarzlar = jami.debitor || 0;
  const qoldiq = jami.qoldiq || 0;
  const tushum = jami.tolangan || 0;
  
  let xavf = "Barqaror";
  let xavfColor = "text-emerald-400";
  if (qarzlar > tushum * 0.3) {
    xavf = "Yuqori Xavf (Debitorlar ko'p)";
    xavfColor = "text-danger";
  } else if (qarzlar > tushum * 0.1) {
    xavf = "O'rtacha (Qarzlarni undirish kerak)";
    xavfColor = "text-warn";
  }

  return (
    <GlassCard className="p-6 relative overflow-hidden flex flex-col h-full border-l-4 border-l-accent bg-accent/5 hover:bg-accent/10 transition-colors duration-300">
       <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
         <Cpu size={120} />
       </div>
       <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
         <Activity size={20} className="text-accent" /> AI Analitik Xulosa
       </h3>
       <p className="text-slate-300 text-[15px] leading-relaxed relative z-10">
         Sizda umumiy hisobda <span className="font-bold text-white border-b border-white/20 pb-0.5"><FmtN val={jami.smeta} qisqa /></span> lik shartnomaviy ishlar mavjud bo'lib, uning <span className="font-bold text-ok">{jami.progress}%</span> qismi amalda bajarilgan. 
         Hozirgi vaqtda <span className="font-bold text-danger border-b border-danger/30 pb-0.5"><FmtN val={qarzlar} qisqa /></span> miqdorida debitor qarzdorlik shakllangan. 
         Biznesning joriy moliyaviy barqarorligi: <span className={`font-bold ${xavfColor}`}>{xavf}</span>. 
         Oldinda yana <span className="font-bold text-white"><FmtN val={qoldiq} qisqa /></span> lik bajarilishi kerak bo'lgan ish qoldig'i mavjud.
       </p>
    </GlassCard>
  );
}

// --- TOP LIST ---
function TopList({ title, icon: Icon, items, color, valKey }: { title: string, icon: any, items: any[], color: string, valKey: string }) {
  return (
    <GlassCard className="p-5 h-full">
      <h3 className="text-[11px] font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
        <Icon size={14} className={color} /> {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0 group">
             <div className="text-[13px] text-slate-300 font-medium truncate pr-3 group-hover:text-white transition-colors">{item.nom}</div>
             <div className={`text-sm font-mono font-bold ${color}`}><FmtN val={item[valKey]} qisqa /></div>
          </div>
        ))}
        {items.length === 0 && <div className="text-xs text-slate-500 italic">Ma'lumot topilmadi</div>}
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

// --- KPI MODAL (Tafsilotlar) ---
function KpiModal({ kpi, onClose }: { kpi: any, onClose: () => void }) {
  if (!kpi) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative bg-[#0F172A]/90 border border-white/20 shadow-2xl rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden z-10 backdrop-blur-2xl">
        
        {/* Glow effect in modal */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />

        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 relative z-10">
           <h3 className="text-2xl font-bold text-white flex items-center gap-3">
             <div className={`p-2 rounded-xl bg-white/5 ${kpi.color}`}>
               <kpi.icon size={24} />
             </div>
             {kpi.nom} <span className="text-sm font-normal text-slate-400 ml-2">({kpi.items.length} ta shartnoma)</span>
           </h3>
           <button onClick={onClose} className="text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-red-500/80 hover:text-white rounded-xl p-2 shadow-sm"><X size={20} /></button>
        </div>
        
        <div className="p-0 overflow-y-auto flex-1 scrollbar-thin relative z-10">
          <table className="w-full text-left border-collapse">
            <thead className="bg-black/40 sticky top-0 backdrop-blur-xl shadow-sm z-20">
              <tr>
                 <th className="py-4 px-6 text-xs text-white/50 font-bold uppercase tracking-wider">Obyekt / Shartnoma Nomi</th>
                 <th className="py-4 px-6 text-xs text-white/50 font-bold uppercase tracking-wider text-right">Qiymat</th>
                 <th className="py-4 px-6 text-xs text-white/50 font-bold uppercase tracking-wider text-right">Ulush</th>
              </tr>
            </thead>
            <tbody>
              {kpi.items.sort((a:any, b:any) => b.val - a.val).map((item:any, idx:number) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.04] transition-colors">
                  <td className="py-4 px-6 font-medium text-white/80">{item.nom}</td>
                  <td className={`py-4 px-6 text-right font-mono font-bold ${kpi.color}`}><FmtN val={item.val} /></td>
                  <td className="py-4 px-6 text-right">
                     <div className="flex items-center gap-2 justify-end">
                       <div className="w-16 h-1.5 bg-black/50 rounded-full overflow-hidden shadow-inner">
                         <div className={`h-full ${kpi.color.replace('text-', 'bg-')}`} style={{ width: `${kpi.total > 0 ? (item.val / kpi.total) * 100 : 0}%` }} />
                       </div>
                       <span className="text-xs text-white/40 font-mono w-10 text-right">{kpi.total > 0 ? ((item.val / kpi.total) * 100).toFixed(1) : 0}%</span>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 bg-black/60 border-t border-white/10 flex justify-between items-center relative z-10 backdrop-blur-xl">
          <span className="text-slate-400 font-bold tracking-widest uppercase text-sm">Jami Summa:</span>
          <span className={`text-3xl font-mono font-black ${kpi.color} drop-shadow-md`}><FmtN val={kpi.total} /></span>
        </div>
      </motion.div>
    </div>
  );
}

export default function Umumiy() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useBossData();
  const [activeKpi, setActiveKpi] = useState<any>(null);

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
            { id: "smeta", nom: "Smeta Jami", qiymat: data.jami.smeta, pct: null, color: "text-white", icon: Wallet, desc: "Barcha obyektlar yig'indisi" },
            { id: "fakt", nom: "Bajarilgan (Fakt)", qiymat: data.jami.fakt, pct: data.jami.progress, color: "text-ok", bg: "bg-ok", icon: TrendingUp, desc: "Amalda qilingan ishlar" },
            { id: "f2", nom: "Tasdiqlangan (F2)", qiymat: data.jami.f2, pct: data.jami.f2pct, color: "text-t-rs", bg: "bg-t-rs", icon: CheckCircle, desc: "Buyurtmachi tasdiqlagan" },
            { id: "qoldiq", nom: "Qoldiq", qiymat: data.jami.qoldiq, pct: null, color: "text-slate-300", icon: Clock, desc: "Smetadan qolgan miqdor" },
          ].map((kpi, idx) => (
            <motion.div key={`kpi1-${idx}`} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1, duration: 0.6, type: "spring" }}>
              <GlassCard 
                className="p-6 relative group cursor-pointer hover:bg-white/10 transition-colors border-white/10 ring-0 hover:ring-2 hover:ring-accent/50 transform hover:-translate-y-1 active:translate-y-0 duration-200"
                onClick={() => setActiveKpi({
                  nom: kpi.nom, color: kpi.color, icon: kpi.icon, total: kpi.qiymat,
                  items: data.objects.filter(o => (o as any)[kpi.id] > 0).map(o => ({ nom: o.nom, val: (o as any)[kpi.id] }))
                })}
              >
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

        {/* Moliya Oqimlari */}
        <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">Moliyaviy Oqimlar</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { id: "tolangan", nom: "Tushum (To'langan)", qiymat: data.jami.tolangan, color: "text-emerald-400", icon: ArrowDownToLine, border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
            { id: "debitor", nom: "Debitor (Qarz)", qiymat: data.jami.debitor, color: "text-red-400", icon: ArrowUpFromLine, border: "border-red-500/30", bg: "bg-red-500/5" },
            { id: "avans", nom: "Avans", qiymat: data.jami.avans, color: "text-amber-400", icon: Layers, border: "border-amber-500/30", bg: "bg-amber-500/5" },
          ].map((kpi, idx) => (
            <motion.div key={`kpi-mol-${idx}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + idx * 0.05, duration: 0.4 }}>
              <div 
                className={`p-4 rounded-xl border ${kpi.border} ${kpi.bg} backdrop-blur-md flex flex-col items-center text-center group cursor-pointer hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200`}
                onClick={() => setActiveKpi({
                  nom: kpi.nom, color: kpi.color, icon: kpi.icon, total: kpi.qiymat,
                  items: data.objects.filter(o => (o as any)[kpi.id] > 0).map(o => ({ nom: o.nom, val: (o as any)[kpi.id] }))
                })}
              >
                <kpi.icon size={24} className={`${kpi.color} mb-3 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} />
                <div className="text-[12px] font-bold text-slate-300 uppercase tracking-widest mb-1 group-hover:text-white transition-colors">{kpi.nom}</div>
                <div className={`text-2xl font-mono font-bold ${kpi.color}`}><FmtN val={kpi.qiymat} qisqa /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Xarajatlar Tahlili (To'liq Backend Data) */}
        <h2 className="text-sm font-bold text-slate-400 mb-4 tracking-widest uppercase">Xarajatlar Tahlili</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
          {[
            { id: "mat", nom: "Material", qiymat: data.jami.mat, color: "text-t-mat", icon: Wrench, border: "border-white/10", bg: "bg-white/5" },
            { id: "chel", nom: "Ish Haqi", qiymat: data.jami.chel, color: "text-blue-400", icon: HardHat, border: "border-white/10", bg: "bg-white/5" },
            { id: "mash", nom: "Mexanizm", qiymat: data.jami.mash, color: "text-purple-400", icon: Truck, border: "border-white/10", bg: "bg-white/5" },
            { id: "ob", nom: "Uskuna", qiymat: data.jami.ob, color: "text-cyan-400", icon: Server, border: "border-white/10", bg: "bg-white/5" },
            { id: "mk", nom: "Metal", qiymat: data.jami.mk, color: "text-slate-300", icon: Component, border: "border-white/10", bg: "bg-white/5" },
            { id: "kab", nom: "Kabel", qiymat: data.jami.kab, color: "text-yellow-500", icon: Zap, border: "border-white/10", bg: "bg-white/5" },
            { id: "sub", nom: "Subpodryad", qiymat: data.jami.sub, color: "text-orange-400", icon: Users, border: "border-white/10", bg: "bg-white/5" },
          ].map((kpi, idx) => (
            <motion.div key={`kpi-xar-${idx}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + idx * 0.05, duration: 0.4 }}>
              <div 
                className={`p-4 rounded-xl border ${kpi.border} ${kpi.bg} backdrop-blur-md flex flex-col items-center text-center group cursor-pointer hover:bg-white/10 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transform hover:-translate-y-1 active:translate-y-0 transition-all duration-200 h-full justify-center`}
                onClick={() => setActiveKpi({
                  nom: kpi.nom, color: kpi.color, icon: kpi.icon, total: kpi.qiymat,
                  items: data.objects.filter(o => (o as any)[kpi.id] > 0).map(o => ({ nom: o.nom, val: (o as any)[kpi.id] }))
                })}
              >
                <kpi.icon size={20} className={`${kpi.color} mb-2 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300`} />
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 group-hover:text-white transition-colors">{kpi.nom}</div>
                <div className={`text-lg font-mono font-bold ${kpi.color}`}><FmtN val={kpi.qiymat} qisqa /></div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chart va Tahlil Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.6 }}>
            <FinancialChart objects={data.objects || []} />
          </motion.div>
          
          <motion.div className="lg:col-span-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
            <ProfitAndLoss 
              jami={data.jami} 
              objects={data.objects || []} 
              onKpiClick={(kpi) => setActiveKpi(kpi)} 
            />
          </motion.div>
        </div>

        {/* AI Summary and Top Problems */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
             <div className="lg:col-span-2">
                <SmartXulosa jami={data.jami} />
             </div>
             <div className="lg:col-span-1">
                <TopList 
                  title="Top Debitorlar (Qarzlar)" 
                  icon={AlertTriangle} 
                  color="text-red-400" 
                  valKey="debitor"
                  items={[...(data.objects || [])].sort((a,b) => ((b as any).debitor||0) - ((a as any).debitor||0)).filter(o => (o as any).debitor > 0).slice(0, 4)} 
                />
             </div>
             <div className="lg:col-span-1">
                <TopList 
                  title="Eng Ko'p Ish Qolgan" 
                  icon={Clock} 
                  color="text-amber-400" 
                  valKey="qoldiq"
                  items={[...(data.objects || [])].sort((a,b) => ((b as any).qoldiq||0) - ((a as any).qoldiq||0)).filter(o => (o as any).qoldiq > 0).slice(0, 4)} 
                />
             </div>
          </div>
        </motion.div>

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

        {/* Modal Window for Clicked KPIs */}
        <AnimatePresence>
          {activeKpi && <KpiModal kpi={activeKpi} onClose={() => setActiveKpi(null)} />}
        </AnimatePresence>

      </div>
    </AuroraBackground>
  );
}
