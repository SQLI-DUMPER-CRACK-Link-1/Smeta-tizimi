import { describe, expect, it, vi } from 'vitest';
import { xavfsizUpstream } from './xato';

describe('xavfsizUpstream', () => {
  it('hides PostgREST internals while keeping the stable response shape', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = xavfsizUpstream(400, JSON.stringify({
      code: 'PGRST125', message: 'relation internal_secret does not exist',
    }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: 'UPSTREAM' });
    expect(body.error).toBe(body.xato);
    expect(JSON.stringify(body)).not.toContain('PGRST125');
    expect(JSON.stringify(body)).not.toContain('internal_secret');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('preserves stable application codes for conflict handling', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = xavfsizUpstream(409, JSON.stringify({ code: 'STALE_VERSION' }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body).toMatchObject({ ok: false, code: 'STALE_VERSION' });
    expect(body.error).toBe('Ma’lumot boshqa joyda o‘zgargan — sahifani yangilang.');
    log.mockRestore();
  });

  it('keeps a gateway status override without exposing the upstream body', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = xavfsizUpstream(200, JSON.stringify({
      code: 'AUTHORIZATION_DENIED', message: 'internal relation detail',
    }), 403);
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toMatchObject({ ok: false, code: 'AUTHORIZATION_DENIED' });
    expect(JSON.stringify(body)).not.toContain('internal relation detail');
    log.mockRestore();
  });
});
