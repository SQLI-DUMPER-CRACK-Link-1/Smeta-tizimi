/**
 * Company Control effective authorization core.
 *
 * Bu modul UI ruxsatini emas, server bilan bir xil fail-closed qaror
 * semantikasini ifodalaydi. Cloudflare BFF yakuniy qarorni DBdagi
 * t2_effective_authorization_v1 orqali olishi shart.
 */
export const PERMISSIONS = [
  'company.read', 'company.profile.update', 'company.member.manage',
  'control.company.read', 'control.company.write',
  'control.global.read', 'control.global.write',
  'project.read', 'project.write', 'object.read', 'object.write',
  'document.read', 'document.write', 'financial.read', 'financial.write',
] as const;
export type PermissionCode = typeof PERMISSIONS[number];

export const MEMBERSHIP_ROLES = [
  'boss', 'rahbar', 'bugalter', 'pto', 'prorab',
  'buyurtmachi', 'pudratchi', 'kuzatuvchi',
] as const;
export type CompanyMembershipRole = typeof MEMBERSHIP_ROLES[number];
export type PlatformRole = 'platform_superadmin' | 'platform_operator' | 'none';
export type ScopeLevel = 'none' | 'read' | 'write' | 'manage';

export type AuthorizationReason =
  | 'ALLOW' | 'AUTH_REQUIRED' | 'UNKNOWN_ROLE' | 'COMPANY_MEMBERSHIP_REQUIRED'
  | 'PLATFORM_ROLE_REQUIRED' | 'CAPABILITY_DISABLED' | 'PROJECT_SCOPE_DENIED'
  | 'OBJECT_SCOPE_DENIED' | 'TARGET_SCOPE_INVALID';

export type AuthorizationContext = {
  actorId: number | null;
  companyId: number | null;
  projectId?: number | null;
  objectId?: number | null;
  permission: PermissionCode;
  capability?: string | null;
};

export type AuthorizationFacts = {
  platformRole: PlatformRole;
  /** Faqat DBdan olingan, joriy kompaniyadagi faol a'zolik roli. */
  membershipRole: string | null;
  /** Platform role uchun target kompaniyaga aniq berilgan context. */
  platformCompanyContext?: boolean;
  /** Resolver natijasi: capability bo'lmasa undefined, off bo'lsa false. */
  capabilities?: Record<string, boolean>;
  projectScope?: ScopeLevel;
  objectScope?: ScopeLevel;
  /** Server entity chainni tekshirganini ifodalaydi. */
  targetScopeValid?: boolean;
};

export type EffectiveAuthorization = {
  allowed: boolean;
  reason: AuthorizationReason;
  platformRole: PlatformRole;
  membershipRole: CompanyMembershipRole | null;
  effectiveCapabilities: Record<string, boolean>;
  permissions: PermissionCode[];
  companyId: number | null;
  projectId: number | null;
  objectId: number | null;
};

const ROLE_PERMISSIONS: Record<CompanyMembershipRole, PermissionCode[]> = {
  boss: [...PERMISSIONS.filter((p) => !p.startsWith('control.global'))],
  rahbar: ['company.read', 'control.company.read', 'project.read', 'object.read', 'document.read', 'financial.read'],
  bugalter: ['company.read', 'financial.read', 'financial.write', 'document.read'],
  pto: ['company.read', 'project.read', 'project.write', 'object.read', 'object.write', 'document.read', 'document.write', 'financial.read', 'financial.write'],
  prorab: ['company.read', 'project.read', 'project.write', 'object.read', 'object.write', 'document.read', 'document.write'],
  buyurtmachi: ['company.read', 'project.read', 'object.read', 'document.read', 'financial.read'],
  pudratchi: ['company.read', 'project.read', 'object.read', 'document.read'],
  kuzatuvchi: ['company.read', 'project.read', 'object.read', 'document.read'],
};

const PLATFORM_PERMISSIONS: Record<Exclude<PlatformRole, 'none'>, PermissionCode[]> = {
  platform_superadmin: [...PERMISSIONS],
  platform_operator: ['control.global.read'],
};

const LEVEL: Record<ScopeLevel, number> = { none: 0, read: 1, write: 2, manage: 3 };
const isMembershipRole = (role: string | null): role is CompanyMembershipRole =>
  role != null && (MEMBERSHIP_ROLES as readonly string[]).includes(role);
const scopeNeeded = (permission: PermissionCode) => permission.startsWith('project.') || permission.startsWith('object.');
const scopeLevelNeeded = (permission: PermissionCode): ScopeLevel => permission.endsWith('.write') ? 'write' : 'read';

