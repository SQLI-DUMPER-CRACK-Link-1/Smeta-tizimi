import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Building2, FileInput, FileSignature, Package, Activity, Tags } from 'lucide-react';

const MENYU = [
  { yol: '/admin/obyektlar',  nom: 'Obyektlar',   Ikonka: Building2 },
  { yol: '/admin/f2',         nom: 'Ф2 импорт',    Ikonka: FileInput },
  { yol: '/admin/shartnoma',  nom: 'Shartnomalar', Ikonka: FileSignature },
  { yol: '/admin/narxlar',    nom: 'Narxlar',      Ikonka: Tags },
  { yol: '/admin/sklad',      nom: 'Sklad',        Ikonka: Package },
  { yol: '/admin/monitoring', nom: 'Monitoring',   Ikonka: Activity },
];

export default function AdminShell() {
  const navigate = useNavigate();

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    navigate('/');
  };

  return (
    <div className="flex h-screen bg-bg">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-surface flex flex-col">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-text">SMETA GAS</h1>
          <p className="text-sm text-text-dim mt-1">👷 АДМИН</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {MENYU.map((m) => (
            <NavLink
              key={m.yol}
              to={m.yol}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                 transition-colors duration-[120ms] cursor-pointer ${
                   isActive
                     ? 'bg-[var(--accent)]/10 text-accent'
                     : 'text-text-dim hover:bg-surface-2 hover:text-text'
                 }`
              }
            >
              <m.Ikonka className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              <span>{m.nom}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-text hover:bg-surface-2 transition-colors"
          >
            <LogOut className="w-5 h-5 text-text-dim" />
            <span>Чиқиш</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
