-- Rollback for 20260831191000_t2_storage_reconciliation_v2.
drop view if exists public.t2_storage_reconciliation_v2;

-- Restore the v1 view body from 20260830052000_t2_company_storage_foundation_v1.sql.
create or replace view public.t2_storage_reconciliation_v1 with (security_invoker=true) as
select o.id as obyekt_id,o.kompaniya_id,o.loyiha_id,o.nom,o.drive_id as legacy_drive_id,
 case when b.obyekt_id is not null then 'MATCHED'
      when o.loyiha_id is null then 'MISSING'
      else 'AMBIGUOUS' end as reconciliation_status
from public.t2_obyekt o left join public.t2_object_storage_binding b on b.obyekt_id=o.id;
