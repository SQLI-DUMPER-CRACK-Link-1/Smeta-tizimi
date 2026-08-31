import { CheckCircle2, Clock3, CircleDashed, CircleX, SearchCheck } from 'lucide-react';
import { Badge } from '../../umumiy/ui/Badge';
import { STORAGE_STATUS_LABEL, type StorageStatus } from './types';

const config = {
  READY: { variant: 'ok' as const, Icon: CheckCircle2 },
  PENDING: { variant: 'warn' as const, Icon: Clock3 },
  FAILED: { variant: 'danger' as const, Icon: CircleX },
  NOT_CONFIGURED: { variant: 'default' as const, Icon: CircleDashed },
  VERIFYING: { variant: 'warn' as const, Icon: SearchCheck },
};

export function StorageStatusBadge({ status, className = '' }: { status: StorageStatus; className?: string }) {
  const { variant, Icon } = config[status];
  return <Badge variant={variant} className={`gap-1.5 ${className}`}><Icon size={13} aria-hidden="true" />{STORAGE_STATUS_LABEL[status]}</Badge>;
}
