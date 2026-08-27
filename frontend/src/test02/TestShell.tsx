/**
 * TestShell.tsx — TIZIM_02 (SUPABASE SINOV MUHITI)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Foydalanuvchi: «man hozirgi ishlab turgan tizimni barbod qilgim yo'q,
 * u ham turaversin. Hozir Tizim_01 da turibdi-ku hamma tizimimiz —
 * xuddi shunday Tizim_02 test sifatida ochilishi kerak».
 *
 * SHU BO'LIM NIMA:
 *   • Mavjud panelga (Tizim_01) MUTLAQO TEGMAYDI. Uning bironta fayli
 *     o'zgartirilmaydi, bironta marshruti almashtirilmaydi.
 *   • Bu yerdagi sahifalar ma'lumotni SUPABASE'dan oladi (`/api/sb`),
 *     GAS orqali emas.
 *   • Maqsad: og'ir smeta daraxtlari, keyinchalik F2 yozuvi — hammasi
 *     shu yerda sinaladi. Ishonch hosil bo'lgach Tizim_01 ga o'tkaziladi.
 *
 * ⚠️ IKKI QAT'IY QOIDA:
 *   1) Bu bo'limda YOZISH YO'Q (hozircha). Faqat o'qish. Yozuv qo'shilsa
 *      — u avval IKKALA tomonga yozib, natijani solishtiradigan bo'ladi.
 *   2) Ekranda doim «SINOV» belgisi turadi. Foydalanuvchi qaysi tizimda
 *      turganini bir qarashda bilishi shart — aks holda sinov ma'lumoti
 *      haqiqat deb qabul qilinadi.
 */
import { Outlet, NavLink } from 'react-router-dom';
import { KompaniyaProvider, KompaniyaTanlagich } from './KompaniyaTanlov';
import { Trash2, FlaskConical, Building2, Network, ArrowLeft, Upload, Tags,
         Box, ShoppingCart, UserPlus, CreditCard, FileText, Archive, Briefcase,
         BarChart, Settings, LayoutDashboard, CalendarDays, BookOpen, ClipboardList } from 'lucide-react';

/* ⚠️ 2026-08-27: foydalanuvchi ko'rsatmasi bilan qayta tuzildi —
 *   - "Smeta yuklash" / "F2 Fakt" / "F2 import" BITTA tabga
 *     birlashtirildi (TestSmeta.tsx ichki sub-tab bilan).
 *   - "Smeta daraxti" olib tashlandi (vazifasi noaniq/keraksiz edi).
 *   - "GAS o'qish tezligi" va "Tezlik sinovi" olib tashlandi (kerak emas).
 *   - "Audit & Loglar" tepadagi menyudan olib tashlandi — Sozlamalar
 *     ichiga ko'chirildi (pastda link sifatida qoladi).
 */
const TEST_MENYU = [
  { yol: '/admin/test/import',    nom: 'Smeta / F2 / Fakt', Ikonka: Upload },
  { yol: '/admin/test/grafik',    nom: 'Grafik',        Ikonka: CalendarDays },
  { yol: '/admin/test/spravochnik',nom: 'Ish turlari (Spravochnik)',  Ikonka: BookOpen },
  { yol: '/admin/test/obyektlar', nom: 'Obyektlar',    Ikonka: Building2 },
  { yol: '/admin/test/narxlar',   nom: 'Narxlar',      Ikonka: Tags },
  { yol: '/admin/test/shartnomalar', nom: 'Shartnomalar', Ikonka: Briefcase },
  { yol: '/admin/test/xarita',    nom: 'Mind Map', Ikonka: Network },
  { yol: '/admin/test/sklad',     nom: 'Sklad',        Ikonka: Box },
  { yol: '/admin/test/birja',     nom: 'Birja RFQ',    Ikonka: ShoppingCart },
  { yol: '/admin/test/invite',    nom: 'Takliflar',    Ikonka: UserPlus },
  { yol: '/admin/test/tolov',     nom: 'To\'lov',       Ikonka: CreditCard },
  { yol: '/admin/test/faktura',   nom: 'EHF (Didox)',  Ikonka: FileText },
  { yol: '/admin/test/hujjat',    nom: 'Obyekt hujjatlari', Ikonka: Archive },
  { yol: '/admin/test/aosr',      nom: 'АОСР (yashirin ish)', Ikonka: ClipboardList },
  { yol: '/admin/test/hisobot',   nom: 'Boss Tahlil',  Ikonka: BarChart },
  { yol: '/admin/test/erp',       nom: 'ERP Boshqaruv', Ikonka: LayoutDashboard },
  { yol: '/admin/test/sozlama',   nom: 'Sozlamalar',   Ikonka: Settings },
  { yol: '/admin/test/korzinka',  nom: 'Korzinka', Ikonka: Trash2 },
];

export default function TestShell() {
  return (
    <KompaniyaProvider>
    <div className="flex flex-col h-full min-h-0">
      {/* ⚠️ SINOV BELGISI — doim ko'rinadi, chalkashmasin */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-3 px-6 py-2.5
                      bg-amber-500/10 border-b border-amber-500/30">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded
                         bg-amber-500/20 text-amber-300 text-[11px] font-bold tracking-wide">
          <FlaskConical size={13} /> TIZIM_02 · SINOV
        </span>
        <span className="text-[11px] text-amber-200/80">
          Ma'lumot <b>Supabase</b> dan o'qiladi. Ishlab turgan tizim (Tizim_01)
          o'zgarmagan — chapdagi menyudan istagan vaqt qaytishingiz mumkin.
        </span>
        <KompaniyaTanlagich />
        <NavLink to="/admin/obyektlar"
          className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-amber-200
                     hover:text-white transition-colors">
          <ArrowLeft size={13} /> Tizim_01 ga qaytish
        </NavLink>
      </div>

      {/* Bo'lim ichidagi navigatsiya */}
      <div className="flex-shrink-0 flex items-center gap-1 px-6 py-2 border-b border-border">
        {TEST_MENYU.map((m) => (
          <NavLink key={m.yol} to={m.yol}
            className={({ isActive }) =>
              `inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-medium
               transition-colors ${isActive
                 ? 'bg-[var(--accent)]/15 text-accent'
                 : 'text-text-dim hover:bg-surface-2 hover:text-text'}`}>
            <m.Ikonka size={14} />
            {m.nom}
          </NavLink>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
    </KompaniyaProvider>
  );
}