function denied(ctx: AuthorizationContext, facts: AuthorizationFacts, reason: AuthorizationReason, membershipRole: CompanyMembershipRole | null = null): EffectiveAuthorization {
  return {
    allowed: false, reason, platformRole: facts.platformRole, membershipRole,
    effectiveCapabilities: facts.capabilities ?? {}, permissions: [],
    companyId: ctx.companyId, projectId: ctx.projectId ?? null, objectId: ctx.objectId ?? null,
  };
}

/** DB facts bilan bir xil strict semantika. Noma'lumlik ruxsatga teng emas. */
export function effectiveAuthorization(ctx: AuthorizationContext, facts: AuthorizationFacts): EffectiveAuthorization {
  if (!Number.isInteger(ctx.actorId) || (ctx.actorId ?? 0) <= 0) return denied(ctx, facts, 'AUTH_REQUIRED');
  if (facts.targetScopeValid === false) return denied(ctx, facts, 'TARGET_SCOPE_INVALID');

  const membership = facts.membershipRole;
  if (membership != null && !isMembershipRole(membership)) return denied(ctx, facts, 'UNKNOWN_ROLE');

  // Global request hech qachon company membership bilan ko'tarilmaydi.
  if (ctx.companyId == null) {
    if (facts.platformRole === 'none') return denied(ctx, facts, 'PLATFORM_ROLE_REQUIRED');
    const permissions = PLATFORM_PERMISSIONS[facts.platformRole];
    if (!permissions.includes(ctx.permission)) return denied(ctx, facts, 'PLATFORM_ROLE_REQUIRED');
    if (ctx.capability && facts.capabilities?.[ctx.capability] === false) return denied(ctx, facts, 'CAPABILITY_DISABLED');
    return { allowed: true, reason: 'ALLOW', platformRole: facts.platformRole, membershipRole: null,
      effectiveCapabilities: facts.capabilities ?? {}, permissions,
      companyId: null, projectId: ctx.projectId ?? null, objectId: ctx.objectId ?? null };
  }

  const platformInCompany = facts.platformRole === 'platform_superadmin' && facts.platformCompanyContext === true;
  if (!membership && !platformInCompany) return denied(ctx, facts, 'COMPANY_MEMBERSHIP_REQUIRED');
  const permissions = platformInCompany ? PLATFORM_PERMISSIONS.platform_superadmin : ROLE_PERMISSIONS[membership!];
  if (!permissions.includes(ctx.permission)) return denied(ctx, facts, 'COMPANY_MEMBERSHIP_REQUIRED', membership ?? null);
  if (ctx.capability && facts.capabilities?.[ctx.capability] === false) return denied(ctx, facts, 'CAPABILITY_DISABLED', membership ?? null);

  if (scopeNeeded(ctx.permission) && !platformInCompany) {
    if (ctx.projectId == null) return denied(ctx, facts, 'TARGET_SCOPE_INVALID', membership ?? null);
    const needed = LEVEL[scopeLevelNeeded(ctx.permission)];
    const projectAllowed = LEVEL[facts.projectScope ?? 'none'] >= needed;
    const objectAllowed = ctx.objectId != null && LEVEL[facts.objectScope ?? 'none'] >= needed;
    if (!projectAllowed && !objectAllowed) {
      return denied(ctx, facts, ctx.objectId == null ? 'PROJECT_SCOPE_DENIED' : 'OBJECT_SCOPE_DENIED', membership ?? null);
    }
  }

  return { allowed: true, reason: 'ALLOW', platformRole: facts.platformRole, membershipRole: membership ?? null,
    effectiveCapabilities: facts.capabilities ?? {}, permissions,
    companyId: ctx.companyId, projectId: ctx.projectId ?? null, objectId: ctx.objectId ?? null };
}

export type CompanyChoice = { kind: 'static' | 'selector' | 'onboarding' | 'global'; companyId: number | null };
export function companyChoice(companyIds: number[], savedCompanyId: number | null, platformRole: PlatformRole): CompanyChoice {
  const unique = [...new Set(companyIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (unique.length === 0) return platformRole === 'platform_superadmin' ? { kind: 'global', companyId: null } : { kind: 'onboarding', companyId: null };
  if (unique.length === 1) return { kind: 'static', companyId: unique[0] };
  return { kind: 'selector', companyId: unique.includes(savedCompanyId ?? -1) ? savedCompanyId : null };
}
