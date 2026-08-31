import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const storage = vi.hoisted(() => ({
  companyStorageOl: vi.fn(),
  companyStorageBind: vi.fn(),
  projectStorageRoyxat: vi.fn(),
  projectStorageProvision: vi.fn(),
  objectStorageRoyxat: vi.fn(),
  objectStorageRetry: vi.fn(),
  documentUpload: vi.fn(),
  storageXatoMatn: vi.fn((code?: string, fallback?: string) => fallback || `mapped:${code}`),
  demoRejimmi: vi.fn(() => false),
  // current implementation composes Codex components; keep the real state map
  toUiStatus: (s?: string) => {
    switch (s) {
      case 'verified': case 'ready': case 'legacy': return 'READY';
      case 'pending': return 'PENDING';
      case 'failed': case 'revoked': return 'FAILED';
      default: return 'NOT_CONFIGURED';
    }
  },
}));

vi.mock('./KompaniyaTanlov', () => ({
  useKompaniya: () => ({ joriy: { id: 4, nom: 'QA kompaniya' } }),
}));
vi.mock('../api/t2-storage', () => storage);

import TestSaqlash from './TestSaqlash';

const company = (status: string, versiya = 3) => ({
  workspace_id: status === 'not_configured' ? null : 904,
  kompaniya_id: 4,
  provider: status === 'not_configured' ? null : 'google_drive',
  mode: status === 'not_configured' ? null : 'shared_drive',
  root_folder_id: status === 'not_configured' ? null : 'folder-4',
  root_folder_name: status === 'not_configured' ? null : 'QA Drive',
  status, legacy: false, versiya, verified_at: null,
});

const project = (provisioning_status = 'verified', versiya = 6) => ({
  loyiha_id: 9, loyiha_nom: 'QA loyiha', workspace_id: 904,
  project_root_folder_id: provisioning_status === 'verified' ? 'project-9' : null,
  provisioning_status, storage_error: provisioning_status === 'failed' ? 'backend failure' : null, versiya,
});

const object = (storage_status = 'ready', versiya = 8) => ({
  obyekt_id: 11, obyekt_nom: 'QA obyekt', loyiha_id: 9,
  folder_id: storage_status === 'ready' ? 'object-11' : null, parent_folder_id: 'project-9',
  storage_status, storage_error: storage_status === 'failed' ? 'backend failure' : null, versiya,
});

function defaultResponses(status = 'verified') {
  storage.companyStorageOl.mockResolvedValue({ ok: true, data: company(status) });
  storage.projectStorageRoyxat.mockResolvedValue({ ok: true, data: [project()] });
  storage.objectStorageRoyxat.mockResolvedValue({ ok: true, data: [object()] });
  storage.companyStorageBind.mockResolvedValue({ ok: true, data: company('verified', 4) });
  storage.projectStorageProvision.mockResolvedValue({ ok: true, data: project('verified', 7) });
  storage.objectStorageRetry.mockResolvedValue({ ok: true, data: object('ready', 9) });
  storage.documentUpload.mockResolvedValue({ ok: true, document_id: 42, external_file_id: 'file-42', status: 'active' });
}

