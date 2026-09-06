import { supabaseBaseUrl } from '../_shared/supabase-url';

type Env = {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  T2_BRIDGE_SHARED_SECRET: string;
  T2_BRIDGE_ACTOR_ID: string;
};

type RpcResult = { httpOk: boolean; status: number; body: any };

const json = (data: unknown, init?: ResponseInit) => Response.json(data, init);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sha256 = /^[0-9a-f]{64}$/i;
const safeInteger = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
const numberValue = (v: unknown) => {
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v));
};
const asNumber = (v: unknown) => Number(v);

/**
 * Proyeksiya xeshi qator soni emas. Stable id, canonical version va qiymat
 * o'zgarsa xesh ham o'zgaradi; bu echo-loop himoyasi, biznes identity emas.
 */
export async function projectionHash(rows: readonly Record<string, unknown>[]) {
  const canonical = rows.map((row) => [
    row.t2_entity_id ?? row.qator_id,
    row.t2_entity_version ?? null,
    row.kod ?? null,
    row.nom ?? null,
    row.birlik ?? null,
    row.fakt_hajm ?? null,
    row.f2_mumkin_hajm ?? null,
  ]);
  const bytes = new TextEncoder().encode(JSON.stringify(canonical));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function rpc(env: Env, fn: string, body: Record<string, unknown>): Promise<RpcResult> {
  const response = await fetch(`${supabaseBaseUrl(env.SUPABASE_URL)}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${env.SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const bodyJson = await response.json().catch(() => ({ ok: false, code: 'SUPABASE_JSON_INVALID' }));
  return { httpOk: response.ok, status: response.status, body: bodyJson };
}

async function rest(env: Env, path: string): Promise<{ ok: boolean; status: number; body: any }> {
  const response = await fetch(`${supabaseBaseUrl(env.SUPABASE_URL)}/rest/v1/${path}`, {
    headers: { apikey: env.SUPABASE_KEY, Authorization: `Bearer ${env.SUPABASE_KEY}` },
  });
  return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
}

/** Bridge secret is not a tenant boundary by itself. Resolve the object,
 * verify its company through the canonical membership guard, then read it. */
async function verifyObjectAccess(env: Env, objectId: number, actorId: number) {
  const object = await rest(env, `t2_obyekt?id=eq.${objectId}&select=id,kompaniya_id&limit=1`);
  const row = Array.isArray(object.body) ? object.body[0] : null;
  const companyId = Number(row?.kompaniya_id);
  if (!object.ok || !row || !safeInteger(companyId)) return { ok: false, status: 404, code: 'OBYEKT_NOT_FOUND' } as const;
  const access = await rpc(env, 't2_actor_kompaniya_azo_tekshir', {
    p_kompaniya_id: companyId,
    p_actor_id: actorId,
  });
  if (!access.httpOk) return { ok: false, status: 403, code: 'BRIDGE_ACTOR_FORBIDDEN' } as const;
  return { ok: true, companyId } as const;
}

async function projectionPull(env: Env, objectId: number, actorId: number, previousHash: string) {
  const access = await verifyObjectAccess(env, objectId, actorId);
  if (!access.ok) return json({ ok: false, code: access.code }, { status: access.status });

  const [state, versions] = await Promise.all([
    rest(env, `t2_qator_holat?obyekt_id=eq.${objectId}&order=qator_id.asc&limit=200000&select=qator_id,kod,nom,birlik,fakt_hajm,f2_mumkin_hajm`),
    rest(env, `t2_qator?obyekt_id=eq.${objectId}&order=id.asc&limit=200000&select=id,versiya`),
  ]);
  if (!state.ok || !Array.isArray(state.body)) return json({ ok: false, code: 'PROJECTION_READ_FAILED' }, { status: 502 });
  if (!versions.ok || !Array.isArray(versions.body)) return json({ ok: false, code: 'QATOR_VERSION_UNAVAILABLE' }, { status: 502 });

  const versionsById = new Map<number, number>(versions.body.map((row: any) => [Number(row.id), Number(row.versiya)]));
  const rows = state.body.map((row: any) => ({
    ...row,
    t2_entity_id: row.qator_id,
    t2_entity_version: versionsById.get(Number(row.qator_id)),
  }));
  if (rows.some((row: any) => !safeInteger(Number(row.t2_entity_id)) || !Number.isSafeInteger(row.t2_entity_version) || row.t2_entity_version < 1)) {
    return json({ ok: false, code: 'QATOR_VERSION_UNAVAILABLE' }, { status: 502 });
  }
  const hash = await projectionHash(rows);
  return json({
    ok: true,
    changed: hash !== previousHash,
    projection_hash: hash,
    headers: ['kod', 'nom', 'birlik', 'fakt_hajm', 'f2_mumkin_hajm'],
    rows,
    company_id: access.companyId,
  });
}

function requireUuid(payload: any) {
  return uuid.test(String(payload?.operation_id || ''));
}

async function canonicalCommand(env: Env, actorId: number, action: string, payload: any) {
  if (!requireUuid(payload)) return json({ ok: false, code: 'OPERATION_ID_REQUIRED' }, { status: 400 });
  const companyId = Number(payload.kompaniya_id);
  const documentId = Number(payload.document_id);
  if (!safeInteger(companyId) || !safeInteger(documentId)) return json({ ok: false, code: 'DOCUMENT_CONTEXT_REQUIRED' }, { status: 400 });

  const common = { p_kompaniya_id: companyId, p_actor_id: actorId, p_document_id: documentId };
  if (action === 'replica.rename') {
    const name = String(payload.new_name || '').replace(/[\\/\u0000-\u001f]/g, '_').trim().slice(0, 180);
    if (!name) return json({ ok: false, code: 'DOCUMENT_NAME_REQUIRED' }, { status: 400 });
    return json((await rpc(env, 't2_document_replica_rename_v1', {
      ...common, p_drive_file_id: String(payload.drive_file_id || ''), p_new_name: name,
      p_drive_revision: String(payload.drive_revision || ''),
    })).body);
  }
  if (action === 'replica.move') {
    const baseVersion = Number(payload.base_version);
    const parent = String(payload.new_parent_id || '').trim();
    if (!Number.isSafeInteger(baseVersion) || baseVersion < 1 || !parent) return json({ ok: false, code: 'REPLICA_CONTEXT_INVALID' }, { status: 400 });
    return json((await rpc(env, 't2_document_replica_move_v1', {
      ...common, p_drive_file_id: String(payload.drive_file_id || ''), p_new_parent_id: parent,
      p_base_version: baseVersion,
    })).body);
  }
  if (action === 'replica.deleted') {
    return json((await rpc(env, 't2_document_replica_deleted_v1', {
      ...common, p_drive_file_id: String(payload.drive_file_id || ''),
    })).body);
  }
  if (action === 'replica.content') {
    const size = Number(payload.new_size);
    const baseVersion = Number(payload.base_version);
    if (!sha256.test(String(payload.new_sha256 || '')) || !Number.isSafeInteger(size) || size < 1 ||
        !Number.isSafeInteger(baseVersion) || baseVersion < 1 || !String(payload.new_r2_key || '').trim()) {
      return json({ ok: false, code: 'REPLICA_CONTEXT_INVALID' }, { status: 400 });
    }
    return json((await rpc(env, 't2_document_replica_content_v1', {
      ...common, p_new_r2_key: String(payload.new_r2_key), p_new_sha256: String(payload.new_sha256).toLowerCase(),
      p_new_size: size, p_drive_revision: String(payload.drive_revision || ''), p_base_version: baseVersion,
    })).body);
  }
  if (action === 'sheets.writeback') {
    const field = String(payload.field || '');
    const baseVersion = Number(payload.base_version);
    const entityId = String(payload.sheets_entity_id || '').trim();
    if (!['original_filename', 'document_type'].includes(field) || !entityId || /^\d+$/.test(entityId) ||
        !Number.isSafeInteger(baseVersion) || baseVersion < 1) {
      return json({ ok: false, code: 'SHEETS_WRITEBACK_NOT_ALLOWED' }, { status: 400 });
    }
    return json((await rpc(env, 't2_document_sheets_writeback_v1', {
      ...common, p_sheets_entity_id: entityId, p_field: field, p_new_value: String(payload.new_value || ''),
      p_base_version: baseVersion, p_operation_id: payload.operation_id,
    })).body);
  }
  return json({ ok: false, code: 'ACTION_NOT_ALLOWED' }, { status: 400 });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const secret = String(ctx.env.T2_BRIDGE_SHARED_SECRET || '');
  const provided = String(ctx.request.headers.get('X-T2-Bridge-Secret') || '');
  if (!secret || !provided || provided.length !== secret.length ||
      ![...provided].every((char, index) => char === secret[index])) {
    return json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const actorId = Number(ctx.env.T2_BRIDGE_ACTOR_ID);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) return json({ ok: false, code: 'BRIDGE_ACTOR_CONFIG_REQUIRED' }, { status: 500 });
  const input = await ctx.request.json<any>().catch(() => null);
  const payload = input?.payload || {};
  const action = String(input?.action || '');

  if (action === 'projection.pull') {
    const objectId = Number(payload.obyekt_id);
    if (!safeInteger(objectId)) return json({ ok: false, code: 'OBYEKT_ID_INVALID' }, { status: 400 });
    return projectionPull(ctx.env, objectId, actorId, String(payload.projection_hash || ''));
  }
  if (action === 'fakt.write') {
    const objectId = Number(payload.obyekt_id);
    const qatorId = Number(payload.qator_id);
    if (!safeInteger(objectId) || !safeInteger(qatorId) || !numberValue(payload.base_fakt_hajm) || !numberValue(payload.fakt_hajm)) {
      return json({ ok: false, code: 'FAKT_INPUT_INVALID' }, { status: 400 });
    }
    const access = await verifyObjectAccess(ctx.env, objectId, actorId);
    if (!access.ok) return json({ ok: false, code: access.code }, { status: access.status });
    return json((await rpc(ctx.env, 't2_fakt_belgila_v2', {
      p_obyekt_id: objectId,
      p_qator_id: qatorId,
      p_expected_fakt_hajm: asNumber(payload.base_fakt_hajm),
      p_yangi_fakt_hajm: asNumber(payload.fakt_hajm),
      p_sana: new Date().toISOString().slice(0, 10),
      p_actor_id: actorId,
      p_operation_id: payload.operation_id,
      p_izoh: 'T2 Google Bridge Fakt',
      p_actor_label: 't2-bridge',
    })).body);
  }
  if (['replica.rename', 'replica.move', 'replica.content', 'replica.deleted', 'sheets.writeback'].includes(action)) {
    return canonicalCommand(ctx.env, actorId, action, payload);
  }
  return json({ ok: false, code: 'ACTION_NOT_ALLOWED' }, { status: 400 });
};
