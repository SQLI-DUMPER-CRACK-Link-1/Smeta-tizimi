# PTO information architecture

## Canonical workspace

`/admin/test` is the TIZIM_02 entrypoint. The intended navigation is:

1. **Overview / Portfolio** — company, projects, objects, health signals.
2. **LRV / Smeta** — source tree and current canonical work tree.
3. **Fakt** — daily entry, aggregate review, corrections.
4. **F2** — import preview, exceptions, draft, approval/history.
5. **Nakopitelniy** — period and cumulative certified view.
6. **RESURS / NARX** — resource requirements, categories, price provenance.
7. **HUJJATLAR** — source registry, revisions, Drive/R2 status, exports.
8. **ZAYAVKA** — requirement from selected work/resource context.
9. **AOSR / QUALITY** — evidence and hidden-work coverage.
10. **Signals / AI** — read-only explanations, anomalies, prepared drafts.

The night-run implementation exposes a safe workflow navigation slice in
`TestShell`: Portfolio, Smeta/F2, Resurs/Zayavka, and Aloqa/Hujjat. Existing
wrapper tabs remain functional but are not yet one durable object workspace.

## Route rules

- One canonical route per capability; wrapper tabs may be presentation only.
- Use numeric IDs in query/path context, not object names.
- On invalid/stale context, show a recoverable state with the reason.
- Direct URL and refresh must preserve company/object/period or ask for a
  valid selection; never choose the first object silently.
- Deprecated TIZIM_01 routes redirect with an explicit archive label.

## Object workspace screen

### Top context bar

`Company selector → Project selector → Object selector → Period selector →
source revision/status`.

### Center

The LRV/Smeta tree is the primary surface. It supports search, hierarchy,
virtualization, filters, inline Fakt where contractually safe, and row details.

### Right inspector

Tabs: `Evidence`, `Price`, `Fakt/F2`, `Audit`, `AI draft`. The inspector must
show why a value exists and why a row is blocked; it must not silently compute a
missing value.

### Status footer

Show source row count, mapped/unmapped count, missing price count, open signals,
operation progress, and last synchronized revision. Do not show a monetary total
unless its completeness and source are known.

## Migration from current UI

1. Keep existing `SmetaTree`, F2 import engine and named APIs.
2. Add shared context provider and URL serializer.
3. Adapt screens one at a time to consume context.
4. Add route-level direct URL tests and tenant/object mismatch tests.
5. Remove duplicated direct wrapper routes only after parity evidence.
