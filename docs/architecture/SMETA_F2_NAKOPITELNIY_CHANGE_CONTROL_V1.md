# PARK DOCUMENT CONTROL / F2 / NAKOPITELNIY / FORMA-3 — V1

Status: SOURCE (Claude, Lead Owner) · 2026-09-02 · P0 · not applied to production.

**This is not a greenfield rebuild.** Every change below is REUSE → EXTEND →
ADDITIVE. No parallel F2, no parallel estimate truth, no replacement architecture.

---

## 1. Evidence — what already exists (measured from the live schema)

| Concern | Canonical table / RPC | Verdict |
|---|---|---|
| BOQ / scope / Smeta line | `t2_qator` (id, obyekt_id, ota_id, tur, kod, nom, birlik, hajm, narx, kat, summa, `qoshimcha`, `zamena`, versiya, operation_id) | REUSE — this is scope truth |
| F2 / Fakt document | `t2_akt` (tur ∈ fakt\|f2, oy, hujjat_jami, holat, shartnoma_id, versiya, operation_id) + `t2_akt_qator` (akt_id, qator_id, hajm, narx, summa) | REUSE |
| F2 lifecycle | `t2_akt_yarat` / `t2_akt_tasdiqlash` / `t2_akt_bekor` | REUSE — **`t2_akt_yarat` already sets F2 line narx = `coalesce(client_narx, q.narx)`; it NEVER writes back to `t2_qator.narx`.** Estimate price is already safe from silent overwrite. |
| Per-row execution rollup | `t2_qator_holat` view — smeta / fakt / f2 / qoldiq (remaining) + `f2_narx`, `fakt_narx`, `f2_narx_farq_foiz` | REUSE — but it compares against the *current* `q.narx` (drift) and is **not period-aware** |
| Field-level change log | `t2_ozgarish` (75 205 rows) — every `t2_qator` field change: jadval/maydon/eski/yangi/amal/kim | REUSE — but this is a diff log, NOT a change-control instrument |
| BOQ line manual edit | `t2_qator_tahrir` (optimistic-locked, `narx_usul='QOL'`, logged to `t2_ozgarish`) | REUSE — the only `t2_qator.narx` overwrite path; F2 import does not use it |
| Contracts | `t2_shartnoma` (loyiha_id, summa_bez_nds, nds, jami_nds_bilan, holat) | REUSE |
| Document status atoms | `t2_document_registry` (FILE-TRUTH) + `t2_akt.holat` + `t2_signal` | REUSE |
| Park project | loyiha_id **4** "Yangi O'zbekiston bog'i" — objects 5 Fast food, 6 Amfiteatr, 7 Suniy Ko'l, 8 Avtosalon, 10 Stella | — |

## 2. The gap (why closeout is not yet controllable)

1. **F2 valuation variance is not frozen.** `t2_akt_qator` records `narx`/`summa`
   but no `baseline_narx` snapshot. `f2_narx_farq_foiz` in `t2_qator_holat` is
   computed against the *live* `q.narx`, so editing the BOQ price silently
   rewrites the historical F2 variance. Actual procurement price (up or down)
   has nowhere to be recorded as such.
2. **No Nakopitelniy vedomost.** `t2_qator_holat` sums *all* F2. A cumulative
   statement needs: baseline + Σ(previous approved periods) + current period +
   cumulative + remaining, per BOQ line, with the valuation lineage.
3. **No change-control instrument.** `t2_qator.qoshimcha`/`zamena` are bare
   booleans — no reason, no authorization, no type, no recoverable original,
   no link to a change document.
4. **No Forma-3 (КС-3).** No period value-certificate entity aggregating
   approved F2 (КС-2) → markup → contract → payment.
5. **No closeout document-control rollup.** No single view of what is complete /
   missing / superseded / pending / approved / rejected / required per object.

## 3. Decision (REUSE → EXTEND → ADDITIVE)

### EXTEND (additive columns, backfilled)
- `t2_akt_qator` += `baseline_narx numeric`, `baseline_summa numeric`,
  `narx_manba text` (`smeta`\|`taminot`\|`qol`\|`aralash`), `variance_summa numeric`
  (**stored**, = `summa - baseline_summa`). `t2_akt_yarat` snapshots the baseline
  from `t2_qator` at creation. Backfill sets `baseline_* = t2_qator.narx` snapshot,
  `narx_manba='smeta'` for existing rows. **`t2_qator.narx` is never touched.**
- `t2_akt` += `forma3_id bigint` (nullable), `davr_muhr boolean` (period seal).

### ADDITIVE NEW ENTITIES
- `t2_smeta_ozgarish` + `t2_smeta_ozgarish_qator` — change order (baseline
  snapshot jsonb; tur = almashtirish\|qoshimcha_ish\|olib_tashlash\|hajm_ozgarish\|
  yangi_bolim\|yangi_ish\|resurs_almashtirish\|boshqa; holat lifecycle; approval
  applies to `t2_qator` while the pre-change snapshot stays recoverable).
- `t2_forma3` + `t2_forma3_akt` — КС-3 period value certificate.

### ADDITIVE READ MODELS / COMMANDS (RPC, membership-checked, service_role only)
- `t2_nakopitelniy_v1(obyekt_id, actor_id, davr)` — period-aware cumulative statement.
- `t2_smeta_ozgarish_yarat_v1` / `_tasdiqlash_v1` — change control.
- `t2_forma3_yarat_v1` / `_tasdiqlash_v1` — КС-3.
- `t2_obyekt_yakunlash_v1(loyiha_id, actor_id)` — closeout doc-control rollup.
- `t2_akt_qator_baseline_backfill_v1()` — one-time backfill.

### SAFETY (every migration)
Additive & backward-compatible · preserves canonical IDs & production data ·
no Drive/Sheets truth regression · no row-number identity · operation_id
idempotency · optimistic locking + revision snapshots · `t2_audit_yoz` audit ·
tenant isolation via `t2_actor_kompaniya_azo_tekshir` · AI never invents
norms/prices/facts (all these RPCs are deterministic, no AI).

## 4. Migrations (filename order)

| File | Contents |
|---|---|
| `20260910120000_t2_f2_baseline_price_v1.sql` | `t2_akt_qator` baseline cols + `t2_akt_yarat` snapshot + backfill + `t2_nakopitelniy_v1` |
| `20260911120000_t2_smeta_change_control_v1.sql` | `t2_smeta_ozgarish(_qator)` + create/approve commands |
| `20260912120000_t2_forma3_closeout_v1.sql` | `t2_forma3(_akt)` + `t2_akt.forma3_id/davr_muhr` + `t2_forma3_*` + `t2_obyekt_yakunlash_v1` |

## 5. User-visible slice

`/admin/nakopitelniy` — pick a project object → cumulative statement table
(baseline · previous periods · current F2 · cumulative · remaining · price
variance), the change-order list, the Forma-3 list, and the closeout status
strip. No fake project truth: every number traces to `t2_qator` / `t2_akt` /
`t2_akt_qator`.
