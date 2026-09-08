# PTO acceptance matrix

Statuses are evidence-based: `WORKS`, `PARTIAL`, `BLOCKED`, `UNRESOLVED`,
`LEGACY_ONLY`, `MISSING`. No row is marked 100%.

| Capability | User route | Status | Source of truth | API/RPC | DB objects | Legacy dependency | Test evidence | Runtime evidence | Visual evidence | Security evidence | Performance evidence | Unresolved | Next action |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Company/object context | `/admin/test/*` | PARTIAL | Company provider + IDs | `sbT2KompaniyalarOl`, object reads | `t2_kompaniya`, `t2_obyekt` | none for company; object selection local | tenant static suite 15/15 | Supabase connected; route smoke absent | static only | object-only reads unsafe | none | durable object context | shared workspace URL/provider |
| Smeta import | `/admin/test/smeta` | LEGACY_ONLY | GAS import path | `gas()` / GAS APIs | legacy Sheets/Drive + candidate T2 | critical | format/F2 contract helpers | not run | build only | legacy auth/scope | large-file runtime absent | T2 ownership | isolate and migrate/approve bridge |
| LRV tree | `/admin/test/daraxt` | PARTIAL | T2 tree adapter | `t2_daraxt`, `t2_qator_holat` | `t2_qator` | object-only read path | format/F2 tests | not authenticated | tree source inspected | company filter incomplete | virtualization source exists | stable row provenance | DB contract + browser test |
| RES catalog | `/admin/test/logistika` / import | PARTIAL | CSV/Excel parser + T2 adapters | resource APIs | `t2_xom`, `t2_narx` candidates | parser legacy fixtures | F2 52/52; corpus profile | not run | no browser evidence | scope incomplete | no large RES gate | category/price source | parser corpus + runtime |
| Price / markup | `/admin/test/narxlar`, contracts | PARTIAL | candidate DB read model | `t2-narx`, `t2-shartnoma` | `t2_narx`, `t2_nakrutka` | legacy pricing | static contract only | not run | source only | RPC/RLS unproven | none | formula/source precedence | canonical DDL + tests |
| Fakt | `/admin/test/faktura`, `/portfel` | PARTIAL | named server operations | Fakt write dispatch | `t2_akt`, `t2_akt_qator` candidates | mirror/GAS references | static source only | not run | source only | nullable operation/scope unresolved | none | correction/history | isolated DB contract |
| F2 import | `/admin/test/smeta` | CONTRACT-TESTED / PARTIAL | tested import engine | import adapter | `t2_f2_import_job`, draft rows observed live | legacy file reader | 52/52 | not run | source only | persistence scope unproven | no 60k gate | canonical persisted lineage | DB run + provenance test |
| F2 approval/history | `/admin/test/smeta` / admin F2 | BLOCKED | no proven immutable snapshot | symbols/dispatch only | `t2_akt` candidates | legacy F2 controls | no approval SQL proof | not run | no evidence | state/RLS unknown | none | rule/state machine | owner decision + migration |
| Nakopitelniy | none coherent | UNRESOLVED | none proven | comments/legacy refs | none proven | LRV_PLUS/legacy | no canonical test | not run | no UI proof | unknown | unknown | ledger/period | define source and read model |
| Document control | `/admin/hujjatlar`, TestHujjat | PARTIAL | object-document contract | document named ops | `t2_obyekt_hujjat`, storage | Drive/GAS bridge | 74/74 document suite | no Drive tool | source only | upload ownership gap | no file-size gate | storage/R2 registry | authenticated upload/readback |
| F2 official export | `/admin/f2-tayyorlash` | BLOCKED | not certified | frontend surface | no deployed proof | legacy export | no runtime evidence | not run | no visual proof | approval not proven | none | legal/certified values | rule source + snapshot |
| Zayavka/procurement | `/admin/test/zayavka`, logistika | PARTIAL | procurement migration candidate | named request operations | `t2_erp_taminot`, request tables | none visible in UI | source contract inspected | live table counts only | source only | scope/RPC unproven | no load gate | over/negative delivery | isolated SQL test |
| AOSR/quality | `/admin/test/aosr` | PARTIAL | object-scoped AOSR adapter | `t2_aosr_*` candidates | AOSR registry/coverage candidates | legacy SQL | source contract only | not run | source only | object-only reads | none | canonical SQL | execute contract |
| Signals/management | `/admin/test/xarita`, boss | PARTIAL | `t2_signal` read model | mindmap/signal ops | `t2_signal` live count 1805 | none | mindmap SQL not run | Supabase table inventory only | source only | grants/RLS unverified | aggregate performance unknown | alert lifecycle | live read + DB tests |
| Forma-3 / KS-3 | none | MISSING | none | none proven | `t2_forma3` count 0 in live inventory | legacy/doc refs | none | none | none | rule source missing | none | legal formula/template | owner/rule source |
| Product AI | Jarvis/agent routes | PARTIAL | named connector + gateway | manifest/call/AI routes | replay/audit candidates | Workers AI split path | contract files present; full suite not run by auditors | no runtime agent smoke | no browser | deployed RPC/replay unproven | no quota gate | durable audit/draft write | unify gateway + tests |

## Release rule

PTO is not daily-use ready until all P0 rows are green, all financial rows
have canonical source/provenance, and authenticated owner smoke passes. Static
build success is not production verification.
