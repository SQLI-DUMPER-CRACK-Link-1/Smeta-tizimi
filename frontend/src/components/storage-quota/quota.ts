import type { StorageQuotaStatus, UploadQuotaDecision } from './types';
export const usagePercent = (used: number, reserved: number, quota: number) => quota > 0 ? ((used + reserved) / quota) * 100 : 100;
export const quotaStatus = (percent: number): StorageQuotaStatus => percent >= 100 ? 'HARD_LIMIT' : percent >= 90 ? 'CRITICAL' : percent >= 80 ? 'WARNING' : 'NORMAL';
export const availableBytes = (quota: number, used: number, reserved: number) => Math.max(0, quota - used - reserved);
export function uploadDecision(quota: number, used: number, reserved: number, incoming: number, subscription: 'ACTIVE'|'EXPIRED'|'SUSPENDED'): UploadQuotaDecision { if (subscription !== 'ACTIVE') return 'BLOCKED_SUBSCRIPTION'; const next = usagePercent(used + incoming, reserved, quota); return next > 100 ? 'BLOCKED_QUOTA' : next >= 80 ? 'WARNING' : 'ALLOWED'; }
export const formatBytes = (bytes: number) => { if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`; return `${(bytes / 1024 ** 3).toFixed(1)} GB`; };
