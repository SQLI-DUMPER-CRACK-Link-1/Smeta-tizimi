import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useSessiya } from '../api/hooks';
import { AlertTriangle, ChevronDown, ChevronRight, Archive, Eye, EyeOff } from 'lucide-react';
import { LogOut, Building2, FileInput, FileSignature, Package, Activity, Tags, Network, Calculator, FileOutput, HardHat, Truck, ShoppingCart, ShieldAlert, Settings, FileText, Link2, FileStack, NotebookPen, Database, Gauge, FlaskConical, LayoutDashboard, BarChart, CalendarDays, Upload, ClipboardList, BookOpen, Briefcase, CreditCard, UserPlus, Box, Trash2, Users, FolderKanban } from 'lucide-react';
import Sahna3D from '../kirish/Sahna3DXavfsiz';
import F2NavbatChip from '../umumiy/ui/F2NavbatChip';
import { menyuTekshirDev } from '../umumiy/marshrutTekshir';

const TIZIM_02_GURUHLAR = [
  {
    nom: 'Asosiy Boshqaruv',
    Ikonka: LayoutDashboard,
    id: 'asosiy',
    menyular: [
      { yol: '/admin/test/hisobot', nom: 'Boss Tahlil', Ikonka: BarChart },
      { yol: '/admin/test/loyiha', nom: 'Loyihalar', Ikonka: FolderKanban },
      { yol: '/admin/test/obyektlar', nom: 'Obyektlar', Ikonka: Building2 },
      { yol: '/admin/test/xarita', nom: 'Mind Map', Ikonka: Network },
      { yol: '/admin/test/grafik', nom: 'Grafik', Ikonka: CalendarDays },
    ]
  },
  {
    nom: 'Muhandislik (PTO)',
    Ikonka: HardHat,
    id: 'pto',
    menyular: [
      { yol: '/admin/test/import', nom: 'Smeta / F2 / Fakt', Ikonka: Upload },
      { yol: '/admin/test/aosr', nom: 'АОСР (Yashirin ish)', Ikonka: ClipboardList },
      { yol: '/admin/test/spravochnik', nom: 'Ish turlari', Ikonka: BookOpen },
    ]
  },
  {
    nom: 'Moliya va Tijorat',
    Ikonka: Briefcase,
    id: 'moliya',
    menyular: [
      { yol: '/admin/test/shartnomalar', nom: 'Shartnomalar', Ikonka: Briefcase },
      { yol: '/admin/test/tolov', nom: 'To\'lov', Ikonka: CreditCard },
      { yol: '/admin/test/faktura', nom: 'Fakturalar (PDF)', Ikonka: FileText },
      { yol: '/admin/test/narxlar', nom: 'Narxlar', Ikonka: Tags },
    ]
  },
  {
    nom: 'Ta\'minot va Sklad',
    Ikonka: ShoppingCart,
    id: 'taminot',
    menyular: [
      { yol: '/admin/test/birja', nom: 'Birja RFQ', Ikonka: ShoppingCart },
      { yol: '/admin/test/invite', nom: 'Takliflar', Ikonka: UserPlus },
      { yol: '/admin/test/kontragent', nom: 'Kontragentlar', Ikonka: Building2 },
      { yol: '/admin/test/sklad', nom: 'Sklad (WMS)', Ikonka: Box },
    ]
  },
  {
    nom: 'ERP va Resurslar',
    Ikonka: Users,
    id: 'erp',
    menyular: [
      { yol: '/admin/test/erp', nom: 'Kadrlar, Texnika, HSE', Ikonka: LayoutDashboard },
    ]
  },
  {
    nom: 'Tizim va Xavfsizlik',
    Ikonka: ShieldAlert,
    id: 'tizim',
    menyular: [
      { yol: '/admin/test/sozlama', nom: 'Sozlamalar', Ikonka: Settings },
      { yol: '/admin/test/hujjat', nom: 'Obyekt Hujjatlari', Ikonka: Archive },
      { yol: '/admin/test/korzinka', nom: 'Korzinka', Ikonka: Trash2 },
    ]
  }
];

