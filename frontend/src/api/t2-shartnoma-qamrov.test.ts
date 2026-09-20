import { afterEach, describe, expect, it, vi } from 'vitest';
import { t2ShartnomaQamrovOl, t2ShartnomaQamrovSaqla } from './t2-shartnoma-qamrov';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('shartnoma qamrovi adapteri', () => {
  it('qamrovni faqat tanlangan shartnoma identifikatori bilan o\'qiydi', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ ok: true, natija: { ok: true, qatorlar: [], summary: { qator_soni: 0, qamrovda: 0, chiqarilgan: 0, hisobga_kiradigan: 0, jami: 0, jami_noaniq: 0 } } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await t2ShartnomaQamrovOl(42);
    expect(fetchMock).toHaveBeenCalledWith('/api/sb', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ soro: 'shartnoma_qamrov_ol_v1', shartnoma_id: 42 });
  });

  it('chiqarish qarorini sabab, versiya va idempotent operation bilan yuboradi', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await t2ShartnomaQamrovSaqla({
      kompaniyaId: 7, shartnomaId: 42, obyektId: 9, qatorId: 101,
      holat: 'chiqarilgan', sabab: 'Bu pozitsiya ushbu shartnomada yo\'q',
      kutilganVersiya: 3, operationId: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/sb-yoz', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      amal: 'shartnoma_qamrov_saqla', kompaniya_id: 7, shartnoma_id: 42,
      obyekt_id: 9, qator_id: 101, holat: 'chiqarilgan', kutilgan_versiya: 3,
      operation_id: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9',
    });
  });

  it('qisman shartnomaviy hajmni canonical qatorni o\'zgartirmasdan yuboradi', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    await t2ShartnomaQamrovSaqla({
      kompaniyaId: 7, shartnomaId: 42, obyektId: 9, qatorId: 101,
      holat: 'kiritilgan', hajmOverride: 12.5,
      sabab: 'Shu shartnomada tasdiqlangan qism', kutilganVersiya: 1,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      amal: 'shartnoma_qamrov_saqla', holat: 'kiritilgan', hajm_override: 12.5,
    });
  });
});
