import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSessiya } from '../api/hooks';
import { Activity, AlertTriangle, Archive, BarChart, Building2, Calculator, ChevronDown, ChevronRight, ClipboardList, Database, FileInput, FileOutput, FileSignature, FileStack, FileText, FlaskConical, FolderKanban, Gauge, HardHat, LayoutDashboard, Link2, LogOut, Map, Menu, Network, NotebookPen, Package, Settings, ShieldAlert, ShoppingCart, Tags, Truck, Users, X } from 'lucide-react';
import F2NavbatChip from '../umumiy/ui/F2NavbatChip';
import { menyuTekshirDev } from '../umumiy/marshrutTekshir';
import { KompaniyaProvider, useKompaniya } from '../umumiy/kontekst/KompaniyaKontekst';
import { KompaniyaTanlagich } from '../umumiy/kontekst/KompaniyaTanlagich';
import { RuxsatGuard } from '../umumiy/kontekst/RuxsatGuard';
import { tizimdanChiq } from '../umumiy/kontekst/chiqish';

const TIZIM_02_GURUHLAR = [
  {
    // GLOBAL — kompaniya tanlash SHART EMAS
    nom: 'Global',
    Ikonka: ShieldAlert,
    id: 'global',
    menyular: [
      { yol: '/admin/kompaniya', nom: 'Kompaniya', Ikonka: Building2 },
      { yol: '/admin/system-control', nom: 'Tizim boshqaruv markazi', Ikonka: ShieldAlert },
    ]
  },
  {
    // KOMPANIYA KONTEKSTI — tanlangan kompaniyaga tegishli
    nom: 'Kompaniya ishi',
    Ikonka: LayoutDashboard,
    id: 'asosiy',
    menyular: [
      { yol: '/admin/dashboard', nom: 'Dashboard', Ikonka: BarChart },
      { yol: '/admin/obyektlar', nom: 'Loyihalar va obyektlar', Ikonka: FolderKanban },
      { yol: '/admin/participants', nom: 'Loyiha ishtirokchilari', Ikonka: Users },
      { yol: '/admin/mindmap', nom: 'Mindmap', Ikonka: Map },
    ]
  },
  {
    nom: 'Operatsion Boshqaruv',
    Ikonka: HardHat,
    id: 'operatsion',
    menyular: [
      { yol: '/admin/holat', nom: 'PTO workbench · Smeta / LRV', Ikonka: FileText },
      { yol: '/admin/fakt', nom: 'Fakt · bajarilgan ishlar', Ikonka: ClipboardList },
      { yol: '/admin/f2-tayyorlash', nom: 'F2 tayyorlash', Ikonka: FileOutput },
      { yol: '/admin/f2', nom: 'F2 import', Ikonka: FileInput },
      { yol: '/admin/f2-tarix', nom: 'F2 tarixi / tasdiqlash', Ikonka: ClipboardList },
      { yol: '/admin/hujjat-nazorat', nom: 'Nakopitelniy / hujjat nazorati', Ikonka: FileOutput },
      { yol: '/admin/narxlar', nom: 'Narxlar nazorati', Ikonka: Tags },
      { yol: '/admin/documents', nom: 'Hujjatlar markazi', Ikonka: FileStack },
      { yol: '/admin/fayl-boglash', nom: 'Sinxronizatsiya', Ikonka: Link2 },
    ]
  },
  {
    nom: 'Sozlama',
    Ikonka: Settings,
    id: 'tizim',
    menyular: [
      { yol: '/admin/sozlamalar', nom: 'Sozlamalar', Ikonka: Settings },
      { yol: '/admin/storage', nom: 'Storage workspace', Ikonka: HardHat },
    ]
  }
];

