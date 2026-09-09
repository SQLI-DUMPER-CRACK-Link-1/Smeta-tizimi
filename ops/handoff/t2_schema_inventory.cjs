#!/usr/bin/env node
/**
 * T2-PTO-CLOSURE-V1 / WP-2
 *
 * Static repository inventory for RPC call sites, migration definitions,
 * repo/live reconciliation records, and representative PTO entity contracts.
 * This intentionally does not connect to Supabase or execute SQL. A live
 * schema check belongs to an authenticated, owner-controlled lane.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const outPath = path.join(root, 'docs', 'audit', 'T2_SCHEMA_INVENTORY_2026-09.md');
const sourceRoots = [path.join(root, 'frontend', 'src'), path.join(root, 'frontend', 'functions')];
const migrationRoot = path.join(root, 'supabase', 'migrations');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(?:ts|tsx|js|cjs|mjs|sql)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function matches(text, regex) {
  const out = [];
  for (const m of text.matchAll(regex)) out.push({ name: m[1], line: lineOf(text, m.index ?? 0) });
  return out;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

const callSites = [];
const operationSites = [];
const rpcPropertySites = [];
for (const file of sourceRoots.flatMap(walk)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const hit of [
    ...matches(text, /\brpc\s*\(\s*['"`]([^'"`]+)['"`]/g),
    ...matches(text, /\brpc\s*:\s*['"`]([^'"`]+)['"`]/g),
    ...matches(text, /\bsoro\s*:\s*['"`]([^'"`]+)['"`]/g),
  ]) callSites.push({ ...hit, file: rel(file), kind: 'rpc/read-rpc' });
  for (const hit of matches(text, /\bamal\s*:\s*['"`]([^'"`]+)['"`]/g)) {
    operationSites.push({ ...hit, file: rel(file), kind: 'named-operation' });
  }
  for (const hit of matches(text, /\brpc\s*:\s*['"`]([^'"`]+)['"`]/g)) {
    rpcPropertySites.push({ ...hit, file: rel(file), kind: 'named-operation-rpc' });
  }
}

const migrationFiles = fs.existsSync(migrationRoot)
  ? fs.readdirSync(migrationRoot).filter((name) => name.endsWith('.sql')).sort()
  : [];
const definitions = [];
for (const name of migrationFiles) {
  const file = path.join(migrationRoot, name);
  const text = fs.readFileSync(file, 'utf8');
  for (const hit of matches(text, /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi)) {
    definitions.push({ ...hit, file: `supabase/migrations/${name}`, kind: 'migration-function' });
  }
}

const callRpcNames = uniqueSorted(callSites.map((x) => x.name));
const operationNames = uniqueSorted(operationSites.map((x) => x.name));
const migrationRpcNames = uniqueSorted(definitions.map((x) => x.name));
const calledButNotDefined = callRpcNames.filter((name) => !migrationRpcNames.includes(name));
const namedOperationRpcNames = uniqueSorted(rpcPropertySites.map((x) => x.name));

const reconciliationPath = path.join(root, 'supabase', 'baseline', 'inventory', 'repo_migration_reconciliation.json');
let reconciliation = [];
if (fs.existsSync(reconciliationPath)) {
  try { reconciliation = JSON.parse(fs.readFileSync(reconciliationPath, 'utf8')).reconciliation || []; } catch { reconciliation = []; }
}
const driftTargets = ['t2_resource_command_v2', 't2_mindmap_request_identity_v2'];
const drift = driftTargets.map((name) => {
  const item = reconciliation.find((x) => x.name === name);
  return item
    ? { name, file: item.file, status: item.status }
    : { name, file: null, status: 'UNKNOWN_NOT_IN_RECONCILIATION' };
});

function commandAvailable(command) {
  const result = cp.spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command], { encoding: 'utf8' });
  return result.status === 0;
}
const baselineSql = path.join(root, 'supabase', 'baseline', 'production_schema_baseline.sql');
const bootstrap = {
  baseline_sql_present: fs.existsSync(baselineSql),
  supabase_cli_present: commandAvailable('supabase'),
  psql_present: commandAvailable('psql'),
  executed: false,
  exit_code: null,
  status: fs.existsSync(baselineSql) && (commandAvailable('supabase') || commandAvailable('psql')) ? 'READY_TO_RUN' : 'BLOCKED',
  reason: 'Disposable bootstrap was not executed: the reviewed schema-only baseline SQL is absent and no authenticated/local database runner is available in this worktree. No production migration or SQL write was attempted.',
};

const entities = [
  ['t2_kompaniya / t2_loyiha / t2_obyekt', 'company/project/object', 'company context + project/object RPCs', 't2_men_v1, t2_loyiha_royxat, t2_obyekt_jami', 'kompaniya_id, loyiha_id', 't2_audit_yoz where writer contract applies', 'versiya on project/object records', 'STATIC_PARTIAL'],
  ['t2_qator', 'canonical BOQ line', 't2_qator_qosh, t2_qator_tahrir, smeta import writers', 't2_daraxt / t2_qator_holat', 'ota_id, obyekt_id, manba_id', 't2_ozgarish_qayd / writer audit contracts', 'versiya', 'STATIC_PROVEN'],
  ['t2_akt / t2_akt_qator', 'Fakt/F2 document and lines', 't2_akt_yarat, t2_akt_yarat_v2, t2_fakt_*', 't2_qator_holat, t2_f2_exact_qatorlar_v1, t2_nakopitelniy_v1', 'akt_id, qator_id, obyekt_id', 't2_audit_yoz in canonical writer paths', 't2_akt.versiya and operation_id', 'STATIC_PARTIAL'],
  ['t2_f2_import_job / t2_f2_import_draft_qator', 'resumable F2 review state', 't2_f2_import_job_yarat_v1, ...ilgarilash_v1, ...draft_saqla_v1', '...job_holat_v1, ...draft_royxat_v1', 'obyekt_id, source_document_id, job_id', 't2_audit_yoz', 'job.versiya, draft.versiya', 'STATIC_PROVEN'],
  ['t2_smeta_revision / t2_smeta_ozgarish*', 'BOQ revision/change lineage', 't2_smeta_baseline_kafolat_v1, t2_smeta_ozgarish_yarat/tasdiqlash/qaytar', 't2_nakopitelniy_v1, workbench read model, revision list', 'obyekt_id, ozgarish_id, qator_id', 'audit evidence is present in change-control contracts; baseline audit is not proven here', 'revision seq + version fields', 'STATIC_PARTIAL'],
  ['t2_document_registry / R2 file truth', 'source document/revision evidence', 'reserve/put/finalize registry functions', 'hujjat-royxat/read models', 'kompaniya_id, loyiha_id, obyekt_id', 'registry audit functions', 'document version/revision sequence', 'STATIC_PARTIAL'],
];

function mdList(items) { return items.length ? items.map((x) => `- ${x}`).join('\n') : '- (none)'; }
function mdRows(rows) {
  return rows.map((r) => `| ${r.map((x) => String(x ?? '').replaceAll('|', '\\|')).join(' |')} |`).join('\n');
}

const doc = [
  '# T2 Schema Inventory — 2026-09 (Hermes WP-2)',
  '',
  '**Status:** STATIC_COMPLETE / BOOTSTRAP_BLOCKED',
  '',
  'This report is generated by ops/handoff/t2_schema_inventory.cjs. It inventories repository call sites and migration definitions only. It does not claim that a function exists in the live project unless the repository\'s separate read-only reconciliation record says so.',
  '',
  '## 1. RPC inventory',
  '',
  `- Frontend/function source files scanned: ${sourceRoots.flatMap(walk).length}`,
  `- Unique direct/read RPC names found: ${callRpcNames.length}`,
  `- Unique named operations found: ${operationNames.length}`,
  `- Unique migration function definitions found: ${migrationRpcNames.length}`,
  `- Direct/read names without a matching migration definition: ${calledButNotDefined.length}`,
  '',
  '### Direct/read RPC names',
  '',
  mdList(callRpcNames),
  '',
  '### Named operation names (client → write gateway)',
  '',
  mdList(operationNames),
  '',
  '### RPC names used in named-operation catalog',
  '',
  mdList(namedOperationRpcNames),
  '',
  '### Static call-site gaps',
  '',
  mdList(calledButNotDefined.map((name) => {
    const at = callSites.find((x) => x.name === name);
    return `- ${name} — ${at?.file || 'unknown'}:${at?.line || '?'}; migration definition not found in tracked SQL (could be baseline/live-only, generated, or a stale call).`;
  })),
  '',
  '## 2. Known repo ↔ live drift records',
  '',
  'The repository already records these as unresolved reconciliation items; this lane does not apply them.',
  '',
  '| Name | Repo migration | Recorded status | Action |',
  '|---|---|---|---|',
  drift.map((x) => `| ${x.name} | ${x.file || '—'} | ${x.status} | APPROVAL_REQUIRED: confirm canonical version with read-only live pg_proc/migration ledger before any apply |`).join('\n'),
  '',
  '## 3. Representative PTO entity contracts',
  '',
  '| Entity | Role | Writer | Reader/read model | Relation/scope | Audit | Version/idempotency | Static status |',
  '|---|---|---|---|---|---|---|---|',
  mdRows(entities),
  '',
  'The matrix is intentionally representative, not a claim that every historic/legacy table has a canonical writer. The live authorization and RLS boundary remains UNPROVEN without authenticated two-tenant negative tests.',
  '',
  '## 4. Bootstrap result',
  '',
  '| Check | Result | Evidence |',
  '|---|---|---|',
  `| Schema-only baseline SQL | ${bootstrap.baseline_sql_present ? 'PRESENT' : 'MISSING'} | supabase/baseline/production_schema_baseline.sql |`,
  `| Supabase CLI | ${bootstrap.supabase_cli_present ? 'PRESENT' : 'NOT_INSTALLED'} | local command availability |`,
  `| psql | ${bootstrap.psql_present ? 'PRESENT' : 'NOT_INSTALLED'} | local command availability |`,
  `| Disposable bootstrap execution | ${bootstrap.status} | ${bootstrap.reason} |`,
  '',
  `**Exact bootstrap exit code:** ${bootstrap.exit_code === null ? 'NOT_RUN (BLOCKED)' : bootstrap.exit_code}`,
  '',
  'Required next step (owner-controlled): produce a reviewed schema-only baseline or use a disposable Supabase/Postgres environment, then run all forward migrations in lexicographic order and record the command plus exit code. Do not replay migrations against production from this report.',
  '',
  '## 5. Security boundary note',
  '',
  '- Every production-changing action in this lane is source-only; production_write_allowed=false.',
  '- The inventory does not prove RLS, session actor binding, or cross-tenant isolation. Those require authenticated negative tests and/or read-only catalog inspection.',
  '- Missing migration definitions in the static comparison are not silently treated as absent from production; they are marked UNKNOWN/RECONCILE.',
  '',
].join('\n');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, doc, 'utf8');

const result = {
  status: 'PASS_STATIC_INVENTORY',
  output: path.relative(root, outPath).replaceAll(path.sep, '/'),
  source_files: sourceRoots.flatMap(walk).length,
  direct_rpc_names: callRpcNames.length,
  named_operations: operationNames.length,
  migration_function_definitions: migrationRpcNames.length,
  called_but_not_defined: calledButNotDefined.length,
  drift,
  bootstrap,
};
console.log(JSON.stringify(result, null, 2));
