/**
 * company.ts — COMPANY / AUTH / DIRECTOR canonical transport.
 * session -> actor -> Supabase RPC. Actor id ALWAYS from the verified session.
 *
 *   GET  /api/company?me=1                     -> t2_men_v1 (identity + memberships)
 *   POST /api/company { action, ... }          -> audited onboarding command
 *        action: create | member_add | member_role | member_remove
 *
 * No Drive/Sheets/GAS. No fake subscription/payment.
 */
import { tekshir } from '../_shared/auth';
import { supabaseBaseUrl } from '../_shared/supabase-url';
import { xavfsizXato } from '../_shared/xato';

type Env = { SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string };

const RPC = {
  me: 't2_men_v1',
  create: 't2_kompaniya_yarat_v1',
  member_add: 't2_azolik_qosh_v1',
  member_role: 't2_azolik_rol_ozgartir_v1',
  member_remove: 't2_azolik_ochir_v1',
} as const;

async function callRpc(env: Env, name: string, body: unknown) {
  const r = await fetch(supabaseBaseUrl(env.SUPABASE_URL) + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + env.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* keep raw */ }
  return { r, j, text };
}

function statusFor(code: string, raw: string): number {
  if (code === 'ACTOR_NOT_FOUND' || code === 'COMPANY_NOT_FOUND' || code === 'MEMBERSHIP_NOT_FOUND' || code === 'REQUEST_NOT_FOUND') return 404;
  if (/42501|direktor|a'zo|azo|membership|PERMISSION/i.test(code + raw)) return 403;
  if (code === 'OPERATION_ID_REQUIRED' || /INVALID|REQUIRED/.test(code)) return 400;
  if (code === 'ALREADY_MEMBER' || code === 'LAST_DIRECTOR') return 409;
  return 502;
}

async function actor(ctx: any): Promise<{ id: number } | Response> {
  const sess = await tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
  if (!sess) return Response.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  const id = (sess as any).foydalanuvchi_id;
  if (id == null) return Response.json({ ok: false, code: 'AUTH_REQUIRED', xato: 'Sessiyada foydalanuvchi yo‘q — qayta kiring' }, { status: 401 });
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) return Response.json({ ok: false, code: 'CONFIG' }, { status: 500 });
  return { id };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const a = await actor(ctx);
    if (a instanceof Response) return a;
    const { r, j, text } = await callRpc(ctx.env, RPC.me, { p_actor_id: a.id });
    if (!r.ok || !j || j.ok !== true) {
      const domCode = j && typeof j === 'object' && 'code' in j ? String((j as any).code) : '';
      // Domen javobi (ACTOR_NOT_FOUND / AUTH_REQUIRED) — xavfsiz, frontendga o'tkazamiz.
      if (domCode === 'ACTOR_NOT_FOUND' || domCode === 'AUTH_REQUIRED') {
        return Response.json({ ok: false, code: domCode }, { status: statusFor(domCode, text) });
      }
      // HTTP / PGRST xatosi (kalit roli, funksiya ruxsati, URL) — SERVER CONFIG.
      console.error('[company me] t2_men_v1', r.status, text.slice(0, 300));
      return Response.json({ ok: false, code: 'CONFIG',
        xato: 'Kompaniya ma’lumoti serveri sozlamasida nosozlik. Administrator bilan bog‘laning.' },
        { status: 502 });
    }
    return Response.json(j);
  } catch (err: any) {
    return xavfsizXato('UPSTREAM', 500, err?.message || String(err));
  }
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const a = await actor(ctx);
    if (a instanceof Response) return a;
    const b: any = await ctx.request.json().catch(() => ({}));
    const action: string = b?.action;
    if (!action || !(action in RPC) || action === 'me') {
      return Response.json({ ok: false, code: 'COMPANY_ACTION_INVALID' }, { status: 400 });
    }
    const opId: string = typeof b.operation_id === 'string' && b.operation_id ? b.operation_id : crypto.randomUUID();

    let body: Record<string, unknown>;
    if (action === 'create') {
      body = { p_actor_id: a.id, p_nom: String(b.nom ?? ''), p_inn: b.inn == null ? null : String(b.inn), p_telefon: b.telefon == null ? null : String(b.telefon), p_operation_id: opId };
    } else if (action === 'member_add') {
      body = { p_actor_id: a.id, p_kompaniya_id: Number(b.kompaniya_id), p_login: String(b.login ?? ''), p_rol: String(b.rol ?? ''), p_email: b.email == null ? null : String(b.email), p_ism: b.ism == null ? null : String(b.ism), p_operation_id: opId };
    } else if (action === 'member_role') {
      body = { p_actor_id: a.id, p_azolik_id: Number(b.azolik_id), p_yangi_rol: String(b.rol ?? ''), p_operation_id: opId };
    } else { // member_remove
      body = { p_actor_id: a.id, p_azolik_id: Number(b.azolik_id), p_operation_id: opId };
    }

    const { r, j, text } = await callRpc(ctx.env, (RPC as any)[action], body);
    if (!r.ok || !j || j.ok !== true) {
      const code = (j && j.code) || 'COMPANY_COMMAND_FAILED';
      // Domen xato kodlari (LAST_DIRECTOR, ALREADY_MEMBER, ROLE_INVALID, ...) frontendga kerak — ular xavfsiz.
      const known = code && code !== 'COMPANY_COMMAND_FAILED';
      if (known) return Response.json({ ok: false, code }, { status: statusFor(code, text) });
      return xavfsizXato('UPSTREAM', statusFor(code, text), text);
    }
    return Response.json({ ...j, operation_id: opId });
  } catch (err: any) {
    return xavfsizXato('UPSTREAM', 500, err?.message || String(err));
  }
};
