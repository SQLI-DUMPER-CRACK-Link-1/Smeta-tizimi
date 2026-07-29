import { X } from 'lucide-react';
import type { TreeNode } from '../../api/types';

interface ZamenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  source: TreeNode | null;
  target: TreeNode | null;
  isSaving: boolean;
}

export function ZamenaModal({ isOpen, onClose, onConfirm, source, target, isSaving }: ZamenaModalProps) {
  if (!isOpen || !source) return null;

  const isZamena = !!target;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="karta w-full max-w-[700px] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-white">
            {isZamena ? '🔄 ЗАМЕНА' : '➕ ҚЎШИМЧА'}
          </h2>
          <button onClick={onClose} disabled={isSaving} className="text-text-dim hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-sm text-text">
          {isZamena ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[80px_1fr] gap-4 items-center">
                <span className="text-text-dim">O'rniga:</span>
                <div className="bg-surface-2 p-3 rounded-md border border-border">
                  <span className="text-white font-medium">{target.nom}</span>
                  <span className="text-text-dim ml-2">({target.kod || 'Kod yo\'q'})</span>
                  <span className="ml-4 font-mono">{target.smeta} {target.birlik}</span>
                </div>
              </div>
              <div className="grid grid-cols-[80px_1fr] gap-4 items-center">
                <span className="text-text-dim">Yangi:</span>
                <div className="bg-surface-2 p-3 rounded-md border border-accent/50 shadow-[inset_3px_0_0_var(--t-bl)]">
                  <span className="text-white font-medium">{source.nom}</span>
                  <span className="text-text-dim ml-2">({source.kod || 'Kod yo\'q'})</span>
                  <span className="ml-4 font-mono">{source.smeta} {source.birlik}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-info/10 border border-info/20 rounded-md text-info text-sm flex gap-2">
                <span>ℹ️</span>
                <span>
                  Eski qator O'ZGARMAYDI. Yangi qator 🔄 markeri bilan qo'shiladi, izohda «nima o'rniga» ekani yoziladi.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Quyidagi qator qo'shimcha sifatida qo'shiladi:</p>
              <div className="bg-surface-2 p-3 rounded-md border border-ok/50 shadow-[inset_3px_0_0_var(--ok)]">
                <span className="text-white font-medium">{source.nom}</span>
                <span className="text-text-dim ml-2">({source.kod || 'Kod yo\'q'})</span>
                <span className="ml-4 font-mono">{source.smeta} {source.birlik}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2/50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-surface text-text font-medium hover:bg-surface-2 transition-colors disabled:opacity-50 border border-border"
          >
            Bekor qilish
          </button>
          <button 
            onClick={onConfirm} 
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Bajarilmoqda...
              </>
            ) : (
              isZamena ? 'Zamena qilish' : 'Qo\'shish'
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