const ESKI_TIZIM_MENYU = [
  { yol: '/admin/buxgalteriya', nom: 'Buxgalteriya', Ikonka: Calculator },
  { yol: '/admin/shartnomalar', nom: 'Shartnomalar', Ikonka: FileSignature },
  { yol: '/admin/fakturalar', nom: 'Fakturalar (Eski)', Ikonka: FileText },
  { yol: '/admin/ierarxiya',  nom: 'Ierarxiya',    Ikonka: Network },
  { yol: '/admin/sklad',      nom: 'Sklad',        Ikonka: Package },
  { yol: '/admin/monitoring', nom: 'Monitoring',   Ikonka: Activity },
  { yol: '/admin/kadrlar',    nom: 'Kadrlar',      Ikonka: HardHat },
  { yol: '/admin/texnika',    nom: 'Texnika',      Ikonka: Truck },
  { yol: '/admin/taminot',    nom: "Ta'minot",     Ikonka: ShoppingCart },
  { yol: '/admin/sifat',      nom: 'Sifat (QA)',   Ikonka: ShieldAlert },
  { yol: '/admin/hujjatlar', nom: 'Hujjatlar (eski)', Ikonka: FileStack },
  { yol: '/admin/shaxsiy-smeta', nom: 'Shaxsiy smeta', Ikonka: NotebookPen },
  { yol: '/admin/supabase', nom: 'Supabase', Ikonka: Database },
  { yol: '/admin/tezlik', nom: 'Tezlik sinovi', Ikonka: Gauge },
  { yol: '/admin/sozlamalar', nom: 'Sozlamalar (eski)',   Ikonka: Settings },
];

const ROUTE_LABELS: Array<[string, string]> = [
  ['/admin/dashboard', 'Dashboard'],
  ['/admin/obyektlar', 'Loyihalar va obyektlar'],
  ['/admin/holat', 'PTO workbench'],
  ['/admin/fakt', 'Fakt'],
  ['/admin/f2-tayyorlash', 'F2 tayyorlash'],
  ['/admin/f2', 'F2 import'],
  ['/admin/f2-tarix', 'F2 tarixi'],
  ['/admin/hujjat-nazorat', 'Nakopitelniy / hujjat nazorati'],
  ['/admin/narxlar', 'Narxlar nazorati'],
  ['/admin/documents', 'Hujjatlar markazi'],
  ['/admin/fayl-boglash', 'Sinxronizatsiya'],
  ['/admin/storage', 'Storage workspace'],
  ['/admin/participants', 'Loyiha ishtirokchilari'],
  ['/admin/mindmap', 'Mindmap'],
  ['/admin/kompaniya', 'Kompaniya'],
  ['/admin/system-control', 'Tizim boshqaruv markazi'],
  ['/admin/sozlamalar', 'Sozlamalar'],
];
function routeLabel(pathname: string) {
  return ROUTE_LABELS.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] ?? 'Workspace';
}

function routeContext(pathname: string, search: string) {
  const params = new URLSearchParams(search);
  const loyiha = params.get('loyiha') ?? params.get('project');
  const loyihaNomi = params.get('loyiha_nomi') ?? params.get('project_name') ?? params.get('projectName');
  const objectFromQuery = params.get('obyekt') ?? params.get('object');
  const objectNomi = params.get('obyekt_nomi') ?? params.get('object_name') ?? params.get('objectName');
  const objectFromPath = pathname.match(/^\/admin\/holat\/([^/]+)/)?.[1];
  const format = (label: string, value: string | null | undefined, name: string | null | undefined) => {
    if (name) {
      let decodedName = name;
      try { decodedName = decodeURIComponent(name); } catch { /* keep the URL value */ }
      return `${label}: ${decodedName}`;
    }
    return value ? `${label} tanlangan` : null;
  };
  return [format('Loyiha', loyiha, loyihaNomi), format('Obyekt', objectFromQuery ?? objectFromPath, objectNomi)].filter(Boolean).join(' · ');
}

export default function AdminShell() {
  return (
    <KompaniyaProvider>
      <AdminShellInner />
    </KompaniyaProvider>
  );
}

/** T2-COMPANY-CONTROL-CLOSEOUT Phase A P0 #1/#2: the sidebar and the role
 * badge used to read `sess.data?.rol` — ONE global role from /api/sessiya,
 * ignoring which company is active. A user who is "boss" in company A and
 * "pto" in company B saw the SAME (wrong) menu after switching. This inner
 * component sits INSIDE <KompaniyaProvider/> so it can read the per-company
 * effective role (`joriy.rol`, re-derived from t2_men_v1 on every company
 * switch) instead. */
