/**
 * smeta-yukla.ts — T2-FINAL-CLEAN-CUTOVER P0.2: native Smeta XLSX upload,
 * off Google Drive/Sheets/GAS entirely.
 *
 * Reuses the exact same file-reading + tree-building code already proven for
 * F2 acts (`f2-import-parse`'s `readXlsx`/`f2FaylOqiCore` — F2 act files and
 * smeta files share the same rz/bl/rs/mat/ob template) via `handleFaylOqi`
 * from `f2-moslash.ts`, so parsing behavior (column auto-detect, marker
 * column, totals-row skipping, etc.) stays byte-for-byte identical between
 * the F2 and Smeta upload paths — one parser, two callers.
 *
 * POST /api/smeta-yukla  { amal: 'fayl_oqi', fileBase64, varaqNom?, colConfig? }
 *   -> delegates to handleFaylOqi (same dual-mode contract as /api/f2-moslash):
 *      no colConfig -> { mode:'config', cols, preview, hasMarker, ... };
 *      colConfig given -> { tree }.
 * POST /api/smeta-yukla  { amal: 'import', kompaniyaId, obyektId, operationId, sourceDocumentId?, tree }
 *   -> flattens the AktNode tree to local_id/parent_local_id rows and calls
 *      t2_smeta_import_bulk_v1 (service role) to write canonical
 *      RZ/BL/RS/resources into Supabase. Refuses (SMETA_ALREADY_EXISTS) if
 *      the object already has any t2_qator rows — this is a first-import-only
 *      path, never a silent replace (see the RPC's own migration comment).
 */
import type { AktNode } from '../../src/lib/f2-match-engine';
import { handleFaylOqi } from './f2-moslash';
import type { F2ColumnConfig } from '../../src/lib/f2-import-parse';
import { tekshir } from '../_shared/auth';
import { supabaseBaseUrl } from '../_shared/supabase-url';

type Env = { SUPABASE_URL: string; SUPABASE_KEY: string; SESSIYA_KALIT: string };

const MAX_ROWS = 60000;

interface FaylOqiBody {
  amal: 'fayl_oqi';
  fileBase64: string;
  varaqNom?: string;
  colConfig?: Partial<F2ColumnConfig>;
}
interface ImportBody {
  amal: 'import';
  kompaniyaId: number;
  obyektId: number;
  operationId: string;
  sourceDocumentId?: number | null;
  tree: AktNode[];
}
type SmetaYuklaBody = FaylOqiBody | ImportBody;

interface FlatRow {
  local_id: string; parent_local_id: string | null; tur: string;
  kod: string | null; nom: string | null; birlik: string | null;
  hajm: number | null; narx: number | null; summa: number | null;
}

/** AktNode tree -> flat local_id/parent_local_id rows, in document order (pre-order), matching t2_smeta_import_bulk_v1's expected payload shape. */
function flattenTree(nodes: AktNode[], parentLocalId: string | null, out: FlatRow[]): void {
  for (const node of nodes) {
    out.push({
      local_id: node.uid, parent_local_id: parentLocalId, tur: node.type,
      kod: node.kod ?? null, nom: node.nom ?? null, birlik: node.bir ?? null,
      hajm: node.hajm ?? null, narx: node.narx ?? null, summa: node.summa ?? null,
    });
    if (node.children && node.children.length) flattenTree(node.children, node.uid, out);
  }
}

async function rpc(env: Env, name: string, args: Record<string, unknown>) {
  const r = await fetch(supabaseBaseUrl(env.SUPABASE_URL) + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + env.SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const text = await r.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* keep raw */ }
  return { httpOk: r.ok, body: j, raw: text };
}

function importRpcFailure(code = 'IMPORT_RPC_FAILED', status = 502) {
  return Response.json({
    ok: false,
    code,
    xato: 'Kanonik smeta importi bajarilmadi. Birozdan so‘ng qayta urinib ko‘ring.',
  }, { status });
}

async function handleImport(env: Env, actorId: number, body: ImportBody) {
  if (!body.kompaniyaId || !body.obyektId || !body.operationId) {
    return Response.json({ ok: false, code: 'MISSING_CONTEXT' }, { status: 400 });
  }
  if (!Array.isArray(body.tree) || body.tree.length === 0) {
    return Response.json({ ok: false, code: 'MISSING_TREE' }, { status: 400 });
  }

  const rows: FlatRow[] = [];
  flattenTree(body.tree, null, rows);
  if (rows.length > MAX_ROWS) {
    return Response.json({ ok: false, code: 'TOO_MANY_ROWS', xabar: `${rows.length} qator (limit ${MAX_ROWS})` }, { status: 422 });
  }

  let res: Awaited<ReturnType<typeof rpc>>;
  try {
    res = await rpc(env, 't2_smeta_import_bulk_v1', {
      p_kompaniya_id: body.kompaniyaId, p_actor_id: actorId, p_obyekt_id: body.obyektId,
      p_operation_id: body.operationId, p_source_document_id: body.sourceDocumentId ?? null,
      p_qatorlar: rows,
    });
  } catch {
    return importRpcFailure('IMPORT_RPC_UNREACHABLE');
  }
  if (!res.httpOk || !res.body) return importRpcFailure();
  return Response.json(res.body, { status: res.body.ok ? 200 : 409 });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_KEY || !ctx.env.SESSIYA_KALIT) {
    return Response.json({ ok: false, code: 'CONFIG' }, { status: 500 });
  }
  const sess = await tekshir(ctx.request.headers.get('Cookie'), ctx.env.SESSIYA_KALIT);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actorId = sess && (sess as any).foydalanuvchi_id;
  if (actorId == null) return Response.json({ ok: false, code: 'AUTH_REQUIRED' }, { status: 401 });

  let body: SmetaYuklaBody;
  try { body = await ctx.request.json(); }
  catch { return Response.json({ ok: false, code: 'BAD_JSON' }, { status: 400 }); }

  if (body.amal === 'fayl_oqi') return handleFaylOqi(body);
  // Tenant membership/role for 'import' is enforced inside t2_smeta_import_bulk_v1
  // itself (t2_actor_kompaniya_azo_tekshir + write-role check) — same law as
  // every other canonical write RPC called from a Function via service role.
  if (body.amal === 'import') return handleImport(ctx.env, actorId, body);
  return Response.json({ ok: false, code: 'BAD_AMAL' }, { status: 400 });
};
