import { describe, expect, it } from 'vitest';
import {
  AGENT_TOOLS,
  T2_AGENT_API_VERSION,
  parseAgentKeyring,
  parseAgentToolCall,
  scopeAllowed,
} from '../../functions/_shared/agent-connector';

describe('Tizim_02 external agent connector contract', () => {
  it('faqat tanlangan tool va aniq tenant/object doirasini beradi', () => {
    const [agent] = parseAgentKeyring(JSON.stringify([{
      id: 'cloudflare-analyst', secret: 'x'.repeat(32),
      tools: ['t2.company_overview.v1'], kompaniya_ids: [7], obyekt_ids: [101],
    }]));
    expect(agent.tools).toEqual(['t2.company_overview.v1']);
    expect(scopeAllowed(agent, 'kompaniya_ids', 7)).toBe(true);
    expect(scopeAllowed(agent, 'kompaniya_ids', 8)).toBe(false);
    expect(scopeAllowed(agent, 'obyekt_ids', 101)).toBe(true);
  });

  it('generic SQL yoki yozuvchi toolni kontraktga kiritmaydi', () => {
    expect(Object.keys(AGENT_TOOLS)).toEqual([
      't2.company_overview.v1',
      't2.object_context.v1',
    ]);
    expect(parseAgentToolCall({
      version: T2_AGENT_API_VERSION, request_id: 'request-123',
      tool: 'sql.execute', arguments: { sql: 'delete from t2_qator' },
    }).ok).toBe(false);
  });
});

