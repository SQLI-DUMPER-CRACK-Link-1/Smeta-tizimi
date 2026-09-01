-- Rollback for 20260906120000_t2_document_registry_read_v1.sql
begin;
drop function if exists public.t2_document_registry_v1(bigint,bigint,bigint,bigint,integer);
commit;
