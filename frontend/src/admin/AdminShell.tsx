import { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useSessiya } from '../api/hooks';
import { AlertTriangle, ChevronDown, ChevronRight, Archive, Eye, EyeOff } from 'lucide-react';
import { LogOut, Building2, FileInput, FileSignature, Package, Activity, Tags, Network, Calculator, FileOutput, HardHat, Truck, ShoppingCart, ShieldAlert, Settings, FileText, Link2, FileStack, NotebookPen, Database, Gauge, FlaskConical } from 'lucide-react';
import Sahna3D from '../kirish/Sahna3DXavfsiz';
import F2NavbatChip from '../umumiy/ui/F2NavbatChip';
import { menyuTekshirDev } from '../umumiy/marshrutTekshir';

/* ⚡ 2026-08-27 (Claude, foydalanuvchi ko'rsatmasi: "Tizim_02 endi
 * asosiy tizim bo'lishi shart... Tizim_01 ni... bitta alohida yopiq
 * tab yoki route ichiga olib o't"):
 *
 * Marshrutlarning o'zi (App.tsx) O'ZGARMAGAN — Tizim_01 ning hech bir
 * sahifasi ko'chirilmagan, hech bir chuqur havola (bookmark, eski
 * yorliq) buzilmagan. O'zgargani — SIDEBAR TUZILISHI: Tizim_02 tepada,
 * yagona ustuvor bo'lim; Tizim_01 ning hammasi pastda BITTA yopiq
 * ("Eski Tizim / Arxiv") bo'lim ichiga yig'ilgan, standart holatda
 * YOPIQ. Route darajasida ko'chirish (masalan `/admin/eski/...`) katta
 * qayta yozishni talab qilardi va `holat/:id` kabi parametrli
 * marshrutlarda yangi xato manbai bo'lardi — bu yerda foyda xavfga
 * arzimaydi. */
const ESKI_TIZIM_MENYU = [
  { yol: '/admin/obyektlar',  nom: 'Obyektlar',   Ikonka: Building2 },
  { yol: '/admin/f2',         nom: 'Ф2 импорт',    Ikonka: FileInput },
  { yol: '/admin/buxgalteriya', nom: 'Buxgalteriya', Ikonka: Calculator },
  /* ⚠️ 2026-08-17: bu yerda `/admin/shartnoma` (birlikda) yozilgan edi,
     App.tsx dagi marshrut esa `shartnomalar` (ko'plikda). Hech qanday
     marshrut mos kelmagani uchun so'rov `<Route path="*">` ga tushardi,
     u esa `/` ga — YA'NI KIRISH SAHIFASIGA yo'naltiradi.
     Foydalanuvchi: «шартномалар табига кирсам кириш менюсига чиқариб
     ташлаяпди». Sababi sessiya EMAS, oddiy nom xatosi edi.
     Pastdagi `_MENYU_TEKSHIR` shu turdagi xatoni endi darhol ushlaydi. */
  { yol: '/admin/shartnomalar', nom: 'Shartnomalar', Ikonka: FileSignature },
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
  { yol: '/admin/fayl-boglash', nom: 'Fayl bog’lash', Ikonka: Link2 },
  { yol: '/admin/hujjatlar', nom: 'Hujjatlar', Ikonka: FileStack },
  { yol: '/admin/shaxsiy-smeta', nom: 'Shaxsiy smeta', Ikonka: NotebookPen },
  { yol: '/admin/supabase', nom: 'Supabase', Ikonka: Database },
  { yol: '/admin/tezlik', nom: 'Tezlik sinovi', Ikonka: Gauge },
  { yol: '/admin/sozlamalar', nom: 'Sozlamalar (eski)',   Ikonka: Settings },
];

/* Yangi asosiy sahna — bitta yo'l, TestShell o'z ichki menyusini beradi. */
const MENYU = [{ yol: '/admin/test', nom: '⭐ Tizim_02 (Asosiy)', Ikonka: FlaskConical }];

