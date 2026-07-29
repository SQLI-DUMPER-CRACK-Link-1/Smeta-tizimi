/**
 * Sahifa to'plami — HAR admin ekrani shundan quriladi.
 *
 * Maqsad: dizayn izchilligi hujjatda emas, KODDA majburlansin.
 * Yangi ekran shu komponentlardan yig'ilsa — 06/12/15 hujjatlaridagi
 * qoidalar avtomat bajariladi (skeleton, bo'sh holat, xato kartasi,
 * sticky sarlavha, .num raqamlar, stagger animatsiya, ma'lumot yoshi).
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { RefreshCw, AlertTriangle, Inbox } from 'lucide-react';

/* ---------- Sahifa karkasi ---------- */

export function Sahifa({
  sarlavha, tavsif, amallar, yangilangan, onYangila, yangilanmoqda, children,
}: {
  sarlavha: string;
  tavsif?: string;
  amallar?: ReactNode;
  yangilangan?: number | null;
  onYangila?: () => void;
  yangilanmoqda?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-full overflow-hidden"
    >
      <header className="flex-shrink-0 px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-7 font-semibold text-text tracking-tight">{sarlavha}</h2>
          {tavsif && <p className="text-sm text-text-dim mt-1">{tavsif}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {yangilangan != null && <MalumotYoshi vaqt={yangilangan} />}
          {onYangila && (
            <button
              onClick={onYangila}
              disabled={yangilanmoqda}
              title="Yangilash"
              className="h-9 px-3 inline-flex items-center gap-2 rounded-[10px] karta text-sm
                         text-text hover:border-[var(--accent)]/50 transition-colors
                         disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={16} className={yangilanmoqda ? 'animate-spin' : ''} />
              Yangilash
            </button>
          )}
          {amallar}
        </div>
      </header>
      <div className="flex-1 overflow-auto px-6 pb-6">{children}</div>
    </motion.div>
  );
}

/** «Ma'lumot 4 daqiqa oldingi» — eskirganda sariq bo'ladi (14 §3.2). */
export function MalumotYoshi({ vaqt }: { vaqt: number }) {
  const daq = Math.floor((Date.now() - vaqt) / 60000);
  const matn = daq < 1 ? 'hozirgina' : daq < 60 ? `${daq} daqiqa oldin` : `${Math.floor(daq / 60)} soat oldin`;
  const rang = daq > 15 ? 'text-warn' : daq >= 1 ? 'text-text-dim' : 'text-text-mute';
  return <span className={`text-xs ${rang}`} title="Ma'lumot yangilangan vaqti">{matn}</span>;
}

/* ---------- Holatlar: yuklanmoqda / bo'sh / xato ---------- */

/** Skeleton — spinner EMAS (06 §6). Haqiqiy tarkib shaklida. */
export function Skelet({ qatorlar = 8 }: { qatorlar?: number }) {
  return (
    <div className="karta overflow-hidden">
      <div className="h-11 border-b border-border bg-[var(--surface-2)]/40" />
      {Array.from({ length: qatorlar }).map((_, i) => (
        <div key={i} className="h-12 border-b border-border last:border-0 flex items-center px-4 gap-4">
          <div className="skel h-3 rounded flex-1" style={{ animationDelay: `${i * 60}ms` }} />
          <div className="skel h-3 rounded w-24" style={{ animationDelay: `${i * 60 + 30}ms` }} />
          <div className="skel h-3 rounded w-20" style={{ animationDelay: `${i * 60 + 60}ms` }} />
        </div>
      ))}
    </div>
  );
}

export function BoshHolat({ matn, izoh, amal }: { matn: string; izoh?: string; amal?: ReactNode }) {
  return (
    <div className="karta py-16 px-6 flex flex-col items-center text-center">
      <Inbox size={48} className="text-text-mute mb-4" strokeWidth={1.5} />
      <p className="text-text font-medium">{matn}</p>
      {izoh && <p className="text-sm text-text-dim mt-1 max-w-md">{izoh}</p>}
      {amal && <div className="mt-4">{amal}</div>}
    </div>
  );
}

export function XatoHolat({ xato, qayta }: { xato: unknown; qayta?: () => void }) {
  const xabar = xato instanceof Error ? xato.message : String(xato ?? 'Nomaʼlum xato');
  return (
    <div className="rounded-[10px] border border-danger/25 bg-danger/[.08] p-4">
      <div className="flex gap-3">
        <AlertTriangle size={18} className="text-danger flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="font-medium text-text">Ma'lumot yuklanmadi</p>
          <p className="text-sm text-text-dim mt-1 break-words">{xabar}</p>
          {qayta && (
            <button
              onClick={qayta}
              className="mt-3 h-9 px-3 rounded-[10px] karta text-sm text-text
                         hover:border-[var(--accent)]/50 transition-colors cursor-pointer"
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
    <div className="karta overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr className="bg-[var(--surface-2)]/50">
              {ustunlar.map((u) => (
                <th
                  key={u.kalit}
                  style={{ width: u.en }}
                  className={`sticky top-0 z-[1] bg-[var(--surface-2)] px-4 py-3 font-medium
                              text-[11px] uppercase tracking-[0.04em] text-text-dim
                              border-b border-border ${u.raqam ? 'text-right' : 'text-left'}`}
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
                className={`border-b border-border last:border-0 transition-colors duration-[120ms]
                            hover:bg-[var(--surface-2)]/60 ${onSatrBos ? 'cursor-pointer' : ''}`}
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
    ok: 'bg-ok/10 text-ok border-ok/20',
    warn: 'bg-warn/10 text-warn border-warn/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    neytral: 'bg-[var(--surface-2)] text-text-dim border-border',
  }[tur];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium ${uslub}`}>
      {matn}
    </span>
  );
}

export function KpiKarta({ nom, qiymat, ost }: { nom: string; qiymat: ReactNode; ost?: ReactNode }) {
  return (
    <div className="karta p-5">
      <p className="text-[11px] uppercase tracking-[0.04em] text-text-dim">{nom}</p>
      <p className="text-[26px] leading-8 font-semibold text-text mt-1 tabular-nums">{qiymat}</p>
      {ost && <p className="text-xs text-text-mute mt-1 tabular-nums">{ost}</p>}
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
      className="input h-9 px-3 text-sm w-64 max-w-full"
    />
  );
}
