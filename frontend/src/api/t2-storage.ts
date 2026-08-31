/**
 * t2-storage.ts — TIZIM_02 KO'P-KOMPANIYALI STORAGE (STOR-001) frontend kontrakti
 * ═══════════════════════════════════════════════════════════════════════════════
 * EGALIK: Claude (arxitektura / integratsiya lane STOR-001B).
 *
 * Yagona haqiqat manbai — Postgres (t2_company_storage_workspace,
 * t2_project_storage_binding, t2_object_storage_binding, t2_document_registry).
 * Google Drive — tashqi proyeksiya. Bu modul GAS ko'prigi orqali kanonik
 * buyruq RPC'larini chaqiradi; nomlar bilan hech narsa qidirilmaydi.
 *
 * Kontrakt: docs/architecture/STORAGE_FOUNDATION_CONTRACT_V1.md
 *
 * ⚠️ DEMO REJIM: agar `?demo=1` bo'lsa yoki VITE_STORAGE_DEMO=1 bo'lsa,
 * ekran kontrakt shaklidagi fiksturalar bilan ishlaydi (backend hali
 * productionga qo'llanmagan — Product Owner to'liq oqimni ko'rsin).
 * Fikstura javoblar ochiq belgilanadi; komponent bir xil, faqat transport
 * boshqa. Migratsiya qo'llangach `?demo=0` bilan jonli ishlaydi.
 */
import { gas } from './client';
import { yangiOperationId } from './supabase';

/* ─────────────────────────── TURLAR ─────────────────────────── */

export type StorageProvider = 'google_drive';
export type StorageMode = 'my_drive' | 'shared_drive';
export type WorkspaceStatus = 'not_configured' | 'pending' | 'verified' | 'failed' | 'legacy' | 'revoked';
export type ProvisioningStatus = 'not_configured' | 'pending' | 'verified' | 'failed';
export type ObjectStorageStatus = 'pending' | 'ready' | 'failed' | 'not_provisioned';

export type CompanyStorage = {
  workspace_id: number | null;
  kompaniya_id: number;
  provider: StorageProvider | null;
  mode: StorageMode | null;
  root_folder_id: string | null;
  root_folder_name: string | null;
  status: WorkspaceStatus;
  legacy: boolean;
  versiya: number;
  verified_at: string | null;
};

export type ProjectStorage = {
  loyiha_id: number;
  loyiha_nom: string;
  workspace_id: number | null;
  project_root_folder_id: string | null;
  provisioning_status: ProvisioningStatus;
  storage_error: string | null;
  versiya: number;
};

export type ObjectStorage = {
  obyekt_id: number;
  obyekt_nom: string;
  loyiha_id: number | null;
  folder_id: string | null;
  parent_folder_id: string | null;
  storage_status: ObjectStorageStatus;
  storage_error: string | null;
  versiya: number;
};

export type StorageNatija<T> =
  | { ok: true; data: T; retry?: boolean }
  | { ok: false; code: string; xabar?: string; version?: number };

/* ───────────────── XATO KOD → INSON O'QIYDIGAN MATN ───────────────── */

