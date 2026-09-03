# T2-COMPANY-CONTROL-FOUNDATION-001 — canonical contract

Status: **SOURCE ONLY. PRODUCTION FREEZE ACTIVE** (re-engaged 2026-09-03,
after the 25006 + legacy-RPC security emergency hotfixes). No further prod
migration, `main` push, Cloudflare production mutation, or GAS/R2 production
mutation without fresh, explicit owner approval — this document itself
authorizes nothing.

Baseline: `main @ ccd5423` (== `integration/next-main-release-v1`).

## 0. Reconciliation decision — do not rebuild what already exists

`fix/company-context-p0` (owner-authorized earlier this session, likely
Codex/another session, base `0b7d64e` — fully contained in current `main`'s
ancestry, 18 commits ahead at the point checked) already built the exact
foundation Sections 5–6 of the owner's brief ask for:

- `frontend/src/umumiy/kontekst/KompaniyaKontekst.tsx` — the ONE company
  context provider (superadmin Global mode, actor-namespaced localStorage
  `t2_kompaniya_kontekst`, `queryClient.clear()` on switch, honest
  non-raw error messages, auth-vs-config error distinction). Reads
  `t2_men_v1` via `/api/company?me=1` (already live).
- `KompaniyaTanlagich.tsx` — header selector matching the brief's CASE 1–4
  exactly: superadmin gets `🌐 Global rejim` + switch; single-membership
  non-superadmin gets a static badge, no dropdown; multi-membership gets a
  dropdown of only real memberships; no-membership gets an onboarding
  pointer.
- `KompaniyaKerak.tsx` — professional empty state for company-scoped pages
  (never a raw `"Avval yuqoridan tanlang"` or raw PostgREST text).
- `routeScope.ts` — **already classifies every `/admin/*` route**
  (`GLOBAL` / `COMPANY_SCOPED` / `PROJECT_SCOPED` / `OBJECT_SCOPED` /
  `USER_SCOPED` / `LEGACY`) and **already flags
  `/admin/system-control` as `GLOBAL` target with a `SPLIT — REMAINING`
  comment** — i.e. the other session already identified exactly the gap
  this brief's Section C assigns to Claude's lane.
- `chiqish.ts` — logout clears context, does not leak stale company state.
- `TestXodimlarRollar.tsx` + `t2-xodim.ts` deleted on that branch — the
  legacy, actor-unchecked membership-management UI is superseded by the
  Company Control Center's own Members tab (Section 4 below), not by
  anything that needs separate rebuilding.

**Decision: adopt this module as-is as the canonical foundation.** Nobody
re-implements company-context/selector/route-scope from scratch. Claude's
first concrete act under this contract is reconciling these files into the
working branch (source merge, not a `main` push) so Codex and Antigravity
build on top of it rather than around it.

**Open question for Codex to resolve, not assume:** whether
`t2_men_v1`/`Azolik.rol` alone is sufficient input for the "effective
capability" layer (Section 3 below) or whether `t2_capability_effective_v1`
needs a per-membership-role parameter it doesn't have yet. Investigate
before designing the resolver.

## 1. Canonical data model — reuse only, no parallel truth

| Concept | Canonical table/RPC | Owner note |
|---|---|---|
| Company identity + profile fields | `t2_kompaniya` (`nom`, `kod`, `faol`, `toliq_nom`, `inn`, `manzil`, `rahbar`, `telefon`, `bank`, `hisob_raqam`, `mfo`, `mavqe`, `versiya`) | **Already has every field Section 4's PROFIL asks for except `logo` and a real `status` beyond the `faol` boolean.** Add both as additive columns only if the UI contract needs them — do not invent a parallel settings table. |
| Membership + company role | `t2_azolik` (`foydalanuvchi_id`, `kompaniya_id`, `rol`, `holat`) | Existing. `rol` here is the **company membership role** — never confuse with platform/global role. |
| Platform role | `t2_azolik.rol IN ('superadmin','admin')` anywhere active, resolved via `t2_men_v1`/`KompaniyaKontekst.superadmin` | No separate platform-role table exists or is needed yet. |
| Capability/module entitlement | `t2_capability` + `t2_capability_override` (`scope IN ('global','company','project')`) + `t2_capability_effective_v1` precedence resolver | **Reuse as-is.** This is already the exact "Modullar/Capabilities" model Section 4 asks for — project > company > global > default, kill-switch. Do not build a second capability table. |
| Current-user identity + memberships | `t2_men_v1` / `/api/company?me=1` | Canonical, already live. |
| Audit trail | `t2_audit_log` / `t2_audit_yoz` | Reuse for every new command below — do not invent a parallel audit table. |
| Project/object access | **Gap — no canonical model yet.** `t2_loyiha_qatnashchilar_royxat` covers project participants; nothing scopes a company member's object-level visibility today. | This is new ground — Codex's Section 3 scope (project/object access foundation), additive only, reuse `t2_loyiha_qatnashchilar_royxat` shape as the starting pattern rather than inventing an unrelated one. |
| Integrations status | `t2_integration_health` (already built for CTRL-001) | Reuse for the Company Control Center's "Integratsiyalar" tab — do not build a second integrations table. |

