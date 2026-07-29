import { useState, useMemo } from 'react';
import { useObyektlar } from '../../api/hooks';
import { Card, CardContent } from '../../umumiy/ui/Card';
import { Skeleton } from '../../umumiy/ui/Skeleton';
import { RefreshCw, Folder, ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { PapkaObyekt } from '../../api/types';

export function Obyektlar() {
  const { data, isLoading, error, refetch, isRefetching } = useObyektlar();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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

  const toggleGroup = (baseName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [baseName]: !prev[baseName]
    }));
  };

  if (isLoading && !isRefetching) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  if (error) {
    return <div className="text-danger p-4 rounded-lg bg-danger/10 border border-danger/20">Xatolik: {error.message}</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Obyektlar Ro'yxati</h2>
          <p className="text-text-dim text-sm mt-1">Smetalar papkasidagi jami obyektlar ({groupedData.length}) / lokalkalar ({data?.length || 0})</p>
        </div>
        <button 
          onClick={() => refetch()}
          disabled={isRefetching}
          className="flex items-center gap-2 px-4 py-2 bg-surface-2 hover:bg-surface border border-border rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefetching ? 'animate-spin' : ''} />
          Yangilash
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {groupedData.map((group, i) => {
          const isExpanded = expandedGroups[group.baseName];
          const hasMultiple = group.items.length > 1;

          return (
            <div
              key={i}
              className={`transition-all duration-200 ${hasMultiple ? 'cursor-pointer hover:opacity-90' : ''} ${isExpanded && hasMultiple ? 'row-span-2' : ''}`}
              onClick={() => hasMultiple && toggleGroup(group.baseName)}
            >
              <Card 
                className={`h-full ${hasMultiple ? 'hover:border-accent/50' : ''} ${isExpanded && hasMultiple ? 'border-accent/30' : ''}`}
              >
              <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform ${hasMultiple ? 'bg-accent/10 text-accent group-hover:scale-110' : 'bg-surface-2 text-text-dim'}`}>
                    {hasMultiple ? <Folder size={24} /> : <FileSpreadsheet size={24} />}
                  </div>
                  {hasMultiple && (
                    <div className="text-text-dim">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </div>
                  )}
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{group.baseName}</h3>
                
                <div className="mt-auto pt-4 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-text-dim">Lokalkalar:</span>
                    <span className="font-medium text-white">{group.items.length} ta</span>
                  </div>
                </div>

                {isExpanded && hasMultiple && (
                  <div className="mt-4 space-y-2 border-t border-border/50 pt-4 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
                    {group.items.map((item, idx) => {
                      const subName = item.obyekt.split(' - ').slice(1).join(' - ') || 'Asosiy smeta';
                      return (
                        <div key={idx} className="text-sm p-2 rounded-md bg-surface-2/50 border border-border/50 text-text-mute flex items-center gap-2">
                          <FileSpreadsheet size={14} className="text-accent/70 flex-shrink-0" />
                          <span className="truncate" title={subName}>{subName}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
      
      {groupedData.length === 0 && (
        <div className="text-center py-20 text-text-dim border-2 border-dashed border-border rounded-xl">
           <Folder size={48} className="mx-auto mb-4 opacity-20" />
           <p>Obyektlar topilmadi.</p>
        </div>
      )}
    </div>
  );
}
