import { CheckCircle2, CircleAlert, CloudUpload, LoaderCircle } from 'lucide-react';
import type { DocumentUploadStatus } from './types';

const uploadConfig = {
  IDLE: { label: 'Yuklashga tayyor', tone: 'text-text-dim', Icon: CloudUpload },
  UPLOADING: { label: 'Yuklanmoqda', tone: 'text-accent', Icon: LoaderCircle },
  SUCCESS: { label: 'Yuklandi', tone: 'text-ok', Icon: CheckCircle2 },
  FAILED: { label: 'Yuklash amalga oshmadi', tone: 'text-danger', Icon: CircleAlert },
};

export function DocumentStorageStatus({ status, progress, message, className = '' }: { status: DocumentUploadStatus; progress?: number | null; message?: string | null; className?: string }) {
  const { label, tone, Icon } = uploadConfig[status];
  const normalizedProgress = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : null;
  return <div className={`rounded-lg border border-border bg-surface/70 p-3 ${className}`} role={status === 'FAILED' ? 'alert' : 'status'}>
    <div className={`flex items-center gap-2 text-sm font-medium ${tone}`}><Icon size={17} className={status === 'UPLOADING' ? 'animate-spin' : ''} aria-hidden="true" />{label}{normalizedProgress !== null && <span className="ml-auto tabular-nums text-xs text-text-dim">{normalizedProgress}%</span>}</div>
    {normalizedProgress !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${normalizedProgress}%` }} /></div>}
    {message && <p className={`mt-1.5 text-sm ${status === 'FAILED' ? 'text-danger' : 'text-text-dim'}`}>{message}</p>}
  </div>;
}
