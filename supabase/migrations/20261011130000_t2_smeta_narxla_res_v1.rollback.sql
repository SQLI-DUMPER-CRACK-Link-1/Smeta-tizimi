-- Pre-use rollback only. Business rows are never removed or rewritten.
begin;
drop function if exists public.t2_smeta_narxla_res_v1(bigint, bigint, bigint, uuid, jsonb);
commit;
