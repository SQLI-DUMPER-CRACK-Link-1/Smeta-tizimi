import { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { TreeNode } from '../../api/types';
import type { EditState } from '../../pages/Holat';
import { flattenTree, getAllKeys } from './utils';
import { formatSum } from '../../lib/format';
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

  const toggleExpand = (uid: string) => {
    setExpandedMap(prev => ({ ...prev, [uid]: !prev[uid] }));
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
            const isEdited = !!edits[node.uid];
            const currentFakt = edits[node.uid]?.edit.fakt ?? node.fakt;
            const isOverLimit = currentFakt > node.smeta;
            
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
                  style={{ paddingLeft: `${row.depth * 24 + 16}px` }}
                >
                  <div className="flex items-center gap-2 w-full">
                    {/* Expand/Collapse Chevron */}
                    <div className="w-5 flex items-center justify-center flex-shrink-0">
                      {row.hasChildren ? (
                        <button onClick={() => toggleExpand(node.uid)} className="p-0.5 hover:bg-surface-2 rounded text-text-dim hover:text-white">
                          {row.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                    </div>
                    
                    {/* Zamena/Qoshimcha icons */}
                    {node.zamena && <RefreshCcw size={14} className="text-[#a855f7] flex-shrink-0" />}
                    {node.qoshimcha && <Plus size={14} className="text-ok flex-shrink-0" />}
                    
                    {/* Type Badge */}
                    <Badge variant={node.tip as any} className="flex-shrink-0 w-8 justify-center uppercase">{node.tip}</Badge>
                    
                    {/* Kod (Shifr) */}
                    {node.kod && <span className="text-text-dim font-mono text-xs flex-shrink-0 w-24 truncate">{node.kod}</span>}
                    
                    {/* Nom */}
                    <span className="text-white truncate flex-1" title={node.nom}>{node.nom}</span>
                    
                    {/* Birlik */}
                    <span className="text-text-dim w-12 text-center flex-shrink-0">{node.birlik}</span>
                  </div>
                </div>
                
                {/* Data Columns */}
                <div className="flex items-center h-full pr-4 flex-shrink-0 font-medium tabular-nums text-xs">
                  <div className="w-24 text-right text-text-dim">{formatSum(node.smeta)}</div>
                  <div className="w-24 text-right">
                    {isEditMode ? (
                      <input
                        type="text"
                        value={currentFakt}
                        onChange={(e) => {
                          const valStr = e.target.value.replace(/,/g, '.');
                          const val = Number(valStr);
                          if (isNaN(val)) return;
                          
                          if (setEdits && node.varaq && node.row) {
                            setEdits(prev => ({
                              ...prev,
                              [node.uid]: {
                                node,
                                edit: {
                                  ...(prev[node.uid]?.edit || {}),
                                  varaq: node.varaq!,
                                  row: node.row!,
                                  fakt: val
                                }
                              }
                            }));
                          }
                        }}
                        className={`w-full text-right bg-surface-2 border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent ${isOverLimit ? 'border-danger text-danger' : 'border-border text-white'}`}
                        title={isOverLimit ? `Smetadan oshiq: ${currentFakt} > ${node.smeta}` : ''}
                      />
                    ) : (
                      <span className={isOverLimit ? 'text-danger' : 'text-ok'}>{formatSum(node.fakt)}</span>
                    )}
                  </div>
                  <div className="w-24 text-right text-text-dim">{formatSum(node.narx)}</div>
                  <div className="w-32 text-right text-white">{formatSum(node.summa)}</div>
                  <div className="w-24 text-right text-t-rs">{formatSum(node.f2ol)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
