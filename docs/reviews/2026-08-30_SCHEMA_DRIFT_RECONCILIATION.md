# TIZIM_02 Supabase schema-drift reconciliation

Audit date: 2026-08-30
Mode: read-only. No DDL, data mutation, migration-history repair, or production deployment was performed.

## Evidence and status definitions

The connected live Supabase project was inspected read-only through its catalog: functions, relations, columns, triggers, definitions, and migration ledger. The repository was searched for the named contracts, Cloudflare gateways, typed API clients, and migration directories.

Live migration history has 106 applied entries, including:

- 20260828171752 t2_erp_amal_zayavka
- 20260828171951 t2_mindmap_grafi_holat_va_belgi
- 20260828173443 t2_audit_avtomatik_trigger
- 20260828173553 t2_erp_amal_kim_qoshildi
- 20260828191604 t2_tenant_bux_narx_korinishlari

This checkout has no supabase/migrations directory and no checked-in migration ledger. tizim02/01_erp_va_audit_jadvallar.sql is an old hand-applied artifact, not a versioned migration. It uses the older serial/integer audit model and does not contain the current mindmap, request, event, or tenant contracts.

Status meanings:

1. OK: live object and a matching versioned repository migration exist.
2. SCHEMA DRIFT: live object exists, but its authoritative migration is absent from the repository.
3. BROKEN CONTRACT: code expects a contract which live cannot satisfy, or a required tenant/security boundary is missing.

There are no OK rows in the audited scope because the repository has no versioned Supabase migration history.

## Contract matrix

Version means optimistic-concurrency input or row version, not PostgreSQL function version. A dash means the contract does not include it and it must not be invented.

| NAME | CODE REFERENCES | LIVE DB EXISTS? | REPO MIGRATION EXISTS? | SIGNATURE MATCH? | TENANT ARGUMENT? | VERSION? | OPERATION_ID? | STATUS |
|---|---|---|---|---|---|---|---|---|
| t2_mindmap_grafi(p_kompaniya_id bigint) -> jsonb | frontend/src/api/t2-mindmap.ts:120-143; frontend/functions/api/sb.ts:161-209 | Yes; STABLE SECURITY DEFINER, search_path=public | No | Yes; gateway maps mindmap_grafi to p_kompaniya_id | Yes | Node meta returns entity versiya; no mutation version | - | SCHEMA DRIFT |
| t2_mindmap_bog(p_tur text,p_manba_id bigint,p_maqsad_id bigint,p_rol text) -> jsonb | t2-mindmap.ts:150-153; sb-yoz.ts:1043-1064 | Yes; VOLATILE SECURITY DEFINER | No | Yes | No. Gateway sends no kompaniya_id; live definition does not validate source/target tenant | No | No | BROKEN CONTRACT: relation mutation has no tenant, optimistic, or idempotent boundary |
| t2_mindmap_bog_ochir(p_tur text,p_manba_id bigint,p_maqsad_id bigint) -> jsonb | t2-mindmap.ts:155-157; sb-yoz.ts:1043-1064 | Yes; VOLATILE SECURITY DEFINER | No | Yes | No; same gap as link | No | No | BROKEN CONTRACT: unlink is addressed only by IDs/types |
| t2_mindmap_joylashuv_saqla(p_kompaniya_id bigint,p_joylar jsonb) -> jsonb | t2-mindmap.ts:162-166; sb-yoz.ts:1069-1088 | Yes; VOLATILE SECURITY DEFINER | No | Yes; gateway array is sent as JSONB | Yes input; DB definition trusts supplied id | No | No | SCHEMA DRIFT; tenant authorization is gateway-dependent |
| t2_mindmap_tugun_ochir(p_tur text,p_id bigint) -> jsonb | t2-mindmap.ts:169-172; sb-yoz.ts:1090-1105 | Yes; VOLATILE SECURITY DEFINER | No | Yes | No | No | No | BROKEN CONTRACT: soft-delete has no tenant/version/idempotency input |
| t2_erp_amal(p_kompaniya_id bigint,p_operatsiya text,p_payload text,p_kim text) -> jsonb | t2-zayavka.ts:45-82; sb-yoz.ts:1336-1346 | Yes; VOLATILE, search_path=public,pg_temp | No | Transport yes; gateway stringifies payload | Yes; it checks object company | No | No | BROKEN CONTRACT: UI lifecycle and payload exceed live implementation |
| t2_zayavka_royxat view | t2-zayavka.ts:7-42; sb.ts:94-101 | Yes | No | Partial; shared ten fields match | Returned kompaniya_id; client filters it | - | - | SCHEMA DRIFT: live omits UI optional procurement fields |
| t2_erp_taminot table/request source | t2_erp_amal and mindmap live source | Yes | No | Legacy columns match live RPC | kompaniya_id column | No | No | SCHEMA DRIFT |
| t2_audit_yoz(p_kompaniya_id bigint,p_amal_turi text,p_modul text,p_obyekt_id bigint,p_tafsilot text,p_kim text,p_ip text) -> jsonb | t2-tizim.ts:32-40; sb-yoz.ts:757-769 | Yes; VOLATILE SECURITY DEFINER | No; raw artifact is only a precursor | Yes | Yes input; DB routine has no membership proof | - | Deliberately no | SCHEMA DRIFT; authorization relies on gateway session shape |
| t2_audit_reestr view | t2-tizim.ts:5-20; sb.ts:68-70 | Yes | No | Yes; all nine live columns are typed | Returned kompaniya_id; client filters it | - | - | SCHEMA DRIFT |
| t2_hodisa_lenta view | t2-hodisa.ts:20-53; sb.ts:98-101 | Yes | No | Yes; all ten live columns match Hodisa | Company list yes; object detail has no kompaniya_id filter | - | - | BROKEN CONTRACT: object event detail bypasses explicit gateway tenant filter |
| audit triggers: t2_audit_akt, t2_audit_zayavka, t2_audit_shartnoma, t2_audit_tolov | t2-hodisa.ts:3-18 | Yes, on akt/erp_taminot/shartnoma/tolov | No | N/A | Inherited source row | - | - | SCHEMA DRIFT |
| t2_audit_log table | t2-hodisa.ts; t2-tizim.ts; read views | Yes; bigint columns and kim | No | Views match client use | kompaniya_id column | - | - | SCHEMA DRIFT |
| t2_ozgarish table | sb.ts:42-45; T2 architecture technical audit | Yes; 17 columns, including kompaniya_id and versiya | No | Direct read allowlist; no selected typed client read | Column exists; caller filter required | Row records version evidence | - | SCHEMA DRIFT |