**No subscription/billing table exists. Do not build a fake one** — the
"Modullar/Capabilities" tab shows real `t2_capability_effective_v1` state;
subscription/billing stays an explicit "not yet available" placeholder if
the UI needs to say something, never fabricated numbers.

## 2. File ownership — non-overlapping lanes

Enforced the same way `ops/ACTIVE_TASKS.json` already enforces it for every
other task on this repo: an `owns` path list per lane. Do not edit outside
your own lane without a fresh handoff.

### CLAUDE (backend + integration + release)
- `supabase/migrations/2026091*_t2_kompaniya_yangila_v1*.sql` (+ `.rollback.sql` + `.acceptance.sql`) — Section 4 command
- `supabase/migrations/2026091*_t2_system_control_split_v1*.sql` (+ pairs) — Section C global/company split
- `frontend/functions/api/company.ts`, `frontend/functions/api/system-control.ts`
- `frontend/src/api/t2-men.ts`, `frontend/src/api/t2-control.ts`
- `frontend/src/umumiy/kontekst/**` (reconciliation from `fix/company-context-p0` + any bugfixes found during integration)
- Final integration branch cleanup, gate running, release sequencing
- This contract file + `ops/handoff/T2_COMPANY_CONTROL_SECURITY_INCIDENT_2026-09-03.md`

