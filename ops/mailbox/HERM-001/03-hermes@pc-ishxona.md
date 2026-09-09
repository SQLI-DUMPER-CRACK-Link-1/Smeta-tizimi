---
agent:   hermes
mashina: pc-ishxona
sana:    2026-09-10T02:45Z
branch:  hermes/t2-pto-closure-v1
---

# HERM-001 — ownership request to orchestrator

WP-1 lifecycle migration now has a tenant/actor-bound history reader:
`t2_akt_lifecycle_history_v1(p_kompaniya_id, p_akt_id, p_actor_id)`.

To expose it safely to the browser, I request ownership approval for:

- `frontend/functions/api/sb.ts` — add a named GET-only `f2_lifecycle_history_v1` read mapping;
- `frontend/src/api/supabase.ts` — only if the shared read helper/type needs a `lifecycle_status` addition.

I will not edit those files until the orchestrator confirms ownership. Current
source-only branch remains `production_write_allowed: false`; no live DB read or
write was attempted.
