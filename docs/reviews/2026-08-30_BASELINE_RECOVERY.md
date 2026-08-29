# TIZIM_02 Clean Baseline Recovery — 2026-08-30

## Scope and method

This recovery did not modify the dirty shared checkout or merge any feature branch. A new worktree was created from `main` commit `c8abc6f984fc2a4cc34dab2a0939d0f711fc2c5b` on branch `codex/baseline-recovery`:

```text
C:\Users\PC\Documents\GAS__baseline_recovery
```

The initial clean worktree status was empty. Results below therefore distinguish the main baseline from unstaged/stashed/feature-worktree artifacts.

## Root causes and classification

| Finding | Classification | Evidence | Resolution |
|---|---|---|---|
| `npm run test` loaded `frontend/testlar/*.test.cjs` and `.mjs` as Vitest suites. These are standalone Node guard scripts that intentionally call `process.exit()`, so Vitest marked otherwise-successful guards as failed. | **Main baseline** | Reproduced in clean `c8abc6f`; 12 suites failed with `process.exit unexpectedly called with "0"`. | Add the guard directory to Vitest exclusions while preserving Vitest defaults. `npm run tekshir` remains the owner of these scripts. |
| Vitest exclusion initially replaced its defaults, causing dependencies under `node_modules` to be collected as tests. | Recovery implementation issue, corrected in this branch | `node_modules/meshoptimizer`, `pdf-parse`, etc. were collected only after the first narrow exclusion. | Use `...configDefaults.exclude` plus the project guard exclusion. |
| Fresh worktree had neither working `node_modules` nor an immediately visible lockfile in the dependency check. The first concurrent/npm-interrupted install left partial package contents and produced widespread false TypeScript resolution failures. | Environment/bootstrap issue, **not source-code baseline** | `npm ls` first reported unmet dependencies; partial package folders lacked `react/index.js` and `@types/react/index.d.ts`; a clean `npm ci` restored them. | No application dependency was changed. Use `npm ci`/`npm install` to provision the existing dependency graph before judging build output. |
| Build warning: `/grid.svg` is unresolved at build time; Vite leaves it for runtime resolution. Chunk-size/dynamic-import warnings are also emitted. | **Main baseline warning**, non-blocking | Clean build exits 0. | Not changed; no functional failure was observed. |
| Registry drift | **Not present on main** | `node tizim02/registr.gen.cjs --tekshir` exited 0 (`262 funksiya, 97%`). | No change. |
| Broken internal links | **Not present on main** | `node frontend/testlar/t2_navbat.test.cjs` exited 0; its MULOQOT/AGENT link checks all passed. | No change. |

## Minimal repair

Only `frontend/vitest.config.ts` changed. It now imports `configDefaults` and excludes `testlar/**/*.test.{cjs,mjs}` in addition to Vitest's standard exclusions.

This is a runner-boundary fix, not a reduction of test coverage:

- `npm run test` executes the five Vitest suites in `src`.
- `npm run tekshir` continues to execute the twelve Node/GAS/registry/route guard scripts in `testlar` as child processes.

No feature behavior, production schema, GAS code, or duplicate filename was changed.

## `(1)` duplicate audit

### Clean main result

`git ls-files` at `c8abc6f` contains **zero** paths ending in ` (1).…`; the clean worktree contains none. Therefore duplicate-file failures reported by C3 are not caused by the current main baseline.

### Historical / agent-worktree result

The duplicate introduction is in feature/stash history, not in `main`: commit `10ed5064597eb6f313a3a2d579ba9c63b8cf735d` (`feat(frontend): Master Plan Goal …`) added the set below; later feature commits `7c68d491…` and `5dd6da77…` removed portions. `fdfd6af4…` is an index-on-main stash snapshot, not a main commit. None was deleted or renamed by this recovery.

