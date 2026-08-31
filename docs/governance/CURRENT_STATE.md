# TIZIM_02 current state

This file is replaceable state, not an append-only journal. Update values in
the same change that changes the state. Last checked: 2026-09-01.

| Field | Current value |
|---|---|
| `main_sha` | `d1d1315e87a27e05b187820af3990ba91125500f` (verified remote 2026-09-01) |
| `active_p0` | `CTRL-001` TIZIM_02 System Control Center (starting). STOR-001 is LIVE. |
| `agent_control_plane` | `docs/governance/AGENT_COMMS_PROTOCOL.md` (on branch `codex/agent-comms-protocol-v1`, not yet merged) + `ops/handoff/` + `ops/mailbox/`. Task truth: `ops/ACTIVE_TASKS.json`. `tizim02/MULOQOT.md` is history only. |
| `storage_db` | **APPLIED to production** 2026-09-01 as single migration `t2_company_storage_foundation_v1` (corrected consolidation of 20260830052000 + folded 190000/191000). Behavioral acceptance PASS. Two bugs found+fixed before sign-off: mindmap→storage domain coupling removed (generic `t2_actor_kompaniya_azo_tekshir`); audit-FK (non-object entities pass NULL obyekt_id). One rollback used during that cycle. |
| `storage_gas` | **DEPLOYED**: `clasp push` + deployment `AKfycbxKO…` bumped to GAS version 375. `functions/api/gas.ts` injects session actor id into storage command args. |
| `storage_frontend` | **LIVE**: `smeta-tizimi.pages.dev/admin/test/saqlash` (chunk `TestSaqlash-D5rqXA8H.js` verified on production). `?demo=1` = fixture preview; `?demo=0` = live (fail-closed until a workspace is bound). |
| `storage_live_smoke` | **PENDING** — authenticated end-to-end (real Google Drive bind → project → object → document/F2 → registry) requires a signed-in Product Owner session; Claude cannot log in. |
| `production_frontend` | Cloudflare Pages `smeta-tizimi.pages.dev`, git-integration auto-deploy from `main`. |
| `production_db` | Supabase/Postgres `tuoyrzadkgoltpqkdiyx`; live catalog authoritative. Participant migrations `20260831171534` + `20260831171605` applied. Known repo drift: `t2_resource_command_v2`, `t2_mindmap_request_identity_v2` not matched by name in production (`docs/reviews/2026-08-30_SCHEMA_DRIFT_RECONCILIATION.md`). |
| `broken` | Disposable Supabase branch unavailable (only `main`); acceptance was run directly on production inside a rolled-back transaction. |
| `branches_not_merged` | `codex/agent-comms-protocol-v1` (control plane + branch classification + storage contract), `codex/design-system-v1`, `codex/universal-estimate-engine-v1`, `codex/entity-participant-backend` (superseded). |
| `next_release` | CTRL-001 System Control Center (visible). No unrelated migration/feature in scope. |

## Evidence boundary

`main_sha` measured from the repository at the time of writing. Storage
production state is measured from the live Supabase catalog + acceptance run of
2026-09-01. GAS "deployed" assumes deployment `AKfycbxKO…` is the target of
Cloudflare's `GAS_URL`; confirm on the first authenticated live smoke.
