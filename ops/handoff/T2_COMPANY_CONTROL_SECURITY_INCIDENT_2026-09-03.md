# Security incident — 2026-09-03 — legacy write RPCs open to anon/authenticated

Status: **CLOSED.** Recorded for the audit trail per the owner's explicit
request; this document does not open new scope.

## What was open

Four legacy (pre-`_v1`) write RPCs had `EXECUTE` granted to
`PUBLIC`/`anon`/`authenticated`, with no actor/permission check in the SQL
body:

| RPC | What it let an unauthenticated caller do |
|---|---|
| `t2_kompaniya_yangila(p_id, p_kutilgan_versiya, ...)` | Overwrite any company's name/INN/address/director/phone/bank details/account/MFO, knowing only its integer `id`. |
| `t2_azolik_qosh(p_kompaniya_id, p_login, p_rol, ...)` | Insert (or auto-create) any user as a member of **any** company with **any** role string, unvalidated — including `'superadmin'`. |
| `t2_azolik_rol_ozgartir(p_azolik_id, p_yangi_rol)` | Change any existing membership's role to anything, unvalidated. |
| `t2_azolik_ochir(p_azolik_id)` | Deactivate any membership. |

`t2_azolik_qosh`/`_rol_ozgartir`/`_ochir` were additionally reachable
through the **live, authenticated** `/admin/test/xodimlar` page — its
Cloudflare dispatcher (`frontend/functions/api/sb-yoz.ts`) validated only
that the submitted role string was in an allow-list, never that the calling
session's actor was actually a director of the *target* company. Any
logged-in user — any company, any role — could have added themselves as
`boss`/`superadmin` of an unrelated company via the real app, not just via
direct PostgREST access.

## What was NOT the problem

The Supabase **anon/publishable key itself is not a secret** — it is
designed to be exposed client-side, restricted entirely by what the
database grants that role. The actual defect was **authorization missing
at the function level**, compounded by a **second, independent** gap at
the Cloudflare dispatcher layer for the three `azolik_*` actions. Neither
gap depended on which Supabase key Cloudflare happens to hold
(`SUPABASE_KEY` being `service_role` vs `anon` is a separate, already-known,
already-tracked issue — see `docs/governance/CURRENT_STATE.md` — and would
not by itself have closed this hole, since `service_role` bypasses function
grants entirely and the dispatcher-layer gap was independent of any key).

## How found

Discovered during the Company Control Center schema/RPC audit
(T2-COMPANY-CONTROL-FOUNDATION-001, Section 1) — routine review of every
RPC touching `t2_kompaniya`/`t2_azolik`, checking each one's
`information_schema.routine_privileges` grantees against whether it had a
matching `_v1` (actor-checked, audited) replacement already shipped
elsewhere in the system.

## When closed

2026-09-03, same session it was discovered in.

**Evidence checked, and its actual limits**: `t2_audit_log` (`modul IN
('onboarding','control')`) has exactly one relevant row — a legitimate
`azolik_qosh` by `actor:4` (the owner) on 2026-09-02, made through the
**already-guarded** `_v1` path. This is not meaningful evidence either way
for the *legacy, unguarded* functions specifically, because they never
called `t2_audit_yoz` at all — an exploit through them would leave no row
here by construction. Checked instead: live `t2_kompaniya` (1 row, `versiya=3`
— consistent with ordinary dev iteration, not runaway tampering) and
`t2_azolik` (4 rows total, all recognizable team members/roles, none
unexplained). No sign of exploitation in the actual data, but this is
**not a formal guarantee** — only what direct inspection of current state
shows. Mitigating factor: this system never ships `SUPABASE_URL`/the anon
key to the browser (every write goes through server-side Cloudflare
Functions); the key was obtained during this audit via authenticated
Supabase project tooling, not by inspecting the deployed frontend, so the
realistic external discovery path was narrower than "anyone reading the
page source" — though not zero, since the anon key is designed to be a
publishable, non-secret credential once someone has the project ref.

## Replacement / current state

- DB: `revoke all ... from public, anon, authenticated` on all four legacy
  functions (migrations `t2_kompaniya_yangila_lock_down_p0`,
  `t2_legacy_azolik_royxat_sorov_lock_down_p0`) — `service_role` retains
  `EXECUTE`, matching every other write RPC in the system.
- Cloudflare: `sb-yoz.ts`'s `azolik_qosh`/`_rol_ozgartir`/`_ochir` now call
  the already-existing, already-director-checked `t2_azolik_*_v1` RPCs
  (`p_actor_id` from the verified session, never the request body;
  `p_operation_id` minted server-side). Role vocabulary tightened to match
  what `_v1` actually accepts (`superadmin`/`admin` were never grantable
  through this path in the `_v1` contract).
- `t2_kompaniya_yangila` has **no** `_v1` replacement yet — Cloudflare gets
  an explicit `sess.kompaniyalar` boss/superadmin membership check as an
  interim second layer; `t2_kompaniya_yangila_v1` (proper actor+audit+
  optimistic-lock command) is scoped in
  `T2_COMPANY_CONTROL_FOUNDATION_001_CONTRACT.md` Section 4, source-only
  under the current production freeze.
- `t2_royxat_sorov_qabul` (unversioned) revoked too; grep-confirmed no
  frontend/Cloudflare code ever called it (only `t2_royxat_sorov_qabul_v2`
  is wired) — narrowing-only, zero functional impact.

## Regression coverage

- `frontend/testlar/t2_kompaniya.test.cjs`'s RPC-allowlist oracle updated
  to assert the new `_v1` names (was already catching any RPC-surface
  change by design — this was an intentional, acknowledged rename, not a
  silent change).
- Reproduced-then-fixed methodology: each revoke and the dispatcher rewire
  were verified live (real PostgREST HTTP calls with the anon key, before
  vs after) before being called closed — not assumed correct from reading
  the SQL alone.
- Outstanding, tracked separately (not this incident's scope): a
  dedicated adversarial "forged company_id / forged role" test suite is
  Codex's assigned scope under T2-COMPANY-CONTROL-FOUNDATION-001 Section 2
  — extending the existing `t2_company_context_adversarial.test.cjs`
  oracle (20/20 on `fix/company-context-p0`) rather than a new one.

## Explicitly out of scope for this incident record

This document closes the incident. It does not itself authorize, scope, or
imply any GAS-execution migration, new auth architecture rewrite, or any
other expansion — those remain governed by their own separate task records
(`T2_GAS_EXIT_001.md`, `T2_COMPANY_CONTROL_FOUNDATION_001_CONTRACT.md`).
