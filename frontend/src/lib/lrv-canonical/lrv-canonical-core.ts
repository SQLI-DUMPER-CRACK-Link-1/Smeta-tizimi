/** T2 LRV canonical core — pure, deterministic, transport-agnostic. */
export type Id = string;
export type LineKind = 'base' | 'additional' | 'replacement' | 'resource';
export type SourceLine = Readonly<{
  id: Id; documentRevisionId: Id; externalRowKey: string; kind: 'smeta' | 'f2';
  code: string | null; name: string; unit: string | null; quantity: number | null;
  unitPrice: number | null; amount: number | null; raw: Readonly<Record<string, unknown>>;
}>;
export type CanonicalLine = Readonly<{
  id: Id; parentId: Id | null; kind: LineKind; orderingKey: string; version: number;
  code: string | null; name: string; unit: string | null; baselineQuantity: number | null;
  status: 'active' | 'replaced' | 'cancelled'; replacedById?: Id;
}>;
export type ApprovedF2 = Readonly<{
  id: Id; sourceF2LineId: Id; targetLrvEntityId: Id; certifiedQuantity: number | null;
  certifiedUnitPrice: number | null; certifiedAmount: number | null; approvedAt: string;
  approvedRevision: number; frozen: true;
}>;
export type WorkObservation = Readonly<{ sourceLineId: Id; normalizedName: string; normalizedUnit: string | null; normalizedCode: string | null }>;
export type MatchCandidate = Readonly<{ sourceLineId: Id; workTypeId: Id; score: number; exact: boolean; reason: 'exact_identity' | 'ambiguous' }>;
export type RecipeResource = Readonly<{ resourceType: 'labor' | 'material' | 'equipment'; code: string | null; name: string; unit: string | null; norm: number | null }>;
export type SyncEnvelope = Readonly<{ eventId: Id; operationId: Id; origin: 'supabase' | 'sheets'; entityId: Id; entityVersion: number; baseVersion: number; projectionHash: string; occurredAt: string }>;
export type ProjectionRecord = Readonly<{ entityId: Id; entityVersion: number; projectionHash: string; hiddenMetadata: Readonly<Record<string, string>> }>;
export type ChangeEnvelope = SyncEnvelope & Readonly<{ action: 'upsert' | 'additional' | 'replacement' }>;
export type ConflictRecord = Readonly<{ eventId: Id; entityId: Id; reason: 'STALE_VERSION' | 'FROZEN_F2' | 'ROW_MAPPING_MISSING'; baseVersion: number; currentVersion: number }>;

const norm = (v: string | null) => (v ?? '').trim().toLocaleUpperCase().replace(/[\s.,/\\-]+/g, '');
export const exactIdentity = (line: Pick<SourceLine, 'code' | 'name' | 'unit'>, work: Pick<CanonicalLine, 'code' | 'name' | 'unit'>) =>
  norm(line.name) === norm(work.name) && norm(line.unit) === norm(work.unit) && (!norm(line.code) || !norm(work.code) || norm(line.code) === norm(work.code));
