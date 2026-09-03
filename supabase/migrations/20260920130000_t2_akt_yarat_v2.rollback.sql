-- Rollback for 20260920130000_t2_akt_yarat_v2. Dropping the functions
-- does not touch any t2_akt/t2_akt_qator data they may have written --
-- safe at any time (the guard for the underlying certified_* data lives
-- in 20260920120000's rollback).
drop function if exists public.t2_f2_exact_qatorlar_v1(bigint,bigint);
drop function if exists public.t2_akt_yarat_v2(bigint,date,jsonb,bigint,text,uuid,text);
