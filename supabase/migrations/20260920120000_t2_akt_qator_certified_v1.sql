-- T2-LRV-EXACT-F2-INTEGRATION-003 -- F2 exact-source truth columns.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
-- See ops/handoff/T2_LRV_EXACT_F2_INTEGRATION_003.md Section 1/6.
--
-- Corrects a P0 found in this task: t2_akt_qator.summa is GENERATED
-- (hajm*narx), so the certified F2 document's own stated amount can never
-- be stored if it differs from qty*price (e.g. rounding). Additive only --
-- hajm/narx/summa (generated) are UNTOUCHED, kept for backward
-- compatibility with every existing view/read path (t2_qator_holat,
-- t2_lrv, t2_f2_kat_oy, t2_f2_tafsilot). New certified_* columns are
-- plain (never generated) and are what a new write path
-- (t2_akt_yarat_v2, next migration) writes to directly.
--
-- Historical rows get provenance_status='unknown_provenance' -- their
-- certified_* stay NULL. qty*price is NEVER backfilled into certified_amount
-- as if it were the document's own value -- that would fabricate provenance.

begin;

alter table public.t2_akt_qator
  add column if not exists certified_quantity numeric,
  add column if not exists certified_unit_price numeric,
  add column if not exists certified_amount numeric,
  add column if not exists certified_source_hash text,
  add column if not exists raw_snapshot jsonb,
  add column if not exists provenance_status text not null default 'unknown_provenance'
    check (provenance_status in ('source_certified','unknown_provenance','needs_reconciliation')),
  add column if not exists change_type text
    check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT')),
  add column if not exists replaces_line_id bigint references public.t2_akt_qator(id);

-- Same structural (additional/replacement) columns on t2_qator (smeta),
-- per T2_LRV_CONTROL_001_CONTRACT.md Section 5/7. t2_qator already has
-- `operation_id` (row-creation idempotency) -- not duplicated here.
alter table public.t2_qator
  add column if not exists change_type text
    check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT')),
  add column if not exists replaces_line_id bigint references public.t2_qator(id);

comment on column public.t2_akt_qator.certified_quantity is
  'T2-LRV-EXACT-F2-INTEGRATION-003: source-certified quantity, independent of hajm. Written only by t2_akt_yarat_v2.';
comment on column public.t2_akt_qator.certified_amount is
  'T2-LRV-EXACT-F2-INTEGRATION-003: source-certified amount, independent of the generated summa (hajm*narx). NEVER recomputed from certified_quantity*certified_unit_price -- that comparison is calculated_amount at read time, F2_ARITHMETIC_MISMATCH if they differ, certified_amount is never overwritten by it.';
comment on column public.t2_akt_qator.provenance_status is
  'source_certified = written by t2_akt_yarat_v2 from a real document. unknown_provenance = pre-existing row, certified_* not backfilled (no fabricated provenance). needs_reconciliation = flagged for manual review.';

commit;
