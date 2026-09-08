# F2 format corpus — sanitized profile

## Measured structures

The local read-only profile found F2-like sheets in several structural
families:

- six-sheet mixed workbook: `СТЕЛЛА-3`, two F2-looking sheets, `Водопровод`,
  `Полив`, and `1 (2)`; one sheet reached `A1:M2496`;
- cover + F2 workbook: `ОБЛОЖКА тер)` and `ф2 Водопровод (2)`;
- large Fakt/F2 workbook: `ф2 Амфитеатр (fakt) (2)` reached `A1:BD2021`;
- repeated LRV_PLUS fixtures with `_NARX_LOG` + `LRV` sheets.

The profile records formulas and merged ranges but no raw cell values. Formula
counts and merged-range counts vary substantially; a fixed row number or fixed
column layout is unsafe.

## Existing contract evidence

`frontend/testlar/t2_f2import.test.cjs` passed 52/52 in the repository runner.
Its assertions cover:

- hierarchical source-tree flattening and parent assignment;
- same-name rows in different sections;
- negative volume preservation;
- omission of quantity-less rows;
- price-zero omission;
- unit mismatch blocking;
- mandatory/reused operation ID;
- separation of preview from import;
- a complete matched/unmatched registry.

This is strong deterministic source evidence, but the database contract and
live persistence were not executed.

## Required canonical F2 record

Every imported row must preserve:

`source_file_hash, source_document_id, sheet, source_row, source_tree_key,
canonical_work_id, canonical_resource_id, quantity, unit, source_unit_price,
source_amount, mapping_status, exception_reason, operation_id, actor_id,
created_at, correction_of`.

`source_amount` must remain separate from any derived amount. Negative
corrections must not be discarded. Additional/replacement rows must remain
explicit. Approved rows must not be rewritten by later imports.

## Open gates

- canonical F2 tables/RPC ownership and migrations are incomplete in the
  inspected set;
- approval/history and immutable snapshots are unproven;
- 60k-row import, resume/retry and partial-failure tests are absent;
- official export uses certified values is unproven;
- no authenticated two-company runtime smoke was executed.

## Next action

Run the F2 SQL contract against a disposable Supabase database, compare the
server allowlist with actual RPC signatures, store source provenance, and add
retry/resume/idempotency tests before production use.
