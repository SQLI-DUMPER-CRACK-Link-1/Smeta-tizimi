import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { Building2, HardHat, Warehouse, FileText, Pickaxe, Map, ZoomIn, ZoomOut, Maximize, Briefcase, Users, Settings, Calculator } from 'lucide-react';
import { sbT2ObyektlarOl, type T2Obyekt } from '../api/supabase';

export default function TestXarita() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scale = useMotionValue(1);
  const smoothScale = useSpring(scale, { damping: 20, stiffness: 200 });

  useEffect(() => {
    setYuklanmoqda(true);
    sbT2ObyektlarOl().then(r => {
      setObyektlar(r.qatorlar || []);
      setYuklanmoqda(false);
    });
  }, [aktKomp]);

  const handleZoom = (amount: number) => {
    scale.set(Math.min(Math.max(scale.get() + amount, 0.3), 3));
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY > 0) {
      handleZoom(-0.1);
    } else {
      handleZoom(0.1);
    }
  };

  const nav = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(path);
  };

  const obHeight = 240;
  const obGap = 40;     
  const stepY = obHeight + obGap;
  const hqHeight = 140;

  const globalModules = [
    { nomi: 'Buxgalteriya', icon: Calculator, color: 'text-emerald-600', path: '/admin/test/tolovlar' },
    { nomi: 'Kompaniya HR', icon: Users, color: 'text-blue-500', path: '/admin/test/ishchilar' },
    { nomi: 'Sozlamalar', icon: Settings, color: 'text-slate-500', path: '/admin/test/sozlamalar' },
  ];
  const hqTotalHeight = globalModules.length * 44;
  const totalHeight = obyektlar.length * obHeight + Math.max(0, obyektlar.length - 1) * obGap;
  const rootCenterY = Math.max(totalHeight / 2, hqHeight / 2);

  return (
    <div 
      className="w-full h-full bg-bg relative overflow-hidden flex flex-col font-sans" 
      ref={containerRef}
      onWheel={handleWheel}
    >
      
      {/* Top Bar */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 bg-bg/80 backdrop-blur-sm border-b border-border">
        <h1 className="text-xl font-bold text-text flex items-center gap-2">
          <Map className="text-accent" />
          Kompaniya Strukturasi (Mind Map)
        </h1>
        <div className="flex gap-2 bg-surface border border-border p-1 rounded-lg">
          <button onClick={() => handleZoom(-0.2)} className="p-2 hover:bg-surface-2 text-text rounded"><ZoomOut size={18}/></button>
          <button onClick={() => scale.set(1)} className="p-2 hover:bg-surface-2 text-text rounded"><Maximize size={18}/></button>
          <button onClick={() => handleZoom(0.2)} className="p-2 hover:bg-surface-2 text-text rounded"><ZoomIn size={18}/></button>
        </div>
      </div>

      {/* Floating Canvas */}
      <motion.div 
        drag 
        dragElastic={0.1}
        className="absolute top-0 left-0 w-[5000px] h-[5000px] cursor-grab active:cursor-grabbing flex items-center justify-center"
        style={{ scale: smoothScale, x: -2500 + (window.innerWidth/2) - 400, y: -2500 + (window.innerHeight/2) }}
      >
        
        {/* Graph Layout using Flexbox */}
        <div className="flex items-center gap-20 relative">
          
          {/* HQ Global Modules (Left of HQ) */}
          <div className="flex flex-col gap-2 relative z-20 w-48 items-end">
            {globalModules.map((m, i) => (
               <div key={i} onClick={(e) => nav(m.path, e)} className="h-[36px] px-3 bg-bg border border-border hover:border-accent/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm transition-all w-full justify-between">
                 <span className="font-medium truncate group-hover:text-accent">{m.nomi}</span>
                 <m.icon size={16} className={m.color} /> 
               </div>
            ))}
          </div>

          {/* SVG Connectors for HQ Submodules */}
          <svg className="absolute left-[192px] top-1/2 -translate-y-1/2 w-20 pointer-events-none z-0" style={{ height: Math.max(hqHeight, hqTotalHeight) }}>
            {globalModules.map((_, i) => {
              const startY = hqHeight / 2;
              const endY = i * 44 + 18 + (Math.max(hqHeight, hqTotalHeight) / 2 - hqTotalHeight / 2);
              return (
                 <path key={i} d={`M 80 ${startY} C 40 ${startY}, 40 ${endY}, 0 ${endY}`} fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
              );
            })}
          </svg>

          {/* ROOT */}
          <div className="relative z-20">
            <motion.div 
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="w-72 bg-surface border-2 border-accent/50 shadow-[0_0_30px_rgba(var(--accent-rgb),0.3)] p-6 rounded-2xl flex flex-col items-center justify-center text-center relative h-[140px]"
            >
              <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mb-4">
                <Building2 size={32} className="text-accent" />
              </div>
              <h2 className="text-2xl font-black text-text mb-1">Bosh Kompaniya</h2>
              <span className="text-sm font-medium px-3 py-1 bg-surface-2 text-text-dim rounded-full">Boshqaruv Markazi</span>
            </motion.div>
          </div>

          {/* SVG Connector Lines from Root to Children */}
          <svg className="absolute left-[560px] top-1/2 -translate-y-1/2 w-20 pointer-events-none z-0" style={{ height: Math.max(totalHeight, 1) }}>
            {obyektlar.map((_, i) => {
              const startY = rootCenterY;
              const endY = i * stepY + obHeight / 2;
              return (
                 <path key={i} d={`M 0 ${startY} C 40 ${startY}, 40 ${endY}, 80 ${endY}`} fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
              );
            })}
          </svg>

          {/* CHILDREN */}
          <div className="flex flex-col gap-10 relative z-20" style={{ minHeight: totalHeight }}>
            {yuklanmoqda && <div className="text-text-dim animate-pulse">Yuklanmoqda...</div>}

            {obyektlar.map((ob, idx) => (
              <motion.div 
                key={ob.id}
                initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-16 relative h-[240px]"
              >
                {/* Object Node */}
                <div 
                  onClick={(e) => nav('/admin/test/daraxt?obyekt=' + encodeURIComponent(ob.nom), e)}
                  className="w-64 bg-surface border border-border hover:border-accent p-4 rounded-xl shadow-lg relative z-20 cursor-pointer group transition-all hover:-translate-y-1"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-500">
                      <HardHat size={20} />
                    </div>
                    <h3 className="font-bold text-text group-hover:text-accent truncate" title={ob.nom}>{ob.nom}</h3>
                  </div>
                  <p className="text-xs text-text-dim truncate">{ob.tur || 'Qurilish obyekti'}</p>
                </div>

                {/* SVG Connectors to Sub-modules */}
                <svg className="absolute left-[256px] top-0 w-16 h-full pointer-events-none z-0">
                   <path d="M 0 120 C 32 120, 32 32, 64 32" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                   <path d="M 0 120 C 32 120, 32 76, 64 76" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                   <path d="M 0 120 C 32 120, 32 120, 64 120" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                   <path d="M 0 120 C 32 120, 32 164, 64 164" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                   <path d="M 0 120 C 32 120, 32 208, 64 208" fill="none" stroke="currentColor" strokeWidth="2" className="text-border" />
                </svg>

                {/* Sub-modules */}
                <div className="flex flex-col gap-2 relative z-20 w-48 mt-[14px]">
                  <div onClick={(e) => nav('/admin/test/sklad?obyektId=' + ob.id, e)} className="h-[36px] px-3 bg-bg border border-border hover:border-amber-500/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-amber-500/10 transition-all">
                    <Warehouse size={16} className="text-amber-500" /> 
                    <span className="group-hover:text-amber-500 font-medium truncate">Sklad / Ta'minot</span>
                  </div>
                  <div onClick={(e) => nav('/admin/test/daraxt?obyekt=' + encodeURIComponent(ob.nom), e)} className="h-[36px] px-3 bg-bg border border-border hover:border-indigo-500/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-indigo-500/10 transition-all">
                    <FileText size={16} className="text-indigo-500" /> 
                    <span className="group-hover:text-indigo-500 font-medium truncate">Asosiy Smeta</span>
                  </div>
                  <div onClick={(e) => nav('/admin/test/f2?obyekt=' + encodeURIComponent(ob.nom), e)} className="h-[36px] px-3 bg-bg border border-border hover:border-rose-500/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-rose-500/10 transition-all">
                    <Pickaxe size={16} className="text-rose-500" /> 
                    <span className="group-hover:text-rose-500 font-medium truncate">F2 Fakt Aktlar</span>
                  </div>
                  <div onClick={(e) => nav('/admin/test/shartnomalar?obyekt=' + encodeURIComponent(ob.nom), e)} className="h-[36px] px-3 bg-bg border border-border hover:border-fuchsia-500/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-fuchsia-500/10 transition-all">
                    <Briefcase size={16} className="text-fuchsia-500" /> 
                    <span className="group-hover:text-fuchsia-500 font-medium truncate">Shartnomalar</span>
                  </div>
                  <div onClick={(e) => nav('/admin/test/hr?obyekt=' + encodeURIComponent(ob.nom), e)} className="h-[36px] px-3 bg-bg border border-border hover:border-sky-500/50 rounded-lg text-sm text-text flex items-center gap-2 cursor-pointer group shadow-sm hover:shadow-sky-500/10 transition-all">
                    <Users size={16} className="text-sky-500" /> 
                    <span className="group-hover:text-sky-500 font-medium truncate">HR / Ishchilar</span>
                  </div>
                </div>
              </motion.div>
            ))}

            {!yuklanmoqda && obyektlar.length === 0 && (
              <div className="p-6 bg-surface border border-border rounded-xl text-text-dim text-center shadow-lg w-64 mt-12 mx-auto">
                Obyektlar mavjud emas.<br/>Import qiling.
              </div>
            )}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
