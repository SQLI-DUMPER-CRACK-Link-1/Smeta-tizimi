/**
 * Sahifa to'plami — HAR admin ekrani shundan quriladi.
 *
 * Maqsad: dizayn izchilligi hujjatda emas, KODDA majburlansin.
 * Yangi ekran shu komponentlardan yig'ilsa — 06/12/15 hujjatlaridagi
 * qoidalar avtomat bajariladi (skeleton, bo'sh holat, xato kartasi,
 * sticky sarlavha, .num raqamlar, stagger animatsiya, ma'lumot yoshi).
 */
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Inbox, X } from 'lucide-react';

/* ---------- Sahifa karkasi ---------- */

/**
 * Ikki xil ishlatiladi:
 *   1) oddiy:      <Sahifa …>{<div/>}</Sahifa>
 *   2) so'rov bilan: <Sahifa … soragan={q}>{(d) => <div/>}</Sahifa>
 *      — bu holda yuklanmoqda/bo'sh/xato holatlari AVTOMAT hal qilinadi.
 */
export function Sahifa<T = unknown>({
  sarlavha, tavsif, amallar, yangilangan, onYangila, yangilanmoqda, soragan, bosh, children,
}: {
  sarlavha: string;
  tavsif?: string;
  amallar?: ReactNode;
  yangilangan?: number | null;
  onYangila?: () => void;
  yangilanmoqda?: boolean;
  soragan?: { data?: T; isLoading: boolean; error: unknown; refetch?: () => void };
  bosh?: { matn: string; izoh?: string; amal?: ReactNode };
  children: ReactNode | ((data: T) => ReactNode);
}) {
  const ichki = soragan
    ? <Holatlar soragan={soragan} bosh={bosh}>{(d) => (children as (data: T) => ReactNode)(d)}</Holatlar>
    : (children as ReactNode);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full min-h-0 min-w-0 overflow-hidden"
    >
      <header className="flex-shrink-0 px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-indigo-400 tracking-wide drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">{sarlavha}</h2>
          {tavsif && <p className="text-sm text-zinc-400 mt-2">{tavsif}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {yangilangan != null && <MalumotYoshi vaqt={yangilangan} />}
          {onYangila && (
            <button
              onClick={onYangila}
              disabled={yangilanmoqda}
              title="Yangilash"
              className="lux-btn lux-btn-ghost h-9 px-3 inline-flex items-center gap-2 text-[13px] disabled:opacity-50"
            >
              <RefreshCw size={16} className={yangilanmoqda ? 'animate-spin text-sky-400' : 'text-zinc-400'} />
              Yangilash
            </button>
          )}
          {amallar}
        </div>
      </header>
      <div className="flex-1 min-h-0 min-w-0 overflow-auto px-6 pb-6">{ichki}</div>
    </motion.div>
  );
}

/** «Ma'lumot 4 daqiqa oldingi» — eskirganda sariq bo'ladi (14 §3.2). */
export function MalumotYoshi({ vaqt }: { vaqt: number }) {
  /* ⚠️ 2026-08-17: TanStack `dataUpdatedAt` ma'lumot HALI KELMAGANDA 0
     bo'ladi. Avval bu tekshirilmasdi va `Date.now() - 0` — ya'ni
     1970-yildan hisob — ekranga «496381 soat oldin» deb chiqardi.
     Foydalanuvchi buni har xato/yuklanish holatida ko'rardi va bu butun
     sahifaga ishonchni yo'qotadi (bir joyda bo'lmagan raqam chiqsa,
     qolganiga ham ishonmaydi).
     Endi: yaroqsiz vaqt belgisi bo'lsa hech nima ko'rsatilmaydi. */
  if (!vaqt || !Number.isFinite(vaqt) || vaqt <= 0) return null;
  const daq = Math.floor((Date.now() - vaqt) / 60000);
  if (daq < 0) return null;                       // kelajakdagi vaqt — soat noto'g'ri
  const matn = daq < 1 ? 'hozirgina' : daq < 60 ? `${daq} daqiqa oldin` : `${Math.floor(daq / 60)} soat oldin`;
  const rang = daq > 15 ? 'text-warn' : daq >= 1 ? 'text-text-dim' : 'text-text-mute';
  return <span className={`text-xs ${rang}`} title="Ma'lumot yangilangan vaqti">{matn}</span>;
}

/* ---------- Holatlar: yuklanmoqda / bo'sh / xato ---------- */

