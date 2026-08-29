# Pending schema proposals — not runnable migrations

This folder is deliberately outside the active `supabase/migrations/` chain.
Files or references here are proposals only and must not be passed to
`supabase db push` or a production SQL runner.

The reviewed-but-not-approved Control Signal proposal is stored as
`20260829050000_t2_signal_engine.sql.pending`; the `.pending` suffix is
intentional so an automatic migration runner cannot discover it.

## Control Signal Engine V1 (`t2_signal`)

Status: **PENDING / NOT ACTIVE**.

The historical prototype and its test are retained only in Git commit
`f1eebdb` on the historical control-signal branch. Neither is part of this
checkout's executable migration chain.

Before any promotion, reconcile it against the canonical live baseline,
review security and tenant boundaries, create one new timestamped forward
migration in `supabase/migrations/`, and add its matching test in
`supabase/tests/`. Do not copy the prototype into multiple SQL locations, and
do not infer new live behaviour from it.
