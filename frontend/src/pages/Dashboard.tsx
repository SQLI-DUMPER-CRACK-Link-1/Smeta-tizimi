import { useBossData } from '../api/hooks';
import { Card, CardContent } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';
import { CountUp } from '../components/ui/CountUp';
import { formatSum, formatPercent } from '../lib/format';
import { Wallet, TrendingUp, CheckCircle, Clock } from 'lucide-react';

function KpiCard({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) {
  return (
    <Card className="relative overflow-hidden group hover:border-[var(--accent)]/50 transition-colors">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform group-hover:scale-150 ${color}`} />
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-text-dim mb-1">{title}</p>
            <h3 className="text-2xl font-bold text-white tabular-nums tracking-tight">
              <CountUp value={value} formatter={formatSum} />
            </h3>
          </div>
          <div className={`p-3 rounded-lg bg-surface-2 ${color.replace('bg-', 'text-')}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, error } = useBossData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-danger p-4 rounded-lg bg-danger/10 border border-danger/20">Xatolik yuz berdi: {error?.message}</div>;
  }

  const kpis = [
    { title: 'Smeta Jami (so\'m)', value: data.jami.smeta, icon: <Wallet size={24} />, color: 'bg-accent' },
    { title: 'Fakt (Bajarilgan)', value: data.jami.fakt, icon: <TrendingUp size={24} />, color: 'bg-ok' },
    { title: 'F2 Olingan', value: data.jami.f2, icon: <CheckCircle size={24} />, color: 'bg-t-rs' },
    { title: 'Qoldiq', value: data.jami.qoldiq, icon: <Clock size={24} />, color: 'bg-warn' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} {...kpi} />
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-text-dim uppercase bg-surface-2/50 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-medium">Obyekt Nomi</th>
                <th className="px-6 py-4 font-medium text-right">Smeta</th>
                <th className="px-6 py-4 font-medium text-right">Fakt</th>
                <th className="px-6 py-4 font-medium text-center">Bajarilish %</th>
                <th className="px-6 py-4 font-medium text-center">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.objects?.map((obj, i) => (
                <tr key={i} className="hover:bg-surface-2/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white">{obj.nom}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-text-dim">{formatSum(obj.smeta)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-white">{formatSum(obj.fakt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <span className="tabular-nums font-medium w-12 text-right">{formatPercent(obj.progress || 0)}</span>
                      <div className="w-24 h-2 bg-surface-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${obj.progress > 90 ? 'bg-ok' : 'bg-accent'}`}
                          style={{ width: `${Math.min(obj.progress || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                      (obj.progress || 0) > 90 ? 'bg-ok/10 text-ok border-ok/20' : 
                      (obj.progress || 0) > 50 ? 'bg-warn/10 text-warn border-warn/20' : 
                      'bg-danger/10 text-danger border-danger/20'
                    }`}>
                      {((obj.progress || 0) > 90 ? 'ok' : (obj.progress || 0) > 50 ? 'warn' : 'xavf').toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data.objects || data.objects.length === 0) && (
             <div className="p-12 text-center text-text-dim">
                Hech qanday obyekt topilmadi.
             </div>
          )}
        </div>
      </Card>
    </div>
  );
}
