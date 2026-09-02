import { Badge } from '../../umumiy/ui/Badge';
import type { ParticipantRole, ParticipantStatus } from './types';
const roleLabel: Record<ParticipantRole, string> = { zakazchik: 'Buyurtmachi', bosh_pudratchi: 'Bosh pudratchi', subpudratchi: 'Subpudratchi', loyihachi: 'Loyihachi', taminotchi: "Ta'minotchi" };
const roleTone: Record<ParticipantRole, 'bl' | 'rs' | 'mat' | 'ob' | 'default'> = { zakazchik: 'rs', bosh_pudratchi: 'bl', subpudratchi: 'mat', loyihachi: 'default', taminotchi: 'ob' };
const statusLabel: Record<ParticipantStatus, string> = { active: 'ACTIVE', pending: 'PENDING', suspended: 'SUSPENDED', removed: 'REMOVED' };
export function ParticipantRoleBadge({ role }: { role: ParticipantRole }) { return <Badge variant={roleTone[role]}>{roleLabel[role]}</Badge>; }
export function ParticipantStatusBadge({ status }: { status: ParticipantStatus }) { return <Badge variant={status === 'active' ? 'ok' : status === 'pending' ? 'warn' : status === 'suspended' || status === 'removed' ? 'danger' : 'default'}>{statusLabel[status]}</Badge>; }