const ESKI_TIZIM_MENYU = [
  { yol: '/admin/obyektlar',  nom: 'Obyektlar',   Ikonka: Building2 },
  { yol: '/admin/f2',         nom: 'Ф2 импорт',    Ikonka: FileInput },
  { yol: '/admin/buxgalteriya', nom: 'Buxgalteriya', Ikonka: Calculator },
  { yol: '/admin/shartnomalar', nom: 'Shartnomalar', Ikonka: FileSignature },
  { yol: '/admin/fakturalar', nom: 'Fakturalar (Eski)', Ikonka: FileText },
  { yol: '/admin/f2-tayyorlash', nom: 'Ф2 тайёрлаш', Ikonka: FileOutput },
  { yol: '/admin/narxlar',    nom: 'Narxlar',      Ikonka: Tags },
  { yol: '/admin/ierarxiya',  nom: 'Ierarxiya',    Ikonka: Network },
  { yol: '/admin/sklad',      nom: 'Sklad',        Ikonka: Package },
  { yol: '/admin/monitoring', nom: 'Monitoring',   Ikonka: Activity },
  { yol: '/admin/kadrlar',    nom: 'Kadrlar',      Ikonka: HardHat },
  { yol: '/admin/texnika',    nom: 'Texnika',      Ikonka: Truck },
  { yol: '/admin/taminot',    nom: "Ta'minot",     Ikonka: ShoppingCart },
  { yol: '/admin/sifat',      nom: 'Sifat (QA)',   Ikonka: ShieldAlert },
  { yol: '/admin/fayl-boglash', nom: 'Fayl bog’lash', Ikonka: Link2 },
  { yol: '/admin/hujjatlar', nom: 'Hujjatlar', Ikonka: FileStack },
  { yol: '/admin/shaxsiy-smeta', nom: 'Shaxsiy smeta', Ikonka: NotebookPen },
  { yol: '/admin/supabase', nom: 'Supabase', Ikonka: Database },
  { yol: '/admin/tezlik', nom: 'Tezlik sinovi', Ikonka: Gauge },
  { yol: '/admin/sozlamalar', nom: 'Sozlamalar (eski)',   Ikonka: Settings },
];

