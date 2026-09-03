-- T2-LRV-EXACT-F2-INTEGRATION-003 -- F2 exact-source truth columns.
-- Revised in T2-REAL-PARK-LRV-VERTICAL-SLICE-004 to reconcile with
-- codex/t2-lrv-exact-f2-adapter-v1 (3591e37) -- see
-- ops/handoff/T2_REAL_PARK_LRV_VERTICAL_SLICE_004.md Section 0.
-- SOURCE ONLY. Production freeze active -- NOT applied in this task.
--
-- Corrects a P0: t2_akt_qator.summa is GENERATED (hajm*narx), so the
-- certified F2 document's own stated amount can never be stored if it
-- differs from qty*price (e.g. rounding). Additive only -- hajm/narx/summa
-- (generated) are UNTOUCHED, kept for backward compatibility with every
-- existing view/read path (t2_qator_holat, t2_lrv, t2_f2_kat_oy,
-- t2_f2_tafsilot). New certified_* columns are plain (never generated)
-- and are what t2_akt_yarat_v2 (next migration) writes to directly.
--
-- Reconciliation with codex/t2-lrv-exact-f2-adapter-v1: naming stays
-- `certified_*` (this branch's existing convention, already used
-- throughout T2_LRV_EXACT_F2_INTEGRATION_003.md /
-- T2_BRIDGE_CALLER_AUDIT_003.md) -- Codex's parallel `source_certified_*`
-- naming is NOT adopted (would be the two-parallel-truths the owner
-- explicitly forbade). Three of Codex's mechanisms ARE adopted onto this
-- naming, because they are real, correct improvements this branch's
-- original design lacked:
--   1. `price_intentionally_absent` as a third provenance value (this
--      branch only had a row-level narx_yoq write-time flag, not a
--      persisted state distinguishing "explicitly no price" from
--      "legacy row, provenance unknown").
--   2. A CHECK constraint tying provenance_status='source_certified' to
--      certified_quantity/certified_amount actually being non-null --
--      this branch only documented that invariant, Codex enforced it.
--   3. A BEFORE UPDATE trigger that makes "frozen once F2 is approved"
--      a real DB-enforced guarantee, not just a convention nobody's
--      code violates today. Adopted verbatim (adapted to this branch's
--      column names).
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
  add column if not exists provenance_status text not null default 'unknown_provenance',
  add column if not exists change_type text,
  add column if not exists replaces_line_id bigint references public.t2_akt_qator(id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 't2_akt_qator_provenance_status_ck') then
    alter table public.t2_akt_qator add constraint t2_akt_qator_provenance_status_ck
      check (provenance_status in ('source_certified','unknown_provenance','price_intentionally_absent','needs_reconciliation'));
  end if;
  -- Adopted from Codex: provenance_status='source_certified' REQUIRES the
  -- certified fields to actually be present -- can't claim "certified"
  -- with nothing behind it. price_intentionally_absent allows a null
  -- certified_unit_price/certified_amount (document explicitly has no
  -- price for this line) but still requires certified_quantity.
  if not exists (select 1 from pg_constraint where conname = 't2_akt_qator_certified_integrity_ck') then
    alter table public.t2_akt_qator add constraint t2_akt_qator_certified_integrity_ck check (
      case provenance_status
        when 'source_certified' then certified_quantity is not null and certified_unit_price is not null and certified_amount is not null
        when 'price_intentionally_absent' then certified_quantity is not null and certified_unit_price is null and certified_amount is null
        else true
      end
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 't2_akt_qator_change_type_ck') then
    alter table public.t2_akt_qator add constraint t2_akt_qator_change_type_ck
      check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT'));
  end if;
end $$;

-- Same structural (additional/replacement) columns on t2_qator (smeta).
-- Adopted from Codex: change_id ties a structural change to the EXISTING
-- audited change-control ledger (t2_smeta_ozgarish, from
-- smeta_f2_nakopitelniy) instead of leaving change_type/replaces_line_id
-- as unaudited metadata -- one audit trail, not two. t2_qator already has
-- `operation_id` (row-creation idempotency) -- not duplicated here.
alter table public.t2_qator
  add column if not exists change_type text,
  add column if not exists replaces_line_id bigint references public.t2_qator(id),
  add column if not exists change_id bigint references public.t2_smeta_ozgarish(id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 't2_qator_change_type_ck') then
    alter table public.t2_qator add constraint t2_qator_change_type_ck
      check (change_type is null or change_type in ('ADDITIONAL','REPLACEMENT'));
  end if;
end $$;
create index if not exists t2_qator_replaces_line_ix on public.t2_qator (replaces_line_id) where replaces_line_id is not null;
create index if not exists t2_qator_change_id_ix on public.t2_qator (change_id) where change_id is not null;

-- Adopted verbatim from Codex (adapted to this branch's column names):
-- once the parent F2 act is approved (t2_akt.tur='f2' and holat='tasdiqlangan'),
-- its certified_* columns become immutable at the DB level -- "frozen" is
-- an enforced guarantee, not a convention.
create or replace function public.t2_akt_qator_certified_freeze_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if exists (
    select 1 from public.t2_akt a
    where a.id = old.akt_id and a.tur = 'f2' and a.holat = 'tasdiqlangan'
  ) and (new.certified_quantity, new.certified_unit_price, new.certified_amount,
          new.provenance_status, new.certified_source_hash)
      is distinct from
         (old.certified_quantity, old.certified_unit_price, old.certified_amount,
          old.provenance_status, old.certified_source_hash) then
    raise exception using errcode = '23514', message = 'APPROVED_F2_CERTIFIED_FROZEN';
  end if;
  return new;
end
$function$;

drop trigger if exists t2_akt_qator_certified_freeze_v1_trg on public.t2_akt_qator;
create trigger t2_akt_qator_certified_freeze_v1_trg
  before update on public.t2_akt_qator
  for each row execute function public.t2_akt_qator_certified_freeze_v1();

comment on column public.t2_akt_qator.certified_quantity is
  'T2-LRV-EXACT-F2-INTEGRATION-003: source-certified quantity, independent of hajm. Written only by t2_akt_yarat_v2. Frozen once the parent F2 act is approved (t2_akt_qator_certified_freeze_v1_trg).';
comment on column public.t2_akt_qator.certified_amount is
  'T2-LRV-EXACT-F2-INTEGRATION-003: source-certified amount, independent of the generated summa (hajm*narx). NEVER recomputed from certified_quantity*certified_unit_price -- that comparison is calculated_amount at read time, F2_ARITHMETIC_MISMATCH if they differ, certified_amount is never overwritten by it.';
comment on column public.t2_akt_qator.provenance_status is
  'source_certified = written by t2_akt_yarat_v2 from a real document (quantity+price+amount all present). price_intentionally_absent = document explicitly has no price for this line (quantity present, price/amount null). unknown_provenance = pre-existing row, certified_* not backfilled (no fabricated provenance). needs_reconciliation = flagged for manual review.';

commit;
