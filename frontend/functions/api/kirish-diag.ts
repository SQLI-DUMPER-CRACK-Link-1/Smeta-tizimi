import { kalitTashxis } from '../_shared/auth';

/**
 * VAQTINCHALIK diagnostika endpoint — 2026-09-02 Preview login smoke
 * nosozligini aniqlash uchun. Faqat boolean/kategoriya qaytaradi, HECH
 * QACHON secret qiymatini (GAS_URL, GAS_TOKEN, SESSIYA_KALIT) chiqarmaydi.
 * Bu sessiyada tekshirilgach OLIB TASHLANADI — doimiy route emas.
 */
export const onRequestGet: PagesFunction<{
  GAS_URL?: string; GAS_TOKEN?: string; SESSIYA_KALIT?: string;
  SUPABASE_URL?: string; SUPABASE_KEY?: string;
}> = async (ctx) => {
  const out: Record<string, unknown> = {
    gas_url_set: !!ctx.env.GAS_URL,
    gas_token_set: !!ctx.env.GAS_TOKEN,
    sessiya_kalit: kalitTashxis(ctx.env as Record<string, unknown>),
    supabase_url_set: !!ctx.env.SUPABASE_URL,
    supabase_key_set: !!ctx.env.SUPABASE_KEY,
    // Boolean-only shape check — never the value itself. PGRST125 ("Invalid
    // path specified in request URL") is the classic symptom of SUPABASE_URL
    // already containing /rest/v1 (copied from the wrong dashboard field),
    // which then doubles up with code that also appends /rest/v1/<table>.
    supabase_url_looks_like_it_has_rest_v1_suffix:
      !!ctx.env.SUPABASE_URL && /\/rest\/v1\/?$/i.test(ctx.env.SUPABASE_URL),
  };

  // Real, safe, read-only probe against the exact table the failing
  // "Kompaniya" bootstrap call uses (t2_kompaniya) — proves or disproves
  // the PGRST125 hypothesis directly against the live config, without ever
  // printing SUPABASE_URL/SUPABASE_KEY.
  if (ctx.env.SUPABASE_URL && ctx.env.SUPABASE_KEY) {
    try {
      const sUrl = ctx.env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/t2_kompaniya?select=id&limit=1';
      const sr = await fetch(sUrl, {
        headers: { apikey: ctx.env.SUPABASE_KEY, Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY },
      });
      out.supabase_probe_http_status = sr.status;
      const sBody = await sr.text();
      try {
        const parsed = JSON.parse(sBody);
        out.supabase_probe_pgrst_code = (parsed && typeof parsed === 'object' && 'code' in parsed)
          ? (parsed as { code?: string }).code ?? null : null;
        out.supabase_probe_category = sr.ok ? 'SUPABASE_READ_OK' : 'SUPABASE_ERROR_RESPONSE';
      } catch {
        out.supabase_probe_category = 'SUPABASE_INVALID_JSON';
      }
    } catch (err) {
      out.supabase_probe_category = 'SUPABASE_TRANSPORT_ERROR';
      out.supabase_transport_error = err instanceof Error ? err.message : String(err);
    }
  } else {
    out.supabase_probe_category = 'SUPABASE_CONFIG_MISSING';
  }

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
