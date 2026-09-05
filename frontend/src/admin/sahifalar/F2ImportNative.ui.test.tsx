import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import F2ImportNative from './F2ImportNative';

const mocks = vi.hoisted(() => ({ write: vi.fn(), company: { joriy: { id: 1 }, yuklanmoqda: false } }));
vi.mock('../../umumiy/kontekst/KompaniyaKontekst', () => ({ useKompaniya: () => mocks.company }));
vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: async () => ({ ok: true, qatorlar: [{ id: 8, nom: 'Sinov obyekt' }] }),
  sbT2DaraxtOl: async () => ({ ok: true, qatorlar: [{ id: 123, tur: 'mat', nom: 'Beton', kod: 'B25', birlik: 'm3' }] }),
  sbT2AktYaratV2: mocks.write,
  yangiOperationId: () => 'test-operation',
}));
vi.mock('../../lib/f2-import-parse', () => ({
  readXlsx: async () => ({ sheets: [{ name: 'F2' }], sheet: () => ({ rows: [[10, 123.45, 1234.49]] }) }),
  f2FaylOqiCore: (_: unknown, cols: unknown) => cols
    ? { tree: [{ uid: 'f2_0', type: 'mat', nom: 'Beton', hajm: 10, narx: 123.45, summa: 1234.49 }] }
    : { cols: { kod: 0, nom: 0, bir: 0, norma: 0, obyom: 0, narx: 1, sum: 2 } },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); mocks.write.mockReset(); mocks.company.joriy.id = 1; });
it('yangi yo‘l asl summani V2 ga yozadi, javob yo‘qolganda ayni operation bilan qaytaradi', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, mosliklar: [{ uid: 'f2_0', row: 123, summa: 999999, narx: 999999 }] }) }));
  mocks.write.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true });
  render(<F2ImportNative />);
  await screen.findByText('Sinov obyekt');
  fireEvent.change(screen.getByLabelText('Obyekt'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('F2 davri'), { target: { value: '2026-02' } });
  const file = new File(['x'], 'sinov.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
  fireEvent.change(screen.getByLabelText('XLSX fayl'), { target: { files: [file] } });
  await screen.findByText('Varaq va ustunlarni tekshiring');
  fireEvent.click(screen.getByText('Moslashtirish'));
  await screen.findByText('Ko‘rib chiqish kerak');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('F2 qoralamasini saqlash'));
  await screen.findByText('Yozish javobi olinmadi. Qayta urinish ayni operatsiyani tekshiradi.');
  fireEvent.click(screen.getByText('F2 qoralamasini saqlash'));
  await screen.findByText('Tayyor — F2 qoralamasi saqlandi');
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(mocks.write.mock.calls[1][0]).toEqual(mocks.write.mock.calls[0][0]);
  expect(mocks.write.mock.calls[0][0]).toMatchObject({ obyektId: 8, oy: '2026-02-01', qatorlar: [{ certifiedAmount: 1234.49, certifiedUnitPrice: 123.45 }] });
});
it('kompaniya almashganda eski obyekt tanlovi saqlanmaydi', async () => {
  const { rerender } = render(<F2ImportNative />);
  await screen.findByText('Sinov obyekt');
  fireEvent.change(screen.getByLabelText('Obyekt'), { target: { value: '8' } });
  mocks.company.joriy.id = 2;
  rerender(<F2ImportNative />);
  await waitFor(() => expect((screen.getByLabelText('Obyekt') as HTMLSelectElement).value).toBe(''));
  expect(mocks.write).not.toHaveBeenCalled();
});
