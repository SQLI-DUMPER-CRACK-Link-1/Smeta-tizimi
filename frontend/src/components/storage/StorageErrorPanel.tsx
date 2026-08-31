import { AlertTriangle, RefreshCw } from 'lucide-react';
import { STORAGE_ERROR_TEXT } from './types';

export function StorageErrorPanel({ code, message, onRetry, retrying = false, className = '' }: {
  code?: string | null;
  message?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  if (!code && !message) return null;
  const text = message || (code ? STORAGE_ERROR_TEXT[code] : '') || 'Storage amalida xatolik yuz berdi.';
  return (
    <div role="alert" className={`rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm ${className}`}>
      <div className="flex gap-2.5"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="font-medium text-danger">Storage xatosi</p><p className="mt-0.5 text-text-dim">{text}</p>
          {code && <p className="mt-1.5 font-mono text-xs text-danger/90">{code}</p>}
        </div>
        {onRetry && <button type="button" onClick={onRetry} disabled={retrying} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-danger/30 px-2.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={13} className={retrying ? 'animate-spin' : ''} aria-hidden="true" />Qayta urinish</button>}
      </div>
    </div>
  );
}
