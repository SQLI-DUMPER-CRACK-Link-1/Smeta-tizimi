/**
 * system-control.ts — CTRL-001 System Control Center canonical transport.
 * session -> actor -> Supabase RPC. No Drive/Sheets/GAS on this path.
 *
 *   GET  /api/system-control?kompaniya_id=<n>[&loyiha_id=<n>]     read model
 *   POST /api/system-control   { action, ... }                    audited command
 *
 * actorId ALWAYS comes from the verified session — never from the request body.
 * Commands: capability_override_set | capability_killswitch | job_control | deploy_state_set
 */
import { tekshir } from '../_shared/auth';

type Env = { SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string };

const RPC = {
  read: 't2_system_control_v1',
  capability_override_set: 't2_capability_override_set_v1',
  capability_killswitch: 't2_capability_killswitch_v1',
  job_control: 't2_job_control_v1',
  deploy_state_set: 't2_deploy_state_set_v1',
} as const;

async function callRpc(env: Env, name: string, body: unknown) {
  const r = await fetch(env.SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + env.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* keep raw */ }
  return { r, j, text };
}

function httpStatusFor(code: string, raw: string): number {
  if (code === 'COMPANY_NOT_FOUND' || code === 'CAPABILITY_NOT_FOUND') return 404;
  if (/actor|a'zo|azo|membership|PERMISSION_DENIED/i.test(code + raw)) return 403;
  if (code === 'STALE_VERSION') return 409;
  if (code === 'OPERATION_ID_REQUIRED' || code === 'CONTROL_SCOPE_INVALID') return 400;
  if (code === 'KILLSWITCH_ACTIVE' || code === 'JOB_NOT_PAUSABLE') return 422;
  return 502;
}

async function actorFromSession(ctx: any): Promise<{ actorId: number } | Response> {
  const sess = await tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
  if (!sess) return Response.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  const actorId = (sess as any).foydalanuvchi_id;
  if (actorId == null) return Response.json({ ok: false, code: 'AUTH_REQUIRED', xato: 'Sessiyada foydalanuvchi yo‘q — qayta kiring' }, { status: 401 });
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) return Response.json({ ok: false, code: 'CONFIG' }, { status: 500 });
  return { actorId };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  try {
    const a = await actorFromSession(ctx);
    if (a instanceof Response) return a;
    const url = new URL(ctx.request.url);
    const kompaniyaId = Number(url.searchParams.get('kompaniya_id'));
    if (!kompaniyaId) return Response.json({ ok: false, code: 'COMPANY_CONTEXT_REQUIRED' }, { status: 400 });
    const loyihaRaw = url.searchParams.get('loyiha_id');
    const loyihaId = loyihaRaw ? Number(loyihaRaw) : null;

    const { r, j, text } = await callRpc(ctx.env, RPC.read, { p_kompaniya_id: kompaniyaId, p_actor_id: a.actorId, p_loyiha_id: loyihaId });
    if (!r.ok || !j || j.ok !== true) {
      const code = (j && j.code) || 'SYSTEM_CONTROL_FAILED';
      return Response.json({ ok: false, code, xato: (j && j.message) || text.slice(0, 200) }, { status: httpStatusFor(code, text) });
    }
    return Response.json(j);
  } catch (err: any) {
    return Response.json({ ok: false, code: 'SYSTEM_CONTROL_FAILED', xato: String(err?.message || err) }, { status: 500 });
  }
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const a = await actorFromSession(ctx);
    if (a instanceof Response) return a;
    const bodyIn: any = await ctx.request.json().catch(() => ({}));
    const action: string = bodyIn?.action;
    if (!action || !(action in RPC) || action === 'read') {
      return Response.json({ ok: false, code: 'CONTROL_ACTION_INVALID' }, { status: 400 });
    }
    // operation_id: accept a client-supplied uuid for idempotency, else mint one
    const opId: string = typeof bodyIn.operation_id === 'string' && bodyIn.operation_id ? bodyIn.operation_id : crypto.randomUUID();

    let rpcBody: Record<string, unknown>;
    if (action === 'capability_override_set') {
      rpcBody = {
        p_actor_id: a.actorId, p_kod: String(bodyIn.kod ?? ''), p_scope: String(bodyIn.scope ?? ''),
        p_scope_id: bodyIn.scope_id == null ? null : Number(bodyIn.scope_id),
        p_holat: String(bodyIn.holat ?? ''), p_sabab: bodyIn.sabab == null ? null : String(bodyIn.sabab),
        p_expected_version: bodyIn.expected_version == null ? null : Number(bodyIn.expected_version),
        p_operation_id: opId,
      };
    } else if (action === 'capability_killswitch') {
      rpcBody = {
        p_actor_id: a.actorId, p_kod: String(bodyIn.kod ?? ''), p_on: bodyIn.on === true,
        p_sabab: bodyIn.sabab == null ? null : String(bodyIn.sabab), p_operation_id: opId,
      };
    } else if (action === 'job_control') {
      rpcBody = {
        p_actor_id: a.actorId, p_job_kod: String(bodyIn.job_kod ?? ''), p_action: String(bodyIn.job_action ?? ''),
        p_operation_id: opId,
      };
    } else { // deploy_state_set
      rpcBody = {
        p_actor_id: a.actorId,
        p_main_sha: bodyIn.main_sha == null ? null : String(bodyIn.main_sha),
        p_frontend_deploy_id: bodyIn.frontend_deploy_id == null ? null : String(bodyIn.frontend_deploy_id),
        p_gas_deploy_version: bodyIn.gas_deploy_version == null ? null : String(bodyIn.gas_deploy_version),
        p_db_migration_head: bodyIn.db_migration_head == null ? null : String(bodyIn.db_migration_head),
        p_operation_id: opId,
      };
    }

    const { r, j, text } = await callRpc(ctx.env, (RPC as any)[action], rpcBody);
    if (!r.ok || !j || j.ok !== true) {
      const code = (j && j.code) || 'CONTROL_COMMAND_FAILED';
      return Response.json({ ok: false, code, xato: (j && j.xato) || (j && j.message) || text.slice(0, 200), versiya: j?.versiya }, { status: httpStatusFor(code, text) });
    }
    return Response.json({ ...j, operation_id: opId });
  } catch (err: any) {
    return Response.json({ ok: false, code: 'CONTROL_COMMAND_FAILED', xato: String(err?.message || err) }, { status: 500 });
  }
};
