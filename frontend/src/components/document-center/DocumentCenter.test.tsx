import { describe, expect, it } from 'vitest';
import { titleForDocumentState } from './testUtils';
describe('document center contracts', () => { it('keeps replica failures independent from canonical state', () => expect(titleForDocumentState('READY', 'FAILED')).toBe('Canonical READY')); it('never auto-resolves conflicts', () => expect(titleForDocumentState('READY', 'CONFLICT')).toContain('Canonical READY')); });
