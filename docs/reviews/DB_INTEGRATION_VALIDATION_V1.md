# TIZIM_02 DB integration validation V1

## Status: PASS (transactional live validation; disposable branch limitation recorded)

Scope was limited to the Mindmap Command Contract V2 and Procurement Request
Contract V1. No production DDL, migration runner, migration repair, table
drop, column drop, or hard delete was performed by this validation. Acceptance
mutations were executed inside BEGIN ... ROLLBACK, so production data was not
changed.

## Target and baseline

| Check | Result |
| --- | --- |
| Supabase project | tuoyrzadkgoltpqkdiyx (Smet-01) |
| Disposable Supabase branch | unavailable: project plan returned PaymentRequiredException (Pro+ required) |
| Existing migration history | 109 remote versions; includes 20260829051300 procurement, 20260829051309 signal, 20260829051320 mindmap, and signal/read-model follow-ups |
| t2_erp_taminot | present; canonical fields plus material_id, required_date, priority, note, operation_id, version, updated_at |
| t2_obyekt / t2_azolik / t2_loyiha_qatnashchi | present and tenant-linked |
| Mindmap relation tables | natural link tables present (t2_shartnoma_bog, t2_sklad_bog, t2_texnika_bog, t2_kadr_bog); no universal t2_mindmap_bog table |
| Existing RPCs | V2 command RPCs, graph/read RPCs, procurement lifecycle RPCs, and t2_erp_amal present |

The branch limitation is an environment constraint, not a production
permission to apply unverified SQL. Live validation therefore used read-only
catalog checks and rollback-wrapped calls against the already migrated schema.

## Mindmap acceptance

Executed with company 1, superadmin actor 4, project 4, and object 6.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Valid same-tenant link | PASS | t2_mindmap_bog_v2 returned a receipt |
| Retry with same operation_id | PASS | receipt count stayed 1 |
| Cross-tenant link | PASS (rejected) | SQLSTATE 42501, tenant assertion |
| Stale expected_version | PASS (rejected) | SQLSTATE 40001 |
| Unlink | PASS | natural FK cleared; entity row remained |
| Invalid relation | PASS (rejected) | SQLSTATE 22023 |

## Procurement acceptance

Executed with company 1, object 6, and a rollback-wrapped request.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Create request | PASS | request created in draft, version 1 |
| Same operation_id retry | PASS | same request returned, no duplicate |
| Tenant ownership | PASS | object assertion rejects foreign tenant |
| Valid lifecycle | PASS | draft → submitted → approved → procurement → ordered → partially_delivered → delivered → closed |
| Invalid transition | PASS (rejected) | P0001 |
| Optimistic version conflict | PASS (rejected) | SQLSTATE 40001, expected/actual versions reported |
| Partial delivery | PASS | delivered 4, remaining 6 |
| Final delivery/derived remaining | PASS | delivered 10, remaining 0 |
| Object event tenant boundary | PASS | same tenant returned 4 rows; foreign tenant rejected 42501 |

The test SQL is retained in
[supabase/tests/t2_mindmap_command_contract_hardening.sql](../../supabase/tests/t2_mindmap_command_contract_hardening.sql)
and
[supabase/tests/t2_procurement_request_contract_v1.sql](../../supabase/tests/t2_procurement_request_contract_v1.sql).

## Backward compatibility and invariants

Existing request rows remained readable through t2_zayavka_royxat; canonical
column aliases and derived quantities were preserved. t2_mindmap_grafi(1),
t2_ai_kontekst(6), and t2_invariant_tekshir() completed successfully. The
invariant check retained its pre-existing warning for draft act akt#19; this
was not changed or hidden.

## Root causes found

1. The earlier validator report was stale: remote migration history advanced
   from 106 to 109 outside this validation session.
2. Supabase branching is plan-gated, so a disposable hosted branch could not be
   created.
3. A2 introduced escaped JSX/string literals in TestZayavka.tsx; A3 left two
   sibling buttons without a JSX parent.
4. The source guard expected legacy Mindmap RPC names while the canonical adapter
   exposes only V2 names.

## Repair and safety record

- Repaired A2/A3 frontend syntax and adapted calls to canonical DTO/RPC
  signatures.
- Updated the RPC guard to the actual V2 allow-list.
- Renamed repository migrations to the already-applied remote versions:
  20260829051300_t2_procurement_request_contract_v1.sql and
  20260829051320_t2_mindmap_command_contract_hardening.sql.
- Kept t2_signal proposal outside the executable migration chain; the remote
  history has a live-only 20260829051309 entry that still needs an approved
  source SQL export before it can be canonicalized.
- No (1) duplicate was deleted or overwritten.

## Remaining blockers

- Obtain a trusted full DDL export (or enable a disposable Supabase branch) to
  close live-only migration/source drift, especially t2_signal and its read
  models.
- The production migration history was created outside this branch; release
  ownership must reconcile the canonical files with the remote history before
  any future db push.
- Existing invariant warning akt#19 remains for a separate, non-destructive
  cleanup decision.
