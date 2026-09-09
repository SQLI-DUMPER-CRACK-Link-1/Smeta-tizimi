import { useMemo, useState } from 'react';
import { Search, Link2, Unlink, ArrowRight, GitPullRequestArrow, PlusSquare } from 'lucide-react';
import type { AktNode, LrvNode } from '../../lib/f2-match-engine';
import type { F2ExactManbaTugun } from '../../test02/f2-exact-payload';
import type { T2Qator } from '../../api/supabase';
import { F2AddReplModal, type DropAction } from './F2AddReplModal';
import { ishResurslariniBogla, ishMi } from '../../lib/f2-ish-bogla';

/**
 * T2-PTO-OWNER-CRITICAL-CLOSURE P0-2: professional two-pane F2<->Smeta
 * matching workbench, replacing the old per-row dropdown table.
 *
 * LEFT  = F2 source act tree (rz/bl/rs/mat/ob, from the uploaded XLSX).
 * RIGHT = canonical Smeta/LRV tree (t2_qator, via sbT2DaraxtOl).
 *
 * Click a source leaf to select it, then click a target leaf to link them
 * (or click the same source leaf again to deselect). Matched rows link by
 * stable canonical qator_id (`LrvNode.row`) -- never by row NUMBER in the
 * uploaded sheet or in the Smeta tree; a target may receive more than one
 * source line (aggregation is expected in F2 postings).
 */

type Tur = 'rz' | 'bl' | 'rs' | 'mat' | 'ob';
const TUR_BELGI: Record<Tur, string> = { rz: '📁', bl: '🔧', rs: '🔹', mat: '🧱', ob: '⚙️' };

/* A real F2/Smeta file can carry up to 60000 leaves (see MAX_ROWS in
 * F2ImportNative.tsx) -- rendering every one of them as a DOM node at once
 * would hang the tab (and did, in jsdom, the 30000-row checkpoint test).
 * Cap what's actually rendered per pane; search + "faqat moslashmaganlar"
 * narrow the working set for anyone past the cap. */
const RENDER_CAP = 400;

export interface F2TwoPaneWorkbenchProps {
  sourceTree: AktNode[] | null;
  sourceFlat: F2ExactManbaTugun[];
  labels: Map<string, string>;
  smetaRoots: LrvNode[];
  targets: Map<number, string>;
  mapping: Map<string, number>;
  onMappingChange: (next: Map<string, number>) => void;
  disabled?: boolean;
  /** Additional/Zamena drag-drop creation -- optional: only wired when the
   *  caller also supplies raw t2_qator rows (needed for parent/old-row
   *  versiya) and object/company context. Without these, drop targets fall
   *  back to link-only (existing rows), same as before. */
  smetaRawRows?: T2Qator[];
  companyId?: number;
  objectId?: number;
  onSmetaChanged?: () => void | Promise<void>;
}

function nom(n: string | undefined, fallback: string) { return n && n.trim() ? n : fallback; }

const REAL_TUR = new Set<Tur>(['rz', 'bl', 'rs', 'mat', 'ob']);

/** Fallback: build a flat, unnested pseudo-tree from sourceFlat when the real
 *  hierarchy isn't available (e.g. a resumed session -- the draft only
 *  persisted flat leaves, not the original file's rz/bl grouping).
 *
 * T2-F2-IMPORT-TUR-CASCADE-001: haqiqiy hodisa -- avval bu yerda HAMMA
 * qator majburan 'rs' deb belgilanardi, shuning uchun tiklangan
 * sessiyada rs/mat/ob (masalan jihoz, ⚙️) vizual farqi yo'qolib qolardi.
 * Endi qoralamada saqlangan haqiqiy `tur` ishlatiladi; faqat ESKI (bu
 * maydon qo'shilishidan oldin saqlangan) qoralamalarda `tur` yo'q --
 * o'shandagina 'rs'ga qaytiladi. */
