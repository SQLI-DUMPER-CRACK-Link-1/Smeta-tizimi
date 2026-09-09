/**
 * Pure, non-destructive Smeta re-import comparison.
 *
 * This module classifies a new source revision against the previous canonical
 * snapshot. It deliberately produces history candidates, not delete commands:
 * a removed source line must be reviewed and soft-reversed by a named writer.
 * NULL remains NULL throughout the comparison.
 */

export type SmetaReimportScalar = string | number | null;

export type SmetaReimportLine = {
  /** Canonical t2_qator id when the source line is already bound. */
  canonicalId: number | string | null;
  /** Stable source/document identity; never a spreadsheet row number. */
  sourceKey: string | null;
  kod: SmetaReimportScalar;
  nom: string | null;
  birlik: string | null;
  hajm: number | null;
  norma: number | null;
  narx: number | null;
};

export type SmetaReimportDiffKind =
  | 'same'
  | 'changed'
  | 'added'
  | 'removed'
  | 'same_name_different_code'
  | 'same_code_different_unit'
  | 'correction'
  | 'replacement'
  | 'ambiguous';

export type SmetaReimportEntry = {
  kind: SmetaReimportDiffKind;
  identity: string;
  before: SmetaReimportLine | null;
  after: SmetaReimportLine | null;
  reason: string;
};

export type SmetaReimportDiff = {
  same: SmetaReimportEntry[];
  /** All non-add/remove/ambiguous matched changes; specific buckets below are subsets. */
  changed: SmetaReimportEntry[];
  added: SmetaReimportEntry[];
  removed: SmetaReimportEntry[];
  sameNameDifferentCode: SmetaReimportEntry[];
  sameCodeDifferentUnit: SmetaReimportEntry[];
  correction: SmetaReimportEntry[];
  replacement: SmetaReimportEntry[];
  ambiguous: SmetaReimportEntry[];
  /** Review/history events only; no destructive command is emitted. */
  history: SmetaReimportEntry[];
};

const numericFields = ['hajm', 'norma', 'narx'] as const;

function normalized(value: SmetaReimportScalar): string {
  if (value == null) return '';
  return String(value).normalize('NFKC').trim().toLocaleLowerCase();
}

function scalarEqual(a: SmetaReimportScalar, b: SmetaReimportScalar): boolean {
  return a === b || (a == null && b == null);
}

function identityKey(line: SmetaReimportLine): string | null {
  if (line.canonicalId != null && String(line.canonicalId).trim() !== '') {
    return `canonical:${String(line.canonicalId).trim()}`;
  }
  if (line.sourceKey != null && line.sourceKey.trim() !== '') {
    return `source:${normalized(line.sourceKey)}`;
  }
  return null;
}

function naturalKey(line: SmetaReimportLine): string {
  return [normalized(line.kod), normalized(line.nom), normalized(line.birlik)].join('|');
}

function sameLine(a: SmetaReimportLine, b: SmetaReimportLine): boolean {
  return scalarEqual(a.canonicalId, b.canonicalId)
    && scalarEqual(a.sourceKey, b.sourceKey)
    && scalarEqual(a.kod, b.kod)
    && scalarEqual(a.nom, b.nom)
    && scalarEqual(a.birlik, b.birlik)
    && numericFields.every((field) => scalarEqual(a[field], b[field]));
}

function structuralIdentitySame(a: SmetaReimportLine, b: SmetaReimportLine): boolean {
  return normalized(a.kod) === normalized(b.kod)
    && normalized(a.nom) === normalized(b.nom)
    && normalized(a.birlik) === normalized(b.birlik);
}

function numericValuesChanged(a: SmetaReimportLine, b: SmetaReimportLine): boolean {
  return numericFields.some((field) => !scalarEqual(a[field], b[field]));
}

function entry(
  kind: SmetaReimportDiffKind,
  before: SmetaReimportLine | null,
  after: SmetaReimportLine | null,
  reason: string,
): SmetaReimportEntry {
  const identity = identityKey(after ?? before!) ?? naturalKey(after ?? before!);
  return { kind, identity, before, after, reason };
}

function makeDiff(): SmetaReimportDiff {
  return {
    same: [], changed: [], added: [], removed: [], sameNameDifferentCode: [],
    sameCodeDifferentUnit: [], correction: [], replacement: [], ambiguous: [], history: [],
  };
}

function add(diff: SmetaReimportDiff, item: SmetaReimportEntry): void {
  const bucket: Record<SmetaReimportDiffKind, SmetaReimportEntry[]> = {
    same: diff.same,
    changed: diff.changed,
    added: diff.added,
    removed: diff.removed,
    same_name_different_code: diff.sameNameDifferentCode,
    same_code_different_unit: diff.sameCodeDifferentUnit,
    correction: diff.correction,
    replacement: diff.replacement,
    ambiguous: diff.ambiguous,
  };
  bucket[item.kind].push(item);
  if (item.kind !== 'same' && item.kind !== 'added' && item.kind !== 'removed' && item.kind !== 'ambiguous' && item.kind !== 'changed') {
    diff.changed.push(item);
  }
  if (item.kind !== 'same') diff.history.push(item);
}

function uniqueIndexMap(lines: readonly SmetaReimportLine[], key: (line: SmetaReimportLine) => string): Map<string, number[]> {
  const result = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const value = key(line);
    const indices = result.get(value) ?? [];
    indices.push(index);
    result.set(value, indices);
  });
  return result;
}

