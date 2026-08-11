import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useSessiya } from '../api/hooks';
import { AlertTriangle } from 'lucide-react';
import { LogOut, Building2, FileInput, FileSignature, Package, Activity, Tags, Network, Calculator, FileOutput, HardHat, Truck, ShoppingCart, ShieldAlert, Settings, FileText } from 'lucide-react';
import Sahna3D from '../kirish/Sahna3D';

const MENYU = [
  { yol: '/admin/obyektlar',  nom: 'Obyektlar',   Ikonka: Building2 },
  { yol: '/admin/f2',         nom: 'Ф2 импорт',    Ikonka: FileInput },
  { yol: '/admin/buxgalteriya', nom: 'Buxgalteriya', Ikonka: Calculator },
  { yol: '/admin/shartnoma',  nom: 'Shartnomalar', Ikonka: FileSignature },
  { yol: '/admin/fakturalar', nom: 'Fakturalar (PDF)', Ikonka: FileText },
  { yol: '/admin/f2-tayyorlash', nom: 'Ф2 тайёрлаш', Ikonka: FileOutput },
  { yol: '/admin/narxlar',    nom: 'Narxlar',      Ikonka: Tags },
  { yol: '/admin/ierarxiya',  nom: 'Ierarxiya',    Ikonka: Network },
  { yol: '/admin/sklad',      nom: 'Sklad',        Ikonka: Package },
  { yol: '/admin/monitoring', nom: 'Monitoring',   Ikonka: Activity },
  { yol: '/admin/kadrlar',    nom: 'Kadrlar',      Ikonka: HardHat },
  { yol: '/admin/texnika',    nom: 'Texnika',      Ikonka: Truck },
  { yol: '/admin/taminot',    nom: "Ta'minot",     Ikonka: ShoppingCart },
  { yol: '/admin/sifat',      nom: 'Sifat (QA)',   Ikonka: ShieldAlert },
  { yol: '/admin/sozlamalar', nom: 'Sozlamalar',   Ikonka: Settings },
];

export default function AdminShell() {
  const navigate = useNavigate();
  const sess = useSessiya();

  useEffect(() => {
    if (sess.isError && sess.error?.message === "Sessiya yo'q") {
      document.cookie = 'sess=; Max-Age=0; path=/';
      navigate('/');
    }
  }, [sess.isError, sess.error, navigate]);

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    window.location.href = '/';
  };

  return (
    <div className="flex h-screen overflow-hidden text-white relative font-sans selection:bg-accent/30 bg-[#020617]">
      {/* 3D Interactive Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         <Sahna3D />
      </div>

      {/* Grid Overlay for texture */}
      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none" />

      {/* Dark tint so content is readable */}
      <div className="absolute inset-0 z-0 bg-black/40 pointer-events-none" />

      {/* Sidebar */}
      <aside className="relative z-10 w-64 border-r border-white/10 bg-black/20 backdrop-blur-md flex flex-col shadow-2xl">
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-text">SMETA GAS</h1>
          <p className="text-sm text-text-dim mt-1">👷 {sess.data?.rol ? sess.data.rol.toUpperCase() : 'АДМИН'}</p>
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
      {sess.data && !sess.data.yozaOladi && (
        <div className="absolute top-0 left-64 right-0 z-30 bg-warn/15 border-b border-warn/30 px-4 py-2
                        flex items-center gap-2 text-sm text-text backdrop-blur-sm">
          <AlertTriangle size={16} className="text-warn flex-shrink-0" />
          <span className="flex-1">
            Siz <strong>{sess.data.rol}</strong> rolida kirgansiz — bu rolda <strong>yozish mumkin emas</strong>.
            Admin bo'lib qayta kiring.
          </span>
          <button onClick={handleLogout}
            className="h-7 px-3 rounded-lg bg-warn/20 hover:bg-warn/30 text-text text-xs font-medium cursor-pointer">
            Chiqish
          </button>
        </div>
      )}

      <main className="relative z-10 flex-1 overflow-hidden flex flex-col bg-transparent">
        <Outlet />
      </main>
    </div>
  );
}
