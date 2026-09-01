/**
 * Typed integration boundary for the existing canonical F2/estimate model.
 * This file intentionally does not invent an HTTP endpoint or persistence.
 */
import type { ParkCalculationInput, ParkPeriodSnapshot } from '../lib/park-document-control';

export interface ParkDocumentControlReadModel {
  companyId: string;
  projectId: string;
  objectId: string;
  input: ParkCalculationInput;
}

/** Claude's adapter must obtain this from Supabase canonical F2/smeta truth. */
export interface ParkDocumentControlPort {
  read(input: { companyId: string; projectId: string; objectId: string; throughPeriod: number }): Promise<ParkDocumentControlReadModel>;
  /** A new revision/snapshot command; existing snapshots are immutable. */
  createRevision(input: { companyId: string; projectId: string; objectId: string; operationId: string; expectedVersion: number; snapshot: ParkPeriodSnapshot }): Promise<{ revisionId: string; version: number }>;
}