function AdminShellInner() {
  const sess = useSessiya();
  const k = useKompaniya();
  const joy = useLocation();
  const [sidebarOchiq, setSidebarOchiq] = useState(false);
  // Effective role for THIS render: the active company's own membership
  // role, or a platform-level label when no company is selected. Never the
  // stale global session role.
  const effektivRol: string = k.globalRejim ? 'superadmin' : (k.joriy?.rol ?? '');

  // Avtomatik ochish logikasi
  const eskiIchida = ESKI_TIZIM_MENYU.some((m) => joy.pathname.startsWith(m.yol));
  // Texnik/legacy modullar oddiy PTO operatoriga birinchi ko'rinishda
  // aralashmaydi. Eski URL bevosita ochilsa, navigatsiya o'z-o'zidan ochiladi.
  const [eskiOchiq, setEskiOchiq] = useState(false);
  
  // Qaysi guruhlar ochiq ekanligini saqlash
  const [ochiqGuruhlar, setOchiqGuruhlar] = useState<Record<string, boolean>>(() => {
    const d: Record<string, boolean> = {};
    TIZIM_02_GURUHLAR.forEach(g => {
      // Agar ochiq sahifa shu guruhga tegishli bo'lsa, uni ochamiz
      if (g.menyular.some(m => joy.pathname.startsWith(m.yol))) {
        d[g.id] = true;
      } else {
        d[g.id] = g.id === 'asosiy' || g.id === 'operatsion';
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

  useEffect(() => {
    if (sess.isError && sess.error?.message === "Sessiya yo'q") {
      console.warn("[AdminShell] sessiya tekshiruvi 401 qaytardi.");
    }
  }, [sess.isError, sess.error]);

  const handleLogout = tizimdanChiq;
  const activeRouteLabel = routeLabel(joy.pathname);
  const activeScopeLabel = routeContext(joy.pathname, joy.search);

  if (sess.isLoading) {
    return (
      <div className="os-auth-state">
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
      <div className="os-auth-state">
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
      <div className="os-auth-state">
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

  // Master Plan 4. ROLLAR VA WORKSPACE — endi JORIY KOMPANIYADAGI effektiv
  // roldan (`effektivRol`), sessiyadagi bitta global roldan EMAS. Shu tufayli
  // A kompaniyada boss / B kompaniyada pto bo'lgan foydalanuvchi kompaniya
  // almashtirganda menyu HAM almashadi (Antigravity FINAL-AUDIT-002 P0 #1/#2).
  //
  // 'global' (Kompaniya, Tizim boshqaruv markazi) va 'tizim' (Sozlama)
  // guruhlari HAR DOIM ko'rinadi — /admin/kompaniya har bir a'zoning o'z
  // profili/kompaniyasini boshqaradigan universal markazi, rolga bog'liq
  // emas. Faqat kompaniya-ish ('asosiy'/'operatsion') roldan kelib chiqib
  // filtrlanadi. Server tomon (RuxsatGuard, RPC ichidagi tekshiruv) yakuniy
  // qo'riqchi — bu yerdagi filtr faqat menyu tuzilishi, xavfsizlik chegarasi
  // EMAS.
  const filtrKilinganGuruhlar = TIZIM_02_GURUHLAR.map(g => {
    if (g.id === 'global' || g.id === 'tizim') return g;
    let allowedMenus = g.menyular;
    if (effektivRol === 'prorab') {
      // Prorab: obyektlar, Fakt va kerakli hujjatlarni ko'radi.
      const prorab = new Set(['/admin/obyektlar', '/admin/fakt', '/admin/documents']);
      allowedMenus = allowedMenus.filter((m) => prorab.has(m.yol));
    } else if (effektivRol === 'pto') {
      // PTO: smeta, Fakt, F2, Nakopitelniy va narx manbasi.
      const pto = ['/admin/dashboard', '/admin/obyektlar', '/admin/holat', '/admin/fakt', '/admin/f2', '/admin/f2-tayyorlash', '/admin/f2-tarix', '/admin/hujjat-nazorat', '/admin/narxlar', '/admin/documents'];
      allowedMenus = allowedMenus.filter((m) => pto.includes(m.yol));
    } else if (effektivRol === 'bugalter') {
      const moliya = ['/admin/dashboard', '/admin/fakt', '/admin/f2-tarix', '/admin/hujjat-nazorat', '/admin/documents'];
      allowedMenus = allowedMenus.filter((m) => moliya.includes(m.yol));
    } else if (effektivRol === 'rahbar' || effektivRol === 'boss' || effektivRol === 'admin' || effektivRol === 'superadmin') {
      // Ruxsat hammasiga
    } else if (effektivRol === 'buyurtmachi' || effektivRol === 'pudratchi' || effektivRol === 'kuzatuvchi') {
      // Faqat obyektlar va dashboard (o'qish uchun); yozuv serverda tekshiriladi.
      allowedMenus = allowedMenus.filter((m) => ['/admin/dashboard', '/admin/obyektlar', '/admin/documents'].includes(m.yol));
    } else {
      allowedMenus = []; // Kompaniya hali tanlanmagan yoki noma'lum rol
    }
    return { ...g, menyular: allowedMenus };
  }).filter(g => g.menyular.length > 0);

  return (
    <div className="os-app-shell flex h-[100dvh] min-h-0 overflow-hidden text-white relative font-sans selection:bg-accent/30">

      {sidebarOchiq && <button aria-label="Menyuni yopish" className="os-sidebar-backdrop" onClick={() => setSidebarOchiq(false)} />}

      {/* Sidebar. Mobil ekranlarda u drawer; katta ekranda doimiy ishchi nav. */}
      <aside className={`os-sidebar relative z-30 w-64 xl:w-72 border-r backdrop-blur-xl flex flex-col ${sidebarOchiq ? 'os-sidebar--open' : ''}`}>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="os-brand-mark w-8 h-8 rounded-lg flex items-center justify-center">
            <FlaskConical className="text-white" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-bold text-text leading-tight tracking-wider">SMETA TIZIM 02</h1>
            <p className="text-[11px] text-text-dim uppercase tracking-wider font-medium mt-0.5 text-accent/80">
              👑 {k.globalRejim ? 'Global (superadmin)' : (k.joriy?.rol || (k.yuklanmoqda ? '…' : 'Kompaniya tanlanmagan'))}
            </p>
          </div>
          <button aria-label="Menyuni yopish" className="os-mobile-only rounded-lg p-1.5 text-text-dim hover:bg-white/5" onClick={() => setSidebarOchiq(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4">
          
          {filtrKilinganGuruhlar.map(guruh => (
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
                      end={m.yol !== '/admin/holat' && m.yol !== '/admin/obyektlar'}
                      onClick={() => setSidebarOchiq(false)}
                    className={({ isActive }) =>
                      `os-nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors duration-[120ms] cursor-pointer relative ${
                        isActive
                          ? 'os-nav-link--active'
                          : ''
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
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
              <span className="flex-1 text-left">Barcha Modullar (ERP & Tizim_01)</span>
              
            </button>
            <div className={`space-y-0.5 pl-2 mt-1 ${eskiOchiq ? 'block' : 'hidden'}`}>
              {ESKI_TIZIM_MENYU.map((m) => (
                <NavLink
                  key={m.yol}
                  to={m.yol}
                  onClick={() => setSidebarOchiq(false)}
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
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span className="text-sm font-medium">Tizimdan Chiqish</span>
          </button>
        </div>
      </aside>

      <main className="os-workspace relative z-10 min-w-0 min-h-0 flex-1 overflow-hidden flex flex-col">
        {/* YAGONA kompaniya + loyiha ish konteksti. Sahifa sarlavhasi URLdan
            o'qiladi, shuning uchun foydalanuvchi qaysi ish makonida ekanini
            har doim ko'radi va back/refreshdan keyin ham yo'qolmaydi. */}
        <div className="os-context-bar flex-shrink-0 flex items-center gap-3 px-4 sm:px-6 py-2.5 border-b backdrop-blur-sm z-20">
          <button aria-label="Menyuni ochish" className="os-mobile-only os-menu-button" onClick={() => setSidebarOchiq(true)}>
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <KompaniyaTanlagich />
            <span className="os-context-divider" aria-hidden="true">/</span>
            <span className="os-route-label truncate" aria-current="page">{activeRouteLabel}</span>
            {activeScopeLabel && <><span className="os-context-divider" aria-hidden="true">/</span><span className="os-route-context truncate">{activeScopeLabel}</span></>}
          </div>
          <span className="os-live-pill" title="Kanonik ma'lumotlar serverdan o'qiladi"><span className="os-live-dot" /> Live data</span>
        </div>

        {sess.data && !sess.data.yozaOladi && (
          <div className="flex-shrink-0 z-20 bg-warn/15 border-b border-warn/30 px-6 py-2 flex items-center gap-2 text-sm text-text backdrop-blur-sm">
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

        <div className="os-route-viewport flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
          <RuxsatGuard />
        </div>
      </main>

      <F2NavbatChip />
    </div>
  );
}
