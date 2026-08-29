# CONSTRUCTION DOMAIN GRAPH V1 (TIZIM_02 AUDIT)

## 1. Current Entities
- **Project/Object Management**: `t2_loyiha` (Project), `t2_obyekt` / `obyektlar` (Object), `t2_obyekt_qatnashchilar` (Participants)
- **Catalog/Master Data**: `t2_resurs_katalog` (Material/Resource Master), `narxlar` (Prices)
- **Contract & Finance**: `shartnoma` (Contract), `tolovlar` (Payments), `t2_faktura` (Invoices EHF)
- **Estimating & Execution**: `holat` (BOQ/WBS), `material_kerak` (BOQ Materials), `akt`, `akt_ish` (F2/Completed Works)
- **Procurement & Warehouse**: `viborka_nazorat` (Material Needs), `t2_birja_rfq`, `t2_birja_taklif` (Bidding), `t2_sklad_mustaqil`, `prixod`, `rashod`, `t2_sklad_harakat`, `t2_sklad_qoldiq`
- **System**: `t2_audit_log`, `anomaliya`, `system_config`

## 2. FK Graph & Relations (Correct, Weak, Missing)

| Source | Target | Cardinality | Ownership | Meaning | Current DB Support | Required Change | Priority |
|---|---|---|---|---|---|---|---|
| `t2_loyiha` | `t2_obyekt` | 1:N | Project owns Objects | A project consists of multiple construction objects/phases. | Weak (`loyiha_id` added but not strictly enforced in all legacy tables) | Enforce `loyiha_id` across finance/reports. | P1 |
| `t2_obyekt` | `holat` | 1:N | Object owns BOQ | BOQ lines belong to a specific object. | Correct (`obyekt` FK exists) | None | P2 |
| `shartnoma` | `t2_obyekt` | 1:N / N:M | Loose | Contract covers objects | Weak (`shartnoma_no` text in `obyektlar`) | Use proper FK to `t2_loyiha` or `t2_obyekt` | P0 |
| `t2_resurs_katalog` | `holat` / `material_kerak` | 1:N | Global Catalog | BOQ items map to Master Catalog | Missing (Smeta uses string keys `_normNomKey`) | Add `katalog_id` to `material_kerak` and `holat` | P0 |
| `material_kerak` | `viborka_nazorat` | 1:1 / 1:N | Loose | Estimate materials trigger procurement | Weak (No hard FK, mapped by string names) | Link Viborka explicitly to `material_kerak.id` or `katalog_id` | P0 |
| `viborka_nazorat` | `t2_birja_rfq` | 1:N | Procurement | Viborka sends requests to RFQ (Birja) | Missing | Add `viborka_id` to `t2_birja_rfq` | P1 |
| `t2_birja_taklif` | `shartnoma` | N:1 | Supplier Win | Winning bid creates a supplier contract | Missing | Link winning bid to `shartnoma.id` | P1 |
| `shartnoma` | `prixod` / `t2_sklad_harakat` | 1:N | Contract limits Delivery | Receipts are tied to supplier contracts | Missing (`postavshik` is text) | Add `shartnoma_id` to `prixod` / `t2_sklad_harakat` | P0 |
| `prixod` / `t2_sklad_harakat` | `t2_faktura` | N:1 | Receipt matches Invoice | Received goods are invoiced via EHF | Missing | Add `faktura_id` to warehouse receipts | P0 |
| `t2_faktura` | `tolovlar` | 1:N | Invoice paid by Payments | Payments cover invoices | Missing | Add `faktura_id` to `tolovlar` | P1 |
| `akt` (F2) | `holat` / `akt_ish` | 1:N | Act covers BOQ | Completed works cover specific BOQ lines | Correct (`akt_ish` exists) | None | P2 |

## 3. Structural Analysis & Separation

### Material Master
Currently, there is a split between `narxlar`, `t2_resurs_katalog`, `material_kerak`, and `viborka_nazorat`.
The system relies on string-based matching (`_normNomKey`, `nom`) causing normalization issues.
**Target**: `t2_resurs_katalog` must be the singular Material Master (Authoritative brain). All BOQ (`material_kerak`), procurement (`viborka_nazorat`), and warehouse (`t2_sklad_qoldiq`) records must strictly reference `katalog_id`.

### PBS / WBS / BOQ Separation
Currently, `holat` acts as a flat BOQ (with `varaq`, `qator`, `razdel`).
**Target**: True construction ERP requires Product Breakdown Structure (PBS) and Work Breakdown Structure (WBS) separation.
*PBS*: `t2_obyekt` -> `Blok` -> `Qavat`.
*WBS*: `Fazalar` -> `Ish turlari`.
*BOQ*: Fits under WBS/PBS intersection.
Priority: P1 (Can map hierarchically using `razdel` or `parent_id` in `holat`).

### Target Procurement Chain
Current: Disconnected tables/sheets (Smeta -> Viborka -> Sklad).
**Target Chain**:
`holat` (BOQ) -> `material_kerak` (Needs) -> `viborka_nazorat` (PR: Purchase Request) -> `t2_birja_rfq` (RFQ) -> `t2_birja_taklif` (Bids) -> `shartnoma` (PO/Contract) -> `t2_sklad_harakat` (GRN/Receipt) -> `t2_faktura` (Invoice) -> `tolovlar` (Payment).

### Contract Model
Currently, `shartnoma` table acts as both Client contracts (Income) and Subcontractor/Supplier contracts (Expense).
**Target**: Requires a `tur` (type) categorization (Main Contract vs Subcontract vs Supplier) or self-referencing. Must explicitly link to `loyiha_id`.

### Estimate Revision / Change Orders
Currently, there is no explicit Change Order (Qo'shimcha kelishuv / dop.soglasheniye) tracking. `holat` gets overwritten, and `tarix` records the differential log.
**Target**: Needs a `smeta_revisions` or `change_orders` table to strictly isolate Baseline vs Actual vs Authorized Changes, preserving optimistic versioning (avoiding silent overwrites).
Priority: P1.

### Warehouse Ledger
`prixod` and `rashod` exist as flat logs alongside the newer `t2_sklad_harakat` and `t2_sklad_qoldiq`.
**Target**: Unify warehouse ledger entirely into `t2_sklad_harakat` (double-entry ledger style) and deprecate flat `prixod`/`rashod` tables to avoid dual truths. Ensure `operation_id` or `idempotency_key` is present to avoid double counting.

### Invoice / Payment Lineage
`tolovlar` (Payments) are currently tied to `shartnoma_no` (text) but not explicitly linked to `t2_faktura` (Invoices).
**Target**: Payment matching to specific Invoices (Accounts Payable / Accounts Receivable aging tracking).

### Schedule Linkage
No native scheduling (Gantt) entities exist in the current schema.
**Target**: Need `t2_jadval` (Schedule/Milestones) linked to `holat` or `t2_obyekt` to track time vs execution (Planned vs Actual Dates). Priority: P2.

### Cross-Company Project Model
`t2_obyekt_qatnashchilar` is correctly designed for cross-company access (Client, Gen-podryad, Sub-podryad).
**Target**: Enforce RLS (Row Level Security) using this junction table so sub-contractors only see their allowed scope (avoiding full project exposure).

---
## 4. Migration Priorities
- **P0**: Material Master mapping (`katalog_id`), Unify Warehouse Ledger (`t2_sklad_harakat` over legacy `prixod`), Link Contracts to Invoices (`faktura`) and Receipts (GRN).
- **P1**: Project -> Object -> WBS/PBS hierarchical support, Change Orders (Revisions tracking), Procurement Chain strict FKs.
- **P2**: Schedule linkage.
