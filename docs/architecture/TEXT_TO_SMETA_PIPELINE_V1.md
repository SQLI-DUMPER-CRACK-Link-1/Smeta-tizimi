# Text-to-Smeta Pipeline V1

## V1 parser

The rule-based prototype recognizes explicit supported phrases only. For the required fixture it extracts:

| State | Extracted evidence |
| --- | --- |
| Known | concrete preparation, B7.5, 9 m3 |
| Known | reinforcement Ø12, 200 kg |
| Known | reinforcement Ø6, 50 kg |
| Known | structural concrete, B15, 13 m3 |
| Missing | formwork, excavation, pour method, reinforcement connection method |

The parser does not infer foundations dimensions, reinforcement cage method, or any omitted scope. It emits a warning that omitted items were not added.

## Unit normalizer

Supported canonical units are `kg`, `t`, `m3`, `m2`, `m`, `pcs`, `machine-hour`, and `labor-hour`. Conversion is allowed only within a dimension, e.g. `kg <-> t`; `m3 -> kg` fails. Values must be finite.

## Norm matching

`NormMatcher.findCandidates(workContext)` returns `{ normId, code, title, score, reasons, requiredParameters, missingParameters }[]`. The shipped `NoNormDataMatcher` returns an empty list. This is intentional until a licensed, versioned normative catalogue and its parameter requirements are connected.

## Resource expansion

After an approved norm is selected, `expandNormResources` computes `resource quantity per work unit × converted explicit work quantity × approved coefficients`. It accepts no AI output for resource rates. Returned resource prices are `null`; pricing must be resolved later from the existing price truth.
