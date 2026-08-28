import { AGENT_TOOLS, T2_AGENT_API_VERSION } from '../../_shared/agent-connector';

/** Public, non-sensitive discovery document for Cloudflare and external agents. */
export const onRequestGet: PagesFunction = async (ctx) => {
  const callUrl = new URL('/api/agent/call', ctx.request.url).toString();
  return Response.json({
    version: T2_AGENT_API_VERSION,
    title: 'Tizim_02 Agent Tools',
    description: 'Tenant-scoped, read-only construction-system context for external AI agents.',
    call_url: callUrl,
    authentication: {
      type: 'hmac-sha256',
      required_headers: ['x-t2-agent-id', 'x-t2-timestamp', 'x-t2-signature'],
      signed_payload: 'version\\nagent_id\\ntimestamp_ms\\nmethod\\npath\\nsha256_hex(request_body)',
      clock_skew_ms: 300000,
    },
    request: {
      version: T2_AGENT_API_VERSION,
      request_id: 'caller-generated, 8–128 character stable ID',
      tool: 'one of the tool names below',
      arguments: 'tool input matching input_schema',
    },
    tools: Object.entries(AGENT_TOOLS).map(([name, tool]) => ({
      name,
      description: tool.description,
      input_schema: tool.input,
      read_only: true,
    })),
  }, { headers: { 'Cache-Control': 'public, max-age=300' } });
};

