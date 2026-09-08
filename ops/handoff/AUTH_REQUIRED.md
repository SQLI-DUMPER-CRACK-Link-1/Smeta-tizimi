# Authentication and unavailable integration lanes

Credential values are intentionally omitted. No browser OAuth, password, MFA,
CAPTCHA, token entry, or confirmation prompt was awaited.

## Verified / usable

### GitHub remote read — READ_OK

- **Attempted operation:** `GIT_TERMINAL_PROMPT=0 git ls-remote --heads origin`.
- **Result:** succeeded and returned 70 remote heads. The night branch was not
  present before integration.
- **Limit:** no limitation remains for this branch push; the dedicated branch
  push was verified against the returned remote SHA.

### Supabase MCP — CONNECTED_READ_ONLY

- **Attempted operation:** Claude headless print-mode read-only MCP inspection.
- **Result:** project `Smet-01`, `ACTIVE_HEALTHY`; 118 public tables, 97
  `t2_*`, RLS reported enabled; relevant table counts returned. `execute_sql`
  was denied by plan mode, so RPC enumeration was not performed.
- **Limit:** migration application state, grants, deployed RPC bodies and
  authenticated cross-tenant behavior remain unverified.

## Unavailable / blocked lanes

### Supabase CLI — TOOL_UNAVAILABLE

- **Attempted operation:** non-interactive `supabase projects list` status.
- **Reason:** `supabase` is not installed on PATH; no CLI result accepted.
- **Owner action:** expose/install the CLI tomorrow and run a read-only project
  status using the already-authenticated account. Never paste credentials into
  the repository or chat.

### Cloudflare Wrangler — TOOL_UNAVAILABLE / RUNTIME_UNVERIFIED

- **Attempted operation:** non-interactive `wrangler whoami`.
- **Reason:** `wrangler` is not installed on PATH. Claude’s desktop MCP list
  showed Cloudflare entries configured, but no headless runtime result was
  available and no production action was attempted.
- **Owner action:** run a read-only `wrangler whoami` or account/Worker status
  check in the already-authenticated work-PC session.

### Google Drive — TOOL_UNAVAILABLE_IN_HEADLESS_SESSION

- **Attempted operation:** metadata-only search for LRV/RES/F2/smeta/resource
  files through the connected Claude session.
- **Reason:** the headless session exposed only Codebase Memory and Ruflo; no
  Drive list/search tool was available. This was not treated as a login failure.
- **Owner action:** provide an authorized local Drive sync or Drive MCP/tool,
  then run the sanitized profiler against approved files. Source documents are
  not modified.

## Production verification status

Production auth, RLS/grants, migrations, R2/Drive readback, Cloudflare deploy,
rollback and owner login smoke are **AUTH_OR_RUNTIME_REQUIRED**. The source and
local-test lanes continued without them.
