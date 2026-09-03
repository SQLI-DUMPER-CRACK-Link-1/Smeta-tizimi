/**
 * t2-authz.ts — Direct URL guard client (T2-COMPANY-CONTROL-CLOSEOUT).
 * Calls /api/company?authorize=1 -> t2_effective_authorization_v1, the SAME
 * server-side authorization core every canonical write command already uses.
 * This is what makes navigating straight to a protected /admin/* URL
 * actually re-check permission server-side, instead of only hiding the menu
 * item (Antigravity FINAL-AUDIT-002 P0 "Frontend Route Guards").
 */
import { useQuery } from '@tanstack/react-query';

export type AuthzPermission =
  | 'company.read' | 'company.profile.update' | 'company.member.manage'
  | 'control.company.read' | 'control.company.write' | 'control.global.read' | 'control.global.write'
  | 'project.read' | 'project.write' | 'object.read' | 'object.write'
  | 'document.read' | 'document.write' | 'financial.read' | 'financial.write';

export type AuthzResult = {
  ok: true; allowed: boolean; reason?: string;
  platform_role?: string; membership_role?: string | null;
  permissions?: string[]; company_id?: number | null;
};
export type AuthzError = Error & { code?: string };

export async function authorizeOl(
  permission: AuthzPermission,
  opts?: { kompaniyaId?: number | null; loyihaId?: number | null; obyektId?: number | null },
): Promise<AuthzResult> {
  const qs = new URLSearchParams({ authorize: '1', permission });
  if (opts?.kompaniyaId != null) qs.set('kompaniya_id', String(opts.kompaniyaId));
  if (opts?.loyihaId != null) qs.set('loyiha_id', String(opts.loyihaId));
  if (opts?.obyektId != null) qs.set('obyekt_id', String(opts.obyektId));
  const r = await fetch('/api/company?' + qs.toString());
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) {
    const e = new Error((j && j.code) || ('HTTP ' + r.status)) as AuthzError;
    e.code = (j && j.code) || ('HTTP_' + r.status);
    throw e;
  }
  return j as AuthzResult;
}

/** enabled=false while company context is still loading — never fire the
 *  check against an incomplete/undefined context. */
export function useAuthorize(
  permission: AuthzPermission,
  kompaniyaId: number | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['authz', permission, kompaniyaId ?? null],
    queryFn: () => authorizeOl(permission, { kompaniyaId }),
    enabled,
    staleTime: 15 * 1000,
    retry: (n, e: any) => e?.code !== 'AUTH_REQUIRED' && n < 2,
  });
}
