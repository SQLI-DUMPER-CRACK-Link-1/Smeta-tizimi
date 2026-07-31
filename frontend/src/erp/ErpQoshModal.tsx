import { useState } from 'react';
import { X } from 'lucide-react';

export type ErpField = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'date';
  options?: string[];
  required?: boolean;
  placeholder?: string;
};

interface ErpQoshModalProps {
  isOpen: boolean;
  title: string;
  fields: ErpField[];
  onClose: () => void;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  isSaving?: boolean;
}

export function ErpQoshModal({ isOpen, title, fields, onClose, onSubmit, isSaving }: ErpQoshModalProps) {
  const [qiymatlar, setQiymatlar] = useState<Record<string, any>>({});

  if (!isOpen) return null;

  const set = (key: string, val: any) => setQiymatlar(prev => ({ ...prev, [key]: val }));

  const yuborish = async () => {
    for (const f of fields) {
      if (f.required && !qiymatlar[f.key]) return;
    }
    await onSubmit(qiymatlar);
    setQiymatlar({});
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="karta w-full max-w-[520px] max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} disabled={isSaving} className="text-text-dim hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-1.5">
                {f.label}{f.required && <span className="text-rose-400 ml-0.5">*</span>}
              </label>
              {f.type === 'select' ? (
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                  value={qiymatlar[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                >
                  <option value="">— tanlang —</option>
                  {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50 resize-none"
                  rows={3}
                  placeholder={f.placeholder}
                  value={qiymatlar[f.key] ?? ''}
                  onChange={e => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  type={f.type}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent/50"
                  placeholder={f.placeholder}
                  value={qiymatlar[f.key] ?? ''}
                  onChange={e => set(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                />
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border bg-surface-2/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-surface text-text font-medium hover:bg-surface-2 transition-colors disabled:opacity-50 border border-border"
          >
            Bekor qilish
          </button>
          <button
            onClick={yuborish}
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saqlanmoqda...
              </>
            ) : 'Qo\'shish'}
          </button>
        </div>
      </div>
    </div>
  );
}
