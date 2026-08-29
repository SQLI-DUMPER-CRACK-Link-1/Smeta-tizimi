# TIZIM_02 current state

This file is replaceable state, not an append-only journal. Update values in
the same change that changes the state. Last checked: 2026-08-30.

| Field | Current value |
|---|---|
| `main_sha` | `5c78421c36fb567cb0dad6e761cba4701d6ff3fe` |
| `production_frontend` | Cloudflare Pages, Vite/React app in `frontend/`; deployment health not asserted by this governance change |
| `production_db` | Supabase/Postgres project `tuoyrzadkgoltpqkdiyx`; live catalog is authoritative, repository migration history has known drift |
| `working` | Governance V2 is being prepared from `main`; production writes and deploys are disabled |
| `broken` | Disposable Supabase branch is unavailable; live-vs-repository schema/deployment verification remains pending |
| `active_tasks` | `ops/ACTIVE_TASKS.json` (task-level locks; no domain ownership is inferred) |
| `branches_not_merged` | `codex/agent-governance-v2`, plus other branches reported by Git; merge status must be checked against `main_sha` before release |
| `next_release` | Review governance files and run `node ops/governance-check.cjs`; then obtain human approval for any production action |

## Evidence boundary

The `main_sha` above is measured from the repository at the time of writing.
Frontend build/deploy health, Supabase migration application state and live
database catalog must be refreshed before a release decision. A stale SHA is a
warning, not permission to rewrite this file from memory.
