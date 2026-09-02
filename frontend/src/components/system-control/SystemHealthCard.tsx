import { Activity, Clock3 } from 'lucide-react';
import { SystemStatusBadge } from './SystemStatusBadge';
import type { SystemHealth } from './types';

export function SystemHealthCard({ health }: { health: SystemHealth }) {
  return <article className="karta p-4 min-w-0" data-testid={`health-${health.id}`}>
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] uppercase tracking-[.14em] text-text-dim">Tizim komponenti</p><h3 className="mt-1 font-semibold text-text truncate">{health.name}</h3></div><SystemStatusBadge status={health.status} /></div>
    <div className="mt-4 space-y-1.5 text-xs"><p className="flex items-center gap-1.5 text-text-dim"><Clock3 size={13} />{health.lastCheck ? `Tekshiruv: ${health.lastCheck}` : 'Tekshiruv vaqti yo‘q'}</p><p className="flex items-center gap-1.5 text-text-dim"><Activity size={13} />{health.version ? `Versiya: ${health.version}` : 'Versiya qayd qilinmagan'}</p>{health.message && <p className="pt-2 text-text border-t border-border/70">{health.message}</p>}</div>
  </article>;
}
