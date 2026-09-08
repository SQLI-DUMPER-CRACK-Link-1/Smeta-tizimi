# PTO target state

## North star

One selected object is a durable operating context, not a page selection:

`Company → Project → Object → Period → PTO workspace`

From that context a PTO engineer can move through:

`Smeta → LRV → RES → Narx → Fakt → F2 import → pre-approval → approval/history → Nakopitelniy → official export → documents/evidence → Zayavka → audit/signals`.

The current repository does not yet meet this target. This document is the
accepted direction for implementation, not a completion claim.

## Context contract

The frontend workspace must carry:

- validated numeric `kompaniya_id` from the authenticated membership set;
- optional numeric `loyiha_id` and `obyekt_id`, always checked against the
  selected company;
- explicit period key, never an implicit browser date;
- selected source-document/revision when a document operation is active;
- last-known version for optimistic writes;
- context status: loading, valid, stale, missing, forbidden, or unavailable.

URLs should use IDs, for example:

`/admin/test/portfel?kompaniya=3&loyiha=7&obyekt=11&period=2026-09`.

A company change must clear or revalidate project/object/period. A refresh or
direct URL must restore the same valid context or show a clear recovery state;
it must never silently select the first object.

## Workspace surfaces

| Surface | Purpose | Required evidence |
|---|---|---|
| Overview | object health, open signals, completeness | server read model, no fabricated KPI |
| LRV / Smeta | source tree, RZ/BL/RS, quantity/norma, provenance | source revision and row IDs |
| RES / Narx | resource catalog, category, price basis | price source, NULL/zero distinction |
| Fakt | daily and aggregate entry | actor/date/unit/version/correction |
| F2 | source tree mapping, draft, exceptions | source amount and source row preserved |
| Approval/history | state transition and certified snapshot | append-only history or approved snapshot |
| Nakopitelniy | period/cumulative view | reproducible canonical ledger |
| Hujjatlar | source and official exports | R2/Drive/file registry/readback |
| Zayavka | requirement from work/resource context | no manual retyping of object/resource |
| AOSR / signals | quality evidence and management warnings | object/document linkage and audit |
| AI copilot | explain/search/prepare draft | named tool, scope, provenance, approval |

## Domain truth rules

1. AI is never a financial source of truth.
2. Missing is not zero; unknown values remain visible.
3. Imported source amount is not silently replaced by `qty × price`.
4. Negative corrections remain visible and linked to their cause.
5. Units are first-class; ambiguous conversions stop or require explicit rule.
6. Every write has actor, tenant, object, operation ID, version, timestamp and
   source/provenance where applicable.
7. Approved values do not change through historical recalculation.
8. Legacy GAS is a bridge only when its boundary and equivalence are explicit.
9. Every read and write is tenant/object scoped in server/RPC/DB layers, not
   merely in UI filters.
10. Legal formulas (Forma-3/KS-3 and similar) require an authoritative source.

## Delivery sequence

### P0 — safety and identity

- close object-only reads and unauthenticated upload;
- make tenant membership fail closed;
- add authenticated two-company isolation tests;
- publish a table/view/RPC ownership matrix.

### P0 — canonical PTO chain

- define stable source/document/row keys;
- map LRV/RES/F2/Fakt to canonical tables/RPCs;
- run isolated procurement, AOSR, document, mindmap and F2 SQL contracts;
- define approval/history and correction semantics.

### P1 — product workspace

- shared context provider and URL contract;
- route consolidation;
- evidence inspector and audit timeline;
- responsive table and loading/error/partial states.

### P1 — agent platform

- common provider policy;
- draft/review/commit boundary;
- durable event/audit and replay proof;
- named tools only.

## Non-goals without owner evidence

Do not implement or claim a legal formula, conversion table, certified export,
production migration, or official approval state merely from legacy code,
architecture prose, or a screenshot.
