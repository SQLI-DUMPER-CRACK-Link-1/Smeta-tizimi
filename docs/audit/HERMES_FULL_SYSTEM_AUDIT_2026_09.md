# Hermes full system audit — 2026-09

## Executive result

**PTO is not 100% complete.** The repository contains real TIZIM_02 workflows,
strong static import/document contracts, a named-tool agent connector, and a
working frontend build. It is still a hybrid product: several critical reads
and the Smeta import path depend on legacy/GAS or unproven server boundaries.
Production/runtime verification is incomplete.

### Measured state

- Branch: `hermes/pto-revolution-2026-09`
- Base SHA: `806b2955ff00932c25b327991fa2d89a2048064e`
- Codebase Memory: project `smeta-tizimi`, 7,321 nodes, 22,335 edges, ready.
- Frontend static gates: TypeScript pass; Vitest 9 files / 30 tests pass;
  `npm run tekshir` pass; build pass; lint exit 0 with warnings.
- Local document profiler: 38 sanitized records — 33 XLSX containers, 1 CSV,
  2 PDF, 2 DOCX. No raw cell values were written to the profile.
- Supabase read-only MCP: connected to `Smet-01`, `ACTIVE_HEALTHY`, 118 public
  tables, 97 `t2_*` tables, RLS reported enabled; RPC enumeration was not run
  because plan mode denied `execute_sql`.
- Drive corpus: not inspected; the headless Claude session had no Drive tool
  available despite the desktop MCP list showing a configured connection.
- No production migration, deployment, external write, or destructive action
  was executed.

## Authority and evidence boundary

The required authority files `docs/governance/CONSTITUTION.md` and
`docs/governance/CURRENT_STATE.md` were absent at boot. `AGENTS.md`,
`CLAUDE.md`, actual source, tests, and measured runtime evidence therefore won
this audit. Historical plans are cited only as historical evidence, never as
current status. `ops/ACTIVE_TASKS.json` and this handoff set were created for
this night run and are not treated as an existing governance authority.

## Route and product audit

| Area / route | Status | Evidence | Missing proof / next action |
|---|---|---|---|
| `/admin/test/logistika`, `/admin/test/zayavka` | WORKS (static) | `App.tsx:116-143`, `WrapperLogistika.tsx:9-54`, `TestZayavka.tsx:40-145`, `t2-zayavka.ts:29-38`, `sb-yoz.ts:136-151` | Execute isolated DB/RPC contract and authenticated scope smoke. |
| `/admin/test/xarita` | WORKS (static) / DUPLICATED | `TestXarita.tsx`, `t2-mindmap.ts:130-198`, mindmap migrations/tests | Runtime RPC grants, RLS and direct-route smoke. It is also embedded in `/portfel`. |
| `/admin/test/portfel` | PARTIAL | `WrapperPortfel.tsx:9-54`, `TestLoyiha.tsx:25-115`, `t2-loyiha.ts:11-73` | Reconcile bigint/UUID schema and persist one canonical object context. |
| `/admin/test/smeta` | LEGACY_ONLY for import write | `TestSmetaBirlashgan.tsx:7-21`, `TestImport.tsx:132-405`, `functions/api/gas.ts:55-74` | Migrate or explicitly approve legacy boundary; prove source provenance. |
| `/admin/test/moliya`, `/tolov` | PARTIAL | `WrapperMoliya.tsx:8-46`, `TestTolov.tsx:30-54`, `t2-buxgalteriya.ts:24-81` | Company-scope payment reads and preserve NULL/unknown values. |
| `/admin/test/logistika` / `/sklad` | PARTIAL | `TestSklad.tsx:39-118` now loads the object list through `sbT2ObyektlarOlKomp(aktKomp)` and clears stale object state when company changes; qoldiq still reads by object ID through `supabase.ts:642-667`, while `functions/api/sb.ts:234-249` documents the server object-only gap. | Close the server object-only tenant boundary; disable placeholder actions. |
| `/admin/test/aosr` | PARTIAL | `TestAosr.tsx:14-103`, `t2-aosr.ts:20-110`, `sb-yoz.ts:721-773` | Locate canonical SQL/RLS and execute isolated contract. |
| `/admin/test/kontragent` | PARTIAL | `TestKontragent.tsx:29-53`, `t2-kontragent.ts:25-39` | Didox remains unimplemented; verify tenant-scoped DB contract. |
| `/admin/test/erp` | PARTIAL | `TestErp.tsx:27-80,293-304`, `t2-resurs.ts:3-16` | Replace HSE/Sifat placeholder with real named workflow or mark unavailable. |
| `/admin/test/hisobot` | PARTIAL | `TestHisobot.tsx:19-100`, `t2-hisobot.ts:3-24` | Preserve NULL/unknown and add route test. |
| `/admin/test/faktura` | PARTIAL / security blocked | `TestFaktura.tsx:24-175`, `supabase.ts:698-733`, `functions/api/upload.ts:1-44` | `/api/upload` needs server-derived auth/ownership and transaction boundary. |
| `/admin/test/daraxt` | PARTIAL | `TestDaraxt.tsx:20-105`, `supabase.ts:274-349` | Numeric object-ID context plus object/company enforcement. |
| `/admin/test/crm` | PARTIAL | `WrapperCRM.tsx:7-39`, `TestInvite.tsx:37-54`, `TestSotuvCrm.tsx:4-25` | Invite send and sales CRM are explicit unfinished lanes. |
| Wrapper/direct Test routes | DUPLICATED | `App.tsx:116-143`; wrappers embed the same screens as direct routes | Consolidate entrypoints after context contract is accepted. |
| Unreferenced T2 modules | LEGACY_ONLY / UNKNOWN | no imports for `t2-didox`, `t2-korzinka`, `t2-overbilling`, `t2-papka`, `t2-tolov`, `t2-viborka` | Archive, wire, or label; do not count source presence as product capability. |