export function flatSourceNodes(flat: F2ExactManbaTugun[], labels: Map<string, string>): AktNode[] {
  return flat.map(n => ({
    uid: n.uid, type: (n.tur && REAL_TUR.has(n.tur as Tur) ? n.tur as Tur : 'rs'),
    nom: labels.get(n.uid) || n.uid, hajm: n.hajm, narx: n.narx ?? undefined, summa: n.summa ?? undefined,
  }));
}

export function F2TwoPaneWorkbench(p: F2TwoPaneWorkbenchProps) {
  const [selected, setSelected] = useState<string | null>(null);
  /* Butun ishni (resurslari bilan) bog'lash uchun tanlangan akt tuguni. */
  const [tanlanganIsh, setTanlanganIsh] = useState<AktNode | null>(null);
  const [ishNatija, setIshNatija] = useState<string | null>(null);
  const [srcQ, setSrcQ] = useState('');
  const [tgtQ, setTgtQ] = useState('');
  const [faqatMoslashmagan, setFaqatMoslashmagan] = useState(false);
  const [draggingUid, setDraggingUid] = useState<string | null>(null);
  const [dropOverKey, setDropOverKey] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ sourceUid: string; action: DropAction } | null>(null);

  const dragDropEnabled = !!(p.smetaRawRows && p.companyId != null && p.objectId != null && p.onSmetaChanged);
  const rowById = useMemo(() => {
    const m = new Map<number, T2Qator>();
    for (const r of p.smetaRawRows || []) m.set(r.id, r);
    return m;
  }, [p.smetaRawRows]);

  const sourceNodes = p.sourceTree ?? flatSourceNodes(p.sourceFlat, p.labels);
  const bindingsByTarget = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const [uid, id] of p.mapping) { const a = m.get(id); if (a) a.push(uid); else m.set(id, [uid]); }
    return m;
  }, [p.mapping]);

  function sourceNodeByUid(uid: string, nodes = sourceNodes): AktNode | null {
    for (const n of nodes) {
      if (n.uid === uid) return n;
      if (n.children) { const f = sourceNodeByUid(uid, n.children); if (f) return f; }
    }
    return null;
  }

  function handleDropOnLeaf(sourceUid: string, targetRow: number) {
    if (!dragDropEnabled) return;
    const oldRow = rowById.get(targetRow);
    const parent = oldRow?.ota_id != null ? rowById.get(oldRow.ota_id) : null;
    if (!oldRow || !parent) return;
    setPendingDrop({ sourceUid, action: { kind: 'replacement', oldRow, parent } });
  }
  function handleDropOnContainer(sourceUid: string, containerRow: number) {
    if (!dragDropEnabled) return;
    const parent = rowById.get(containerRow);
    if (!parent) return;
    const action: DropAction = parent.tur === 'rz'
      ? { kind: 'additional', parent }
      : { kind: 'resource', parent };
    setPendingDrop({ sourceUid, action });
  }
  function afterCreated(qatorId: number) {
    if (!pendingDrop) return;
    const next = new Map(p.mapping);
    next.set(pendingDrop.sourceUid, qatorId);
    p.onMappingChange(next);
    setPendingDrop(null);
    void p.onSmetaChanged?.();
  }

  const matchedCount = p.sourceFlat.filter(n => p.mapping.has(n.uid)).length;

  function link(sourceUid: string, targetId: number) {
    const next = new Map(p.mapping);
    next.set(sourceUid, targetId);
    p.onMappingChange(next);
    setSelected(null);
  }

  /* Ishni RESURSLARI BILAN BIRGA bog'lash — T1 dagi avtomatik moslashning
     aynan o'sha qoidasi (kod → kanonik kod → nom+birlik, faqat SHU ish
     ichida, taxminsiz), lekin operator qo'l bilan chaqirganda. */
  function ishniBogla(fIsh: AktNode, sIsh: LrvNode) {
    const r = ishResurslariniBogla(fIsh, sIsh, p.mapping);
    p.onMappingChange(r.mapping);
    setTanlanganIsh(null);
    setSelected(null);
    setIshNatija(r.qoldi === 0
      ? `«${nom(fIsh.nom, 'Ish')}» — ${r.bogland} ta resurs bog'landi.`
      : `«${nom(fIsh.nom, 'Ish')}» — ${r.bogland} ta bog'landi, ${r.qoldi} tasiga aniq nomzod topilmadi (ular qo'lda bog'lanadi).`);
  }
  function unlink(sourceUid: string) {
    const next = new Map(p.mapping);
    next.delete(sourceUid);
    p.onMappingChange(next);
  }

  const srcFilter = srcQ.trim().toLowerCase();
  const tgtFilter = tgtQ.trim().toLowerCase();

  function sourceLeafVisible(uid: string): boolean {
    if (faqatMoslashmagan && p.mapping.has(uid)) return false;
    if (!srcFilter) return true;
    const label = (p.labels.get(uid) || '').toLowerCase();
    return label.includes(srcFilter);
  }

  function renderSourceNode(n: AktNode, depth: number, budget: { left: number; truncated: boolean }): React.ReactNode {
    const isLeaf = n.type !== 'rz' && (!n.children || n.children.length === 0);
    if (isLeaf) {
      if (!sourceLeafVisible(n.uid)) return null;
      if (budget.left <= 0) { budget.truncated = true; return null; }
      budget.left--;
      const matched = p.mapping.has(n.uid);
      const isSelected = selected === n.uid;
      const targetId = p.mapping.get(n.uid);
      return (
        <div key={n.uid}
          role="button" tabIndex={0}
          aria-pressed={isSelected}
          draggable={dragDropEnabled && !p.disabled}
          onDragStart={e => { if (!dragDropEnabled) return; e.dataTransfer.setData('text/plain', n.uid); e.dataTransfer.effectAllowed = 'link'; setDraggingUid(n.uid); }}
          onDragEnd={() => setDraggingUid(null)}
          onClick={() => !p.disabled && setSelected(isSelected ? null : n.uid)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!p.disabled) setSelected(isSelected ? null : n.uid); } }}
          style={{ marginLeft: depth * 14 }}
          title={dragDropEnabled ? 'Bosib bog‘lang, yoki smeta tomonga tortib qo‘shimcha/zamena yarating' : undefined}
          className={
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] cursor-pointer border ' +
            (draggingUid === n.uid ? 'opacity-40'
              : isSelected ? 'border-accent bg-accent/10 ring-1 ring-accent'
              : matched ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
              : 'border-transparent hover:bg-surface-2/60')
          }>
          <span>{TUR_BELGI[n.type as Tur] || '•'}</span>
          <span className="flex-1 truncate" title={p.labels.get(n.uid) || n.nom}>{p.labels.get(n.uid) || nom(n.nom, n.uid)}</span>
          <span className="text-text-mute tabular-nums shrink-0">{n.hajm ?? '—'}</span>
          {matched && targetId != null && (
            <span className="text-emerald-500 shrink-0 flex items-center gap-0.5" title={p.targets.get(targetId) || ''}>
              <Link2 size={11} />
              <button type="button" aria-label="Bog‘lanishni uzish"
                onClick={e => { e.stopPropagation(); if (!p.disabled) unlink(n.uid); }}
                className="hover:text-danger"><Unlink size={11} /></button>
            </span>
          )}
        </div>
      );
    }
    const children = (n.children || []).map(c => renderSourceNode(c, depth + 1, budget)).filter(Boolean);
    if (n.type === 'rz' && children.length === 0) return null;
    /* ISH tuguni (resurslari bor) — o'zi ham tanlanadi: shunda o'ng
       tomondan smeta ishini bosib, BUTUN ishni resurslari bilan birga
       bog'lash mumkin (avval faqat barg-bargdan bog'lanardi). */
    const buIsh = ishMi(n);
    const ishTanlangan = buIsh && tanlanganIsh?.uid === n.uid;
    return (
      <div key={n.uid}>
        <div
          style={{ marginLeft: depth * 14 }}
          {...(buIsh && !p.disabled ? {
            role: 'button' as const, tabIndex: 0,
            onClick: () => { setSelected(null); setIshNatija(null); setTanlanganIsh(ishTanlangan ? null : n); },
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(null); setIshNatija(null); setTanlanganIsh(ishTanlangan ? null : n); }
            },
            title: 'Butun ishni resurslari bilan birga bog‘lash uchun tanlang',
          } : {})}
          className={'px-2 py-1 text-[12px] font-semibold rounded-md ' +
            (buIsh && !p.disabled ? 'cursor-pointer hover:bg-accent/10 ' : '') +
            (ishTanlangan ? 'bg-accent/15 text-text ring-1 ring-accent/50' : 'text-text-dim')}>
          {TUR_BELGI[n.type as Tur] || '📁'} {nom(n.nom, 'Bo‘lim')}
          {buIsh && <span className="ml-1.5 font-normal text-text-mute">({(n.children || []).length} resurs)</span>}
        </div>
        {children}
      </div>
    );
  }

  function targetLeafVisible(node: LrvNode): boolean {
    if (!tgtFilter) return true;
    const label = ((node.kod || '') + ' ' + (node.nom || '')).toLowerCase();
    return label.includes(tgtFilter);
  }

  function renderTargetNode(n: LrvNode, depth: number, budget: { left: number; truncated: boolean }): React.ReactNode {
    const isLeaf = n.type !== 'rz' && (!n.children || n.children.length === 0);
    if (isLeaf) {
      if (!targetLeafVisible(n)) return null;
      if (budget.left <= 0) { budget.truncated = true; return null; }
      budget.left--;
      const bound = bindingsByTarget.get(n.row) || [];
      const canLink = !!selected && !p.disabled;
      const dropKey = 'leaf:' + n.row;
      const isDropTarget = dragDropEnabled && dropOverKey === dropKey;
      return (
        <div key={n.row}
          role="button" tabIndex={0}
          onClick={() => { if (selected) link(selected, n.row); }}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && selected) { e.preventDefault(); link(selected, n.row); } }}
          onDragOver={e => { if (dragDropEnabled) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setDropOverKey(dropKey); } }}
          onDragLeave={() => { if (dropOverKey === dropKey) setDropOverKey(null); }}
          onDrop={e => {
            if (!dragDropEnabled) return;
            e.preventDefault(); setDropOverKey(null);
            const uid = e.dataTransfer.getData('text/plain');
            if (uid) handleDropOnLeaf(uid, n.row);
          }}
          style={{ marginLeft: depth * 14 }}
          title={dragDropEnabled ? 'Bu qatorni zamena qilish uchun F2 manba qatorini shu yerga tashlang' : undefined}
          className={
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] border ' +
            (isDropTarget ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500'
              : canLink ? 'cursor-pointer border-accent/40 hover:bg-accent/10' : 'border-transparent') +
            (bound.length ? ' bg-emerald-500/5' : '')
          }>
          <span>{TUR_BELGI[n.type as Tur] || '•'}</span>
          <span className="flex-1 truncate">{n.kod ? n.kod + ' ' : ''}{nom(n.nom, '—')}{n.birlik ? ` (${n.birlik})` : ''}</span>
          {bound.length > 0 && (
            <span className="text-emerald-500 shrink-0 text-[10px] font-medium" title={bound.map(uid => p.labels.get(uid)).join(', ')}>
              {bound.length > 1 ? `${bound.length}x bog‘langan` : 'bog‘langan'}
            </span>
          )}
        </div>
      );
    }
    const children = (n.children || []).map(c => renderTargetNode(c, depth + 1, budget)).filter(Boolean);
    if (n.type === 'rz' && children.length === 0) return null;
    const dropKey = 'container:' + n.row;
    const isDropTarget = dragDropEnabled && dropOverKey === dropKey && (n.type === 'rz' || n.type === 'bl');
    /* Akt tomonda ish tanlangan bo'lsa — smeta ISHLARI bosiladigan
       nishonga aylanadi (bo'lim emas: resurslar ish ostida turadi). */
    const ishniQabulQiladi = !!tanlanganIsh && n.type !== 'rz' && !p.disabled;
    return (
      <div key={(n.row ?? 0) + '-' + (n.nom || '')}>
        <div style={{ marginLeft: depth * 14 }}
          onDragOver={e => { if (dragDropEnabled && (n.type === 'rz' || n.type === 'bl')) { e.preventDefault(); e.dataTransfer.dropEffect = 'link'; setDropOverKey(dropKey); } }}
          onDragLeave={() => { if (dropOverKey === dropKey) setDropOverKey(null); }}
          onDrop={e => {
            if (!dragDropEnabled || (n.type !== 'rz' && n.type !== 'bl')) return;
            e.preventDefault(); setDropOverKey(null);
            const uid = e.dataTransfer.getData('text/plain');
            if (uid) handleDropOnContainer(uid, n.row);
          }}
          {...(ishniQabulQiladi ? {
            role: 'button' as const, tabIndex: 0,
            onClick: () => ishniBogla(tanlanganIsh!, n),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ishniBogla(tanlanganIsh!, n); }
            },
          } : {})}
          title={ishniQabulQiladi
            ? 'Tanlangan akt ishini shu smeta ishiga resurslari bilan birga bog‘lash'
            : dragDropEnabled && (n.type === 'rz' || n.type === 'bl')
              ? (n.type === 'rz' ? 'Yangi ish (BL) qo‘shish uchun shu yerga tashlang' : 'Yangi resurs qo‘shish uchun shu yerga tashlang')
              : undefined}
          className={
            'px-2 py-1 text-[12px] font-semibold rounded-md border ' +
            (ishniQabulQiladi ? 'cursor-pointer border-accent/40 text-text hover:bg-accent/10 ' : 'text-text-dim ') +
            (isDropTarget ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500' : ishniQabulQiladi ? '' : 'border-transparent')
          }>
          {TUR_BELGI[n.type as Tur] || '📁'} {nom(n.nom, 'Bo‘lim')}
          {ishniQabulQiladi && <span className="ml-1.5 font-normal text-accent">← shu yerga bog‘lash</span>}
        </div>
        {children}
      </div>
    );
  }

  const sourceBudget = { left: RENDER_CAP, truncated: false };
  const targetBudget = { left: RENDER_CAP, truncated: false };
  const sourceRendered = sourceNodes.map(n => renderSourceNode(n, 0, sourceBudget));
  const targetRendered = p.smetaRoots.map(n => renderTargetNode(n, 0, targetBudget));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-[12px]">
        <span className="font-medium">{p.sourceFlat.length} manba qatoridan {matchedCount} tasi bog‘landi</span>
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 min-w-[100px] max-w-[240px] overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: (p.sourceFlat.length ? (matchedCount / p.sourceFlat.length * 100) : 0) + '%' }} />
        </div>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={faqatMoslashmagan} onChange={e => setFaqatMoslashmagan(e.target.checked)} /> faqat moslashmaganlar
        </label>
        {selected && (
          <span className="text-accent inline-flex items-center gap-1">
            <ArrowRight size={13} /> "{p.labels.get(selected)}" tanlandi — o‘ng tomondan smeta qatorini bosing
          </span>
        )}
        {tanlanganIsh && (
          <span className="inline-flex flex-wrap items-center gap-1 text-accent">
            <ArrowRight size={13} /> «{nom(tanlanganIsh.nom, 'Ish')}» ({(tanlanganIsh.children || []).length} resurs) tanlandi
            — o‘ng tomondan MOS SMETA ISHINI bosing, resurslari birga bog‘lanadi
            <button type="button" onClick={() => setTanlanganIsh(null)}
              className="ml-1 rounded px-1 text-text-mute hover:text-text">bekor</button>
          </span>
        )}
        {ishNatija && (
          <span className="inline-flex flex-wrap items-center gap-1 text-text-dim">
            {ishNatija}
            <button type="button" onClick={() => setIshNatija(null)}
              className="ml-1 rounded px-1 text-text-mute hover:text-text">×</button>
          </span>
        )}
      </div>

      {/* Tor ekranda ikki panelni yonma-yon siqish o'rniga ustma-ust
          qo'yamiz — aks holda ikkalasi ham o'qib bo'lmaydigan darajada
          ensiz bo'ladi. Bog'lashning "tanla → o'ngdan bos" usuli ikkala
          holatda ham ishlaydi (sudrash faqat keng ekranda qulay). */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="karta overflow-hidden flex flex-col">
          <div className="px-2 py-1.5 border-b border-border bg-surface-2/60 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wide">F2 manba (fayl)</span>
            <div className="relative flex-1">
              <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-mute" />
              <input aria-label="Manba qidirish" value={srcQ} onChange={e => setSrcQ(e.target.value)}
                className="w-full text-[11px] pl-5 pr-1.5 py-0.5 border rounded" placeholder="qidirish…" />
            </div>
          </div>
          <div className="overflow-auto max-h-[50vh] p-1">
            {sourceRendered}
            {sourceBudget.truncated && (
              <p className="text-[11px] text-text-mute px-2 py-1">… {RENDER_CAP} tadan ko‘pi ko‘rsatilmayapti — qidiruv bilan torating.</p>
            )}
          </div>
        </div>

        <div className="karta overflow-hidden flex flex-col">
          <div className="px-2 py-1.5 border-b border-border bg-surface-2/60 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-text-dim uppercase tracking-wide">Smeta / LRV (kanonik)</span>
            <div className="relative flex-1">
              <Search size={12} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-text-mute" />
              <input aria-label="Smeta qidirish" value={tgtQ} onChange={e => setTgtQ(e.target.value)}
                className="w-full text-[11px] pl-5 pr-1.5 py-0.5 border rounded" placeholder="qidirish…" />
            </div>
          </div>
          <div className="overflow-auto max-h-[50vh] p-1">
            {targetRendered}
            {targetBudget.truncated && (
              <p className="text-[11px] text-text-mute px-2 py-1">… {RENDER_CAP} tadan ko‘pi ko‘rsatilmayapti — qidiruv bilan torating.</p>
            )}
          </div>
        </div>
      </div>

      {p.sourceFlat.some(n => !p.mapping.has(n.uid)) && !faqatMoslashmagan && (
        <p className="text-[11px] text-text-mute">Moslashmagan qatorlarni tezroq topish uchun "faqat moslashmaganlar"ni belgilang.</p>
      )}
      {dragDropEnabled && (
        <p className="text-[11px] text-text-mute flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><GitPullRequestArrow size={12} /> qator ustiga tashlang — zamena</span>
          <span className="inline-flex items-center gap-1"><PlusSquare size={12} /> bo‘lim/ish ustiga tashlang — qo‘shimcha</span>
        </p>
      )}
      {pendingDrop && p.companyId != null && p.objectId != null && (() => {
        const srcNode = sourceNodeByUid(pendingDrop.sourceUid);
        const srcFlat = p.sourceFlat.find(f => f.uid === pendingDrop.sourceUid);
        const label = p.labels.get(pendingDrop.sourceUid) || '';
        return (
          <F2AddReplModal
            action={pendingDrop.action}
            companyId={p.companyId}
            objectId={p.objectId}
            initialNom={srcNode?.nom || label.replace(/\s*\([^)]*\)\s*$/, '').trim() || label}
            initialKod={srcNode?.kod}
            initialBirlik={srcNode?.bir}
            initialHajm={srcNode?.hajm ?? srcFlat?.hajm}
            onClose={() => setPendingDrop(null)}
            onCreated={afterCreated}
          />
        );
      })()}
    </div>
  );
}
