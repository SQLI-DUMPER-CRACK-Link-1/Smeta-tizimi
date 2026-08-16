import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHolat, useObyektlar, useHolatSaqla, useBossData, useBlQosh, useRsQosh } from '../../api/hooks';
import type { Edit, TreeNode } from '../../api/types';
import { SmetaTree } from '../../umumiy/daraxt/SmetaTree';
import { Skeleton } from '../../umumiy/ui/Skeleton';
import { SaveModal } from '../../umumiy/ui/SaveModal';
import { ZamenaModal } from '../../umumiy/ui/ZamenaModal';
import { toast } from '../../umumiy/ui/Toast';
import { Edit3, ArrowLeft, Loader2, Building2, Save, TrendingUp, ChevronDown } from 'lucide-react';
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
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const hasEdits = Object.keys(edits).length > 0;
  
  const [isZamenaModalOpen, setIsZamenaModalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<TreeNode | null>(null);
  const [dragTarget, setDragTarget] = useState<TreeNode | null>(null);

  const { id: yoldagiObyekt } = useParams<{ id: string }>();
  /* ⚡⚡⚡ 2026-08-16 URL QULFI TUZATILDI (audit C2 — TASDIQLANDI).
   *
   * Effekt bog'liqliklarida `selectedObyekt` bor edi. Ya'ni foydalanuvchi
   * ro'yxatdan BOSHQA obyekt tanlasa → `selectedObyekt` o'zgaradi →
   * effekt QAYTA ishlaydi → uni DARHOL URL dagi obyektga qaytarib
   * tashlaydi. Natijada sahifada obyektni umuman almashtirib bo'lmasdi
   * (URL bilan kirilgan bo'lsa).
   *
   * ENDI: URL dagi obyekt FAQAT URL o'zgarganda qo'llanadi
   * (`yoldagiObyekt` deps da, `selectedObyekt` YO'Q). Birinchi obyektni
   * tanlash esa alohida effektda, faqat hali hech narsa tanlanmagan
   * bo'lsa ishlaydi. */
  useEffect(() => {
    if (yoldagiObyekt && obyektlar?.some(o => o.obyekt === yoldagiObyekt)) {
      setSelectedObyekt(yoldagiObyekt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yoldagiObyekt, obyektlar]);

  useEffect(() => {
    if (!selectedObyekt && obyektlar?.length) setSelectedObyekt(obyektlar[0].obyekt);
  }, [obyektlar, selectedObyekt]);

  const { data: holatData, isLoading: isHolatLoading, error } = useHolat(selectedObyekt);
  const saqla = useHolatSaqla(selectedObyekt);
  const blQosh = useBlQosh();
  const rsQosh = useRsQosh();

  useEffect(() => {
    if (!saqla.isPending) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saqla.isPending]);

  const handleSave = async () => {
    const editsToSave = Object.values(edits).map(e => {
      const payload: any = { ...e.edit };
      if (payload.f2) {
        payload.oylar = payload.f2;
        delete payload.f2;
      }
      return payload;
    });
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

      const addLevel = (levelVal?: string) => {
        if (!levelVal || levelVal === '-') return;
        const p = currentPath ? `${currentPath}||${levelVal}` : levelVal;
        currentPath = p;
        if (!pathMap[p]) {
          const synthVaraq = `synth_${p}`;
          const synthRow = Object.keys(pathMap).length + 1;
          const newNode = { 
            type: 'rz', nom: levelVal, children: [],
            varaq: synthVaraq, row: synthRow,
            smetaHajm: 0, fakt: 0, f2ol: 0, qoldiq: 0, f2mum: 0,
            smeta: 0, stFakt: 0, stF2: 0, stOst: 0 
          } as unknown as TreeNode;
          pathMap[p] = newNode;
          currentParentList.push(newNode);
        }
        
        pathMap[p].smetaHajm! += (rz.smetaHajm || 0);
        pathMap[p].fakt! += (rz.fakt || 0);
        pathMap[p].f2ol! += (rz.f2ol || 0);
        pathMap[p].qoldiq! += (rz.qoldiq || 0);
        pathMap[p].f2mum! += (rz.f2mum || 0);
        pathMap[p].smeta! += (rz.smeta || 0);
        pathMap[p].stFakt! += (rz.stFakt || (rz.fakt || 0) * (rz.narx || 0));
        pathMap[p].stF2! += (rz.stF2 || 0);
        pathMap[p].stOst! += (rz.stOst || (rz.qoldiq || 0) * (rz.narx || 0));

        currentParentList = pathMap[p].children!;
      };

      addLevel(rz.d1);
      addLevel(rz.d2);
      addLevel(rz.d3);
      currentParentList.push(rz);
    });
    return rootNodes;
  }, [holatData?.tree]);
  const { jami, oylar } = holatData || {};

  const catStats = useMemo(() => {
    const s = {
      chel: { stFakt: 0, stF2: 0 },
      mash: { stFakt: 0, stF2: 0 },
      mat: { stFakt: 0, stF2: 0 },
      ob: { stFakt: 0, stF2: 0 },
    };
    if (!holatData?.tree) return s;
    const traverse = (nodes: any[]) => {
      nodes.forEach(n => {
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        } else {
          if (n.type === 'rs' || n.type === 'mat' || n.type === 'ob') {
            let cat = 'chel';
            const rkat = (n.kat || '').toUpperCase();
            if (n.type === 'ob' || rkat.includes('ОБ') || rkat.includes('OB')) cat = 'ob';
            else if (n.type === 'mat' || rkat.includes('МАТ') || rkat.includes('MAT')) cat = 'mat';
            else if (rkat.includes('МАШ') || rkat.includes('MASH')) cat = 'mash';
            else if (rkat.includes('ЧЕЛ') || rkat.includes('CHEL')) cat = 'chel';
            
            s[cat as keyof typeof s].stFakt += (n.stFakt || ((n.fakt || 0) * (n.narx || 0)));
            s[cat as keyof typeof s].stF2 += (n.stF2 || 0);
          }
        }
      });
    };
    traverse(holatData.tree);
    return s;
  }, [holatData?.tree]);

  const evm = useMemo(() => {
    if (!stats) return { pv: 0, ev: 0, ac: 0, spi: 0, cpi: 0 };
    const pv = stats.smeta || 1;
    const ev = stats.f2 || 0;
    const ac = stats.fakt || 0;
    const spi = pv > 0 ? (ev / pv) : 0;
    const cpi = ac > 0 ? (ev / ac) : 1;
    return { pv, ev, ac, spi, cpi };
  }, [stats]);

  const [showNakrutka, setShowNakrutka] = useState(false);

  return (
    <AuroraBackground>
      <div className="max-w-[1800px] w-full mx-auto p-4 md:p-6 flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        
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
            {isObyektlarLoading ? (
               <Skeleton className="h-10 w-48 rounded-xl bg-white/5" />
            ) : (
              <div className="flex gap-2">
                <select 
                  value={selectedObyekt} 
                  onChange={e => setSelectedObyekt(e.target.value)}
                  className="bg-black/50 border border-white/10 text-white rounded-xl px-4 h-10 outline-none focus:border-yellow-500/50 appearance-none font-medium shadow-inner min-w-[250px]"
                >
                  <option value="">-- Obyektni tanlang --</option>
                  {obyektlar?.map(o => (
                    <option key={o.obyekt} value={o.obyekt}>{o.obyekt}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </header>

        <div className="grid grid-cols-3 gap-4 mb-6 flex-shrink-0">
          <GlassCard className="p-4 border-white/10 bg-gradient-to-br from-white/[0.05] to-transparent">
             <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Smeta Jami</div>
             <div className="text-xl font-mono font-bold text-white"><FmtN val={evm.pv} /></div>
             <div className="text-slate-500 text-[10px] mt-2">Smeta (Reja) Qiymati</div>
          </GlassCard>
          <GlassCard className="p-4 border-white/10 bg-gradient-to-br from-emerald-500/[0.05] to-transparent">
             <div className="text-emerald-500/70 text-[10px] font-bold uppercase tracking-widest mb-1">F2 Jami</div>
             <div className="text-xl font-mono font-bold text-emerald-400"><FmtN val={evm.ev} /></div>
             <div className="text-emerald-500/40 text-[10px] mt-2">Bajarilgan F-2 Summasi</div>
          </GlassCard>
          <GlassCard className="p-4 border-white/10 bg-gradient-to-br from-amber-500/[0.05] to-transparent">
             <div className="text-amber-500/70 text-[10px] font-bold uppercase tracking-widest mb-1">Fakt Jami</div>
             <div className="text-xl font-mono font-bold text-amber-500"><FmtN val={evm.ac} /></div>
             <div className="text-amber-500/40 text-[10px] mt-2">Haqiqiy Xarajat</div>
          </GlassCard>
        </div>

        {/* Nakrutka Jami jadvali */}
        {jami && (
          <div className="mb-6 flex-shrink-0">
            <button 
              onClick={() => setShowNakrutka(!showNakrutka)}
              className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors backdrop-blur-md text-sm font-bold text-slate-300"
            >
              <div className="flex items-center gap-2 text-cyan-400">
                <TrendingUp size={18} />
                Nakrutka - barcha xarajatlar jami
              </div>
              <ChevronDown size={18} className={`transition-transform duration-300 ${showNakrutka ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {showNakrutka && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }} 
                  animate={{ height: 'auto', opacity: 1 }} 
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                    <table className="w-full text-left text-sm text-slate-300">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-500 uppercase tracking-wider text-[10px]">
                          <th className="pb-2">Pozitsiya</th>
                          <th className="pb-2 text-right">Smeta (Asl)</th>
                          <th className="pb-2 text-right">Fakt</th>
                          <th className="pb-2 text-right">F2 olingan</th>
                          <th className="pb-2 text-right">Qoldiq</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[13px]">
                        {[
                          { lbl: 'ZATRATY TRUDA (chel)', v: 'chel' },
                          { lbl: 'ZATRATY MASHIN (mash)', v: 'mash' },
                          { lbl: 'MATERIALY (mat)', v: 'mat' },
                          { lbl: 'OBORUDOVANIE (ob)', v: 'ob' },
                          { lbl: 'ITOGO PRYAMYE ZATRATY (Jami)', v: 'stSm' }
                        ].map((row, i) => {
                          const sm = i === 4 ? (jami.stSm || 0) : (jami as any)[row.v] || 0;
                          const fk = i === 4 ? (jami.stFk || 0) : catStats[row.v as keyof typeof catStats]?.stFakt || 0;
                          const f2 = i === 4 ? (jami.stF2 || 0) : catStats[row.v as keyof typeof catStats]?.stF2 || 0;
                          const qol = Math.max(0, sm - fk);
                          return (
                            <tr key={i} className={i === 4 ? 'font-bold text-white' : ''}>
                              <td className="py-2">{row.lbl}</td>
                              <td className="py-2 text-right text-blue-400"><FmtN val={sm} /></td>
                              <td className="py-2 text-right text-emerald-400"><FmtN val={fk} /></td>
                              <td className="py-2 text-right text-purple-400"><FmtN val={f2} /></td>
                              <td className="py-2 text-right text-amber-400"><FmtN val={qol} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {hasEdits && (
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
                  <button onClick={() => setIsSaveModalOpen(true)} className="px-6 py-2 text-sm font-bold text-black bg-yellow-500 hover:bg-yellow-400 rounded-lg shadow-[0_0_15px_rgba(234,179,8,0.3)] transition-all active:scale-95 flex items-center gap-2">
                    <Save size={16} /> Saqlash va Yopish
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
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
              <SmetaTree 
                data={groupedTree} 
                oylar={oylar}
                isEditMode={true} 
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