export default function AdminShell() {
  const sess = useSessiya();
  const joy = useLocation();
  /* 3D background toggle state */
  const [uch_D, setUch_D] = useState(() => localStorage.getItem('uchD') !== 'off');

  /* Eski tizim ostida turilsa avtomatik ochiq boshlansin — aks holda
     foydalanuvchi qayerdaligini yo'qotadi. */
  const eskiIchida = ESKI_TIZIM_MENYU.some((m) => joy.pathname.startsWith(m.yol));
  const [eskiOchiq, setEskiOchiq] = useState(eskiIchida);
  useEffect(() => { if (eskiIchida) setEskiOchiq(true); }, [eskiIchida]);

  /* ⚠️ 2026-08-17: menyu havolalari marshrutlar bilan mos kelishini DEV da
     tekshiramiz. `/admin/shartnoma` ↔ `shartnomalar` nom xatosi
     foydalanuvchini kirish sahifasiga otib yuborardi va bu turdagi xatoni
     na TypeScript, na lint ko'radi (ikkisi ham oddiy matn).
     Produksiyada bu chaqiruv hech narsa qilmaydi. */
  menyuTekshirDev([...MENYU, ...ESKI_TIZIM_MENYU].map((m) => m.yol));

  /* ⚡ Og'ir ish sahifalari — bu yerda 3D bezak fon o'chiriladi (pastga qara) */
  const OGIR = ['/admin/f2', '/admin/holat', '/admin/ierarxiya', '/admin/narxlar', '/admin/f2-tayyorlash'];
  const ogirSahifa = OGIR.some(y => joy.pathname.startsWith(y));

  /* WARN 2026-08-17: bu yerda avval JIM OTIB YUBORISH bor edi — cookie
     O’CHIRILAR va foydalanuvchi hech qanday tushuntirishsiz kirish sahifasiga
     tashlanardi. Foydalanuvchi: "shartnomalar tabiga kirsam kirish paneliga
     qaytarib yuborayapdi" — nima uchunligini bilishning YO’LI YO’Q edi va
     men ham uzoq vaqt sababni topa olmadim.
     
     Ikki zarari bor edi:
       1) cookie o’chirilgach, holat qaytarib bo’lmas: agar 401 vaqtinchalik
          bo’lsa ham foydalanuvchi HAQIQATAN chiqib qoladi;
       2) sabab ko’rinmaydi — shikoyat "o’zi chiqarib tashlayapdi" bo’lib
          qoladi, tekshirish uchun hech narsa qolmaydi.
     
     ENDI: avtomatik yo’naltirish YO’Q. Pastdagi ekran sababni ko’rsatadi va
     kirish sahifasiga o’tishni FOYDALANUVCHI hal qiladi. Cookie faqat o’sha
     tugma bosilganda yoki "Чиқиш" da o’chiriladi. */
  useEffect(() => {
    if (sess.isError && sess.error?.message === "Sessiya yo'q") {
      console.warn("[AdminShell] sessiya tekshiruvi 401 qaytardi — avtomatik " +
                   "chiqarilmadi, foydalanuvchiga sabab ko’rsatildi.");
    }
  }, [sess.isError, sess.error]);

  const handleLogout = () => {
    document.cookie = 'sess=; Max-Age=0; path=/';
    window.location.href = '/';
  };

  /* ⚡⚡⚡ 2026-08-16 KIRISH DARVOZASI (audit H17).
   *
   * MA'LUMOT XAVFSIZLIGI ALLAQACHON BOR: `functions/api/gas.ts` sessiyasiz
   * so'rovga 401, rahbar rolida yozishga 403 qaytaradi — ya'ni URL ni
   * qo'lda yozib kirgan odam HECH QANDAY ma'lumot ololmaydi.
   *
   * LEKIN sessiya tekshiruvi tugagunicha admin oynasi (menyu, sarlavhalar)
   * bir zum KO'RINIB turardi va faqat keyin login sahifasiga otib
   * yuborardi. Bu chalg'itadi va tizim «ochiq» degan taassurot qoldiradi.
   * Endi tekshiruv tugamaguncha faqat yuklanish ko'rsatiladi. */
  if (sess.isLoading) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full
                          animate-spin mx-auto mb-3" />
          <p className="text-text-dim text-sm">Kirish tekshirilmoqda…</p>
        </div>
      </div>
    );
  }
  /* ⚠️ 2026-08-17: avval BITTA shart — `if (sess.isError)` — barcha xatoni
   * «Kirish talab qilinadi» deb ko'rsatardi. Ya'ni tarmoq bir zum uzilsa yoki
   * Cloudflare 524 bersa, foydalanuvchi SESSIYASI BUTUN bo'lgani holda
   * «sessiya tugagan» ekranini ko'rib, boshidan kirishga majbur bo'lardi
   * («шартномалар табига кирсам кириш менюсига чиқариб ташлаяпди»).
   *
   * ENDI ikkiga bo'lindi:
   *   1) HAQIQATAN sessiya yo'q (401/403) → kirish sahifasiga
   *   2) vaqtinchalik nosozlik        → «Qayta urinish» (cookie TEGILMAYDI,
   *      chunki sessiya butun; sahifani qayta yuklash shart emas) */
  const sessiyaYoq = sess.isError && (sess.error as Error)?.message === "Sessiya yo'q";

  if (sessiyaYoq) {
    return (
      <div className="h-screen bg-[#020617] flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertTriangle size={28} className="text-warn mx-auto mb-3" />
          <p className="text-text font-medium mb-1">Kirish talab qilinadi</p>
          <p className="text-text-dim text-sm mb-4">
            Sessiya topilmadi yoki muddati tugagan.
          </p>
          <button onClick={() => { window.location.href = '/'; }}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium
                       hover:bg-accent/90 transition-colors">
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
          <p className="text-text-dim text-sm mb-1">
            Sessiyangiz joyida — bu vaqtinchalik nosozlik.
          </p>
          <p className="text-text-mute text-[12px] mb-4 font-mono">
            {(sess.error as Error)?.message || 'noma\'lum xato'}
          </p>
          <button onClick={() => sess.refetch()}
            disabled={sess.isFetching}
            className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium
                       hover:bg-accent/90 transition-colors disabled:opacity-50">
            {sess.isFetching ? 'Tekshirilmoqda…' : 'Qayta urinish'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden text-white relative font-sans selection:bg-accent/30 bg-[#020617]">
      {/* ⚡⚡⚡ 2026-08-14 MUZLASH SABABI (foydalanuvchi taxmini TO'G'RI chiqdi:
          «animatsiyalari yoki shunaqa 2-darajali ishlar uchun bo'lmayaptimi?»).
          Sahna3D — to'liq WebGL sahna: EffectComposer + Bloom +
          ChromaticAberration + Noise + Vignette post-ishlov, ustiga
          MeshTransmissionMaterial (shisha sinishi — three.js dagi eng qimmat
          materiallardan), 6 ta `useFrame` sikli. U HAR KADRDA (60 fps)
          uzluksiz ishlaydi va GPU/CPU ni yeydi.
          Yengil sahifada bu bilinmaydi, lekin F2 import 13 000+ DOM tugun
          bilan birga kelganda ikkalasi resurs uchun kurashadi va sahifa
          MUZLAB qoladi.
          YECHIM: bezak fon faqat YENGIL sahifalarda. Ish sahifalarida
          (F2 import, Holat, Ierarxiya, Narxlar) o'chiriladi — bu yerda
          tezlik chiroylikdan muhimroq. */}
      {!ogirSahifa && uch_D && (
        <div className="absolute inset-0 z-0 pointer-events-none">
           <Sahna3D />
        </div>
      )}

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
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-bold
                 transition-colors duration-[120ms] cursor-pointer ${
                   isActive
                     ? 'bg-[var(--accent)]/15 text-accent'
                     : 'text-text hover:bg-surface-2'
                 }`
              }
            >
              <m.Ikonka className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              <span>{m.nom}</span>
            </NavLink>
          ))}

          {/* ⚡ 2026-08-27: Tizim_01 — yopiq (default), foydalanuvchi
              ko'rsatmasi bilan "alohida yopiq tab" sifatida yig'ilgan. */}
          <button
            onClick={() => setEskiOchiq((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2 mt-3 rounded-lg text-sm font-medium
                       text-text-dim hover:bg-surface-2 hover:text-text transition-colors cursor-pointer
                       border-t border-white/10 pt-3"
          >
            <Archive className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
            <span className="flex-1 text-left">Eski Tizim (Arxiv)</span>
            {eskiOchiq ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {eskiOchiq && (
            <div className="pl-2 space-y-1 border-l border-white/10 ml-4">
              {ESKI_TIZIM_MENYU.map((m) => (
                <NavLink
                  key={m.yol}
                  to={m.yol}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium
                     transition-colors duration-[120ms] cursor-pointer ${
                       isActive
                         ? 'bg-[var(--accent)]/10 text-accent'
                         : 'text-text-dim hover:bg-surface-2 hover:text-text'
                     }`
                  }
                >
                  <m.Ikonka className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
                  <span>{m.nom}</span>
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={() => {
              const newVal = !uch_D;
              setUch_D(newVal);
              localStorage.setItem('uchD', newVal ? 'on' : 'off');
            }}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-text hover:bg-surface-2 transition-colors"
          >
            {uch_D ? <Eye className="w-5 h-5 text-text-dim" /> : <EyeOff className="w-5 h-5 text-text-dim" />}
            <span className="text-sm">3D Animatsiya: {uch_D ? 'ON' : 'OFF'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-lg text-text hover:bg-surface-2 transition-colors"
          >
            <LogOut className="w-5 h-5 text-text-dim" />
            <span className="text-sm">Чиқиш</span>
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

      {/* ⚡ 2026-08-16: fon rejimidagi Ф2 yozish ishi ISTALGAN sahifada
          ko'rinib turadi — «yangi import bossam joriy navbatdagini
          ko'ra olmayman» muammosi. Faol ish bo'lmasa hech narsa chizmaydi. */}
      <F2NavbatChip />
    </div>
  );
}
