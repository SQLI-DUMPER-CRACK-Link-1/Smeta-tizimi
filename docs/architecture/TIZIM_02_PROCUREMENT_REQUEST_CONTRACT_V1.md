# TIZIM_02 Procurement Request Contract V1

## Canonical decision

`t2_erp_taminot` is the single procurement-request truth. V1 evolves that
table in place; it does not create a parallel `zayavka` table. The read view
`t2_zayavka_royxat` exposes legacy A2 aliases and V1 names from the same row.
`remaining_qty` is always derived as `requested_qty - delivered_qty`.

## Contract comparison

| Concern | Legacy database artifact | Current A2 client | V1 canonical contract |
|---|---|---|---|
| Stored item | `maxsulot` | `maxsulot` | `item_text`; view retains `maxsulot` alias |
| Requested quantity | `miqdor` | `miqdor` | `requested_qty`; view retains `miqdor` alias |
| Status | `kutilmoqda/tasdiqlandi/yopildi/rad` | varies: legacy, `rejected`, and target-like values | target lifecycle below; `cancelled` only |
| Delivery | absent | `yetkazilgan_miqdor` display | `delivered_qty`; remaining is derived |
| Date/priority/note | absent | `kerakli_sana/muhimlik/izoh` | `required_date/priority/note`; view retains aliases |
| Idempotency/version | absent | not sent by the current adapter | caller-supplied `operation_id` and mandatory `kutilgan_versiya` for transitions |
| Object events | client filters only `obyekt_id` | same | `t2_hodisa_obyekt_lenta(kompaniya_id, obyekt_id, limit)` requires both boundaries |

The existing A2 request payload must add `operation_id` on create, and both
`operation_id` and `kutilgan_versiya` on a transition before it can call the
V1 RPC successfully. This is an intentional compatibility gap: generating an
operation identifier in the server would violate retry idempotency.

## Canonical fields

| Field | Rule |
|---|---|
| `id`, `kompaniya_id`, `obyekt_id` | Immutable identity and tenant/object ownership boundary. |
| `material_id` | Nullable until a material master is authoritative. |
| `item_text` | Required fallback item description. |
| `requested_qty`, `unit`, `required_date`, `priority`, `note` | Request details; quantity must be greater than zero. |
| `requested_by`, `approved_by` | Actor audit fields; create requires requester, approval records approver. |
| `status` | State machine truth. |
| `delivered_qty` | Stored operational fact, from zero through requested quantity. |
| `remaining_qty` | View/RPC-derived only; never stored. |
| `operation_id` | Caller-provided UUID for creation; operation ledger records every idempotent mutation. |
| `version` | Optimistic-lock token; increments on every transition. |
| `created_at`, `updated_at` | System timestamps. |

## Status transition matrix

| From | Allowed next status |
|---|---|
| `draft` | `submitted`, `cancelled` |
| `submitted` | `approved`, `cancelled` |
| `approved` | `procurement`, `cancelled` |
| `procurement` | `ordered`, `cancelled` |
| `ordered` | `partially_delivered`, `delivered`, `cancelled` |
| `partially_delivered` | `partially_delivered` with a strictly increased delivery quantity, `delivered`, `cancelled` |
| `delivered` | `closed` |
| `closed` | none |
| `cancelled` | none |

`delivered` requires `delivered_qty = requested_qty`; partial delivery requires
an increase that remains below the requested quantity. Thus status cannot be
used to claim a delivery that the quantities do not support.

## RPCs

- `t2_procurement_request_create(...)`: validates object tenant ownership,
  creates only `draft`, and returns the original request for a retry with the
  same operation UUID.
- `t2_procurement_request_transition(...)`: locks the request, enforces the
  expected version and transition matrix, and records the operation UUID.
- `t2_erp_amal(...)`: compatibility adapter for the existing Cloudflare
  gateway; accepts legacy field aliases but does not weaken V1 safeguards.
- `t2_hodisa_obyekt_lenta(...)`: parameterized object event read with both
  `kompaniya_id` and `obyekt_id` predicates.

## Verification and rollout

Run [20260829051300_t2_procurement_request_contract_v1.sql](../../supabase/migrations/20260829051300_t2_procurement_request_contract_v1.sql)
and then [t2_procurement_request_contract_v1.sql](../../supabase/tests/t2_procurement_request_contract_v1.sql)
only in a disposable/dev database with `t2.test_kompaniya_id` and
`t2.test_obyekt_id` configured. The test rolls back every write.

No production schema was applied by this change.
