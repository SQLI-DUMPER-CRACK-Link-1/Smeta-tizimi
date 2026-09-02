-- Rollback for 20260907120000_t2_document_replica_move_v1.sql
begin;
drop function if exists public.t2_document_replica_move_v1(bigint,bigint,bigint,text,text,integer);
commit;
