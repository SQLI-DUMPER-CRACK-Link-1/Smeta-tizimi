import { useState, useEffect } from 'react';
import { useHolat, useObyektlar, useLockAcquire, useLockRelease, useLockStatus, useHolatSaqla, useBlQosh, useRsQosh } from '../api/hooks';
import type { Edit, TreeNode } from '../api/types';
import { SmetaTree } from '../components/tree/SmetaTree';
import { Skeleton } from '../components/ui/Skeleton';
import { SaveModal } from '../components/ui/SaveModal';
import { ZamenaModal } from '../components/ui/ZamenaModal';
import { FileSpreadsheet, Edit3, Eye } from 'lucide-react';

export type EditState = {
  edit: Edit;
  node: TreeNode;
};

export function Holat() {
  const { data: obyektlar, isLoading: isObyektlarLoading } = useObyektlar();
  const [selectedObyekt, setSelectedObyekt] = useState<string>('');
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [edits, setEdits] = useState<Record<string, EditState>>({});
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  
  // Drag and drop state
  const [isZamenaModalOpen, setIsZamenaModalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<TreeNode | null>(null);
  const [dragTarget, setDragTarget] = useState<TreeNode | null>(null);

  // Auto-select first object if none selected
  useEffect(() => {
    if (!selectedObyekt && obyektlar?.length) {
      setSelectedObyekt(obyektlar[0].obyekt);
    }
  }, [obyektlar, selectedObyekt]);

  const { data: holatData, isLoading: isHolatLoading, error } = useHolat(selectedObyekt);
  const { data: lockStatus } = useLockStatus(selectedObyekt);
  const { mutateAsync: acquireLock } = useLockAcquire();
  const { mutateAsync: releaseLock } = useLockRelease();
  const saqla = useHolatSaqla(selectedObyekt);
  const blQosh = useBlQosh();
  const rsQosh = useRsQosh();

  // Yozish paytida sahifa yopilishidan himoya
  useEffect(() => {
    if (!saqla.isPending) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saqla.isPending]);

  // Reset edit mode when object changes
  useEffect(() => {
    setIsEditMode(false);
    setEdits({});
  }, [selectedObyekt]);

  // Clean up lock on unmount
  useEffect(() => {
    return () => {
      if (isEditMode && selectedObyekt) {
        releaseLock({ obyekt: selectedObyekt, reason: 'Sahifa yopildi' }).catch(console.error);
      }
    };
  }, [isEditMode, selectedObyekt, releaseLock]);

  const toggleEditMode = async () => {
    if (isEditMode) {
      setIsEditMode(false);
      setEdits({});
      await releaseLock({ obyekt: selectedObyekt, reason: 'Tahrirlash yakunlandi' });
    } else {
      if (lockStatus?.status === 'locked') {
        alert(`Obyekt band: ${lockStatus.user}`);
        return;
      }
      try {
        await acquireLock({ obyekt: selectedObyekt, reason: 'Smeta tahrirlash' });
        setIsEditMode(true);
      } catch (err: any) {
        alert('Band qilishda xatolik: ' + err.message);
      }
    }
  };

  const handleSave = async () => {
    const editsToSave = Object.values(edits).map(e => e.edit);
    try {
      const r = await saqla.mutateAsync(editsToSave);
      alert(`Muvaffaqiyatli saqlandi: ${r.qatorlar} qator`);
      setIsSaveModalOpen(false);
      setEdits({});
      setIsEditMode(false);
      await releaseLock({ obyekt: selectedObyekt, reason: 'Saqlash yakunlandi' });
    } catch (err: any) {
      alert(`Saqlashda xatolik: ${err.message}`);
    }
  };

  const handleNodeDrop = (source: TreeNode, target?: TreeNode) => {
    setDragSource(source);
    setDragTarget(target || null);
    setIsZamenaModalOpen(true);
  };

  const handleZamenaConfirm = async () => {
    if (!dragSource || !dragSource.varaq || !dragSource.row) return;
    
    try {
      const isIsh = dragSource.tip === 'bl';
      const isZamena = !!dragTarget;
      
      const payload: any = {
        obyekt: selectedObyekt,
        varaq: dragSource.varaq,
        afterRow: dragTarget?.row || dragSource.row, // simplified
        nom: dragSource.nom,
        kod: dragSource.kod,
        birlik: dragSource.birlik,
        hajm: dragSource.smeta,
        tur: dragSource.tip,
      };

      if (isZamena) {
        payload.zamena = true;
        payload.droppedOnRow = dragTarget.row;
      }

      let newRow: number;
      if (isIsh) {
        newRow = await blQosh.mutateAsync(payload);
        // Copy children (resources)
        if (dragSource.children) {
          for (const child of dragSource.children) {
            await rsQosh.mutateAsync({
              obyekt: selectedObyekt,
              varaq: dragSource.varaq,
              blRow: newRow,
              nom: child.nom,
              kod: child.kod,
              birlik: child.birlik,
              narx: child.narx,
              norm: child.smeta, // Assuming norm relates to smeta volume here, simplified
              f: child.fakt,
            });
          }
        }
      } else {
        await rsQosh.mutateAsync({
          obyekt: selectedObyekt,
          varaq: dragSource.varaq,
          blRow: dragTarget?.row || dragSource.row, // needs proper logic to find parent blRow if dropped on empty
          nom: dragSource.nom,
          kod: dragSource.kod,
          birlik: dragSource.birlik,
          narx: dragSource.narx,
          norm: dragSource.smeta,
          f: dragSource.fakt,
        });
      }

      alert("Qo'shish muvaffaqiyatli bajarildi!");
      setIsZamenaModalOpen(false);
      setDragSource(null);
      setDragTarget(null);
      
    } catch (err: any) {
      alert("Xatolik: " + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="text-accent" />
            Smeta Holati
          </h2>
          <p className="text-text-dim text-sm mt-1">Obyektning to'liq ierarxik smetasi va bajarilish holati</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedObyekt && (
            <button
              onClick={toggleEditMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                isEditMode 
                  ? 'bg-accent text-white hover:bg-accent/90' 
                  : 'bg-surface border border-border text-text hover:bg-surface-2'
              }`}
            >
              {isEditMode ? <><Eye size={16} /> Ko'rish</> : <><Edit3 size={16} /> Tahrirlash</>}
            </button>
          )}

          <span className="text-sm text-text-dim ml-4">Obyekt:</span>
          {isObyektlarLoading ? (
             <Skeleton className="h-9 w-48 rounded-md" />
          ) : (
            <select 
              value={selectedObyekt} 
              onChange={e => setSelectedObyekt(e.target.value)}
              className="bg-surface border border-border rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-accent min-w-[200px]"
            >
              {obyektlar?.map(obj => (
                <option key={obj.obyekt} value={obj.obyekt}>{obj.obyekt}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        {isEditMode && Object.keys(edits).length > 0 && (
          <div className="bg-surface-2 border border-border p-3 rounded-lg mb-4 flex items-center justify-between flex-shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-warn">⚠</span>
              <span className="text-white font-medium">{Object.keys(edits).length} ta qator o'zgardi</span>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setEdits({})} className="px-3 py-1.5 text-sm font-medium text-text-dim hover:text-white bg-surface border border-border rounded-md">Bekor qilish</button>
              <button onClick={() => setIsSaveModalOpen(true)} className="px-4 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-md shadow-sm">💾 Saqlash</button>
            </div>
          </div>
        )}
        
        {!selectedObyekt ? (
          <div className="flex-1 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-text-dim">
            Obyektni tanlang
          </div>
        ) : isHolatLoading ? (
          <div className="flex-1 bg-surface border border-border rounded-xl p-4 space-y-2 relative overflow-hidden">
            <Skeleton className="h-10 w-full mb-4" />
            {[...Array(20)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-8 flex-1 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
                <Skeleton className="h-8 w-24 rounded" />
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center bg-surface/50 backdrop-blur-sm">
              <div className="bg-surface border border-border px-6 py-4 rounded-lg shadow-xl text-center">
                <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="font-medium text-white">Smeta daraxti o'qilmoqda...</p>
                <p className="text-xs text-text-dim mt-1">Iltimos kuting</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="text-danger p-4 rounded-lg bg-danger/10 border border-danger/20">
            Daraxtni yuklashda xatolik: {error.message}
          </div>
        ) : holatData?.tree ? (
          <div className="flex-1 min-h-0">
            <SmetaTree 
              data={holatData.tree} 
              isEditMode={isEditMode}
              edits={edits}
              setEdits={setEdits}
              onNodeDrop={handleNodeDrop}
            />
          </div>
        ) : (
          <div className="flex-1 border-2 border-dashed border-border rounded-xl flex items-center justify-center text-text-dim">
            Ma'lumot topilmadi
          </div>
        )}
      </div>
      
      <SaveModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSave}
        edits={edits}
        isSaving={saqla.isPending}
        obyekt={selectedObyekt}
      />

      <ZamenaModal
        isOpen={isZamenaModalOpen}
        onClose={() => setIsZamenaModalOpen(false)}
        onConfirm={handleZamenaConfirm}
        source={dragSource}
        target={dragTarget}
        isSaving={blQosh.isPending || rsQosh.isPending}
      />
    </div>
  );
}
