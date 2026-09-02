/**
 * t2-control.ts — CTRL-001 System Control Center canonical client.
 * Reads/commands go through /api/system-control -> Supabase RPC.
 * NO /api/gas, NO Drive, NO Sheets. One bounded read call; audited commands.
 *
 * The shape returned by t2_system_control_v1 already matches the Codex
 * `SystemControlData` contract (frontend/src/components/system-control/types.ts),
 * so this module re-exports those types and adds the transport + hooks.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SystemControlData } from '../components/system-control';

export type { SystemControlData } from '../components/system-control';

export type ControlReadEnvelope = SystemControlData & { ok: true; rol: string; generated_at: string };

export type ControlError = Error & { code?: string; versiya?: number };

function toErr(j: any, status: number): ControlError {
  const err = new Error((j && (j.xato || j.code)) || ('HTTP ' + status)) as ControlError;
  err.code = (j && j.code) || ('HTTP_' + status);
  if (j && typeof j.versiya === 'number') err.versiya = j.versiya;
  return err;
}

export async function systemControlOl(kompaniyaId: number, loyihaId?: number | null): Promise<ControlReadEnvelope> {
  const qs = new URLSearchParams({ kompaniya_id: String(Number(kompaniyaId)) });
  if (loyihaId) qs.set('loyiha_id', String(Number(loyihaId)));
  const r = await fetch('/api/system-control?' + qs.toString());
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return j as ControlReadEnvelope;
}

export function useSystemControl(kompaniyaId: number | null | undefined, loyihaId?: number | null) {
  return useQuery({
    queryKey: ['systemControl', kompaniyaId, loyihaId ?? null],
    queryFn: () => systemControlOl(Number(kompaniyaId), loyihaId ?? null),
    enabled: !!kompaniyaId,
    staleTime: 30 * 1000,
    retry: (n, e: any) => e?.code !== 'AUTH_REQUIRED' && e?.code !== 'COMPANY_NOT_FOUND' && n < 2,
  });
}

// ── audited commands ────────────────────────────────────────────────────────
export type OverrideSetInput = {
  kod: string; scope: 'global' | 'company' | 'project'; scope_id?: number | null;
  holat: 'on' | 'off'; sabab?: string; expected_version?: number | null; operation_id?: string;
};
export type KillswitchInput = { kod: string; on: boolean; sabab?: string; operation_id?: string };
export type JobControlInput = { job_kod: string; job_action: 'pause' | 'resume' | 'retry'; operation_id?: string };
export type DeployStateInput = {
  main_sha?: string; frontend_deploy_id?: string; gas_deploy_version?: string; db_migration_head?: string; operation_id?: string;
};

async function post(action: string, payload: Record<string, unknown>) {
  const r = await fetch('/api/system-control', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return j;
}

export const capabilityOverrideSet = (i: OverrideSetInput) => post('capability_override_set', i);
export const capabilityKillswitch = (i: KillswitchInput) => post('capability_killswitch', i);
export const jobControl = (i: JobControlInput) => post('job_control', i);
export const deployStateSet = (i: DeployStateInput) => post('deploy_state_set', i);

/** Mutations that invalidate the read model on success. */
export function useControlCommands(kompaniyaId: number | null | undefined, loyihaId?: number | null) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['systemControl', kompaniyaId, loyihaId ?? null] });
  return {
    overrideSet: useMutation({ mutationFn: capabilityOverrideSet, onSuccess: invalidate }),
    killswitch: useMutation({ mutationFn: capabilityKillswitch, onSuccess: invalidate }),
    job: useMutation({ mutationFn: jobControl, onSuccess: invalidate }),
    deployState: useMutation({ mutationFn: deployStateSet, onSuccess: invalidate }),
  };
}
