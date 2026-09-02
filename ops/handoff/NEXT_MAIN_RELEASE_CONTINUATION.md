# NEXT-MAIN-RELEASE-V1 — continuation handoff

Context-survival record. If a session ends mid-task, resume from here.
**Rewritten 2026-09-02 evening — supersedes everything below this line's
previous version.** Owner is shutting down this work PC; this is a safe
checkpoint, not a finished release.

## Exact position

- Integration branch: `integration/next-main-release-v1`
- Local worktree used this session: `C:\Users\PC\Documents\GAS__nrel`
  (separate from the dirty `integration/mindmap-create-final` work in
  `C:\Users\PC\Documents\GAS` — that branch was NOT touched and remains
  its own separate, unrelated, uncommitted work).
- **HEAD (local == origin, verified via `git ls-remote`): `2a7e5f1`**
- `main` untouched: `b6db686329a4f3c7e5f49aca24d2872695e81402`
- Working tree clean, nothing uncommitted.
- Stable branch preview URL (works for ANY future push to this branch —
  no need to ask the owner for a fresh hash URL each time):
  **`https://integration-next-main-releas.smeta-tizimi.pages.dev`**
  (Cloudflare truncates the branch-name alias to 28 chars; confirmed via
  the GitHub public check-runs API on this public repo — see "How to
  track a Cloudflare deploy" below.)

## What actually shipped this session (commits b640549..2a7e5f1)

1. **`b640549`** — F2 positional-mapping P0 (`forceMapBlChildren` removed,
   `applyEngineBinds` + `f2-import-bind.ts`/`.test.ts`), owner's
   T2-GAS-EXIT-001 escalation recorded in `ops/handoff/T2_GAS_EXIT_001.md`.
2. **`2bf16b5`** — `R2_CANONICAL` binding added to `frontend/wrangler.toml`
   (owner created the private bucket `smeta-tizimi-canonical`, dashboard
   "+Add" was blocked once wrangler.toml owns bindings — this is why it's
   in-repo now, additive next to the pre-existing `[ai]` binding).
3. **`4ccc1f2` / `9cd8a81` / `2a7e5f1`** — `frontend/functions/api/kirish-diag.ts`,
   a **TEMPORARY** secret-safe diagnostic endpoint (booleans/categories
   only, never a secret value). **MUST be removed before main** (see
   Section 6 below) — do not forget this file exists.
4. **`9c943e4`** — closed a prod/source drift on the FILE-TRUTH-001
   `provider`/`status` CHECK constraints found while re-verifying an
   earlier migration (unrelated tangent, already resolved, prod already
   patched, source now matches).
5. **`55473fc`** — **the real fix**: `frontend/functions/_shared/supabase-url.ts`
   (`supabaseBaseUrl()`) + applied at all 16 call sites across 15
   `frontend/functions/api/*.ts` files. See "PGRST125" below.

## Two real production/preview incidents diagnosed and closed today

### 1. Preview login was broken — GAS_TOKEN mismatch (CLOSED, config-side, owner fixed)
Preview's `GAS_TOKEN` didn't match the live GAS deployment's
`WEB_API_TOKEN` (Script Properties, project
`1fcGIysmTyIy2J-etZrVnxRMCzqbwACdlWfRhXc9ERT3r7fyCi6-98B6h`). Confirmed via
`kirish-diag`'s GAS probe: `category` went from `TOKEN_REJECTED` →
`CREDENTIALS_INVALID` (healthy — a probe login just doesn't exist, as
expected) once the owner updated the Preview `GAS_TOKEN` value in
Cloudflare. **No GAS token was rotated; `webApiTokenYarat()` was never
run; Production was never touched and was confirmed working throughout.**

### 2. Post-login "Kompaniya: Supabase 404 PGRST125" (CLOSED, code-side, this session)
Root cause: Cloudflare's `SUPABASE_URL` value already ends in `/rest/v1`
(the classic mix-up between Supabase's "Project URL" and "REST API URL"
dashboard fields). Every function doing `SUPABASE_URL + '/rest/v1/<x>'`
therefore produced a doubled `/rest/v1/rest/v1/<x>` path, which PostgREST
rejects as PGRST125. This broke **every** Supabase-touching endpoint in
this release, not just the company bootstrap — `sb.ts`, `sb-yoz.ts`,
`kirish.ts`, `boss-dashboard.ts`, `company.ts`, `system-control.ts`,
`hujjat-royxat.ts`, `hujjat-ol.ts`, `hujjat-yukla.ts`, `hujjat-r2.ts`,
`hujjat-nazorat.ts`, `payment.ts`, `royxat.ts`, `ai-savol.ts`,
`agent/call.ts`.

**Fixed defensively in code** (`supabaseBaseUrl()` strips a trailing
`/rest/v1` before appending it back) — confirmed via `kirish-diag`'s
Supabase probe: `supabase_probe_category` went from `SUPABASE_ERROR_RESPONSE`
(`pgrst_code: PGRST125`) → **`SUPABASE_READ_OK`** (HTTP 200) after the fix
deployed, even though `supabase_url_looks_like_it_has_rest_v1_suffix` is
**still `true`** — i.e. the underlying Cloudflare config value is still
technically wrong, the code now just tolerates it. **The owner may still
want to correct the actual `SUPABASE_URL` value in Cloudflare** (Preview,
and check Production too) to the bare Project URL for cleanliness, but it
is no longer a functional blocker either way.

**Self-caught bug during this fix**: the first pass of the 15-file edit
had a regex mistake producing `ctx.env.env.SUPABASE_URL` everywhere — this
would have been a severe, silent production bug because
`frontend/functions/**` is **not covered by `tsc -b`**
(`frontend/tsconfig.json` only references `tsconfig.app.json` /
`tsconfig.node.json`) and Cloudflare's own Pages build doesn't type-check
either (esbuild, transpile-only). Caught it with an ad-hoc
`tsc --noEmit` pass using a throwaway tsconfig including
`frontend/functions/**/*.ts`. **Recommend as a real follow-up**: add
`@cloudflare/workers-types` + a dedicated `tsconfig.functions.json` wired
into a gate script, so this whole layer gets real type-checking going
forward. Not done this session — scope creep risk this late in a release.

## Current gate status (all re-run on `2a7e5f1`, all green)

| Gate | Result |
|---|---|
| `npx tsc -b` | ✅ (does NOT cover `frontend/functions/**` — see above) |
| `npm run build` | ✅ (hit a transient Rolldown native-allocator OOM on this shared Windows box twice — pure infra flake, unrelated to source; retry succeeded both times; Codex's own QA doc documents the same class of issue) |
| `npx vitest run` | ✅ 112/112 (also hit one transient "Worker exited unexpectedly" infra crash on this shared box — 4 files didn't finish that run; immediate retry gave a clean 24/24 files, 112/112 tests) |
| `npm run lint` | ✅ 0 errors, only pre-existing warnings |
| `npm run tekshir` | ✅ 107 checks, `BUG_FOUND=0` |
| `node ops/governance-check.cjs` | ✅ PASS, 9 tasks |
| `kirish-diag` GAS probe (Preview) | ✅ `CREDENTIALS_INVALID` / `gas_ok:true` |
| `kirish-diag` Supabase probe (Preview) | ✅ `SUPABASE_READ_OK` |

**This shared Windows box runs low on free memory** (many concurrent
Chrome/Node processes from other agents/sessions — ~5.7GB free of 25GB
observed). Both `vite build` and `vitest` hit transient native-allocator/
worker crashes this session; both were pure infra flakes that cleared on
immediate retry with unchanged source. **If this happens again tomorrow,
just retry — do not assume the source is broken.**

## How to track a Cloudflare Pages deploy without asking the owner for a URL

This repo is **public**. Cloudflare posts a GitHub check-run per commit,
readable with an unauthenticated `curl` (no token needed):

```
curl -s "https://api.github.com/repos/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi/commits/<SHA>/check-runs" -H "Accept: application/vnd.github+json"
```

`check_runs[0].status` / `.conclusion`, and once `conclusion:"success"`,
`.output.summary` contains both the per-deploy hash URL and the **stable
branch alias** (`https://integration-next-main-releas.smeta-tizimi.pages.dev`
for this branch specifically — reusable across all future pushes to it).
Use this instead of asking the owner to paste a new Preview URL each time.

## NOT done — the one thing blocking main

**Owner-only, human-authenticated Preview smoke test.** Claude cannot log
in with real credentials (safety rule: never handle passwords). The owner
was asked, before shutdown, to manually verify on
`https://integration-next-main-releas.smeta-tizimi.pages.dev`:
1. Login succeeds with the existing admin credentials.
2. No "Kompaniya: Supabase 404 PGRST125" banner after login.
3. Each of: Loyihalar, Obyektlar, Fakt, Mind Map/Xarita, AOSR, F2 —
   opens without a visible error banner.

**This response had not been received when the owner asked to shut down.**
Whoever resumes this must get that confirmation (or run the check
themselves if authorized) before proceeding to Section 6.

## Section 6 — exact steps to reach main (only after the smoke test above passes)

1. Remove `frontend/functions/api/kirish-diag.ts` (temporary diagnostic,
   must not ship to main/production) — commit + push to
   `integration/next-main-release-v1` first, confirm gates still green.
2. Re-run the full gate table above one more time on the post-removal SHA.
3. `git fetch origin`, confirm `origin/main` is still `b6db686` (unchanged).
4. Merge `integration/next-main-release-v1` → `main` (`--no-ff`, no force),
   push `main`.
5. Watch the `main` Cloudflare Pages deploy via the same public
   check-runs technique above (main's production URL is
   `smeta-tizimi.pages.dev`, not a preview alias).
6. Run the **non-destructive** production smoke checklist from
   `ops/releases/NEXT_MAIN_RELEASE_V1.md` ("Owner morning smoke", 16
   items) — do not create throwaway companies/business data on prod
   unless intentional.
7. Update `docs/governance/CURRENT_STATE.md`, `ops/ACTIVE_TASKS.json`
   (NREL-001 status), and this file with final actual state (final main
   SHA, migrations applied, smoke results).

## Do-not-touch reminders (still standing, unchanged from owner's instructions this session)

- Do not rotate any secret (`GAS_TOKEN`, `SESSIYA_KALIT`, `SUPABASE_KEY`,
  `REPLICA_SYNC_SECRET`).
- Do not run `webApiTokenYarat()` (creates a NEW `WEB_API_TOKEN`,
  invalidating the current one project-wide — would re-break login
  everywhere, including Production).
- Do not deploy new GAS code/versions.
- Do not delete/modify the R2 bucket.
- Do not touch Production Supabase schema beyond what's already scoped
  for this release (7 pending migrations `20260902`-`20260908`, all
  additive, acceptance-verified — see `ops/releases/NEXT_MAIN_RELEASE_V1.md`
  §1-2 — **these still have NOT been (re-)applied this session**; the 4
  earlier SMETA/F2/NAKOPITELNIY migrations from the prior session remain
  applied and untouched).

## T2-GAS-EXIT-001 (separate milestone, NOT this release)

Full scope recorded in `ops/handoff/T2_GAS_EXIT_001.md` — do not start
this inside NREL-001. It covers moving the F2 matching engine, file
parsing, and long-running F2 workflows off GAS execution entirely
(GAS staying only as a Drive/Sheets async replica bridge), with a
resumable/checkpointed job model for 50k-row estimates. Explicitly
decoupled from this release by the owner's own decision.
