# T2-COMPANY-CONTEXT-P0-FIX-001 — continuation handoff

Context-survival record. If a session ends, resume from here.

## Exact position

- Branch: `fix/company-context-p0`
- **HEAD (local == origin): `e14993f`** (verified via `git ls-remote`)
- Recent: `e14993f` rollback round-trip note · `fbaa03b` handoff · `241bd37` Codex oracle + sb.ts tenant gaps
- Base: `origin/main @ b54f686` (NEXT-MAIN-RELEASE-V1 shipped state). NOT merged.
- Preview (stable alias, reusable for every push to this branch):
  **`https://fix-company-context-p0.smeta-tizimi.pages.dev`**
- Status: **BLOCKED — Cloudflare Pages `SUPABASE_KEY` is the anon key, not service_role.**
- `production_write_allowed = false`. No `main` push, no prod migration, no
  Cloudflare/GAS/R2 mutation.

## THE BLOCKER (owner-only — Claude has no Cloudflare access)

Owner's authenticated Preview smoke FAILED: every canonical `/admin/*` page
shows "Kompaniya ma'lumotini o'qib bo'lmadi".

**Root cause, proven anonymously on the live Preview:**
```
GET https://fix-company-context-p0.smeta-tizimi.pages.dev/api/soglik
→ { canonical_rpc_http_status: 401, supabase_key_role: "anon_or_low" }
```
DB grants (`pg_proc.proacl`, confirmed via `set role anon`):
- `t2_men_v1`, `t2_boss_dashboard_v1`, `t2_workbench_v1`, `t2_nakopitelniy_v1`,
  `t2_system_control_v1` → `{postgres, service_role}` only. anon → 42501.
- `t2_kirish_royxatga_ol` → PUBLIC + anon + authenticated.

So an anon `SUPABASE_KEY` lets **login** succeed (session gets `foydalanuvchi_id`)
but **every canonical `/api/*` endpoint** that calls a service_role RPC returns
permission-denied. `/api/sb` (table reads) still works → CRM partially opens.

**FIX (owner):**
1. Cloudflare Pages → `smeta-tizimi` → Settings → Environment variables →
   set `SUPABASE_KEY` = the Supabase **`service_role`** secret, for
   **`Production` AND `Preview`**.
2. Redeploy (env change does not auto-deploy).
3. Verify: `GET /api/soglik` → `supabase_key_role: "service_role"`.
4. **Also check Production**: `/admin/dashboard` authenticated on
   `smeta-tizimi.pages.dev` — it has the SAME service_role RPC dependency
   (`t2_boss_dashboard_v1`) and may have been broken since `9462a36` shipped.
   `/api/soglik` is on this branch only, not `main` yet.

## What shipped on this branch (b54f686 .. 2472686)

| Commit | What |
|---|---|
| `48c06f3` | Codex audit doc (`T2_COMPANY_CONTEXT_UX_AUDIT_001_CODEX.md`) cherry-picked |
| `32d7331` | P0-1 unified `KompaniyaProvider` in `AdminShell` (from `t2_men_v1`, not all-companies read) + P0-6 `tsconfig.functions.json` gate (14 latent fn type errors fixed) |
| `38b0e83` | P0-2 `t2_platforma_superadmin` + `t2_actor_kompaniya_azo_tekshir` superadmin branch — **SOURCE ONLY**, acceptance `PLATFORMA_SUPERADMIN_CONTEXT_ACCEPTANCE_PASS` (rolled-back), NOT applied |
| `8254007` | P1 IA (`/admin/test/xodimlar`→redirect, KompaniyaPage member mgmt, Settings dedup, nav scopes) + P0-5 raw-error UX + governance gate in CONSTITUTION.md |
| `7cc91a7` | governance record |
| `b91c0c2` | temp `/api/kontekst-diag` (authenticated pipeline probe) |
| `af1874c` | `kirish.ts` canonical actor resolution MANDATORY (no split-brain) + `company.ts` CONFIG distinction + logout-on-auth-error UX |
| `71cc123` | root-cause diagnosis + **permanent `/api/soglik` health probe** |
| `2472686` | governance: blocked status |

## Gates (all green on 2472686)

`tsc -b` · `tsc -p tsconfig.functions.json` · `npm run build` · `npx vitest run`
112/112 · `npm run lint` 0 errors · `npm run tekshir` (incl. `t2_company_context.test.cjs`
37 checks + functions type gate) · `node ops/governance-check.cjs` PASS.

## Must-remove-before-main

- `frontend/functions/api/kontekst-diag.ts` — temporary authenticated diag.
  (`/api/soglik` is PERMANENT — keep it.)

## Migration status

