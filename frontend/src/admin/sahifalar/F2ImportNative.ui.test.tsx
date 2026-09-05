import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import F2ImportNative from './F2ImportNative';

const mocks = vi.hoisted(() => ({
  write: vi.fn(), company: { joriy: { id: 1 }, yuklanmoqda: false },
  jobYarat: vi.fn(), jobIlgarilash: vi.fn(), draftSaqla: vi.fn(),
  jobHolat: vi.fn(), draftRoyxat: vi.fn(),
  qatorSoni: 1,
}));
vi.mock('../../umumiy/kontekst/KompaniyaKontekst', () => ({ useKompaniya: () => mocks.company }));
vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: async () => ({ ok: true, qatorlar: [{ id: 8, nom: 'Sinov obyekt' }] }),
  sbT2DaraxtOl: async () => ({ ok: true, qatorlar: [{ id: 123, tur: 'mat', nom: 'Beton', kod: 'B25', birlik: 'm3' }] }),
  sbT2AktYaratV2: mocks.write,
  yangiOperationId: () => 'test-operation',
  sbT2F2ImportJobYarat: mocks.jobYarat,
  sbT2F2ImportJobIlgarilash: mocks.jobIlgarilash,
  sbT2F2ImportDraftSaqla: mocks.draftSaqla,
  sbT2F2ImportJobHolat: mocks.jobHolat,
  sbT2F2ImportDraftRoyxat: mocks.draftRoyxat,
}));
vi.mock('../../lib/f2-import-parse', () => ({
  readXlsx: async () => ({ sheets: [{ name: 'F2' }], sheet: () => ({ rows: Array.from({ length: mocks.qatorSoni }, () => [10, 123.45, 1234.49]) }) }),
  f2FaylOqiCore: (rows: unknown[], cols: unknown) => cols
    ? { tree: rows.map((_, i) => ({ uid: 'f2_' + i, type: 'mat', nom: 'Beton', hajm: 10, narx: 123.45, summa: 1234.49 })) }
    : { cols: { kod: 0, nom: 0, bir: 0, norma: 0, obyom: 0, narx: 1, sum: 2 } },
}));
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); mocks.write.mockReset(); mocks.company.joriy.id = 1;
  mocks.jobYarat.mockReset(); mocks.jobIlgarilash.mockReset(); mocks.draftSaqla.mockReset();
  mocks.jobHolat.mockReset(); mocks.draftRoyxat.mockReset(); mocks.qatorSoni = 1;
  try { localStorage.clear(); } catch { /* jsdom */ }
});
it('yangi yo‘l asl summani V2 ga yozadi, javob yo‘qolganda ayni operation bilan qaytaradi', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, mosliklar: [{ uid: 'f2_0', row: 123, summa: 999999, narx: 999999 }] }) }));
  mocks.write.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true });
  mocks.jobYarat.mockResolvedValue({ ok: true, job_id: 1, takror: false });
  mocks.draftSaqla.mockResolvedValue({ ok: true, saqlandi: 1 });
  mocks.jobIlgarilash.mockResolvedValue({ ok: true, versiya: 2 });
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
  // T2-GAS-EXIT-001 §5/§6: moslashtirish natijasi darhol job/draft sifatida saqlanadi.
  await waitFor(() => expect(mocks.jobYarat).toHaveBeenCalledWith(
    expect.objectContaining({ obyektId: 8, totalRows: 1 })));
  await waitFor(() => expect(mocks.draftSaqla).toHaveBeenCalledWith(expect.objectContaining({
    jobId: 1, qatorlar: [expect.objectContaining({ uid: 'f2_0', holat: 'avto_moslashti', lrvRow: 123 })],
  })));
  await waitFor(() => expect(mocks.jobIlgarilash).toHaveBeenCalledWith(expect.objectContaining({
    jobId: 1, status: 'running', matchedDelta: 1, unmatchedDelta: 0,
  })));
  fireEvent.click(screen.getByLabelText(/Varaq, davr va moslashtirish natijasini tekshirdim/));
  fireEvent.click(screen.getByText('F2 qoralamasini saqlash'));
  await screen.findByText('Yozish javobi olinmadi. Qayta urinish ayni operatsiyani tekshiradi.');
  fireEvent.click(screen.getByText('F2 qoralamasini saqlash'));
  await screen.findByText('Tayyor — F2 qoralamasi saqlandi');
  expect(mocks.write).toHaveBeenCalledTimes(2);
  expect(mocks.write.mock.calls[1][0]).toEqual(mocks.write.mock.calls[0][0]);
  expect(mocks.write.mock.calls[0][0]).toMatchObject({ obyektId: 8, oy: '2026-02-01', qatorlar: [{ certifiedAmount: 1234.49, certifiedUnitPrice: 123.45 }] });
  // Hujjat yozilgach job 'completed' deb belgilanadi va kesh tozalanadi.
  await waitFor(() => expect(mocks.jobIlgarilash).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' })));
  expect(localStorage.getItem('t2-f2-import-job:8')).toBeNull();
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
it('tugallanmagan job topilsa "Davom ettirish" taklif qiladi va uni to‘liq tiklaydi', async () => {
  localStorage.setItem('t2-f2-import-job:8', '42');
  mocks.jobHolat.mockResolvedValue({
    ok: true, job_id: 42, status: 'running', total_rows: 1, matched_rows: 1, unmatched_rows: 0,
    updated_at: '2026-09-05T10:00:00Z', versiya: 3,
    cursor: { phase: 'review', writeOperationId: 'resumed-op', month: '2026-02' },
  });
  mocks.draftRoyxat.mockResolvedValue({
    ok: true, qatorlar: [{ uid: 'f2_0', holat: 'avto_moslashti', lrv_row: 123, kod: 'B25', hajm: 10, narx: 123.45, summa: 1234.49, versiya: 1, yangilandi: '', lrv_varaq: null, sabab: null }],
  });
  render(<F2ImportNative />);
  await screen.findByText('Sinov obyekt');
  fireEvent.change(screen.getByLabelText('Obyekt'), { target: { value: '8' } });
  await screen.findByText(/Tugallanmagan import bor/);
  fireEvent.click(screen.getByText('Davom ettirish'));
  await screen.findByText('Ko‘rib chiqish kerak (tiklangan)');
  expect(screen.getByText(/1 manba qatoridan 1 tasi bog‘landi/)).toBeTruthy();
  mocks.write.mockResolvedValueOnce({ ok: true });
  fireEvent.click(screen.getByLabelText(/Varaq, davr va moslashtirish natijasini tekshirdim/));
  fireEvent.click(screen.getByText('F2 qoralamasini saqlash'));
  await screen.findByText('Tayyor — F2 qoralamasi saqlandi');
  // Tiklangan operation_id (yozish operatsiyasi) o'zgarishsiz ishlatildi -- qayta tiklash ikkinchi hujjat yaratmaydi.
  expect(mocks.write.mock.calls[0][0]).toMatchObject({ obyektId: 8, oy: '2026-02-01', operationId: 'resumed-op' });
});
it('30 000 qatorlik faylni rad etmaydi va har 5000 tadan checkpoint qiladi (Codex "tugadi" mezoni)', async () => {
  mocks.qatorSoni = 30000;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { aktTree: { uid: string }[] };
    return { ok: true, json: async () => ({ ok: true, mosliklar: body.aktTree.map((n) => ({ uid: n.uid, row: 123, summa: 1234.49, narx: 123.45 })) }) };
  }));
  let versiya = 1;
  mocks.jobYarat.mockResolvedValue({ ok: true, job_id: 7, takror: false });
  mocks.draftSaqla.mockResolvedValue({ ok: true, saqlandi: 5000 });
  mocks.jobIlgarilash.mockImplementation(async () => ({ ok: true, versiya: ++versiya }));
  render(<F2ImportNative />);
  await screen.findByText('Sinov obyekt');
  fireEvent.change(screen.getByLabelText('Obyekt'), { target: { value: '8' } });
  fireEvent.change(screen.getByLabelText('F2 davri'), { target: { value: '2026-02' } });
  const file = new File(['x'], 'katta.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
  fireEvent.change(screen.getByLabelText('XLSX fayl'), { target: { files: [file] } });
  await screen.findByText('Varaq va ustunlarni tekshiring');
  // Eski qattiq devor (>20000 qator RAD ETILGAN bo'lardi) endi yo'q -- 30000 qator qabul qilinadi.
  fireEvent.click(screen.getByText('Moslashtirish'));
  await screen.findByText('Ko‘rib chiqish kerak', {}, { timeout: 10000 });
  expect(screen.queryByText(/qatordan katta/)).toBeNull();
  // 30000 / 5000 = 6 ta bo'lak -- har birida draft saqlanadi VA checkpoint yoziladi.
  await waitFor(() => expect(mocks.draftSaqla).toHaveBeenCalledTimes(6), { timeout: 10000 });
  await waitFor(() => expect(mocks.jobIlgarilash).toHaveBeenCalledTimes(6));
  for (const call of mocks.draftSaqla.mock.calls) {
    expect((call[0] as { qatorlar: unknown[] }).qatorlar.length).toBeLessThanOrEqual(5000);
  }
  const oxirgiCheckpoint = mocks.jobIlgarilash.mock.calls.at(-1)![0] as { cursor: { chunk: number } };
  expect(oxirgiCheckpoint.cursor.chunk).toBe(30000);
}, 20000);
