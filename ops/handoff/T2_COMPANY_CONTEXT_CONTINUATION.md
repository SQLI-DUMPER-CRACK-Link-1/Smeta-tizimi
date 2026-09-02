# T2-COMPANY-CONTEXT-P0-FIX-001 — continuation handoff

Context-survival record. If a session ends, resume from here.

## Exact position

- Branch: `fix/company-context-p0`
- **HEAD (local == origin): `2472686`** (verified via `git ls-remote`)
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

## Codex audit P1 items still open (code-only, in scope, not yet done)

- `/api/sb` partial tenant enforcement (only exact `kompaniya_id=eq.N` filter
  shape is checked) — `frontend/functions/api/sb.ts`.
- `frontend/src/api/t2-xodim.ts` (old `/api/sb-yoz` member CRUD) — the page is
  redirected but the client module + its `sb-yoz` `azolik_*` actions remain.
- actor-namespaced `localStorage` key for the active company.
- `/admin/system-control` true company-less global view (needs
  `t2_system_control_v1` to accept null `kompaniya_id` for superadmin).
- `sb.ts` / `kirish.ts` old-session (`foydalanuvchi_id` undefined) enforcement
  waiver — `kirish.ts` is now fixed for NEW logins; old cookies still bypass
  `sb.ts` checks until they expire (12h).
