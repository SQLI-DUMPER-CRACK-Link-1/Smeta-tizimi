import { describe, expect, it } from 'vitest';
import { mindmapCreateValidation, mindmapEntityNodeId, mindmapRoleValidation } from './mindmap-create-ux';

const fields = [{ kalit: 'nom', nom: 'Loyiha nomi', majburiy: true }];

describe('mindmap creation UX contract', () => {
  it('required field validation blocks empty create', () => {
    expect(mindmapCreateValidation('loyiha', fields, { nom: ' ' })).toBe('Loyiha nomi majburiy');
    expect(mindmapCreateValidation('loyiha', fields, { nom: 'Yangi loyiha' })).toBeNull();
  });

  it('keeps the real entity id for node selection after success', () => {
    expect(mindmapEntityNodeId('texnika', 44)).toBe('texnika:44');
    expect(mindmapEntityNodeId('texnika', 'bad')).toBeNull();
  });

  it('requires an allowed participant role', () => {
    expect(mindmapRoleValidation('')).toBeTruthy();
    expect(mindmapRoleValidation('loyihachi')).toBeNull();
    expect(mindmapRoleValidation('admin')).toBeTruthy();
  });
});
