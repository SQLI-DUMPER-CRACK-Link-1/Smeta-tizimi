export function titleForDocumentState(canonical: string, replica: string) { return `Canonical ${canonical}${replica === 'CONFLICT' ? ' · manual review required' : ''}`; }
