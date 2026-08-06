import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHolat, useObyektlar, useLockAcquire, useLockRelease, useLockStatus, useHolatSaqla, useBlQosh, useRsQosh, useBossData } from '../../api/hooks';
import type { Edit, TreeNode } from '../../api/types';
import { SmetaTree } from '../../umumiy/daraxt/SmetaTree';
import { Skeleton } from '../../umumiy/ui/Skeleton';
import { SaveModal } from '../../umumiy/ui/SaveModal';
import { ZamenaModal } from '../../umumiy/ui/ZamenaModal';
import { toast } from '../../umumiy/ui/Toast';
import { Edit3, Eye, ArrowLeft, CloudRain, HardHat, TrendingUp, TrendingDown, Gauge, Activity, Loader2, Building2 } from 'lucide-react';
import { yangiUid } from '../../_shared/idempotent';
import { AuroraBackground, GlassCard } from '../../boss/sahifalar/Umumiy';
import { FmtN } from '../../lib/format';
import { motion, AnimatePresence } from 'framer-motion';

export type EditState = {
  edit: Edit;
  node: TreeNode;
};

export function Holat() {
  const navigate = useNavigate();
  const { data: obyektlar, isLoading: isObyektlarLoading } = useObyektlar();
  const { data: bossData } = useBossData();
  const [selectedObyekt, setSelectedObyekt] = useState<string>('');
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
  const [isZamenaModalOpen, setIsZamenaModalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<TreeNode | null>(null);
  const [dragTarget, setDragTarget] = useState<TreeNode | null>(null);

  const { id: yoldagiObyekt } = useParams<{ id: string }>();
  useEffect(() => {
    if (yoldagiObyekt) {
      const nom = decodeURIComponent(yoldagiObyekt);
      if (nom !== selectedObyekt) setSelectedObyekt(nom);
      return;
    }
    if (!selectedObyekt && obyektlar?.length) setSelectedObyekt(obyektlar[0].obyekt);
  }, [yoldagiObyekt, obyektlar, selectedObyekt]);

  const { data: holatData, isLoading: isHolatLoading, error } = useHolat(selectedObyekt);
  const { data: lockStatus } = useLockStatus(selectedObyekt);
  const { mutateAsync: acquireLock } = useLockAcquire();
  const { mutateAsync: releaseLock } = useLockRelease();
  const saqla = useHolatSaqla(selectedObyekt);
  const blQosh = useBlQosh();
  const rsQosh = useRsQosh();

  useEffect(() => {
    if (!saqla.isPending) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saqla.isPending]);

  useEffect(() => {
    setIsEditMode(false);
    setEdits({});
  }, [selectedObyekt]);

  useEffect(() => {
    return () => {
      if (isEditMode && selectedObyekt) {
        releaseLock({ obyekt: selectedObyekt, reason: 'Sahifa yopildi' }).catch(console.error);
      }
    };
  }, [isEditMode, selectedObyekt, releaseLock]);

  const toggleEditMode = async () => {
    if (isEditMode) {
      setIsEditMode(false);
      setEdits({});
      await releaseLock({ obyekt: selectedObyekt, reason: 'Tahrirlash yakunlandi' });
    } else {
      if (lockStatus?.status === 'locked') {
        toast(`Obyekt band: ${lockStatus.user}`, 'danger');
        return;
      }
      try {
        await acquireLock({ obyekt: selectedObyekt, reason: 'Smeta tahrirlash' });
        setIsEditMode(true);
      } catch (err: any) {
        toast('Band qilishda xatolik: ' + err.message, 'danger');
      }
    }
  };

  const handleSave = async () => {
    const editsToSave = Object.values(edits).map(e => e.edit);
    if (editsToSave.length === 0) return;
    
    const orqaga = editsToSave.map(e => {
       const n = holatData?.tree?.find(t => t.varaq === e.varaq && t.row === e.row);
       return { ...e, fakt: n?.fakt };
    });

    try {
      const r = await saqla.mutateAsync(editsToSave);
      toast(`Muvaffaqiyatli saqlandi: ${r.qatorlar} qator`, 'ok', async () => {
         try {
           await saqla.mutateAsync(orqaga);
           toast('O\'zgarishlar bekor qilindi', 'ok');
         } catch(e: any) {
           toast('Bekor qilishda xatolik: ' + e.message, 'danger');
         }
      });
      setIsSaveModalOpen(false);
      setEdits({});
      setIsEditMode(false);
      await releaseLock({ obyekt: selectedObyekt, reason: 'Saqlash yakunlandi' });
    } catch (err: any) {
      toast(`Saqlashda xatolik: ${err.message}`, 'danger');
    }
  };

  const handleNodeDrop = (source: TreeNode, target?: TreeNode) => {
    setDragSource(source);
    setDragTarget(target || null);
    setIsZamenaModalOpen(true);
  };

  const handleZamenaConfirm = async () => {
    if (!dragSource || !dragSource.varaq || !dragSource.row) return;
    
    try {
      const isIsh = dragSource.type === 'bl';
      const isZamena = !!dragTarget;
      const f2Uid = yangiUid();
      
      const payload: any = {
        obyekt: selectedObyekt,
        varaq: dragSource.varaq,
        afterRow: dragTarget?.row || dragSource.row,
        nom: dragSource.nom,
        kod: dragSource.kod,
        birlik: dragSource.birlik,
        hajm: dragSource.smetaHajm,
        tur: dragSource.type,
        f2Uid: f2Uid,
      };

      if (isZamena) {
        payload.zamena = true;
        payload.droppedOnRow = dragTarget.row;
      }

      let newRow: number;
      if (isIsh) {
        newRow = await blQosh.mutateAsync(payload);
        if (dragSource.children) {
          for (const child of dragSource.children) {
            await rsQosh.mutateAsync({
              obyekt: selectedObyekt,
              varaq: dragSource.varaq,
              blRow: newRow,
              nom: child.nom,
              kod: child.kod,
              birlik: child.birlik,
              narx: child.narx,
              norm: child.smetaHajm, 
              f: child.fakt,
              f2Uid: yangiUid(),
            });
          }
        }
      } else {
        await rsQosh.mutateAsync({
          obyekt: selectedObyekt,
          varaq: dragSource.varaq,
          blRow: dragTarget?.row || dragSource.row,
          nom: dragSource.nom,
          kod: dragSource.kod,
          birlik: dragSource.birlik,
          narx: dragSource.narx,
          norm: dragSource.smetaHajm,
          f: dragSource.fakt,
          f2Uid: yangiUid(),
        });
      }

      toast("Qo'shish muvaffaqiyatli bajarildi!", 'ok');
      setIsZamenaModalOpen(false);
      setDragSource(null);
      setDragTarget(null);
      
    } catch (err: any) {
      toast("Xatolik: " + err.message, 'danger');
    }
  };

  const stats = useMemo(() => {
    if (!bossData || !selectedObyekt) return null;
    const baseName = selectedObyekt.split(' - ')[0].toLowerCase();
    for (const sh of bossData.objects || []) {
      if (sh.nom.toLowerCase() === baseName) return sh;
      if (sh.subItems) {
         const found = sh.subItems.find((s: any) => s.nom.toLowerCase() === baseName);
         if (found) return found;
      }
    }
    return null;
  }, [bossData, selectedObyekt]);

  // 🏗️ Daraxtni D1, D2, D3 bo'yicha guruhlash
  const groupedTree = useMemo(() => {
    if (!holatData?.tree) return [];
    
    const rootNodes: TreeNode[] = [];
    const pathMap: Record<string, TreeNode> = {};

    holatData.tree.forEach((rz) => {
      if (rz.type !== 'rz') {
        rootNodes.push(rz);
        return;
      }
      
      let currentParentList = rootNodes;
      let currentPath = '';

      const addLevel = (levelVal: string | undefined) => {
        if (!levelVal) return;
        const p = currentPath ? `${currentPath}||${levelVal}` : levelVal;
        currentPath = p;
        if (!pathMap[p]) {
          const newNode: TreeNode = {
            type: 'rz',
            nom: levelVal,
            children: [],
          };
          pathMap[p] = newNode;
          currentParentList.push(newNode);
        }
        currentParentList = pathMap[p].children!;
      };

      addLevel(rz.d1);
      addLevel(rz.d2);
      addLevel(rz.d3);
      
      currentParentList.push(rz);
    });

    return rootNodes;
  }, [holatData?.tree]);

  const evm = useMemo(() => {
    if (!stats) return { pv: 0, ev: 0, ac: 0, spi: 0, cpi: 0 };
    const pv = stats.smeta || 1; // Planned Value
    const ev = stats.f2 || 0;    // Earned Value
    const ac = stats.fakt || 0;  // Actual Cost
    const spi = pv > 0 ? (ev / pv) : 0; // Schedule Performance Index
    const cpi = ac > 0 ? (ev / ac) : 1; // Cost Performance Index
    return { pv, ev, ac, spi, cpi };
  }, [stats]);

  return (
    <AuroraBackground>
      <div className="max-w-[1800px] w-full mx-auto p-4 md:p-6 flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        
        {/* Header & Controls */}
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 mb-6 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/obyektlar')} className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 transition-colors backdrop-blur-md">
              <ArrowLeft size={24} />
            </button>
            <div>
              <motion.h1 
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                className="text-3xl md:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-300 to-amber-500 tracking-tight drop-shadow-[0_0_15px_rgba(251,191,36,0.4)] flex items-center gap-3"
              >
                Loyiha Boshqaruvi
              </motion.h1>
              <div className="text-slate-300 text-sm mt-1 flex items-center gap-3 font-medium">
                <span className="bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded text-xs border border-yellow-500/30 font-bold uppercase tracking-widest">BIM / EVM</span>
                Smeta Holati va Konstruktiv Nazorat
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-black/40 p-3 rounded-2xl border border-white/10 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
              <CloudRain size={20} className="text-blue-400" />
              <div>
                <div className="text-white font-bold text-sm">Yomg'irli, 12°C</div>
                <div className="text-slate-400 text-[10px] uppercase">Obyekt iqlimi</div>
              </div>
            </div>
            <div className="flex items-center gap-3 pr-4 border-r border-white/10">
              <HardHat size={20} className="text-yellow-400" />
              <div>
                <div className="text-white font-bold text-sm">45 Ishchi · 8 Texnika</div>
                <div className="text-slate-400 text-[10px] uppercase">Resurs holati</div>
              </div>
            </div>
            
            {isObyektlarLoading ? (
               <Skeleton className="h-10 w-48 rounded-xl bg-white/5" />
            ) : (
              <select 
                value={selectedObyekt} 
                onChange={e => setSelectedObyekt(e.target.value)}
                disabled={isEditMode}
                className="h-10 px-4 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-medium outline-none focus:border-yellow-500/50 appearance-none min-w-[200px] cursor-pointer"
              >
                {obyektlar?.map(obj => (
                  <option key={obj.obyekt} value={obj.obyekt} className="bg-slate-800 text-white">{obj.obyekt}</option>
                ))}
              </select>
            )}

            {selectedObyekt && (
              <button
                onClick={toggleEditMode}
                disabled={isHolatLoading}
                className={`h-10 px-5 inline-flex items-center gap-2 rounded-xl text-sm font-bold transition-all shadow-lg ${
                  isEditMode 
                    ? 'bg-yellow-500 text-black hover:bg-yellow-400 hover:shadow-yellow-500/25' 
                    : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {isEditMode ? <><Eye size={18} /> Rejim: Ko'rish</> : <><Edit3 size={18} /> Rejim: Tahrirlash</>}
              </button>
            )}
          </div>
        </header>

        {/* 🏗️ EVM Dashboards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 flex-shrink-0">
          <GlassCard className="p-4 border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
             <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Planned Value (PV)</div>
             <div className="text-xl font-mono font-bold text-white"><FmtN val={evm.pv} qisqa /></div>
             <div className="text-xs text-slate-500 mt-1">Smeta (Reja) Qiymati</div>
          </GlassCard>
          
          <GlassCard className="p-4 border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent">
             <div className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-1">Earned Value (EV)</div>
             <div className="text-xl font-mono font-bold text-emerald-400"><FmtN val={evm.ev} qisqa /></div>
             <div className="text-xs text-emerald-500/60 mt-1">Bajarilgan F-2</div>
          </GlassCard>
          
          <GlassCard className="p-4 border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-transparent">
             <div className="text-orange-400 text-[10px] font-bold uppercase tracking-widest mb-1">Actual Cost (AC)</div>
             <div className="text-xl font-mono font-bold text-orange-400"><FmtN val={evm.ac} qisqa /></div>
             <div className="text-xs text-orange-500/60 mt-1">Haqiqiy Xarajat</div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-white/10 relative overflow-hidden">
             <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Schedule Perf. (SPI)</div>
             <div className="flex items-end justify-between z-10">
               <div className={`text-2xl font-mono font-bold ${evm.spi >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                 {evm.spi.toFixed(2)}
               </div>
               {evm.spi >= 1 ? <TrendingUp size={24} className="text-emerald-500/50 mb-1" /> : <TrendingDown size={24} className="text-red-500/50 mb-1" />}
             </div>
             <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4"><Gauge size={80} /></div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border-white/10 relative overflow-hidden">
             <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Cost Perf. (CPI)</div>
             <div className="flex items-end justify-between z-10">
               <div className={`text-2xl font-mono font-bold ${evm.cpi >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                 {evm.cpi.toFixed(2)}
               </div>
               {evm.cpi >= 1 ? <Activity size={24} className="text-emerald-500/50 mb-1" /> : <TrendingDown size={24} className="text-red-500/50 mb-1" />}
             </div>
             <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4"><Gauge size={80} /></div>
          </GlassCard>
        </div>

        {/* Edit State Banner */}
        <AnimatePresence>
          {isEditMode && Object.keys(edits).length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 flex-shrink-0">
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex items-center justify-between backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500 animate-pulse">
                    <Edit3 size={20} />
                  </div>
                  <div>
                    <div className="text-yellow-400 font-bold">{Object.keys(edits).length} ta qator o'zgartirildi</div>
                    <div className="text-yellow-500/70 text-xs mt-0.5">Smeta parametrlariga aralashuv qayd etildi</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEdits({})} className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-lg transition-colors">Bekor qilish</button>
                  <button onClick={() => setIsSaveModalOpen(true)} className="px-6 py-2 text-sm font-bold text-black bg-yellow-500 hover:bg-yellow-400 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all active:scale-95">
                    Saqlash va Yopish
                  </button>
                </div>
              </div>
            </motion.div>
          )}
          
          {lockStatus?.status === 'locked' && !isEditMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4 flex-shrink-0">
               <div className="bg-red-500/10 border border-red-500/20 px-5 py-3 rounded-xl flex items-center gap-3 backdrop-blur-md">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></div>
                  <span className="text-sm text-red-200">
                    <strong className="text-white mr-1">{lockStatus.user || 'Boshqa muhandis'}</strong> 
                    hozirda ushbu smetani tahrirlamoqda. Obyekt band.
                  </span>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Smeta Tree Area */}
        <GlassCard className="flex-1 min-h-0 flex flex-col border-white/10 bg-black/40 overflow-hidden relative rounded-2xl">
          {/* Subtle blueprint grid overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

          {!selectedObyekt ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 relative z-10">
              <Building2 size={64} className="mb-4 opacity-50" />
              <p className="font-medium text-lg">Loyiha tanlanmagan</p>
            </div>
          ) : isHolatLoading ? (
            <div className="flex-1 p-6 relative z-10">
               <div className="flex flex-col items-center justify-center h-full gap-4 text-yellow-500/70">
                 <Loader2 size={48} className="animate-spin" />
                 <p className="font-medium font-mono uppercase tracking-widest text-sm">BIM Struktura Yuklanmoqda...</p>
               </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-6 relative z-10">
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-2xl max-w-lg text-center backdrop-blur-md">
                <p className="font-bold mb-2">Ma'lumotlarni o'qishda xatolik</p>
                <p className="text-sm opacity-80">{error.message}</p>
              </div>
            </div>
          ) : holatData?.tree ? (
            <div className="flex-1 min-h-0 relative z-10">
              {/* SmetaTree componentini o'zgartirmasdan ishlatamiz, lekin tashqarisi qorong'u rejimga moslashadi */}
              <SmetaTree 
                data={groupedTree} 
                isEditMode={isEditMode}
                edits={edits}
                setEdits={setEdits}
                onNodeDrop={handleNodeDrop}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 relative z-10">
              <p className="font-medium text-lg">Smeta ma'lumotlari topilmadi</p>
            </div>
          )}
        </GlassCard>
      </div>
      
      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSave}
        edits={edits}
        isSaving={saqla.isPending}
        obyekt={selectedObyekt}
      />

      <ZamenaModal
        isOpen={isZamenaModalOpen}
        onClose={() => {
          setIsZamenaModalOpen(false);
          setDragSource(null);
          setDragTarget(null);
        }}
        onConfirm={handleZamenaConfirm}
        source={dragSource}
        target={dragTarget}
        isSaving={blQosh.isPending || rsQosh.isPending}
      />
    </AuroraBackground>
  );
}

export default Holat;
