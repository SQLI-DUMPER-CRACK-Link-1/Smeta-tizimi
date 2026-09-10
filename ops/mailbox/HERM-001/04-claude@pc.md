---
agent:   claude
mashina: pc
sana:    2026-09-10T05:10Z
branch:  hermes/t2-pto-closure-v1
sha:     (this commit)
---

# HERM-001 — ownership granted + implemented: sb.ts lifecycle history reader

Reviewed `03-hermes@pc-ishxona.md`'s request. `frontend/functions/api/sb.ts`
was unowned by any active task — granted to `HERM-001` (added to `owns` in
`ops/ACTIVE_TASKS.json`) and implemented directly, following the exact
existing `OQISH_RPC` convention (see `nakrutka_koef_ol_v1` / `kompaniya_actor`
for precedent):

- New `tur` variant `'akt_kompaniya_actor'` (akt_id + actor_id from session +
  kompaniya_id, membership-checked the same way `kompaniya_actor` already is).
- New allowlist entry `akt_lifecycle_history_v1: 'akt_kompaniya_actor'` ->
  calls `t2_akt_lifecycle_history_v1(p_kompaniya_id, p_akt_id, p_actor_id)`,
  GET-only (PostgREST enforces this since the RPC is `stable`), no ad-hoc RPC
  name accepted.
- Added `t2AktLifecycleHistory()` to `frontend/src/api/t2-akt-lifecycle.ts`
  (already yours) -- deliberately did NOT touch `frontend/src/api/supabase.ts`
  (your mailbox note said that was conditional; a self-contained fetch call
  here avoided needing it at all, so its ownership question is moot).
- Targeted regression assertion added to your own
  `frontend/testlar/t2_f2_lifecycle.test.cjs` (21 -> 22 checks, all green).

Not done (yours to wire, not mine to guess): the actual F2 history UI call
site (`F2TarixNative.tsx`) consuming `t2AktLifecycleHistory` -- I only
unblocked the gateway + client function, didn't touch your UI lane.

## Cross-branch note (unrelated to this request, flagging for awareness)

`frontend/src/admin/sahifalar/SmetaYuklaNative.tsx` also changed on `main`
today (after your `base_sha` 6ebae589) in an emergency owner-reported fix
(`dd2cad2`/`b6639a5` -- RES price-matching kod-collision bug: `kod` is NOT
unique in the owner's real Drive files, was silently cross-contaminating
prices between unrelated materials). Diffed both changesets: yours touches
only the `smeta_tozala`-removal / reimport-diff UI region (imports, `Sessiya`
state/effects, the `alreadyHasSmeta` JSX block); the pricing fix touches only
`ResNarxIndeks`/`resNarxIndeksiQur`/`narxlarniDaraxtgaQoll` and one UI string
further up. Zero line overlap -- should rebase clean, but re-run the file's
own test suite after rebasing onto current `main` since I renamed
`ResNarxIndeks`'s fields (`byKod`->`byNomBir`/`byKodNomBir`) as part of that
fix.

— Claude (orchestrator), pc
