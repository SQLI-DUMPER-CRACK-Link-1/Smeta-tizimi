export type CloseoutStatus = 'required' | 'present' | 'pending' | 'approved' | 'rejected' | 'superseded' | 'missing' | 'unresolved';
export type CloseoutDocumentType = 'contract' | 'f2' | 'nakopitelniy' | 'aosr' | 'act' | 'invoice' | 'handover' | 'change_evidence' | 'forma3';

export interface CloseoutDocumentMetadata {
  documentId: string;
  objectId: string;
  type: CloseoutDocumentType;
  status: Exclude<CloseoutStatus, 'required' | 'missing' | 'unresolved'>;
  periodId?: string;
  revisionId?: string;
  supersedesDocumentId?: string;
  evidenceIds?: readonly string[];
}
export interface CloseoutRequirement {
  requirementId: string;
  type: CloseoutDocumentType;
  label: string;
  required: boolean;
  periodId?: string;
  requiresApproved: boolean;
  /** Legal rules not evidenced in the repo must remain unresolved. */
  evidenceRule?: 'verified' | 'forma3_unresolved';
}
export interface ParkExportPeriod {
  periodId: string;
  revisionId: string;
  frozen: boolean;
  previousQuantity: number;
  currentQuantity: number;
  cumulativeQuantity: number;
  approvedQuantity: number;
  previousValue: number;
  currentValue: number;
  cumulativeValue: number;
  approvedValue: number;
  /** Both sources must be visible rather than overwriting reference history. */
  referencePriceSourceId?: string;
  actualPriceSourceId?: string;
  approvedChangeIds: readonly string[];
  includedApprovedChangeIds: readonly string[];
}
export interface ParkCloseoutReadModel {
  objectId: string;
  documents: readonly CloseoutDocumentMetadata[];
  requirements: readonly CloseoutRequirement[];
  exportPeriods: readonly ParkExportPeriod[];
}
/** Claude supplies this port from canonical metadata/read models; this lab defines no endpoint. */
export interface ParkCloseoutPort { read(input: { companyId: string; projectId: string; objectId: string }): Promise<ParkCloseoutReadModel>; }
export interface CloseoutReportRow { objectId: string; requirement: string; status: CloseoutStatus; blocking: boolean; evidenceIds: string[]; reason: string; }
export interface ExportConsistencyIssue { periodId: string; rule: string; blocking: boolean; reason: string; }
export interface ParkCloseoutValidation { report: CloseoutReportRow[]; exportIssues: ExportConsistencyIssue[]; blockingCount: number; }
