# TIZIM_01 → TIZIM_02 real gaps

This is a migration map, not a claim that TIZIM_01 is the source of truth.
TIZIM_01/GAS is retained as behavior/document evidence until TIZIM_02 proves an
equivalent canonical contract.

| T1 capability | Why users need it | Current real behavior | T2 equivalent | Gap | Migration strategy | Acceptance test | Archive/deprecation decision |
|---|---|---|---|---|---|---|---|
| Smeta/Google Sheets import | Import real LRV/RES files and preserve sheets | `/admin/test/smeta` delegates core upload/import to `gas()` and GAS endpoints | `TestImport`, `t2_*` adapters | T2 persistence/provenance not proven | Define source document/revision/row keys; move read/normalize/write behind named T2 command; retain GAS as explicit bridge only | real/sanitized LRV/RES variants, source row and operation readback | keep bridge until parity; no silent GAS dependency |
| F2 file read/matching | Map F2 rows to estimate tree | Legacy reader + tested T2 flatten/match engine | `TestF2Import`, `t2_f2import` contract | DB write and source amount lineage unproven | Separate source tree, mapping draft, commit command; preserve negative rows and unit shield | `t2_f2import.test.cjs` plus isolated DB import/retry | archive duplicate reader after parity |
| Document roles/sheets | Attach LRV/RES/F2 source to object | Modern object-document contract and GAS/Drive bridge exist | `t2-aosr`/document APIs | storage ownership and runtime Drive unavailable | canonical object-document registry, source hash, sheet selection, readback | 74/74 document contract + authenticated upload/readback | retain Drive bridge as integration boundary |
| LRV_PLUS / cumulative statement | PTO reads work/resource totals | legacy Sheets formulas and architecture references | no proven canonical ledger | Nakopitelniy source and period semantics missing | owner-approved ledger/read model; import certified values, do not recalc history | period replay with correction and approved snapshot | no archive until ledger parity |
| Fakt daily entry | record site completion and corrections | named server operation exists; negative correction allowed | `t2-fakt` / `t2_akt` candidates | amount/unit/history/idempotency inconsistent | define exact row model and immutable correction relation | daily set/add, retry, conflict, negative correction | legacy mirror only after readback parity |
| F2 approval and history | certify official period state | UI/dispatch symbols exist but no proven immutable SQL | no accepted T2 state machine | approval semantics and rollback unresolved | owner decision; append-only approved snapshot + reversal | cross-period historical replay | no archive; blocked |
| Price catalogue and markup | price resource rows and contract totals | T2 read/adapters plus legacy pricing | `t2_narx`, `t2_nakrutka` candidates | source/formula/NULL policy not authoritative | canonical price source with basis/source/frozen/at-risk flags | NULL, zero, revision, rounding and tenant tests | retire legacy only after formula evidence |
| Procurement request | derive requirements from object/resource | T2 UI and migration candidate exist | `t2_erp_taminot` / procurement contract | SQL not executed; over-delivery rules unclear | execute isolated contract; link request to work/resource ID | lifecycle and remaining quantity tests | T1 feature can be retired after readback |
| AOSR/quality evidence | prove hidden work and quality records | T2 API and M:N link surface exists | AOSR named operations | canonical SQL/RLS/coverage not proven | map object/document/work row, immutable evidence and coverage | duplicate link, version conflict, object mismatch | retain legacy as evidence only |
| R2/official export | deliver controlled files | upload/export surfaces exist | object/document registry | `/api/upload` auth gap, official values uncertified | server-derived ownership, certified snapshot, export registry | auth, hash, readback, retry and deletion policy | no archive until security gate |
| M-29 / stock history | resource movement and audit | visible placeholders in TestSklad | no accepted T2 command | controls are not real actions | implement named commands or mark unavailable | add/issue/reversal and audit | archive only after parity |
| CRM/Didox/EDO | external business communication | partial screens; Didox lookup or sales CRM unfinished | no complete T2 contract | external integration and auth unavailable | explicit integration adapter, no fake success | provider sandbox/readback | keep legacy/blocked |
| Forma-3 / KS-3 | official legal/commercial output | planning references only | none proven | rule/template missing | obtain authoritative source and owner approval | formula + certified snapshot tests | blocked, do not invent |

## Migration law

1. Prove the T1 behavior against real/sanitized evidence.
2. Map it to canonical numeric T2 IDs.
3. Implement named T2 read/write paths with server/DB scope.
4. Run regression and provenance tests.
5. Make the canonical route use T2.
6. Deprecate the old UI only after readback and rollback evidence.

No new business flow may silently fall back to GAS when a canonical T2 path
exists. No legal or financial formula is inferred from legacy behavior.
