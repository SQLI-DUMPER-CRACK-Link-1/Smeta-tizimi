# RES format corpus — sanitized profile

## Measured local evidence

The read-only profile found one tracked resource-like CSV:

- `abc_resurs.csv`: 123,573 bytes, 41 maximum columns.

Two DOCX catalog records were also profiled (`Jihozlar_Katalogi.docx` and
`Jihozlar_Katalogi_Yangi.docx`), each with 73 paragraphs and one table. These
are catalog evidence, not proof of the canonical RES schema. The local profile
contains 33 XLSX containers, but most are LRV/F2 mixed or LRV_PLUS families;
a separate authoritative RES workbook family was not proven.

## Required RES normalized contract

| Field | Required behavior |
|---|---|
| Resource code | Preserve source code; duplicate codes remain visible and are not silently merged. |
| Name | Preserve source text plus normalized search form; never use name alone as identity. |
| Unit | First-class value; T/KG and other mismatches block or use an approved conversion table. |
| Category | Explicit ЧЕЛ → МАШ → МАТ → ОБ → M/К → КАБ (or authoritative replacement); unknown remains unknown. |
| Price | Keep source, date/basis, currency and confidence; NULL is not zero. |
| Work relation | Trace resource to its source work/section/row. |
| Provenance | Source file hash, sheet, row, import operation, actor and timestamp. |

## Current implementation evidence

The repository has T2 resource/pricing adapters and legacy parser/test
material. The static F2 suite proves that a unit mismatch can be blocked and
that price-zero rows are not sent as valid prices. This is useful contract
evidence, not runtime proof of the complete RES catalog.

## Missing evidence

- representative real RES corpus (the Drive metadata lane was unavailable);
- category correction persistence and audit;
- duplicate code + same-name/different-unit behavior;
- resource price provenance/readback in canonical DB;
- large RES catalog performance and virtualized UI behavior;
- authenticated tenant/object scope for resource reads.

## Next action

Profile owner-approved RES CSV/XLSX variants without raw values in reports.
Create sanitized fixtures for header/category/unit/price variants, then add a
content-driven parser contract and canonical readback tests. Do not invent a
category or price when the source is ambiguous.
