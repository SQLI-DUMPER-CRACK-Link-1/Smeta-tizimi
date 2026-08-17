import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TreeNode } from '../../api/types';
import { flattenTree, getAllKeys } from './utils';
import { FmtN } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { ChevronRight, ChevronDown, RefreshCcw, Plus } from 'lucide-react';

interface SmetaTreeProps {
  data: TreeNode[];
  oylar?: string[];
  isEditMode?: boolean;
  edits?: Record<string, any>;
  setEdits?: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onNodeDrop?: (source: TreeNode, target?: TreeNode) => void;
}

export function SmetaTree({ data, oylar = [], isEditMode = false, edits = {}, setEdits, onNodeDrop }: SmetaTreeProps) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const [qidiruv, setQidiruv] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  /* ⚠️ 2026-08-17 (audit): «Qidiruv…» maydoni hech narsaga ULANMAGAN edi —
     yozish mumkin, lekin daraxt o'zgarmasdi. Minglab qatorli smetada bu
     eng kerakli asbob, shuning uchun haqiqiy filtr qilib ulandi.
     Mantiq: mos kelgan tugun VA uning butun ota-zanjiri qoladi (aks holda
     topilgan resurs qaysi razdelniki ekani ko'rinmaydi); mos kelganning
     bolalari ham qoladi. */
  const filtrlangan = useMemo(() => {
    const s = qidiruv.trim().toLowerCase();
    if (!s) return data;
    const mos = (n: TreeNode) =>
      String(n.nom || '').toLowerCase().includes(s) ||
      String((n as any).kod || '').toLowerCase().includes(s);
    const suz = (nodes: TreeNode[]): TreeNode[] => {
      const chiq: TreeNode[] = [];
      for (const n of nodes) {
        const bolalar = n.children ? suz(n.children) : [];
        if (mos(n)) chiq.push(n);            // o'zi mos — butun shoxi bilan
        else if (bolalar.length) chiq.push({ ...n, children: bolalar });
      }
      return chiq;
    };
    return suz(data);
  }, [data, qidiruv]);

  /* Qidiruvda hamma shox ochiq bo'lishi kerak, aks holda mos kelgan
     ichkaridagi qator ko'rinmay qoladi. */
  const kengaytirilgan = useMemo(
    () => (qidiruv.trim()
      ? Object.fromEntries(getAllKeys(filtrlangan).map((k) => [k, true]))
      : expandedMap),
    [qidiruv, filtrlangan, expandedMap]);

  const flatNodes = useMemo(
    () => flattenTree(filtrlangan, kengaytirilgan),
    [filtrlangan, kengaytirilgan]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (idx) => {
      const row = flatNodes[idx];
      const key = `${row.node.varaq}#${row.node.row}`;
      if (expandedDetailId === key) return 250;
      return 36;
    },
    overscan: 20,
  });

  const toggleExpand = (key: string) => {
    setExpandedMap(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const keys = getAllKeys(data);
    const newMap: Record<string, boolean> = {};
    keys.forEach(k => newMap[k] = true);
    setExpandedMap(newMap);
  };

  const collapseAll = () => setExpandedMap({});

  return (
    <div className="flex flex-col h-full bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="h-14 border-b border-border bg-surface-2/50 flex items-center px-4 justify-between sticky top-0 z-10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={qidiruv}
            onChange={(e) => setQidiruv(e.target.value)}
            placeholder="Qidiruv..."
            aria-label="Daraxtdan qidirish"
            className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-accent"
          />
          {!!qidiruv.trim() && (
            <span className="text-[11px] text-text-mute whitespace-nowrap">
              {flatNodes.length} qator
              <button onClick={() => setQidiruv('')}
                className="ml-2 text-accent hover:underline">tozalash</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium bg-surface hover:bg-surface-2 border border-border rounded-md">Hammasini yoyish</button>
          <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium bg-surface hover:bg-surface-2 border border-border rounded-md">Yig'ish</button>
        </div>
      </div>

      <div className="h-8 border-b border-white/5 bg-black/40 flex items-center px-4 sticky top-14 z-10 flex-shrink-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider backdrop-blur-md">
        <div className="flex-1">Nom / Birlik</div>
        <div className="flex items-center h-full pr-4 flex-shrink-0 gap-4">
          <div className="w-20 text-right text-blue-400/70" title="Smeta Hajm">Sm. Vol</div>
          <div className="w-24 text-right text-emerald-400/70" title="Fakt Hajm">Fakt Vol</div>
          <div className="w-24 text-right text-purple-400/70" title="Jami F2 Hajm">F2 Vol</div>
          <div className="w-24 text-right text-cyan-400/70" title="F2 Olish Mumkin (Fakt - F2)">F2 Mum.</div>
          <div className="w-20 text-right text-amber-400/70" title="Qoldiq Hajm">Qoldiq</div>
          
          <div className="w-4 border-r border-white/10 h-full mx-2"></div>
          
          <div className="w-24 text-right text-blue-400" title="Smeta Summa">Sm. Sum</div>
          <div className="w-24 text-right text-emerald-400" title="Fakt Summa (Nakrutka)">Fk. Sum</div>
          <div className="w-24 text-right text-purple-400" title="F2 Summa (Nakrutka)">F2 Sum</div>
          <div className="w-24 text-right text-cyan-400" title="F2 Olish Mumkin Summa (Nakrutka)">F2 M. Sum</div>
          <div className="w-24 text-right text-amber-400" title="Qoldiq Summa (Nakrutka)">Ost. Sum</div>
        </div>
      </div>

      <div 
        className="flex-1 overflow-auto" 
        ref={parentRef}
        onDragOver={(e) => {
          if (!isEditMode) return;
          e.preventDefault();
        }}
        onDrop={(e) => {
          if (!isEditMode || !draggedNode) return;
          e.preventDefault();
          // Drop on empty space (qoshimcha)
          if (onNodeDrop) onNodeDrop(draggedNode);
          setDraggedNode(null);
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = flatNodes[virtualRow.index];
            const node = row.node;
            const key = `${node.varaq}#${node.row}`;
            const isEdited = !!edits[key];
            const currentFakt = edits[key]?.edit.fakt ?? node.fakt ?? 0;
            const isOverLimit = currentFakt > (node.smetaHajm || 0);
            
            return (
              <div
                key={virtualRow.index}
                draggable={isEditMode}
                onDragStart={(e) => {
                  if (!isEditMode) return;
                  setDraggedNode(node);
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                onDragOver={(e) => {
                  if (!isEditMode) return;
                  e.preventDefault();
                  e.stopPropagation(); // Prevent bubbling to empty space drop
                }}
                onDrop={(e) => {
                  if (!isEditMode || !draggedNode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  if (onNodeDrop) onNodeDrop(draggedNode, node);
                  setDraggedNode(null);
                }}
                className={`absolute top-0 left-0 w-full flex items-center border-b border-border/50 hover:bg-surface-2/30 transition-colors text-sm group ${isEdited ? 'shadow-[inset_3px_0_0_var(--warn)] bg-warn/5' : ''}`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  cursor: (row.hasChildren || (isEditMode && (node.type === 'bl' || node.type === 'rs'))) ? 'pointer' : 'default'
                }}
                onClick={() => {
                  if (row.hasChildren) toggleExpand(key);
                  if ((node.type === 'bl' || node.type === 'rs') && isEditMode) {
                    setExpandedDetailId(prev => prev === key ? null : key);
                  }
                }}
              >
                {/* Fixed Indent Guide lines would go here based on row.depth */}
                <div 
                  className="flex items-center h-9 px-4 flex-1 min-w-0"
                  style={{ paddingLeft: `${row.depth * 24 + 16}px` }}
                >
                  <div className="flex items-center gap-2 w-full">
                    {/* Expand/Collapse Chevron */}
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      {row.hasChildren ? (
                        <button onClick={() => toggleExpand(`${node.varaq}#${node.row}`)} className="p-0.5 hover:bg-surface-2 rounded text-text-dim hover:text-white">
                          {row.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                    </div>
                    
                    {/* Zamena/Qoshimcha icons */}
                    {node.isZamena && <RefreshCcw size={14} className="text-[#a855f7] flex-shrink-0" />}
                    {node.isQosh && <Plus size={14} className="text-ok flex-shrink-0" />}
                    
                    {/* Type Badge */}
                    <Badge variant={node.type as any} className="flex-shrink-0 w-8 justify-center uppercase">{node.type}</Badge>
                    
                    {/* Kod (Shifr) */}
                    {node.kod && <span className="text-text-dim font-mono text-xs flex-shrink-0 w-24 truncate">{node.kod}</span>}
                    
                    {/* Nom */}
                    <span className="text-white truncate flex-1" title={node.nom || 'Nomsiz'}>
                      {node.nom || <span className="text-white/30 italic">Nomsiz</span>}
                    </span>
                    
                    {/* Birlik */}
                    <span className="text-text-dim w-12 text-center flex-shrink-0">{node.birlik}</span>
                  </div>
                </div>
                
                {/* Data Columns with Gantt/Progress Visual */}
                <div className="flex items-center h-full pr-4 flex-shrink-0 font-medium tabular-nums text-[11px] gap-4">
                  {/* VOLUMES */}
                  <div className="w-20 text-right text-blue-300/80"><FmtN val={node.smetaHajm} /></div>
                  <div className="w-24 text-right">
                    {isEditMode && node.type !== 'rz' ? (
                      <input
                        type="text"
                        value={currentFakt}
                        placeholder="Fakt"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = Number(e.target.value.replace(/,/g, '.'));
                          if (isNaN(val)) return;
                          if (setEdits && node.varaq && node.row) {
                            setEdits(prev => ({
                              ...prev,
                              [key]: {
                                node,
                                edit: { ...(prev[key]?.edit || {}), varaq: node.varaq!, row: node.row!, fakt: val }
                              }
                            }));
                          }
                        }}
                        className={`w-full text-right bg-black/60 border rounded px-1.5 py-0.5 outline-none transition-colors ${isOverLimit ? 'border-red-500/50 text-red-400' : 'border-emerald-500/30 text-emerald-300 focus:border-emerald-400'}`}
                        title="Fakt hajm kiriting"
                      />
                    ) : (
                      <FmtN val={node.fakt} cl={isOverLimit ? 'text-red-400' : 'text-emerald-400'} />
                    )}
                  </div>
                  
                  <div className="w-24 text-right">
                      <FmtN val={node.f2ol || 0} cl="text-purple-400" />
                  </div>
                  
                  <div className="w-20 text-right text-amber-300/80"><FmtN val={node.qoldiq} /></div>

                  <div className="w-4 border-r border-white/10 h-full mx-2 flex items-center justify-center">
                    {/* Tiny visual progress bar for Fakt */}
                    <div className="w-full h-8 flex flex-col justify-end bg-black/30 rounded-sm overflow-hidden" title={`Fakt: ${Math.round((node.fakt / (node.smetaHajm || 1)) * 100)}%`}>
                      <div className="w-full bg-emerald-500/50" style={{ height: `${Math.min((node.fakt / (node.smetaHajm || 1)) * 100, 100)}%` }} />
                    </div>
                  </div>

                  {/* SUMMAS (Nakrutka) */}
                  <div className="w-24 text-right text-blue-200"><FmtN val={node.smeta} /></div>
                  <div className="w-24 text-right text-emerald-300 font-bold"><FmtN val={node.stFakt ?? (node.fakt * (node.narx || 0))} /></div>
                  <div className="w-24 text-right text-purple-300 font-bold"><FmtN val={node.stF2 || 0} /></div>
                  <div className="w-24 text-right text-cyan-300"><FmtN val={node.stOst ?? (node.f2mum * (node.narx || 0))} /></div>
                  <div className="w-24 text-right text-amber-300"><FmtN val={(node.smeta || 0) - (node.stFakt ?? (node.fakt * (node.narx || 0)))} /></div>
                </div>

                {/* Expanded RowDetailPanel for F2 Monthly Editing */}
                {expandedDetailId === key && (
                  <div className="absolute top-9 left-0 w-full h-[214px] bg-black/60 border-t border-white/5 shadow-inner backdrop-blur-md p-4 flex gap-6 z-10 overflow-hidden cursor-default" onClick={(e) => e.stopPropagation()}>
                    {/* Left: Quick Stats */}
                    <div className="w-64 flex-shrink-0 grid grid-cols-2 gap-3">
                      <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 font-bold">Hajm Smeta</div>
                        <div className="text-sm text-blue-400 font-mono"><FmtN val={node.smetaHajm} /></div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 font-bold">Hajm Fakt</div>
                        <div className="text-sm text-emerald-400 font-mono"><FmtN val={currentFakt} /></div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 font-bold">Hajm F2</div>
                        <div className="text-sm text-purple-400 font-mono"><FmtN val={node.f2ol} /></div>
                      </div>
                      <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                        <div className="text-[10px] text-slate-500 font-bold">Hajm Mumkin</div>
                        <div className="text-sm text-cyan-400 font-mono"><FmtN val={node.f2mum} /></div>
                      </div>
                    </div>
                    
                    {/* Right: Monthly F2 Inputs */}
                    <div className="flex-1 overflow-x-auto">
                      <h4 className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"></span>Oylik F2 Hajmlarni Kiritish</h4>
                      <div className="flex gap-4">
                        {oylar.map((oy: string) => {
                          const oylarState = edits[key]?.edit?.oylar || node.oylar || {};
                          const currentOyVal = oylarState[oy] ?? 0;
                          return (
                            <div key={oy} className="bg-white/5 border border-white/10 rounded-xl p-3 w-44 flex-shrink-0">
                              <div className="text-xs font-bold text-slate-300 mb-2">{oy}</div>
                              <input
                                type="text"
                                value={currentOyVal}
                                onChange={(e) => {
                                  const val = Number(e.target.value.replace(/,/g, '.'));
                                  if (isNaN(val)) return;
                                  if (setEdits) {
                                    setEdits(prev => {
                                      const existingOylar = prev[key]?.edit?.oylar || node.oylar || {};
                                      return {
                                        ...prev,
                                        [key]: {
                                          node,
                                          edit: { 
                                            ...(prev[key]?.edit || {}), 
                                            varaq: node.varaq!, row: node.row!,
                                            oylar: { ...existingOylar, [oy]: val }
                                          }
                                        }
                                      };
                                    });
                                  }
                                }}
                                className="w-full bg-black/50 border border-white/10 text-purple-300 font-mono text-sm rounded px-2 py-1 outline-none focus:border-purple-500/50"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
