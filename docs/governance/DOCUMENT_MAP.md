# Governance document map

The boot path is intentionally short:

```text
AGENTS.md
  -> docs/governance/CONSTITUTION.md
  -> docs/governance/CURRENT_STATE.md
  -> ops/ACTIVE_TASKS.json
  -> relevant accepted contract or ADR in docs/architecture/
```

## Current authority

- `AGENTS.md`: boot protocol only.
- `docs/governance/CONSTITUTION.md`: non-negotiable rules.
- `docs/governance/CURRENT_STATE.md`: replaceable measured state.
- `ops/ACTIVE_TASKS.json`: task locks and handoffs.
- `docs/architecture/*`: accepted implementation contracts/ADRs, only when
  explicitly relevant to the task and consistent with the Constitution.

## Retained historical or compatibility material

| Existing path | Treatment |
|---|---|
| `00_BOSH_QONUN.md` | Retained legacy policy. Its evidence-backed rules were extracted into the Constitution; its old “highest document” claim is superseded by the boot chain. |
| `ARXITEKTURA.md` | Retained ecosystem vision; mixed GAS/Drive-first sections are historical unless an accepted contract confirms them. |
| `tizim02/ARXITEKTURA.md` | Retained layer detail; current Supabase-first rules in the Constitution and accepted ADRs win on conflict. |
| `tizim02/AGENT.md` | Compatibility detail for old agents. Root `AGENTS.md` must be read first. |
| `tizim02/MULOQOT.md` | Append-only historical journal. It records evidence and handoffs but is never current-state authority. |
| `tizim02/navbat.json` | Legacy domain ownership map. New work is locked by task in `ops/ACTIVE_TASKS.json`; keep both consistent when a handoff affects domains. |
| `docs/reviews/*` | Point-in-time review/evidence snapshots; they do not override current state or contracts. |
| `ANTIGRAVITY_*.md`, `Smeta tizimi/CLAUDE.md` | Retained briefs/project detail, reached through compatibility shims and verified against the boot chain. |
