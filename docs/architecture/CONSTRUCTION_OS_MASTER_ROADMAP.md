# TIZIM_02 — Construction OS Master Roadmap

Authoritative domain map so nothing disappears between sessions.
Last reconciled: 2026-09-01 · main `b6db686` · release candidate `f7a35eb`.

Status legend: **LIVE** (in production) · **SOURCE_READY** (code on a branch/main,
not deployed) · **PARTIAL** · **MISSING** · **BLOCKED** · **DEFERRED-P1/P2/P3**.

Canonical law: ONE ENTITY — ONE ID — ONE SOURCE OF TRUTH — MANY VIEWS.
Supabase = business truth · private R2 = file truth · Drive/Sheets = replicas ·
GAS = bridge.

---

## Domain status

| Domain | Status | Canonical entity | Current source of truth | Gap / next vertical slice | Depends on |
|---|---|---|---|---|---|
| Auth / session | **LIVE** | User, Sess | Cloudflare `functions/api/sessiya` + cookie | Fail-closed secret audit (SEC H1) | — |
| Company / tenant | **LIVE** | `t2_kompaniya`, `t2_azolik` | Supabase | Company create/onboarding flow audit; company settings surface | Auth |
| Director / owner model | **PARTIAL** | `t2_azolik.rol` | Supabase | Canonical `company_owner`/`director` role not distinct from creator; explicit membership model slice | Company |
| Membership / roles / permissions | **PARTIAL** | `t2_azolik` | Supabase + RLS + command guards | Role vocabulary + server-side scope enforcement audit; revocation semantics | Company |
| Subscription / billing / entitlements / quotas | **MISSING** | Subscription, Plan, Entitlement | — | Backlog contract only; `codex/storage-quota-ui-v1` waits here | Company |
| Company settings / profile | **MISSING** | — | — | Minimal settings page | Company |
| Projects | **LIVE** | `t2_loyiha` | Supabase (`t2_loyiha_royxat`) | — | Company |
| Participants / project network | **PARTIAL→wired** | `t2_loyiha_qatnashchi` | Supabase (`t2_loyiha_qatnashchilar_royxat`) | `/admin/participants` reads real data (this release); invite/accept + email state = DEFERRED-P1 | Projects, ENT contract |
| Objects | **LIVE** | `t2_obyekt` | Supabase | — | Projects |
| PBS / WBS | **PARTIAL** | `t2_obyekt` + skeleton migration | Supabase | Object not overloaded; real PBS/WBS entities | Objects |
| Storage (canonical folders) | **LIVE** | `t2_company_storage_workspace` / `_project_storage_binding` / `_object_storage_binding` | Supabase + GAS bridge → Drive | Storage screen relabel: Drive = replica, not "asosiy storage" (PHASE G, in this release note) | — |
| File truth (documents) | **SOURCE_READY** | `t2_document_registry` (canonical R2 cols), `t2_replica_sync_job` | private R2 + Supabase (after migration) | Apply migration + private `R2_CANONICAL` bucket + Cloudflare deploy (runbook); Document Center real wiring | Storage |
| Document Center UI | **SOURCE_READY** | — | Codex `components/document-center` | `/admin/documents` shows honest "not applied" until file-truth deployed | File truth |
| Drive replica worker + write-back | **SOURCE_READY** | `t2_replica_sync_job` + `98_T2ReplicaSync.js` | — | GAS trigger + `REPLICA_SYNC_SECRET` / `R2_INTERNAL_URL`; content write-back R2 copy-in = DEFERRED-P1 | File truth |
| Sheets replica / write-back | **DEFERRED-P1** | `sheets_entity_id`, `base_version` (contract) | — | Reusable contract exists in FILE_TRUTH doc §8; one reference impl | File truth |
| Boss / director panel | **SOURCE_READY** (was FAIL) | `t2_boss_dashboard_v1` read model | Supabase views | Apply migration; wire more cards as domains canonicalize | many read models |
| Control Center (CTRL-001) | **DEFERRED-P1** | `t2_capability`, `t2_capability_override` (contract only) | — | Capability registry migration + `93_T2Control.js` + wire Codex `SystemControlCenter`; `/admin/system-control` shows real probes today | — |
| Contracts / commercial | **PARTIAL** | `t2_shartnoma`, `t2_shartnoma_bog` | Supabase (`t2_bux_dashboard`) | Single contract truth; retention/advance/change-order entities | Projects |
| Change orders / claims / RFI | **MISSING** | — | — | P2 | Contracts |
| Design / document control | **MISSING** | DesignPackage, Drawing, Revision, Transmittal | — | P2; sits on file truth | File truth |
| Estimate / BOQ / norms | **SOURCE_READY (backlog)** | `frontend/src/estimate-engine/*` | `codex/universal-estimate-engine-v1` | P3; Global Core + Country Pack architecture | Objects/WBS |
| Schedule / planning | **MISSING** | Activity, Dependency, Baseline | — | P2 | WBS |
| Procurement / RFQ / bids / PO | **PARTIAL** | `t2_royxat_sorov`, `t2_birja_*` | Supabase (partial) | Material master; PR→RFQ→award→PO→GRN lineage | Estimate/BOQ |
| Warehouse / consumption | **PARTIAL** | `t2_sklad_harakat`, `t2_sklad_qoldiq` | Supabase (dual truths flagged) | Consolidate warehouse truth; three-way match | Procurement |
| Site execution / progress / Fakt / M29 | **PARTIAL** | `t2_qator_holat` (fakt) | Supabase | Daily execution model; M29 | Objects |
| F2 | **PARTIAL** | `t2_akt` (tur=f2) | Supabase (`t2_f2_kat_oy`, `t2_f2_tafsilot`) | F2 files → canonical R2 (no Drive-first); F2 from approved progress not ad-hoc arithmetic | File truth, Execution |
| Invoices / payments / advances / retention | **PARTIAL** | `t2_faktura`, `t2_tolov`, `t2_xarajat` | Supabase (`t2_bux_umumiy`) | Obligation/retention/advance-recovery entities; F2→invoice→payment lineage | Contracts |
| Finance / cost / margin | **PARTIAL** | `t2_bux_*` views | Supabase | Committed vs actual cost; margin forecast | Contracts, Procurement |
| Quality / safety / supervision | **MISSING** | Inspection, NCR, Defect, HSE | — | P2 | Objects |
| Equipment / HR / attendance | **PARTIAL** | ERP tables/views | Supabase (`t2_kadr_royxat`, `t2_texnika_royxat`) | Not overload company membership with HR | Company |
| Handover / defects / warranty / retention release / archive | **MISSING** | — | — | P2/P3 | Contracts |
| 1C / Didox integration | **MISSING** | ExternalMapping | — | P2; internal ID canonical, external mapping + reconciliation | Finance |
| Google Drive replica | **SOURCE_READY** | `t2_object_storage_binding`, `drive_*` cols | Supabase + GAS | see Drive replica worker | File truth |
| Google Sheets replica | **DEFERRED-P1** | contract only | — | see Sheets replica | File truth |
| Notifications / approvals | **MISSING** | — | — | DEFERRED-P1 foundation | — |
| Audit | **LIVE** | `t2_audit_log` + `t2_audit_yoz` + triggers | Supabase | Extend to reserve/finalize/replica/conflict/control (partly done in FILE-TRUTH source) | — |
| Signals / alerts / risks | **LIVE** | `t2_signal` | Supabase | Feed the Boss panel (done) + Control Center incidents | — |
| App identity / routes / titles / favicon / manifest | **SOURCE_READY** | — | `codex/app-identity-v1` (in integration) | canonical routes `/admin/{dashboard,storage,documents,mindmap,participants,system-control}` + `<PageIdentity/>` | — |
| Design system | **SOURCE_READY (backlog)** | — | `codex/design-system-v1` | dedicated milestone (broad restyle) | — |
| AI layer | **PARTIAL** | — | GAS `apiTitanAi` etc. | Move AI onto canonical APIs; scoped tools; no invented business truth | canonical APIs |
| Localization / country packs | **MISSING** | — | — | P3 | Estimate engine |
| Observability | **PARTIAL** | Control Center | — | DEFERRED-P1 with CTRL-001 | CTRL-001 |
| Performance | **ENFORCED** | — | static/behavior guards | keep guards; no Drive/Sheets/GAS on interactive reads | — |
| Security | **PARTIAL** | — | RLS + command guards + this release SEC gate | H1 secret audit, H2 service-role negative tests, H3 private R2, H4 input validation, H5 audit | — |

---

## Immediate sequence (next 2–3 releases)

1. **This release** (`f7a35eb` → main after approval): FILE-TRUTH deploy,
   Boss panel canonical, App identity, participants real-read, storage relabel.
2. **P1-A**: CTRL-001 capability registry + Control Center real wiring.
3. **P1-B**: Drive replica worker deploy + backfill pilot; Document Center real.
4. **P1-C**: company onboarding + director model + invitation flow + notifications.
5. **P1-D**: Sheets replica reference implementation.
6. **P2**: contracts single-truth, procurement lineage, warehouse consolidation,
   finance lineage, schedule, design control, quality/safety.
7. **P3**: Universal Estimate Engine, design system, AI assistants, country packs,
   subscription commercialization.

## Do-not-lose backlog branches

`codex/universal-estimate-engine-v1`, `codex/design-system-v1`,
`codex/storage-quota-ui-v1`, `codex/agent-comms-protocol-v1` (governance docs).
See `ops/handoff/BRANCH_RECONCILIATION_NEXT_RELEASE.md`.
