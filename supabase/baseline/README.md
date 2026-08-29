# Canonical Supabase baseline

`supabase/migrations/` is the only forward schema source of truth. `supabase/tests/`
contains executable invariant checks and this directory records baseline evidence.
Historical SQL under `tizim02/` must not be used for deployment; it is reference-only.
