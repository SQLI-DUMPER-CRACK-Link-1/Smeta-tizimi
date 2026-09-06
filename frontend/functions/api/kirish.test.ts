/**
 * T2-AUTH-PASSWORD-MIGRATION-001 -- dual-check login proof.
 * Every existing GAS-only login must keep working unchanged
 * (NO_PASSWORD_SET -> GAS, exactly like before this task). A login that HAS
 * a Supabase hash must NEVER fall through to GAS -- neither on success
 * (would silently double the source of truth) nor on failure (would let a
 * stale/different GAS password bypass an explicitly-set Supabase one).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from './kirish';

const ENV = {
  GAS_URL: 'https://gas.example/exec', GAS_TOKEN: 'gas-token',
  SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_KEY: 'service-key',
  SESSIYA_KALIT: 'a'.repeat(32),
};

function ctxOf(body: unknown) {
  return { request: new Request('http://x/api/kirish', { method: 'POST', body: JSON.stringify(body) }), env: ENV } as any;
}

function fetchMock(opts: { parolTekshir?: unknown; gas?: unknown; kirishRoyxat?: unknown }) {
  return vi.fn(async (url: string) => {
    if (url.includes('/rpc/t2_parol_tekshir_v1')) {
      return { ok: true, json: async () => opts.parolTekshir } as Response;
    }
    if (url === ENV.GAS_URL) {
      return { ok: true, json: async () => opts.gas ?? { ok: false, data: null } } as Response;
    }
    if (url.includes('/rpc/t2_kirish_royxatga_ol')) {
      return { ok: true, text: async () => JSON.stringify(opts.kirishRoyxat ?? { ok: true, foydalanuvchi_id: 1, azoliklar: [] }) } as Response;
    }
    throw new Error('kutilmagan fetch: ' + url);
  });
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('kirish -- Supabase/GAS dual-check', () => {
  it('NO_PASSWORD_SET -> eski GAS yo\'liga o\'tadi (mavjud foydalanuvchilar buzilmaydi)', async () => {
    const fetchSpy = fetchMock({ parolTekshir: { ok: false, code: 'NO_PASSWORD_SET' }, gas: { ok: true, data: 'prorab' } });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await onRequestPost(ctxOf({ login: 'eski_foydalanuvchi', parol: 'gas-parol' }));
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls.some((c) => c[0] === ENV.GAS_URL)).toBe(true);
    expect(res.headers.get('Set-Cookie')).toMatch(/^sess=/);
  });

  it('Supabase hash mos keladi -> GAS UMUMAN chaqirilmaydi', async () => {
    const fetchSpy = fetchMock({ parolTekshir: { ok: true, foydalanuvchi_id: 7, rol: 'prorab' } });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await onRequestPost(ctxOf({ login: 'yangi_azo', parol: 'togri-parol-123' }));
    expect(res.status).toBe(200);
    expect(fetchSpy.mock.calls.some((c) => c[0] === ENV.GAS_URL)).toBe(false);
    expect(res.headers.get('Set-Cookie')).toMatch(/^sess=/);
  });

  it('Supabase hash bor, lekin mos kelmadi -> darhol rad etiladi, GAS\'ga QAYTILMAYDI', async () => {
    const fetchSpy = fetchMock({ parolTekshir: { ok: false, code: 'PAROL_NOTOGRI' }, gas: { ok: true, data: 'prorab' } });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await onRequestPost(ctxOf({ login: 'yangi_azo', parol: 'notogri' }));
    expect(res.status).toBe(401);
    // GAS'da (nazariy) mos kelishi mumkin bo'lsa ham -- chaqirilmasligi SHART.
    expect(fetchSpy.mock.calls.some((c) => c[0] === ENV.GAS_URL)).toBe(false);
  });
});
