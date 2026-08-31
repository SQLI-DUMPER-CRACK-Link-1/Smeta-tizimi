import { Pause, Play, Power, RotateCw, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import type { CapabilityScope, CapabilityState, SystemCapability, SystemJob } from './types';

const scopes: Array<{ value: CapabilityScope; label: string }> = [{ value: 'global', label: 'GLOBAL' }, { value: 'company', label: 'COMPANY' }, { value: 'project', label: 'PROJECT' }];
const states: Array<{ value: CapabilityState; label: string }> = [{ value: 'on', label: 'ON' }, { value: 'off', label: 'OFF' }, { value: 'paused', label: 'PAUSED' }, { value: 'read_only', label: 'READ ONLY' }];

export function ScopeSelector({ value, onChange, disabled = false }: { value: CapabilityScope; onChange?: (value: CapabilityScope) => void; disabled?: boolean }) {
  return <select aria-label="Capability scope" value={value} disabled={disabled} onChange={(e) => onChange?.(e.target.value as CapabilityScope)} className="input px-2 py-1 text-xs disabled:opacity-50">{scopes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
}
export function CapabilityToggle({ value, onToggle, disabled = false }: { value: CapabilityState; onToggle?: (value: CapabilityState) => void; disabled?: boolean }) {
  return <select aria-label="Capability state" value={value} disabled={disabled} onChange={(e) => onToggle?.(e.target.value as CapabilityState)} className="input px-2 py-1 text-xs font-medium disabled:opacity-50">{states.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>;
}
export function RetryButton({ onRetry, disabled = false, label = 'Qayta urinish' }: { onRetry?: () => void; disabled?: boolean; label?: string }) {
  return <button type="button" disabled={disabled} onClick={onRetry} className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-text-dim hover:bg-surface-2 disabled:opacity-40"><RotateCw size={13} />{label}</button>;
}
export function PauseResumeButton({ job, onPause, onResume }: { job: SystemJob; onPause?: () => void; onResume?: () => void }) {
  const paused = job.status === 'paused';
  return <button type="button" onClick={paused ? onResume : onPause} className="inline-flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 text-xs text-text-dim hover:bg-surface-2">{paused ? <Play size={13} /> : <Pause size={13} />}{paused ? 'Davom ettirish' : 'Pauza'}</button>;
}
export function KillSwitchButton({ capability, onConfirm }: { capability: SystemCapability; onConfirm?: (capability: SystemCapability) => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) return <span className="inline-flex items-center gap-1.5 rounded border border-danger/50 bg-danger/10 p-1 text-xs"><ShieldAlert size={14} className="text-danger" /><span className="hidden xl:inline text-danger">Global o‘chirish?</span><button type="button" onClick={() => { onConfirm?.(capability); setConfirming(false); }} className="rounded bg-danger px-2 py-1 font-semibold text-white">Tasdiqlash</button><button type="button" aria-label="Bekor qilish" onClick={() => setConfirming(false)} className="p-1 text-text-dim"><X size={14} /></button></span>;
  return <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 rounded border border-danger/40 px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10"><Power size={13} />Kill</button>;
}
