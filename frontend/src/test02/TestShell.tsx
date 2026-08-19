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
import { FlaskConical, Building2, Network, ArrowLeft, Gauge, Timer } from 'lucide-react';

const TEST_MENYU = [
  { yol: '/admin/test/obyektlar', nom: 'Obyektlar',    Ikonka: Building2 },
  { yol: '/admin/test/daraxt',    nom: 'Smeta daraxti', Ikonka: Network },
  { yol: '/admin/test/oqish',     nom: 'GAS o’qish tezligi', Ikonka: Timer },
  { yol: '/admin/tezlik',         nom: 'Tezlik sinovi', Ikonka: Gauge },
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
