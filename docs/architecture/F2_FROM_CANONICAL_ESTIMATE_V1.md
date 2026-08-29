# F2 from Canonical Estimate V1

## Calculation

For a matched estimate item, V1 computes:

`current = current reported`

`cumulative = previous certified + current`

`remaining = estimate quantity - cumulative`

For `100 m3`, `41 m3`, `34.6 m3`: current `34.6`, cumulative `75.6`, remaining `24.4`.

## Validation

- Negative/non-finite input is rejected.
- If cumulative exceeds estimate quantity, policy produces a warning or block.
- If no existing canonical estimate item is matched, `UNMATCHED_WORK` is blocking. The item is shown for review and is not silently added to F2.

## Production boundary

This is a draft calculator. TIZIM_02 keeps `t2_akt` + `t2_akt_qator` as the write authority and `t2_qator_holat` as the calculated status view. A future adapter must call the approved server command and preserve its document state, tenant checks, audit trail and existing F2 controls.

## ABC4

`composeAbc4Text(canonicalEstimate, abc4Profile)` is an adapter boundary. Without a verified ABC4 export/sample and grammar profile, it produces human-readable structured text and `NEEDS_SAMPLE`; it does not claim an importable ABC4 file.
