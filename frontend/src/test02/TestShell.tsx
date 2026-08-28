import { Outlet, NavLink } from 'react-router-dom';
import { KompaniyaProvider, KompaniyaTanlagich } from './KompaniyaTanlov';
import { ArrowLeft, FlaskConical } from 'lucide-react';

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
          <NavLink to="/admin/obyektlar"
            className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-text-dim
                       hover:text-white transition-colors">
            <ArrowLeft size={13} /> Eski Tizimga Qaytish
          </NavLink>
        </div>

        {/* Asosiy ishchi oyna */}
        <div className="flex-1 min-h-0 overflow-hidden relative z-10">
          <Outlet />
        </div>
      </div>
    </KompaniyaProvider>
  );
}
