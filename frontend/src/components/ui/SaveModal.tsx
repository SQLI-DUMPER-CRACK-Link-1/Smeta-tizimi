import { X } from 'lucide-react';
import type { EditState } from '../../pages/Holat';
import { formatSum } from '../../lib/format';

interface SaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  edits: Record<string, EditState>;
  isSaving: boolean;
  obyekt: string;
}

export function SaveModal({ isOpen, onClose, onSave, edits, isSaving, obyekt }: SaveModalProps) {
  if (!isOpen) return null;

  const editsList = Object.values(edits);
  const totalDiff = editsList.reduce((acc, { edit, node }) => {
    const newVal = edit.fakt ?? node.fakt;
    return acc + (newVal - node.fakt) * node.narx;
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-3 rounded-[--r-lg] shadow-[--shadow-float] w-full max-w-[900px] max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-xl font-semibold text-white">O'zgarishlarni saqlash</h2>
          <button onClick={onClose} disabled={isSaving} className="text-text-dim hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 text-sm">
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6 text-text">
            <div>
              <span className="text-text-dim w-32 inline-block">Qatorlar:</span>
              <span className="font-medium text-white">{editsList.length} ta</span>
            </div>
            <div>
              <span className="text-text-dim w-32 inline-block">Obyekt:</span>
              <span className="font-medium text-white">{obyekt}</span>
            </div>
            <div>
              <span className="text-text-dim w-32 inline-block">FAKT o'zgarishi:</span>
              <span className={`font-medium ${totalDiff > 0 ? 'text-ok' : totalDiff < 0 ? 'text-warn' : 'text-white'}`}>
                {totalDiff > 0 ? '+' : ''}{formatSum(totalDiff)} so'm
              </span>
            </div>
          </div>

          <div className="border border-border rounded-md overflow-hidden">
            <div className="bg-surface-2 px-4 py-2 text-xs font-medium text-text-dim border-b border-border">
              O'zgarishlar ro'yxati
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-border">
                  {editsList.map(({ edit, node }) => {
                    const newVal = edit.fakt ?? node.fakt;
                    const diff = newVal - node.fakt;
                    return (
                      <tr key={`${node.varaq}#${node.row}`} className="hover:bg-surface-2/30">
                        <td className="px-4 py-2 truncate max-w-[200px]" title={node.nom}>
                          <span className="text-white">{node.nom}</span>
                        </td>
                        <td className="px-4 py-2 text-right num text-text-dim w-24">
                          {formatSum(node.fakt)}
                        </td>
                        <td className="px-2 py-2 text-center text-text-mute w-8">→</td>
                        <td className="px-4 py-2 text-right num text-white font-medium w-24">
                          {formatSum(newVal)}
                        </td>
                        <td className={`px-4 py-2 text-right num font-medium w-32 ${diff > 0 ? 'text-ok' : diff < 0 ? 'text-warn' : 'text-text-mute'}`}>
                          {diff > 0 ? '+' : ''}{formatSum(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
            onClick={onSave} 
            disabled={isSaving}
            className="px-4 py-2 rounded-md bg-accent text-white font-medium hover:bg-accent/90 transition-colors disabled:opacity-50 shadow-sm flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Saqlanmoqda...
              </>
            ) : (
              'Saqlash'
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
