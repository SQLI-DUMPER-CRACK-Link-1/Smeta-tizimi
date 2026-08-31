import { FolderOpen, HardDrive, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../../umumiy/ui/Card';
import { StorageErrorPanel } from './StorageErrorPanel';
import { StorageStatusBadge } from './StorageStatusBadge';
import type { StorageMode, StorageStatus } from './types';

function formatVerified(value?: string | null) {
  if (!value) return 'Hali tasdiqlanmagan';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function StorageHealthCard({ provider = 'Google Drive', mode, folderName, status, lastVerifiedAt, error, errorCode, loading = false, onRetry, className = '' }: {
  provider?: string;
  mode?: StorageMode | string | null;
  folderName?: string | null;
  status: StorageStatus;
  lastVerifiedAt?: string | null;
  error?: string | null;
  errorCode?: string | null;
  loading?: boolean;
  onRetry?: () => void;
  className?: string;
}) {
  if (loading) return <Card className={className}><CardContent><div className="skel h-28 w-full" aria-label="Storage holati yuklanmoqda" /></CardContent></Card>;
  const modeLabel = mode === 'shared_drive' ? 'Shared Drive' : mode === 'my_drive' ? 'My Drive' : '—';
  return <Card className={className}><CardHeader title={<span className="flex items-center gap-2"><HardDrive size={18} className="text-accent" aria-hidden="true" />Storage holati</span>} action={<StorageStatusBadge status={status} />} />
    <CardContent className="space-y-4"><dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <div><dt className="text-text-dim">Provider</dt><dd className="mt-0.5 font-medium text-text">{provider}</dd></div>
      <div><dt className="text-text-dim">Rejim</dt><dd className="mt-0.5 font-medium text-text">{modeLabel}</dd></div>
      <div className="sm:col-span-2"><dt className="flex items-center gap-1.5 text-text-dim"><FolderOpen size={14} aria-hidden="true" />Papka / ildiz</dt><dd className="mt-0.5 break-all font-medium text-text">{folderName || 'Biriktirilmagan'}</dd></div>
      <div className="sm:col-span-2"><dt className="flex items-center gap-1.5 text-text-dim"><ShieldCheck size={14} aria-hidden="true" />Oxirgi tasdiq</dt><dd className="mt-0.5 text-text">{formatVerified(lastVerifiedAt)}</dd></div>
    </dl><StorageErrorPanel code={errorCode} message={error} onRetry={onRetry} /></CardContent>
  </Card>;
}