export const STORAGE_XATO_MATN: Record<string, string> = {
  STORAGE_WORKSPACE_NOT_CONFIGURED: 'Kompaniya uchun fayl saqlash joyi (Google Drive) hali sozlanmagan.',
  STORAGE_ROOT_NOT_VERIFIED: 'Google Drive papkasi hali tasdiqlanmagan — «Tasdiqlash» tugmasini bosing.',
  STORAGE_ROOT_INVALID: 'Google Drive papka havolasi yoki ID yaroqsiz.',
  STORAGE_ROOT_NOT_WRITABLE: 'Ushbu Google Drive papkasiga yozish huquqi yo‘q.',
  STORAGE_MODE_MISMATCH: 'Tanlangan rejim (Mening Drive / Umumiy Drive) papka bilan mos emas.',
  STORAGE_PERMISSION_DENIED: 'Ushbu papkaga kirish yoki yozish huquqi yo‘q.',
  PROJECT_STORAGE_NOT_BOUND: 'Loyiha uchun saqlash papkasi hali biriktirilmagan.',
  PROJECT_COMPANY_MISMATCH: 'Loyiha ushbu kompaniyaga tegishli emas.',
  OBJECT_STORAGE_NOT_PROVISIONED: 'Obyekt papkasi hali tayyor emas.',
  STORAGE_TENANT_MISMATCH: 'Saqlash zanjiri (kompaniya → loyiha → obyekt) mos kelmadi.',
  LEGACY_WORKSPACE_FORBIDDEN: 'Bu kompaniya uchun eski (TIZIM_01) papkadan foydalanishga ruxsat yo‘q.',
  STALE_VERSION: 'Ma’lumot boshqa joyda yangilangan — sahifani yangilab, qайта urinib ko‘ring.',
  OPERATION_ID_REQUIRED: 'Ichki xato: amal identifikatori yuborilmadi.',
  PROJECT_CONTEXT_REQUIRED: 'Kompaniya, loyiha va obyekt tanlanishi shart.',
  DOCUMENT_CONTEXT_REQUIRED: 'Hujjat yuklash uchun kompaniya, loyiha va obyekt tanlang.',
  DOCUMENT_STORAGE_AMBIGUOUS: 'Bu operatsiya uchun bir nechta fayl topildi — administratorga murojaat qiling.',
  DOCUMENT_REGISTRY_FAILED: 'Hujjat saqlandi, ammo reyestrga yozilmadi — qайта urinib ko‘ring.',
  DOCUMENT_IDEMPOTENCY_CONFLICT: 'Ushbu yuklash allaqachon boshqa hujjat bilan bajarilgan.',
  OBJECT_CREATE_FAILED: 'Obyekt yaratilmadi.',
  PROJECT_STORAGE_PROVISION_FAILED: 'Loyiha papkasini tayyorlab bo‘lmadi.',
};

export function storageXatoMatn(code: string | undefined | null, zaxira?: string): string {
  if (code && STORAGE_XATO_MATN[code]) return STORAGE_XATO_MATN[code];
  if (zaxira && zaxira.trim()) return zaxira.trim();
  return code ? 'Kutilmagan xato: ' + code : 'Kutilmagan xato.';
}

/** DB holat qiymatlari → Codex ko'rinish enum (StorageStatusBadge / StorageHealthCard). */
export type UiStorageStatus = 'READY' | 'PENDING' | 'FAILED' | 'NOT_CONFIGURED' | 'VERIFYING';
export function toUiStatus(
  s: WorkspaceStatus | ProvisioningStatus | ObjectStorageStatus | null | undefined,
): UiStorageStatus {
  switch (s) {
    case 'verified':
    case 'ready':
    case 'legacy':
      return 'READY';
    case 'pending':
      return 'PENDING';
    case 'failed':
    case 'revoked':
      return 'FAILED';
    default:
      return 'NOT_CONFIGURED';
  }
}

/* ─────────────────────────── DEMO REJIM ─────────────────────────── */

export function demoRejimmi(): boolean {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.get('demo') === '1') return true;
    if (u.searchParams.get('demo') === '0') return false;
  } catch { /* SSR/test */ }
  return (import.meta as any)?.env?.VITE_STORAGE_DEMO === '1';
}

/* Demo holati — Product Owner to'liq oqimni ko'rishi uchun. Har bir "kompaniya
 * senariysi" ID orqali tanlanadi (demo sensor: kompaniya_id % 5). */
