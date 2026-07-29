import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export type ToastType = 'ok' | 'danger';

interface ToastEvent {
  message: string;
  type: ToastType;
  onUndo?: () => void;
}

let toastListener: ((toast: ToastEvent) => void) | null = null;

export const toast = (message: string, type: ToastType = 'ok', onUndo?: () => void) => {
  if (toastListener) {
    toastListener({ message, type, onUndo });
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<(ToastEvent & { id: number })[]>([]);

  useEffect(() => {
    toastListener = (t) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { ...t, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, t.onUndo ? 10000 : 3000);
    };
    return () => {
      toastListener = null;
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border bg-surface-2 ${
              t.type === 'ok' ? 'border-ok text-ok' : 'border-danger text-danger'
            }`}
          >
            {t.type === 'ok' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="text-white font-medium text-sm">{t.message}</span>
            {t.onUndo && (
              <button
                onClick={() => {
                  t.onUndo!();
                  setToasts((prev) => prev.filter((toast) => toast.id !== t.id));
                }}
                className="ml-4 px-2 py-1 text-xs font-medium bg-surface rounded border border-border hover:bg-surface-2 transition-colors text-white"
              >
                ↩ Bekor qilish
              </button>
            )}
            <button
              onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}
              className={`${t.onUndo ? 'ml-2' : 'ml-auto'} p-1 rounded hover:bg-white/10 transition-colors text-text-dim hover:text-white`}
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
