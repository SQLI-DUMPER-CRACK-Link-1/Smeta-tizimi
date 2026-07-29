import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard } from 'lucide-react';

export default function BossShell() {
  const navigate = useNavigate();

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    navigate('/');
  };

  return (
    <div className="flex h-screen overflow-hidden text-text relative">
      {/* Background will be managed inside components or globally */}
      
      {/* Top Navbar */}
      <header className="fixed top-0 left-0 right-0 h-16 border-b border-glass-border flex items-center px-6 z-50 bg-[#1C1F26]/70 backdrop-blur-xl">
        <h1 className="text-xl font-bold text-white">SMETA GAS <span className="text-text-dim ml-2 font-normal">📊 РАҲБАР</span></h1>
        
        <nav className="ml-10 flex gap-6">
          <NavLink
            to="/boss"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-accent' : 'text-text-dim hover:text-white'}`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Umumiy 3D
          </NavLink>
        </nav>

        <button
          onClick={handleLogout}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-text-dim hover:text-white hover:bg-white/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Чиқиш</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-0 h-screen w-screen overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
