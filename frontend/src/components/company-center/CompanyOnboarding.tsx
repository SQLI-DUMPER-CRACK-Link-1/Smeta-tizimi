import React, { useState } from 'react';
import type { CompanyCenterProps, MembershipRole } from './types';
export function CreateCompanyForm({ onCreate }: { onCreate?: (input: { name: string }) => void }) { const [name, setName] = useState(''); return <form onSubmit={event => { event.preventDefault(); onCreate?.({ name }); }}><input aria-label="Company name" value={name} onChange={event => setName(event.target.value)} /><button>Create company</button></form>; }
export function JoinCompanyState({ status }: { status: 'PENDING' | 'SUSPENDED' | 'NO_PERMISSION' }) { return <div role="status">{status}</div>; }
export function CompanyProfileCard({ company }: { company: CompanyCenterProps['company'] }) { return <article>{company.name} · {company.companyId}</article>; }
export function DirectorOwnerCard({ actorId, role }: { actorId: string; role: MembershipRole }) { return <article>{actorId} · {role}</article>; }
export function CompanySettingsForm({ companyId, onSave }: { companyId: string; onSave?: (id: string) => void }) { return <button onClick={() => onSave?.(companyId)}>Save company settings</button>; }
export const MembershipRoleBadge = ({ role }: { role: MembershipRole }) => <span>{role}</span>;
export const InvitationStatusCard = ({ invitationId, status }: { invitationId: string; status: string }) => <div>{invitationId} · {status}</div>;
export const CompanyPermissionSummary = ({ companyId, permission }: { companyId: string; permission: string }) => <div>{companyId}: {permission}</div>;
export const CompanyUsageSummary = ({ companyId, members, projects }: { companyId: string; members: number; projects: number }) => <div>{companyId} · {members} · {projects}</div>;
