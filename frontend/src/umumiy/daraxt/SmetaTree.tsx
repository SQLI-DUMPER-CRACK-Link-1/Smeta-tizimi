import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TreeNode } from '../../api/types';
import type { EditState } from '../../admin/sahifalar/Holat';
import { flattenTree, getAllKeys } from './utils';
import { FmtN } from '../../lib/format';
import { Badge } from '../ui/Badge';
import { ChevronRight, ChevronDown, RefreshCcw, Plus } from 'lucide-react';

interface SmetaTreeProps {
  data: TreeNode[];
  isEditMode?: boolean;
  edits?: Record<string, EditState>;
  setEdits?: React.Dispatch<React.SetStateAction<Record<string, EditState>>>;
  onNodeDrop?: (source: TreeNode, target?: TreeNode) => void;
}

export function SmetaTree({ data, isEditMode = false, edits = {}, setEdits, onNodeDrop }: SmetaTreeProps) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const flatNodes = useMemo(() => flattenTree(data, expandedMap), [data, expandedMap]);

  const rowVirtualizer = useVirtualizer({
    count: flatNodes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
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
            placeholder="Qidiruv..." 
            className="bg-bg border border-border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-accent"
          />
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
          <div className="w-20 text-right text-amber-400/70" title="Qoldiq Hajm">Qoldiq</div>
          
          <div className="w-4 border-r border-white/10 h-full mx-2"></div>
          
          <div className="w-24 text-right text-blue-400" title="Smeta Summa">Sm. Sum</div>
          <div className="w-24 text-right text-emerald-400" title="Fakt Summa (Nakrutka)">Fk. Sum</div>
          <div className="w-24 text-right text-purple-400" title="F2 Summa (Nakrutka)">F2 Sum</div>
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
                }}
              >
                {/* Fixed Indent Guide lines would go here based on row.depth */}
                <div 
                  className="flex items-center h-full px-4 flex-1 min-w-0"
                  style={{ paddingLeft: `${row.depth * 24 + 16}px`, cursor: row.hasChildren ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (row.hasChildren && !isEditMode) toggleExpand(`${node.varaq}#${node.row}`);
                  }}
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
                  <div className="w-24 text-right text-amber-300"><FmtN val={node.stOst ?? (node.qoldiq * (node.narx || 0))} /></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
