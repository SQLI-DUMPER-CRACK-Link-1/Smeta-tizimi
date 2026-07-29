import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useObyektlar } from '../../api/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, ChevronDown, FileSpreadsheet, Plus } from 'lucide-react';
import type { PapkaObyekt } from '../../api/types';
import { Sahifa, Holatlar } from '../../umumiy/ui/Sahifa';

export function Obyektlar() {
  const soragan = useObyektlar();
  const { data, refetch, isFetching, dataUpdatedAt } = soragan;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  const groupedData = useMemo(() => {
    if (!data) return [];
    
    const groups = new Map<string, PapkaObyekt[]>();
    data.forEach(obj => {
      const baseName = obj.obyekt.split(' - ')[0];
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      groups.get(baseName)!.push(obj);
    });
    
    return Array.from(groups.entries()).map(([baseName, items]) => ({
      baseName,
      items
    }));
  }, [data]);

  const toggleGroup = (baseName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [baseName]: !prev[baseName]
    }));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <Sahifa
      sarlavha="Obyektlar Ro'yxati"
      tavsif={`Smetalar papkasidagi jami obyektlar (${groupedData.length}) / lokalkalar (${data?.length || 0})`}
      yangilangan={dataUpdatedAt}
      onYangila={() => refetch()}
      yangilanmoqda={isFetching}
      amallar={
        <button className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium">
          <Plus size={16} />
          Yangi obyekt
        </button>
      }
    >
      <Holatlar
        soragan={soragan}
        bosh={{ matn: "Papka bo'sh", izoh: "Google Drive'da hali smeta fayllari yo'q" }}
      >
        {() => (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {groupedData.map((group, i) => {
              const isExpanded = expandedGroups[group.baseName];
              const hasMultiple = group.items.length > 1;

              return (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className={`karta transition-all duration-200 cursor-pointer overflow-hidden flex flex-col hover:border-[var(--accent)]/50 ${isExpanded && hasMultiple ? 'row-span-2 shadow-lg shadow-[var(--accent)]/5 border-[var(--accent)]/30' : ''}`}
                  onClick={() =>
                    hasMultiple
                      ? toggleGroup(group.baseName, { stopPropagation: () => {} } as any)
                      : navigate(`/admin/holat/${encodeURIComponent(group.items[0].obyekt)}`)
                  }
                >
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-[12px] flex items-center justify-center transition-transform ${hasMultiple ? 'bg-accent/10 text-accent group-hover:scale-110' : 'bg-[var(--surface-2)] text-text-dim'}`}>
                        {hasMultiple ? <Folder size={24} /> : <FileSpreadsheet size={24} />}
                      </div>
                      {hasMultiple && (
                        <div className={`text-text-dim transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                          <ChevronDown size={20} />
                        </div>
                      )}
                    </div>
                    
                    <h3 className="text-[17px] font-semibold text-text mb-2 line-clamp-2 leading-snug">{group.baseName}</h3>
                    
                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
                      <span className="text-sm text-text-dim font-medium flex items-center gap-1">
                        {hasMultiple ? `${group.items.length} ta lokalka` : "Smeta hujjati"}
                      </span>
                      {hasMultiple && (
                        <span className="text-xs bg-[var(--surface-2)] px-2 py-1 rounded-[6px] text-text-mute font-mono">Papkali</span>
                      )}
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {isExpanded && hasMultiple && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-border bg-[var(--surface-2)]/30"
                      >
                        <ul className="py-2 px-4 space-y-1">
                          {group.items.map((item, j) => (
                            <li key={j}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/admin/holat/${encodeURIComponent(item.obyekt)}`);
                                }}
                                className="w-full text-left px-3 py-2.5 rounded-[8px] text-sm text-text-dim hover:text-text hover:bg-[var(--surface-2)] transition-colors flex items-center gap-3 truncate group/btn"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-border group-hover/btn:bg-accent transition-colors flex-shrink-0" />
                                <span className="truncate">{item.obyekt.replace(group.baseName + ' - ', '')}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </Holatlar>
    </Sahifa>
  );
}
