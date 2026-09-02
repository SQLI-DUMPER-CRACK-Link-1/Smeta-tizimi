import {
  AGENT_TOOLS,
  parseAgentToolCall,
  scopeAllowed,
  toolAllowed,
  validateAgentToolArguments,
  verifyAgentRequest,
} from '../../_shared/agent-connector';
import { supabaseBaseUrl } from '../../_shared/supabase-url';

type Env = {
  T2_AGENT_KEYS_JSON?: string;
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
};

const MAX_BODY_BYTES = 32_768;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function problem(status: number, code: string, message: string) {
  return json({ ok: false, code, xabar: message }, status);
}

async function readRpc(env: Env, rpc: string, parameter: string, id: number): Promise<unknown> {
  const url = supabaseBaseUrl(env.SUPABASE_URL) +
    '/rest/v1/rpc/' + rpc + '?' + new URLSearchParams({ [parameter]: String(id) });
  const response = await fetch(url, {
    headers: { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + env.SUPABASE_KEY },
  });
  if (!response.ok) throw new Error('read_rpc_failed');
  return response.json();
}

/**
 * External-agent execution point. There is deliberately no generic SQL,
 * provider key, write operation, or unscoped tenant query in this route.
 */
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.T2_AGENT_KEYS_JSON) {
    return problem(503, 'agent_connector_unconfigured', 'Agent connector sozlanmagan');
  }
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY) {
    return problem(503, 'data_source_unconfigured', 'Ma\'lumot manbai sozlanmagan');
  }
  const contentType = ctx.request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return problem(415, 'content_type_invalid', 'application/json talab qilinadi');
  }
  const rawBody = await ctx.request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return problem(413, 'request_too_large', 'Agent so\'rovi juda katta');
  }
  const auth = await verifyAgentRequest(ctx.request, rawBody, ctx.env.T2_AGENT_KEYS_JSON);
  if (!auth.ok) return problem(auth.status, auth.code, auth.message);

  let input: unknown;
  try { input = JSON.parse(rawBody); }
  catch { return problem(400, 'request_invalid', 'Noto\'g\'ri JSON so\'rov'); }
  const parsed = parseAgentToolCall(input);
  if (!parsed.ok) return problem(400, 'request_invalid', parsed.message);
  const { call } = parsed;
  if (!toolAllowed(auth.principal, call.tool)) {
    return problem(403, 'tool_forbidden', 'Bu agent uchun tool ruxsat etilmagan');
  }

  const tool = AGENT_TOOLS[call.tool];
  const argumentsCheck = validateAgentToolArguments(call.tool, call.arguments);
  if (!argumentsCheck.ok) return problem(400, 'request_invalid', argumentsCheck.message);
  const id = argumentsCheck.id;
  if (!scopeAllowed(auth.principal, tool.scope, id)) {
    return problem(403, 'tenant_forbidden', 'Bu ma\'lumot doirasiga ruxsat yo\'q');
  }

  try {
    const data = tool.scope === 'kompaniya_ids'
      ? await readRpc(ctx.env, tool.sourceRpc, 'p_kompaniya_id', id)
      : await readRpc(ctx.env, tool.sourceRpc, 'p_obyekt_id', id);
    return json({
      ok: true,
      request_id: call.request_id,
      tool: call.tool,
      data,
      meta: { read_only: true, source: tool.sourceRpc, scope: tool.scope },
    });
  } catch {
    return problem(502, 'data_source_failed', 'Ma\'lumot manbasi javob bermadi');
  }
};
