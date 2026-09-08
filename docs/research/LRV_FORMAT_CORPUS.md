# LRV format corpus — sanitized profile

## Scope and evidence

A read-only profiler was added at `ops/handoff/profile_document_corpus.py`.
It stores relative path, SHA-256, sheet names/dimensions, row/cell counts,
formula counts and merged-range counts. It never stores cell values and never
modifies source documents. Profile output: `ops/handoff/corpus_profile.json`.

The local checkout yielded 38 document records overall. The LRV-relevant
sample is mostly unpacked Excel fixtures under `_f2lab/_unz`.

## Observed structural families

| Family | Observed shape | Count / evidence | Parser implication |
|---|---|---|---|
| LRV_PLUS workbook | `_NARX_LOG` + `LRV` | 27 XLSX directory containers share this sheet family | Detect by sheet structure/content, not filename; `_NARX_LOG` may have no dimension metadata. |
| Smeta with mixed sections | 6 sheets, including work/F2-looking sheets | 1 workbook; largest sheet reached `A1:M2496` | One workbook may mix sections and F2 sheets; sheet-level classification is required. |
| Cover + F2 | cover sheet + F2 sheet | 2 records | Cover/merged cells cannot be treated as data rows. |
| Single-sheet estimate | `Смета с изображениями` | 2 records | Images/merged header area require candidate header detection. |

The profile shows LRV sheets around 993–995 rows and approximately 30,753–
30,815 cells in the repeated LRV family. Formula and merged-range counts vary
by file; formulas are part of the source structure and must not be replaced by
blind static `qty × price` reconstruction.

## Required semantic extraction

The parser contract must discover, per sheet:

- candidate header rows and multi-row headers;
- work/section/resource hierarchy (RZ → BL → RS);
- source row identity and source sheet/row;
- code, name, unit, quantity/norma, unit price, source amount;
- category and section markers;
- formulas versus displayed values;
- merged-cell regions, blank-code rows and subtotal/total rows;
- explicit NULL/`--`/text markers and unit mismatch;
- provenance hash and import operation.

The current structural profiler intentionally does not inspect raw semantics.
The existing `t2_format.test.cjs` and `t2_f2import.test.cjs` provide static
coverage for header candidates, negative volume, unit mismatch and hierarchy,
but not the complete 30+ real-document corpus requested by the mission.

## Open gates

- Drive metadata/tool access was unavailable in the headless session.
- No 30-document authenticated/owner-confirmed LRV corpus was collected.
- No 50k-row import/virtualization performance gate was run.
- No canonical T2 persistence/readback was proven for imported rows.
- Source amount versus derived amount precedence remains `NEEDS_RULE_SOURCE`.

## Next action

Run the profiler against an owner-approved local/Drive export, add sanitized
fixtures for each structural family, then test parser output against source
sheet/row hashes. Never use a filename as the only format discriminator.
