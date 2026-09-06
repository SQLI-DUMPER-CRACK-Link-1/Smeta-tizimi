import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { F2TayyorlashNative } from './F2TayyorlashNative';

const mocks = vi.hoisted(() => ({
  company: { joriy: { id: 1 } },
  objectRead: vi.fn(), treeRead: vi.fn(), statusRead: vi.fn(), write: vi.fn(),
}));

vi.mock('../../test02/KompaniyaTanlov', () => ({ useKompaniya: () => mocks.company }));
vi.mock('../../api/supabase', () => ({
  sbT2ObyektlarOlKomp: mocks.objectRead,
  sbT2DaraxtOl: mocks.treeRead,
  sbT2AktYaratV2: mocks.write,
  yangiOperationId: () => 'test-operation',
}));
vi.mock('../../api/t2-fakt', () => ({ sbQatorHolatOl: mocks.statusRead }));

afterEach(() => {
  cleanup();
  mocks.objectRead.mockReset(); mocks.treeRead.mockReset(); mocks.statusRead.mockReset(); mocks.write.mockReset();
});

it('native tayyorlash ikki panel va kanonik F2 mumkin oqimini ko‘rsatadi', async () => {
  mocks.objectRead.mockResolvedValue({ ok: true, qatorlar: [{ id: 8, nom: 'Sinov obyekt' }] });
  mocks.treeRead.mockResolvedValue({ ok: true, qatorlar: [{ id: 10, ota_id: null, tur: 'rz', nom: 'Beton ishlari' }, { id: 11, ota_id: 10, tur: 'mat', nom: 'Beton B25', kod: 'B25', birlik: 'm3', hajm: 10, narx: 100, summa: 1000 }] });
  mocks.statusRead.mockResolvedValue({ ok: true, qatorlar: [{ qator_id: 11, tur: 'mat', f2_mumkin_hajm: 4, fakt_hajm: 4, fakt_summa: 400 }] });
  render(<MemoryRouter initialEntries={['/admin/f2-tayyorlash?obyekt=8']}><F2TayyorlashNative /></MemoryRouter>);
  expect((await screen.findAllByText(/F2 olish mumkin/)).length).toBeGreaterThan(0);
  expect((screen.getAllByText(/Forma-2 qoralama preview/)).length).toBeGreaterThan(0);
  expect(screen.getByText(/Fakt qoldig‘idan kanonik qoralama/)).toBeTruthy();
});
