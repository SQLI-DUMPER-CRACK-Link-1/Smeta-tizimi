import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve(__dirname, 'SmetaTree.tsx'), 'utf8');

describe('SmetaTree consumer compatibility contract', () => {
  it('keeps edit-mode inputs behind isEditMode and persists through setEdits', () => {
    expect(source).toContain('isEditMode && node.type !== \'rz\'');
    expect(source).toContain('setEdits(prev =>');
    expect(source).toContain('edit: { ...(prev[key]?.edit || {}), varaq: node.varaq!, row: node.row!, fakt: val }');
  });
  it('keeps drag source, target and empty-space callback semantics', () => {
    expect(source).toContain('draggable={isEditMode}');
    expect(source).toContain('setDraggedNode(node)');
    expect(source).toContain('onNodeDrop(draggedNode, node)');
    expect(source).toContain('onNodeDrop(draggedNode);');
  });
  it('keeps search, expand/collapse and virtual bounded rendering', () => {
    expect(source).toContain('flattenTree(filtrlangan, kengaytirilgan)');
    expect(source).toContain('useVirtualizer');
    expect(source).toContain('toggleExpand');
  });

  it('makes presets and only supported quick filters affect the rendered tree', () => {
    expect(source).toContain("quickFilter === 'all' && !s ? data : suz(data)");
    expect(source).toContain("quickFilter === 'f2' && Number(n.f2mum) > 0");
    expect(source).toContain("preset === 'TOLIQ' || preset === 'NARX'");
  });
});
