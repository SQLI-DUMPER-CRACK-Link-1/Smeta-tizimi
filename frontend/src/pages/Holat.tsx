import { useState } from 'react';
import { useHolat, useObyektlar } from '../api/hooks';
import { SmetaTree } from '../components/tree/SmetaTree';
import { Skeleton } from '../components/ui/Skeleton';
import { FileSpreadsheet } from 'lucide-react';

export function Holat() {
  const { data: obyektlar, isLoading: isObyektlarLoading } = useObyektlar();
  const [selectedObyekt, setSelectedObyekt] = useState<string>('');

  // Auto-select first object if none selected
  if (!selectedObyekt && obyektlar && obyektlar.length > 0) {
    setSelectedObyekt(obyektlar[0].id || obyektlar[0].nom);
  }

  const { data: holatData, isLoading: isHolatLoading, error } = useHolat(selectedObyekt);

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="text-accent" />
            Smeta Holati
          </h2>
          <p className="text-text-dim text-sm mt-1">Obyektning to'liq ierarxik smetasi va bajarilish holati</p>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-dim">Obyekt:</span>
          {isObyektlarLoading ? (
             <Skeleton className="h-9 w-48 rounded-md" />
          ) : (
            <select 
              value={selectedObyekt} 
              onChange={e => setSelectedObyekt(e.target.value)}
              className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-accent min-w-[200px]"
            >
              {obyektlar?.map(obj => (
                <option key={obj.id || obj.nom} value={obj.id || obj.nom}>{obj.nom}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!selectedObyekt ? (
          <div className="h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center text-text-dim">
            Obyektni tanlang
          </div>
        ) : isHolatLoading ? (
          <div className="h-full bg-surface border border-border rounded-xl p-4 space-y-2">
            <Skeleton className="h-10 w-full mb-4" />
            {[...Array(20)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 flex-1 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
              <div className="bg-surface border border-border px-6 py-4 rounded-lg shadow-xl text-center">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="font-medium text-white">Smeta daraxti o'qilmoqda...</p>
                <p className="text-xs text-text-dim mt-1">Iltimos kuting</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-danger p-4 rounded-lg bg-danger/10 border border-danger/20">
            Daraxtni yuklashda xatolik: {error.message}
          </div>
        ) : holatData?.tree ? (
          <SmetaTree data={holatData.tree} />
        ) : (
          <div className="h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center text-text-dim">
            Ma'lumot topilmadi
          </div>
        )}
      </div>
    </div>
  );
}
