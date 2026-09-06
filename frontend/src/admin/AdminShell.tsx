import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSessiya } from '../api/hooks';
import { AlertTriangle, ChevronDown, ChevronRight, Archive, ShieldCheck } from 'lucide-react';
import { Map, LogOut, Building2, FileInput, FileSignature, Package, Activity, Tags, Network, Calculator, FileOutput, HardHat, Truck, ShoppingCart, ShieldAlert, Settings, FileText, Link2, FileStack, NotebookPen, Database, Gauge, FlaskConical, LayoutDashboard, BarChart, CalendarDays, Upload, ClipboardList, BookOpen, Briefcase, CreditCard, UserPlus, Box, Trash2, Users, FolderKanban } from 'lucide-react';
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
      { yol: '/admin/dashboard', nom: 'Rahbar paneli', Ikonka: BarChart },
      { yol: '/admin/test/portfel', nom: 'Loyihalar va Obyektlar', Ikonka: FolderKanban },
      { yol: '/admin/participants', nom: 'Loyiha ishtirokchilari', Ikonka: Users },
      { yol: '/admin/documents', nom: 'Hujjatlar', Ikonka: FileStack },
      { yol: '/admin/hujjat-nazorat', nom: 'Hujjat nazorati (F2/Nakopitelniy)', Ikonka: FileOutput },
      { yol: '/admin/fakt', nom: 'Bajarilgan ishlar (Fakt)', Ikonka: ClipboardList },
        { yol: '/admin/mindmap', nom: 'Mindmap (Xarita)', Ikonka: Map },
      { yol: '/admin/test/crm', nom: 'Tashqi Aloqa (CRM/EDO)', Ikonka: Users },
    ]
  },
  {
    nom: 'Operatsion Boshqaruv',
    Ikonka: HardHat,
    id: 'operatsion',
    menyular: [
      { yol: '/admin/test/smeta', nom: 'Smeta va F2 Import', Ikonka: FileInput },
        { yol: '/admin/test/moliya', nom: 'Moliya va Shartnomalar', Ikonka: Briefcase },
      { yol: '/admin/test/logistika', nom: 'Ta\'minot va Sklad', Ikonka: Box },
        { yol: '/admin/test/zayavka', nom: 'Zayavkalar (PTO)', Ikonka: ClipboardList },
        { yol: '/admin/test/aosr', nom: 'QA/QC (AOSR/APPOK)', Ikonka: ShieldCheck },
      { yol: '/admin/test/erp', nom: 'Kadrlar, Texnika (ERP)', Ikonka: Users },
    ]
  },
  {
    nom: 'Sozlama',
    Ikonka: Settings,
    id: 'tizim',
    menyular: [
      { yol: '/admin/test/sozlama', nom: 'Sozlamalar', Ikonka: Settings },
      { yol: '/admin/storage', nom: 'Fayl saqlash (Storage)', Ikonka: HardHat },
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
  // Effective role for THIS render: the active company's own membership
  // role, or a platform-level label when no company is selected. Never the
  // stale global session role.
  const effektivRol: string = k.globalRejim ? 'superadmin' : (k.joriy?.rol ?? '');

  // Avtomatik ochish logikasi
  const eskiIchida = ESKI_TIZIM_MENYU.some((m) => joy.pathname.startsWith(m.yol));
  const [eskiOchiq, setEskiOchiq] = useState(true);
  
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

  useEffect(() => {
    if (sess.isError && sess.error?.message === "Sessiya yo'q") {
      console.warn("[AdminShell] sessiya tekshiruvi 401 qaytardi.");
    }
  }, [sess.isError, sess.error]);

  const handleLogout = tizimdanChiq;

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
      // Prorab faqat Logistika (Sklad) va Loyihalar(Fakt) ko'radi
      if (g.id === 'asosiy') allowedMenus = allowedMenus.filter(m => m.yol.includes('portfel'));
      else if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('logistika'));
    } else if (effektivRol === 'pto') {
      // PTO Portfel va Moliya(Smeta/F2)
      if (g.id === 'asosiy') allowedMenus = allowedMenus.filter(m => m.yol.includes('portfel'));
      else if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya') || m.yol.includes('smeta'));
    } else if (effektivRol === 'bugalter') {
      // Bugalter Moliya, CRM
      if (g.id === 'asosiy') allowedMenus = allowedMenus.filter(m => m.yol.includes('crm'));
      else if (g.id === 'operatsion') allowedMenus = allowedMenus.filter(m => m.yol.includes('moliya') || m.yol.includes('smeta'));
    } else if (effektivRol === 'rahbar' || effektivRol === 'boss' || effektivRol === 'admin' || effektivRol === 'superadmin') {
      // Ruxsat hammasiga
    } else if (effektivRol === 'buyurtmachi' || effektivRol === 'pudratchi' || effektivRol === 'kuzatuvchi') {
      // Faqat portfel (o'qish uchun) — yozuv ruxsati alohida serverda tekshiriladi
      if (g.id === 'asosiy') allowedMenus = allowedMenus.filter(m => m.yol.includes('portfel'));
      else allowedMenus = [];
    } else {
      allowedMenus = []; // Kompaniya hali tanlanmagan yoki noma'lum rol
    }
    return { ...g, menyular: allowedMenus };
  }).filter(g => g.menyular.length > 0);

  return (
    <div className="os-app-shell flex h-screen overflow-hidden text-white relative font-sans selection:bg-accent/30">

      {/* Sidebar - custom-scrollbar added for smooth scrolling on small laptops */}
      <aside className="os-sidebar relative z-10 w-64 xl:w-72 border-r backdrop-blur-xl flex flex-col">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="os-brand-mark w-8 h-8 rounded-lg flex items-center justify-center">
            <FlaskConical className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-text leading-tight tracking-wider">SMETA TIZIM 02</h1>
            <p className="text-[11px] text-text-dim uppercase tracking-wider font-medium mt-0.5 text-accent/80">
              👑 {k.globalRejim ? 'Global (superadmin)' : (k.joriy?.rol || (k.yuklanmoqda ? '…' : 'Kompaniya tanlanmagan'))}
            </p>
          </div>
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

      <main className="os-workspace relative z-10 flex-1 overflow-hidden flex flex-col">
        {/* YAGONA kompaniya konteksti — barcha /admin/* sahifalari shuni ishlatadi */}
        <div className="os-context-bar flex-shrink-0 flex flex-wrap items-center gap-3 px-6 py-2 border-b backdrop-blur-sm z-20">
          <KompaniyaTanlagich />
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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <RuxsatGuard />
        </div>
      </main>

      <F2NavbatChip />
    </div>
  );
}
