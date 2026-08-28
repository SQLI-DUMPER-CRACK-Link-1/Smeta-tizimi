/**
 * Tizim_02 external AI-agent connector contract.
 *
 * Agents never receive Supabase, provider, or browser-session secrets.  They
 * discover a stable manifest, sign an individual read-only tool call, and are
 * limited to explicit tenant/object IDs from a server-side secret.
 */

export const T2_AGENT_API_VERSION = 't2-agent-tools/v1';
export const AGENT_MAX_CLOCK_SKEW_MS = 5 * 60_000;

export const AGENT_TOOLS = {
  't2.company_overview.v1': {
    description: 'Kompaniyadagi obyektlarning qisqa smeta, FAKT va F2 holati.',
    sourceRpc: 't2_ai_umumiy',
    scope: 'kompaniya_ids',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['kompaniya_id'],
      properties: { kompaniya_id: { type: 'integer', minimum: 1 } },
    },
  },
  't2.object_context.v1': {
    description: 'Bitta obyektning dalilli smeta, FAKT, F2 va ogohlantirish konteksti.',
    sourceRpc: 't2_ai_kontekst',
    scope: 'obyekt_ids',
    input: {
      type: 'object',
      additionalProperties: false,
      required: ['obyekt_id'],
      properties: { obyekt_id: { type: 'integer', minimum: 1 } },
    },
  },
} as const;

export type AgentToolName = keyof typeof AGENT_TOOLS;
export type AgentScopeKey = 'kompaniya_ids' | 'obyekt_ids';

type RawAgentKey = {
  id?: unknown;
  secret?: unknown;
  tools?: unknown;
  kompaniya_ids?: unknown;
  obyekt_ids?: unknown;
  not_before?: unknown;
  not_after?: unknown;
};

export type AgentPrincipal = {
  id: string;
  secret: string;
  tools: AgentToolName[];
  kompaniyaIds: number[];
  obyektIds: number[];
  notBefore?: number;
  notAfter?: number;
};

export type AgentToolCall = {
  version: typeof T2_AGENT_API_VERSION;
  request_id: string;
  tool: AgentToolName;
  arguments: Record<string, unknown>;
};

type AgentAuthResult =
  | { ok: true; principal: AgentPrincipal }
  | { ok: false; status: number; code: string; message: string };

const AGENT_ID = /^[a-z0-9][a-z0-9_-]{1,63}$/i;
const REQUEST_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/;

function positiveIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

function timestamp(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function toolNames(value: unknown): AgentToolName[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((tool): tool is AgentToolName =>
    typeof tool === 'string' && Object.prototype.hasOwnProperty.call(AGENT_TOOLS, tool)))];
}

/** Parses the secret-only keyring. Invalid entries deliberately receive no access. */
export function parseAgentKeyring(raw: string | undefined): AgentPrincipal[] {
  if (!raw) return [];
  try {
    const decoded: unknown = JSON.parse(raw);
    const entries = Array.isArray(decoded)
      ? decoded
      : decoded && typeof decoded === 'object' && Array.isArray((decoded as { agents?: unknown }).agents)
        ? (decoded as { agents: unknown[] }).agents
        : [];
    return entries.flatMap((entry): AgentPrincipal[] => {
      if (!entry || typeof entry !== 'object') return [];
      const key = entry as RawAgentKey;
      const id = typeof key.id === 'string' ? key.id.trim() : '';
      const secret = typeof key.secret === 'string' ? key.secret : '';
      if (!AGENT_ID.test(id) || secret.length < 24) return [];
      return [{
        id,
        secret,
        tools: toolNames(key.tools),
        kompaniyaIds: positiveIds(key.kompaniya_ids),
        obyektIds: positiveIds(key.obyekt_ids),
        notBefore: timestamp(key.not_before),
        notAfter: timestamp(key.not_after),
      }];
    });
  } catch {
    return [];
  }
}