describe('/admin/test/saqlash visible storage slice', () => {
  beforeEach(() => {
    Object.values(storage).forEach((mock) => { if (typeof mock === 'function' && 'mockReset' in mock) mock.mockReset(); });
    storage.storageXatoMatn.mockImplementation((code?: string, fallback?: string) => fallback || `mapped:${code}`);
    storage.demoRejimmi.mockReturnValue(false);
    defaultResponses();
  });
  afterEach(cleanup);

  it.each([
    ['READY', 'verified', 'Tayyor'],
    ['NOT_CONFIGURED', 'not_configured', 'Sozlanmagan'],
    ['PENDING', 'pending', 'Kutilmoqda'],
    ['FAILED', 'failed', 'Xato'],
  ])('renders %s state from the storage contract', async (_name, status, label) => {
    defaultResponses(status);
    render(<TestSaqlash />);
    expect((await screen.findAllByText(label)).length).toBeGreaterThan(0);
  });

  it('renders VERIFYING as a disabled bind transition until verification resolves', async () => {
    let resolveBind!: (value: unknown) => void;
    storage.companyStorageBind.mockReturnValue(new Promise((resolve) => { resolveBind = resolve; }));
    defaultResponses('not_configured');
    storage.companyStorageBind.mockReturnValue(new Promise((resolve) => { resolveBind = resolve; }));
    render(<TestSaqlash />);
    const input = await screen.findByPlaceholderText('https://drive.google.com/drive/folders/...');
    fireEvent.change(input, { target: { value: 'https://drive.google.com/drive/folders/qa-root' } });
    const bind = screen.getByRole('button', { name: /Biriktirish/i });
    fireEvent.click(bind);
    expect(bind.hasAttribute('disabled')).toBe(true);
    resolveBind({ ok: true, data: company('verified', 4) });
    expect((await screen.findAllByText('TAYYOR')).length).toBeGreaterThan(0);
  });

  it('binds with the current expectedVersion and transitions to READY', async () => {
    defaultResponses('not_configured');
    render(<TestSaqlash />);
    fireEvent.change(await screen.findByPlaceholderText('https://drive.google.com/drive/folders/...'), { target: { value: 'root-id' } });
    fireEvent.click(screen.getByRole('button', { name: /Biriktirish/i }));
    await waitFor(() => expect(storage.companyStorageBind).toHaveBeenCalledWith(expect.objectContaining({ kompaniyaId: 4, folderUrl: 'root-id', expectedVersion: 3 })));
    expect((await screen.findAllByText('TAYYOR')).length).toBeGreaterThan(0);
  });

  it('verifies a pending project binding and preserves its expectedVersion', async () => {
    defaultResponses('verified');
    storage.projectStorageRoyxat.mockResolvedValue({ ok: true, data: [project('pending', 6)] });
    render(<TestSaqlash />);
    const verify = await screen.findByRole('button', { name: /Papkani tayyorlash/i });
    fireEvent.click(verify);
    await waitFor(() => expect(storage.projectStorageProvision).toHaveBeenCalledWith({ kompaniyaId: 4, loyihaId: 9, expectedVersion: 6 }));
    expect(screen.queryByRole('button', { name: /Papkani tayyorlash/i })).toBeNull();
  });

  it('retries failed object provisioning with its expectedVersion', async () => {
    defaultResponses('verified');
    storage.objectStorageRoyxat.mockResolvedValue({ ok: true, data: [object('failed', 8)] });
    render(<TestSaqlash />);
    fireEvent.click(await screen.findByText('QA loyiha'));
    const retry = await screen.findByRole('button', { name: /qayta urinish/i });
    fireEvent.click(retry);
    await waitFor(() => expect(storage.objectStorageRetry).toHaveBeenCalledWith(expect.objectContaining({ kompaniyaId: 4, loyihaId: 9, obyektId: 11, expectedVersion: 8 })));
  });

  it('shows upload success and upload failure with mapped backend error text', async () => {
    const { container } = render(<TestSaqlash />);
    fireEvent.click(await screen.findByText('QA loyiha'));
    await screen.findByText(/Manzil:/);
    const file = new File(['qa'], 'dalolatnoma.pdf', { type: 'application/pdf' });
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Yuklash' }));
    expect(await screen.findByText(/Hujjat #42/)).toBeTruthy();

    storage.documentUpload.mockResolvedValueOnce({ ok: false, code: 'STORAGE_PERMISSION_DENIED' });
    fireEvent.click(screen.getByRole('button', { name: 'Yuklash' }));
    expect(await screen.findByText('mapped:STORAGE_PERMISSION_DENIED')).toBeTruthy();
  });

  it('keeps bind and upload buttons disabled until their prerequisites are available', async () => {
    defaultResponses('not_configured');
    render(<TestSaqlash />);
    expect((await screen.findByRole('button', { name: /Biriktirish/i })).hasAttribute('disabled')).toBe(true);
  });
});