## Domain chain status

| Capability | Status | Current source / evidence | Blocking gap |
|---|---|---|---|
| Company/object context | PARTIAL | Company provider is shared; object IDs remain screen-local. | Shared numeric `kompaniya_id` + optional `obyekt_id` workspace contract. |
| Smeta/LRV/RES | PARTIAL / LEGACY_ONLY | F2 contract suite proves flattening and unit checks; import write still uses GAS. | Canonical row/document lineage and T2 import persistence. |
| Price / markup | PARTIAL | `t2-narx.ts`, `t2-shartnoma.ts`, `t2_nakrutka_hisob` references. | Authoritative DDL/formula/provenance and NULL/zero policy. |
| Fakt | PARTIAL | `t2-fakt.ts`, `sb-yoz.ts:1132-1173`; negative corrections allowed. | Canonical amount/quantity/unit/history and consistent idempotency. |
| F2 import | CONTRACT-TESTED / PARTIAL | `t2_f2import.test.cjs` 52/52; source tree and unit mismatch rules. | DB persistence/RPC and exact source-document provenance. |
| F2 approval/history | BLOCKED / UNPROVEN | UI and dispatch symbols exist; no verified append-only approved snapshot. | Owner-approved state machine and canonical SQL. |
| Nakopitelniy | UNRESOLVED | Architecture/legacy references and Fakt comments only. | Canonical accumulation ledger/read model. |
| Documents / R2 / Drive | PARTIAL | `t2-aosr.ts`, document contract 74/74, object-document operations. | Storage ownership, RLS, deployed readback, Drive runtime. |
| Zayavka / procurement | PARTIAL | Contract migration + UI lifecycle; DB contract not executed. | Isolated DB test and over/negative-delivery rules. |
| AOSR / quality | PARTIAL | Object-scoped API, version and M:N link operations. | Canonical migration, RLS, coverage and approval behavior. |
| Forma-3 / KS-3 | MISSING / PLANNED | Planning references only. | Official template and authoritative legal/business rule source. |

## Critical risks

1. **P0 tenant read boundary:** `functions/api/sb.ts:234-249` only verifies
   membership when a client filter contains `kompaniya_id`; object-only and
   some unfiltered reads can pass through. This reaches stock, payment, tree,
   AOSR and import-state reads.
2. **P0 fail-open old session:** `auth.ts:11-17`, `kirish.ts:65-72` and
   `sb.ts:247-249` allow missing tenant enrichment to skip membership checks.
3. **P0 upload authorization:** `functions/api/upload.ts:1-44` has no visible
   session/tenant check and accepts client-supplied ownership identifiers.
4. **P1 financial truth:** `TestHisobot.tsx`, `TestTolov.tsx`,
   `TestShartnoma.tsx`, and `TestLoyiha.tsx` coerce missing values with `|| 0`.
5. **P1 legacy dependency:** Smeta import/write, login/password validation,
   Boss AI and dev proxy retain GAS dependencies.
6. **P1 direct URL authorization:** shell/menu role filtering is not a server
   authorization boundary for every route/action.
7. **P1 schema provenance split:** baseline, migrations, GAS and `tizim02`
   contain overlapping candidate truths; visible migration evidence does not
   cover every dispatched T2 operation.
8. **P1 AI write boundary:** AI invoice output can flow into item writes in a
   loop before status change; partial failure can leave earlier writes.
9. **P2 performance:** production bundle contains >500 KB chunks; build also
   reports an ineffective dynamic import and unresolved `/grid.svg` runtime URL.

## Security and business decisions not invented

- Source document amount versus `quantity × unit_price` precedence: **NEEDS_RULE_SOURCE**.
- NULL versus numeric zero semantics: **NEEDS_OWNER_DECISION**.
- Negative correction approval/reversal model: **NEEDS_OWNER_DECISION + NEEDS_RULE_SOURCE**.
- Unit conversion policy: **NEEDS_OWNER_DECISION**.
- F2 approval state machine and immutable history: **NEEDS_OWNER_DECISION**.
- Forma-3/KS-3 formula and official template: **NEEDS_RULE_SOURCE**.

## Gates

Passing static gates do not prove production readiness. The night run passed
TypeScript, 9 Vitest files/30 tests, `npm run tekshir`, and production build.
`npm run lint` exited 0 but has existing warnings. `git diff --check` is not
clean because pre-existing dirty `frontend/src/test02/TestZayavka.tsx` lines
310-317 have trailing whitespace; those lines were not changed. Live DB SQL
contracts, browser authenticated smoke, R2/Drive readback, Cloudflare deploy,
RLS/grants, performance, and rollback remain unverified.

## Recommended order

1. Owner-approved tenant/RLS/upload boundary hardening and isolated tests.
2. Canonical workspace context using numeric company/object IDs.
3. Canonical migration/RPC ownership matrix and deployed schema parity.
4. T2 import/provenance closure for LRV/RES/F2.
5. AI draft/review/commit transaction and durable agent audit.
6. Browser visual QA at 1920, 1366, 1024 and narrow widths.
7. Only then accept daily-use or production claims.
