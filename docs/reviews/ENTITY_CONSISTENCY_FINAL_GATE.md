# ENTITY CONSISTENCY FINAL GATE

**Date:** 2026-08-29  
**Scope:** read-only consistency audit; no feature implementation  
**Result:** **BLOCKED (P0 findings remain)**

## Evidence basis

- Live Supabase project `tuoyrzadkgoltpqkdiyx` schema, views and `t2_mindmap_grafi` definition were queried through the Supabase integration.
- Frontend adapters, Pages gateway allowlists and module tabs were inspected in `frontend/src/api/`, `frontend/src/test02/` and `frontend/functions/api/`.
- A destructive production round-trip was not run. No disposable tenant/fixture and no rollback test harness is present, so CREATE/EDIT/DELETE claims are based on the real RPC/view paths and their code contracts.

## Findings

### P0 — zayavka has no graph entity identity

- **File/contract:** live `public.t2_mindmap_grafi`; `frontend/src/api/t2-mindmap.ts`; `frontend/src/api/t2-zayavka.ts`
- **Symptom:** procurement CREATE writes `t2_erp_taminot` and the module READ uses `t2_zayavka_royxat`, but the graph emits only an `obyekt` node with an aggregate `zayavka` count. It emits no `zayavka:<id>` node and no edge carrying the request ID.
- **Root cause:** the graph SQL models open requests as an object-level counter (`zayavka`), not as the same request entity returned by the module tab.
- **Required fix:** add a canonical request read/identity projection to the graph contract (or explicitly change the gate contract to accept aggregate-only requests), with tenant filtering and a stable request ID. Until then `Module Tab CREATE → base table → Mindmap graph → SAME ID` cannot pass for zayavka.

### P0 — resource entities cannot complete edit/soft-delete round-trip

- **File/contract:** `frontend/src/api/t2-resurs.ts`; `frontend/functions/api/sb-yoz.ts`; live RPC inventory
- **Symptom:** sklad, texnika and kadr have CREATE RPCs and relation link/unlink, but no module adapter or gateway action for entity edit or soft-delete. Live functions expose `t2_sklad_yarat`, `t2_texnika_yarat`, `t2_kadr_yarat` only for these entity writes.
- **Root cause:** resource lifecycle was implemented as create + relation operations; entity update/delete contract was not provided.
- **Required fix:** define and expose versioned tenant-scoped update and soft-delete RPCs, then wire both module and graph reads to the same base row. Until then edit and delete round-trip is untestable and fails the requested gate.

### P0 — tenant boundary bypass through unscoped object reads

- **File:** `frontend/src/api/supabase.ts:274-275`, `frontend/src/test02/TestSklad.tsx:40`, `frontend/functions/api/sb.ts:218-223`
- **Symptom:** `sbT2ObyektlarOl()` reads `t2_obyekt_jami` without `kompaniya_id`; the gateway only checks membership when the filter contains an explicit `kompaniya_id=eq.N`. Several module tabs call this helper.
- **Root cause:** tenant enforcement is conditional on caller-supplied filter text rather than mandatory for every tenant-owned read.
- **Required fix:** remove unscoped helper usage and make the read gateway require a server-derived tenant boundary for `t2_obyekt_jami` and all tenant-owned views. Cross-tenant same-ID round-trip must be rejected.

### P1 — resource relation projections do not enforce object tenant equality

- **File/contract:** live views `t2_sklad_royxat`, `t2_kadr_royxat`, `t2_texnika_royxat`
- **Symptom:** nested `obyektlar` JSON joins junction rows to `t2_obyekt` by `id` only. The parent resource is filtered by its company in the API, but the nested object join has no `o.kompaniya_id = parent.kompaniya_id` predicate.
- **Root cause:** tenant filtering was applied to the outer resource row, not to the relation projection.
- **Required fix:** enforce company equality in each relation join and add cross-tenant junction fixtures to contract tests.

### P1 — project view leaks soft-deleted child objects

- **File/contract:** live view `t2_loyiha_royxat`
- **Symptom:** the view excludes soft-deleted projects (`holat <> 'bekor'`) but its `obyektlar` and `obyekt_soni` subqueries do not exclude `t2_obyekt.holat = 'bekor'`.
- **Root cause:** parent soft-delete predicate was added without applying the same lifecycle predicate to child projections.
- **Required fix:** add `o.holat <> 'bekor'` to both child subqueries and test delete → module refetch → graph refetch.

### P1 — graph and module IDs are not literally the same value

- **File/contract:** live `t2_mindmap_grafi`
- **Symptom:** graph IDs are strings such as `loyiha:123`, `shartnoma:123`, `obyekt:123`; module tabs return numeric `123`.
- **Root cause:** graph uses a prefixed polymorphic node key to avoid collisions between entity types.
- **Required fix:** document and test an explicit `entity_type + numeric_id` identity mapping, or return a separate numeric `entity_id`. Under the literal “SAME ID” requirement this currently fails identity equality.

### P2 — stale-cache/refetch evidence is incomplete

- **File:** `frontend/src/test02/TestLoyiha.tsx`, `TestErp.tsx`, `TestSklad.tsx`
- **Symptom:** create handlers call a local refetch, but there is no shared query cache/invalidation contract connecting module lists and the mindmap graph. The graph is fetched independently.
- **Root cause:** imperative local state refresh rather than a shared mutation result/cache invalidation boundary.
- **Required fix:** after successful mutation, invalidate/refetch both the module projection and graph read model; add a browser/integration test asserting the same ID after refetch.

## Entity matrix

| Entity | Mindmap → base → module same ID | Module → base → graph same ID | Edit | Soft delete | Result |
|---|---|---|---|---|---|
| loyiha | Path exists; graph uses `loyiha:<id>` | Path exists; prefixed graph ID | RPC exists | RPC exists | **P1 identity / child-delete issue** |
| shartnoma | Relation/node path exists; prefixed graph ID | Path exists; prefixed graph ID | RPC exists | RPC exists | **P1 identity** |
| kontragent | Relation/node path exists; prefixed graph ID | Path exists; prefixed graph ID | No dedicated update adapter | Soft-delete RPC exists | **P1 identity** |
| sklad | Node/relation path exists | CREATE path exists | **Missing** | **Missing** | **P0** |
| texnika | Node/relation path exists | CREATE path exists | **Missing** | **Missing** | **P0** |
| kadr | Node/relation path exists | CREATE path exists | **Missing** | **Missing** | **P0** |
| zayavka | Aggregate count only; no request node | No request node/ID | Lifecycle transition only | Cancel lifecycle only | **P0** |
| obyekt projection | Graph node and module view derive from `t2_obyekt` | Same base row, but prefixed graph ID | RPC exists | RPC exists | **P0 tenant/read path; P1 identity** |

## Automated checks

- `cd frontend && npm run build` — **PASS**
- `cd frontend && npm run test` — **PASS** (5 files, 13 tests)
- `cd frontend && npm run tekshir` — **PASS**

## Gate decision

**BLOCKED.** P0 findings remain. No PASS may be issued until zayavka receives a stable graph identity, resource edit/soft-delete contracts exist, and all tenant-owned object reads are server-bounded.
