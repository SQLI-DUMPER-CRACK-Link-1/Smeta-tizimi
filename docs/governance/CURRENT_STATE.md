# TIZIM_02 current state

Replaceable measured state, not a journal. Last checked: 2026-09-01.

| Field | Current value |
|---|---|
| `main_sha` | `b6db686329a4f3c7e5f49aca24d2872695e81402` (verified remote) |
| `release_candidate` | `integration/next-main-release-v1 @ f7a35eb` — NEXT-MAIN-RELEASE-V1, READY_FOR_OWNER_APPROVAL |
| `production_write_allowed` | **false** |
| `storage_STOR_001` | **LIVE** — DB migrations applied, GAS deployed (v378), frontend on main (`/admin/test/saqlash` → canonical `/admin/storage`). |
| `file_truth_FILE_TRUTH_001` | **SOURCE_READY** on main + release candidate — private `R2_CANONICAL`, two-phase reserve/finalize/reconcile, `98_T2ReplicaSync.js`. NOT applied (migration + private bucket + Cloudflare + GAS trigger pending — runbook). |
| `boss_panel` | **SOURCE_READY** on release candidate (was P0 FAIL: GAS/Sheets `apiBossData`). Canonical `t2_boss_dashboard_v1` + `/admin/dashboard`; migration not applied. Verified read-only vs prod data. |
| `codex_ui` | document-center + participants + system-control + app-identity merged into `f7a35eb`. `/admin/participants` reads real `t2_loyiha_qatnashchilar_royxat`; `/admin/documents` + `/admin/system-control` show honest pending states + demo harness at `/admin/_demo/*`. |
| `ctrl_001` | **DEFERRED-P1** — contract only (`docs/architecture/SYSTEM_CONTROL_CENTER_V1.md`); no capability-registry migration. `/admin/system-control` shows real Supabase/Cloudflare probes. |
| `production_frontend` | Cloudflare Pages `smeta-tizimi.pages.dev`, auto-build from `main`. |
| `production_db` | Supabase `tuoyrzadkgoltpqkdiyx`. Applied: storage foundation, participant contract, signal migrations. NOT applied: `20260902120000` file-truth, `20260903120000` boss-dashboard. Repo-vs-prod drift on `t2_resource_command_v2` / `t2_mindmap_request_identity_v2` tracked (`docs/reviews/2026-08-30_SCHEMA_DRIFT_RECONCILIATION.md`). |
| `agent_control_plane` | `docs/governance/AGENT_COMMS_PROTOCOL.md` on `codex/agent-comms-protocol-v1` (not merged). Task truth: `ops/ACTIVE_TASKS.json`. `tizim02/MULOQOT.md` = history only. |
| `branches` | `ops/handoff/BRANCH_RECONCILIATION_NEXT_RELEASE.md`. Nothing deleted. Backlog kept: `universal-estimate-engine-v1`, `design-system-v1`, `storage-quota-ui-v1`, `agent-comms-protocol-v1`. |
| `roadmap` | `docs/architecture/CONSTRUCTION_OS_MASTER_ROADMAP.md` |
| `release_runbook` | `ops/releases/NEXT_MAIN_RELEASE_V1.md` |
| `continuation` | `ops/handoff/NEXT_MAIN_RELEASE_CONTINUATION.md` |
| `broken` | No disposable Supabase branch (only `main`); acceptance runs directly on prod in rolled-back transactions. |
| `next_approval` | ONE consolidated: apply `20260902120000` + `20260903120000`; create private `R2_CANONICAL` bucket + Cloudflare bindings/env; deploy frontend; (optional) GAS replica worker + trigger; merge `integration/next-main-release-v1` → `main`. |

## Evidence boundary

SHAs measured from repo/remote 2026-09-01. Production DB state measured from the
live Supabase catalog. NEXT-MAIN-RELEASE-V1 performed no production write, no
`main` push, no GAS/Cloudflare mutation. `tizim02/MULOQOT.md` is an append-only
historical journal, not current state — this file is the only current-state
authority.
