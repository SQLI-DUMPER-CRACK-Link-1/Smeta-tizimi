import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FaktNative from './FaktNative';

const mocks = vi.hoisted(() => ({
  faktYoz: vi.fn(),
  faktBelgilaV2: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('../../umumiy/kontekst/KompaniyaKontekst', () => ({
  useKompaniya: () => ({ joriy: { id: 1 }, yuklanmoqda: false }),
}));

vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: async () => ({ ok: true, qatorlar: [{ id: 8, nom: 'Sinov obyekt' }] }),
}));

vi.mock('../../api/t2-fakt', () => ({
  sbFaktYoz: mocks.faktYoz,
  sbFaktBelgilaV2: mocks.faktBelgilaV2,
  sbQatorHolatOl: async () => ({
    ok: true,
    qatorlar: [{
      qator_id: 22, obyekt_id: 8, tur: 'bl', kod: 'BL-01', nom: 'Beton ishlari', birlik: 'm3', kat: null,
      smeta_hajm: 200, smeta_narx: 100, smeta_summa: 20000,
      fakt_hajm: 125.4, fakt_summa: 12540, f2_hajm: 0, f2_summa: 0,
      qoldiq_hajm: 74.6, qoldiq_summa: 7460, f2_mumkin_hajm: 125.4, f2_mumkin_summa: 12540,
    }],
  }),
}));

vi.mock('../../umumiy/ui/Toast', () => ({ toast: mocks.toast }));

function renderFakt() {
  return render(<MemoryRouter initialEntries={['/admin/fakt?obyekt=8']}><FaktNative /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  mocks.faktYoz.mockReset();
  mocks.faktBelgilaV2.mockReset();
  mocks.toast.mockReset();
});

describe('FaktNative kanonik yozish usullari', () => {
  it('standart ustiga qo‘shish yo‘li mavjud kanonik fakt yozish kontraktini saqlaydi', async () => {
    mocks.faktYoz.mockResolvedValue({ ok: true });
    renderFakt();
    const input = await screen.findByLabelText('Fakt 22');
    fireEvent.change(input, { target: { value: '3.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Faktni saqlash' }));
    await waitFor(() => expect(mocks.faktYoz).toHaveBeenCalledWith(expect.objectContaining({
      obyektId: 8,
      qatorlar: [{ qator_id: 22, hajm: 3.5 }],
      izoh: 'Website kanonik Fakt kiritishi',
    })));
    expect(mocks.faktBelgilaV2).not.toHaveBeenCalled();
  });

  it('jami rejimi expected qiymatni yuborib optimistic total edit ishlatadi', async () => {
    mocks.faktBelgilaV2.mockResolvedValue({ ok: true, fakt_hajm: 128.75 });
    renderFakt();
    await screen.findByLabelText('Fakt 22');
    fireEvent.click(screen.getByRole('button', { name: 'Jami qiymat' }));
    fireEvent.change(screen.getByLabelText('Fakt 22'), { target: { value: '128.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Faktni saqlash' }));
    await waitFor(() => expect(mocks.faktBelgilaV2).toHaveBeenCalledWith(expect.objectContaining({
      obyektId: 8,
      qatorId: 22,
      expectedFaktHajm: 125.4,
      yangiFaktHajm: 128.75,
      izoh: 'Website kanonik Fakt jami tahriri',
      operationId: expect.any(String),
    })));
    expect(mocks.faktYoz).not.toHaveBeenCalled();
  });

  it('jami rejimida server conflicti foydalanuvchiga xavfsiz xabar bo‘lib qaytadi', async () => {
    mocks.faktBelgilaV2.mockResolvedValue({ ok: false, code: 'FAKT_CONFLICT' });
    renderFakt();
    await screen.findByLabelText('Fakt 22');
    fireEvent.click(screen.getByRole('button', { name: 'Jami qiymat' }));
    fireEvent.change(screen.getByLabelText('Fakt 22'), { target: { value: '128.75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Faktni saqlash' }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      expect.stringContaining('eskirgan qiymat sabab rad etildi'), 'warn',
    ));
    expect(mocks.toast.mock.calls[0][0]).not.toMatch(/PGRST|supabase|token/i);
  });
});
