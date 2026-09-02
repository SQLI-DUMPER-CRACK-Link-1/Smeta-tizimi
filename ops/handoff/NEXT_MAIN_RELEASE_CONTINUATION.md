# NEXT-MAIN-RELEASE-V1 — RELEASED (post-release record)

**RELEASED 2026-09-02 evening.** This top section is authoritative; the
checkpoint further down is kept for the incident detail only.

## Final state

- `main`: `b6db686` → **`9462a361fb249da36aab8141428cc95c17e8a0d6`**
  (`--no-ff` merge of `integration/next-main-release-v1 @ 3af5afa`; verified
  via `git ls-remote origin main`).
- `integration/next-main-release-v1` fast-forwarded to `9462a36` (== main).
- Cloudflare Pages: deploy of `9462a36` → **"Deploy successful"** (GitHub
  public check-runs API). Production `https://smeta-tizimi.pages.dev`.
- Production Supabase `tuoyrzadkgoltpqkdiyx`: **all NREL-001 migrations were
  already applied by the prior session** (SMETA/F2/NAKOPITELNIY + FILE-TRUTH
  + boss-dashboard + capability-registry + company-onboarding +
  document-registry-read + replica-move + sheets-writeback + constraint
  hotfixes). Re-verified this session against the live catalog
  (`list_migrations` + `pg_proc` + `to_regclass`) — all present;
  `t2_kirish_royxatga_ol` = `ok_no_autojoin`. **No migration was applied
  this session.**
- GAS: **not deployed — not required.** `frontend/functions/api/gas.ts`
  unchanged vs old main; no new GAS `fn` calls in deployed functions.
  `Smeta tizimi/98_/99_` edits are source-only time-trigger workers
  (triggers not created) — deferred P1-A.
- SESSIYA_KALIT: **confirmed set on Production** — `POST /api/kirish` junk
  creds → `401`, NOT `503 CONFIG`. Preview: `kirish-diag` `bor:true`, 86 chars.

## This session's work (resume PC, on top of checkpoint `0b7d64e`)

1. Recovered: local `integration` was `cc7308c`, fast-forwarded to
   `origin/integration/next-main-release-v1 @ 0b7d64e`.
2. Verified Codex `document-fidelity-release-v1` (`bc4248e`) and
   `pre-main-release-qa-v1` (`4125ef6`) are **already merged** (commits
   `61d197c`, `caf8b58`) — Section-6 handshake already done by the prior
   session; the Codex branch has nothing new beyond HEAD.
3. **`3af5afa`** — removed the temporary
   `frontend/functions/api/kirish-diag.ts` (kept `kalitTashxis()` in
   `_shared/auth.ts` — exported, secret-safe, no route).
4. Re-ran all gates on `3af5afa` — all green (table below).
5. Merged `integration → main` (`--no-ff`, `9462a36`), pushed, watched the
   Cloudflare deploy to success.
6. Non-destructive production smoke (table below).
7. Governance updated: this file, `CURRENT_STATE.md`, `ACTIVE_TASKS.json`
   (NREL-001 → `released`), `NEXT_MAIN_RELEASE_V1.md`.

## Gates on `3af5afa` (all green)

| Gate | Result |
|---|---|
| `git diff --check` | ✅ clean |
| `npx tsc -b` | ✅ (does NOT cover `frontend/functions/**`) |
| `npm run build` | ✅ built in ~14s |
| `npx vitest run` | ✅ 112/112 (24 files) |
| `npm run lint` | ✅ 0 errors (pre-existing warnings only) |
| `npm run tekshir` | ✅ all suites pass, 0 failed |
| `node ops/governance-check.cjs` | ✅ PASS, 9 tasks |
| regression oracle `generateParkLegacyCompatibilityReport()` | ✅ MATCH:1 / INTENTIONAL_CHANGE:2 / UNRESOLVED:1 / **BUG_FOUND:0** |

## Production smoke (2026-09-02, non-destructive, anonymous)

