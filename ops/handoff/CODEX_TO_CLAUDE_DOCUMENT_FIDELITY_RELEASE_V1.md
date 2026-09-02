# Document fidelity release V1 — Codex handoff

## Integration identity

- Branch: `codex/document-fidelity-release-v1`
- Base integration SHA: `cc7308cb43137b0329a638de6662e017d2a62d8c`
- Exact source implementation HEAD: `991f961fab94b80709b7b93646f86c091d0f9fa1` (`feat(documents): strengthen F2 projection fidelity`).
- Handoff commit: this subsequent documentation-only commit.
- Scope: frontend-only deterministic projection, fixtures, and QA. No production, main, integration branch, Supabase migration, Cloudflare function, or governance-file mutation was made.

## Evidence inspected read-only

- `docs/architecture/SMETA_F2_NAKOPITELNIY_CHANGE_CONTROL_V1.md` — canonical split of BOQ baseline, certified F2, actual procurement, approved change, approved-only Nakopitelniy, and unresolved Forma-3 rule.
- Real unzipped LRV_PLUS / F2 workbook evidence under `_f2lab/_unz/`, including Amfiteatr source examples.
- TIZIM_01 behavior in `Smeta tizimi/30_Panel.js`, `Smeta tizimi/15_IshTurlar.js`, and `Smeta tizimi/10_Engine.js`: `~` replacement and `+` additional markers, logical hierarchy, and hidden technical marker behavior.
- Existing legacy compatibility layer in `frontend/src/lib/park-document-control/legacy-compat/` and its regression fixtures/tests.

## Implemented projection rules

- Stable `lineId` and optional `parentLineId` are carried in the projection; displayed row position is not identity.
- BOQ names are never rewritten to carry replacement/additional explanations. Change state remains technical metadata (`changeKinds`) and is rendered only as a subtle marker/border in the Workbench.
- Official export rows are a separately shaped projection: no line IDs, parent IDs, revision IDs, or change metadata are included.
- Certified F2 money is `certified quantity × certified F2 unit price`, independently for previous, current, and cumulative values.
- Baseline/reference, certified F2, actual procurement, and approved-change bases remain distinct. Actual procurement never overwrites baseline or F2 price.
- Nakopitelniy quantity entitlement is calculated from baseline plus approved deltas. Pending/rejected changes are excluded. Approved F2 alone enters certified cumulative values.
- The same pure calculation engine feeds Workbench and export preview; calculation has no network/Drive/GAS work and indexes period/change data before mapping BOQ rows.

## Legacy compatibility

- The existing TIZIM_01 `~` / `+` semantics are preserved without creating banner rows or mutating contractual names.
- Existing BL→RS proportional behavior and direct RS override remain covered by the legacy compatibility suite; this change does not replace those adapters or make legacy row numbers canonical.

## Changed files for integration

- `frontend/src/lib/construction-document-control/types.ts`
- `frontend/src/lib/construction-document-control/calculation.ts`
- `frontend/src/lib/construction-document-control/validation.ts`
- `frontend/src/lib/construction-document-control/fixtures/document-fidelity.ts`
- `frontend/src/lib/construction-document-control/document-fidelity.test.ts`
- `frontend/src/lib/construction-document-control/large-data.test.ts`
- `frontend/src/components/construction-document-control/ProgressValuationWorkspace.tsx`

## Files Claude must not integrate from this lane

- No `supabase/migrations/**` changes (none made).
- No Cloudflare/API/auth function changes (none made).
- No `docs/governance/CURRENT_STATE.md`, `ops/ACTIVE_TASKS.json`, or release-governance-document changes (none made).

## QA evidence

- Focused document fidelity: 2 files, 8 tests passed.
- Full frontend suite: 21 files, 95 tests passed.
- `npx tsc -b`: passed.
- `npm run build`: passed.
- `npm run lint`: passed (repository has pre-existing warnings; this lane leaves no new warning).
- `npm run tekshir`: passed, 74 checks, `BUG_FOUND=0`.
- `git diff --check`: passed.
- 10k BOQ deterministic calculation: `71.44 ms` locally (`DOCUMENT_FIDELITY_10K_MS`); no per-row network calls and indexed O(n·periods) behavior.

## Known unresolved rules

- `FORMA3_RULE_UNRESOLVED` intentionally remains fail-safe until verified legal/official rule evidence exists. No Forma-3 formula, tax, markup, or payment-due calculation was invented.
- This lane does not certify an external government print template beyond the available workbook/legacy evidence; official export uses only its explicit business columns and excludes technical metadata.

## Conflict risks

- Shared model/UI files (`types.ts`, `calculation.ts`, `validation.ts`, `ProgressValuationWorkspace.tsx`) can conflict with release-owner Workbench changes. Resolve by retaining this lane's price-basis separation and official-row shaping while preserving newer backend adapter wiring.
- New fixture/test files are additive and should be retained as acceptance coverage.

## Final status

`CODEX_DOCUMENT_FIDELITY_READY_FOR_CLAUDE`