- `supabase/migrations/20260914120000_t2_platforma_superadmin_context_v1.sql`
  (+ `.rollback.sql` + `.acceptance.sql`) — **SOURCE ONLY, prod write NOT
  authorised.** No-op for the current single-company reality; apply with the
  fix release after the owner smoke passes.

## Pipeline verified as service_role (what the fixed key will do)

Simulated `set local role service_role` on prod (exactly how Cloudflare
Functions call PostgREST once `SUPABASE_KEY` is the service_role secret),
with the owner's real user (id 7, "Anvar", superadmin):

| RPC | Result |
|---|---|
| `t2_kirish_royxatga_ol('Anvar','superadmin')` | `ok:true, foydalanuvchi_id:7, azoliklar:1` |
| `t2_men_v1(7)` | `ok:true, azoliklar:1, onboarding_kerak:false` |
| `t2_boss_dashboard_v1(1,7)` | `ok:true` |
| `t2_system_control_v1(1,7)` | `ok:true` |
| `t2_workbench_v1(8,7)` / `t2_nakopitelniy_v1(8,7)` | `ok:true` |
| `t2_obyekt_yakunlash_v1(8,7)` / `t2_smeta_ozgarish_royxat_v1(8,7)` | `ok:true` |
| `t2_document_registry_v1(7,1)` | returns |

→ The entire canonical app works the moment the key is fixed. No further
code change required.

## Migration static review (20260914120000_t2_platforma_superadmin_context_v1)

- `t2_platforma_superadmin(bigint)` — `sql stable security definer`, reads
  `t2_azolik` directly, no recursion into `t2_actor_kompaniya_azo_tekshir`.
- `t2_actor_kompaniya_azo_tekshir` — CREATE OR REPLACE keeps the exact
  original signature / param checks / `for share` lock; the new branch is
  read-only (a company-existence `exists()`); normal-user behaviour is
  byte-identical (membership found → role; none + not superadmin → 42501).
- Rollback restores the verbatim original body, then drops the resolver
  (only caller already replaced). Additive, runnable any time, no data
  touched. **PASS.**

## Next steps (after the owner sets SUPABASE_KEY)

1. Owner redeploys Preview; `GET /api/soglik` must show `service_role`.
2. Owner authenticated Preview smoke on
   `https://fix-company-context-p0.smeta-tizimi.pages.dev`:
   login → `/api/kontekst-diag` shows `men_probe_category: "MEN_OK"` →
   `/admin/kompaniya`, `/admin/dashboard`, context bar, selector, refresh,
   direct URL, A→B switch, logout/login.
3. If PASS: remove `kontekst-diag.ts`, re-run gates, ask Codex for re-audit
   of the 27-case oracle, then request the consolidated production approval
   (migration `20260914120000` + `main` merge + Cloudflare deploy).
4. If still FAIL: read the `/api/kontekst-diag` JSON and continue from the
   exact `men_probe` category.

## Codex adversarial oracle — INTEGRATED (commit 241bd37)

`codex/t2-company-context-adversarial-tests` (e3b5649) merged as additive
harness, file-path assumptions adapted to the relocated `umumiy/kontekst`
module (assertions unchanged). Both now GREEN and in `hammasi.cjs`:
- `t2_company_context_adversarial.test.cjs` — **20/20** (baseline 6/14)
- `t2_functions_typecheck_gate.test.cjs` — **5/5** (baseline 1/2)
- `frontend/testlar/fixtures/company-context-adversarial-cases.json` — 26 machine-readable API/E2E scenarios (for the post-smoke re-audit)

## Codex audit P1 — done this session / still open

DONE (241bd37):
- `/api/sb` old-session bypass → **fail closed** for company-scoped `t2_*`
  (`SESSION_STALE` 401). No valid session predates the feature by now.
- `/api/sb` `obyekt_id=eq.N` filtered `t2_*` reads → object's `kompaniya_id`
  verified against membership server-side (one `t2_obyekt` lookup).
- actor-namespaced `localStorage` (`t2_kompaniya_kontekst {uid,id,global}`).
- dead `TestXodimlarRollar.tsx` + `api/t2-xodim.ts` removed (`4585271`).

STILL OPEN (needs a full frontend `sbOqi` audit + tests before shipping):
- `/api/sb` — make a tenant anchor (`kompaniya_id` or `obyekt_id`) MANDATORY
  for anchor-less company-scoped `t2_*` reads (currently they pass through).
  `T2_GLOBAL_JADVALLAR` allowlist in `sb.ts` may need widening once every
  caller is audited.
- `/admin/system-control` true company-less global view (needs
  `t2_system_control_v1` to accept null `kompaniya_id` for superadmin).
- Real disposable-DB / API tests for the 26-scenario fixture (needs seeded
  A/B tenants — Codex §11/§P0_NOT_AUTOMATABLE).
