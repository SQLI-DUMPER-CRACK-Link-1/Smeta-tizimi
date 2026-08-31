# Commercial V2 backend reconciliation

## Existing evidence

- Canonical contract candidate: `t2_shartnoma` (`frontend/src/api/t2-shartnoma.ts`). It carries `id`, `kompaniya_id`, contract number, value/NDs fields, `holat`, and `versiya`.
- Object binding candidate: `t2_shartnoma_bog`, queried by `obyekt_id`.
- Existing write façade: named `shartnoma_saqla` command, with `kompaniya_id` and expected version.
- Existing supplemental work candidate: `t2_qoshimcha_ish`.

## Do not create duplicate truth yet

Creating a new `t2_contract` beside `t2_shartnoma` would create a second commercial source of truth. First Claude must approve either an additive canonical extension of `t2_shartnoma` or a deliberate migration/reconciliation plan.

## Required V2 additions

1. Party relation with stable party/company IDs (not `taraf` text).
2. Scope binding supporting project/object/WBS with FK and tenant checks.
3. Commercial terms: advance, retention, payment days, warranty.
4. Change-order lifecycle with operation id, expected version, actor audit and approval.
5. Bounded contract list/details/commercial-summary read models, invoice/payment lineage.
6. Paired additive rollback and tenant/role acceptance SQL.
