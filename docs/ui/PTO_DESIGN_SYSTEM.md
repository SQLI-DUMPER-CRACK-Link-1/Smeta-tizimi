# PTO design system

## Design intent

Serious industrial command center: graphite/navy foundation, restrained blue/
violet accents, semantic green/yellow/red only for business state, dense but
calm tables, tabular numbers, evidence-first panels. No decorative 3D, fake KPI,
or animation that hides state.

## Tokens and semantic use

Use existing app tokens (`--background`, `--surface`, `--surface-2`, `--text`,
`--text-dim`, `--text-mute`, `--border`, `--accent`, `--danger`, `--warn`) and
existing utility classes. Do not introduce a second palette in PTO screens.

- **Accent:** selected route, active company/context, primary action.
- **Green:** confirmed/synced/approved only when backed by a real status.
- **Yellow:** incomplete, stale, missing price, or review required.
- **Red:** blocked/error/forbidden; never simply “not loaded”.
- **Muted:** unknown/unavailable, never numeric zero.

## Layout contract

- top: persistent `Company > Project > Object > Period` context;
- left: PTO workflow navigation on desktop;
- center: high-density work surface with local horizontal scroll;
- right: evidence/inspector/audit/AI draft panel where space allows;
- bottom: totals, warnings and sync/operation state;
- mobile: horizontal workflow nav and essential action order, not a scaled
  desktop table.

The night-run added only the safe first slice: a desktop/mobile workflow nav in
`frontend/src/test02/TestShell.tsx`. The shared project/object context is still
not implemented and must not be faked by labels.

## Component rules

1. Every button has a real handler or is visibly disabled with a reason.
2. Tables use `overflow-x-auto` locally and do not cause page-level overflow.
3. Loading, empty, error, stale, forbidden and incomplete states are distinct.
4. Numeric cells use tabular numbers and preserve `null`/unknown.
5. A source/evidence inspector shows file, sheet/row, operation, actor, time,
   version and mapping state.
6. AI suggestions are drafts; commit is a separate explicit command.
7. Destructive-looking actions use soft-delete/archive wording when that is the
   actual behavior.
8. Direct routes preserve the same context as wrapper tabs or redirect to the
   canonical workspace.

## Existing strengths to preserve

`SmetaTree` already provides virtualized tree rendering, search, hierarchy and
row-level details. The design work should compose it rather than rewrite it.
Mindmap data already includes object signals and aggregate fields; incomplete
values must remain warnings, not become decorative KPI.

## Accessibility and responsive targets

Verify keyboard focus, visible focus ring, labels for icon buttons, table headers,
ARIA names on workflow nav, and widths at 1920×1080, 1366×768, ~1024 and narrow
mobile. Fixed widths such as `w-96`/`w-64` need review where they are not
necessary.