export function parseAgentToolCall(input: unknown):
  | { ok: true; call: AgentToolCall }
  | { ok: false; message: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, message: 'JSON obyekt bo\'lishi kerak' };
  }
  const data = input as Record<string, unknown>;
  if (data.version !== T2_AGENT_API_VERSION) {
    return { ok: false, message: 'Qo\'llab-quvvatlanmagan agent API versiyasi' };
  }
  if (typeof data.request_id !== 'string' || !REQUEST_ID.test(data.request_id)) {
    return { ok: false, message: 'request_id 8–128 belgili bo\'lishi kerak' };
  }
  if (typeof data.tool !== 'string' || !Object.prototype.hasOwnProperty.call(AGENT_TOOLS, data.tool)) {
    return { ok: false, message: 'Tool ochiq emas' };
  }
  if (!data.arguments || typeof data.arguments !== 'object' || Array.isArray(data.arguments)) {
    return { ok: false, message: 'arguments obyekt bo\'lishi kerak' };
  }
  return {
    ok: true,
    call: {
      version: T2_AGENT_API_VERSION,
      request_id: data.request_id,
      tool: data.tool as AgentToolName,
      arguments: data.arguments as Record<string, unknown>,
    },
  };
}

export function positiveIntegerArgument(args: Record<string, unknown>, name: string): number | null {
  const value = args[name];
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

/** Mirrors the manifest's `additionalProperties:false` rule at runtime. */
export function validateAgentToolArguments(tool: AgentToolName, args: Record<string, unknown>):
  | { ok: true; id: number }
  | { ok: false; message: string } {
  const scope = AGENT_TOOLS[tool].scope;
  const name = scope === 'kompaniya_ids' ? 'kompaniya_id' : 'obyekt_id';
  if (Object.keys(args).length !== 1 || !Object.prototype.hasOwnProperty.call(args, name)) {
    return { ok: false, message: 'Tool faqat ' + name + ' argumentini qabul qiladi' };
  }
  const id = positiveIntegerArgument(args, name);
  return id
    ? { ok: true, id }
    : { ok: false, message: name + ' musbat butun son bo\'lishi kerak' };
}

export function toolAllowed(principal: AgentPrincipal, tool: AgentToolName): boolean {
  return principal.tools.includes(tool);
}

export function scopeAllowed(principal: AgentPrincipal, scope: AgentScopeKey, id: number): boolean {
  return (scope === 'kompaniya_ids' ? principal.kompaniyaIds : principal.obyektIds).includes(id);
}

async function sha256Hex(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

/**
 * Signed value: version, agent id, timestamp, method, path and SHA-256 body.
 * Read-only calls are replay-safe; timestamp bounds prevent indefinite reuse.
 */
export async function verifyAgentRequest(
  request: Request,
  rawBody: string,
  keyringJson: string | undefined,
  now = Date.now(),
): Promise<AgentAuthResult> {
  const id = request.headers.get('x-t2-agent-id')?.trim() || '';
  const timestampHeader = request.headers.get('x-t2-timestamp') || '';
  const signature = request.headers.get('x-t2-signature') || '';
  const time = Number(timestampHeader);
  if (!AGENT_ID.test(id) || !Number.isInteger(time) || Math.abs(now - time) > AGENT_MAX_CLOCK_SKEW_MS) {
    return { ok: false, status: 401, code: 'agent_auth_invalid', message: 'Agent autentifikatsiyasi yaroqsiz' };
  }
  const principal = parseAgentKeyring(keyringJson).find((agent) => agent.id === id);
  if (!principal || (principal.notBefore && now < principal.notBefore) || (principal.notAfter && now > principal.notAfter)) {
    return { ok: false, status: 403, code: 'agent_not_allowed', message: 'Agent ruxsat etilmagan' };
  }
  const bodyHash = await sha256Hex(rawBody);
  const payload = [T2_AGENT_API_VERSION, id, timestampHeader, request.method.toUpperCase(), new URL(request.url).pathname, bodyHash].join('\n');
  const expected = await hmacHex(principal.secret, payload);
  if (!/^[a-f0-9]{64}$/i.test(signature) || !sameSecret(signature.toLowerCase(), expected)) {
    return { ok: false, status: 401, code: 'agent_auth_invalid', message: 'Agent autentifikatsiyasi yaroqsiz' };
  }
  return { ok: true, principal };
}

export async function agentSignatureForTest(input: {
  secret: string; agentId: string; timestamp: string; method: string; path: string; body: string;
}): Promise<string> {
  const payload = [T2_AGENT_API_VERSION, input.agentId, input.timestamp, input.method.toUpperCase(), input.path, await sha256Hex(input.body)].join('\n');
  return hmacHex(input.secret, payload);
}
