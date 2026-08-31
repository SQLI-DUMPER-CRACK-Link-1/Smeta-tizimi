export type StorageQuotaStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'HARD_LIMIT';
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
export interface StoragePlan { code: string; label: string; quotaBytes: number | null; }
export interface StorageUsage { quotaBytes: number; usedBytes: number; reservedBytes: number; availableBytes: number; usagePercent: number; }
export interface StorageBreakdown { activeBytes: number; versionBytes: number; trashBytes: number; }
export interface StorageRetentionPolicy { maxRevisions: number | null; revisionRetentionDays: number | null; trashRetentionDays: number | null; archivePolicy?: string; }
export interface CompanyStorageQuota { companyId: string; plan: StoragePlan; usage: StorageUsage; breakdown: StorageBreakdown; retention: StorageRetentionPolicy; subscriptionStatus: SubscriptionStatus; r2Healthy: boolean; }
export type UploadQuotaDecision = 'ALLOWED' | 'WARNING' | 'BLOCKED_QUOTA' | 'BLOCKED_SUBSCRIPTION';
