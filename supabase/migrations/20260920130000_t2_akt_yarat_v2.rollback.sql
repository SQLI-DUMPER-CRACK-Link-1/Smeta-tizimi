-- Rollback for 20260920130000_t2_akt_yarat_v2. Dropping the function does
-- not touch any t2_akt/t2_akt_qator data it may have written (those rows
-- stay, only the entry point for creating NEW ones via this path is
-- removed) -- safe at any time, no pre-use guard needed here (the guard
-- for the underlying data lives in 20260920120000's rollback).
drop function if exists public.t2_akt_yarat_v2(bigint,text,date,jsonb,text,uuid,text,text,boolean);
