/**
 * T2-AUTH-PASSWORD-MIGRATION-001 -- `member_password_set` action proof.
 * Same actor-from-session law as every other action here: p_actor_id NEVER
 * comes from the request body, only from the verified session cookie.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { imzola } from '../_shared/auth';
import { onRequestPost } from './company';

const ENV = { SUPABASE_URL: 'https://proj.supabase.co', SUPABASE_KEY: 'service-key', SESSIYA_KALIT: 'a'.repeat(32) };

async function ctxOf(body: unknown, actorId = 3) {
  const token = await imzola({ rol: 'boss', email: 'boss@sinov', foydalanuvchi_id: actorId }, ENV.SESSIYA_KALIT);
  return {
    request: new Request('http://x/api/company', {
      method: 'POST', headers: { Cookie: `sess=${token}` }, body: JSON.stringify(body),
    }),
    env: ENV,
  } as any;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('company -- member_password_set', () => {
  it('actor sessiyadan olinadi (so\'rov tanasidan EMAS), to\'g\'ri RPC chaqiriladi', async () => {
    const fetchSpy = vi.fn(async (url: string, init: { body: string }) => {
      expect(url).toContain('/rpc/t2_parol_belgila_v1');
      const sent = JSON.parse(init.body);
      expect(sent).toMatchObject({ p_actor_id: 3, p_kompaniya_id: 1, p_foydalanuvchi_id: 42, p_yangi_parol: 'yetarlicha-uzun-1' });
      return { ok: true, text: async () => JSON.stringify({ ok: true, foydalanuvchi_id: 42 }) } as Response;
    });
    vi.stubGlobal('fetch', fetchSpy);
    const res = await onRequestPost(await ctxOf({
      action: 'member_password_set', kompaniya_id: 1, foydalanuvchi_id: 42,
      yangi_parol: 'yetarlicha-uzun-1',
      // Buzg'unchi urinish: boshqa aktyorni yubormoqchi -- e'tiborsiz qoldirilishi SHART.
      p_actor_id: 999,
    }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j).toMatchObject({ ok: true, foydalanuvchi_id: 42 });
  });

  it('PAROL_QISQA -> 400', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ ok: false, code: 'PAROL_QISQA' }) } as Response)));
    const res = await onRequestPost(await ctxOf({ action: 'member_password_set', kompaniya_id: 1, foydalanuvchi_id: 42, yangi_parol: 'qisqa' }));
    expect(res.status).toBe(400);
  });

  it('AZOLIK_TOPILMADI -> 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => JSON.stringify({ ok: false, code: 'AZOLIK_TOPILMADI' }) } as Response)));
    const res = await onRequestPost(await ctxOf({ action: 'member_password_set', kompaniya_id: 1, foydalanuvchi_id: 999999, yangi_parol: 'yetarlicha-uzun-1' }));
    expect(res.status).toBe(404);
  });

  it('direktor emas aktyor -> 403 (42501 RPC dan)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, text: async () => 'faqat direktor (boss) yoki superadmin' } as Response)));
    const res = await onRequestPost(await ctxOf({ action: 'member_password_set', kompaniya_id: 1, foydalanuvchi_id: 42, yangi_parol: 'yetarlicha-uzun-1' }));
    expect(res.status).toBe(403);
  });
});
