/**
 * t2-men.ts — canonical current-user + memberships client (COMPANY/AUTH/DIRECTOR).
 * Reads /api/company?me=1 -> Supabase t2_men_v1. Commands -> /api/company (POST).
 * NO /api/gas, NO Drive/Sheets. Actor identity is server-side (session).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type Azolik = {
  azolik_id: number; kompaniya_id: number; nom: string; kod: string;
  rol: string; is_director: boolean; holat: string; faol: boolean;
};
export type Men = {
  ok: true;
  foydalanuvchi: { id: number; login: string; ism: string | null; email: string | null; holat: string };
  azoliklar: Azolik[];
  jami: number;
  onboarding_kerak: boolean;
};

export type MenError = Error & { code?: string };
function toErr(j: any, status: number): MenError {
  const e = new Error((j && (j.xato || j.code)) || ('HTTP ' + status)) as MenError;
  e.code = (j && j.code) || ('HTTP_' + status);
  return e;
}

export async function menOl(): Promise<Men> {
  const r = await fetch('/api/company?me=1');
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return j as Men;
}

export function useMen() {
  return useQuery({
    queryKey: ['men'],
    queryFn: menOl,
    staleTime: 60 * 1000,
    retry: (n, e: any) => e?.code !== 'AUTH_REQUIRED' && n < 2,
  });
}

async function post(action: string, payload: Record<string, unknown>) {
  const r = await fetch('/api/company', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return j;
}

export type KompaniyaYaratInput = { nom: string; inn?: string; telefon?: string; operation_id?: string };
export type MemberAddInput = { kompaniya_id: number; login: string; rol: string; email?: string; ism?: string; operation_id?: string };
export type MemberRoleInput = { azolik_id: number; rol: string; operation_id?: string };
export type MemberRemoveInput = { azolik_id: number; operation_id?: string };

export const kompaniyaYarat = (i: KompaniyaYaratInput) => post('create', i);
export const azoQosh = (i: MemberAddInput) => post('member_add', i);
export const azoRol = (i: MemberRoleInput) => post('member_role', i);
export const azoOchir = (i: MemberRemoveInput) => post('member_remove', i);

export function useOnboardingCommands() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['men'] }); };
  return {
    yarat: useMutation({ mutationFn: kompaniyaYarat, onSuccess: done }),
    azoQosh: useMutation({ mutationFn: azoQosh, onSuccess: done }),
    azoRol: useMutation({ mutationFn: azoRol, onSuccess: done }),
    azoOchir: useMutation({ mutationFn: azoOchir, onSuccess: done }),
  };
}