/**
 * Compare two source snapshots without mutating either input.
 *
 * Matching order is intentionally conservative:
 * 1. canonicalId/sourceKey, 2. exact code+name+unit, 3. safe collision
 * categories, 4. code+unit name change. Anything else stays added/removed.
 */
export function smetaQaytaImportDiff(
  before: readonly SmetaReimportLine[],
  after: readonly SmetaReimportLine[],
): SmetaReimportDiff {
  const diff = makeDiff();
  const oldMatched = new Set<number>();
  const newMatched = new Set<number>();
  const oldIdentity = uniqueIndexMap(before, (line) => identityKey(line) ?? '');
  const newIdentity = uniqueIndexMap(after, (line) => identityKey(line) ?? '');

  const pair = (oldIndex: number, newIndex: number, kind: SmetaReimportDiffKind, reason: string): void => {
    if (oldMatched.has(oldIndex) || newMatched.has(newIndex)) return;
    oldMatched.add(oldIndex);
    newMatched.add(newIndex);
    add(diff, entry(kind, before[oldIndex], after[newIndex], reason));
  };

  // A duplicated stable identity is not auto-merged; it needs operator review.
  for (const [key, oldIndices] of oldIdentity) {
    if (!key || oldIndices.length < 2) continue;
    for (const oldIndex of oldIndices) {
      add(diff, entry('ambiguous', before[oldIndex], null, `duplicate previous identity: ${key}`));
      oldMatched.add(oldIndex);
    }
  }
  for (const [key, newIndices] of newIdentity) {
    if (!key || newIndices.length < 2) continue;
    for (const newIndex of newIndices) {
      add(diff, entry('ambiguous', null, after[newIndex], `duplicate incoming identity: ${key}`));
      newMatched.add(newIndex);
    }
  }

  // First preserve explicit canonical/source identity.
  after.forEach((line, newIndex) => {
    const key = identityKey(line);
    if (!key || newMatched.has(newIndex)) return;
    const oldIndices = oldIdentity.get(key) ?? [];
    if (oldIndices.length !== 1) return;
    const oldIndex = oldIndices[0];
    if (oldMatched.has(oldIndex)) return;
    const oldLine = before[oldIndex];
    if (sameLine(oldLine, line)) pair(oldIndex, newIndex, 'same', 'same stable identity and all preserved values');
    else if (!structuralIdentitySame(oldLine, line)) pair(oldIndex, newIndex, 'replacement', 'stable identity preserved but code/name/unit changed');
    else if (numericValuesChanged(oldLine, line)) pair(oldIndex, newIndex, 'correction', 'stable identity and line identity preserved; quantity/price fields changed');
    else pair(oldIndex, newIndex, 'changed', 'stable identity preserved but non-numeric source fields changed');
  });

  // Then accept only a unique exact natural identity when no stable identity exists.
  const oldNatural = uniqueIndexMap(before, naturalKey);
  const newNatural = uniqueIndexMap(after, naturalKey);
  after.forEach((line, newIndex) => {
    if (newMatched.has(newIndex)) return;
    const indices = oldNatural.get(naturalKey(line)) ?? [];
    const available = indices.filter((index) => !oldMatched.has(index));
    if (available.length !== 1 || (newNatural.get(naturalKey(line)) ?? []).length !== 1) return;
    const oldIndex = available[0];
    pair(oldIndex, newIndex, sameLine(before[oldIndex], line) ? 'same' : 'changed', 'unique code/name/unit natural identity');
  });

  const unmatchedOld = () => before.map((_, i) => i).filter((i) => !oldMatched.has(i));
  const unmatchedNew = () => after.map((_, i) => i).filter((i) => !newMatched.has(i));

  // Explicit collision diagnostics are more useful than silently producing add/remove.
  for (const newIndex of unmatchedNew()) {
    const line = after[newIndex];
    const candidates = unmatchedOld().filter((oldIndex) => normalized(before[oldIndex].nom) === normalized(line.nom));
    const codeDiff = candidates.filter((oldIndex) => normalized(before[oldIndex].kod) !== normalized(line.kod));
    if (codeDiff.length === 1) pair(codeDiff[0], newIndex, 'same_name_different_code', 'same normalized name with a different code; review rebind');
  }
  for (const newIndex of unmatchedNew()) {
    const line = after[newIndex];
    const candidates = unmatchedOld().filter((oldIndex) => normalized(before[oldIndex].kod) === normalized(line.kod));
    const unitDiff = candidates.filter((oldIndex) => normalized(before[oldIndex].birlik) !== normalized(line.birlik));
    if (unitDiff.length === 1) pair(unitDiff[0], newIndex, 'same_code_different_unit', 'same normalized code with a different unit; block automatic rebind');
  }

  // A changed label with the same code and unit is still one line, but not a correction.
  for (const newIndex of unmatchedNew()) {
    const line = after[newIndex];
    const candidates = unmatchedOld().filter((oldIndex) => normalized(before[oldIndex].kod) === normalized(line.kod)
      && normalized(before[oldIndex].birlik) === normalized(line.birlik));
    if (candidates.length === 1) pair(candidates[0], newIndex, 'changed', 'same code and unit with a changed source name');
  }

  for (const newIndex of unmatchedNew()) add(diff, entry('added', null, after[newIndex], 'incoming source line has no safe previous identity'));
  for (const oldIndex of unmatchedOld()) add(diff, entry('removed', before[oldIndex], null, 'previous source line is absent from the incoming revision; review soft-removal'));

  return diff;
}
