-- Rollback for 20260908120000_t2_sheets_writeback_reference_v1.sql
begin;
drop function if exists public.t2_document_sheets_writeback_v1(bigint,bigint,bigint,text,text,text,integer,uuid);
drop table if exists public.t2_sheets_writeback_log;
commit;
