# System Control Center v1 (CTRL-001) — architecture contract

Status: DRAFT (Claude, Chief Architect) · 2026-09-01 · Active P0

Successor to the TIZIM_01 "Smeta tizimi" control sheet: a real operational
control plane so the Product Owner can see and steer the platform.

Route: `/admin/test/tizim-nazorat` (canonical `/admin/system-control` alias later).
Tabs: **UMUMIY · MODULLAR · INTEGRATSIYALAR · JOBS · XATOLAR · AUDIT**.

---

## 1. Core law

Supabase = truth/config. Control Center = operational control plane (a view +
a small set of audited commands). No business logic lives in the screen.

**Control unit = a BUSINESS CAPABILITY / COMMAND / JOB / INTEGRATION.**
Never a toggle per internal JS function. A new significant capability is not
platform-DONE until it is registered and observable here.

## 2. Capability registry (canonical entity)

`t2_capability` — one row per controllable unit:

| field | meaning |
|---|---|
| `kod` | stable slug, e.g. `storage.document_upload`, `job.bulk_import`, `integration.didox` |
| `nom`, `izoh` | display |
| `turi` | `capability` \| `command` \| `job` \| `integration` |
| `default_holat` | `on` \| `off` (ship default) |
| `owner_domain` | `storage`, `smeta`, `procurement`, `finance`, … |
| `kill_switch` | bool — can this be hard-disabled? |
| `versiya` | optimistic lock |

`t2_capability_override` — scoped enable/disable:

| field | meaning |
|---|---|
| `capability_kod` | FK |
| `scope` | `global` \| `company` \| `project` |
| `scope_id` | null for global, else kompaniya_id / loyiha_id |
| `holat` | `on` \| `off` |
| `sabab`, `actor_id`, `created_at` | audit |
| `versiya` | optimistic lock |

## 3. Flag precedence (deterministic)

Effective state for (capability, company?, project?):

```
project override  >  company override  >  global override  >  capability.default_holat
```

`kill_switch=true` + a global `off` override = hard stop: every scope resolves
`off` regardless of narrower overrides. Resolver:
`t2_capability_effective_v1(p_kod, p_kompaniya_id?, p_loyiha_id?) -> jsonb
{holat, manba:'project|company|global|default|killswitch', versiya}`.

## 4. Commands (audited, actor-bound via `t2_actor_kompaniya_azo_tekshir`)

`t2_capability_override_set_v1(p_actor_id, p_kod, p_scope, p_scope_id, p_holat, p_sabab, p_expected_version, p_operation_id)`
`t2_capability_killswitch_v1(p_actor_id, p_kod, p_on, p_sabab, p_operation_id)`
`t2_job_pause_v1 / t2_job_resume_v1 / t2_job_retry_v1(p_actor_id, p_job_kod, p_operation_id)`

Every command: authenticate actor → validate → optimistic version →
operation_id idempotency → minimal write → `t2_audit_yoz(..., 'control', NULL,
'<details>', 'actor:<id>')` → canonical result. Only company `boss`/`superadmin`
role (or a global-admin membership) may set `global` scope overrides or
kill-switches — enforced in the command, not just RLS.

## 5. Read models

- `t2_control_umumiy_v1` — system health: DB reachable, `main_sha` (from a
  `t2_deploy_state` singleton row updated by release tooling), frontend commit,
  GAS deployment version, active job count, last error timestamp.
- `t2_control_modullar_v1` — every `t2_capability` + its effective state per the
  current company/project scope + last change (who/when).
- `t2_control_integratsiyalar_v1` — `turi='integration'` rows + last sync
  success/error (`t2_integration_health`).
- `t2_control_jobs_v1` — `t2_job` rows: kod, holat (`idle|running|paused|failed`),
  last_success_at, last_error, progress.
- `t2_control_xatolar_v1` — recent `t2_audit_log` rows where `amal_turi` ends
  `_failed` or modul in error set, newest first, capped.
- `t2_control_audit_v1` — `t2_audit_log` filtered to `modul='control'`:
  actor, capability, old→new, timestamp, sabab.

Writes normalized; reads denormalized per tab.

## 6. Error contract

`CAPABILITY_NOT_FOUND`, `CONTROL_SCOPE_INVALID`, `CONTROL_PERMISSION_DENIED`,
`STALE_VERSION`, `OPERATION_ID_REQUIRED`, `KILLSWITCH_ACTIVE`,
`JOB_NOT_PAUSABLE`. UI translates.

## 7. Deploy-state singleton

`t2_deploy_state` (single row, `id=1`): `main_sha`, `frontend_deploy_id`,
`gas_deploy_version`, `db_migration_head`, `updated_at`, `updated_by`. Set by
the release step (initially by a Control Center command
`t2_deploy_state_set_v1`, later by CI). The UMUMIY tab reads this — it is how
the Product Owner sees "what is actually live".

## 8. Lane split (zero file overlap)

**CTRL-001B — Claude (core / heavy logic):**
`supabase/migrations/2026090*_t2_capability_registry*.sql` (+ rollback/acceptance),
`Smeta tizimi/93_T2Control.js` (GAS bridge, service_role → enforce actor),
`frontend/src/api/t2-control.ts`, `frontend/src/test02/TestSystemControl.tsx`,
`frontend/src/App.tsx` route + `frontend/src/admin/AdminShell.tsx` nav,
this contract, `ops/handoff/CTRL-001.md`.

**CTRL-001A — Codex (mechanical UI):**
`frontend/src/components/control/*` — reusable presentational components only:
`CapabilityToggle`, `HealthBadge`, `ScopeSelector`, `ControlTable`,
`JobStatusRow`, `AuditRow`, `KillSwitchButton` + `control-components.test.tsx`.
Presentational, typed props, no data fetching, no business rules. Consumes the
types Claude publishes in `t2-control.ts` (imported type-only).

## 9. Integration

Both lanes DONE → Claude integrates into `integration/system-control-final`,
full verify, one consolidated release (migration + GAS + frontend). Same
OPTION-(b) discipline as STOR-001: apply, behavioral acceptance on prod inside
a rolled-back transaction, fix-forward or rollback.
