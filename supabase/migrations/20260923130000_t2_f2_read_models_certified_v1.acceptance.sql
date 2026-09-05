-- ACCEPTANCE for 20260923130000_t2_f2_read_models_certified_v1.sql -- read-only.
select count(*) as t2_f2_kat_oy_rows from public.t2_f2_kat_oy;
select count(*) as t2_f2_tafsilot_rows from public.t2_f2_tafsilot;
select count(*) as t2_f2_tafsilot_certified_rows from public.t2_f2_tafsilot where certified_amount is not null;
-- EXPECTED at authoring time: t2_f2_tafsilot_certified_rows = 0 (no-op today, per the same 0-certified-rows fact established in 20260923120000's acceptance).
