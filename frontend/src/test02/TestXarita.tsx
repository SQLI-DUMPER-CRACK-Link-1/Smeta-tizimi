import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { sbT2ObyektlarOl, type T2Obyekt } from '../api/supabase';
import { Network, Building2, HardHat, Warehouse, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TestXarita() {
  const [params] = useSearchParams();
  const aktKomp = Number(params.get('kompaniya') || '1');
  const [obyektlar, setObyektlar] = useState<T2Obyekt[]>([]);
  const [yuklanmoqda, setYuklanmoqda] = useState(false);

  useEffect(() => {
    setYuklanmoqda(true);
    sbT2ObyektlarOl().then(r => {
      setObyektlar(r.qatorlar || []);
      setYuklanmoqda(false);
    });
  }, [aktKomp]);

  return (
    <div className="p-6 bg-zinc-950 text-white min-h-screen overflow-auto relative">
      <h1 className="text-2xl font-bold text-sky-400 flex items-center gap-2 mb-8 relative z-10">
        <Network className="text-sky-400" />
        Kompaniya Interaktiv Xaritasi (Mind Map)
      </h1>

      <div className="flex relative z-10 p-10 min-w-max">
        {/* ROOT NODE: Company */}
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }} 
          className="bg-black border border-sky-600/50 shadow-[0_0_20px_rgba(2,132,199,0.3)] rounded-2xl p-6 w-64 flex flex-col items-center justify-center relative z-20 shrink-0"
        >
          <Building2 size={40} className="text-sky-400 mb-3" />
          <h2 className="font-bold text-xl text-center">Bosh Kompaniya</h2>
          <p className="text-sky-400/80 text-sm">ID: {aktKomp}</p>
        </motion.div>

        {/* CONNECTION TO BRANCHES */}
        <div className="w-16 relative">
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-sky-600/40 -translate-y-1/2"></div>
        </div>

        {/* LEVEL 1: Objects */}
        <div className="flex flex-col gap-10 justify-center">
          {yuklanmoqda && <div className="text-zinc-500 animate-pulse">Yuklanmoqda...</div>}
          
          {obyektlar.map((ob, idx) => (
            <div key={idx} className="flex items-center gap-6 relative">
              {/* Object Node */}
              <motion.div 
                initial={{ x: -50, opacity: 0 }} 
                animate={{ x: 0, opacity: 1 }} 
                transition={{ delay: idx * 0.1 }}
                className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-56 relative z-20 hover:border-sky-500 transition-colors shadow-lg cursor-pointer group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"><HardHat size={20}/></div>
                  <h3 className="font-bold text-zinc-100 group-hover:text-sky-400 transition-colors">{ob.nom}</h3>
                </div>
                <p className="text-xs text-zinc-500 line-clamp-1">{ob.tur || "Tavsif yo'q"}</p>
              </motion.div>

              <div className="w-10 relative">
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-zinc-700 -translate-y-1/2"></div>
              </div>

              {/* LEVEL 2: Leaves (Sklad, Smeta, etc) */}
              <div className="flex flex-col gap-3">
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.1 + 0.1 }}
                  className="bg-black border border-zinc-800 rounded p-2 text-sm text-zinc-300 flex items-center gap-2 hover:bg-zinc-900 cursor-pointer"
                >
                  <Warehouse size={16} className="text-amber-400"/> Obyekt Skladi
                </motion.div>
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.1 + 0.2 }}
                  className="bg-black border border-zinc-800 rounded p-2 text-sm text-zinc-300 flex items-center gap-2 hover:bg-zinc-900 cursor-pointer"
                >
                  <FileText size={16} className="text-indigo-400"/> Asosiy Smeta
                </motion.div>
                <motion.div 
                  initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: idx * 0.1 + 0.3 }}
                  className="bg-black border border-zinc-800 rounded p-2 text-sm text-zinc-300 flex items-center gap-2 hover:bg-zinc-900 cursor-pointer"
                >
                  <Network size={16} className="text-rose-400"/> F2 (Bajarilgan ishlar)
                </motion.div>
              </div>
            </div>
          ))}

          {obyektlar.length === 0 && !yuklanmoqda && (
             <div className="bg-zinc-900 border border-zinc-800 rounded p-4 text-zinc-500 italic">Obyektlar mavjud emas</div>
          )}
        </div>
      </div>
      
    </div>
  );
}


