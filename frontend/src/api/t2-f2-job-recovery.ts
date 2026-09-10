import { yozAmali, type AktNatija } from './supabase';

export type F2ImportJobCommandResult = AktNatija & {
  code?: string;
  versiya?: number;
  status?: string;
  recovery_required?: boolean;
};

export type F2ImportRecoveryParams = {
  jobId: number;
  expectedVersiya: number;
  operationId: string;
  staleAfterSeconds?: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validVersionedJob(jobId: number, version: number, operationId: string): boolean {
  return Number.isSafeInteger(jobId) && jobId > 0
    && Number.isSafeInteger(version) && version >= 0
    && UUID_RE.test(operationId);
}

export function f2ImportJobRecover(p: F2ImportRecoveryParams): Promise<F2ImportJobCommandResult> {
  if (!validVersionedJob(p.jobId, p.expectedVersiya, p.operationId)
      || (p.staleAfterSeconds != null && (!Number.isSafeInteger(p.staleAfterSeconds) || p.staleAfterSeconds < 60 || p.staleAfterSeconds > 86400))) {
    return Promise.resolve({ ok: false, code: 'INVALID_INPUT', error: 'F2 recovery parametrlari noto‘g‘ri' });
  }
  return yozAmali({
    amal: 'f2_import_job_recover',
    job_id: p.jobId,
    expected_versiya: p.expectedVersiya,
    operation_id: p.operationId,
    stale_after_seconds: p.staleAfterSeconds,
  }) as Promise<F2ImportJobCommandResult>;
}

export function f2ImportJobCancel(p: {
  jobId: number;
  expectedVersiya: number;
  operationId: string;
  reason: string;
}): Promise<F2ImportJobCommandResult> {
  const reason = p.reason.trim();
  if (!validVersionedJob(p.jobId, p.expectedVersiya, p.operationId) || !reason || reason.length > 2000) {
    return Promise.resolve({ ok: false, code: 'INVALID_INPUT', error: 'F2 cancel parametrlari noto‘g‘ri' });
  }
  return yozAmali({
    amal: 'f2_import_job_cancel',
    job_id: p.jobId,
    expected_versiya: p.expectedVersiya,
    operation_id: p.operationId,
    sabab: reason,
  }) as Promise<F2ImportJobCommandResult>;
}
