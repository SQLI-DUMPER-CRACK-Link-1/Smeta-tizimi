# Baseline and reconciliation records

This directory is intentionally outside `supabase/migrations/`. It contains
evidence and proposals used while reconciling a live project that predates its
canonical migration tree. Nothing below this directory is executable by the
Supabase migration runner.

After a reviewed `supabase db pull`, place the resulting single baseline in
`supabase/migrations/` and record its review evidence here. Do not turn old
ad-hoc SQL into a second baseline or replay it against production.

Pending proposals are under [pending/](pending/README.md).

---

## `production_schema_baseline.manifest.json` + `inventory/` (T2-LRV-CLOSURE-006, 2026-09-04)

**Read this before touching `supabase/isolated-test/run.cjs`.**

### What this is

`supabase/migrations/` alone cannot bootstrap a blank Postgres instance — none
of its 37 tracked forward migrations contain a `CREATE TABLE` for the base
tables (`t2_kompaniya`, `t2_obyekt`, `t2_qator`, `t2_foydalanuvchi`,
`t2_azolik`, …). This project predates its canonical migration tree (per the
paragraph above, written before this section), and a reviewed
`supabase db pull` baseline had never been captured.

To make progress on this without touching production data or writing
unverified SQL, this round did **read-only schema introspection** against
production (project `tuoyrzadkgoltpqkdiyx`) via the Supabase MCP's
`execute_sql` — `SELECT`-only queries against `information_schema`/
`pg_catalog`, zero DDL, zero DML, zero rows of business data ever read. The
result is `inventory/`: real, live-verified lists of every table, view,
sequence, function, trigger, RLS policy, index, constraint and column in the
production `public` schema, plus production's actual applied-migration
history (`inventory/applied_migrations_production.json`, from Supabase's own
migration ledger) reconciled against this repo's tracked migration files
(`inventory/repo_migration_reconciliation.json`).

### What this is **not**

**This is not a byte-faithful schema-only SQL dump.** `production_schema_baseline.sql`
does not exist yet — `baseline_sql_status` in the manifest says
`NOT_YET_CAPTURED`, honestly, because no `pg_dump`/`psql` binary and no
working Supabase CLI (`npx supabase` itself fails with `ENOENT` on this
Windows machine) were available to produce one. Reconstructing ~150 tables +
205 functions + 34 triggers + 25 policies by hand from `pg_catalog` text
functions was deliberately **not attempted** — an unverifiable, hand-assembled
"full dump" risks exactly the class of silent, plausible-looking-but-wrong
artifact this project's safety culture exists to prevent (see the production-
residue incident in `ops/handoff/T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md`).

**`BASELINE_EXPORT_TOOL_REQUIRED`** — to get the real `production_schema_baseline.sql`:
- run `supabase db dump --linked --schema public -f supabase/baseline/production_schema_baseline.sql`
  from a machine with a working Supabase CLI + network access, **or**
- download a schema-only backup from Supabase Studio → Database → Backups, **or**
- run `pg_dump --schema-only --schema=public <connection string>` from any
  machine that has the Postgres client tools installed.

Whoever produces that file should place it at
`supabase/baseline/production_schema_baseline.sql` and cross-check it against
`inventory/` (same table/view/function/trigger/policy names should all
appear) before it's trusted as the isolated-DB bootstrap artifact.

### How the manifest is used

`production_schema_baseline.manifest.json`'s `included_migrations` lists every
repo-tracked migration file already reflected in production's live schema
(so once the real `.sql` baseline is restored to an isolated DB, these must
**not** be re-applied — re-running them would fail or double-apply).
`pending_migrations_not_yet_applied_to_production` lists the rest, in
filename order, which is exactly what `supabase/isolated-test/run.cjs` should
apply after restoring the baseline. See `isolated_test_runner_contract` in
the manifest for the exact intended sequence.
