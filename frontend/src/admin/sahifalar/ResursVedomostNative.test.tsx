import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ResursVedomostNative from './ResursVedomostNative';

const mocks = vi.hoisted(() => ({
  company: { joriy: { id: 1 }, yuklanmoqda: false },
  qatorHolat: vi.fn(async (_obyektId: number) => ({
    ok: true,
    qatorlar: [
      { id: 1, tur: 'rz', kat: null, nom: 'Razdel', birlik: null, smeta_hajm: 0, smeta_summa: 1000000, f2_hajm: 0, f2_summa: 0, qoldiq_hajm: 0, qoldiq_summa: 0 },
      { id: 2, tur: 'rs', kat: 'ЧЕЛ', kod: null, nom: 'Ishchi', birlik: 'chel-soat', smeta_hajm: 100, smeta_summa: 500000, f2_hajm: 40, f2_summa: 200000, qoldiq_hajm: 60, qoldiq_summa: 300000 },
      { id: 3, tur: 'mat', kat: 'МАТ', kod: 'B25', nom: 'Beton', birlik: 'm3', smeta_hajm: 20, smeta_summa: 2000000, f2_hajm: 20, f2_summa: 2000000, qoldiq_hajm: 0, qoldiq_summa: 0 },
    ],
  })),
}));
vi.mock('../../umumiy/kontekst/KompaniyaKontekst', () => ({ useKompaniya: () => mocks.company }));
vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: async () => ({ ok: true, qatorlar: [{ id: 8, nom: 'Sinov obyekt' }] }),
  sbT2QatorHolatOl: (obyektId: number) => mocks.qatorHolat(obyektId),
}));
afterEach(() => { cleanup(); mocks.qatorHolat.mockClear(); });

it('faqat resurs qatorlarini kategoriya bo‘yicha ko‘rsatadi, razdelni chiqarib tashlaydi', async () => {
  render(<ResursVedomostNative />);
  fireEvent.change(await screen.findByLabelText('Obyekt'), { target: { value: '8' } });
  await screen.findByText(/ЧЕЛ/);
  expect(screen.getByText(/МАТ/)).toBeTruthy();
  expect(screen.queryByText('Razdel')).toBeNull();
  expect(screen.getByText('Ishchi')).toBeTruthy();
  expect(screen.getByText('B25 Beton')).toBeTruthy();
});

it('resurs qidirish bilan filtrlanadi', async () => {
  render(<ResursVedomostNative />);
  fireEvent.change(await screen.findByLabelText('Obyekt'), { target: { value: '8' } });
  await screen.findByText('Ishchi');
  fireEvent.change(screen.getByLabelText('Resurs qidirish'), { target: { value: 'beton' } });
  expect(screen.queryByText('Ishchi')).toBeNull();
  expect(screen.getByText('B25 Beton')).toBeTruthy();
});

it('obyektda resurs bo‘lmasa, aniq bo‘sh xabar ko‘rsatadi', async () => {
  mocks.qatorHolat.mockResolvedValueOnce({ ok: true, qatorlar: [] });
  render(<ResursVedomostNative />);
  fireEvent.change(await screen.findByLabelText('Obyekt'), { target: { value: '8' } });
  await screen.findByText('Bu obyektda resurs qatori topilmadi.');
});