function demoCompany(kompaniyaId: number): CompanyStorage {
  const senariy = kompaniyaId % 5;
  const base = { workspace_id: 900 + kompaniyaId, kompaniya_id: kompaniyaId, provider: 'google_drive' as const,
    mode: 'shared_drive' as const, versiya: 3, verified_at: '2026-08-30T10:00:00Z', legacy: false,
    status: 'verified' as WorkspaceStatus,
    root_folder_id: '1AbCdEfGhIjKlMnOpQrStUvWxYz012345', root_folder_name: 'ACME QURILISH — Fayllar' };
  if (senariy === 0) return { ...base, workspace_id: null, provider: null, mode: null, root_folder_id: null, root_folder_name: null, status: 'not_configured', legacy: false, versiya: 0, verified_at: null };
  if (senariy === 1) return { ...base, status: 'pending', versiya: 1, verified_at: null };
  if (senariy === 2) return { ...base, status: 'failed', versiya: 2, verified_at: null };
  if (senariy === 3) return { ...base, status: 'legacy', legacy: true, root_folder_name: 'TIZIM_01 ildizi (legacy)' };
  return { ...base, status: 'verified', legacy: false };
}
function demoProjects(kompaniyaId: number): ProjectStorage[] {
  const st = kompaniyaId % 5;
  const rows: ProjectStorage[] = [
    { loyiha_id: 1, loyiha_nom: 'Amfiteatr — 32 ga park', workspace_id: 900 + kompaniyaId, project_root_folder_id: '1proj_amfiteatr_folder_00000000', provisioning_status: 'verified', storage_error: null, versiya: 2 },
    { loyiha_id: 2, loyiha_nom: 'Ma’muriy bino rekonstruksiya', workspace_id: 900 + kompaniyaId, project_root_folder_id: null, provisioning_status: 'pending', storage_error: null, versiya: 1 },
    { loyiha_id: 3, loyiha_nom: 'Yo‘l infratuzilmasi 2-navbat', workspace_id: 900 + kompaniyaId, project_root_folder_id: null, provisioning_status: 'failed', storage_error: 'Drive papkasi yaratildi, ammo yozish huquqi tekshiruvi o‘tmadi', versiya: 1 },
  ];
  if (st === 0) return rows.map((r) => ({ ...r, provisioning_status: 'not_configured', project_root_folder_id: null }));
  return rows;
}
function demoObjects(loyihaId: number): ObjectStorage[] {
  const rows: ObjectStorage[] = [
    { obyekt_id: 11, obyekt_nom: 'Sahna bloki A', loyiha_id: loyihaId, folder_id: '1obj_sahna_a_000000000000', parent_folder_id: '1proj_amfiteatr_folder_00000000', storage_status: 'ready', storage_error: null, versiya: 4 },
    { obyekt_id: 12, obyekt_nom: 'Tomoshabin zonasi', loyiha_id: loyihaId, folder_id: null, parent_folder_id: null, storage_status: 'pending', storage_error: null, versiya: 1 },
    { obyekt_id: 13, obyekt_nom: 'Muhandislik tarmoqlari', loyiha_id: loyihaId, folder_id: null, parent_folder_id: null, storage_status: 'failed', storage_error: 'Drive kvotasi tugagan', versiya: 2 },
  ];
  return loyihaId === 1 ? rows : rows.map((r) => ({ ...r, storage_status: 'not_provisioned', folder_id: null }));
}

/* ─────────────────────────── O'QISH ─────────────────────────── */

export async function companyStorageOl(kompaniyaId: number): Promise<StorageNatija<CompanyStorage>> {
  if (demoRejimmi()) return { ok: true, data: demoCompany(kompaniyaId) };
  return chaqir<CompanyStorage>('apiT2CompanyStorageHolat', { companyId: kompaniyaId });
}

export async function projectStorageRoyxat(kompaniyaId: number): Promise<StorageNatija<ProjectStorage[]>> {
  if (demoRejimmi()) return { ok: true, data: demoProjects(kompaniyaId) };
  return chaqir<ProjectStorage[]>('apiT2ProjectStorageRoyxat', { companyId: kompaniyaId });
}

export async function objectStorageRoyxat(kompaniyaId: number, loyihaId: number): Promise<StorageNatija<ObjectStorage[]>> {
  if (demoRejimmi()) return { ok: true, data: demoObjects(loyihaId) };
  return chaqir<ObjectStorage[]>('apiT2ObjectStorageRoyxat', { companyId: kompaniyaId, projectId: loyihaId });
}

/* ─────────────────────────── BUYRUQLAR ─────────────────────────── */

export async function companyStorageBind(p: {
  kompaniyaId: number; folderUrl: string; mode: StorageMode;
  expectedVersion: number; legacy?: boolean;
}): Promise<StorageNatija<CompanyStorage>> {
  if (demoRejimmi()) {
    await pauza();
    return { ok: true, data: { ...demoCompany(p.kompaniyaId), status: 'verified', legacy: !!p.legacy, mode: p.mode, versiya: p.expectedVersion + 1 } };
  }
  const w = await chaqir<CompanyStorage>('apiT2CompanyStorageBind', {
    companyId: p.kompaniyaId, rootUrl: p.folderUrl, mode: p.mode,
    operationId: yangiOperationId(), expectedVersion: p.expectedVersion, legacy: !!p.legacy,
  });
  if (!w.ok) return w;
  // the write returns a partial shape; re-read the canonical row
  return companyStorageOl(p.kompaniyaId);
}

