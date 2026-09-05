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

/** Bitta kompaniya a'zolari (list) — kanonik o'qish (t2_azolik_royxat, a'zolik-tekshirilgan). */
export type KompaniyaAzo = {
  azolik_id: number; kompaniya_id: number; rol: string; holat: string;
  foydalanuvchi_id: number; login: string; email: string | null; ism: string | null;
};
export async function kompaniyaAzolariOl(kompaniyaId: number): Promise<KompaniyaAzo[]> {
  const r = await fetch('/api/sb', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jadval: 't2_azolik_royxat', filtr: 'kompaniya_id=eq.' + kompaniyaId, tartib: 'login.asc', limit: 500 }),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return (j.qatorlar as KompaniyaAzo[]) || [];
}
export function useKompaniyaAzolari(kompaniyaId: number | null | undefined) {
  return useQuery({
    queryKey: ['kompaniyaAzolari', kompaniyaId],
    queryFn: () => kompaniyaAzolariOl(kompaniyaId as number),
    enabled: !!kompaniyaId,
    staleTime: 30_000,
  });
}

/** Company profile row (Control Center "Profil" tab) — membership-checked
 * read via /api/company?profile=<id>, canonical write via
 * t2_kompaniya_yangila_v1 (optimistic lock on `versiya`). */
export type KompaniyaProfil = {
  id: number; nom: string; kod: string; toliq_nom: string | null; inn: string | null;
  manzil: string | null; rahbar: string | null; telefon: string | null; bank: string | null;
  hisob_raqam: string | null; mfo: string | null; mavqe: string | null; versiya: number;
};
export async function kompaniyaProfilOl(kompaniyaId: number): Promise<KompaniyaProfil> {
  const r = await fetch('/api/company?profile=' + kompaniyaId);
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || j.ok !== true) throw toErr(j, r.status);
  return j.profil as KompaniyaProfil;
}
export function useKompaniyaProfil(kompaniyaId: number | null | undefined) {
  return useQuery({
    queryKey: ['kompaniyaProfil', kompaniyaId],
    queryFn: () => kompaniyaProfilOl(kompaniyaId as number),
    enabled: !!kompaniyaId,
    staleTime: 15_000,
  });
}
export type ProfilYangilaInput = {
  kompaniya_id: number; expected_version: number;
  toliq_nom?: string; inn?: string; manzil?: string; rahbar?: string; telefon?: string;
  bank?: string; hisob_raqam?: string; mfo?: string; mavqe?: string; operation_id?: string;
};
export const kompaniyaProfilYangila = (i: ProfilYangilaInput) => post('profile_update', i);
export function useProfilYangila(kompaniyaId: number | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: kompaniyaProfilYangila,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kompaniyaProfil', kompaniyaId] });
      qc.invalidateQueries({ queryKey: ['men'] });
    },
  });
}

export type KompaniyaYaratInput = { nom: string; inn?: string; telefon?: string; operation_id?: string };
export type MemberAddInput = { kompaniya_id: number; login: string; rol: string; email?: string; ism?: string; operation_id?: string };
export type MemberRoleInput = { azolik_id: number; rol: string; operation_id?: string };
export type MemberRemoveInput = { azolik_id: number; operation_id?: string };
/** T2-AUTH-PASSWORD-MIGRATION-001: director bcrypt parol o'rnatadi/qayta
 *  belgilaydi. `member_add`ning o'zi parolga tegmaydi (o'sha RPC login+rolni
 *  yozadi, xolos) -- yangi a'zo bu chaqiruvsiz TIZIMGA KIRA OLMAYDI, chunki
 *  GAS'ning eski _XODIMLAR varag'ida ham yo'q. */
export type MemberPasswordSetInput = { kompaniya_id: number; foydalanuvchi_id: number; yangi_parol: string; operation_id?: string };

export const kompaniyaYarat = (i: KompaniyaYaratInput) => post('create', i);
export const azoQosh = (i: MemberAddInput) => post('member_add', i);
export const azoRol = (i: MemberRoleInput) => post('member_role', i);
export const azoOchir = (i: MemberRemoveInput) => post('member_remove', i);
export const azoParolBelgila = (i: MemberPasswordSetInput) => post('member_password_set', i);

export function useOnboardingCommands() {
  const qc = useQueryClient();
  const done = () => {
    qc.invalidateQueries({ queryKey: ['men'] });
    qc.invalidateQueries({ queryKey: ['kompaniyaAzolari'] });
  };
  return {
    yarat: useMutation({ mutationFn: kompaniyaYarat, onSuccess: done }),
    azoQosh: useMutation({ mutationFn: azoQosh, onSuccess: done }),
    azoRol: useMutation({ mutationFn: azoRol, onSuccess: done }),
    azoOchir: useMutation({ mutationFn: azoOchir, onSuccess: done }),
    /* Parol ro'yxat/holatga ta'sir qilmaydi -- invalidatsiya shart emas. */
    azoParolBelgila: useMutation({ mutationFn: azoParolBelgila }),
  };
}