| Duplicate in feature/stash history | Canonical present at introduction | Content then identical? | Import expected | Origin |
|---|---|---:|---|---|
| `01_T2_LOYIHA_MIGRATSIYA (1).sql` | `01_T2_LOYIHA_MIGRATSIYA.sql` | Yes | No source import (migration artifact) | `10ed5064…` |
| `Smeta tizimi/96_T2Papka (1).js` | `Smeta tizimi/96_T2Papka.js` | Yes | No source import (GAS artifact) | `10ed5064…` |
| `fix_ts (1).js` | `fix_ts.js` | No | No source import (helper script) | `10ed5064…` |
| `frontend/functions/api/royxat (1).ts` | `frontend/functions/api/royxat.ts` | Yes | Canonical module path only | `10ed5064…` |
| `frontend/src/api/t2-ai (1).ts` | `frontend/src/api/t2-ai.ts` | Yes | Canonical module path only | `10ed5064…` |
| `frontend/src/api/t2-fakt (1).ts` | `frontend/src/api/t2-fakt.ts` | Yes | Canonical module path only | `10ed5064…` |
| `frontend/src/api/t2-xodim (1).ts` | `frontend/src/api/t2-xodim.ts` | Yes | Canonical module path only | `10ed5064…` |
| `frontend/src/test02/TestKorrespondensiya (1).tsx` | `TestKorrespondensiya.tsx` | Yes | Canonical route/component path only | `10ed5064…` |
| `frontend/src/test02/TestLoyiha (1).tsx` | `TestLoyiha.tsx` | Yes | Canonical route/component path only | `10ed5064…` |
| `frontend/src/test02/TestSotuvCrm (1).tsx` | `TestSotuvCrm.tsx` | Yes | Canonical route/component path only | `10ed5064…`; deleted in `5dd6da77…` |
| `frontend/src/test02/WrapperCRM (1).tsx` | `WrapperCRM.tsx` | Yes | Canonical component path only | `10ed5064…`; deleted in `5dd6da77…` |
| `frontend/src/test02/WrapperLogistika (1).tsx` | `WrapperLogistika.tsx` | Yes | Canonical component path only | `10ed5064…`; deleted in `5dd6da77…` |
| `frontend/src/test02/WrapperMoliya (1).tsx` | `WrapperMoliya.tsx` | Yes | Canonical component path only | `10ed5064…`; deleted in `5dd6da77…` |
| `frontend/src/test02/WrapperPortfel (1).tsx` | `WrapperPortfel.tsx` | No | Canonical component path only | `10ed5064…`; deleted in `5dd6da77…` |
| `frontend/testlar/t2_tenant_izolyatsiya (1).test.cjs` | `t2_tenant_izolyatsiya.test.cjs` | Yes | Canonical test path only | `10ed5064…`; deleted in `7c68d491…` |

“Canonical module path only” means a repository import search found no import of the `(1)` filename; the standard filename is the usable module identity. The two non-identical helpers/components require an owner-led semantic comparison before any deletion—this recovery intentionally did not make that decision.

## Verification

All commands were run in the clean worktree after dependency provisioning.

| Command | Result |
|---|---|
| `git status --short` before repair | PASS — clean |
| `npm run build` | PASS — Vite build completed; non-blocking `/grid.svg`, chunk-size and ineffective dynamic-import warnings remain |
| `npm run test` | PASS — 5 files, 13 tests |
| `npm run tekshir` | PASS — all twelve guard groups passed |
| `node tizim02/registr.gen.cjs --tekshir` | PASS — registry aligned (`262 funksiya, 97%`) |
| `node frontend/testlar/t2_navbat.test.cjs` | PASS — 19 checks, including internal links |
| duplicate guard in `npm run tekshir` | PASS — zero `(1)` files in the Git index |

## Changed and deliberately unchanged files

### Repaired

- `frontend/vitest.config.ts` — separates Vitest suites from standalone guard scripts.
- `docs/reviews/2026-08-30_BASELINE_RECOVERY.md` — this evidence report.

### Deleted or renamed duplicates

None. Clean `main` had none; feature/stash duplicates were left untouched.

## Remaining blockers

There are no blockers to the requested clean-main gates. Remaining non-blocking follow-up items are:

1. Fix or provide `/grid.svg` if the runtime deployment does not provide it.
2. Decide with each feature owner whether the two historically non-identical duplicate files (`fix_ts (1).js`, `WrapperPortfel (1).tsx`) contain changes worth transferring to their canonical counterparts.
3. Avoid concurrent `npm install` operations in multiple worktrees that share the same npm cache; the observed partial installation made source errors look much larger than they were.
