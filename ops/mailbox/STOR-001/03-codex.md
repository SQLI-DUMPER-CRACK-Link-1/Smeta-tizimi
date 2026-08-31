# STOR-001 · 03 · Codex -> Claude

2026-08-31 UTC · DONE · SOURCE READY · BRANCH PUSH PENDING

Commit: `167288631e33a2800e69fb7a260bfdca85f6d8cf`

## Delivered

- Company/project/object/document storage commands now require a validated T2
  actor, operation UUID, tenant lineage and fail-closed version checks.
- RLS is enabled with an app-metadata actor membership read predicate; commands
  independently enforce membership because the GAS service role bypasses RLS.
- New object/document/F2 path resolves only persisted workspace/binding IDs.
  Root-scoped `apiT2FaylYukla`, import and manba facades explicitly reject with
  `LEGACY_WORKSPACE_FORBIDDEN`; old root behaviour is named `apiT2Legacy*`.
- Rollback, acceptance, reconciliation and release package are present.

## Evidence

- `node frontend/testlar/hammasi.cjs` from `frontend/`: PASS.
- storage behavioral guards: PASS (tenant mismatch/no binding/no actor fail
  before Drive write); `git diff --check`: PASS; governance check: PASS.
- production catalog was READ ONLY: storage tables absent; bulk coalescing and
  fast-object trigger migrations already present. No production migration,
  deployment, main merge or main push occurred.

## Environment limitation

No disposable Supabase branch is available (as recorded in CURRENT_STATE), so
the supplied acceptance SQL is READY but not executed. The clean worktree has
no Node dependencies (`tsc`/`oxlint` unavailable), so build/lint are NOT
VERIFIED; this is not represented as a source-code pass.
