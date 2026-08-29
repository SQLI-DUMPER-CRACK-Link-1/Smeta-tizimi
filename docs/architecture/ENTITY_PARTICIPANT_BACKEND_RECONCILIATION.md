# TIZIM_02 entity command and project participant reconciliation

Date: 2026-08-30
Branch: `codex/entity-participant-backend`

## Executive result

The canonical participant relation is `public.t2_loyiha_qatnashchi`. It is a polymorphic party relation: exactly one of `kompaniya_id` (an internal company) or `kontragent_id` (an external contractor) is populated. `kompaniya_id` in the command context is the tenant and must not be copied into the party column for an external contractor.

The additive migration `20260830040000_t2_entity_participant_command_contract.sql` adds tenant-aware, actor-aware, idempotent V2 commands and routes the mindmap participant edge to the same command. It is a proposal only; it has not been applied to production.

## Canonical entities and current command surface

| Domain | Base table | Current create path | Contract status |
|---|---|---|---|
| loyiha | `t2_loyiha` | `t2_loyiha_yarat` through `sb-yoz` | legacy create; actor/operation/version are not part of the gateway payload |
| shartnoma | `t2_shartnoma` | `t2_shartnoma_saqla` | legacy command; preserve until a live catalog signature is verified |
| kontragent | `t2_kontragent` | `t2_kontragent_saqla` | tenant is supplied and RPC validates it; operation receipt is legacy |
| sklad | `t2_sklad_mustaqil` | legacy `t2_sklad_yarat` | V2 migration status must be checked before switching create clients |
| texnika | `t2_texnika_mustaqil` | legacy `t2_texnika_yarat` | same as sklad |
| kadr | `t2_kadr_mustaqil` | legacy `t2_kadr_yarat` | same as sklad |

Resource update/cancel V2 commands are already defined in `20260830030000_t2_resource_command_v2.sql`: `t2_resurs_yarat_v2`, `t2_resurs_yangila_v2`, and `t2_resurs_bekor_v2`. The repository cannot claim that the create migration is live without a Supabase catalog check and deployment approval.

## Exact root causes found

1. The original mindmap participant branch inserted `p_kompaniya_id` into `t2_loyiha_qatnashchi.kompaniya_id` even when `p_manba_id` was an external `kontragent_id`. That violates the existing one-party invariant and loses the distinction between tenant and party.
2. The module gateway sent the overloaded `kompaniya_id` field and did not send actor, tenant, operation id, or expected project version. Retries therefore could not be made a safe command.
3. The frontend action `mindmap_qatnashchi_bog` was present in the allow-list but had no dedicated parameter branch, so it fell through to the generic TODO response. It now shares the participant V2 dispatch; clients must send `tenant_id`, `expected_version`, and `operation_id`.
4. The graph projection currently emits only rows with a non-null `kontragent_id` and does not expose `rol` in the edge payload. Internal company parties therefore need a follow-up read-model replacement before the graph can be considered fully equivalent to the project tab.

## Canonical participant command

`t2_loyiha_qatnashchi_biriktir_v2` takes:

```text
p_kompaniya_id          tenant
p_actor_id              authenticated actor
p_loyiha_id             target project
p_taraf_kompaniya_id    internal party (nullable)
p_kontragent_id         external party (nullable)
p_rol                   zakazchik | bosh_pudratchi | subpudratchi |
                        loyihachi | taminotchi
p_kutilgan_versiya      project optimistic-lock version
p_operation_id          UUID command receipt key
p_izoh, p_actor_label    optional audit fields
```

The database validates active actor membership, tenant ownership of the project and external kontragent, exact-one party, role vocabulary, and the project version. Repeating the same `(tenant, operation_id)` returns the stored receipt; it does not insert another relation. Unlink uses `t2_loyiha_qatnashchi_ochir_v2` and sets `holat='bekor'` (soft delete).

Mindmap `t2_mindmap_bog_v2(..., p_tur='qatnashchi', ...)` and the module participant action dispatch to this same command. Non-participant mindmap relations continue through the renamed legacy implementation, preserving the existing natural-link model and avoiding a universal edge table.

## Tenant and role policy

The only accepted role spellings are `zakazchik`, `bosh_pudratchi`, `subpudratchi`, `loyihachi`, and `taminotchi`. `ta'minotchi` and `buyurtmachi` are not aliases for this relation. A kontragent from company A cannot be linked to a company B project, even if the gateway is bypassed, because the security-definer RPC checks the foreign row's tenant.

## Migration and rollout status

The change is forward-only and additive. It creates no universal edge table, does not drop or truncate data, and does not hard-delete participant rows. Apply it only after a disposable-branch acceptance run and explicit production approval. Before rollout, verify the live signatures of the legacy participant RPCs and the `t2_kompaniya.faol` column; the repository contains live-only history that may not be present in a fresh database.

## Acceptance coverage

`supabase/tests/t2_entity_participant_command_contract.sql` covers:

- same-tenant external participant create;
- all five role vocabulary values and invalid-role rejection;
- cross-tenant kontragent rejection;
- operation-id retry idempotency (one receipt and one active row);
- optimistic-lock input and soft unlink (`holat='bekor'`).

The test is transaction-wrapped, requires explicit fixture IDs, and always rolls back. It must never be run against production.
