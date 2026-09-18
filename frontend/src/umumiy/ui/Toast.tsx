import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/** Dizayn tokenlariga mos: ok=--ok, warn=--warn, danger=--danger.
 *  ⚠️ 'success' YO'Q — 'ok' ishlating (build yiqiladi). */
export type ToastType = 'ok' | 'warn' | 'danger';

interface ToastEvent {
  message: string;
  type: ToastType;
  onUndo?: () => void;
  /** Ko'rinib turish vaqti (ms). Berilmasa: undo bilan 10s, aks holda 3s. */
  davomiylik?: number;
  action?: { label: string; onClick: () => void };
}

let toastListener: ((toast: ToastEvent) => void) | null = null;

export const toast = (
  message: string,
  type: ToastType = 'ok',
  onUndo?: () => void,
  davomiylik?: number,
  action?: { label: string; onClick: () => void },
) => {
  if (toastListener) {
    toastListener({ message, type, onUndo, davomiylik, action });
  }
};

const USLUB: Record<ToastType, string> = {
  ok: 'border-emerald-500/50 text-emerald-400 bg-[#064e3b]/40 shadow-[0_5px_20px_rgba(16,185,129,0.3)]',
  warn: 'border-amber-500/50 text-amber-400 shadow-[0_5px_20px_rgba(245,158,11,0.3)] construction-tape-warn',
  danger: 'border-red-500/50 text-red-400 shadow-[0_5px_20px_rgba(239,68,68,0.3)] construction-tape-danger',
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<(ToastEvent & { id: number })[]>([]);

  useEffect(() => {
    toastListener = (t) => {
      const id = Date.now();
      setToasts((prev) => {
        const next = [...prev, { ...t, id }];
        if (next.length > 3) next.shift(); // 06 - 3 tadan ko'p xabar yo'q
        return next;
      });
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, t.davomiylik ?? (t.onUndo ? 10000 : (t.action ? 10000 : 3000)));
    };
    return () => {
      toastListener = null;
    };
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9, filter: 'blur(5px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`flex items-center gap-4 px-5 py-4 rounded-xl border backdrop-blur-xl ${USLUB[t.type]}`}
          >
            {t.type === 'ok' ? <CheckCircle2 size={20} />
              : t.type === 'warn' ? <AlertTriangle size={20} />
              : <AlertCircle size={20} />}
            <span className="text-white font-medium text-sm">{t.message}</span>
            {t.onUndo && (
              <button
                onClick={() => {
                  t.onUndo!();
                  setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
                }}
                className="ml-4 px-2 py-1 text-xs font-medium bg-surface rounded border border-border hover:bg-surface-2 transition-colors text-white"
              >
                ↶ Bekor qilish
              </button>
            )}
            {t.action && (
              <button
                onClick={() => {
                  t.action!.onClick();
                  setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
                }}
                className="ml-4 px-2 py-1 text-xs font-medium bg-sky-500/20 text-sky-300 rounded border border-sky-500/50 hover:bg-sky-500/30 transition-colors"
              >
                {t.action.label}
              </button>
            )}
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className={`${(t.onUndo || t.action) ? 'ml-2' : 'ml-auto'} p-1 rounded hover:bg-white/10 transition-colors text-text-dim hover:text-white`}
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
