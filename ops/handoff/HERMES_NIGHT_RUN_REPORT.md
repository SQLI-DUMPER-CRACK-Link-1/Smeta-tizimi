BASE_SHA=806b2955ff00932c25b327991fa2d89a2048064e
INTEGRATION_BRANCH=hermes/pto-revolution-2026-09
LATEST_PUSHED_SHA=c0d6eac72bdde77fd7fe93a0e94fd47a9a08fcb6
LATEST_LOCAL_SHA=c0d6eac72bdde77fd7fe93a0e94fd47a9a08fcb6
GITHUB_PUSH_STATUS=PUSHED_AND_REMOTE_VERIFIED
SUPABASE_AUTH_STATUS=CONNECTED_READ_ONLY_MCP; CLI_NOT_INSTALLED
CLOUDFLARE_AUTH_STATUS=MCP_CONFIGURED_BUT_RUNTIME_UNVERIFIED; WRANGLER_NOT_INSTALLED
DRIVE_AUTH_STATUS=TOOL_UNAVAILABLE_IN_HEADLESS_SESSION
OWNER_SMOKE_STATUS=NOT_RUN

# Hermes night-run report

## COMPLETED

- Boot authority order checked. `AGENTS.md` and `CLAUDE.md` exist. Required
  `docs/governance/CONSTITUTION.md` and `docs/governance/CURRENT_STATE.md` are
  absent and are recorded as missing, not guessed.
- Dedicated branch created: `hermes/pto-revolution-2026-09`.
- Three independent read-only auditors completed: current-state, PTO domain,
  UI/AI/security.
- Current-state audit written to `docs/audit/HERMES_FULL_SYSTEM_AUDIT_2026_09.md`.
- Target state, acceptance matrix and T1→T2 gap map written.
- Sanitized document profiler written and executed. Profile: 38 records,
  33 XLSX, 1 CSV, 2 PDF, 2 DOCX; no raw cell values stored.
- LRV/RES/F2 corpus research docs written with measured local evidence and
  Drive/tool limitations.
- PTO design system, information architecture and visual QA docs written.
- Provider-neutral agent architecture and named-tool contracts written.
- Safe UI slice implemented: TIZIM_02 workflow sidebar/mobile nav in
  `frontend/src/test02/TestShell.tsx`; duplicate `sozlama` route and dead lazy
  imports removed from `frontend/src/App.tsx`.
- `TestSklad.tsx` now uses company-scoped object loading, clears stale object
  state on company change, and does not perform a global read before company
  context exists.
- Supabase read-only MCP verified: `Smet-01`, `ACTIVE_HEALTHY`, 118 public
  tables, 97 `t2_*`, RLS reported enabled; notable live counts include
  `t2_qator=30932`, `t2_signal=1805`, `t2_f2_import_draft_qator=2108`.

## IN_PROGRESS

- No night-run-owned implementation lane remains in progress. Future work is
  limited to the approval/runtime gates listed below.
- Reconciliation of local branch with pre-existing dirty owner/agent work is
  intentionally limited to the night-run write scope.

## BLOCKED

- Live Supabase RPC enumeration was denied in Claude plan mode; CLI absent.
- Cloudflare runtime/Worker status unavailable; Wrangler absent.
- Drive metadata/search tool unavailable in the headless Claude session.
- Authenticated browser owner smoke was not run.
- Production migrations/deployments/RLS/grants/storage readback were not run.

## AUTH_REQUIRED

See `ops/handoff/AUTH_REQUIRED.md`. No interactive login was awaited. GitHub
remote read works; push auth remains to be tested non-interactively.

## NEEDS_OWNER_DECISION

- NULL versus zero semantics.
- Source amount versus derived quantity×price precedence.
- Negative correction and F2 approval/reversal semantics.
- Unit conversion policy.
- Canonical source boundary between migrations, legacy schema, GAS and T2.
- Immutable approved F2/history state machine.

## PRODUCTION_APPROVAL_REQUIRED

See `ops/handoff/APPROVAL_QUEUE.md`: tenant/RLS/upload hardening, migration
parity, approval/history/export, Forma-3/KS-3 rules and owner smoke.

## TEST_RESULTS

- `npx tsc -b --noEmit`: PASS.
- `npm test -- --reporter=dot`: PASS, 9 files / 33 tests.
- `npm run tekshir`: PASS, 12 suites / 296 assertions.
- `npm run lint`: EXIT 0; 129 warnings remain.
- `npm run build`: PASS; unresolved `/grid.svg` runtime path, ineffective
  dynamic import warning, and >500 KB chunk warning remain.
- `git diff --check`: pre-existing trailing whitespace in dirty
  `frontend/src/test02/TestZayavka.tsx:310-317`; night-run files clean.

## KNOWN_FAILURES

- `ops/governance-check.cjs` is absent in the repository.
- Static tests do not prove deployed SQL/RLS/RPC/grant behavior.
- P0 object-only reads and `/api/upload` ownership remain open and are queued,
  not silently changed under the auth/RLS approval boundary.
- PTO import write path remains legacy/GAS-dependent.
- F2 approval/history, Nakopitelniy and Forma-3/KS-3 remain incomplete.
- No browser screenshots or authenticated visual evidence.

## NEXT_BEST_ACTIONS

1. Owner/reviewer approves and implements P0 tenant/RLS/upload hardening with
   two-company negative tests.
2. Execute procurement, mindmap, document, AOSR and replay SQL contracts in an
   isolated database; reconcile deployed RPC signatures.
3. Introduce shared numeric company/project/object/period context and route-level
   direct URL tests.
4. Close T2 LRV/RES/F2 provenance and approval/history before official export.
5. Put AI invoice output behind draft/review/idempotent commit and durable audit.
6. Run browser visual QA at required viewports with approved non-production data.

## RELEASE / HANDOFF

Validated implementation commit `c0d6eac72bdde77fd7fe93a0e94fd47a9a08fcb6`
and handoff commit `05bc3e4149078455d89c618686bcbf981dd6609e` exist locally and
the latter matches `origin/hermes/pto-revolution-2026-09`. Staged diff/check,
secret scan and non-interactive push verification passed. Never merge or push
main.
