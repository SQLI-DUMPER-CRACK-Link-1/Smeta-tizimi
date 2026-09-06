import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import F2TarixNative from './F2TarixNative';

const mocks = vi.hoisted(() => ({
  company: { joriy: { id: 1 } },
  objects: vi.fn(),
  registry: vi.fn(),
  detail: vi.fn(),
  approve: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../umumiy/kontekst/KompaniyaKontekst', () => ({
  useKompaniya: () => mocks.company,
}));

vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: mocks.objects,
  sbT2AktReestrOl: mocks.registry,
  sbT2AktTasdiqlash: mocks.approve,
  yangiOperationId: () => 'test-operation-id',
}));

vi.mock('../../api/t2-narx', () => ({
  sbT2F2TafsilotOl: mocks.detail,
}));

vi.mock('../../umumiy/ui/Toast', () => ({ toast: mocks.toast }));

const draft = {
  id: 19, obyekt_id: 5, kompaniya_id: 1, tur: 'f2', raqam: null,
  oy: '2026-07-01', hujjat_jami: 241983934.956, holat: 'qoralama',
  versiya: 3, yozilgan_jami: 0, farq: 241983934.956, reestr_holat: 'farq',
  qator_soni: 0, manfiy_qator: 0, narxsiz_qator: 0,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mocks.objects.mockReset();
  mocks.registry.mockReset();
  mocks.detail.mockReset();
  mocks.approve.mockReset();
  mocks.toast.mockReset();
});

function renderHistory() {
  return render(
    <MemoryRouter initialEntries={['/admin/f2-tarix?obyekt=5']}>
      <F2TarixNative />
    </MemoryRouter>,
  );
}

function setup() {
  mocks.objects.mockResolvedValue({ ok: true, qatorlar: [{ id: 5, nom: 'Sinov obyekt' }] });
  mocks.registry.mockResolvedValue({ ok: true, qatorlar: [draft] });
  mocks.detail.mockResolvedValue({ ok: true, qatorlar: [] });
  mocks.approve.mockResolvedValue({ ok: true, takror: false });
}

describe('F2TarixNative tasdiqlash safety gate', () => {
  it('bekor qilingan browser confirmation RPC chaqirmaydi', async () => {
    setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHistory();

    const approve = await screen.findByRole('button', { name: 'Tasdiqlash' });
    fireEvent.click(approve);

    await waitFor(() => expect(window.confirm).toHaveBeenCalledTimes(1));
    expect(mocks.approve).not.toHaveBeenCalled();
  });

  it('tasdiqlangan confirmation canonical approve commandga expected version yuboradi', async () => {
    setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHistory();

    fireEvent.click(await screen.findByRole('button', { name: 'Tasdiqlash' }));

    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(19, 3, 'test-operation-id'));
  });
});