export default function AdminShell() {
  const sess = useSessiya();
  const joy = useLocation();
  const [uch_D, setUch_D] = useState(() => localStorage.getItem('uchD') !== 'off');

  // Avtomatik ochish logikasi
  const eskiIchida = ESKI_TIZIM_MENYU.some((m) => joy.pathname.startsWith(m.yol));
  const [eskiOchiq, setEskiOchiq] = useState(eskiIchida);
  
  // Qaysi guruhlar ochiq ekanligini saqlash
  const [ochiqGuruhlar, setOchiqGuruhlar] = useState<Record<string, boolean>>(() => {
    const d: Record<string, boolean> = {};
    TIZIM_02_GURUHLAR.forEach(g => {
      // Agar ochiq sahifa shu guruhga tegishli bo'lsa, uni ochamiz
      if (g.menyular.some(m => joy.pathname.startsWith(m.yol))) {
        d[g.id] = true;
      } else {
        d[g.id] = true; // Default open for better visibility
      }
    });
    return d;
  });

  useEffect(() => { if (eskiIchida) setEskiOchiq(true); }, [eskiIchida]);

  const toggleGuruh = (id: string) => {
    setOchiqGuruhlar(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const barchaYollar = TIZIM_02_GURUHLAR.flatMap(g => g.menyular.map(m => m.yol)).concat(ESKI_TIZIM_MENYU.map(m => m.yol));
  menyuTekshirDev(barchaYollar);

  const OGIR = ['/admin/f2', '/admin/holat', '/admin/ierarxiya', '/admin/narxlar', '/admin/f2-tayyorlash'];
  const ogirSahifa = OGIR.some(y => joy.pathname.startsWith(y));

  useEffect(() => {
    if (sess.isError && sess.error?.message === "Sessiya yo'q") {
      console.warn("[AdminShell] sessiya tekshiruvi 401 qaytardi.");
    }
  }, [sess.isError, sess.error]);

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    window.location.href = '/';
  };

  if (sess.isLoading) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-text-dim text-sm">Kirish tekshirilmoqda…</p>
        </div>
      </div>
    );
  }

  const sessiyaYoq = sess.isError && (sess.error as Error)?.message === "Sessiya yo'q";

  if (sessiyaYoq) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle size={28} className="text-warn mx-auto mb-3" />
          <p className="text-text font-medium mb-1">Kirish talab qilinadi</p>
          <p className="text-text-dim text-sm mb-4">Sessiya topilmadi yoki muddati tugagan.</p>
          <button onClick={() => { window.location.href = '/'; }} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors">
            Kirish sahifasiga
          </button>
        </div>
      </div>
    );
  }

  if (sess.isError) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle size={28} className="text-warn mx-auto mb-3" />
          <p className="text-text font-medium mb-1">Server bilan aloqa yo'q</p>
          <p className="text-text-dim text-sm mb-1">Vaqtinchalik nosozlik.</p>
          <button onClick={() => sess.refetch()} disabled={sess.isFetching} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50">
            {sess.isFetching ? 'Tekshirilmoqda…' : 'Qayta urinish'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden text-white relative font-sans selection:bg-accent/30 bg-[#020617]">
      {!ogirSahifa && uch_D && (
        <div className="absolute inset-0 z-0 pointer-events-none">
           <Sahna3D />
        </div>
      )}

      <div className="absolute inset-0 z-0 bg-[url('/grid.svg')] opacity-[0.02] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-black/40 pointer-events-none" />

      {/* Sidebar - custom-scrollbar added for smooth scrolling on small laptops */}
      <aside className="relative z-10 w-64 xl:w-72 border-r border-white/10 bg-black/40 backdrop-blur-xl flex flex-col shadow-2xl">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]">
            <FlaskConical className="text-accent" size={18} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-text leading-tight tracking-wider">SMETA TIZIM 02</h1>
            <p className="text-[11px] text-text-dim uppercase tracking-wider font-medium mt-0.5 text-accent/80">👷 {sess.data?.rol ? sess.data.rol : 'Admin'}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          
          {TIZIM_02_GURUHLAR.map(guruh => (
            <div key={guruh.id} className="space-y-1">
              <button
                onClick={() => toggleGuruh(guruh.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-bold text-text-dim uppercase tracking-wider hover:text-text transition-colors group"
              >
                <guruh.Ikonka size={14} className="text-text-dim group-hover:text-accent transition-colors" />
                <span className="flex-1 text-left">{guruh.nom}</span>
                {ochiqGuruhlar[guruh.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <div className={`space-y-0.5 pl-2 ${ochiqGuruhlar[guruh.id] ? 'block' : 'hidden'}`}>
                {guruh.menyular.map(m => (
                  <NavLink
                    key={m.yol}
                    to={m.yol}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-[120ms] cursor-pointer relative ${
                        isActive
                          ? 'bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(var(--accent-rgb),0.2)]'
                          : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent rounded-r-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]" />}
                        <m.Ikonka className="w-[16px] h-[16px] flex-shrink-0" strokeWidth={isActive ? 2 : 1.5} />
                        <span className="truncate">{m.nom}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}

          <div className="h-px bg-white/10 my-4 mx-2" />

          {/* Eski Tizim */}
          <div>
            <button
              onClick={() => setEskiOchiq((v) => !v)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] font-bold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
            >
              <Archive size={14} />
              <span className="flex-1 text-left">Eski Tizim (Arxiv)</span>
              {eskiOchiq ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            <div className={`space-y-0.5 pl-2 mt-1 ${eskiOchiq ? 'block' : 'hidden'}`}>
              {ESKI_TIZIM_MENYU.map((m) => (
                <NavLink
                  key={m.yol}
                  to={m.yol}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors duration-[120ms] cursor-pointer ${
                      isActive
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                    }`
                  }
                >
                  <m.Ikonka className="w-[14px] h-[14px] flex-shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{m.nom}</span>
                </NavLink>
              ))}
            </div>
          </div>
          
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <button
            onClick={() => {
              const newVal = !uch_D;
              setUch_D(newVal);
              localStorage.setItem('uchD', newVal ? 'on' : 'off');
            }}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-text-dim hover:text-white hover:bg-white/5 transition-colors"
          >
            {uch_D ? <Eye className="w-[18px] h-[18px]" /> : <EyeOff className="w-[18px] h-[18px]" />}
            <span className="text-sm font-medium">3D Fon: {uch_D ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="text-sm font-medium">Tizimdan Chiqish</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      {sess.data && !sess.data.yozaOladi && (
        <div className="absolute top-0 left-64 xl:left-72 right-0 z-30 bg-warn/15 border-b border-warn/30 px-4 py-2 flex items-center gap-2 text-sm text-text backdrop-blur-sm">
          <AlertTriangle size={16} className="text-warn flex-shrink-0" />
          <span className="flex-1">
            Siz <strong>{sess.data.rol}</strong> rolida kirgansiz — bu rolda <strong>yozish mumkin emas</strong>.
            Admin bo'lib qayta kiring.
          </span>
          <button onClick={handleLogout} className="h-7 px-3 rounded-lg bg-warn/20 hover:bg-warn/30 text-text text-xs font-medium cursor-pointer">
            Chiqish
          </button>
        </div>
      )}

      <main className="relative z-10 flex-1 overflow-hidden flex flex-col bg-transparent">
        <Outlet />
      </main>

      <F2NavbatChip />
    </div>
  );
}
