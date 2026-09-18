import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost } from '../../functions/api/agent/call';
import { T2_AGENT_API_VERSION, agentSignatureForTest } from '../../functions/_shared/agent-connector';

const SECRET = 's'.repeat(32);
const KEYS = JSON.stringify([{
  id: 'hermes-tenant-7',
  secret: SECRET,
  roles: ['smeta_analyst'],
  tenant_id: 7,
  tools: ['t2.company_overview.v1', 't2.object_context.v1', 't2.mindmap_graph.v1'],
  kompaniya_ids: [7],
  obyekt_ids: [101],
  obyekt_tenant_ids: { '101': 7 },
}]);

async function requestFor(body: Record<string, unknown>) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const path = '/api/agent/call';
  const signature = await agentSignatureForTest({
    secret: SECRET,
    agentId: 'hermes-tenant-7',
    timestamp,
    method: 'POST',
    path,
    body: rawBody,
  });
  return new Request('https://example.test' + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-t2-agent-id': 'hermes-tenant-7',
      'x-t2-timestamp': timestamp,
      'x-t2-signature': signature,
    },
    body: rawBody,
  });
}

describe('agent call route', () => {
  const originalFetch = globalThis.fetch;
  const replayClaims = new Set<string>();

  beforeEach(() => {
    replayClaims.clear();
    globalThis.fetch = vi.fn(async (input, init) => {
      expect(init?.redirect).toBe('error');
      const url = String(input);
      if (url.includes('/rpc/t2_agent_replay_claim')) {
        const payload = JSON.parse(String(init?.body || '{}')) as { p_replay_key?: string };
        const key = payload.p_replay_key || '';
        const claimed = !replayClaims.has(key);
        if (claimed) replayClaims.add(key);
        return new Response(JSON.stringify(claimed), { status: 200 });
      }
      return new Response(JSON.stringify({
        ok: true,
        obyektlar: [],
        izoh: 'mock',
      }), { status: 200 });
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('tenant-scoped read-only RPCni chaqiradi va memory namespace qaytaradi', async () => {
    const request = await requestFor({
      version: T2_AGENT_API_VERSION,
      request_id: 'route-test-001',
      role: 'smeta_analyst',
      execution: { role: 'smeta_analyst', tenant_id: 7, conversation_id: 'chat-001' },
      tool: 't2.company_overview.v1',
      arguments: { kompaniya_id: 7 },
    });

    const response = await onRequestPost({
      request,
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.memory_namespace).toBe('tenant:7:role:smeta_analyst:conversation:chat-001');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[1][0])).toContain('/rest/v1/rpc/t2_ai_umumiy');
  });

  it('object tenant mapping mos kelmasa Supabase chaqirilmaydi', async () => {
    const request = await requestFor({
      version: T2_AGENT_API_VERSION,
      request_id: 'route-test-002',
      role: 'smeta_analyst',
      execution: { role: 'smeta_analyst', tenant_id: 7, conversation_id: 'chat-001' },
      tool: 't2.object_context.v1',
      arguments: { obyekt_id: 102 },
    });

    const response = await onRequestPost({
      request,
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe('tenant_context_mismatch');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0][0])).toContain('/rest/v1/rpc/t2_agent_replay_claim');
  });

  it('bir xil request_id besh daqiqalik oynada qayta ishlatilmaydi', async () => {
    const body = {
      version: T2_AGENT_API_VERSION,
      request_id: 'route-replay-001',
      role: 'smeta_analyst',
      execution: { role: 'smeta_analyst', tenant_id: 7, conversation_id: 'chat-001' },
      tool: 't2.company_overview.v1',
      arguments: { kompaniya_id: 7 },
    };

    const first = await onRequestPost({
      request: await requestFor(body),
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);
    const second = await onRequestPost({
      request: await requestFor(body),
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect((await second.json()).code).toBe('agent_request_replayed');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(globalThis.fetch).mock.calls.filter(([input]) =>
      String(input).includes('/rest/v1/rpc/t2_ai_umumiy'))).toHaveLength(1);
  });

  it('oversized request body authdan oldin bounded tarzda rad qilinadi', async () => {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/agent/call', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'x'.repeat(32_769),
      }),
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'https://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);
    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('request_too_large');
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('Supabase plaintext URL bilan route fail-closed ishlaydi', async () => {
    const response = await onRequestPost({
      request: new Request('https://example.test/api/agent/call', { method: 'POST' }),
      env: {
        T2_AGENT_KEYS_JSON: KEYS,
        SUPABASE_URL: 'http://supabase.example',
        SUPABASE_KEY: 'server-key',
      },
    } as never);
    expect(response.status).toBe(503);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
