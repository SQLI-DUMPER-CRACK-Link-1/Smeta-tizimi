# Branch reconciliation — NEXT-MAIN-RELEASE-V1

Read-only classification. **No branch deleted/reset/pruned by this task.**
Baseline: `origin/main @ b6db686` (contains STOR-001 live + FILE-TRUTH-001 source).
Release candidate: `integration/next-main-release-v1 @ f7a35eb`.

| Branch | head | vs main (ahead/behind) | Class | Next action |
|---|---|---|---|---|
| `main` | `b6db686` | 0/0 | **CANONICAL** | — |
| `integration/next-main-release-v1` | `f7a35eb` | +10/0 | **RELEASE CANDIDATE (this task)** | owner approval → merge to main |
| `claude/file-truth-r2-sync-v1` | `08609ce` | 0/1 | **MERGED_NOW** (in main + integration) | delete after release |
| `codex/document-center-ui-v1` | `0c1d6da` | +2/32 | **MERGED_NOW** (into integration) | delete after release |
| `codex/participant-network-ui-v1` | `432258d` | +1/6 | **MERGED_NOW** (into integration) | delete after release |
| `codex/system-control-ui-v1` | `dca7c2b` | +1/32 | **MERGED_NOW** (into integration) | delete after release |
| `codex/app-identity-v1` | `627cf92` | +1/5 | **MERGED_NOW** (into integration) | delete after release |
| `integration/storage-visible-final` | `9b0b7c8` | 0/10 | **MERGED** (STOR-001 shipped to main) | delete after release |
| `codex/company-storage-foundation-v1` | `5cf51c0` | 0/20 | **SUPERSEDED** by the STOR-001 merge on main | delete after release |
| `codex/storage-visible-components-v1` | `20415b4` | 0/19 | **SUPERSEDED** (folded into integration/storage-visible-final → main) | delete |
| `codex/storage-visible-qa-v1` | `8bca879` | +1/17 | **SUPERSEDED** (QA tests cherry-picked to main) | delete |
| `claude/storage-integration-v1` | `4f737a8` | +1/18 | **SUPERSEDED** (STOR-001B folded into main) | delete |
| `claude/codex-storage-foundation-task` | `0a269c3` | +1/32 | **SUPERSEDED** (early STOR-001 stub) | delete |
| `codex/agent-governance-v2` | `27e8be1` | 0/43 | **MERGED** (governance v2 on main) | delete |
| `codex/agent-comms-protocol-v1` | `290b4b5` | +4/32 | **READY_UNMERGED** — agent comms protocol + branch classification + storage contract; not on main | fold governance docs into a governance merge post-release |
| `codex/mindmap-create-hotfix` | `cbbd21c` | 0/42 | **MERGED** | delete |
| `codex/mindmap-create-ux` | `d07a1f0` | 0/43 | **MERGED** | delete |
| `integration/mindmap-create-final` | `9e9573a` | 0/39 | **MERGED** | delete |
| `codex/entity-participant-backend` | `953383b` | +1/44 | **SUPERSEDED** (participant contract on main; migrations applied to prod) | 3-way diff its 1 unique commit, then delete |
| `codex/storage-quota-ui-v1` | `f662372` | +1/32 | **KEEP_BACKLOG** — storage-quota UI components; belongs with the subscription/quota P3 slice | keep; wire when subscription model exists |
| `codex/design-system-v1` | `9b65a28` | +1/47 | **KEEP_BACKLOG** — construction command-center design system; not safe for this release (broad restyle) | keep; dedicated design-system milestone |
| `codex/universal-estimate-engine-v1` | `32e2054` | +1/45 | **KEEP_BACKLOG** — Universal Estimate Engine V1 foundation; P3, no conflict yet | keep; integrate in the estimate-engine milestone |
| `ag/shared-entity-form-ux` | `6e2d57f` | 0/50 | **MERGED / SUPERSEDED** (no unique commits vs main) | delete |
| `release/tizim02-day-end` | `9ba3f70` | 0/33 | **HISTORICAL** (day-end release record) | keep as tag-equivalent |
| `cursor/sql-first-ai-central-key` | `ad382f3` | 0/566 | **OBSOLETE / DO NOT TOUCH** — a month old, 566 behind, unrelated lineage | product-owner archive decision |

## Consolidation plan (DEFERRED — after owner approves the release)

1. Merge `integration/next-main-release-v1` → `main` (owner approval + runbook).
2. Delete every **MERGED_NOW / MERGED / SUPERSEDED** branch above.
3. Fold `codex/agent-comms-protocol-v1` governance docs via a dedicated
   governance merge (agent comms protocol + branch classification + storage
   contract v1) — small, doc-only.
4. Triage `codex/entity-participant-backend`'s single unique commit vs main+prod.
5. Keep `design-system-v1`, `universal-estimate-engine-v1`, `storage-quota-ui-v1`
   as scheduled backlog milestones (see `CONSTRUCTION_OS_MASTER_ROADMAP.md`).
6. `cursor/sql-first-ai-central-key`: product-owner decision.
