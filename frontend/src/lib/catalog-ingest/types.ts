import type { TreeNode } from '../../api/types';

export type CatalogSourceType = 'smeta' | 'f2' | 'other';
export type CatalogObservationKind = 'work_type' | 'resource';
export type ResourceKind = 'labor' | 'machine' | 'material' | 'equipment' | 'other';

export type CatalogIngestScope = {
  companyId: number;
  objectId: number;
  projectId?: number;
  documentId?: number;
  revisionId?: number;
  sourceType: CatalogSourceType;
};

export type CatalogObservation = {
  kind: CatalogObservationKind;
  resourceKind?: ResourceKind;
  scope: CatalogIngestScope;
  sourceLineKey: string;
  code?: string;
  name: string;
  unit?: string;
  /** Manba narxi, faqat parser chiqishi; observation migratsiyasida price ustuni yo'q. */
  sourcePrice?: number;
};

export type CanonicalCatalogIdentity = {
  canonicalId: string;
  kind: CatalogObservationKind;
  companyId: number;
  code: string;
  name: string;
  unit: string;
};

export type CatalogMatch = CatalogObservation & {
  match: 'auto_linked' | 'candidate_review' | 'unmatched';
  canonicalId?: string;
  candidateIds: string[];
};

export type CatalogTreeInput = TreeNode[];