export function observe(line: SourceLine): WorkObservation { return { sourceLineId: line.id, normalizedName: norm(line.name), normalizedUnit: norm(line.unit) || null, normalizedCode: norm(line.code) || null }; }
/** Faqat bitta exact natija automatic; qolgan holat candidate, hech qachon link emas. */
export function matchCandidates(line: SourceLine, works: readonly CanonicalLine[]): MatchCandidate[] {
  const exact = works.filter((w) => exactIdentity(line, w));
  return exact.map((w) => ({ sourceLineId: line.id, workTypeId: w.id, score: 1, exact: exact.length === 1, reason: exact.length === 1 ? 'exact_identity' : 'ambiguous' }));
}
export function autoLink(line: SourceLine, works: readonly CanonicalLine[]): Id | null { const c = matchCandidates(line, works); return c.length === 1 && c[0].exact ? c[0].workTypeId : null; }
/** Source amount formula bilan mos kelmasa ham aynan source amount freeze qilinadi. */
export function approveF2(input: Omit<ApprovedF2, 'frozen'>): ApprovedF2 { return { ...input, frozen: true }; }
export type ControlTotals = Readonly<{ baselineQty: number; faktQty: number; approvedF2Qty: number; approvedF2Amount: number; smetaRemainder: number; f2Available: number }>;
export function controlTotals(input: { baselineQty: number | null; faktQuantities: readonly (number | null)[]; approved: readonly ApprovedF2[]; }): ControlTotals {
  // NULL source factni o‘zgartirmaydi; faqat aggregate matematikasida 0 hissa beradi.
  const sum = (xs: readonly (number | null)[]): number => xs.reduce<number>((n, x) => n + (x ?? 0), 0);
  const baselineQty = input.baselineQty ?? 0, approvedF2Qty = sum(input.approved.map(x => x.certifiedQuantity));
  return { baselineQty, faktQty: sum(input.faktQuantities), approvedF2Qty, approvedF2Amount: sum(input.approved.map(x => x.certifiedAmount)), smetaRemainder: baselineQty - approvedF2Qty, f2Available: Math.max(0, sum(input.faktQuantities) - approvedF2Qty) };
}
export type ChangeCommand = Readonly<{ operationId: Id; expectedVersion: number; entityId: Id; orderingKey: string; kind: 'additional' | 'replacement' | 'resource'; parentId?: Id | null; name: string; unit: string | null; code: string | null }>;
export type ChangeResult = Readonly<{ lines: readonly CanonicalLine[]; audit: Readonly<{ operationId: Id; action: string; entityId: Id }>; idempotent: boolean }>;
/** Caller transactionga teng pure preflight: error bo‘lsa original array qaytmaydi, mutation yo‘q. */
export function applyChange(lines: readonly CanonicalLine[], command: ChangeCommand): ChangeResult {
  const existing = lines.find(x => x.id === command.operationId);
  if (existing) return { lines, audit: { operationId: command.operationId, action: 'idempotent', entityId: existing.id }, idempotent: true };
  const target = lines.find(x => x.id === command.entityId);
  if (!target || target.version !== command.expectedVersion) throw new Error('STALE_OR_MISSING_ENTITY');
  if (command.kind === 'resource' && !command.parentId) throw new Error('PARENT_REQUIRED');
  const added: CanonicalLine = { id: command.operationId, parentId: command.kind === 'replacement' ? target.parentId : (command.parentId ?? target.id), kind: command.kind, orderingKey: command.orderingKey, version: 1, code: command.code, name: command.name, unit: command.unit, baselineQuantity: null, status: 'active' };
  const next = command.kind === 'replacement' ? lines.map(x => x.id === target.id ? { ...x, status: 'replaced' as const, replacedById: added.id, version: x.version + 1 } : x).concat(added) : lines.concat(added);
  return { lines: next, audit: { operationId: command.operationId, action: command.kind, entityId: added.id }, idempotent: false };
}
/** Recipe 7/12 bo‘lsa preflight tashlaydi: yarim visible resource tree hosil bo‘lmaydi. */
export function materializeRecipe(parent: CanonicalLine, recipe: readonly RecipeResource[], operationId: Id): CanonicalLine[] {
  if (!recipe.length || recipe.some(r => !r.name || !r.unit || r.norm == null || r.norm < 0)) throw new Error('RECIPE_PREFLIGHT_FAILED');
  return recipe.map((r, i) => ({ id: `${operationId}:${i}`, parentId: parent.id, kind: 'resource', orderingKey: `${parent.orderingKey}.${String(i + 1).padStart(4, '0')}`, version: 1, code: r.code, name: r.name, unit: r.unit, baselineQuantity: r.norm, status: 'active' }));
}
export type SyncResult = Readonly<{ apply: boolean; conflict?: ConflictRecord; projection?: ProjectionRecord }>;
/** Sheet row index hech qachon identity emas; entity ID hidden metadata yoki external mappingda. */
export function receiveSync(envelope: SyncEnvelope, record: ProjectionRecord | undefined, frozenF2EntityIds: ReadonlySet<Id>, seenEvents: ReadonlySet<Id>): SyncResult {
  if (seenEvents.has(envelope.eventId)) return { apply: false };
  if (frozenF2EntityIds.has(envelope.entityId)) return { apply: false, conflict: { eventId: envelope.eventId, entityId: envelope.entityId, reason: 'FROZEN_F2', baseVersion: envelope.baseVersion, currentVersion: record?.entityVersion ?? 0 } };
  if (!record) return { apply: false, conflict: { eventId: envelope.eventId, entityId: envelope.entityId, reason: 'ROW_MAPPING_MISSING', baseVersion: envelope.baseVersion, currentVersion: 0 } };
  if (record.entityVersion !== envelope.baseVersion) return { apply: false, conflict: { eventId: envelope.eventId, entityId: envelope.entityId, reason: 'STALE_VERSION', baseVersion: envelope.baseVersion, currentVersion: record.entityVersion } };
  if (record.projectionHash === envelope.projectionHash) return { apply: false };
  return { apply: true, projection: { entityId: envelope.entityId, entityVersion: envelope.entityVersion, projectionHash: envelope.projectionHash, hiddenMetadata: { t2_entity_id: envelope.entityId, t2_entity_version: String(envelope.entityVersion) } } };
}
