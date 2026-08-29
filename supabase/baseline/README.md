# Baseline and reconciliation records

This directory is intentionally outside `supabase/migrations/`. It contains
evidence and proposals used while reconciling a live project that predates its
canonical migration tree. Nothing below this directory is executable by the
Supabase migration runner.

After a reviewed `supabase db pull`, place the resulting single baseline in
`supabase/migrations/` and record its review evidence here. Do not turn old
ad-hoc SQL into a second baseline or replay it against production.

Pending proposals are under [pending/](pending/README.md).
