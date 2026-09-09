import { yangiOperationId, yozAmali, type AktNatija } from './supabase';

export type PtoLifecycleStatus = 'draft' | 'submitted' | 'checked' | 'approved' | 'rejected' | 'cancelled' | 'superseded';

export type PtoLifecycleResult = AktNatija & {
  code?: string;
  status?: PtoLifecycleStatus;
  from_status?: PtoLifecycleStatus;
  version?: number;
  history_id?: number;
  retry?: boolean;
};

function validId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function validOperationId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Change an F2 lifecycle state through the named server gateway action.
 * Keep `operationId` stable when retrying the same user action.
 */
export function t2AktLifecycleTransition(p: {
  kompaniyaId: number;
  aktId: number;
  toStatus: PtoLifecycleStatus;
  expectedVersion: number;
  operationId?: string;
  reason?: string | null;
}): Promise<PtoLifecycleResult> {
  if (!validId(p.kompaniyaId) || !validId(p.aktId) || !Number.isSafeInteger(p.expectedVersion) || p.expectedVersion < 0) {
    return Promise.resolve({ ok: false, code: 'INVALID_INPUT', error: 'Lifecycle identifikatori yoki versiyasi noto‘g‘ri' });
  }
  const operationId = p.operationId || yangiOperationId();
  if (!validOperationId(operationId)) {
    return Promise.resolve({ ok: false, code: 'INVALID_OPERATION_ID', error: 'Operation ID UUID bo‘lishi shart' });
  }
  return yozAmali({
    amal: 'akt_lifecycle_transition_v1',
    kompaniya_id: p.kompaniyaId,
    akt_id: p.aktId,
    to_status: p.toStatus,
    kutilgan_versiya: p.expectedVersion,
    operation_id: operationId,
    sabab: p.reason ?? null,
  }) as Promise<PtoLifecycleResult>;
}

/**
 * Start a correction from an approved F2. The server creates only a new
 * draft header and provenance link; child financial rows are imported again.
 */
export function t2AktCorrectionCreate(p: {
  kompaniyaId: number;
  sourceAktId: number;
  expectedSourceVersion: number;
  revisionId?: number | null;
  reason: string;
  raqam?: string | null;
  operationId?: string;
}): Promise<PtoLifecycleResult> {
  if (!validId(p.kompaniyaId) || !validId(p.sourceAktId) || !Number.isSafeInteger(p.expectedSourceVersion) || p.expectedSourceVersion < 0) {
    return Promise.resolve({ ok: false, code: 'INVALID_INPUT', error: 'Correction identifikatori yoki versiyasi noto‘g‘ri' });
  }
  const operationId = p.operationId || yangiOperationId();
  if (!validOperationId(operationId)) {
    return Promise.resolve({ ok: false, code: 'INVALID_OPERATION_ID', error: 'Operation ID UUID bo‘lishi shart' });
  }
  return yozAmali({
    amal: 'akt_correction_create_v1',
    kompaniya_id: p.kompaniyaId,
    source_akt_id: p.sourceAktId,
    kutilgan_versiya: p.expectedSourceVersion,
    revision_id: p.revisionId ?? null,
    sabab: p.reason,
    raqam: p.raqam ?? null,
    operation_id: operationId,
  }) as Promise<PtoLifecycleResult>;
}
