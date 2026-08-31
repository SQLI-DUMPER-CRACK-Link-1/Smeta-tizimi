-- STOR-001 flag B — deterministic legacy Drive reconciliation.
--
-- The v1 view classified every project-bound object without a binding as
-- AMBIGUOUS, which is a false positive: "no binding yet" is not "ambiguous".
-- v2 classifies strictly by EXACT external-ID evidence and never name-guesses.
--
--   MATCHED    : object has a verified t2_object_storage_binding AND its
--                folder_id equals the object's recorded legacy drive_id
--                (exact ID equality — same physical Drive folder).
--   BOUND_NEW  : object has a verified binding to a folder that is NOT its
--                legacy drive_id (a fresh canonical folder was provisioned;
--                legacy folder, if any, is superseded — not a conflict).
--   CONFLICT   : object has a verified binding whose folder_id differs from a
--                NON-NULL legacy drive_id AND the legacy folder still holds
--                files — needs a human decision. (Detected at report time by
--                the ops job, not in this view; flagged here as CONFLICT_CHECK.)
--   PENDING    : object has a legacy drive_id but no verified binding yet —
--                a candidate for provisioning, deterministic, not ambiguous.
--   NONE       : object has neither a legacy drive_id nor a binding — nothing
--                to reconcile.
--
-- Nothing is ever marked MATCHED on a guess. Name similarity is not used.

create or replace view public.t2_storage_reconciliation_v2 with (security_invoker=true) as
select
  o.id                              as obyekt_id,
  o.kompaniya_id,
  o.loyiha_id,
  o.nom                             as obyekt_nom,
  nullif(btrim(o.drive_id), '')     as legacy_drive_id,
  b.folder_id                       as canonical_folder_id,
  b.provisioning_status             as binding_status,
  case
    when b.obyekt_id is not null and b.provisioning_status = 'verified'
         and nullif(btrim(o.drive_id),'') is not null
         and b.folder_id = btrim(o.drive_id)                       then 'MATCHED'
    when b.obyekt_id is not null and b.provisioning_status = 'verified'
         and nullif(btrim(o.drive_id),'') is not null
         and b.folder_id <> btrim(o.drive_id)                      then 'CONFLICT_CHECK'
    when b.obyekt_id is not null and b.provisioning_status = 'verified' then 'BOUND_NEW'
    when nullif(btrim(o.drive_id),'') is not null                  then 'PENDING'
    else 'NONE'
  end                               as reconciliation_status
from public.t2_obyekt o
left join public.t2_object_storage_binding b
  on b.obyekt_id = o.id and b.kompaniya_id = o.kompaniya_id;

comment on view public.t2_storage_reconciliation_v2 is
  'STOR-001: deterministic legacy->canonical storage reconciliation. MATCHED only on exact folder-id equality; never name-guessed. CONFLICT_CHECK rows require a human decision.';

-- Keep v1 as a thin compatibility alias so existing readers do not break,
-- but redirect its semantics to the deterministic classification.
create or replace view public.t2_storage_reconciliation_v1 with (security_invoker=true) as
select obyekt_id, kompaniya_id, loyiha_id, obyekt_nom as nom, legacy_drive_id,
  case reconciliation_status
    when 'MATCHED' then 'MATCHED'
    when 'NONE' then 'MISSING'
    else 'AMBIGUOUS'
  end as reconciliation_status
from public.t2_storage_reconciliation_v2;
