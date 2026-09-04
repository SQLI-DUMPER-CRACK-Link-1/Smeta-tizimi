import { afterEach, describe, expect, it, vi } from 'vitest';
import { sbT2QoshimchaIshYarat, sbT2ResursBolaQosh, sbT2ZamenaIshYarat } from './t2-additional-replacement';

const fetchMock = vi.fn();

function mockOk() {
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);
}

function sentBody() {
  return JSON.parse(fetchMock.mock.calls[0][1].body);
}

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('Additional/Replacement klient kontrakti', () => {
  const base = { kompaniyaId: 7, obyektId: 8, operationId: 'f2ee16f8-0488-4a42-a113-4493ee1d0bf9', expectedVersion: 3, sabab: 'Tasdiqlangan o\'zgarish' };

  it('qo\'shimcha ish uchun taklif qilingan command shaklini yuboradi', async () => {
    mockOk();
    await sbT2QoshimchaIshYarat({ ...base, otaQatorId: 21, nom: 'Qo\'shimcha beton', birlik: 'm3', hajm: 4, keyinQatorId: 22 });
    expect(fetchMock).toHaveBeenCalledWith('/api/sb-yoz', expect.objectContaining({ method: 'POST' }));
    expect(sentBody()).toMatchObject({ amal: 'qoshimcha_ish_yarat_v1', kompaniya_id: 7, obyekt_id: 8, ota_qator_id: 21, operation_id: base.operationId, kutilgan_versiya: 3 });
  });

  it('zamena eski qatorni nomini o\'zgartirmasdan explicit relation bilan yuboradi', async () => {
    mockOk();
    await sbT2ZamenaIshYarat({ ...base, almashtirilayotganQatorId: 44, otaQatorId: 21, nom: 'Yangi beton', birlik: 'm3', hajm: 5 });
    expect(sentBody()).toMatchObject({ amal: 'zamena_ish_yarat_v1', almashtirilayotgan_qator_id: 44, ota_qator_id: 21, operation_id: base.operationId, kutilgan_versiya: 3 });
  });

  it('resurs bolasi turini, operation_id va expected_version ni majburiy yuboradi', async () => {
    mockOk();
    await sbT2ResursBolaQosh({ ...base, otaQatorId: 21, tur: 'mat', nom: 'Armatura', birlik: 'kg', hajm: 120 });
    expect(sentBody()).toMatchObject({ amal: 'resurs_bola_qosh_v1', tur: 'mat', operation_id: base.operationId, kutilgan_versiya: 3 });
  });
});
