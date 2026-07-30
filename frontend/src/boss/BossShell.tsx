import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, HardHat, Truck, ShoppingCart, ShieldAlert } from 'lucide-react';

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
      <header className="absolute top-0 left-0 right-0 h-16 border-b border-white/5 flex items-center px-6 z-50 bg-[#1C1F26]/30 backdrop-blur-2xl">
        <h1 className="text-xl font-bold text-white tracking-tight">SMETA GAS <span className="text-white/40 ml-2 font-normal">РАҲБАР</span></h1>
        
        <nav className="ml-10 flex gap-6">
          <NavLink
            to="/boss"
            end
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-white font-medium' : 'text-white/50 hover:text-white/80'}`
            }
          >
            <LayoutDashboard className="w-4 h-4" />
            Umumiy
          </NavLink>
          <NavLink
            to="/boss/kadrlar"
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-blue-400 font-medium' : 'text-white/50 hover:text-blue-400/80'}`
            }
          >
            <HardHat className="w-4 h-4" />
            Kadrlar
          </NavLink>
          <NavLink
            to="/boss/texnika"
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-purple-400 font-medium' : 'text-white/50 hover:text-purple-400/80'}`
            }
          >
            <Truck className="w-4 h-4" />
            Texnika
          </NavLink>
          <NavLink
            to="/boss/taminot"
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-yellow-400 font-medium' : 'text-white/50 hover:text-yellow-400/80'}`
            }
          >
            <ShoppingCart className="w-4 h-4" />
            Ta'minot
          </NavLink>
          <NavLink
            to="/boss/sifat"
            className={({ isActive }) =>
              `flex items-center gap-2 transition-colors ${isActive ? 'text-red-400 font-medium' : 'text-white/50 hover:text-red-400/80'}`
            }
          >
            <ShieldAlert className="w-4 h-4" />
            Sifat (QA/QC)
          </NavLink>
        </nav>

        <button
          onClick={handleLogout}
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
        >
          <LogOut className="w-4 h-4" />
          <span>Чиқиш</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-16 relative z-0 h-full overflow-hidden bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}
