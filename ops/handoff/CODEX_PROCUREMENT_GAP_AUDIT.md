# Procurement V2 gap audit

## Existing canonical evidence

- Request model/command contract: `supabase/migrations/20260829051300_t2_procurement_request_contract_v1.sql` and `frontend/src/api/t2-zayavka.ts`.
- Request reads use `t2_zayavka_royxat`, company filter, object filter, expected version and operation id on updates.
- RFQ surface: `frontend/src/api/t2-birja.ts` / `t2_birja_rfq`.
- Warehouse balance/movement: `frontend/src/api/supabase.ts` (`t2_sklad_qoldiq`, `prixod`/`rasxod`) and `t2-sklad-konsolidatsiya.ts`.

## Confirmed V2 gaps

1. No proven normalized chain from request line to RFQ line, bid line, award, PO, receipt, invoice allocation and payment allocation.
2. Material master may be optional (`material_id` nullable in request write), so name/text must not be promoted to identity.
3. Receipt/GRN and award lifecycle canonical tables/read models were not proven by this audit.
4. Warehouse and request facts need one bounded overview read model; do not join UI lists by display text.

## Claude/backend integration task

Extend the existing request truth additively with FK-based line lineage and lifecycle commands; preserve `t2_zayavka_royxat` compatibility. Require company/project/object scope, `operation_id`, expected version, audit, partial-receipt math and no over-receipt policy test.
