import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentStorageStatus, StorageHealthCard, StorageStatusBadge, StorageWorkspaceForm } from './index';

describe('storage visible components', () => {
  it.each([
    ['READY', 'Tayyor'], ['PENDING', 'Kutilmoqda'], ['FAILED', 'Xato'],
    ['NOT_CONFIGURED', 'Sozlanmagan'], ['VERIFYING', 'Tekshirilmoqda'],
  ] as const)('renders %s state', (status, label) => {
    render(<StorageStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('renders storage health details and an actionable error', () => {
    const retry = vi.fn();
    render(<StorageHealthCard status="FAILED" provider="Google Drive" mode="shared_drive" folderName="Toshkent / 42-obyekt" lastVerifiedAt="2026-08-31T12:00:00Z" errorCode="STORAGE_ROOT_NOT_VERIFIED" onRetry={retry} />);
    expect(screen.getByText('Google Drive')).toBeTruthy();
    expect(screen.getByText('Shared Drive')).toBeTruthy();
    expect(screen.getByText('Toshkent / 42-obyekt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /qayta urinish/i }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('renders upload success and failure states', () => {
    const { rerender } = render(<DocumentStorageStatus status="SUCCESS" message="Registry yozildi" />);
    expect(screen.getByText('Yuklandi')).toBeTruthy();
    expect(screen.getByText('Registry yozildi')).toBeTruthy();
    rerender(<DocumentStorageStatus status="FAILED" message="Papka tasdiqlanmagan" />);
    expect(screen.getByRole('alert').textContent).toContain('Papka tasdiqlanmagan');
  });

  it('keeps form controlled and disables actions during loading', () => {
    const bind = vi.fn(); const change = vi.fn(); const verify = vi.fn(); const retry = vi.fn();
    const value = { folderInput: 'https://drive.google.com/drive/folders/abc', mode: 'my_drive' as const };
    const { rerender } = render(<StorageWorkspaceForm value={value} onChange={change} onBind={bind} onVerify={verify} onRetry={retry} />);
    fireEvent.change(screen.getByLabelText(/drive folder/i), { target: { value: 'folder-id' } });
    expect(change).toHaveBeenCalledWith({ folderInput: 'folder-id', mode: 'my_drive' });
    fireEvent.click(screen.getByRole('button', { name: 'Biriktirish' }));
    expect(bind).toHaveBeenCalledWith(value);
    fireEvent.click(screen.getByRole('button', { name: 'Tekshirish' }));
    expect(verify).toHaveBeenCalledWith(value);
    rerender(<StorageWorkspaceForm value={value} onChange={change} onBind={bind} onVerify={verify} onRetry={retry} loading />);
    expect((screen.getByRole('button', { name: /biriktirilmoqda/i }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Tekshirish' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Qayta urinish' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