| Check | Result |
|---|---|
| `POST /api/kirish` junk creds | **401** (not 503) ⇒ SESSIYA_KALIT set on Production |
| `/api/{sessiya,boss-dashboard,system-control,company,hujjat-nazorat,hujjat-royxat,hujjat-ol,gas}` | all **401 AUTH_REQUIRED** (live, fail-closed, no 5xx) |
| `/api/kirish-diag` | **200 SPA fallback** (route removed as intended) |
| `/`, `/admin/hujjat-nazorat`, `/favicon.svg`, `/manifest.webmanifest`, JS chunks | **200** |
| prod RPCs (`t2_workbench_v1` / `t2_nakopitelniy_v1` / `t2_obyekt_yakunlash_v1` / `t2_smeta_ozgarish_royxat_v1` / `t2_boss_dashboard_v1` / `t2_system_control_v1` / `t2_men_v1`) | all `ok:true` |
| **Authenticated deep click-through** (login → dashboard → upload PDF → download → …) | **OWNER-ONLY, not run** — Claude cannot log in. Non-blocking. |

## Deferred (P1 — not in this release)

- **Authenticated deep smoke** — owner runs the 16-step "Owner morning smoke"
  in `ops/releases/NEXT_MAIN_RELEASE_V1.md`.
- **Real Drive Forma-2 / Smeta template study** + F2 document-fidelity
  acceptance (A–L). Codex `document-fidelity-release-v1` implemented the
  deterministic projection side (no banner rows, no NAIMENOVANIE mutation,
  stable `lineId`, `~`/`+` legacy markers) but real-template certification
  needs Drive access.
- **GAS replica workers** (`98_/99_`) deploy + time-triggers + controlled
  Drive backfill pilot (`REPLICA_SYNC_SECRET` is already set in Cloudflare).
- **T2-GAS-EXIT-001** — F2 matching engine off GAS (`ops/handoff/T2_GAS_EXIT_001.md`).
- **`SUPABASE_URL` raw-value cleanup** in Cloudflare (code tolerates the bad
  value via `supabaseBaseUrl()`; not a functional blocker).
- **`tsconfig.functions.json` + `@cloudflare/workers-types`** gate so
  `frontend/functions/**` gets real type-checking (currently untyped by CI).

---
_(historical checkpoint follows — kept for incident detail; the state above
is authoritative)_

## Exact position (checkpoint 2026-09-02 evening — SUPERSEDED)

- Integration branch: `integration/next-main-release-v1`
- Local worktree used that session: `C:\Users\PC\Documents\GAS__nrel`
- **HEAD then: `2a7e5f1`** (later `0b7d64e` doc commit)
- `main` then: `b6db686` (SUPERSEDED — now `9462a36`)
- Stable branch preview URL: `https://integration-next-main-releas.smeta-tizimi.pages.dev`

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

## Section 6 — DONE (2026-09-02 evening, resume PC)

All steps executed. `kirish-diag.ts` removed (`3af5afa`), gates re-run green,
`origin/main` was still `b6db686` at merge time, merged `--no-ff` → `9462a36`,
pushed, Cloudflare deploy succeeded, non-destructive smoke green, governance
updated. The SESSIYA_KALIT gate was cleared by the owner's explicit in-session
confirmation ("Key is set") plus Preview `kirish-diag` (86-char key) plus the
Production `POST /api/kirish` → 401 (not 503) check.

**The only outstanding item is the owner-only authenticated deep click-through**
(login → Loyihalar/Obyektlar/Fakt/Mind Map/AOSR/F2 all load without a
PGRST125 or other error banner). It is **non-blocking** — the anonymous
fail-closed smoke and the PGRST125 fix (`supabaseBaseUrl()`, live-confirmed
`SUPABASE_READ_OK` on Preview) cover the risk. The owner should still run it
once for peace of mind.

## Do-not-touch reminders (still standing, unchanged from owner's instructions this session)

- Do not rotate any secret (`GAS_TOKEN`, `SESSIYA_KALIT`, `SUPABASE_KEY`,
  `REPLICA_SYNC_SECRET`).
- Do not run `webApiTokenYarat()` (creates a NEW `WEB_API_TOKEN`,
  invalidating the current one project-wide — would re-break login
  everywhere, including Production).
- Do not deploy new GAS code/versions (replica workers stay deferred P1-A).
- Do not delete/modify the R2 bucket.
- Do not touch Production Supabase schema (NREL-001 is fully applied and
  released; no further migration is in scope — see
  `ops/releases/NEXT_MAIN_RELEASE_V1.md`
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
