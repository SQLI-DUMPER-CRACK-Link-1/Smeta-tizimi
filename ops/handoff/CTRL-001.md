# CTRL-001A — System Control Center UI components (Codex)

- TASK ID: CTRL-001A · OWNER: codex · lane_of: CTRL-001
- OBJECTIVE: reusable presentational components for the Control Center; NO data
  fetching, NO business rules, NO route/menu, NO backend.
- REPO: github.com/SQLI-DUMPER-CRACK-Link-1/Smeta-tizimi
- BASE: origin/main @ d1d1315
- BRANCH: codex/ctrl-control-center-components-v1
  (Codex's first pass is on `codex/system-control-ui-v1` @ dca7c2b — Claude
   integrates from there.)
- REQUIRED READING: AGENTS.md, docs/governance/CONSTITUTION.md,
  docs/architecture/SYSTEM_CONTROL_CENTER_V1.md
- OWNED PATHS (only): `frontend/src/components/control/**`
- DO-NOT-TOUCH: App.tsx, AdminShell.tsx, any `frontend/src/api/**`,
  any `Smeta tizimi/**`, any `supabase/**`, `frontend/src/test02/**`.
- COMPONENTS: `HealthBadge` (ok/warn/danger/unknown), `CapabilityToggle`
  (on/off/paused/read_only + disabled + onChange), `ScopeSelector`
  (global/company/project), `ControlTable` (generic columns+rows), `JobStatusRow`
  (idle/running/paused/failed + progress + retry/pause/resume), `AuditRow`
  (actor / capability / old→new / when / sabab), `KillSwitchButton` (armed
  confirm). Typed props; import capability/health/job types type-only from
  `../../api/t2-control` (Claude publishes them).
- TESTS: `frontend/src/components/control/control-components.test.tsx` (render +
  prop behavior, like the storage component tests).
- ACCEPTANCE: `npx vitest run src/components/control` green; `npx tsc -b` green;
  `oxlint` clean on the new files.
- FORBIDDEN: prod migration, main push, editing anything outside owned paths,
  inventing a competing control model (use the contract).

## CTRL-001B — Claude (core + integration)
Claude owns the capability registry migration, `93_T2Control.js` GAS bridge,
`t2-control.ts`, `TestSystemControl.tsx`, route `/admin/system-control`, nav,
first real capability registration (STORAGE / F2 / SMETA / integrations / jobs
from repo reality), and final assembly on `integration/system-control-final`.
