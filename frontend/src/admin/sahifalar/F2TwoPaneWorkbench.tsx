import { useMemo, useState } from 'react';
import { Search, Link2, Unlink, ArrowRight } from 'lucide-react';
import type { AktNode, LrvNode } from '../../lib/f2-match-engine';
import type { F2ExactManbaTugun } from '../../test02/f2-exact-payload';

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
}

function nom(n: string | undefined, fallback: string) { return n && n.trim() ? n : fallback; }

/** Fallback: build a flat, unnested pseudo-tree from sourceFlat when the real
 *  hierarchy isn't available (e.g. a resumed session -- the draft only
 *  persisted flat leaves, not the original file's rz/bl grouping). */
function flatSourceNodes(flat: F2ExactManbaTugun[], labels: Map<string, string>): AktNode[] {
  return flat.map(n => ({ uid: n.uid, type: 'rs' as const, nom: labels.get(n.uid) || n.uid, hajm: n.hajm, narx: n.narx ?? undefined, summa: n.summa ?? undefined }));
}

export function F2TwoPaneWorkbench(p: F2TwoPaneWorkbenchProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [srcQ, setSrcQ] = useState('');
  const [tgtQ, setTgtQ] = useState('');
  const [faqatMoslashmagan, setFaqatMoslashmagan] = useState(false);

  const sourceNodes = p.sourceTree ?? flatSourceNodes(p.sourceFlat, p.labels);
  const bindingsByTarget = useMemo(() => {
    const m = new Map<number, string[]>();
    for (const [uid, id] of p.mapping) { const a = m.get(id); if (a) a.push(uid); else m.set(id, [uid]); }
    return m;
  }, [p.mapping]);

  const matchedCount = p.sourceFlat.filter(n => p.mapping.has(n.uid)).length;

  function link(sourceUid: string, targetId: number) {
    const next = new Map(p.mapping);
    next.set(sourceUid, targetId);
    p.onMappingChange(next);
    setSelected(null);
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
          onClick={() => !p.disabled && setSelected(isSelected ? null : n.uid)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!p.disabled) setSelected(isSelected ? null : n.uid); } }}
          style={{ marginLeft: depth * 14 }}
          className={
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] cursor-pointer border ' +
            (isSelected ? 'border-accent bg-accent/10 ring-1 ring-accent'
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
    return (
      <div key={n.uid}>
        <div style={{ marginLeft: depth * 14 }} className="px-2 py-1 text-[12px] font-semibold text-text-dim">
          {TUR_BELGI[n.type as Tur] || '📁'} {nom(n.nom, 'Bo‘lim')}
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
      return (
        <div key={n.row}
          role="button" tabIndex={0}
          onClick={() => { if (selected) link(selected, n.row); }}
          onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && selected) { e.preventDefault(); link(selected, n.row); } }}
          style={{ marginLeft: depth * 14 }}
          className={
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] border ' +
            (canLink ? 'cursor-pointer border-accent/40 hover:bg-accent/10' : 'border-transparent') +
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
    return (
      <div key={(n.row ?? 0) + '-' + (n.nom || '')}>
        <div style={{ marginLeft: depth * 14 }} className="px-2 py-1 text-[12px] font-semibold text-text-dim">
          {TUR_BELGI[n.type as Tur] || '📁'} {nom(n.nom, 'Bo‘lim')}
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
      </div>

      <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
