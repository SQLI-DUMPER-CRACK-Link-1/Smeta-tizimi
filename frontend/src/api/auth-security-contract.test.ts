import { describe, expect, it } from 'vitest';
import { imzola, kalitBormi, kalitTekshir } from '../../functions/_shared/auth';

describe('session secret security contract', () => {
  it('missing or short session secret never falls back to a repository secret', () => {
    expect(kalitBormi(undefined)).toBe(false);
    expect(kalitBormi('short')).toBe(false);
    expect(kalitTekshir(undefined)).toBe('');
    expect(kalitTekshir('short')).toBe('');
  });

  it('configured session secret is preserved', () => {
    const secret = 'x'.repeat(32);
    expect(kalitBormi(secret)).toBe(true);
    expect(kalitTekshir(secret)).toBe(secret);
  });

  it('session signing fails closed when the secret is not configured', async () => {
    await expect(imzola({ rol: 'admin', email: 'test@example.com' }, '')).rejects.toThrow('SESSIYA_KALIT');
  });
});
