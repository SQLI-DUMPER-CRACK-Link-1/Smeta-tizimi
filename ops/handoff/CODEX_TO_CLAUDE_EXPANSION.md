# Codex → Claude expansion handoff

Branch: `codex/construction-os-expansion-v1`; integration checkpoint: `76f53afac39428803634071e1b2230bb74c03dfb`.

All packs are controlled components with typed stable IDs and no network calls. Suggested routes/wrappers must be wired by Claude; this branch intentionally does not touch `App.tsx`, `AdminShell.tsx`, current wrapper pages, backend, migrations, or release/governance files.

| Pack path | Readiness | Required backend adapter |
|---|---|---|
| `frontend/src/components/company-center` | UI_READY_BACKEND_MISSING | current company, memberships, create/join/invite commands |
| `subscription` | CONTRACT_ONLY | subscription/entitlement/usage read model |
| `commercial` | UI_READY_BACKEND_MISSING | normalized contracts and payment lineage |
| `procurement` | UI_READY_BACKEND_MISSING | procurement chain bounded read model |
| `schedule`, `design-control`, `quality`, `workforce`, `agent-surface` | CONTRACT_ONLY | canonical domain read models and reviewed commands |

Verification at this checkpoint: full Vitest **50/50**, typecheck PASS, lint PASS (existing warnings), Vite build PASS, `npm run tekshir` PASS, `git diff --check` PASS.
