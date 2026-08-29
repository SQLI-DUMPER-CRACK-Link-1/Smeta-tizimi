# Universal Estimate Engine V1

## Purpose and boundary

V1 converts supported source evidence into a reviewable canonical estimate draft. It is deliberately isolated at `frontend/src/estimate-engine/` and is not imported by the production UI, API, or database layer.

AI may classify text, identify scope and suggest candidates. It is never an authoritative calculation engine. Only deterministic functions may apply quantities, unit conversion, approved coefficients, norm resource rates, prices, or F2 balances. A missing fact remains missing.

## Pipeline

`source -> semantic parser -> work scope -> unit normalizer -> norm candidate matcher -> deterministic resource expansion -> validation -> canonical estimate -> F2/ABC4 adapters`

Every generated work item and resource retains `Evidence`. `known`, `assumed`, `missing`, and `requires_confirmation` are separate states; V1 does not convert an assumption into a fact.

## Canonical model

`EstimateDocument` owns sections and source evidence. `EstimateWorkItem` contains explicit quantity/unit when available, source confidence, norm candidate IDs, assumptions/questions, attributes and resources. `EstimateResource` has type (`labor`, `machine`, `material`, `equipment`), source evidence and optional source-backed price. `ValidationIssue` contains severity, stable code, message and required action.

## TIZIM_02 integration proposal (not applied)

The current canonical operational chain is retained:

| Existing truth | V1 integration role |
| --- | --- |
| `t2_qator` | Approved canonical work/resource rows; V1 drafts must be reviewed and mapped before an approved command creates rows. |
| `t2_narx` / `t2_narx_markaz` | Only price source. A missing price remains `null`, never `0` or AI-generated. |
| `t2_akt` + `t2_akt_qator` | Authoritative Fakt/F2 documents and quantities. V1 F2 is a pre-write draft only. |
| `t2_qator_holat` | Existing server-calculated smeta/fakt/F2/remaining read model; do not duplicate it in UI. |

No migration is included. Before persistence, an owner-approved mapping must decide: source-document storage, item-to-`t2_qator` identity, approved norm catalogue source/version, evidence retention, and the authorized command/RPC path.

## AI Estimate Agent contract

1. Parse and classify evidence.
2. Retrieve candidates only from a verified catalogue adapter.
3. Validate material ambiguity and ask only questions that affect a line, norm or quantity.
4. Build an evidence-bearing draft.
5. Call deterministic calculators.
6. Quality-check missing price/norm/evidence and render a draft, never an auto-approved document.

## Guardrails

- No fake norm codes, rates, resource consumption, prices or ABC4 syntax.
- No implicit excavation, formwork, pump, crane, waterproofing, transport, welding or tying method.
- Unmatched work is blocked from automatic F2 inclusion.
- Coefficients must be explicit, finite and non-negative.