/** Skeleton — spinner EMAS (06 §6). Haqiqiy tarkib shaklida. */
export function Skelet({ qatorlar = 8 }: { qatorlar?: number }) {
  return (
    <div className="lux-karta overflow-hidden border-white/5">
      <div className="h-11 border-b border-white/5 bg-white/[0.02]" />
      {Array.from({ length: qatorlar }).map((_, i) => (
        <div key={i} className="h-12 border-b border-white/5 last:border-0 flex items-center px-4 gap-4">
          <div className="h-3 rounded flex-1 bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          <div className="h-3 rounded w-24 bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60 + 30}ms` }} />
          <div className="h-3 rounded w-20 bg-white/5 animate-pulse" style={{ animationDelay: `${i * 60 + 60}ms` }} />
        </div>
      ))}
    </div>
  );
}

export function BoshHolat({ matn, izoh, amal }: { matn: string; izoh?: string; amal?: ReactNode }) {
  return (
    <div className="lux-karta py-16 px-6 flex flex-col items-center text-center border-white/5">
      <Inbox size={48} className="text-zinc-500 mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-white mb-2">{matn}</h3>
      {izoh && <p className="text-sm text-zinc-400 max-w-md mb-6">{izoh}</p>}
      {amal && <div className="mt-4">{amal}</div>}
    </div>
  );
}

export function XatoHolat({ xato, qayta }: { xato: unknown; qayta?: () => void }) {
  const xabar = xato instanceof Error ? xato.message : String(xato ?? 'Nomaʼlum xato');
  return (
    <div className="rounded-[10px] border border-red-500/25 bg-red-500/10 p-4 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
      <div className="flex gap-3">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5 drop-shadow-[0_0_4px_rgba(248,113,113,0.5)]" />
        <div className="min-w-0">
          <p className="font-semibold text-white">Ma'lumot yuklanmadi</p>
          <p className="text-sm text-zinc-400 mt-1 break-words">{xabar}</p>
          {qayta && (
            <button
              onClick={qayta}
              className="lux-btn lux-btn-warn mt-4 text-[12px] px-4 py-1.5"
            >
              Qayta urinish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Uchala holatni bitta joyda hal qiladi — takrorlanishning oldini oladi. */
export function Holatlar<T,>({
  soragan, bosh, children,
}: {
  soragan: { data?: T; isLoading: boolean; error: unknown; refetch?: () => void };
  bosh?: { matn: string; izoh?: string; amal?: ReactNode };
  children: (data: T) => ReactNode;
}) {
  if (soragan.isLoading) return <Skelet />;
  if (soragan.error) return <XatoHolat xato={soragan.error} qayta={soragan.refetch} />;
  const d = soragan.data;
  const bosgmi = d == null || (Array.isArray(d) && d.length === 0);
  if (bosgmi) return <BoshHolat matn={bosh?.matn ?? "Ma'lumot yo'q"} izoh={bosh?.izoh} amal={bosh?.amal} />;
  return <>{children(d as T)}</>;
}

/* ---------- Jadval ---------- */

export type Ustun<T> = {
  kalit: string;
  nom: string;
  /** o'ngga tekislanadi + .num (pul/hajm uchun) */
  raqam?: boolean;
  en?: string;
  chiz: (satr: T, i: number) => ReactNode;
};

/**
 * Jadval — 06 §7.2 qoidalari majburlangan:
 * sticky sarlavha · raqamlar o'ngda · faqat gorizontal chiziq · zebra yo'q ·
 * o'z konteynerida skroll · qator stagger (maks 400ms).
 */
export function Jadval<T,>({
  ustunlar, satrlar, kalit, onSatrBos,
}: {
  ustunlar: Ustun<T>[];
  satrlar: T[];
  kalit: (satr: T, i: number) => string;
  onSatrBos?: (satr: T) => void;
}) {
  return (
    <div className="lux-karta overflow-hidden border-white/5">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-black/40">
              {ustunlar.map((u) => (
                <th
                  key={u.kalit}
                  style={{ width: u.en, minWidth: u.en }}
                  className={`sticky top-0 z-[1] bg-black/60 backdrop-blur-md px-4 py-3 font-bold
                              text-[11px] uppercase tracking-wider text-zinc-400
                              border-b border-white/5 ${u.raqam ? 'text-right' : 'text-left'}`}
                >
                  {u.nom}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {satrlar.map((s, i) => (
              <motion.tr
                key={kalit(s, i)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                onClick={onSatrBos ? () => onSatrBos(s) : undefined}
                className={`border-b border-white/5 last:border-0 transition-colors duration-[120ms]
                            hover:bg-sky-500/[0.04] ${onSatrBos ? 'cursor-pointer' : ''}`}
              >
                {ustunlar.map((u) => (
                  <td
                    key={u.kalit}
                    className={`px-4 py-3 align-middle ${u.raqam ? 'text-right tabular-nums' : 'text-left'}`}
                  >
                    {u.chiz(s, i)}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Kichik bo'laklar ---------- */

export function Nishon({ matn, tur = 'neytral' }: { matn: string; tur?: 'ok' | 'warn' | 'danger' | 'neytral' }) {
  const uslub = {
    ok: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_8px_rgba(52,211,153,0.1)]',
    warn: 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_8px_rgba(251,191,36,0.1)]',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(248,113,113,0.1)]',
    neytral: 'bg-white/5 text-zinc-400 border-white/10',
  }[tur];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-bold tracking-wide ${uslub}`}>
      {matn}
    </span>
  );
}

export function KpiKarta({ nom, qiymat, ost }: { nom: string; qiymat: ReactNode; ost?: ReactNode }) {
  return (
    <div className="lux-karta p-5 border-white/5">
      <p className="text-[11px] uppercase tracking-wider font-bold text-zinc-500">{nom}</p>
      <p className="text-[26px] leading-8 font-extrabold text-white mt-2 tabular-nums drop-shadow-[0_0_6px_rgba(255,255,255,0.2)]">{qiymat}</p>
      {ost && <p className="text-xs text-zinc-400 mt-2 tabular-nums">{ost}</p>}
    </div>
  );
}

export function Qidiruv({ qiymat, ozgardi, placeholder = 'Qidirish…' }: {
  qiymat: string; ozgardi: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      value={qiymat}
      onChange={(e) => ozgardi(e.target.value)}
      placeholder={placeholder}
      className="h-9 px-4 rounded-xl text-sm w-64 max-w-full bg-black/40 border border-white/10 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 transition-all placeholder:text-zinc-600"
    />
  );
}

/* ---------- Yon panel (drawer) ---------- */

/**
 * O'ngdan chiquvchi batafsil panel. Modal emas — foydalanuvchi ro'yxatni
 * ko'rib turgan holda tafsilotni o'qiydi (06 §7.4 ruhida).
 */
export function Yon({
  ochiq, yop, sarlavha, tavsif, past, children,
}: {
  ochiq: boolean;
  yop: () => void;
  sarlavha: string;
  tavsif?: ReactNode;
  past?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!ochiq) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') yop(); };
    addEventListener('keydown', h);
    return () => removeEventListener('keydown', h);
  }, [ochiq, yop]);

  return (
    <AnimatePresence>
      {ochiq && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={yop}
            className="fixed inset-0 bg-black/60 backdrop-blur-[3px] z-40"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] max-w-full z-50
                       bg-[#060914]/95 backdrop-blur-2xl border-l border-sky-500/10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] flex flex-col"
          >
            <header className="flex-shrink-0 px-5 py-4 border-b border-white/5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold text-white truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{sarlavha}</h3>
                {tavsif && <div className="text-sm text-zinc-400 mt-1">{tavsif}</div>}
              </div>
              <button
                onClick={yop}
                aria-label="Yopish"
                className="h-8 w-8 grid place-items-center rounded-lg text-zinc-400
                           hover:bg-white/5 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/10"
              >
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">{children}</div>
            {past && <footer className="flex-shrink-0 px-5 py-4 border-t border-white/5 bg-black/20">{past}</footer>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Forma elementlari ---------- */

export function Maydon({ nom, children, izoh }: { nom: string; children: ReactNode; izoh?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider font-bold text-zinc-400 mb-1.5">{nom}</span>
      {children}
      {izoh && <span className="block text-[11px] text-zinc-500 mt-1 italic">{izoh}</span>}
    </label>
  );
}

export function Kiritma({
  qiymat, ozgardi, tur = 'text', placeholder, ozgarmas,
}: {
  qiymat: string | number;
  ozgardi: (v: string) => void;
  tur?: 'text' | 'number' | 'date';
  placeholder?: string;
  ozgarmas?: boolean;
}) {
  return (
    <input
      type={tur}
      value={qiymat}
      disabled={ozgarmas}
      placeholder={placeholder}
      onChange={(e) => ozgardi(e.target.value)}
      className={`h-9 px-3 rounded-xl text-sm w-full bg-black/40 border border-white/10 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 transition-all placeholder:text-zinc-600 ${tur === 'number' ? 'text-right tabular-nums' : ''} ${ozgarmas ? 'opacity-50 cursor-not-allowed bg-black/20' : ''}`}
    />
  );
}

export function Tanlov({ qiymat, ozgardi, variantlar }: {
  qiymat: string; ozgardi: (v: string) => void; variantlar: string[];
}) {
  return (
    <select
      value={qiymat}
      onChange={(e) => ozgardi(e.target.value)}
      className="h-9 px-3 rounded-xl text-sm w-full bg-black/40 border border-white/10 text-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400/50 transition-all cursor-pointer appearance-none"
    >
      {variantlar.map((v) => <option key={v} value={v} className="bg-[#060914] text-white py-1">{v}</option>)}
    </select>
  );
}

/* ---------- Kiritmalar ---------- */

export function Tugma({ children, onBos, tur = 'secondary', band, ikonka }: {
  children: ReactNode;
  onBos?: () => void;
  tur?: 'primary' | 'secondary' | 'danger';
  band?: boolean;
  ikonka?: ReactNode;
}) {
  const uslub = {
    primary: 'lux-btn-primary',
    secondary: 'lux-btn-ghost',
    danger: 'lux-btn-warn',
  }[tur];
  return (
    <button
      onClick={onBos}
      disabled={band}
      className={`lux-btn h-9 px-4 inline-flex items-center justify-center gap-2 text-[13px] ${uslub} ${band ? 'lux-btn-loading opacity-70' : ''}`}
    >
      {band ? <span className="opacity-70">…</span> : ikonka}
      {children}
    </button>
  );
}

/** Kalit → qiymat juftliklari (batafsil panelda) */
export function Juft({ nom, qiymat }: { nom: string; qiymat: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-zinc-400 flex-shrink-0">{nom}</span>
      <span className="text-sm text-white font-medium text-right tabular-nums min-w-0 break-words">{qiymat}</span>
    </div>
  );
}
