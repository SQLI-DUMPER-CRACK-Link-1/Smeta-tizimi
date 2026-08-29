export type QuantityUnit = 'kg' | 't' | 'm3' | 'm2' | 'm' | 'pcs' | 'machine-hour' | 'labor-hour';
export type ResourceType = 'labor' | 'machine' | 'material' | 'equipment';
export type EvidenceKind = 'user_text' | 'source_file' | 'smeta_row' | 'invoice' | 'manual' | 'norm';
export type FactState = 'known' | 'assumed' | 'missing' | 'requires_confirmation';

export type Evidence = { kind: EvidenceKind; value: string; locator?: string };
export type EstimateResource = {
  type: ResourceType; resourceId?: string; name: string; quantity: number; unit: QuantityUnit;
  priceSource?: Evidence; price?: number | null; evidence: Evidence[];
};
export type EstimateWorkItem = {
  id: string; name: string; quantity?: number; unit?: QuantityUnit; source: Evidence[];
  sourceConfidence: number; normId?: string; normCandidateIds: string[]; assumptions: string[];
  questions: string[]; attributes: Record<string, string>; resources: EstimateResource[];
};
export type EstimateSection = { id: string; name: string; items: EstimateWorkItem[] };
export type EstimateDocument = { id: string; title: string; sections: EstimateSection[]; evidence: Evidence[] };
export type ValidationIssue = {
  severity: 'info' | 'warning' | 'error' | 'block'; code: string; message: string; requiredAction?: string;
};
export type ParsedFact = { state: FactState; field: string; value?: string | number; unit?: QuantityUnit; evidence: Evidence[] };
export type ParseResult = { document: EstimateDocument; facts: ParsedFact[]; issues: ValidationIssue[] };

export type NormCandidate = {
  normId: string; code: string; title: string; score: number; reasons: string[];
  requiredParameters: string[]; missingParameters: string[];
};
export type WorkContext = { item: EstimateWorkItem; document: EstimateDocument };
export interface NormMatcher { findCandidates(context: WorkContext): Promise<NormCandidate[]> | NormCandidate[]; }

export type NormResourceRate = { type: ResourceType; resourceId: string; name: string; quantityPerUnit: number; unit: QuantityUnit };
export type SelectedNorm = { normId: string; workUnit: QuantityUnit; resources: NormResourceRate[] };
export type F2Input = { estimateQuantity?: number; previousCertified: number; currentReported: number; unit: QuantityUnit; matchedEstimateItemId?: string };
export type F2Draft = { current: number; cumulative: number; remaining?: number; unmatchedWork: boolean; issues: ValidationIssue[] };
export type Abc4Profile = { name: string; grammarStatus: 'KNOWN' | 'NEEDS_SAMPLE'; version?: string };
export type Abc4ComposeResult = { grammarStatus: 'KNOWN' | 'NEEDS_SAMPLE'; text: string; issues: ValidationIssue[] };
