import { supabaseBaseUrl } from '../_shared/supabase-url';

type Env = { SUPABASE_URL: string; SUPABASE_KEY: string; T2_BRIDGE_SHARED_SECRET: string; T2_BRIDGE_ACTOR_ID: string };
const json = (data: unknown, init?: ResponseInit) => Response.json(data, init);
const equal = (a: string, b: string) => a.length === b.length && [...a].reduce((same, char, i) => same & (char.charCodeAt(0) === b.charCodeAt(i) ? 1 : 0), 1) === 1;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function rpc(env: Env, fn: string, body: Record<string, unknown>) {
  const response = await fetch(`${supabaseBaseUrl(env.SUPABASE_URL)}/rest/v1/rpc/${fn}`, { method:'POST', headers:{ apikey:env.SUPABASE_KEY, Authorization:`Bearer ${env.SUPABASE_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify(body) });
  const data = await response.json().catch(() => ({ ok:false, code:'SUPABASE_JSON_INVALID' }));
  return response.ok ? data : { ok:false, code:'SUPABASE_ERROR' };
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const secret = String(ctx.env.T2_BRIDGE_SHARED_SECRET || '');
  if (!secret || !equal(String(ctx.request.headers.get('X-T2-Bridge-Secret') || ''), secret)) return json({ ok:false, code:'UNAUTHORIZED' }, { status:401 });
  const actorId = Number(ctx.env.T2_BRIDGE_ACTOR_ID);
  if (!Number.isSafeInteger(actorId) || actorId <= 0) return json({ ok:false, code:'BRIDGE_ACTOR_CONFIG_REQUIRED' }, { status:500 });
  const input = await ctx.request.json<any>().catch(() => null);
  const payload = input?.payload || {};
  const objectId = Number(payload.obyekt_id);
  if (!Number.isSafeInteger(objectId) || objectId <= 0) return json({ ok:false, code:'OBYEKT_ID_INVALID' }, { status:400 });
  if (input?.action === 'projection.pull') {
    const url = `${supabaseBaseUrl(ctx.env.SUPABASE_URL)}/rest/v1/t2_qator_holat?obyekt_id=eq.${objectId}&order=qator_id.asc&select=qator_id,kod,nom,birlik,fakt_hajm,f2_mumkin_hajm`;
    const response = await fetch(url, { headers:{apikey:ctx.env.SUPABASE_KEY,Authorization:`Bearer ${ctx.env.SUPABASE_KEY}`} });
    const rows = await response.json().catch(() => []) as any[];
    if (!response.ok) return json({ok:false,code:'PROJECTION_READ_FAILED'}, {status:502});
    
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    const str = JSON.stringify(rows);
    for (let i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    const projectionHash = (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    
    if (payload.projection_hash === projectionHash) return json({ ok:true, changed:false });
    return json({ ok:true, changed:true, projection_hash:projectionHash, headers:['kod','nom','birlik','fakt_hajm','f2_mumkin_hajm'], rows:rows.map((r:any) => ({...r,t2_entity_id:r.qator_id,t2_entity_version:r.fakt_hajm})) });
  }
  if (input?.action === 'fakt.write') {
    if (!uuid.test(String(payload.operation_id || ''))) return json({ok:false,code:'OPERATION_ID_REQUIRED'},{status:400});
    const qatorId=Number(payload.qator_id), expected=Number(payload.base_fakt_hajm), next=Number(payload.fakt_hajm);
    if (![qatorId,expected,next].every(Number.isFinite)) return json({ok:false,code:'FAKT_INPUT_INVALID'},{status:400});
    return json(await rpc(ctx.env,'t2_fakt_belgila_v2',{p_obyekt_id:objectId,p_qator_id:qatorId,p_expected_fakt_hajm:expected,p_yangi_fakt_hajm:next,p_sana:new Date().toISOString().slice(0,10),p_actor_id:actorId,p_operation_id:payload.operation_id,p_izoh:'T2 Google Bridge Fakt',p_actor_label:'t2-bridge'}));
  }
  return json({ok:false,code:'ACTION_NOT_ALLOWED'},{status:400});
};