export async function projectStorageProvision(p: {
  kompaniyaId: number; loyihaId: number; expectedVersion: number;
}): Promise<StorageNatija<ProjectStorage>> {
  if (demoRejimmi()) {
    await pauza();
    return { ok: true, data: { loyiha_id: p.loyihaId, loyiha_nom: '—', workspace_id: 900 + p.kompaniyaId,
      project_root_folder_id: '1proj_' + p.loyihaId + '_provisioned_000', provisioning_status: 'verified', storage_error: null, versiya: p.expectedVersion + 1 } };
  }
  return chaqir<ProjectStorage>('apiT2LoyihaStorageProvision', {
    companyId: p.kompaniyaId, projectId: p.loyihaId,
    operationId: yangiOperationId(), expectedVersion: p.expectedVersion,
  });
}

export async function objectStorageRetry(p: {
  kompaniyaId: number; loyihaId: number; obyektId: number; obyektNom: string; expectedVersion: number;
}): Promise<StorageNatija<ObjectStorage>> {
  if (demoRejimmi()) {
    await pauza();
    return { ok: true, data: { obyekt_id: p.obyektId, obyekt_nom: p.obyektNom, loyiha_id: p.loyihaId,
      folder_id: '1obj_' + p.obyektId + '_ready_0000', parent_folder_id: '1proj_' + p.loyihaId + '_root', storage_status: 'ready', storage_error: null, versiya: p.expectedVersion + 1 } };
  }
  return chaqir<ObjectStorage>('apiT2YangiObyektYarat', {
    companyId: p.kompaniyaId, projectId: p.loyihaId, name: p.obyektNom,
    operationId: yangiOperationId(), expectedVersion: p.expectedVersion,
  });
}

export type UploadNatija = { ok: true; document_id: number; external_file_id: string; status: string }
  | { ok: false; code: string; xabar?: string };

export async function documentUpload(p: {
  kompaniyaId: number; loyihaId: number; obyektId: number;
  file: File; documentType: string; revision?: string;
}): Promise<UploadNatija> {
  if (demoRejimmi()) {
    await pauza(900);
    if (/xato|fail|err/i.test(p.file.name)) return { ok: false, code: 'STORAGE_PERMISSION_DENIED' };
    return { ok: true, document_id: Math.floor(Math.random() * 9000) + 1000, external_file_id: '1file_' + Date.now().toString(36), status: 'active' };
  }
  const b64 = await fileB64(p.file);
  const r = await gas<any>('apiT2DocumentUpload', {
    companyId: p.kompaniyaId, projectId: p.loyihaId, objectId: p.obyektId,
    base64: b64, fileName: p.file.name, mimeType: p.file.type || 'application/octet-stream',
    documentType: p.documentType, revision: p.revision ?? null,
    operationId: yangiOperationId(), createdBy: 't2-web',
  });
  if (r && r.ok) return { ok: true, document_id: r.document_id, external_file_id: r.external_file_id, status: r.status };
  return { ok: false, code: (r && r.code) || 'DOCUMENT_UPLOAD_FAILED', xabar: r && (r.xabar || r.error) };
}

/* ─────────────────────────── ICHKI ─────────────────────────── */

async function chaqir<T>(fn: string, args: Record<string, unknown>): Promise<StorageNatija<T>> {
  try {
    const r = await gas<any>(fn, args);
    if (r && r.ok) {
      const data = r.data ?? omit(r, ['ok', 'code', 'xabar', 'retry']);
      return { ok: true, data: data as T, retry: !!r.retry };
    }
    return { ok: false, code: (r && r.code) || 'STORAGE_ERROR', xabar: r && (r.xabar || r.error), version: r && r.version };
  } catch (e: any) {
    return { ok: false, code: 'NETWORK', xabar: e?.message || String(e) };
  }
}

function omit(o: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o)) if (!keys.includes(k)) out[k] = o[k];
  return out;
}

function pauza(ms = 600) { return new Promise((res) => setTimeout(res, ms)); }

function fileB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
    fr.onerror = () => reject(new Error('Fayl o‘qilmadi'));
    fr.readAsDataURL(file);
  });
}
