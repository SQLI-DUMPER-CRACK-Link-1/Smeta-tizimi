import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Building2 } from 'lucide-react';

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
          <NavLink
            to="/admin/obyektlar"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                isActive ? 'bg-surface-2 text-accent' : 'text-text hover:bg-surface-2'
              }`
            }
          >
            <Building2 className="w-5 h-5" />
            <span>Объектлар</span>
          </NavLink>
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