## Verified live mismatches

### Mindmap

t2_mindmap_grafi is genuinely live and returns graph, layout, and real-source badges. Its request count reads t2_erp_taminot only where holat equals kutilmoqda. It therefore cannot represent the frontend's proposed multi-step procurement statuses without an authoritative request-model change.

All relation mutations inspected are SECURITY DEFINER. Link, unlink, and node soft-delete take neither a tenant parameter nor expected version/operation ID. Their definitions do not derive or compare source/target company context. Do not compensate only in React; that would preserve the exposed database contract.

### Zayavka/request

Live t2_erp_amal accepts only these states:

kutilmoqda | tasdiqlandi | yopildi | rad

Current TypeScript additionally offers draft, submitted, approved, procurement, ordered, partially_delivered, delivered, and closed. The live t2_erp_taminot table and t2_zayavka_royxat view omit material_id, sana_kerak, prioritet, izoh, and etkazilgan. Payload values for those fields are not persisted by the live RPC. This is a behavior mismatch, not merely a missing type.

### Audit/event

The automatic event pipeline is live. Trigger inspection confirmed audit triggers on t2_akt, t2_erp_taminot, t2_shartnoma, and t2_tolov. t2_hodisa_lenta joins t2_audit_log to object name; t2_audit_reestr is the compact audit view.

The company event-list query sends kompaniya_id=eq.N. The object-detail query sbObyektHodisalariOl sends only obyekt_id=eq.N. The read gateway only performs its explicit membership test when a kompaniya_id=eq.N filter is present. This detail path is not tenant-safe as currently composed.

## Gateway reconciliation

Read allowlist in frontend/functions/api/sb.ts:

- t2_ozgarish
- t2_audit_reestr
- t2_zayavka_royxat
- t2_hodisa_lenta
- read RPC mindmap_grafi -> t2_mindmap_grafi

Mutation allowlist in frontend/functions/api/sb-yoz.ts:

- erp_amal -> t2_erp_amal
- audit_yoz -> t2_audit_yoz
- mindmap_bog -> t2_mindmap_bog
- mindmap_bog_ochir -> t2_mindmap_bog_ochir
- mindmap_joylashuv_saqla -> t2_mindmap_joylashuv_saqla
- mindmap_tugun_ochir -> t2_mindmap_tugun_ochir

These allowlists prove reachability only. They do not establish a committed schema migration, database tenant check, optimistic locking, or idempotency.

## Reproducible baseline strategy

Do not replay Smeta tizimi/supabase_schema.sql against production; it contains destructive and broad policy history unsuitable for reconciliation.

1. Use a clean worktree, not this dirty checkout, and link the Supabase CLI to project tuoyrzadkgoltpqkdiyx.
2. Export a read-only catalog manifest: function identity arguments and definitions, relation/column/view definitions, triggers, indexes, grants, and schema_migrations ledger. Commit the dated, checksummed manifest as evidence, not executable SQL.
3. Generate a baseline from live with supabase db pull into a new supabase/migrations directory. Review it manually; reject drops, data changes, secrets, and accidental function-overload changes.
4. Compare generated versions to the remote ledger. Do not run migration repair, mark migrations applied, or push a baseline until a reviewer approves the history mapping.
5. Commit the reviewed baseline plus a machine-readable required-contract manifest. CI should compare functions, views, tables, and function signatures with a read-only catalog snapshot.
6. Only then make forward migrations: repair the mindmap tenant/version/idempotency contract first, then either migrate the request lifecycle or contract UI back to the live four states. Use isolated-tenant SQL acceptance tests.

## Required decisions

1. Choose one canonical zayavka lifecycle: live four states or frontend eleven states. Do not silently map one to the other.
2. Decide whether mindmap mutations gain kompaniya_id, kutilgan_versiya, and operation_id, or are replaced by a reviewed RPC boundary. Current signatures are insufficient.
3. Repair the object event-detail path to carry a verified company boundary.
4. Establish and commit the baseline before further live schema changes.
