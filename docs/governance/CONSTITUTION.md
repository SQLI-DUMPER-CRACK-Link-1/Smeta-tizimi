# TIZIM_02 Constitution

Status: canonical, current. This file contains non-negotiable rules; a lower
level document or agent instruction cannot silently override it.

## Truth and ownership

- Supabase/Postgres is the authoritative business truth for TIZIM_02.
- Google Sheets/GAS is a client and controlled mirror/bridge, not a competing
  source of truth. Drive stores original documents and evidence.
- One entity has one canonical ID and one source of truth; many screens/views
  may project it. The mindmap is a projection/control plane, not entity storage.
- Natural relation tables remain canonical. Do not introduce a universal edge
  table.

## Financial and AI integrity

- `NULL` means unknown/not supplied; it is never silently converted to zero.
- No fake prices, quantities, dates, coordinates, KPIs, or financial data.
- AI may parse, classify, retrieve candidates and explain ambiguity. It must
  not invent norms, prices, resource consumption or missing facts.
- Deterministic database/domain engines calculate quantities, coefficients,
  resource expansion, totals, F2/Fakt/Smeta invariants and remaining values.
- Existing F2, Fakt and Smeta invariants are preserved; violations are explicit
  errors or warnings, never silently corrected.

## Commands, security and concurrency

- All writes go through named, reviewed commands/RPCs; clients cannot submit
  arbitrary SQL or choose an RPC dynamically.
- Tenant boundaries are enforced in the database as well as at the gateway.
- The authenticated actor is recorded. `operation_id` is caller-generated,
  stable across retries and idempotent for the command scope.
- Mutable records use optimistic locking (`versiya` plus expected version).
  Stale writes fail; last-writer-wins is not acceptable.
- Soft-delete/status semantics and audit history are retained where the domain
  requires them.

## Change safety

- Production migration, destructive DDL, hard delete, truncation, deployment,
  and `main` push require explicit human approval.
- Additive, forward migrations are preferred. Never rewrite historical
  journals to make the present look clean.
- Every change must identify its evidence, tests, owned paths and unresolved
  assumptions. A green regex is not proof of runtime behavior.

## Release gate — product-facing releases

- A **product-facing release is NOT complete** until the **authenticated owner
  vertical smoke** passes on a live build. Anonymous / unauthenticated checks
  (endpoint liveness, `401` fail-closed behavior, read-model `ok:true`) are
  necessary but **not sufficient** — NEXT-MAIN-RELEASE-V1 proved this: it passed
  every anonymous check yet shipped a company-context provider placement error
  that broke every canonical `/admin/*` page for the signed-in owner.
- The owner smoke covers, at minimum: real login; the active-context indicator;
  each canonical business route opening without a raw error banner; company
  switch with no stale data; refresh and direct-URL context; logout/login.
- `frontend/functions/**` must pass its own TypeScript gate
  (`tsconfig.functions.json`, run by `npm run build` and `npm run tekshir`);
  the main `tsc -b` does not cover that layer.

## Authority order

`AGENTS.md` defines boot procedure; this Constitution defines rules;
`CURRENT_STATE.md` defines measured present state; accepted architecture/ADR
contracts define implementation details. `tizim02/MULOQOT.md`, reviews and
old reports are historical evidence only, not current-state truth.
