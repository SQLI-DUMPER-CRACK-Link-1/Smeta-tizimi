# Universal Estimate Engine reconciliation

## Branch evidence

- Remote branch: `codex/universal-estimate-engine-v1`
- Head: `32e2054b195071dbed679b4b9d7bbf3f8dc31f67` (`feat(estimate): add universal estimate engine v1 foundation`).
- Reusable files: `frontend/src/estimate-engine/{parser,norm-matcher,resource-expander,abc4-composer,f2-calculator,validation,types}.ts` and focused tests.
- Design contracts: `UNIVERSAL_ESTIMATE_ENGINE_V1.md`, `TEXT_TO_SMETA_PIPELINE_V1.md`, `F2_FROM_CANONICAL_ESTIMATE_V1.md`.

## V2 integration decision

Safe for later integration as a pure deterministic engine only. Preserve the separation: AI parses/classifies candidates; canonical versioned norm pack resolves resources; deterministic engine calculates; F2 is derived with canonical lineage.

## Missing integration dependencies

1. Canonical WBS/BOQ IDs and project/object scope input adapter.
2. Versioned norm/catalog read model; no invented norms, prices or resource values.
3. Persisted estimate/F2 lineage and expected-version command boundary.
4. Tenant authorization and audit at the backend command layer.

## Next action

Claude should review the branch against the released F2/contract model, then cherry-pick/rebase the isolated `frontend/src/estimate-engine/` paths only after a canonical catalog adapter is agreed.
