import { useObyektlar } from '../api/hooks';
import { Card, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { RefreshCw, Folder } from 'lucide-react';

export function Obyektlar() {
  const { data, isLoading, error, refetch, isRefetching } = useObyektlar();

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
          <p className="text-text-dim text-sm mt-1">Smetalar papkasidagi barcha obyektlar ({data?.length || 0})</p>
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
        {data?.map((obj, i) => (
          <Card key={i} className="hover:border-accent/50 transition-colors cursor-pointer group">
            <CardContent className="p-6">
              <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Folder size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{obj.nom}</h3>
              
              <div className="space-y-3 mt-4 pt-4 border-t border-border">
                {/* Fallbacks in case apiPapkaSkan doesn't return these yet */}
                <div className="flex justify-between text-sm">
                  <span className="text-text-dim">Lokalkalar:</span>
                  <span className="font-medium text-white">{obj.subObyektlar?.length || 0} ta</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {(!data || data.length === 0) && (
        <div className="text-center py-20 text-text-dim border-2 border-dashed border-border rounded-xl">
           <Folder size={48} className="mx-auto mb-4 opacity-20" />
           <p>Obyektlar topilmadi.</p>
        </div>
      )}
    </div>
  );
}
