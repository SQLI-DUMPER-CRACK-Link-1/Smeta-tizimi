-- Read-only. Existing objects are never bound automatically.
select * from public.t2_storage_reconciliation_v1 order by kompaniya_id, loyiha_id nulls first, obyekt_id;
