/**
 * f2-moslash.ts — DRAFT, T2-GAS-EXIT-001 Step 3/4 illustration. NOT REVIEWED,
 * NOT WIRED into any UI hook yet (no `useF2*` hook or page calls this route).
 * Adding this file is enough for Cloudflare Pages to auto-route
 * `POST /api/f2-moslash` on the NEXT deploy that includes it (Pages
 * Functions route by file path) — review auth/authorization here carefully
 * before that deploy, same as any other write-capable endpoint.
 *
 * What this proves: the ported deterministic engine
 * (`frontend/src/lib/f2-match-engine`) can run behind Cloudflare instead of
 * GAS, session/tenant-checked the same way every other canonical endpoint
 * is (see `hujjat-nazorat.ts`).
 *
 * What this does NOT solve yet (see `ops/handoff/T2_GAS_EXIT_001.md` §Remaining):
 *   - `aktTree`/`lrvTree` still arrive as request-body JSON, built by
 *     whatever the caller already has (today: GAS's `apiF2FaylOqi` /
 *     `apiHolatOl`). Sourcing `lrvTree` from a canonical Supabase read model
 *     instead of GAS/Sheets is separate, undesigned work.
 *   - No job/draft persistence — a 50k-row request is still one synchronous
 *     call. The resumable job model (owner requirement §5) does not exist
 *     yet; this endpoint is only safe to actually use at small/medium scale
 *     until that lands.
 *   - No R2/file-upload path — this endpoint expects already-parsed trees,
 *     not a raw uploaded workbook.
 *
 * Do not add a `useF2*` hook calling this route, and do not remove any
 * existing GAS-backed F2 path, until the remaining scope above is designed
 * and reviewed — this file is evidence for the design, not a cutover.
 */
import { f2MatchEngine } from '../../src/lib/f2-match-engine';
import type { AktNode, F2MatchOptions, LrvNode } from '../../src/lib/f2-match-engine';
import { tekshir } from '../_shared/auth';

type Env = { SESSIYA_KALIT: string };

interface F2MoslashBody {
  aktTree?: AktNode[];
  lrvTree?: LrvNode[];
  opts?: F2MatchOptions;
}

const MAX_LRV_LEAVES = 20_000; // conservative ceiling until the job model (§5) exists — see file header

function countLeaves(nodes: LrvNode[] | undefined): number {
  let n = 0;
  (nodes || []).forEach((node) => {
    if (node.type !== 'rz') n++;
    n += countLeaves(node.children);
  });
  return n;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.SESSIYA_KALIT) {
    return Response.json({ ok: false, code: 'CONFIG' }, { status: 500 });
  }
  const sess = await tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
  const actorId = sess && (sess as unknown as { foydalanuvchi_id?: unknown }).foydalanuvchi_id;
  if (actorId == null) {
    return Response.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  let body: F2MoslashBody;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ ok: false, code: 'BAD_JSON' }, { status: 400 });
  }
  if (!body.aktTree || !body.lrvTree) {
    return Response.json({ ok: false, code: 'MISSING_TREE' }, { status: 400 });
  }

  const leaves = countLeaves(body.lrvTree);
  if (leaves > MAX_LRV_LEAVES) {
    return Response.json({
      ok: false, code: 'TOO_LARGE_FOR_SYNCHRONOUS_PATH',
      xabar: `LRV daraxtida ${leaves} qator (limit ${MAX_LRV_LEAVES}) — bu ko'lamda ishlash uchun hali resumable job modeli yo'q (ops/handoff/T2_GAS_EXIT_001.md §5).`,
    }, { status: 422 });
  }

  const t0 = Date.now();
  const result = f2MatchEngine(body.aktTree, body.lrvTree, body.opts);
  return Response.json({ ok: true, ...result, ms: Date.now() - t0 });
};
