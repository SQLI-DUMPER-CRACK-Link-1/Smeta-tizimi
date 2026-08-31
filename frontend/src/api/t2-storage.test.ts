/// <reference types="node" />
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const transport = vi.hoisted(() => ({
  gas: vi.fn(),
  yangiOperationId: vi.fn(() => '11111111-1111-4111-8111-111111111111'),
}));

vi.mock('./client', () => ({ gas: transport.gas }));
vi.mock('./supabase', () => ({ yangiOperationId: transport.yangiOperationId }));

import {
  STORAGE_XATO_MATN,
  companyStorageBind,
  companyStorageOl,
  documentUpload,
  objectStorageRetry,
  projectStorageProvision,
  storageXatoMatn,
} from './t2-storage';

const live = () => window.history.replaceState({}, '', '/admin/test/saqlash?demo=0');

describe('storage transport contract', () => {
  beforeEach(() => {
    transport.gas.mockReset();
    transport.yangiOperationId.mockClear();
    live();
  });

  it('maps every stable backend error code to human-readable UI text', () => {
    for (const [code, text] of Object.entries(STORAGE_XATO_MATN)) {
      expect(storageXatoMatn(code)).toBe(text);
      expect(storageXatoMatn(code)).not.toContain(code);
    }
    expect(storageXatoMatn('UNKNOWN_CODE', 'Server aniq xabari')).toBe('Server aniq xabari');
    expect(storageXatoMatn('UNKNOWN_CODE')).toBe('Kutilmagan xato: UNKNOWN_CODE');
  });

  it('uses demo fixtures only with demo=1 and sends reads to GAS with demo=0', async () => {
    window.history.replaceState({}, '', '/admin/test/saqlash?demo=1');
    const demo = await companyStorageOl(4);
    expect(demo.ok).toBe(true);
    expect(transport.gas).not.toHaveBeenCalled();

    live();
    transport.gas.mockResolvedValue({ ok: true, data: { kompaniya_id: 4 } });
    await companyStorageOl(4);
    expect(transport.gas).toHaveBeenCalledWith('apiT2CompanyStorageHolat', { companyId: 4 });
  });

  it('sends a fresh operation_id and expectedVersion for every versioned storage command', async () => {
    transport.gas.mockResolvedValue({ ok: true, data: {} });

    await companyStorageBind({ kompaniyaId: 7, folderUrl: 'https://drive.google.com/folder/abc', mode: 'shared_drive', expectedVersion: 3 });
    expect(transport.gas).toHaveBeenCalledWith('apiT2CompanyStorageBind', expect.objectContaining({
      companyId: 7, expectedVersion: 3, operationId: '11111111-1111-4111-8111-111111111111',
    }));

    await projectStorageProvision({ kompaniyaId: 7, loyihaId: 9, expectedVersion: 4 });
    expect(transport.gas).toHaveBeenCalledWith('apiT2LoyihaStorageProvision', expect.objectContaining({
      companyId: 7, projectId: 9, expectedVersion: 4, operationId: '11111111-1111-4111-8111-111111111111',
    }));

    await objectStorageRetry({ kompaniyaId: 7, loyihaId: 9, obyektId: 11, obyektNom: 'Blok A', expectedVersion: 5 });
    expect(transport.gas).toHaveBeenCalledWith('apiT2YangiObyektYarat', expect.objectContaining({
      companyId: 7, projectId: 9, expectedVersion: 5, operationId: '11111111-1111-4111-8111-111111111111',
    }));
  });

  it('sends operation_id for document upload mutations too', async () => {
    transport.gas.mockResolvedValue({ ok: true, document_id: 12, external_file_id: 'file-12', status: 'active' });
    const NativeFileReader = globalThis.FileReader;
    class TestFileReader {
      result = 'data:text/plain;base64,QQ==';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL() { this.onload?.(); }
    }
    globalThis.FileReader = TestFileReader as unknown as typeof FileReader;
    try {
      await documentUpload({ kompaniyaId: 7, loyihaId: 9, obyektId: 11, file: new File(['A'], 'hujjat.pdf', { type: 'application/pdf' }), documentType: 'hujjat' });
    } finally {
      globalThis.FileReader = NativeFileReader;
    }
    expect(transport.gas).toHaveBeenCalledWith('apiT2DocumentUpload', expect.objectContaining({
      companyId: 7, projectId: 9, objectId: 11, operationId: '11111111-1111-4111-8111-111111111111',
    }));
  });

  it('has no executable global ROOT or TIZIM_01 fallback in the storage frontend', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/api/t2-storage.ts'), 'utf8');
    expect(source).not.toMatch(/DriveApp\.(?:getRootFolder|searchFiles)/);
    expect(source).not.toMatch(/sozAsosiy\(\)\.rootId/);
    expect(source).not.toMatch(/\bROOT_FOLDER_ID\s*(?:\?\?|\|\||\.|\[)/);
  });
});
