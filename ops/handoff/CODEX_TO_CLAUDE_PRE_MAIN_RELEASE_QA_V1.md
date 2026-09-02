# Pre-main adversarial QA and release smoke harness V1

## Delivery

- Branch: `codex/pre-main-release-qa-v1`
- Base: `origin/codex/document-fidelity-release-v1 @ bc4248e5dbc172f95e40b9e10f9348b5a20704a0`
- Source implementation commit: `606307c4e33b9daec5d8fdf0a3fdb7c01010269f` (`test(release): add adversarial construction-document QA`).
- Scope is source-only QA. No production, main, integration branch, Supabase mutation, Cloudflare mutation, or GAS deploy occurred.

## Changes to integrate

- `frontend/src/lib/construction-document-control/calculation.ts`
  - Emits the existing `PRICE_VARIANCE` exception when actual procurement and certified F2 valuation differ; it does not alter either price basis.
- `frontend/src/lib/construction-document-control/adversarial-release.test.ts`
  - Deterministic hostile cases: zero/fractional/high-precision/negative F2 quantities, over-certification, historical immutability, actual-price null/above/below, approved/pending/rejected changes, filter/reorder identity, and official-export metadata exclusion.
- `frontend/src/lib/construction-document-control/release-performance.test.ts`
  - Repeatable 10k median and 50k calculation/projection/export-shaping guard with generous non-brittle bounds.
- `frontend/testlar/pre_main_release_qa.test.cjs`
  - 33 static release-contract checks for canonical R2 truth, no Drive/Sheets/GAS interactive path, typed Workbench ports, tenant/auth/idempotency/version contracts, fidelity, legacy oracle, and migration order/package requirements.
- `frontend/testlar/hammasi.cjs`
  - Registers the new static guard in the standard `tekshir` gate.
- `frontend/scripts/release-smoke.mjs`
  - Read-only post-deploy smoke harness. It carries no credentials and only sends GET requests.

## Smoke harness

```powershell
cd frontend
$env:RELEASE_SMOKE_BASE_URL = 'https://<deployed-host>'
# Optional, only from the operator's shell; never commit it:
$env:RELEASE_SMOKE_COOKIE = '<existing session cookie>'
$env:RELEASE_SMOKE_OBJECT_ID = '<authorized object id>'
$env:RELEASE_SMOKE_COMPANY_ID = '<authorized company id>'
node scripts/release-smoke.mjs
```

Without the optional session/context, it verifies `/api/sessiya` and the Workbench route, then explicitly reports authenticated checks as skipped. With them, it performs read-only Workbench, Nakopitelniy, Change Control, Closeout, and Document Center checks. Expected terminal output is `RELEASE_SMOKE_PASS`; any 500, HTML in a JSON route, or invalid endpoint response is `RELEASE_SMOKE_FAIL`.

## QA results

- Focused adversarial suite: 2 files / 7 tests passed.
- Static release-contract guard: 33 checks passed.
- Full Vitest: 23 files / 102 tests passed.
- `npx tsc -b`: passed.
- `npm run build`: passed with `ROLLODOWN_MAX_THREADS=1` in this shared Windows environment (the default parallel Rolldown build exhausted the local native allocator; source was unchanged and the constrained build completed).
- `npm run lint`: exit 0; repository has pre-existing warnings, and this lane adds none.
- `npm run tekshir`: passed; legacy SMETA/F2 suite reports 74 checks, `BUG_FOUND=0`; the new 33 checks are included.
- `git diff --check`: passed.
- Performance, local no-network run: 10k median `187.77 ms`; 50k `867.43 ms`.

## Findings

| Class | Finding | Evidence / action |
|---|---|---|
| INFORMATIONAL | Static source contract found no tenant-crossing, direct-Supabase Workbench, Drive/GAS interactive-path, public-R2, or migration-order violation. | New guard is green; retain it in integration. |
| INFORMATIONAL | `PRICE_VARIANCE` existed in the exception taxonomy but was not emitted by the pure engine. | Fixed in this branch; adversarial test proves it. |
| MEDIUM | `FORMA3_RULE_UNRESOLVED` remains intentionally fail-safe. | Do not invent legal/tax/payment formulas. Keep the current explicit unresolved behavior until legal evidence exists. |
| HIGH | Production/preview `SESSIYA_KALIT`, private R2 binding, and authenticated HTTP behavior cannot be proven locally without owner credentials. | Claude must run the supplied smoke harness with an externally supplied session after deploy; stop on `zaxira_kalit: true`, `CONFIG`, 5xx, or JSON-contract failure. |
| INFORMATIONAL | Exact production workbook print-template authority remains outside this source-only lane. | The deterministic fidelity guard preserves non-destructive names, marker metadata, and official-row shaping; retain the existing real-template acceptance gate. |

Blockers found by this lane: **0**. High findings: **1** (owner-only post-deploy configuration/smoke gate; not a source defect).

## Integration instructions

1. Cherry-pick or merge this branch after the document-fidelity branch, resolving only the shared `calculation.ts` overlap by retaining separate baseline/F2/actual values plus `PRICE_VARIANCE` emission.
2. Run `npx tsc -b`, `npm run build` (set `ROLLODOWN_MAX_THREADS=1` if the shared Windows allocator is constrained), `npx vitest run`, `npm run lint`, and `npm run tekshir`.
3. After Claude's deploy/auth/R2 work, run the smoke command above with an authorized non-mutating session and IDs. Do not use it to create, approve, revert, upload, or delete business data.

`CODEX_PRE_MAIN_QA_READY_FOR_CLAUDE`
