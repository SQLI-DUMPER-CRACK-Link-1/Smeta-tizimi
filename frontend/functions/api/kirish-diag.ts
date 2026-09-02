import { kalitTashxis } from '../_shared/auth';

/**
 * VAQTINCHALIK diagnostika endpoint — 2026-09-02 Preview login smoke
 * nosozligini aniqlash uchun. Faqat boolean/kategoriya qaytaradi, HECH
 * QACHON secret qiymatini (GAS_URL, GAS_TOKEN, SESSIYA_KALIT) chiqarmaydi.
 * Bu sessiyada tekshirilgach OLIB TASHLANADI — doimiy route emas.
 */
export const onRequestGet: PagesFunction<{
  GAS_URL?: string; GAS_TOKEN?: string; SESSIYA_KALIT?: string;
}> = async (ctx) => {
  const out: Record<string, unknown> = {
    gas_url_set: !!ctx.env.GAS_URL,
    gas_token_set: !!ctx.env.GAS_TOKEN,
    sessiya_kalit: kalitTashxis(ctx.env as Record<string, unknown>),
  };

  if (!ctx.env.GAS_URL || !ctx.env.GAS_TOKEN) {
    out.category = 'CONFIG_MISSING';
    return Response.json(out);
  }

  try {
    const r = await fetch(ctx.env.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        __api: 1,
        token: ctx.env.GAS_TOKEN,
        fn: 'apiKirishTekshir',
        // Intentionally not a real credential — a probe login that cannot
        // exist, so this can only ever prove reachability/token acceptance,
        // never a real user's password.
        args: ['__diag_probe__', '__diag_probe__'],
      }),
    });
    out.gas_http_status = r.status;

    let data: { ok?: boolean; data?: unknown; error?: string } | null = null;
    try {
      data = await r.json();
      out.gas_json_parsed = true;
    } catch {
      out.gas_json_parsed = false;
    }

    if (!data) {
      out.category = 'GAS_INVALID_RESPONSE';
    } else if (data.ok === false && data.error === 'Нотўғри токен') {
      out.category = 'TOKEN_REJECTED';
      out.gas_ok = false;
    } else if (data.ok === false) {
      out.category = 'GAS_OTHER_ERROR';
      out.gas_ok = false;
      out.gas_error_text = data.error ?? null; // GAS's own error label, not a secret
    } else if (data.ok === true && !data.data) {
      out.category = 'CREDENTIALS_INVALID'; // expected — probe login does not exist
      out.gas_ok = true;
    } else if (data.ok === true && data.data) {
      out.category = 'UNEXPECTED_MATCH'; // should not happen for a probe login
      out.gas_ok = true;
    } else {
      out.category = 'GAS_UNKNOWN_SHAPE';
    }
  } catch (err) {
    out.category = 'GAS_TRANSPORT_ERROR';
    out.transport_error = err instanceof Error ? err.message : String(err);
  }

  return Response.json(out);
};
