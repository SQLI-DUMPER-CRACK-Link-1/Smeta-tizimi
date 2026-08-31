export type StorageStatus = 'READY' | 'PENDING' | 'FAILED' | 'NOT_CONFIGURED' | 'VERIFYING';
export type DocumentUploadStatus = 'IDLE' | 'UPLOADING' | 'SUCCESS' | 'FAILED';
export type StorageMode = 'shared_drive' | 'my_drive';

export type StorageFormValue = {
  folderInput: string;
  mode: StorageMode;
};

export const STORAGE_STATUS_LABEL: Record<StorageStatus, string> = {
  READY: 'Tayyor',
  PENDING: 'Kutilmoqda',
  FAILED: 'Xato',
  NOT_CONFIGURED: 'Sozlanmagan',
  VERIFYING: 'Tekshirilmoqda',
};

export const STORAGE_ERROR_TEXT: Record<string, string> = {
  STORAGE_WORKSPACE_NOT_CONFIGURED: 'Kompaniya uchun storage workspace sozlanmagan.',
  STORAGE_ROOT_NOT_VERIFIED: 'Drive papkasi tasdiqlanmagan yoki yozish huquqi yo‘q.',
  OBJECT_STORAGE_NOT_PROVISIONED: 'Obyekt storage papkasi hali tayyor emas.',
  STORAGE_TENANT_MISMATCH: 'Storage boshqa kompaniya yoki loyiha doirasiga tegishli.',
  LEGACY_WORKSPACE_FORBIDDEN: 'Eski umumiy Drive workspace yangi T2 oqimida taqiqlangan.',
  STALE_VERSION: 'Ma’lumot yangilangan. Holatni yangilab qayta urinib ko‘ring.',
  OPERATION_ID_REQUIRED: 'Amal identifikatori talab qilinadi.',
  PROJECT_COMPANY_MISMATCH: 'Loyiha tanlangan kompaniyaga tegishli emas.',
};
