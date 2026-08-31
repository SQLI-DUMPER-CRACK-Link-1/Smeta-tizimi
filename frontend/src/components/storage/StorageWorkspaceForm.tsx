import type { FormEvent } from 'react';
import { FolderInput, RefreshCw, SearchCheck } from 'lucide-react';
import type { StorageFormValue } from './types';

export function StorageWorkspaceForm({ value, onChange, onBind, onVerify, onRetry, loading = false, disabled = false, error, className = '' }: {
  value: StorageFormValue;
  onChange: (value: StorageFormValue) => void;
  onBind: (value: StorageFormValue) => void;
  onVerify?: (value: StorageFormValue) => void;
  onRetry?: () => void;
  loading?: boolean;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}) {
  const unavailable = disabled || loading;
  const submit = (event: FormEvent) => { event.preventDefault(); onBind(value); };
  return <form onSubmit={submit} className={`karta p-4 sm:p-5 ${className}`} aria-busy={loading}>
    <div className="mb-4"><h3 className="text-base font-semibold text-text">Storage workspace</h3><p className="mt-1 text-sm text-text-dim">Drive folder URL yoki ID sini kiriting. Biriktirishni tashqi integratsiya bajaradi.</p></div>
    <div className="grid gap-4 sm:grid-cols-[1fr_11rem]"><label className="block text-sm font-medium text-text">Drive folder URL / ID<input aria-label="Drive folder URL yoki ID" value={value.folderInput} onChange={(event) => onChange({ ...value, folderInput: event.target.value })} disabled={unavailable} placeholder="https://drive.google.com/drive/folders/..." className="input mt-1.5 w-full px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50" /></label>
      <label className="block text-sm font-medium text-text">Rejim<select aria-label="Storage rejimi" value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value as StorageFormValue['mode'] })} disabled={unavailable} className="input mt-1.5 w-full px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><option value="my_drive">My Drive</option><option value="shared_drive">Shared Drive</option></select></label></div>
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={unavailable || !value.folderInput.trim()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"><FolderInput size={16} aria-hidden="true" />{loading ? 'Biriktirilmoqda…' : 'Biriktirish'}</button>
      {onVerify && <button type="button" onClick={() => onVerify(value)} disabled={unavailable || !value.folderInput.trim()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-sm font-medium text-text hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"><SearchCheck size={16} aria-hidden="true" />Tekshirish</button>}
      {onRetry && <button type="button" onClick={onRetry} disabled={unavailable} className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-text-dim hover:bg-white/5 hover:text-text disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Qayta urinish</button>}
    </div>
  </form>;
}
