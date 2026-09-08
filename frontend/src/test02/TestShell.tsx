import { Outlet, NavLink } from 'react-router-dom';
import { KompaniyaProvider, KompaniyaTanlagich } from './KompaniyaTanlov';
import { ArrowLeft, CheckCircle2, ClipboardList, FileText, FlaskConical, FolderKanban } from 'lucide-react';

const PTO_NAV = [
  { to: '/admin/test/portfel', label: 'Portfolio', hint: 'Loyiha · obyekt · Fakt', Icon: FolderKanban },
  { to: '/admin/test/moliya', label: 'Smeta / F2', hint: 'Smeta · Fakt · import', Icon: FileText },
  { to: '/admin/test/logistika', label: 'Resurs / Zayavka', hint: 'Ta’minot va resurs', Icon: ClipboardList },
  { to: '/admin/test/crm', label: 'Aloqa / Hujjat', hint: 'Korrespondensiya', Icon: CheckCircle2 },
] as const;

function PtoNavLink({ item, compact = false }: { item: typeof PTO_NAV[number]; compact?: boolean }) {
  const Icon = item.Icon;
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => [
        'group inline-flex items-center gap-2 rounded-lg border transition-colors',
        compact ? 'shrink-0 px-3 py-2' : 'w-full px-3 py-2.5',
        isActive
          ? 'border-accent/35 bg-accent/12 text-accent'
          : 'border-transparent text-text-dim hover:border-border hover:bg-surface-2 hover:text-text',
      ].join(' ')}
      aria-label={`${item.label}: ${item.hint}`}
    >
      <Icon size={15} className="shrink-0" />
      <span className="min-w-0 text-left">
        <span className="block text-[12px] font-semibold leading-4 whitespace-nowrap">{item.label}</span>
        {!compact && <span className="block truncate text-[10px] text-text-mute">{item.hint}</span>}
      </span>
    </NavLink>
  );
}

export default function TestShell() {
  return (
    <KompaniyaProvider>
      <div className="flex flex-col h-full min-h-0 bg-transparent">
        {/* TIZIM_02 Kompaniya va Obyekt tanlash header'i */}
        <div className="os-context-bar flex-shrink-0 flex flex-wrap items-center gap-3 px-6 py-2
                        border-b backdrop-blur-sm z-20">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md
                           bg-accent/15 text-accent border border-accent/20 text-[10px] font-bold tracking-[.12em]">
            <FlaskConical size={13} /> SINOV
          </span>
          <KompaniyaTanlagich />
          <span className="hidden xl:inline text-[10px] tracking-wide text-text-mute">
            PTO workspace · kompaniyadan keyin portfolio ichida obyekt tanlanadi
          </span>
          <NavLink to="/admin/obyektlar"
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-dim
                       hover:text-white transition-colors">
            <ArrowLeft size={13} /> Eski Tizimga Qaytish
          </NavLink>
        </div>

        <nav aria-label="PTO workflow" className="sm:hidden flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2">
          {PTO_NAV.map((item) => <PtoNavLink key={item.to} item={item} compact />)}
        </nav>

        {/* Asosiy ishchi oyna */}
        <div className="flex flex-1 min-h-0 overflow-hidden relative z-10">
          <aside className="hidden sm:flex w-56 shrink-0 flex-col gap-2 border-r border-border bg-surface/70 p-3">
            <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[.16em] text-text-mute">PTO workflow</div>
            {PTO_NAV.map((item) => <PtoNavLink key={item.to} item={item} />)}
            <div className="mt-auto rounded-lg border border-border/70 bg-surface-2/40 p-2 text-[10px] leading-4 text-text-mute">
              Hisob-kitoblar canonical TIZIM_02 API orqali ishlaydi. Noma’lum qiymat 0 ga aylantirilmaydi.
            </div>
          </aside>
          <main className="min-w-0 flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </main>
        </div>
      </div>
    </KompaniyaProvider>
  );
}
