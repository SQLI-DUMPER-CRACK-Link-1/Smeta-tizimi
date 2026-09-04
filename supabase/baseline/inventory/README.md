# inventory/ — live production schema inventory (read-only, no data)

Captured 2026-09-04 via Supabase MCP `execute_sql`, `SELECT`-only, against
project `tuoyrzadkgoltpqkdiyx` (`public` schema only). See
`../README.md` and `../production_schema_baseline.manifest.json` for the
full explanation and caveats — this is a structural inventory, **not** a
schema-only SQL dump.

| File | Contents |
|---|---|
| `objects.json` | Every table/view/sequence name + kind (97 tables, 48 views, 61 sequences) |
| `columns.json` | Every column of every table: name, position, data type, nullable, default (1629 rows) |
| `constraints.json` | Every PK/FK/UNIQUE/CHECK constraint with its full `pg_get_constraintdef()` text (344) |
| `indexes.json` | Every index's table + name (234) |
| `functions.json` | Every function's name, argument list, return type (205) |
| `triggers.json` | Every trigger's table + name (34) |
| `policies.json` | Every RLS policy's table, name, command, roles (25) |
| `extensions.json` | Installed Postgres extensions + versions (5: pgcrypto, plpgsql, supabase_vault, uuid-ossp, pg_stat_statements) |
| `applied_migrations_production.json` | Production's own migration ledger (`supabase_migrations.schema_migrations`), 140 entries, from `list_migrations` |
| `repo_migration_reconciliation.json` | Each repo-tracked `supabase/migrations/*.sql` file matched (by version or name) against the production ledger above, with a verdict per file |
