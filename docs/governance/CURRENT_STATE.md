# TIZIM_02 current state

This file is replaceable state, not an append-only journal. Update values in
the same change that changes the state. Last checked: 2026-08-31.

| Field | Current value |
|---|---|
| `main_sha` | `37e5f0ec8c55c510285ff1087406701c4a55271e` (verified remote 2026-08-31; == origin/main) |
| `active_p0` | `STOR-001` multi-company storage foundation. Work branch `codex/company-storage-foundation-v1` (main +9 / -0). SOURCE READY, not MERGED, not DB APPLIED. |
| `agent_control_plane` | `docs/governance/AGENT_COMMS_PROTOCOL.md` + `ops/handoff/` + `ops/mailbox/`. Machine task truth: `ops/ACTIVE_TASKS.json`. `tizim02/MULOQOT.md` is history only. |
| `production_frontend` | Cloudflare Pages `smeta-tizimi.pages.dev`; last recorded prod deploy `a44a43b1-bb95-4fc8-abd7-0f208be0958c` (commit `451ae6c`) |
| `production_db` | Supabase/Postgres `tuoyrzadkgoltpqkdiyx`; live catalog is authoritative. Participant migrations `20260831171534` + `20260831171605` are APPLIED to production (closed, separate from STOR-001). `t2_company_storage_foundation_v1` is NOT applied. Repo migration history has known drift. |
| `working` | Governance + participant contract + mindmap create on `main @ 37e5f0e`. Production DB writes remain disabled by policy. |
| `broken` | Disposable Supabase branch unavailable; full live-vs-repo schema reconciliation pending. |
| `active_tasks` | `STOR-001` active (codex). See `ops/ACTIVE_TASKS.json`. |
| `branches_not_merged` | `codex/company-storage-foundation-v1` (STOR-001, active), `codex/design-system-v1`, `codex/universal-estimate-engine-v1`. |
| `next_release` | STOR-001 storage foundation, one consolidated PROD approval after Claude review. No other P0 opens until STOR-001 closes. |

## Evidence boundary

The `main_sha` above is measured from the repository at the time of writing.
Frontend build/deploy health, Supabase migration application state and live
database catalog must be refreshed before a release decision. A stale SHA is a
warning, not permission to rewrite this file from memory.