### CODEX (core implementation — effective authorization engine)
- New: `frontend/src/umumiy/kontekst/effectiveAuth.ts` (or equivalent module Codex names in its own handoff) — the `NavigationViewModel` resolver: platform role + active membership role + effective capabilities + project/object scope → what nav/write-affordances render. Pure function, unit-testable, no network calls of its own (consumes already-fetched `t2_men_v1` + `t2_capability_effective_v1` results).
- Membership revalidation on stale/revoked/mid-session-role-change (server-side re-check contract — propose the RPC/endpoint shape, Claude wires it if it needs a new backend piece).
- Forged-company / forged-role adversarial tests (extend the existing `t2_company_context_adversarial.test.cjs` oracle from `fix/company-context-p0`, currently 20/20 — do not regress it).
- Project/object access foundation (additive schema proposal + RPC, reusing `t2_loyiha_qatnashchilar_royxat`'s shape per Section 1).
- **Must not touch**: `t2_kompaniya`/`t2_azolik` write RPCs (Claude's lane), `frontend/src/umumiy/kontekst/KompaniyaKontekst.tsx`/`KompaniyaTanlagich.tsx`/`routeScope.ts` (already correct, reconciled by Claude — extend via new files, don't rewrite these).

### ANTIGRAVITY (UI/UX only, no core logic)
- `/admin/kompaniya` Company Control Center tabs: Profil (edit form wired to Claude's `t2_kompaniya_yangila_v1`), A'zolar (already-correct `_v1` RPCs from the 2026-09-03 hotfix), Rollar/Ruxsatlar (read `t2_capability_effective_v1` + Codex's resolver output), Modullar/Capabilities, Loyiha/Obyekt ruxsatlari, Integratsiyalar, Audit.
- UX audit of the existing `KompaniyaKontekst`/`KompaniyaTanlagich`/`KompaniyaKerak` flow (single/multi/superadmin/switch/direct-URL/refresh/logout/stale-UI/raw-error scenarios per Section 17 of the owner's brief) — report findings, does not rewrite the audited files itself (files back to Claude if a real bug is found).
- **Must not touch**: any `supabase/migrations/**`, any `frontend/functions/**`, `t2-men.ts`/`t2-control.ts`, Codex's `effectiveAuth.ts`.

## 3. System Control global/company split (Claude, Section C)

Current: `t2_system_control_v1(p_kompaniya_id, p_actor_id, p_loyiha_id)`
**requires** `p_kompaniya_id` (raises via `t2_actor_kompaniya_azo_tekshir`
if null/invalid) — `routeScope.ts` already flags this as the gap: the route
is meant to be `GLOBAL` (platform deploy-state, global integrations health,
platform capability registry, platform job queues) but the backend forces
a company anchor.

Planned split (additive, source-only until owner approval):
- `t2_system_control_v1` **unchanged** — stays the company-scoped view
  (company capabilities, company integration status, company jobs/incidents).
- New `t2_system_control_global_v1(p_actor_id)` — platform-role-guarded
  (superadmin/admin only, via existing `t2_azolik` check, no company
  anchor), returns deploy state, global capability registry, global
  integration health, platform-wide job queue, platform incidents.
- `/api/system-control` gains `?scope=global` vs `?scope=company&kompaniya_id=N`
  (default `company` for backward compatibility with the already-shipped
  route); UI tabs both under one page per the owner's "bitta sahifada tabs"
  allowance.

## 4. Company Profile update command (Claude, Section B)

Legacy `t2_kompaniya_yangila` is **already locked down** (2026-09-03
security hotfix, revoked from public/anon/authenticated) but remains an
unguarded, unaudited body — it must not be the canonical path going
forward even from `service_role`. New `t2_kompaniya_yangila_v1`:

```
t2_kompaniya_yangila_v1(
  p_actor_id bigint, p_kompaniya_id bigint, p_expected_version integer,
  p_toliq_nom text, p_inn text, p_manzil text, p_rahbar text,
  p_telefon text, p_bank text, p_hisob_raqam text, p_mfo text,
  p_mavqe text, p_operation_id uuid
) returns jsonb
```
- `p_actor_id` from session only (Cloudflare `sess.foydalanuvchi_id`), never
  the request body — matches every other `_v1` command in this system.
- Permission guard: `t2_azo_actor_director_tekshir(p_kompaniya_id, p_actor_id)`
  (boss/superadmin only) — reuse, don't reinvent.
- Optimistic lock: `versiya <> p_expected_version` → `STALE_VERSION` with
  the current version (matches `t2_capability_override_set_v1`'s pattern).
- `p_operation_id` idempotency via a small command log (mirror
  `t2_onboarding_command_log`'s shape — reuse the pattern, a dedicated
  table if the existing one doesn't fit the audit-log column shape, not a
  new unrelated mechanism).
- INN format validation reused verbatim from `t2_kompaniya_yarat_v1`
  (`^\d{9}$`).
- Audit via `t2_audit_yoz` with old/new values in `tafsilot` for every
  changed field (not just "profile updated").
- `sb-yoz.ts`'s `kompaniya_yangila` block (already director-guarded as of
  the 2026-09-03 hotfix) switches its RPC target to `t2_kompaniya_yangila_v1`
  and adds `p_actor_id`/`p_operation_id` — the Cloudflare-layer director
  check becomes redundant-but-harmless defense in depth once the DB enforces
  it itself; keep both (matches this system's established two-layer
  convention everywhere else).

This migration is written and acceptance-tested (`BEGIN...ROLLBACK`) as
part of Claude's lane but **stays source-only** until the freeze lifts.

## 5. Release gates (Section 9 of the owner's brief, restated as the literal command list)

```
npx tsc -b
npx tsc -p tsconfig.functions.json     # does not exist yet -- Claude creates it
                                        # (tracked gap: frontend/functions/** currently
                                        # has NO type-checking at all, see
                                        # docs/governance/CURRENT_STATE.md deferred_p1)
npm run build
npx vitest run
npm run lint
npm run tekshir
node ops/governance-check.cjs
<Codex adversarial oracle + new tests>
<Antigravity UX audit report>
<authenticated owner Preview smoke>
```
`READY_FOR_MAIN=NO` until every one of these is green — no exceptions, no
partial credit for "the important ones passed."

## 6. Sequencing (matches the owner's Section 8, 1:1)

1. ✅ baseline `main @ ccd5423`
2. ✅ this reconciliation review (Section 0)
3. ✅ this contract
4. ✅ file ownership (Section 2)
5. Codex begins Section 3-scope implementation (effective auth engine)
6. Claude: Sections 3–4 backend (System Control split + company update
   command), reconcile `umumiy/kontekst/**` into the integration branch
7. Claude integrates Codex's output once handed off
8. Antigravity: Company Control Center UI + UX audit
9. Full gates (Section 5)
10. Preview deploy
11. Owner authenticated smoke
12. **Then, and only then**, request production approval — a fresh,
    explicit ask, not an extension of any earlier approval.
