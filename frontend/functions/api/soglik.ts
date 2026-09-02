/**
 * soglik.ts — DOIMIY sog'liq probi. Anonim, xavfsiz (secret chiqarmaydi).
 * ═══════════════════════════════════════════════════════════════════════
 * Kanonik `/api/*` gateway `SUPABASE_KEY = service_role` ni talab qiladi
 * (server-tomon actor/tenant tekshiruvi shu kalit ostida bo'ladi). Agar
 * Cloudflare env da anon/publishable kalit qo'yilsa, `t2_men_v1` va barcha
 * kanonik RPC 401/403 beradi va butun authenticated ilova buziladi —
 * lekin ANONIM smoke buni ko'rmaydi (401 = kutilgan).
 *
 * Bu endpoint aynan o'sha holatni ANONIM aniqlaydi:
 *   GET /api/soglik  ->  { ok, supabase_key_role: 'service_role'|'anon_or_low'|'unknown', ... }
 *
 * `t2_men_v1(0)` — hech qanday ma'lumotga tegmaydi (actor<=0 -> darhol
 * {ok:false,code:AUTH_REQUIRED} 200 bilan, AGAR kalit chaqira olsa).
 */
import { supabaseBaseUrl } from '../_shared/supabase-url';

type Env = { SUPABASE_URL?: string; SUPABASE_KEY?: string; SESSIYA_KALIT?: string; GAS_URL?: string };

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const out: Record<string, unknown> = {
    ok: false,
    supabase_url_set: !!ctx.env.SUPABASE_URL,
    supabase_key_set: !!ctx.env.SUPABASE_KEY,
    sessiya_kalit_set: !!ctx.env.SESSIYA_KALIT && ctx.env.SESSIYA_KALIT.trim().length >= 16,
    gas_url_set: !!ctx.env.GAS_URL,
  };

  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    out.supabase_key_role = 'unknown';
    out.tashxis = 'SUPABASE_URL yoki SUPABASE_KEY o\'rnatilmagan.';
    return Response.json(out, { status: 503 });
  }

  try {
    const r = await fetch(supabaseBaseUrl(ctx.env.SUPABASE_URL) + '/rest/v1/rpc/t2_men_v1', {
      method: 'POST',
      headers: {
        apikey: ctx.env.SUPABASE_KEY,
        Authorization: 'Bearer ' + ctx.env.SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_actor_id: 0 }),
    });
    out.canonical_rpc_http_status = r.status;
    if (r.ok) {
      out.ok = true;
      out.supabase_key_role = 'service_role';
    } else {
      out.supabase_key_role = 'anon_or_low';
      out.tashxis = 'SUPABASE_KEY kanonik RPC (t2_men_v1) ni chaqira olmadi (HTTP '
        + r.status + '). U service_role kaliti bo\'lishi kerak. Cloudflare Pages '
        + '-> Settings -> Environment variables -> SUPABASE_KEY (Production VA '
        + 'Preview), keyin qayta deploy.';
    }
  } catch (err) {
    out.supabase_key_role = 'unknown';
    out.tashxis = 'Supabase bilan aloqa yo\'q: ' + (err instanceof Error ? err.message : String(err));
    return Response.json(out, { status: 502 });
  }

  return Response.json(out, { status: out.ok ? 200 : 503 });
};
