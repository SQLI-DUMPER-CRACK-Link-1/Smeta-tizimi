# Branch & worktree classification — 2026-08-31

Read-only classification. **No branch or worktree is deleted, pruned, reset or
cleaned by this document.** Consolidation happens only after STOR-001 closes and
with explicit human approval.

Baseline: `origin/main @ 37e5f0ec8c55c510285ff1087406701c4a55271e` (verified remote).

## Remote branches

| Branch | vs main (ahead/behind) | Last activity | Class | Note |
|---|---|---|---|---|
| `origin/main` | 0 / 0 | 2026-08-30 | **CANONICAL** | Governance v2 + participant contract + mindmap create. |
| `codex/company-storage-foundation-v1` | +9 / -0 | 2026-08-30 | **ACTIVE (STOR-001)** | The P0 work branch. Clean descendant of main. SOURCE READY, not merged, not DB-applied. |
| `codex/agent-comms-protocol-v1` | +2 / -0 | 2026-08-31 | **ACTIVE (control plane)** | This branch. Agent comms protocol + STOR-001 handoff + ACTIVE_TASKS. Not merged to main (awaiting approval). |
| `claude/codex-storage-foundation-task` | +1 / -0 | 2026-08-31 | **SUPERSEDED** | Previous Claude session's STOR-001 stub (ACTIVE_TASKS entry + MULOQOT note only). Fully replaced by `codex/agent-comms-protocol-v1` (fuller packet). Keep for history. |
| `ag/shared-entity-form-ux` | 0 / -18 | 2026-08-29 | **MERGED / SUPERSEDED** | No unique commits vs main; content already landed. |
| `codex/agent-governance-v2` | 0 / -11 | 2026-08-30 | **MERGED** | Governance v2 boot chain; integrated into main. |
| `codex/mindmap-create-hotfix` | 0 / -10 | 2026-08-30 | **MERGED** | No unique commits vs main. |
| `codex/mindmap-create-ux` | 0 / -11 | 2026-08-30 | **MERGED** | No unique commits vs main. |
| `integration/mindmap-create-final` | 0 / -7 | 2026-08-30 | **MERGED (remote)** | Remote has no unique commits. **Local** worktree HEAD `639a2c9` has 1 unpushed commit "fix(t2): reconcile existing object folder" + 24 dirty files — see worktree table. |
| `release/tizim02-day-end` | 0 / -1 | 2026-08-30 | **HISTORICAL** | Day-end release record; effectively a tag. |
| `codex/entity-participant-backend` | +1 / -12 | 2026-08-30 | **SUPERSEDED** | Participant contract already on main (`6dd28e4`) and applied to prod (`20260831171534/171605`). Its 1 unique commit needs a 3-way diff before any action. |
| `codex/design-system-v1` | +1 / -15 | 2026-08-29 | **READY-UNMERGED** | Construction command-center design system. Explicitly excluded from current release. Revisit after STOR-001. |
| `codex/universal-estimate-engine-v1` | +1 / -13 | 2026-08-29 | **READY-UNMERGED** | Universal estimate engine v1 foundation. Post-storage roadmap item. |
| `cursor/sql-first-ai-central-key` | 0 / -534 | 2026-07-29 | **HISTORICAL / STALE** | 534 commits behind, a month old, unrelated lineage. Do not touch; classify only. |

## Worktrees (20+)

| Worktree path | Branch / HEAD | Class | Action |
|---|---|---|---|
| `G:\...\GAS` (main worktree) | `integration/mindmap-create-final` @ `639a2c9` | **DIRTY — LEAVE** | 24 modified + untracked files (Test*.tsx, sb-yoz.ts, MULOQOT.md, 10 untracked migrations). User work. Do not reset/clean/stash. 2 stale `.git/*.lock` present (from a failed `git worktree add`); leave until repo quiesces. |
| `C:\Users\anvar\.claude\worktrees\agent-comms-v1` | `codex/agent-comms-protocol-v1` | **ACTIVE (Claude)** | Clean control-plane worktree. |
| `C:\Users\anvar\.codex\worktrees\*` (agent-governance-v2, design-system-v1, mindmap-create-ux, f877, release-tizim02-day-end) | various | **CODEX-OWNED** | Codex's own worktrees. Not Claude's to prune. |
| `C:\Users\PC\.gemini\antigravity\brain\...\subagent-*` (7) | `codex/control-signal-engine`, `codex/domain-graph-audit`, `ag/mindmap-control-plane`, `ag/graph-relations-ux-2`, `ag/procurement-ui`, `codex/baseline-recovery`, ... | **PRUNABLE (Antigravity)** | All marked `prunable` by git. Antigravity subagent scratch. Classify only; owner tool prunes. |
| `C:\Users\PC\Documents\GAS__*` (baseline_recovery, integration, mainport, mainport2, resource_hardening) | integration/construction-control-plane-v1*, codex/resource-lifecycle-tenant-hardening | **PRUNABLE / HISTORICAL** | All `prunable`. Old integration experiments. Classify only. |

## Consolidation plan (DEFERRED — do not execute now)

1. After STOR-001 merges: delete MERGED branches
   (`ag/shared-entity-form-ux`, `codex/agent-governance-v2`,
   `codex/mindmap-create-hotfix`, `codex/mindmap-create-ux`,
   `integration/mindmap-create-final` after its local commit is triaged).
2. Fold `codex/agent-comms-protocol-v1` and `claude/codex-storage-foundation-task`
   into main via the STOR-001 release (or a dedicated governance merge).
3. `codex/entity-participant-backend`: 3-way diff its 1 unique commit vs main +
   prod catalog; if nothing new, delete.
4. `codex/design-system-v1`, `codex/universal-estimate-engine-v1`: keep as
   READY-UNMERGED; schedule after storage.
5. `cursor/sql-first-ai-central-key`: archive decision by product owner.
6. `git worktree prune` only after confirming each `prunable` worktree has no
   uncommitted work (owner tools first).
