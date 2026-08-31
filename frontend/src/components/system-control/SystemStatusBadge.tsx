import { AlertTriangle, CheckCircle2, CircleOff, CircleX, Settings2 } from 'lucide-react';
import { Badge } from '../../umumiy/ui/Badge';
import type { CapabilityState, IncidentSeverity, JobStatus, SystemStatus } from './types';

type BadgeStatus = SystemStatus | CapabilityState | JobStatus | IncidentSeverity;
const label: Record<BadgeStatus, string> = {
  healthy: 'SOG‘LOM', warning: 'OGOHLANTIRISH', failed: 'XATO', disabled: 'O‘CHIRILGAN',
  configured: 'SOZLANGAN', not_configured: 'SOZLANMAGAN', on: 'ON', off: 'OFF', paused: 'PAUZA',
  read_only: 'FAQAT O‘QISH', queued: 'NAVBATDA', running: 'ISHLAMOQDA', success: 'MUVAFFAQIYAT',
  cancelled: 'BEKOR QILINGAN', info: 'MA’LUMOT', error: 'XATO', critical: 'KRITIK',
};
function tone(status: BadgeStatus) {
  if (['healthy', 'configured', 'on', 'success'].includes(status)) return 'ok' as const;
  if (['warning', 'paused', 'queued', 'running'].includes(status)) return 'warn' as const;
  if (['failed', 'off', 'disabled', 'cancelled', 'error', 'critical'].includes(status)) return 'danger' as const;
  return 'default' as const;
}
function Icon({ status }: { status: BadgeStatus }) {
  if (['healthy', 'configured', 'on', 'success'].includes(status)) return <CheckCircle2 size={13} />;
  if (['warning', 'paused', 'queued', 'running'].includes(status)) return <AlertTriangle size={13} />;
  if (['failed', 'off', 'disabled', 'cancelled', 'error', 'critical'].includes(status)) return <CircleX size={13} />;
  if (status === 'read_only') return <CircleOff size={13} />;
  return <Settings2 size={13} />;
}
export function SystemStatusBadge({ status, className = '' }: { status: BadgeStatus; className?: string }) {
  return <Badge variant={tone(status)} className={`gap-1.5 whitespace-nowrap ${className}`}><Icon status={status} />{label[status]}</Badge>;
}
